import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { useAuth } from "../../contexts/AuthContext";
import { changeRegistration, listMyRegistrations, listOpenActivities, markCancellationRead } from "../../services/activityRegistrationApi";
import { fetchPublicTenants } from "../../services/tenantApi";
import { getTenantCode, setTenantCode } from "../../services/tenantStore";

function ActivityCard({ activity, children }) {
  return (
    <article className="card campus-activity">
      <div>
        <Link to={`/club/${activity.club.id}`}>{activity.club.name}</Link>
        <h2>{activity.title}</h2>
        <p>{new Date(activity.start_time).toLocaleString("zh-CN")} · {activity.location || "地点待定"}</p>
        {activity.description && <p className="campus-activity-description">{activity.description}</p>}
        {activity.cancellation_reason && (
          <p className="campus-activity-description">取消原因：{activity.cancellation_reason}</p>
        )}
      </div>
      <div className="campus-activity-actions">{children}</div>
    </article>
  );
}

function CampusActivitiesPage({ mine = false }) {
  const { isAuthenticated, token, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const clubId = mine ? null : params.get("club_id");
  const [tenantCode, selectTenant] = useState(() => getTenantCode() || "default");
  const [tenants, setTenants] = useState([]);
  const [activities, setActivities] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [membershipError, setMembershipError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [revision, setRevision] = useState(0);
  const from = mine ? "/my-registrations" : "/activities";

  useEffect(() => {
    let active = true;
    fetchPublicTenants()
      .then((result) => { if (active) setTenants(result.data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    const request = new AbortController();
    const { signal } = request;
    setLoading(true);
    setError("");
    setMembershipError("");
    setActivities([]);
    setRegistrations([]);
    const loadActivities = mine ? Promise.resolve() :
      listOpenActivities({ tenantCode, clubId, signal }).then(({ data }) => {
        if (!signal.aborted) setActivities(data);
      });
    const loadRegistrations = isAuthenticated ?
      listMyRegistrations({ token, tenantCode, signal }).then(({ data }) => {
        if (!signal.aborted) setRegistrations(data);
      }).catch((failure) => {
        if (!signal.aborted) {
          setMembershipError(failure.status === 403 ? "此账号无法在所选学校报名，请选择所属学校。" : "暂时无法读取报名记录。");
        }
      }) : Promise.resolve();
    Promise.allSettled([loadActivities, loadRegistrations]).then(([activityResult]) => {
      if (signal.aborted) return;
      if (activityResult.status === "rejected") setError("暂时无法加载活动，请核对所选学校或刷新重试。");
      setLoading(false);
    });
    return () => request.abort();
  }, [mine, tenantCode, clubId, token, isAuthenticated, authLoading, revision]);

  async function handleRegistration(id, cancel = false) {
    setFeedback(null);
    setBusyId(id);
    try {
      await changeRegistration({ id, token, tenantCode, cancel });
      setFeedback({ message: cancel ? "已取消报名，名额已释放。" : "报名成功，可以在「我的报名」查看。" });
    } catch (failure) {
      setFeedback({ message: failure.status === 409 ? failure.message : "操作失败，请刷新后重试。", type: "error" });
    } finally {
      setRevision((value) => value + 1);
      setBusyId(null);
    }
  }

  async function acknowledgeCancellation(id) {
    setBusyId(id);
    setFeedback(null);
    try {
      const { data } = await markCancellationRead({ id, token, tenantCode });
      setRegistrations((rows) => rows.map((entry) => entry.activity_id === id ?
        { ...entry, cancellation_read_at: data.cancellation_read_at } : entry));
    } catch {
      setFeedback({ message: "暂时无法标记已读，请重试。", type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  function handleTenantChange(event) {
    const code = event.target.value;
    setTenantCode(code);
    selectTenant(code);
    setLoading(true);
    setFeedback(null);
  }

  const registrationsById = new Map(registrations.map((entry) => [entry.activity_id, entry]));
  const unread = registrations.filter(({ activity, cancellation_read_at }) =>
    activity.status === "cancelled" && !cancellation_read_at
  );
  const visibleActivities = mine ? registrations.map(({ activity }) => activity) : activities;
  return (
    <main className="container campus-activities">
      <nav aria-label="校园活动导航" className="campus-activities-nav">
        <Link to="/">CCMS 首页</Link>
        <Link to="/activities" aria-current={!mine ? "page" : undefined}>社区广场</Link>
        {isAuthenticated && <Link to="/my-registrations" aria-current={mine ? "page" : undefined}>
          我的报名{unread.length ? `（${unread.length} 条未读）` : ""}
        </Link>}
        {isAuthenticated && <Link to="/admin">管理后台</Link>}
      </nav>
      <div className="page-header campus-activities-heading">
        <h1>{mine ? "我的报名" : "社区广场"}</h1>
        {tenants.length > 0 && (
          <label>
            学校{" "}
            <select value={tenantCode} onChange={handleTenantChange} disabled={busyId !== null}>
              {!tenants.some(({ code }) => code === tenantCode) && <option value={tenantCode}>{tenantCode}</option>}
              {tenants.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
        )}
      </div>
      {!mine && <h2>校园活动</h2>}
      {clubId && <p><Link to="/activities">查看全部社团活动</Link></p>}
      <FeedbackMessage message={error || membershipError} />
      <FeedbackMessage message={feedback?.message} type={feedback?.type || "success"} />
      {loading || authLoading ? <LoadingState message="正在加载活动..." /> : null}
      {!loading && mine && unread.length > 0 && (
        <section className="card" aria-labelledby="activity-cancellation-notices">
          <h2 id="activity-cancellation-notices">活动取消通知</h2>
          <ul>
            {unread.map(({ activity }) => (
              <li key={activity.id}>
                <p><strong>{activity.title}</strong> 已取消。{activity.cancellation_reason || ""}</p>
                <button type="button" className="btn-sm btn-outline" disabled={busyId !== null}
                  aria-label={`标记活动取消通知已读：${activity.title}`}
                  onClick={() => acknowledgeCancellation(activity.id)}>标为已读</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!loading && mine && !isAuthenticated && (
        <Link to="/login" state={{ from }} className="btn">登录查看我的报名</Link>
      )}
      {!loading && !error && (!mine || (isAuthenticated && !membershipError)) && (
        visibleActivities.length ? (
          <div className="campus-activities-list">
            {visibleActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity}>
                {mine ? (
                  activity.status === "approved" && new Date(activity.start_time).getTime() > Date.now() ? (
                    <>
                      <span>已报名</span>
                      <button type="button" className="btn-outline" disabled={busyId !== null} onClick={() => handleRegistration(activity.id, true)}>
                        {busyId === activity.id ? "处理中…" : "取消报名"}
                      </button>
                    </>
                  ) : (
                    <>
                      <span>{activity.status === "cancelled" ? "活动已取消" : activity.status === "completed" ? "活动已完成" : "已截止取消报名"}</span>
                      {registrationsById.get(activity.id)?.checked_in_at && <span>已签到</span>}
                    </>
                  )
                ) : (
                  <>
                    <span>剩余 {activity.remaining_places} / {activity.registration_capacity} 个名额</span>
                    {registrationsById.has(activity.id) ? <Link to="/my-registrations">已报名 · 查看记录</Link> :
                      activity.remaining_places === 0 ? <span>名额已满</span> :
                      !isAuthenticated ? <Link to="/login" state={{ from }} className="btn">登录后报名</Link> :
                      <button type="button" disabled={busyId !== null || Boolean(membershipError)} onClick={() => handleRegistration(activity.id)}>
                        {busyId === activity.id ? "处理中…" : "报名参加"}
                      </button>}
                  </>
                )}
              </ActivityCard>
            ))}
          </div>
        ) : <p>{mine ? "你还没有报名活动。" : "当前没有开放报名的活动。"}</p>
      )}
    </main>
  );
}

export default CampusActivitiesPage;

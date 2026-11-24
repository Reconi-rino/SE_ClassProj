import { useState } from "react";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import { listRegistrationRoster, setRegistrationAttendance } from "../../services/activityRegistrationApi";
import { updateActivityStatus } from "../../services/businessApi";
import { getUserFacingError } from "../../utils/errorMessage";

export default function RegistrationPanel({ activity, token, tenantCode }) {
  const [capacity, setCapacity] = useState(activity.registration_capacity ?? "");
  const [roster, setRoster] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const editable = activity.status === "draft" || activity.status === "rejected";
  const canCheckIn = activity.status === "approved" && new Date(activity.start_time).getTime() <= Date.now();
  const context = { id: activity.id, token, tenantCode };

  async function saveCapacity(event) {
    event.preventDefault();
    setError("");
    setSaved("");
    setBusy(true);
    try {
      await updateActivityStatus({
        ...context,
        payload: { registration_capacity: capacity === "" ? null : Number(capacity) },
      });
      setSaved(capacity === "" ? "已关闭报名设置。" : "报名名额已保存，活动审批通过后开放报名。");
    } catch (failure) {
      setError(getUserFacingError(failure, "保存名额失败。"));
    } finally {
      setBusy(false);
    }
  }

  async function loadRoster() {
    setError("");
    setBusy(true);
    try {
      const result = await listRegistrationRoster(context);
      setRoster(result.data);
    } catch (failure) {
      setRoster(null);
      setError(getUserFacingError(failure, "读取报名名单失败。"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAttendance(userId, checkedIn) {
    setError("");
    setSaved("");
    setBusy(true);
    try {
      const { data } = await setRegistrationAttendance({ ...context, userId, checkedIn });
      setRoster((rows) => rows.map((row) => row.user.id === userId ? { ...row, checked_in_at: data.checked_in_at } : row));
    } catch (failure) {
      setError(getUserFacingError(failure, "更新签到失败。"));
    } finally { setBusy(false); }
  }

  return (
    <section className="card" aria-labelledby="registration-panel-title">
      <div className="card-header"><h3 id="registration-panel-title" className="card-title">报名管理</h3></div>
      <FeedbackMessage message={error} />
      <FeedbackMessage message={saved} type="success" />
      {editable ? (
        <form className="inline-form wrap" onSubmit={saveCapacity}>
          <label htmlFor="activity-capacity">报名名额</label>
          <input id="activity-capacity" type="number" min="1" max="10000" value={capacity} disabled={busy}
            placeholder="留空则不开放报名" onChange={(event) => setCapacity(event.target.value)} style={{ maxWidth: 200 }} />
          <button type="submit" disabled={busy}>保存名额</button>
        </form>
      ) : (
        <>
          <p>报名名额 {capacity || "未配置"}</p>
          {capacity > 0 && <button type="button" disabled={busy} onClick={loadRoster}>{roster ? "刷新名单" : "查看报名名单"}</button>}
        </>
      )}
      {roster && (
        <>
          <p>已报名 {roster.length} 人 · 已签到 {roster.filter(({ checked_in_at }) => Boolean(checked_in_at)).length} 人</p>
          {roster.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">用户名</th><th scope="col">学号</th><th scope="col">报名时间</th><th scope="col">签到</th>{canCheckIn && <th scope="col">操作</th>}</tr></thead>
                <tbody>
                  {roster.map(({ user, created_at, checked_in_at }) => (
                    <tr key={user.id}>
                      <td>{user.username}</td><td>{user.student_id || "—"}</td>
                      <td>{new Date(created_at).toLocaleString("zh-CN")}</td>
                      <td>{checked_in_at ? new Date(checked_in_at).toLocaleString("zh-CN") : "未签到"}</td>
                      {canCheckIn && <td>
                        <button type="button" className="btn btn-sm btn-outline" disabled={busy}
                          aria-label={`${checked_in_at ? "撤销签到" : "签到"}：${user.username}`}
                          onClick={() => toggleAttendance(user.id, !checked_in_at)}>
                          {checked_in_at ? "撤销签到" : "签到"}
                        </button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

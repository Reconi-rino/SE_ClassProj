import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getActivity, updateActivityStatus, submitActivityApproval } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import StatusBadge from "../../components/Common/StatusBadge";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconCheckCircle } from "../../components/Common/Icons";
import RegistrationPanel from "./RegistrationPanel";
import { cancelPublishedActivity } from "../../services/activityRegistrationApi";

function ActivityDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await getActivity({ token, tenantCode: getTenantCode(), id });
      setActivity(result?.data || null);
    } catch (e) {
      setError(getUserFacingError(e, "加载活动详情失败"));
    } finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const quickSet = async (status) => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      await updateActivityStatus({ token, tenantCode: getTenantCode(), id, payload: { status } });
      setSuccess("状态更新成功");
      await load();
    } catch (e) { setError(getUserFacingError(e, "更新状态失败")); }
    finally { setBusy(false); }
  };

  const handleSubmit = async () => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      await submitActivityApproval({ token, tenantCode: getTenantCode(), id, payload: {} });
      setSuccess("审批请求已提交");
      await load();
    } catch (e) { setError(getUserFacingError(e, "提交审批失败")); }
    finally { setBusy(false); }
  };

  async function handleCancellation(event) {
    event.preventDefault();
    setError(""); setSuccess(""); setBusy(true);
    try {
      await cancelPublishedActivity({ token, tenantCode: getTenantCode(), id, reason });
      setCancelling(false);
      setReason("");
      setSuccess("活动已取消，已报名学生可在「我的报名」查看通知。");
      await load();
    } catch (failure) {
      setError(getUserFacingError(failure, "取消活动失败"));
    } finally { setBusy(false); }
  }

  const hasStarted = activity && new Date(activity.start_time).getTime() <= Date.now();
  const hasEnded = activity && new Date(activity.end_time || activity.start_time).getTime() <= Date.now();

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>{activity ? activity.title : "活动详情"}</h2>
          <p className="page-header-sub">ID：{activity?.id || "-"}</p>
        </div>
        <div className="actions-row">
          {activity?.can_review && <Link to="/admin/approvals" className="btn btn-sm"><IconCheckCircle size={14} /> 审批页面</Link>}
          <Link to="/admin/activities" className="btn btn-sm btn-outline">返回列表</Link>
        </div>
      </div>

      <FeedbackMessage message={error} />
      <FeedbackMessage message={success} type="success" duration={3000} />

      {loading ? (
        <LoadingState message="正在加载活动详情..." />
      ) : activity ? (
        <>
          <div className="card">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-item-label">标题</span>
                <span className="detail-item-value">{activity.title}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">状态</span>
                <span className="detail-item-value"><StatusBadge status={activity.status} /></span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">社团 ID</span>
                <span className="detail-item-value">{activity.club_id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">地点</span>
                <span className="detail-item-value">{activity.location || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">开始时间</span>
                <span className="detail-item-value">{activity.start_time || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">结束时间</span>
                <span className="detail-item-value">{activity.end_time || "-"}</span>
              </div>
            </div>
            <hr className="divider" />
            <div className="detail-item">
              <span className="detail-item-label">描述</span>
              <span className="detail-item-value">{activity.description || "暂无描述"}</span>
            </div>
            {activity.review_comment && <p className="feedback feedback-warning">驳回原因：{activity.review_comment}</p>}
            {activity.cancellation_reason && <p className="feedback feedback-warning">取消原因：{activity.cancellation_reason}</p>}
          </div>

          {activity.can_manage && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">操作面板</h3></div>
              <div className="inline-form wrap">
                {activity.status === "draft" && <button type="button" disabled={busy} onClick={handleSubmit}>提交审批</button>}
                {activity.status === "rejected" && <button type="button" disabled={busy} onClick={() => quickSet("draft")}>恢复为草稿</button>}
                {activity.status === "approved" && !hasStarted && !cancelling &&
                  <button type="button" className="btn-outline" disabled={busy} onClick={() => setCancelling(true)}>取消活动</button>}
                {activity.status === "approved" && hasEnded &&
                  <button type="button" className="btn-outline" disabled={busy} onClick={() => quickSet("completed")}>标记为已完成</button>}
                {activity.status === "pending_approval" && <p>等待审批</p>}
                {activity.status === "completed" && <p>活动已完成</p>}
              </div>
              {activity.status === "approved" && cancelling && !hasStarted && (
                <form className="auth-form" onSubmit={handleCancellation}>
                  <div className="form-group">
                    <label htmlFor="activity-cancellation-reason">取消原因</label>
                    <textarea id="activity-cancellation-reason" value={reason} maxLength={500} rows={3}
                      onChange={(event) => setReason(event.target.value)} required />
                  </div>
                  <p className="hint">取消后停止报名并保留原名单，原因会发送给已报名学生。</p>
                  <div className="actions-row">
                    <button type="submit" className="btn-danger" disabled={busy || !reason.trim()}>确认取消活动</button>
                    <button type="button" className="btn-outline" disabled={busy} onClick={() => setCancelling(false)}>返回</button>
                  </div>
                </form>
              )}
            </div>
          )}
          {activity.can_manage && <RegistrationPanel key={activity.id} activity={activity} token={token} tenantCode={getTenantCode()} />}
        </>
      ) : null}
    </div>
  );
}

export default ActivityDetailPage;

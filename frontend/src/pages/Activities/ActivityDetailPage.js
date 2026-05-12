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

function ActivityDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [approverId, setApproverId] = useState("");

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
    setError(""); setSuccess("");
    try {
      await updateActivityStatus({ token, tenantCode: getTenantCode(), id, payload: { status } });
      setSuccess("状态更新成功");
      await load();
    } catch (e) { setError(getUserFacingError(e, "更新状态失败")); }
  };

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!approverId) { setError("请输入审批人的用户ID"); return; }
    try {
      await submitActivityApproval({ token, tenantCode: getTenantCode(), id, payload: { approver_id: Number(approverId), comments: "通过 UI 提交审批" } });
      setSuccess("审批请求已提交");
      await load(); setApproverId("");
    } catch (e) { setError(getUserFacingError(e, "提交审批失败")); }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>{activity ? activity.title : "活动详情"}</h2>
          <p className="page-header-sub">ID：{activity?.id || "-"}</p>
        </div>
        <div className="actions-row">
          <Link to="/approvals" className="btn btn-sm"><IconCheckCircle size={14} /> 审批页面</Link>
          <Link to="/activities" className="btn btn-sm btn-outline">返回列表</Link>
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
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">操作面板</h3></div>
            <div className="inline-form wrap">
              <input placeholder="审批人用户 ID" value={approverId} onChange={(e) => setApproverId(e.target.value)} style={{ maxWidth: 170 }} />
              <button type="button" onClick={handleSubmit}>提交审批</button>
              <button type="button" className="btn-outline" onClick={() => quickSet("completed")}>标记为已完成</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default ActivityDetailPage;

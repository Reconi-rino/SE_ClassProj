import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { decideApproval, listApprovals } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import StatusBadge from "../../components/Common/StatusBadge";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconCheckCircle } from "../../components/Common/Icons";

function ApprovalPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState("pending");
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listApprovals({ token, tenantCode: getTenantCode(), status });
      setApprovals(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setApprovals([]);
      setError(e.status === 403 ? "此学校的活动审批由学校管理员处理。" : getUserFacingError(e, "加载审批列表失败"));
    } finally { setLoading(false); }
  }, [token, status]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (id, decision) => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      await decideApproval({
        token, tenantCode: getTenantCode(), id,
        payload: { decision, ...(decision === "reject" ? { comments: reason } : {}) },
      });
      setSuccess(decision === "approve" ? "已批准" : "已驳回");
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) { setError(getUserFacingError(e, "提交审批结果失败")); }
    finally { setBusy(false); }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>审批中心</h2>
          <p className="page-header-sub">处理活动的审批请求</p>
        </div>
      </div>

      <div className="filter-toolbar">
        <select aria-label="审批状态" value={status} disabled={busy} onChange={(e) => {
          setStatus(e.target.value); setRejecting(null); setReason("");
        }}>
          <option value="pending">待审批</option>
          <option value="approved">已批准</option>
          <option value="rejected">已驳回</option>
        </select>
        <button type="button" className="btn-outline" disabled={busy} onClick={load}><IconCheckCircle size={14} /> 刷新</button>
      </div>

      <FeedbackMessage message={error} />
      <FeedbackMessage message={success} type="success" duration={3000} />

      {loading ? (
        <LoadingState message="正在加载审批数据..." />
      ) : error && approvals.length === 0 ? null : approvals.length === 0 ? (
        <div className="card"><div className="empty-state"><h3>暂无审批</h3><p>当前没有{status === "pending" ? "待审批的" : status === "approved" ? "已批准的" : "已驳回的"}请求。</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>审批 ID</th><th>活动</th><th>状态</th><th>审批人</th><th>意见</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((item) => (
                <tr key={item.id}>
                  <td className="cell-mono">{item.id}</td>
                  <td><Link to={`/admin/activities/${item.activity_id}`}>{item.activity?.title || item.activity_id}</Link></td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>{item.reviewer?.username || item.approver?.username || "—"}</td>
                  <td style={{ color: "var(--color-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.comments || "-"}</td>
                  <td>
                    {item.can_decide && rejecting === item.id ? (
                      <form className="auth-form" onSubmit={(event) => {
                        event.preventDefault(); handleDecision(item.id, "reject");
                      }}>
                        <label htmlFor={`reject-reason-${item.id}`}>驳回原因</label>
                        <textarea id={`reject-reason-${item.id}`} rows={2} maxLength={5000} value={reason}
                          onChange={(event) => setReason(event.target.value)} required />
                        <div className="actions-row">
                          <button type="submit" className="btn-sm btn-danger" disabled={busy || !reason.trim()}>确认驳回</button>
                          <button type="button" className="btn-sm btn-outline" disabled={busy} onClick={() => setRejecting(null)}>返回</button>
                        </div>
                      </form>
                    ) : item.can_decide ? (
                      <div className="actions-row">
                        <button type="button" className="btn-sm btn-success" disabled={busy} onClick={() => handleDecision(item.id, "approve")}>通过</button>
                        <button type="button" className="btn-sm btn-danger" disabled={busy}
                          onClick={() => { setRejecting(item.id); setReason(""); }}>驳回</button>
                      </div>
                    ) : item.status === "pending" ? "需其他管理员处理" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ApprovalPage;

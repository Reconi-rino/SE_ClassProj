import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listApprovals({ token, tenantCode: getTenantCode(), status });
      setApprovals(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载审批列表失败"));
    } finally { setLoading(false); }
  }, [token, status]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (id, decision) => {
    setError(""); setSuccess("");
    try {
      await decideApproval({
        token, tenantCode: getTenantCode(), id,
        payload: { decision, comments: decision === "reject" ? "审批未通过，请补充材料。" : "审批通过。" },
      });
      setSuccess(decision === "approve" ? "已批准" : "已驳回");
      await load();
    } catch (e) { setError(getUserFacingError(e, "提交审批结果失败")); }
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
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">待审批</option>
          <option value="approved">已批准</option>
          <option value="rejected">已驳回</option>
        </select>
        <button type="button" className="btn-outline" onClick={load}><IconCheckCircle size={14} /> 刷新</button>
      </div>

      <FeedbackMessage message={error} />
      <FeedbackMessage message={success} type="success" duration={3000} />

      {loading ? (
        <LoadingState message="正在加载审批数据..." />
      ) : approvals.length === 0 ? (
        <div className="card"><div className="empty-state"><h3>暂无审批</h3><p>当前没有{status === "pending" ? "待审批的" : status === "approved" ? "已批准的" : "已驳回的"}请求。</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>审批 ID</th><th>活动 ID</th><th>状态</th><th>审批人</th><th>意见</th><th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((item) => (
                <tr key={item.id}>
                  <td className="cell-mono">{item.id}</td>
                  <td className="cell-mono">{item.activity_id}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="cell-mono">{item.approver_id || "-"}</td>
                  <td style={{ color: "var(--color-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.comments || "-"}</td>
                  <td>
                    <div className="actions-row">
                      <button className="btn-sm btn-success" onClick={() => handleDecision(item.id, "approve")}>通过</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDecision(item.id, "reject")}>驳回</button>
                    </div>
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

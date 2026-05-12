import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { listActivities } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import StatusBadge from "../../components/Common/StatusBadge";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconSparkle } from "../../components/Common/Icons";

function ActivityListPage() {
  const { token } = useAuth();
  const [activities, setActivities] = useState([]);
  const [filters, setFilters] = useState({ status: "", clubId: "", startDate: "", endDate: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listActivities({ token, tenantCode: getTenantCode(), ...filters });
      setActivities(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载活动列表失败"));
    } finally { setLoading(false); }
  }, [token, filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>活动列表</h2>
          <p className="page-header-sub">浏览与管理所有活动</p>
        </div>
        <Link to="/activities/new" className="btn"><IconSparkle size={16} /> 创建活动</Link>
      </div>

      <div className="filter-toolbar">
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending_approval">待审批</option>
          <option value="approved">已批准</option>
          <option value="rejected">已驳回</option>
          <option value="published">已发布</option>
          <option value="cancelled">已取消</option>
          <option value="completed">已完成</option>
        </select>
        <input placeholder="社团 ID" value={filters.clubId} onChange={(e) => setFilters((p) => ({ ...p, clubId: e.target.value }))} style={{ maxWidth: 110 }} />
        <input type="date" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
        <input type="date" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
        <button type="button" onClick={load}>筛选</button>
      </div>

      <FeedbackMessage message={error} />

      {loading ? (
        <LoadingState message="正在加载活动列表..." />
      ) : activities.length === 0 ? (
        <div className="card"><div className="empty-state"><h3>暂无活动</h3><p>点击「创建活动」开始策划新的社团活动。</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>标题</th><th>状态</th><th>社团</th><th>开始时间</th><th style={{ width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td className="cell-mono">{a.id}</td>
                  <td className="cell-strong">{a.title}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className="cell-mono">{a.club_id || "-"}</td>
                  <td style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{a.start_time || "-"}</td>
                  <td><Link to={`/activities/${a.id}`} className="btn btn-sm">详情</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ActivityListPage;

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { listClubs } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconPlus, IconBuilding } from "../../components/Common/Icons";

function ClubListPage() {
  const { token } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listClubs({ token, tenantCode: getTenantCode(), search, status });
      setClubs(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载社团列表失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, [token, search, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>社团列表</h2>
          <p className="page-header-sub">管理当前租户下的所有社团</p>
        </div>
        <Link to="/clubs/new" className="btn">
          <IconPlus size={16} />
          创建社团
        </Link>
      </div>

      <div className="filter-toolbar">
        <input placeholder="搜索社团名称..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 280 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="inactive">停用</option>
        </select>
        <button type="button" onClick={load}>查询</button>
      </div>

      <FeedbackMessage message={error} />

      {loading ? (
        <LoadingState message="正在加载社团列表..." />
      ) : clubs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><IconBuilding size={48} /></div>
            <h3>暂无社团</h3>
            <p>点击「创建社团」按钮来创建第一个社团。</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>名称</th>
                <th>状态</th>
                <th style={{ width: 150 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => (
                <tr key={club.id}>
                  <td className="cell-mono">{club.id}</td>
                  <td className="cell-strong">{club.name}</td>
                  <td>
                    <span className={`badge ${club.status === "active" ? "badge-green" : "badge-gray"}`}>
                      <span className="badge-dot" />
                      {club.status === "active" ? "活跃" : "停用"}
                    </span>
                  </td>
                  <td>
                    <div className="actions-row">
                      <Link to={`/clubs/${club.id}`} className="btn btn-sm">详情</Link>
                      <Link to={`/clubs/${club.id}/members`} className="btn btn-sm btn-outline">成员</Link>
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

export default ClubListPage;

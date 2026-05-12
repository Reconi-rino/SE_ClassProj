import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getClub } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconUsers } from "../../components/Common/Icons";

function ClubDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const result = await getClub({ token, tenantCode: getTenantCode(), id });
        setClub(result?.data || null);
      } catch (e) {
        setError(getUserFacingError(e, "加载社团详情失败，请稍后重试。"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>{club ? club.name : "社团详情"}</h2>
          <p className="page-header-sub">ID：{club?.id || "-"}</p>
        </div>
        <div className="actions-row">
          <Link to={`/clubs/${id}/members`} className="btn btn-sm">
            <IconUsers size={14} />
            管理成员
          </Link>
          <Link to="/clubs" className="btn btn-sm btn-outline">
            返回列表
          </Link>
        </div>
      </div>

      <FeedbackMessage message={error} />

      {loading ? (
        <LoadingState message="正在加载社团详情..." />
      ) : club ? (
        <div className="card">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item-label">社团 ID</span>
              <span className="detail-item-value">{club.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">名称</span>
              <span className="detail-item-value">{club.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">状态</span>
              <span className="detail-item-value">
                <span className={`badge ${club.status === "active" ? "badge-green" : "badge-gray"}`}>
                  <span className="badge-dot" />
                  {club.status === "active" ? "活跃" : "停用"}
                </span>
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">创建者 ID</span>
              <span className="detail-item-value">{club.founder_id || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">创建时间</span>
              <span className="detail-item-value">{club.created_at || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">更新时间</span>
              <span className="detail-item-value">{club.updated_at || "-"}</span>
            </div>
          </div>
          <hr className="divider" />
          <div className="detail-item">
            <span className="detail-item-label">简介</span>
            <span className="detail-item-value">{club.description || "暂无简介"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ClubDetailPage;

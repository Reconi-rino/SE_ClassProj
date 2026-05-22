import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../../services/apiClient";
import { getTenantCode } from "../../services/tenantStore";

function ClubDetailPage() {
  const { id } = useParams();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest(`/public/clubs/${id}`, { tenantCode: getTenantCode() || "default" });
      setClub(result?.data || null);
    } catch { setClub(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "120px 32px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto" }} />
        <p style={{ color: "var(--gray-400)", marginTop: 16 }}>加载中...</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div style={{ textAlign: "center", padding: "120px 32px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px",
          background: "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, color: "var(--gray-300)",
        }}>▢</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>社团未找到</h2>
        <p style={{ color: "var(--gray-400)", marginBottom: 24 }}>该社团不存在或已下线</p>
        <Link to="/" style={{ color: "var(--blue)", fontWeight: 600 }}>返回首页</Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)", WebkitFontSmoothing: "antialiased" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)", backdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "0 32px",
          height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--blue)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700,
            }}>C</div>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>CCMS</span>
          </Link>
          <div style={{ display: "flex", gap: 12 }}>
            <Link to="/login" style={{
              color: "var(--color-text-secondary)", textDecoration: "none",
              fontSize: 14, fontWeight: 500, padding: "6px 16px", borderRadius: 8,
            }}>登录</Link>
            <Link to="/register" style={{
              background: "var(--blue)", color: "#fff", textDecoration: "none",
              fontSize: 14, fontWeight: 600, padding: "8px 20px", borderRadius: 8,
            }}>加入我们</Link>
          </div>
        </div>
      </header>

      {/* Cover */}
      <div style={{
        height: "clamp(240px, 35vw, 400px)", position: "relative", overflow: "hidden",
        background: club.cover_image_url
          ? `url(${club.cover_image_url}) center/cover`
          : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
        }} />
        <div style={{
          position: "absolute", bottom: 40, left: 0, right: 0,
          maxWidth: 900, margin: "0 auto", padding: "0 32px",
        }}>
          <div style={{
            display: "inline-block", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
            color: "#fff", fontSize: 12, fontWeight: 600,
            padding: "4px 12px", borderRadius: 20, marginBottom: 12,
          }}>
            社团详情
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800,
            letterSpacing: "-0.03em", color: "#fff", margin: 0, lineHeight: 1.15,
          }}>
            {club.name}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 32px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 32 }}>
          <Link to="/" style={{ color: "var(--blue)", fontSize: 13, fontWeight: 500 }}>首页</Link>
          <span style={{ color: "var(--gray-300)", margin: "0 8px" }}>/</span>
          <span style={{ color: "var(--gray-500)", fontSize: 13 }}>{club.name}</span>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 32, marginBottom: 32, flexWrap: "wrap",
          padding: "20px 24px", background: "var(--gray-50)", borderRadius: 12,
        }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 2 }}>创始人</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              <span style={{
                display: "inline-block", width: 22, height: 22, borderRadius: "50%",
                background: "var(--blue-light)", color: "var(--blue)",
                fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: "22px",
                marginRight: 6, verticalAlign: "middle",
              }}>
                {club.founder?.username?.slice(0, 1).toUpperCase() || "?"}
              </span>
              {club.founder?.username || "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 2 }}>成员</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{club.member_count}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 2 }}>活动</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{club.activity_count}</div>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 12 }}>
            关于我们
          </h2>
          <p style={{
            fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.9,
            whiteSpace: "pre-wrap",
          }}>
            {club.description || "这个社团还没有填写简介。"}
          </p>
        </div>

        {/* Recent Activities */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 16 }}>
            近期活动
          </h2>
          {club.recent_activities && club.recent_activities.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {club.recent_activities.map((act) => (
                <div key={act.id} style={{
                  padding: "16px 20px", borderRadius: 10,
                  border: "1px solid var(--gray-200)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{act.title}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-400)" }}>
                      {act.location && `${act.location} · `}
                      {act.start_time && new Date(act.start_time).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: "3px 10px", borderRadius: 20,
                    background: act.status === "approved" ? "var(--green-light)" : "var(--gray-100)",
                    color: act.status === "approved" ? "var(--green)" : "var(--gray-500)",
                  }}>
                    {act.status === "draft" ? "草稿" : act.status === "approved" ? "已通过" : act.status === "pending_approval" ? "待审批" : act.status === "completed" ? "已完成" : act.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: "32px", textAlign: "center", borderRadius: 10,
              background: "var(--gray-50)", border: "1px dashed var(--gray-200)",
            }}>
              <p style={{ fontSize: 14, color: "var(--gray-400)", margin: 0 }}>
                暂无活动记录
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{
          textAlign: "center", padding: "40px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: 16, color: "#fff",
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#fff" }}>
            对 {club.name} 感兴趣？
          </h3>
          <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 24 }}>
            注册账号即可申请加入
          </p>
          <Link to="/register" style={{
            display: "inline-block", background: "#fff", color: "#667eea",
            textDecoration: "none", padding: "12px 32px",
            borderRadius: 8, fontSize: 15, fontWeight: 700,
          }}>立即加入</Link>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        background: "var(--gray-50)", borderTop: "1px solid var(--gray-100)",
        padding: "32px", textAlign: "center",
      }}>
        <p style={{ fontSize: 12, color: "var(--gray-400)", margin: 0 }}>
          &copy; 2026 CCMS Campus Club Management System
        </p>
      </footer>
    </div>
  );
}

export default ClubDetailPage;

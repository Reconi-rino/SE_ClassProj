import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getTenantCode } from "../../services/tenantStore";
import { apiRequest } from "../../services/apiClient";

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.unobserve(el);
  }, [threshold]);
  return [ref, inView];
}

function StatItem({ value, label, delay }) {
  const [ref, inView] = useInView(0.3);
  return (
    <div ref={ref} style={{
      textAlign: "center",
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      <div style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>{value}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function ClubCard({ club, index }) {
  const [ref, inView] = useInView(0.1);
  const gradient = GRADIENTS[index % GRADIENTS.length];

  return (
    <Link
      to={`/club/${club.id}`}
      ref={ref}
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`,
      }}
    >
      <div style={{
        borderRadius: 16, overflow: "hidden",
        background: "#fff",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.06)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.06)"; }}
      >
        {/* Cover image */}
        <div style={{
          height: 200, position: "relative", overflow: "hidden",
          background: club.cover_image_url ? `url(${club.cover_image_url}) center/cover` : gradient,
        }}>
          {club.cover_image_url && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 60%)",
            }} />
          )}
          {!club.cover_image_url && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 56, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {club.name.slice(0, 2)}
              </span>
            </div>
          )}
          {/* Badge overlay */}
          <div style={{
            position: "absolute", bottom: 12, left: 12,
            display: "flex", gap: 8,
          }}>
            <span style={{
              background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
              color: "#fff", fontSize: 12, fontWeight: 600,
              padding: "4px 10px", borderRadius: 20,
            }}>{club.member_count} 成员</span>
            <span style={{
              background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
              color: "#fff", fontSize: 12, fontWeight: 600,
              padding: "4px 10px", borderRadius: 20,
            }}>{club.activity_count} 活动</span>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: "20px 20px 24px" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
            {club.name}
          </h3>
          <p style={{
            fontSize: 13, color: "var(--gray-500)", lineHeight: 1.7, marginBottom: 12,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {club.description || "暂无简介"}
          </p>
          <div style={{ fontSize: 12, color: "var(--gray-400)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              display: "inline-block", width: 20, height: 20, borderRadius: "50%",
              background: "var(--blue-light)", color: "var(--blue)",
              fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: "20px",
            }}>
              {club.founder?.username?.slice(0, 1).toUpperCase() || "?"}
            </span>
            创始人: {club.founder?.username || "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}

function HomePage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroRef, heroInView] = useInView(0.2);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest("/public/clubs", { tenantCode: getTenantCode() || "default" });
      setClubs(Array.isArray(result?.data) ? result.data : []);
    } catch { setClubs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalMembers = clubs.reduce((s, c) => s + c.member_count, 0);
  const totalActivities = clubs.reduce((s, c) => s + c.activity_count, 0);

  return (
    <div style={{ fontFamily: "var(--font-sans)", WebkitFontSmoothing: "antialiased" }}>
      {/* ====== Header ====== */}
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
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link to="/login" style={{
              color: "var(--color-text-secondary)", textDecoration: "none",
              fontSize: 14, fontWeight: 500, padding: "6px 16px",
              borderRadius: 8, transition: "background 0.15s",
            }}>登录</Link>
            <Link to="/register" style={{
              background: "var(--blue)", color: "#fff", textDecoration: "none",
              fontSize: 14, fontWeight: 600, padding: "8px 20px",
              borderRadius: 8, transition: "background 0.15s",
            }}>加入我们</Link>
          </div>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section ref={heroRef} style={{
        background: "linear-gradient(180deg, #0a0a0b 0%, #1a1a2e 40%, #16213e 100%)",
        padding: "100px 32px 120px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {/* Subtle grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-block", background: "rgba(100,126,234,0.15)",
            color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600,
            padding: "6px 16px", borderRadius: 20, marginBottom: 32,
            opacity: heroInView ? 1 : 0, transform: heroInView ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}>
            发现你的校园社团
          </div>
          <h1 style={{
            fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 800, letterSpacing: "-0.04em",
            color: "#fff", marginBottom: 20, lineHeight: 1.1,
            opacity: heroInView ? 1 : 0, transform: heroInView ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
          }}>
            找到属于你的
            <br />
            <span style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              社团文化
            </span>
          </h1>
          <p style={{
            fontSize: "clamp(16px, 2.5vw, 20px)", color: "rgba(255,255,255,0.65)",
            maxWidth: 540, margin: "0 auto 48px", lineHeight: 1.8,
            opacity: heroInView ? 1 : 0, transform: heroInView ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s",
          }}>
            从编程到音乐，从运动到公益 — 每个社团都是一群人的热爱与坚持。加入他们，让校园生活更有温度。
          </p>
          <div style={{
            display: "flex", gap: 16, justifyContent: "center",
            opacity: heroInView ? 1 : 0, transform: heroInView ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s",
          }}>
            <Link to="/register" style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)", color: "#fff",
              textDecoration: "none", padding: "14px 36px",
              borderRadius: 10, fontSize: 16, fontWeight: 600,
              transition: "transform 0.15s, box-shadow 0.15s",
              boxShadow: "0 4px 16px rgba(102,126,234,0.3)",
            }}>立即加入</Link>
            <a href="#clubs" style={{
              border: "1.5px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)",
              textDecoration: "none", padding: "14px 36px",
              borderRadius: 10, fontSize: 16, fontWeight: 600,
              transition: "border-color 0.15s",
            }}>浏览社团</a>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          maxWidth: 720, margin: "80px auto 0", position: "relative", zIndex: 1,
          display: "flex", justifyContent: "center", gap: "clamp(32px, 8vw, 80px)",
          padding: "24px 0", borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <StatItem value={clubs.length} label="活跃社团" delay={0.4} />
          <StatItem value={totalMembers} label="社团成员" delay={0.5} />
          <StatItem value={totalActivities} label="精彩活动" delay={0.6} />
        </div>
      </section>

      {/* ====== Club Grid ====== */}
      <section id="clubs" style={{
        padding: "80px 32px 60px", background: "var(--gray-50)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700,
              letterSpacing: "-0.03em", marginBottom: 12,
            }}>
              加入这些社团
            </h2>
            <p style={{ fontSize: 16, color: "var(--color-text-secondary)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              浏览正在招募的活跃社团，找到志同道合的伙伴
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div className="loading-spinner" style={{ margin: "0 auto" }} />
              <p style={{ color: "var(--gray-400)", marginTop: 16, fontSize: 14 }}>正在加载社团...</p>
            </div>
          ) : clubs.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "80px 0", background: "#fff",
              borderRadius: 16, boxShadow: "0 0 0 1px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
                background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24,
              }}>
                <span style={{ opacity: 0.4 }}>▢</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                暂无社团
              </h3>
              <p style={{ color: "var(--gray-400)", fontSize: 14 }}>
                精彩即将到来，稍后再来看看
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 28,
            }}>
              {clubs.map((club, i) => (
                <ClubCard key={club.id} club={club} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ====== CTA Section ====== */}
      <section style={{
        padding: "80px 32px", background: "#fff", textAlign: "center",
        borderTop: "1px solid var(--gray-100)",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700,
            letterSpacing: "-0.03em", marginBottom: 12,
          }}>
            准备好了吗？
          </h2>
          <p style={{
            fontSize: 16, color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: 36,
          }}>
            现在就注册账号，加入你感兴趣的社团，开启丰富多彩的校园生活
          </p>
          <Link to="/register" style={{
            display: "inline-block", background: "var(--blue)", color: "#fff",
            textDecoration: "none", padding: "14px 40px",
            borderRadius: 10, fontSize: 16, fontWeight: 600,
            transition: "transform 0.15s, box-shadow 0.15s",
          }}>
            免费注册
          </Link>
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--gray-400)" }}>
            已有账号？<Link to="/login" style={{ fontWeight: 600 }}>立即登录</Link>
          </p>
        </div>
      </section>

      {/* ====== Footer ====== */}
      <footer style={{
        background: "var(--gray-50)", borderTop: "1px solid var(--gray-100)",
        padding: "40px 32px", textAlign: "center",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: "var(--blue)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>C</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-700)" }}>CCMS</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--gray-400)", lineHeight: 1.6 }}>
            校园社团管理系统 · Campus Club Management System
            <br />
            &copy; 2026 CCMS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;

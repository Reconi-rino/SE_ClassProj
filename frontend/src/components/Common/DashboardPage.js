import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { IconBuilding, IconCalendar, IconCheckCircle, IconDollar, IconEye } from "./Icons";

const roleLabels = {
  system_admin: "系统管理员",
  club_admin: "社团管理员",
  tenant_admin: "租户管理员",
  student: "学生",
};

const statCards = [
  { to: "/clubs", label: "社团管理", sub: "浏览与管理社团信息", icon: IconBuilding, color: "brand" },
  { to: "/activities", label: "活动管理", sub: "创建与跟踪活动状态", icon: IconCalendar, color: "green" },
  { to: "/approvals", label: "审批中心", sub: "处理活动审批请求", icon: IconCheckCircle, color: "amber" },
  { to: "/finance", label: "财务管理", sub: "收支记录与统计报表", icon: IconDollar, color: "sky" },
];

const quickLinks = [
  { to: "/clubs", label: "社团管理", icon: IconBuilding },
  { to: "/activities", label: "活动管理", icon: IconCalendar },
  { to: "/approvals", label: "审批中心", icon: IconCheckCircle },
  { to: "/finance", label: "财务仪表盘", icon: IconDollar },
  { to: "/finance/public", label: "财务公开页", icon: IconEye },
];

function DashboardPage() {
  const { user } = useAuth();
  const roleLabel = roleLabels[user?.role] || user?.role || "";
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="container">
      <div className="welcome-hero">
        <h2>欢迎回来，{user?.username}</h2>
        <p>
          当前以 <strong>{roleLabel}</strong> 身份登录 &nbsp;·&nbsp; {today}
        </p>
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <Link key={card.to} to={card.to} className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
            <div className={`stat-card-icon ${card.color}`}>
              <card.icon size={22} />
            </div>
            <div className="stat-card-body">
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-sub">{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">账户信息</h3>
        </div>
        <div className="profile-rows">
          <div className="profile-row">
            <span className="profile-row-label">用户 ID</span>
            <span className="profile-row-value">{user?.id}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">用户名</span>
            <span className="profile-row-value">{user?.username}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">邮箱</span>
            <span className="profile-row-value">{user?.email}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">角色</span>
            <span className="profile-row-value">
              <span className="tag">{roleLabel}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="quick-links">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to} className="quick-link">
            <span className="quick-link-icon">
              <link.icon size={18} />
            </span>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;

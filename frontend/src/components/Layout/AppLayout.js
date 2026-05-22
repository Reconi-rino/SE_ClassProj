import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getTenantCode, setTenantCode } from "../../services/tenantStore";
import {
  IconHome, IconBuilding, IconCalendar, IconCheckCircle, IconDollar, IconSparkle,
  IconPlus, IconEye, IconFile, IconLogout, IconArrowLeft, IconArrowRight, IconSun, IconMoon
} from "../Common/Icons";

const navSections = [
  {
    label: "概览",
    items: [
      { to: "/admin", label: "控制台", icon: IconHome, end: true },
    ],
  },
  {
    label: "社团管理",
    items: [
      { to: "/admin/clubs", label: "社团列表", icon: IconBuilding },
      { to: "/admin/clubs/new", label: "创建社团", icon: IconPlus },
    ],
  },
  {
    label: "活动管理",
    items: [
      { to: "/admin/activities", label: "活动列表", icon: IconCalendar },
      { to: "/admin/activities/new", label: "创建活动", icon: IconSparkle },
      { to: "/admin/approvals", label: "审批中心", icon: IconCheckCircle },
    ],
  },
  {
    label: "个人任务",
    items: [
      { to: "/admin/todos", label: "我的待办", icon: IconCheckCircle },
    ],
  },
  {
    label: "任务管理",
    items: [
      { to: "/admin/club-tasks", label: "社团任务", icon: IconFile },
      { to: "/admin/club-tasks/new", label: "发布任务", icon: IconPlus },
    ],
  },
  {
    label: "财务管理",
    items: [
      { to: "/admin/finance", label: "财务仪表盘", icon: IconDollar },
      { to: "/admin/finance/new", label: "新增流水", icon: IconPlus },
      { to: "/admin/finance/public", label: "财务公开", icon: IconEye },
    ],
  },
];

const breadcrumbMap = {
  "/admin": "控制台",
  "/admin/clubs": "社团列表",
  "/admin/clubs/new": "创建社团",
  "/admin/activities": "活动列表",
  "/admin/activities/new": "创建活动",
  "/admin/approvals": "审批中心",
  "/admin/finance": "财务仪表盘",
  "/admin/finance/new": "新增流水",
  "/admin/finance/public": "财务公开",
  "/admin/todos": "我的待办",
  "/admin/club-tasks": "社团任务",
  "/admin/club-tasks/new": "发布任务",
};

const roleLabels = {
  system_admin: "系统管理员",
  club_admin: "社团管理员",
  tenant_admin: "租户管理员",
  student: "学生",
};

function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("ccms_theme") || "light");
  const [tenantCode, setTenantCodeState] = useState(getTenantCode());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ccms_theme", theme);
  }, [theme]);

  const currentLabel = breadcrumbMap[location.pathname] || location.pathname;

  const tenantHint = useMemo(() => tenantCode || "未设置", [tenantCode]);

  const handleTenantCodeChange = (event) => {
    const value = event.target.value;
    setTenantCodeState(value);
    setTenantCode(value);
  };

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "?";
  const roleLabel = roleLabels[user?.role] || user?.role || "";
  const isDark = theme === "dark";

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <Link to="/admin" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">C</div>
            <span className="sidebar-brand-name">CCMS</span>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="nav-item"
                >
                  <span className="nav-item-icon">
                    <item.icon size={18} />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.username}</div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed((prev) => !prev)}
              title={collapsed ? "展开" : "收起"}
            >
              {collapsed ? <IconArrowRight size={14} /> : <IconArrowLeft size={14} />}
            </button>
            <button
              className="sidebar-logout"
              onClick={logout}
              title="退出登录"
            >
              <IconLogout size={14} />
              <span className={collapsed ? "sidebar-collapsed" : ""} style={{ transition: "opacity 0.15s" }}>
                {collapsed ? "" : "退出登录"}
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className={`main-content${collapsed ? " sidebar-collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-left">
            {currentLabel && (
              <div className="breadcrumb">
                <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>首页</Link>
                <span className="breadcrumb-sep">/</span>
                <Link to="/admin" style={{ color: "inherit", textDecoration: "none" }}>管理后台</Link>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">{currentLabel}</span>
              </div>
            )}
          </div>

          <div className="topbar-right">
            <div className="tenant-input-group">
              <label htmlFor="tenant-code">租户</label>
              <input
                id="tenant-code"
                value={tenantCode}
                onChange={handleTenantCodeChange}
                placeholder="输入编码..."
              />
              {tenantCode ? <span className="tenant-pill">{tenantHint}</span> : null}
            </div>

            <button
              className="theme-toggle"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={isDark ? "切换到浅色模式" : "切换到深色模式"}
            >
              {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
          </div>
        </header>

        <div className="content-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AppLayout;

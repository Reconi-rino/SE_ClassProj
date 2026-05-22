import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "./contexts/AuthContext";
import HomePage from "./pages/Public/HomePage";
import PublicClubDetailPage from "./pages/Public/ClubDetailPage";
import LoginPage from "./components/Auth/LoginPage";
import RegisterPage from "./components/Auth/RegisterPage";
import ResetPasswordPage from "./components/Auth/ResetPasswordPage";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import DashboardPage from "./components/Common/DashboardPage";
import AppLayout from "./components/Layout/AppLayout";
import ClubListPage from "./pages/Clubs/ClubListPage";
import ClubDetailPage from "./pages/Clubs/ClubDetailPage";
import CreateClubPage from "./pages/Clubs/CreateClubPage";
import ClubMembersPage from "./pages/Clubs/ClubMembersPage";
import ActivityListPage from "./pages/Activities/ActivityListPage";
import ActivityDetailPage from "./pages/Activities/ActivityDetailPage";
import ActivityFormPage from "./pages/Activities/ActivityFormPage";
import ApprovalPage from "./pages/Activities/ApprovalPage";
import FinancialDashboardPage from "./pages/Finance/FinancialDashboardPage";
import FinancialFormPage from "./pages/Finance/FinancialFormPage";
import FinancialPublicPage from "./pages/Finance/FinancialPublicPage";
import TodoListPage from "./pages/Todos/TodoListPage";
import ClubTaskListPage from "./pages/ClubTasks/ClubTaskListPage";
import ClubTaskFormPage from "./pages/ClubTasks/ClubTaskFormPage";

function App() {
  const { isAuthenticated, user } = useAuth();
  const needsPasswordReset = Boolean(user?.forcePasswordReset);

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* 公开页面 — 无需登录 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/club/:id" element={<PublicClubDetailPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/admin" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/admin" replace /> : <RegisterPage />} />

          {/* 管理后台 — 需要登录 */}
          <Route
            element={
              <ProtectedRoute>
                {needsPasswordReset ? <Navigate to="/reset-password" replace /> : <AppLayout />}
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/clubs" element={<ClubListPage />} />
            <Route path="/admin/clubs/new" element={<CreateClubPage />} />
            <Route path="/admin/clubs/:id" element={<ClubDetailPage />} />
            <Route path="/admin/clubs/:clubId/members" element={<ClubMembersPage />} />
            <Route path="/admin/activities" element={<ActivityListPage />} />
            <Route path="/admin/activities/new" element={<ActivityFormPage />} />
            <Route path="/admin/activities/:id" element={<ActivityDetailPage />} />
            <Route path="/admin/approvals" element={<ApprovalPage />} />
            <Route path="/admin/finance" element={<FinancialDashboardPage />} />
            <Route path="/admin/finance/new" element={<FinancialFormPage />} />
            <Route path="/admin/finance/public" element={<FinancialPublicPage />} />
            <Route path="/admin/todos" element={<TodoListPage />} />
            <Route path="/admin/club-tasks" element={<ClubTaskListPage />} />
            <Route path="/admin/club-tasks/new" element={<ClubTaskFormPage />} />
            <Route path="/admin/club-tasks/:id/edit" element={<ClubTaskFormPage />} />
          </Route>

          <Route path="/reset-password" element={
            <ProtectedRoute><ResetPasswordPage /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

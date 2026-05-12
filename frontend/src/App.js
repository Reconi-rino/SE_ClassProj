import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "./contexts/AuthContext";
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

function App() {
  const { isAuthenticated, user } = useAuth();
  const needsPasswordReset = Boolean(user?.forcePasswordReset);

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route
            path="/reset-password"
            element={
              <ProtectedRoute>
                <ResetPasswordPage />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                {needsPasswordReset ? <Navigate to="/reset-password" replace /> : <AppLayout />}
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clubs" element={<ClubListPage />} />
            <Route path="/clubs/new" element={<CreateClubPage />} />
            <Route path="/clubs/:id" element={<ClubDetailPage />} />
            <Route path="/clubs/:clubId/members" element={<ClubMembersPage />} />
            <Route path="/activities" element={<ActivityListPage />} />
            <Route path="/activities/new" element={<ActivityFormPage />} />
            <Route path="/activities/:id" element={<ActivityDetailPage />} />
            <Route path="/approvals" element={<ApprovalPage />} />
            <Route path="/finance" element={<FinancialDashboardPage />} />
            <Route path="/finance/new" element={<FinancialFormPage />} />
            <Route path="/finance/public" element={<FinancialPublicPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

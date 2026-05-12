import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import FeedbackMessage from "../Common/FeedbackMessage";
import { getUserFacingError } from "../../utils/errorMessage";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword, user } = useAuth();
  const [form, setForm] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors([]);
    setSubmitting(true);
    try {
      await resetPassword(form);
      navigate("/", { replace: true });
    } catch (e) {
      setError(getUserFacingError(e, "重设密码失败，请稍后重试。"));
      setFieldErrors(Array.isArray(e.details) ? e.details : []);
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user?.role === "system_admin";

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1>重设密码</h1>
        <p>当前账户要求先重设密码后才能继续使用系统</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">新密码</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="至少6位字符"
              minLength={6}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmNewPassword">确认新密码</label>
            <input
              id="confirmNewPassword"
              name="confirmNewPassword"
              type="password"
              value={form.confirmNewPassword}
              onChange={handleChange}
              placeholder="再次输入新密码"
              minLength={6}
              required
            />
          </div>

          {isAdmin ? (
            <p className="hint-text">管理员密码要求：包含大写字母、小写字母和特殊符号。</p>
          ) : null}

          <button type="submit" className="btn-lg" disabled={submitting}>
            {submitting ? "提交中..." : "提交重设"}
          </button>
        </form>

        <FeedbackMessage message={error} />

        {fieldErrors.length > 0 ? (
          <FeedbackMessage
            message={Array.from(new Set(fieldErrors.map((item) => item.msg))).join("；")}
            type="warning"
          />
        ) : null}
      </div>
    </div>
  );
}

export default ResetPasswordPage;

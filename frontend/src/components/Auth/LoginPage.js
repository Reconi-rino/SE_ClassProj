import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import FeedbackMessage from "../Common/FeedbackMessage";
import { getUserFacingError } from "../../utils/errorMessage";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      navigate("/", { replace: true });
    } catch (e) {
      setError(getUserFacingError(e, "登录失败，请稍后重试。"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1>登录</h1>
        <p>欢迎回到校园社团管理系统</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="请输入邮箱"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="请输入密码"
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="btn-lg" disabled={submitting}>
            {submitting ? "登录中..." : "登录"}
          </button>
        </form>

        <FeedbackMessage message={error} />

        <p>
          还没有账号？<Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;

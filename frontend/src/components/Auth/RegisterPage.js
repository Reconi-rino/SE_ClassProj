import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import FeedbackMessage from "../Common/FeedbackMessage";
import { getUserFacingError } from "../../utils/errorMessage";
import { fetchPublicTenants } from "../../services/tenantApi";

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    student_id: "",
    tenant_id: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetchPublicTenants()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTenants(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load public tenants", err);
      });
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (e) {
      setError(getUserFacingError(e, "注册失败，请检查输入后重试。"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1>注册</h1>
        <p>创建校园社团管理系统账户</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="3-50个字符"
              minLength={3}
              required
            />
          </div>

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
              placeholder="至少6位字符"
              minLength={6}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="student_id">学号（必填，11位数字）</label>
            <input
              id="student_id"
              name="student_id"
              type="text"
              value={form.student_id}
              onChange={handleChange}
              pattern="\d{11}"
              minLength={11}
              maxLength={11}
              placeholder="11位数字学号"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tenant_id">所属学校/租户</label>
            <select id="tenant_id" name="tenant_id" value={form.tenant_id} onChange={handleChange}>
              <option value="">-- 请选择 --</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-lg" disabled={submitting}>
            {submitting ? "注册中..." : "注册"}
          </button>
        </form>

        <FeedbackMessage message={error} />

        <p>
          已有账号？<Link to="/login">立即登录</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;

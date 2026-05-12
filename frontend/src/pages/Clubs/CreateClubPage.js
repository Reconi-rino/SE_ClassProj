import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createClub } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import { getUserFacingError } from "../../utils/errorMessage";

function CreateClubPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", description: "", status: "active" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const result = await createClub({ token, tenantCode: getTenantCode(), payload: form });
      navigate(`/clubs/${result?.data?.id || ""}`);
    } catch (er) {
      setError(getUserFacingError(er, "创建社团失败，请检查输入后重试。"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>创建社团</h2>
        <Link to="/clubs" className="btn btn-sm btn-outline">返回列表</Link>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header"><h3 className="card-title">社团信息</h3></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label-required">社团名称</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="输入社团名称" required />
          </div>
          <div className="form-group">
            <label htmlFor="description">简介</label>
            <textarea id="description" name="description" value={form.description} onChange={handleChange} rows="4" placeholder="描述社团的宗旨与活动方向（选填）" />
          </div>
          <div className="form-group">
            <label htmlFor="status">状态</label>
            <select id="status" name="status" value={form.status} onChange={handleChange}>
              <option value="active">活跃</option>
              <option value="inactive">停用</option>
            </select>
          </div>
          <button type="submit" disabled={submitting}>{submitting ? "创建中..." : "创建社团"}</button>
        </form>
        <FeedbackMessage message={error} />
      </div>
    </div>
  );
}

export default CreateClubPage;

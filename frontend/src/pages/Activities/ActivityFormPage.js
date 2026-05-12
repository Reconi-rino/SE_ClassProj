import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createActivity } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import { getUserFacingError } from "../../utils/errorMessage";

function ActivityFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", club_id: "", location: "", start_time: "", end_time: "", status: "draft" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const result = await createActivity({ token, tenantCode: getTenantCode(), payload: { ...form, club_id: Number(form.club_id) } });
      navigate(`/activities/${result?.data?.id || ""}`);
    } catch (er) {
      setError(getUserFacingError(er, "创建活动失败，请检查输入后重试。"));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>创建活动</h2>
        <Link to="/activities" className="btn btn-sm btn-outline">返回列表</Link>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <div className="card-header"><h3 className="card-title">活动信息</h3></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title" className="form-label-required">活动标题</label>
            <input id="title" name="title" value={form.title} onChange={handleChange} placeholder="输入活动标题" required />
          </div>
          <div className="form-group">
            <label htmlFor="description">活动描述</label>
            <textarea id="description" name="description" value={form.description} onChange={handleChange} rows="4" placeholder="描述活动内容与目的（选填）" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label htmlFor="club_id" className="form-label-required">所属社团 ID</label>
              <input id="club_id" name="club_id" type="number" value={form.club_id} onChange={handleChange} placeholder="输入社团ID" required />
            </div>
            <div className="form-group">
              <label htmlFor="location">活动地点</label>
              <input id="location" name="location" value={form.location} onChange={handleChange} placeholder="活动地点（选填）" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label htmlFor="start_time">开始时间</label>
              <input id="start_time" name="start_time" type="datetime-local" value={form.start_time} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="end_time">结束时间</label>
              <input id="end_time" name="end_time" type="datetime-local" value={form.end_time} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="status">初始状态</label>
            <select id="status" name="status" value={form.status} onChange={handleChange}>
              <option value="draft">草稿</option>
              <option value="pending_approval">直接提交审批</option>
            </select>
          </div>
          <button type="submit" disabled={submitting}>{submitting ? "创建中..." : "创建活动"}</button>
        </form>
        <FeedbackMessage message={error} />
      </div>
    </div>
  );
}

export default ActivityFormPage;

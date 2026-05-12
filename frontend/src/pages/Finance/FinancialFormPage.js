import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createFinancialRecord } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import { getUserFacingError } from "../../utils/errorMessage";

function FinancialFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ club_id: "", type: "expense", category: "", amount: "", description: "", transaction_date: "" });
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
      await createFinancialRecord({ token, tenantCode: getTenantCode(), payload: { ...form, club_id: Number(form.club_id), amount: Number(form.amount) } });
      navigate("/finance");
    } catch (er) {
      setError(getUserFacingError(er, "新增财务流水失败"));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>新增财务流水</h2>
        <Link to="/finance" className="btn btn-sm btn-outline">返回仪表盘</Link>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header"><h3 className="card-title">流水信息</h3></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="club_id" className="form-label-required">社团 ID</label>
            <input id="club_id" name="club_id" type="number" value={form.club_id} onChange={handleChange} placeholder="输入社团ID" required />
          </div>
          <div className="form-group">
            <label htmlFor="type">类型</label>
            <select id="type" name="type" value={form.type} onChange={handleChange}>
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="category" className="form-label-required">分类</label>
            <input id="category" name="category" value={form.category} onChange={handleChange} placeholder="如：活动经费、赞助、设备采购" required />
          </div>
          <div className="form-group">
            <label htmlFor="amount" className="form-label-required">金额</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={handleChange} placeholder="0.00" required />
          </div>
          <div className="form-group">
            <label htmlFor="description">说明</label>
            <textarea id="description" name="description" value={form.description} onChange={handleChange} rows="3" placeholder="流水说明（选填）" />
          </div>
          <div className="form-group">
            <label htmlFor="transaction_date" className="form-label-required">交易日期</label>
            <input id="transaction_date" name="transaction_date" type="date" value={form.transaction_date} onChange={handleChange} required />
          </div>
          <button type="submit" disabled={submitting}>{submitting ? "提交中..." : "提交流水"}</button>
        </form>
        <FeedbackMessage message={error} />
      </div>
    </div>
  );
}

export default FinancialFormPage;

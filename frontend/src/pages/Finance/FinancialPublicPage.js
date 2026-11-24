import { useState } from "react";
import { Link } from "react-router-dom";
import { getFinancialPublicRecords } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconEye } from "../../components/Common/Icons";
import { useAuth } from "../../contexts/AuthContext";

export default function FinancialPublicPage() {
  const { token } = useAuth();
  const [month, setMonth] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const [year, monthNumber] = month.split("-");
      const result = await getFinancialPublicRecords({
        token, tenantCode: getTenantCode(), year, month: Number(monthNumber),
      });
      setReport(result.data);
    } catch (failure) {
      setError(getUserFacingError(failure, "加载财务公开数据失败"));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>财务公开</h2>
          <p className="page-header-sub">查询校内月度收支和结余</p>
        </div>
        <Link to="/admin/finance" className="btn btn-sm btn-outline"><IconEye size={14} /> 返回仪表盘</Link>
      </div>

      <form className="filter-toolbar" onSubmit={load}>
        <label htmlFor="public-finance-month">查询月份</label>
        <input id="public-finance-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ maxWidth: 200 }} required disabled={loading} />
        <button type="submit" disabled={!month || loading}>查询</button>
      </form>

      <FeedbackMessage message={error} />
      {loading ? <LoadingState message="正在加载财务公开数据..." /> : report ? (
        <div className="table-wrap">
          <table className="table">
            <caption>{report.year} 年 {report.month} 月收支汇总</caption>
            <thead><tr><th>项目</th><th>金额（元）</th><th>流水笔数</th></tr></thead>
            <tbody>
              <tr><th scope="row">收入</th><td>{report.summary.income.toFixed(2)}</td><td>{report.summary.income_count}</td></tr>
              <tr><th scope="row">支出</th><td>{report.summary.expense.toFixed(2)}</td><td>{report.summary.expense_count}</td></tr>
              <tr><th scope="row">结余</th><td>{report.summary.net.toFixed(2)}</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      ) : !error && <p className="card">选择月份后查询收支汇总。</p>}
    </div>
  );
}

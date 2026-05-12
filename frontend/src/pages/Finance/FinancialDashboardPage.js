import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getFinancialReports, listFinancialRecords } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconDollar, IconPlus, IconEye } from "../../components/Common/Icons";

function FinancialDashboardPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [report, setReport] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const tenantCode = getTenantCode();
      const [recordsResult, reportResult] = await Promise.all([
        listFinancialRecords({ token, tenantCode }),
        getFinancialReports({ token, tenantCode, year }),
      ]);
      setRecords(Array.isArray(recordsResult?.data) ? recordsResult.data : []);
      setReport(reportResult?.data || null);
    } catch (e) {
      setError(getUserFacingError(e, "加载财务数据失败"));
      setRecords([]); setReport(null);
    } finally { setLoading(false); }
  }, [token, year]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    if (report) return { income: report.total_income || 0, expense: report.total_expense || 0 };
    return records.reduce((acc, item) => {
      const amount = Number(item.amount || 0);
      if (item.type === "income") acc.income += amount;
      else if (item.type === "expense") acc.expense += amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [records, report]);

  const balance = summary.income - summary.expense;
  const monthlyRows = Array.isArray(report?.monthly_breakdown) ? report.monthly_breakdown : [];

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>财务仪表盘</h2>
          <p className="page-header-sub">收支总览与月度统计</p>
        </div>
        <div className="actions-row">
          <Link to="/finance/new" className="btn btn-sm"><IconPlus size={14} /> 新增流水</Link>
          <Link to="/finance/public" className="btn btn-sm btn-outline"><IconEye size={14} /> 公开页</Link>
        </div>
      </div>

      <div className="filter-toolbar">
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="年份" style={{ maxWidth: 140 }} />
        <button type="button" onClick={load}>更新报表</button>
        <span className="hint">年份：{year}</span>
      </div>

      <FeedbackMessage message={error} />

      {loading ? (
        <LoadingState message="正在加载财务数据..." />
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon green"><IconDollar size={22} /></div>
              <div className="stat-card-body">
                <div className="stat-card-label">总收入</div>
                <div className="stat-card-value" style={{ color: "var(--green-600)" }}>{summary.income.toLocaleString()}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: "var(--red-50)", color: "var(--red-600)" }}><IconDollar size={22} /></div>
              <div className="stat-card-body">
                <div className="stat-card-label">总支出</div>
                <div className="stat-card-value" style={{ color: "var(--red-600)" }}>{summary.expense.toLocaleString()}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon brand"><IconDollar size={22} /></div>
              <div className="stat-card-body">
                <div className="stat-card-label">结余</div>
                <div className="stat-card-value" style={{ color: balance >= 0 ? "var(--green-600)" : "var(--red-600)" }}>{balance.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">月度报表</h3></div>
            {monthlyRows.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>月份</th><th>收入</th><th>支出</th><th>结余</th></tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((item, idx) => {
                      const mb = (item.income || 0) - (item.expense || 0);
                      return (
                        <tr key={idx}>
                          <td className="cell-strong">{item.month}</td>
                          <td className="cell-mono" style={{ color: "var(--green-600)" }}>{item.income.toLocaleString()}</td>
                          <td className="cell-mono" style={{ color: "var(--red-600)" }}>{item.expense.toLocaleString()}</td>
                          <td className="cell-mono cell-strong" style={{ color: mb >= 0 ? "var(--green-600)" : "var(--red-600)" }}>{mb.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>暂无月度报表数据</p></div>}
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">原始流水记录</h3></div>
            {records.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>ID</th><th>社团</th><th>类型</th><th>分类</th><th>金额</th><th>日期</th></tr>
                  </thead>
                  <tbody>
                    {records.map((item) => (
                      <tr key={item.id}>
                        <td className="cell-mono">{item.id}</td>
                        <td className="cell-mono">{item.club_id}</td>
                        <td>
                          <span className={`badge ${item.type === "income" ? "badge-green" : "badge-red"}`}>
                            <span className="badge-dot" />
                            {item.type === "income" ? "收入" : "支出"}
                          </span>
                        </td>
                        <td>{item.category || "-"}</td>
                        <td className="cell-mono cell-strong" style={{ color: item.type === "income" ? "var(--green-600)" : "var(--red-600)" }}>{Number(item.amount).toLocaleString()}</td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{item.transaction_date || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>暂无流水记录</p></div>}
          </div>
        </>
      )}
    </div>
  );
}

export default FinancialDashboardPage;

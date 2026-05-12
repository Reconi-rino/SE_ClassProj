import { useState } from "react";
import { Link } from "react-router-dom";
import { getFinancialPublicRecords } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconEye } from "../../components/Common/Icons";

function FinancialPublicPage() {
  const [month, setMonth] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await getFinancialPublicRecords({ tenantCode: getTenantCode(), month });
      setRecords(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载财务公开数据失败"));
      setRecords([]);
    } finally { setLoading(false); }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>财务公开</h2>
          <p className="page-header-sub">面向全体的公开财务数据查询</p>
        </div>
        <Link to="/finance" className="btn btn-sm btn-outline"><IconEye size={14} /> 返回仪表盘</Link>
      </div>

      <div className="filter-toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }} />
        <button type="button" onClick={load}>查询</button>
      </div>

      <FeedbackMessage message={error} />

      {loading ? (
        <LoadingState message="正在加载财务公开数据..." />
      ) : records.length === 0 ? (
        <div className="card"><div className="empty-state"><h3>暂无公开记录</h3><p>选择月份后点击「查询」，即可查看该月的公开财务记录。</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>社团</th><th>类型</th><th>分类</th><th>金额</th><th>日期</th><th>说明</th></tr>
            </thead>
            <tbody>
              {records.map((item, idx) => (
                <tr key={`${item.id}-${idx}`}>
                  <td className="cell-strong">{item.club_name || item.club_id || "-"}</td>
                  <td>
                    <span className={`badge ${item.type === "income" ? "badge-green" : "badge-red"}`}>
                      <span className="badge-dot" />
                      {item.type === "income" ? "收入" : "支出"}
                    </span>
                  </td>
                  <td>{item.category || "-"}</td>
                  <td className="cell-mono cell-strong" style={{ color: item.type === "income" ? "var(--green-600)" : "var(--red-600)" }}>{Number(item.amount).toLocaleString()}</td>
                  <td style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{item.transaction_date || "-"}</td>
                  <td style={{ color: "var(--color-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FinancialPublicPage;

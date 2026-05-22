import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { listClubTasks, deleteClubTask } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";

const PRIORITY_COLORS = { low: "badge-gray", medium: "badge", high: "badge-red" };
const PRIORITY_LABELS = { low: "低", medium: "中", high: "高" };
const STATUS_LABELS = { pending: "待处理", in_progress: "进行中", completed: "已完成" };
const STATUS_COLORS = { pending: "badge-gray", in_progress: "badge", completed: "badge-green" };

function ClubTaskListPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clubId, setClubId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const tenantCode = getTenantCode();

  const load = useCallback(async () => {
    if (!clubId) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await listClubTasks({
        token, tenantCode,
        clubId: Number(clubId),
        status: statusFilter || undefined,
      });
      setTasks(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载社团任务失败。"));
    } finally {
      setLoading(false);
    }
  }, [token, tenantCode, clubId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (task) => {
    if (!window.confirm("确定删除该任务？")) return;
    try {
      await deleteClubTask({ token, tenantCode, id: task.id, clubId: task.club_id });
      await load();
    } catch (e) {
      setError(getUserFacingError(e, "删除失败。"));
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>社团任务</h2>
          <p className="page-header-sub">管理和分配社团任务</p>
        </div>
        <Link to="/admin/club-tasks/new" className="btn">+ 发布任务</Link>
      </div>

      <div className="filter-toolbar">
        <input
          type="number" placeholder="社团 ID" value={clubId}
          onChange={(e) => setClubId(e.target.value)} min="1"
          style={{ width: 120 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
        </select>
        <button type="button" onClick={load}>查询</button>
      </div>

      <FeedbackMessage message={error} />

      {!clubId ? (
        <div className="card"><div className="empty-state"><h3>请输入社团 ID</h3><p>输入社团 ID 并点击查询按钮查看该社团的任务列表。</p></div></div>
      ) : loading ? (
        <LoadingState message="正在加载社团任务..." />
      ) : tasks.length === 0 ? (
        <div className="card"><div className="empty-state"><h3>暂无社团任务</h3><p>点击「发布任务」来创建第一个任务。</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>ID</th>
                <th>标题</th>
                <th style={{ width: 100 }}>负责人</th>
                <th style={{ width: 70 }}>优先级</th>
                <th style={{ width: 80 }}>状态</th>
                <th style={{ width: 110 }}>截止日期</th>
                <th style={{ width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="cell-mono">{task.id}</td>
                  <td className="cell-strong">{task.title}</td>
                  <td>{task.assignee?.username || "-"}</td>
                  <td><span className={`badge ${PRIORITY_COLORS[task.priority] || "badge-gray"}`}>{PRIORITY_LABELS[task.priority]}</span></td>
                  <td><span className={`badge ${STATUS_COLORS[task.status] || "badge-gray"}`}>{STATUS_LABELS[task.status]}</span></td>
                  <td>{task.due_date ? task.due_date.slice(0, 10) : "-"}</td>
                  <td>
                    <div className="actions-row">
                      <Link to={`/admin/club-tasks/${task.id}/edit`} className="btn btn-sm btn-outline">编辑</Link>
                      <button className="btn btn-sm btn-outline" onClick={() => handleDelete(task)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ClubTaskListPage;

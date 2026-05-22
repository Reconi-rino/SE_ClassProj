import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { listPersonalTasks, createPersonalTask, updatePersonalTask, deletePersonalTask, listMyClubTasks, updateClubTask } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";

const PRIORITY_COLORS = { low: "badge-gray", medium: "badge", high: "badge-red" };
const PRIORITY_LABELS = { low: "低", medium: "中", high: "高" };
const STATUS_LABELS = { pending: "待处理", in_progress: "进行中", completed: "已完成" };
const STATUS_COLORS = { pending: "badge-gray", in_progress: "badge", completed: "badge-green" };

function TodoListPage() {
  const { token } = useAuth();
  const [personalTasks, setPersonalTasks] = useState([]);
  const [clubTasks, setClubTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState("personal");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", priority: "medium" });

  const tenantCode = getTenantCode();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [personalR, clubR] = await Promise.all([
        listPersonalTasks({ token, tenantCode, status: statusFilter || undefined }),
        listMyClubTasks({ token, tenantCode }),
      ]);
      setPersonalTasks(Array.isArray(personalR?.data) ? personalR.data : []);
      setClubTasks(Array.isArray(clubR?.data) ? clubR.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载任务失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, [token, tenantCode, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ title: "", description: "", due_date: "", priority: "medium" });
    setEditTask(null);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createPersonalTask({ token, tenantCode, payload: form });
      resetForm();
      await load();
    } catch (err) {
      setError(getUserFacingError(err, "创建任务失败。"));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await updatePersonalTask({ token, tenantCode, id: editTask.id, payload: form });
      resetForm();
      await load();
    } catch (err) {
      setError(getUserFacingError(err, "更新任务失败。"));
    }
  };

  const handleToggleStatus = async (task) => {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    try {
      await updatePersonalTask({ token, tenantCode, id: task.id, payload: { status: next } });
      await load();
    } catch (err) {
      setError(getUserFacingError(err, "更新状态失败。"));
    }
  };

  const handleToggleClubTaskStatus = async (task) => {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    try {
      await updateClubTask({ token, tenantCode, id: task.id, payload: { club_id: task.club_id, status: next } });
      await load();
    } catch (err) {
      setError(getUserFacingError(err, "更新状态失败。"));
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm("确定要删除该任务吗？")) return;
    try {
      await deletePersonalTask({ token, tenantCode, id: task.id });
      await load();
    } catch (err) {
      setError(getUserFacingError(err, "删除任务失败。"));
    }
  };

  const startEdit = (task) => {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      priority: task.priority,
    });
    setShowForm(true);
  };

  const filteredPersonalTasks = statusFilter
    ? personalTasks.filter((t) => t.status === statusFilter)
    : personalTasks;

  const filteredClubTasks = statusFilter
    ? clubTasks.filter((t) => t.status === statusFilter)
    : clubTasks;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>我的待办</h2>
          <p className="page-header-sub">管理你的个人任务和被分配的社团任务</p>
        </div>
        <button className="btn" onClick={() => { resetForm(); setShowForm(true); }}>
          + 新增个人任务
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${tab === "personal" ? "" : "btn-outline"}`}
          onClick={() => setTab("personal")}>
          个人任务 ({filteredPersonalTasks.length})
        </button>
        <button className={`btn btn-sm ${tab === "club" ? "" : "btn-outline"}`}
          onClick={() => setTab("club")}>
          社团任务 ({filteredClubTasks.length})
        </button>
      </div>

      <div className="filter-toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
        </select>
        <button type="button" onClick={load}>刷新</button>
      </div>

      <FeedbackMessage message={error} />

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{editTask ? "编辑任务" : "新建任务"}</h3>
          <form onSubmit={editTask ? handleUpdate : handleCreate}>
            <div style={{ marginBottom: 12 }}>
              <label>标题 *</label>
              <input type="text" value={form.title} required maxLength={200}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={{ width: "100%", padding: "8px 12px" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>描述</label>
              <textarea value={form.description} rows={3}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ width: "100%", padding: "8px 12px" }} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label>截止日期</label>
                <input type="date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label>优先级</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px" }}>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-sm">{editTask ? "保存" : "创建"}</button>
              <button type="button" className="btn btn-sm btn-outline" onClick={resetForm}>取消</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <LoadingState message="正在加载待办列表..." />
      ) : tab === "personal" ? (
        filteredPersonalTasks.length === 0 ? (
          <div className="card"><div className="empty-state"><h3>暂无个人任务</h3><p>点击「新增个人任务」来创建第一个任务。</p></div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>ID</th>
                  <th>标题</th>
                  <th style={{ width: 70 }}>优先级</th>
                  <th style={{ width: 80 }}>状态</th>
                  <th style={{ width: 110 }}>截止日期</th>
                  <th style={{ width: 180 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonalTasks.map((task) => (
                  <tr key={`p-${task.id}`}>
                    <td className="cell-mono">{task.id}</td>
                    <td className="cell-strong">{task.title}</td>
                    <td><span className={`badge ${PRIORITY_COLORS[task.priority] || "badge-gray"}`}>{PRIORITY_LABELS[task.priority]}</span></td>
                    <td><span className={`badge ${STATUS_COLORS[task.status] || "badge-gray"}`}>{STATUS_LABELS[task.status]}</span></td>
                    <td>{task.due_date ? task.due_date.slice(0, 10) : "-"}</td>
                    <td>
                      <div className="actions-row">
                        <button className="btn btn-sm btn-outline" onClick={() => handleToggleStatus(task)}>
                          {task.status === "pending" ? "开始" : task.status === "in_progress" ? "完成" : "还原"}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => startEdit(task)}>编辑</button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleDelete(task)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        filteredClubTasks.length === 0 ? (
          <div className="card"><div className="empty-state"><h3>暂无被分配的社团任务</h3><p>当社团管理员向你分配任务后，会出现在这里。</p></div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>ID</th>
                  <th>标题</th>
                  <th style={{ width: 80 }}>来源社团</th>
                  <th style={{ width: 70 }}>优先级</th>
                  <th style={{ width: 80 }}>状态</th>
                  <th style={{ width: 110 }}>截止日期</th>
                  <th style={{ width: 100 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredClubTasks.map((task) => (
                  <tr key={`c-${task.id}`}>
                    <td className="cell-mono">{task.id}</td>
                    <td className="cell-strong">{task.title}</td>
                    <td>{task.club?.name || "-"}</td>
                    <td><span className={`badge ${PRIORITY_COLORS[task.priority] || "badge-gray"}`}>{PRIORITY_LABELS[task.priority]}</span></td>
                    <td><span className={`badge ${STATUS_COLORS[task.status] || "badge-gray"}`}>{STATUS_LABELS[task.status]}</span></td>
                    <td>{task.due_date ? task.due_date.slice(0, 10) : "-"}</td>
                    <td>
                      <div className="actions-row">
                        <button className="btn btn-sm btn-outline" onClick={() => handleToggleClubTaskStatus(task)}>
                          {task.status === "pending" ? "开始" : task.status === "in_progress" ? "完成" : "还原"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

export default TodoListPage;

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getClubTask, createClubTask, updateClubTask, listClubMembers, listClubs } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";

function ClubTaskFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { token } = useAuth();
  const navigate = useNavigate();
  const tenantCode = getTenantCode();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [clubs, setClubs] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);

  const [form, setForm] = useState({
    club_id: "", title: "", description: "",
    activity_id: "", due_date: "", priority: "medium",
  });

  useEffect(() => {
    listClubs({ token, tenantCode }).then((r) => {
      setClubs(Array.isArray(r?.data) ? r.data : []);
    }).catch(() => {});
  }, [token, tenantCode]);

  const loadMembers = useCallback(async (clubId) => {
    if (!clubId) { setMembers([]); return; }
    try {
      const r = await listClubMembers({ token, tenantCode, clubId });
      setMembers(Array.isArray(r?.data?.members) ? r.data.members : []);
    } catch { setMembers([]); }
  }, [token, tenantCode]);

  useEffect(() => {
    if (form.club_id) loadMembers(Number(form.club_id));
  }, [form.club_id, loadMembers]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const r = await getClubTask({ token, tenantCode, id });
        const t = r.data;
        setForm({
          club_id: String(t.club_id || ""),
          title: t.title || "",
          description: t.description || "",
          activity_id: t.activity_id ? String(t.activity_id) : "",
          due_date: t.due_date ? t.due_date.slice(0, 10) : "",
          priority: t.priority || "medium",
        });
        const ids = (t.assignee_ids || String(t.assignee_id || ""))
          .split(",").map((s) => s.trim()).filter(Boolean).map(Number);
        setSelectedAssigneeIds(ids);
      } catch (e) {
        setError(getUserFacingError(e, "加载任务失败。"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, token, tenantCode]);

  const toggleAssignee = (uid) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        club_id: Number(form.club_id),
        assignee_id: selectedAssigneeIds[0] || undefined,
        assignee_ids: selectedAssigneeIds.join(","),
        activity_id: form.activity_id ? Number(form.activity_id) : undefined,
      };
      if (isEdit) {
        await updateClubTask({ token, tenantCode, id, payload });
      } else {
        await createClubTask({ token, tenantCode, payload });
      }
      setSuccess(isEdit ? "任务已更新。" : "任务已创建。");
      setTimeout(() => navigate("/admin/club-tasks"), 1000);
    } catch (e) {
      setError(getUserFacingError(e, "提交失败。"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="正在加载..." />;

  return (
    <div className="container" style={{ maxWidth: 700 }}>
      <h2>{isEdit ? "编辑任务" : "发布任务"}</h2>
      <FeedbackMessage message={error} />
      <FeedbackMessage message={success} type="success" />

      <form onSubmit={handleSubmit} className="card">
        <div style={{ marginBottom: 12 }}>
          <label>社团 *</label>
          <select value={form.club_id} onChange={(e) => setForm({ ...form, club_id: e.target.value })} required
            style={{ width: "100%", padding: "8px 12px" }}>
            <option value="">请选择社团</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>)}
          </select>
        </div>

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

        <div style={{ marginBottom: 12 }}>
          <label>负责人（可多选）*</label>
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8, maxHeight: 150, overflowY: "auto" }}>
            {members.length === 0 ? (
              <p style={{ color: "#999", margin: 0 }}>请先选择社团</p>
            ) : (
              members.map((m) => {
                const uid = m.user_id || m.id;
                return (
                  <label key={uid} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", cursor: "pointer" }}>
                    <input
                      type="checkbox" checked={selectedAssigneeIds.includes(uid)}
                      onChange={() => toggleAssignee(uid)}
                    />
                    {m.user?.username || m.username || `ID: ${uid}`}
                  </label>
                );
              })
            )}
          </div>
          {selectedAssigneeIds.length > 0 && (
            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              已选 {selectedAssigneeIds.length} 人
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label>关联活动 ID</label>
            <input type="number" value={form.activity_id} placeholder="可选，留空则不关联"
              onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
              style={{ width: "100%", padding: "8px 12px" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label>截止日期</label>
            <input type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              style={{ width: "100%", padding: "8px 12px" }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>优先级</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
            style={{ width: "100%", padding: "8px 12px" }}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "提交中..." : isEdit ? "保存修改" : "发布任务"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/club-tasks")}>取消</button>
        </div>
      </form>
    </div>
  );
}

export default ClubTaskFormPage;

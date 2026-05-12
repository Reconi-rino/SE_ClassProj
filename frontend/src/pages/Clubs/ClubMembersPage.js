import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { addClubMember, listClubMembers, removeClubMember, updateClubMemberRole } from "../../services/businessApi";
import { getTenantCode } from "../../services/tenantStore";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { getUserFacingError } from "../../utils/errorMessage";
import { IconUsers, IconTrash } from "../../components/Common/Icons";

const ROLE_OPTS = [
  { value: "member", label: "普通成员" },
  { value: "officer", label: "干事" },
  { value: "club_admin", label: "社团管理员" },
];

function ClubMembersPage() {
  const { clubId } = useParams();
  const { token } = useAuth();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ user_id: "", role: "member" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listClubMembers({ token, tenantCode: getTenantCode(), clubId });
      setMembers(Array.isArray(result?.data) ? result.data : []);
    } catch (e) {
      setError(getUserFacingError(e, "加载社团成员失败"));
    } finally { setLoading(false); }
  }, [token, clubId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      await addClubMember({ token, tenantCode: getTenantCode(), clubId, payload: { user_id: Number(form.user_id), role: form.role } });
      setForm({ user_id: "", role: "member" });
      setSuccess("成员添加成功");
      await load();
    } catch (er) { setError(getUserFacingError(er, "添加成员失败")); }
  };

  const handleRole = async (memberId, role) => {
    setError(""); setSuccess("");
    try {
      await updateClubMemberRole({ token, tenantCode: getTenantCode(), clubId, memberId, payload: { role } });
      setSuccess("角色更新成功");
      await load();
    } catch (er) { setError(getUserFacingError(er, "更新角色失败")); }
  };

  const handleRemove = async (memberId) => {
    setError(""); setSuccess("");
    try {
      await removeClubMember({ token, tenantCode: getTenantCode(), clubId, memberId });
      setSuccess("成员已移除");
      await load();
    } catch (er) { setError(getUserFacingError(er, "移除成员失败")); }
  };

  const roleLabel = (r) => (ROLE_OPTS.find((o) => o.value === r) || {}).label || r;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>社团成员管理</h2>
          <p className="page-header-sub">社团 ID：{clubId}</p>
        </div>
        <div className="actions-row">
          <Link to={`/clubs/${clubId}`} className="btn btn-sm"><IconUsers size={14} /> 社团详情</Link>
          <Link to="/clubs" className="btn btn-sm btn-outline">社团列表</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3 className="card-title">添加成员</h3></div>
        <form className="inline-form wrap" onSubmit={handleAdd}>
          <div className="form-group">
            <label htmlFor="muid">用户 ID</label>
            <input id="muid" placeholder="输入用户ID" value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label htmlFor="mrole">角色</label>
            <select id="mrole" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              {ROLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" style={{ alignSelf: "flex-end" }}>添加成员</button>
        </form>
      </div>

      <FeedbackMessage message={error} />
      <FeedbackMessage message={success} type="success" duration={3000} />

      {loading ? (
        <LoadingState message="正在加载成员信息..." />
      ) : members.length === 0 ? (
        <div className="card"><div className="empty-state"><h3>暂无成员</h3><p>使用上方表单添加第一个社团成员。</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>成员 ID</th><th>用户 ID</th><th>角色</th><th style={{ width: 260 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="cell-mono">{m.id}</td>
                  <td className="cell-mono">{m.user_id}</td>
                  <td><span className="tag">{roleLabel(m.role)}</span></td>
                  <td>
                    <div className="actions-row">
                      <button className="btn-sm" onClick={() => handleRole(m.id, "member")}>设为成员</button>
                      <button className="btn-sm" onClick={() => handleRole(m.id, "officer")}>设为干事</button>
                      <button className="btn-sm btn-danger" onClick={() => handleRemove(m.id)}><IconTrash size={12} /> 移除</button>
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

export default ClubMembersPage;

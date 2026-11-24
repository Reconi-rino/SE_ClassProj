import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import FeedbackMessage from "../../components/Common/FeedbackMessage";
import LoadingState from "../../components/Common/LoadingState";
import { listReimbursements, saveReimbursement } from "../../services/reimbursementApi";
import { getTenantCode } from "../../services/tenantStore";
import { getUserFacingError } from "../../utils/errorMessage";
import ReimbursementForm from "./ReimbursementForm";
import ReimbursementActions from "./ReimbursementActions";

const statusLabels = {
  pending: ["待审核", "orange"],
  returned: ["退回补充", "red"],
  approved: ["待付款", "blue"],
  booked: ["已入账", "green"],
  withdrawn: ["已撤回", "gray"],
};
const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });

function ReimbursementCard({ request, scope, userId, busy, onEdit, onAction }) {
  const [label, color] = statusLabels[request.status];
  return (
    <article className="card reimbursement-card">
      <div className="card-header reimbursement-card-heading">
        <div>
          <h3 className="card-title">{request.club.name} · {request.category}</h3>
          <p className="hint">#{request.id} · {request.applicant.username} · 支出日期 {request.expense_date}</p>
        </div>
        <div className="actions-row"><strong>{money.format(request.amount)}</strong><span className={`badge badge-${color}`}>{label}</span></div>
      </div>
      <dl className="reimbursement-details">
        <div><dt>报销用途</dt><dd>{request.purpose}</dd></div>
        <div><dt>发票号或收据编号</dt><dd>{request.receipt_reference}</dd></div>
        {request.review_note && <div><dt>{request.status === "returned" ? "退回原因" : "审核意见"}</dt><dd>{request.review_note}</dd></div>}
        {request.reviewed_at && <div><dt>审核记录</dt><dd>{request.reviewer?.username} · {new Date(request.reviewed_at).toLocaleString("zh-CN")}</dd></div>}
        {request.payment_reference && <div><dt>付款凭证编号</dt><dd>{request.payment_reference}</dd></div>}
        {request.booked_at && <div><dt>入账记录</dt><dd>{request.bookkeeper?.username} · {new Date(request.booked_at).toLocaleString("zh-CN")}</dd></div>}
        {request.financial_record && <div><dt>财务流水</dt><dd><Link to="/admin/finance">支出流水 #{request.financial_record.id}</Link></dd></div>}
      </dl>
      <ReimbursementActions request={request} scope={scope} applicant={userId === request.applicant_id}
        busy={busy} onEdit={onEdit} onAction={onAction} />
    </article>
  );
}

function ReimbursementWorkspace({ tenantCode }) {
  const { token, user } = useAuth();
  const [scope, setScope] = useState("mine");
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    listReimbursements({ token, tenantCode, scope, status, signal })
      .then((response) => { if (!signal.aborted) setData(response.data); })
      .catch((failure) => {
        if (!signal.aborted) {
          setError(getUserFacingError(failure, "读取报销单失败。"));
          setData(null);
        }
      })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, tenantCode, scope, status, refresh]);

  function changeScope(nextScope) {
    if (scope === nextScope) return;
    setScope(nextScope);
    setStatus(nextScope === "review" ? "pending" : "");
    setEditor(null);
    setError("");
    setSuccess("");
    setLoading(true);
  }

  async function submit({ request, action, values, message }) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await saveReimbursement({
        token, tenantCode, id: request?.id, action,
        body: { ...values, ...(request ? { revision: request.revision } : {}) },
      });
      setEditor(null);
      setSuccess(message);
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(getUserFacingError(failure, "操作失败，请重试。"));
      if (failure.status === 409) {
        setEditor(null);
        setRefresh((value) => value + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAction(request, action, values) {
    const message = {
      review: values?.decision === "approve" ? "审核已通过，等待登记付款。" : "已退回，申请人可以修改后重新提交。",
      withdraw: "已撤回报销申请。",
      book: "付款已登记，支出流水已生成。",
    }[action];
    return submit({ request, action, values, message });
  }

  return (
    <div className="container">
      <div className="page-header">
        <h2>经费报销</h2>
        <Link to="/admin/finance" className="btn btn-outline">财务仪表盘</Link>
      </div>
      <div className="filter-toolbar">
        <button type="button" className={scope === "mine" ? "" : "btn-outline"} aria-pressed={scope === "mine"}
          disabled={busy} onClick={() => changeScope("mine")}>我的申请</button>
        {data?.can_review && (
          <button type="button" className={scope === "review" ? "" : "btn-outline"} aria-pressed={scope === "review"}
            disabled={busy} onClick={() => changeScope("review")}>审核与入账</button>
        )}
        <label htmlFor="reimbursement-status">状态</label>
        <select id="reimbursement-status" value={status} disabled={busy || Boolean(editor)} onChange={(event) => {
          setStatus(event.target.value);
          setError("");
          setLoading(true);
        }}>
          <option value="">全部</option>
          {Object.entries(statusLabels).map(([value, [label]]) => <option value={value} key={value}>{label}</option>)}
        </select>
        {scope === "mine" && data?.clubs.length > 0 && !editor &&
          <button type="button" disabled={busy} onClick={() => { setEditor("new"); setError(""); setSuccess(""); }}>发起报销</button>}
      </div>
      <FeedbackMessage message={error} />
      <FeedbackMessage message={success} type="success" />
      {editor && (
        <ReimbursementForm key={editor.id || editor} clubs={data?.clubs || []} request={editor === "new" ? null : editor}
          busy={busy} onCancel={() => setEditor(null)} onSave={(values, requestKey) => {
            const request = editor === "new" ? null : editor;
            return submit({
              request, action: request ? "resubmit" : undefined,
              values: request ? values : { ...values, request_key: requestKey },
              message: "申请已提交，等待审核。",
            });
          }} />
      )}
      {loading ? <LoadingState message="正在读取报销申请…" /> : data && (
        data.requests.length > 0 ? data.requests.map((request) => (
          <ReimbursementCard key={`${request.id}-${request.revision}-${scope}`} request={request}
            scope={scope} userId={user?.id} busy={busy} onEdit={() => setEditor(request)}
            onAction={(action, values) => handleAction(request, action, values)} />
        )) : (
          <div className="card">
            <p>{scope === "mine" && !status ? "还没有提交报销申请。" : "当前没有符合条件的报销单。"}</p>
            {scope === "mine" && !data.clubs.length && <p className="hint">会长和社团管理员可以为所管社团发起报销。</p>}
          </div>
        )
      )}
    </div>
  );
}

export default function ReimbursementsPage() {
  const layout = useOutletContext();
  const tenantCode = (layout?.tenantCode ?? getTenantCode()).trim() || "default";
  return <ReimbursementWorkspace key={tenantCode} tenantCode={tenantCode} />;
}

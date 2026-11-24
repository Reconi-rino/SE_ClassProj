import { useState } from "react";

export default function ReimbursementActions({ scope, request, applicant, busy, onEdit, onAction }) {
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const isReturn = action === "return";
  const isBooking = action === "book";

  function open(next) {
    setNote("");
    setAction(next);
  }

  if (action) {
    return (
      <form className="auth-form reimbursement-decision" onSubmit={(event) => {
        event.preventDefault();
        if (isReturn) onAction("review", { decision: "return", review_note: note });
        else if (isBooking) onAction("book", { payment_reference: note });
        else if (action === "approve") onAction("review", { decision: "approve" });
        else onAction("withdraw");
      }}>
        {(isReturn || isBooking) && (
          <div className="form-group">
            <label htmlFor={`reimbursement-action-${request.id}`}>{isReturn ? "退回原因" : "付款凭证编号"}</label>
            <input id={`reimbursement-action-${request.id}`} value={note}
              onChange={(event) => setNote(event.target.value)} maxLength={isReturn ? 500 : 120} required />
          </div>
        )}
        {isBooking && <p className="hint">完成线下付款后确认，系统会按申请金额生成一笔支出流水。</p>}
        {action === "withdraw" && <p>撤回后，此单将结束处理。</p>}
        <div className="actions-row">
          <button type="submit" disabled={busy || ((isReturn || isBooking) && !note.trim())}>
            {{ return: "确认退回", approve: "确认通过", book: "确认已付款并入账", withdraw: "确认撤回" }[action]}
          </button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => setAction("")}>返回</button>
        </div>
      </form>
    );
  }

  return (
    <div className="actions-row">
      {scope === "mine" && request.status === "returned" && <button disabled={busy} onClick={onEdit}>修改申请</button>}
      {scope === "mine" && ["pending", "returned"].includes(request.status) &&
        <button className="btn-outline" disabled={busy} onClick={() => open("withdraw")}>撤回申请</button>}
      {scope === "review" && applicant && ["pending", "approved"].includes(request.status) &&
        <p className="hint">请由其他管理员处理你提交的申请。</p>}
      {scope === "review" && !applicant && request.status === "pending" && (
        <>
          <button disabled={busy} onClick={() => open("approve")}>通过审核</button>
          <button className="btn-outline" disabled={busy} onClick={() => open("return")}>退回补充</button>
        </>
      )}
      {scope === "review" && !applicant && request.status === "approved" &&
        <button disabled={busy} onClick={() => open("book")}>登记付款</button>}
    </div>
  );
}

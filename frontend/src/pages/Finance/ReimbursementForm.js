import { useState } from "react";

export default function ReimbursementForm({ clubs, request, busy, onSave, onCancel }) {
  const [form, setForm] = useState({
    club_id: request?.club_id || (clubs.length === 1 ? clubs[0].id : ""),
    amount: request?.amount ?? "",
    category: request?.category || "",
    expense_date: request?.expense_date || "",
    purpose: request?.purpose || "",
    receipt_reference: request?.receipt_reference || "",
  });
  const [requestKey] = useState(() => request ? null :
    Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  return (
    <form className="card auth-form" onSubmit={(event) => {
      event.preventDefault();
      onSave(form, requestKey);
    }}>
      <h3>{request ? `修改报销单 #${request.id}` : "发起报销"}</h3>
      {request?.review_note && <p className="feedback feedback-warning">退回原因：{request.review_note}</p>}
      <div className="form-group">
        <label htmlFor="reimbursement-club">所属社团</label>
        <select id="reimbursement-club" name="club_id" value={form.club_id} onChange={handleChange} disabled={Boolean(request) || busy} required>
          <option value="">请选择社团</option>
          {request ? <option value={request.club_id}>{request.club.name}</option> :
            clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </div>
      <div className="reimbursement-fields">
        <div className="form-group">
          <label htmlFor="reimbursement-amount">金额（元）</label>
          <input id="reimbursement-amount" name="amount" inputMode="decimal"
            pattern="[0-9]{1,10}(\.[0-9]{1,2})?" value={form.amount} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="reimbursement-date">支出日期</label>
          <input id="reimbursement-date" name="expense_date" type="date" value={form.expense_date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="reimbursement-category">费用分类</label>
          <input id="reimbursement-category" name="category" value={form.category} onChange={handleChange}
            placeholder="如：活动物料" maxLength={100} required />
        </div>
        <div className="form-group">
          <label htmlFor="reimbursement-receipt">发票号或收据编号</label>
          <input id="reimbursement-receipt" name="receipt_reference" value={form.receipt_reference}
            onChange={handleChange} maxLength={120} required />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="reimbursement-purpose">报销用途</label>
        <textarea id="reimbursement-purpose" name="purpose" rows={3} value={form.purpose}
          onChange={handleChange} maxLength={500} required />
      </div>
      <div className="actions-row">
        <button type="submit" disabled={busy}>{request ? "重新提交" : "提交审核"}</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>取消编辑</button>
      </div>
    </form>
  );
}

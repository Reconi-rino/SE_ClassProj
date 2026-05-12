const MAP = {
  draft: { cls: "badge-gray", text: "草稿" },
  pending_approval: { cls: "badge-orange", text: "待审批" },
  approved: { cls: "badge-green", text: "已批准" },
  rejected: { cls: "badge-red", text: "已驳回" },
  published: { cls: "badge-blue", text: "已发布" },
  cancelled: { cls: "badge-gray", text: "已取消" },
  completed: { cls: "badge-green", text: "已完成" },
  active: { cls: "badge-green", text: "活跃" },
  inactive: { cls: "badge-gray", text: "停用" },
};

function StatusBadge({ status }) {
  const m = MAP[status] || { cls: "badge-gray", text: status || "-" };
  return (
    <span className={`badge ${m.cls}`}>
      <span className="badge-dot" />
      {m.text}
    </span>
  );
}

export default StatusBadge;

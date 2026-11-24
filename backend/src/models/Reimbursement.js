const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("Reimbursement", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  club_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  applicant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  request_key: { type: DataTypes.STRING(32), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  category: { type: DataTypes.STRING(100), allowNull: false },
  purpose: { type: DataTypes.STRING(500), allowNull: false },
  expense_date: { type: DataTypes.DATEONLY, allowNull: false },
  receipt_reference: { type: DataTypes.STRING(120), allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending" },
  revision: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  reviewer_id: { type: DataTypes.INTEGER.UNSIGNED },
  review_note: { type: DataTypes.STRING(500) },
  reviewed_at: { type: DataTypes.DATE },
  booked_by: { type: DataTypes.INTEGER.UNSIGNED },
  booked_at: { type: DataTypes.DATE },
  payment_reference: { type: DataTypes.STRING(120) },
}, {
  tableName: "reimbursements",
  underscored: true,
  indexes: [
    { unique: true, name: "uq_reimbursements_submission", fields: ["tenant_id", "applicant_id", "request_key"] },
    { name: "idx_reimbursements_queue", fields: ["tenant_id", "status", "created_at"] },
  ],
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const reference = (model, allowNull = false) => ({
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull,
      references: { model, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    await queryInterface.createTable("reimbursements", {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      tenant_id: reference("tenants"),
      club_id: reference("clubs"),
      applicant_id: reference("users"),
      request_key: { type: Sequelize.STRING(32), allowNull: false },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      category: { type: Sequelize.STRING(100), allowNull: false },
      purpose: { type: Sequelize.STRING(500), allowNull: false },
      expense_date: { type: Sequelize.DATEONLY, allowNull: false },
      receipt_reference: { type: Sequelize.STRING(120), allowNull: false },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "pending" },
      revision: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      reviewer_id: reference("users", true),
      review_note: { type: Sequelize.STRING(500) },
      reviewed_at: { type: Sequelize.DATE },
      booked_by: reference("users", true),
      booked_at: { type: Sequelize.DATE },
      payment_reference: { type: Sequelize.STRING(120) },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("reimbursements", ["tenant_id", "applicant_id", "request_key"], {
      unique: true, name: "uq_reimbursements_submission",
    });
    await queryInterface.addIndex("reimbursements", ["tenant_id", "status", "created_at"], {
      name: "idx_reimbursements_queue",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("reimbursements");
  },
};

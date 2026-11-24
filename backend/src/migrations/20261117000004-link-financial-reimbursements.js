const FOREIGN_KEY = "fk_financial_records_reimbursement";
const UNIQUE_INDEX = "uq_financial_records_reimbursement";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("financial_records", "reimbursement_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex("financial_records", ["reimbursement_id"], {
      unique: true, name: UNIQUE_INDEX,
    });
    await queryInterface.addConstraint("financial_records", {
      name: FOREIGN_KEY,
      type: "foreign key",
      fields: ["reimbursement_id"],
      references: { table: "reimbursements", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("financial_records", FOREIGN_KEY);
    await queryInterface.removeIndex("financial_records", UNIQUE_INDEX);
    await queryInterface.removeColumn("financial_records", "reimbursement_id");
  },
};

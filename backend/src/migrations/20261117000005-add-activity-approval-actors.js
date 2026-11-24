module.exports = {
  async up(queryInterface, Sequelize) {
    for (const column of ["submitted_by", "decided_by"]) {
      await queryInterface.addColumn("approvals", column, {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }
  },
  async down(queryInterface) {
    const references = await queryInterface.getForeignKeyReferencesForTable("approvals");
    for (const column of ["decided_by", "submitted_by"]) {
      const reference = references.find(({ columnName }) => columnName === column);
      if (reference) await queryInterface.removeConstraint("approvals", reference.constraintName);
      await queryInterface.removeColumn("approvals", column);
    }
  },
};

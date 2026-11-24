module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("activities", "cancellation_reason", { type: Sequelize.STRING(500), allowNull: true });
    await queryInterface.addColumn("activities", "cancelled_at", { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("activities", "cancelled_at");
    await queryInterface.removeColumn("activities", "cancellation_reason");
  },
};

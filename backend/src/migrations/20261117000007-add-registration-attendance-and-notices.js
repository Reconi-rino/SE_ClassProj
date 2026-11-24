module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("activity_registrations", "checked_in_at", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("activity_registrations", "cancellation_read_at", { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("activity_registrations", "cancellation_read_at");
    await queryInterface.removeColumn("activity_registrations", "checked_in_at");
  },
};

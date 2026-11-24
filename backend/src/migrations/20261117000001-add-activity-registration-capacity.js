module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("activities", "registration_capacity", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("activities", "registration_capacity");
  },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "avatar_url", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "role",
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("users", "avatar_url");
  },
};

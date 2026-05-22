module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("clubs", "cover_image_url", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "description",
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("clubs", "cover_image_url");
  },
};

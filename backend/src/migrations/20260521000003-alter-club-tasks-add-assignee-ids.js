module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("club_tasks", "assignee_ids", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "assignee_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("club_tasks", "assignee_ids");
  },
};

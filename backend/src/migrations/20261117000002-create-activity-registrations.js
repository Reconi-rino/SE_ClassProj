module.exports = {
  async up(queryInterface, Sequelize) {
    const reference = (model, onDelete) => ({
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model, key: "id" },
      onUpdate: "CASCADE",
      onDelete,
    });

    await queryInterface.createTable("activity_registrations", {
      activity_id: { ...reference("activities", "CASCADE"), primaryKey: true },
      user_id: { ...reference("users", "CASCADE"), primaryKey: true },
      tenant_id: reference("tenants", "RESTRICT"),
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("activity_registrations", ["tenant_id", "user_id"], {
      name: "idx_activity_registrations_tenant_user",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("activity_registrations");
  },
};

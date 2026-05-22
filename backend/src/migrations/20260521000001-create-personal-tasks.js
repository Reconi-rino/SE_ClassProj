module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("personal_tasks", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "tenants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      priority: {
        type: Sequelize.ENUM("low", "medium", "high"),
        allowNull: false,
        defaultValue: "medium",
      },
      status: {
        type: Sequelize.ENUM("pending", "in_progress", "completed"),
        allowNull: false,
        defaultValue: "pending",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("personal_tasks", ["tenant_id"], { name: "idx_pt_tenant_id" });
    await queryInterface.addIndex("personal_tasks", ["tenant_id", "user_id"], { name: "idx_pt_tenant_user" });
    await queryInterface.addIndex("personal_tasks", ["tenant_id", "user_id", "status"], { name: "idx_pt_tenant_user_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("personal_tasks");
  },
};

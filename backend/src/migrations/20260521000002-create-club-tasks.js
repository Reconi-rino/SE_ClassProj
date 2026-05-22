module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("club_tasks", {
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
      club_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "clubs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      activity_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "activities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      assignee_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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

    await queryInterface.addIndex("club_tasks", ["tenant_id"], { name: "idx_ct_tenant_id" });
    await queryInterface.addIndex("club_tasks", ["tenant_id", "club_id"], { name: "idx_ct_tenant_club" });
    await queryInterface.addIndex("club_tasks", ["tenant_id", "assignee_id"], { name: "idx_ct_tenant_assignee" });
    await queryInterface.addIndex("club_tasks", ["tenant_id", "status"], { name: "idx_ct_tenant_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("club_tasks");
  },
};

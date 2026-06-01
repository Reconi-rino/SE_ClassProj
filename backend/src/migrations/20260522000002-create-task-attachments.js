module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("task_attachments", {
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
      task_type: {
        type: Sequelize.ENUM("personal", "club"),
        allowNull: false,
      },
      task_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      stored_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      file_size: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      uploaded_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      attachment_type: {
        type: Sequelize.ENUM("reference", "submission"),
        allowNull: false,
        defaultValue: "reference",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("task_attachments", ["tenant_id", "task_type", "task_id"], {
      name: "idx_ta_tenant_task",
    });
    await queryInterface.addIndex("task_attachments", ["uploaded_by"], {
      name: "idx_ta_uploaded_by",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("task_attachments");
  },
};

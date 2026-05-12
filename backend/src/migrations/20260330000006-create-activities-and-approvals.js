"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("activities", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "tenants",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      club_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "draft",
          "pending_approval",
          "approved",
          "rejected",
          "cancelled",
          "completed"
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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

    await queryInterface.addIndex("activities", ["tenant_id"], {
      name: "idx_activities_tenant_id",
    });
    await queryInterface.addIndex("activities", ["tenant_id", "status"], {
      name: "idx_activities_tenant_status",
    });
    await queryInterface.addIndex("activities", ["tenant_id", "club_id"], {
      name: "idx_activities_tenant_club",
    });
    await queryInterface.addIndex("activities", ["tenant_id", "start_time"], {
      name: "idx_activities_tenant_start_time",
    });
    await queryInterface.addIndex("activities", ["tenant_id", "created_at"], {
      name: "idx_activities_tenant_created_at",
    });
    await queryInterface.addIndex("activities", ["created_by"], {
      name: "idx_activities_created_by",
    });

    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((table) => (typeof table === "string" ? table : Object.values(table)[0]));

    if (tableNames.includes("clubs")) {
      await queryInterface.addConstraint("activities", {
        fields: ["club_id"],
        type: "foreign key",
        name: "fk_activities_club_id",
        references: {
          table: "clubs",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }

    await queryInterface.createTable("approvals", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "tenants",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      activity_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "activities",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      approver_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected", "changes_requested", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      comments: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addConstraint("approvals", {
      fields: ["tenant_id", "activity_id", "approver_id"],
      type: "unique",
      name: "uq_approvals_tenant_activity_approver",
    });

    await queryInterface.addIndex("approvals", ["tenant_id"], {
      name: "idx_approvals_tenant_id",
    });
    await queryInterface.addIndex("approvals", ["tenant_id", "status"], {
      name: "idx_approvals_tenant_status",
    });
    await queryInterface.addIndex("approvals", ["tenant_id", "activity_id"], {
      name: "idx_approvals_tenant_activity",
    });
    await queryInterface.addIndex("approvals", ["tenant_id", "approver_id"], {
      name: "idx_approvals_tenant_approver",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("approvals");
    await queryInterface.dropTable("activities");
  },
};

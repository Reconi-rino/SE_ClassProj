"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("clubs", {
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
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      founder_id: {
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
        type: Sequelize.ENUM("active", "inactive", "archived"),
        allowNull: false,
        defaultValue: "active",
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

    await queryInterface.addConstraint("clubs", {
      fields: ["tenant_id", "name"],
      type: "unique",
      name: "uq_clubs_tenant_name",
    });

    await queryInterface.addIndex("clubs", ["tenant_id", "status"], {
      name: "idx_clubs_tenant_status",
    });
    await queryInterface.addIndex("clubs", ["tenant_id", "founder_id"], {
      name: "idx_clubs_tenant_founder",
    });
    await queryInterface.addIndex("clubs", ["tenant_id", "created_at"], {
      name: "idx_clubs_tenant_created_at",
    });
    await queryInterface.addIndex("clubs", ["tenant_id", "id"], {
      name: "idx_clubs_tenant_id_id",
    });

    await queryInterface.createTable("club_members", {
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
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      role: {
        type: Sequelize.ENUM("founder", "admin", "member"),
        allowNull: false,
        defaultValue: "member",
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
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

    await queryInterface.addConstraint("club_members", {
      fields: ["tenant_id", "club_id"],
      type: "foreign key",
      name: "fk_club_members_tenant_club",
      references: {
        table: "clubs",
        fields: ["tenant_id", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addConstraint("club_members", {
      fields: ["tenant_id", "club_id", "user_id"],
      type: "unique",
      name: "uq_club_members_tenant_club_user",
    });

    await queryInterface.addIndex("club_members", ["tenant_id", "user_id"], {
      name: "idx_club_members_tenant_user",
    });
    await queryInterface.addIndex("club_members", ["tenant_id", "club_id", "role"], {
      name: "idx_club_members_tenant_club_role",
    });
    await queryInterface.addIndex("club_members", ["tenant_id", "joined_at"], {
      name: "idx_club_members_tenant_joined_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("club_members");
    await queryInterface.dropTable("clubs");
  },
};

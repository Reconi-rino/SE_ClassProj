"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("financial_records", {
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
      type: {
        type: Sequelize.ENUM("income", "expense"),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      transaction_date: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.addIndex("financial_records", ["tenant_id"], {
      name: "idx_financial_records_tenant_id",
    });
    await queryInterface.addIndex("financial_records", ["tenant_id", "club_id"], {
      name: "idx_financial_records_tenant_club",
    });
    await queryInterface.addIndex("financial_records", ["tenant_id", "type"], {
      name: "idx_financial_records_tenant_type",
    });
    await queryInterface.addIndex("financial_records", ["tenant_id", "category"], {
      name: "idx_financial_records_tenant_category",
    });
    await queryInterface.addIndex("financial_records", ["tenant_id", "transaction_date"], {
      name: "idx_financial_records_tenant_transaction_date",
    });
    await queryInterface.addIndex("financial_records", ["tenant_id", "created_at"], {
      name: "idx_financial_records_tenant_created_at",
    });
    await queryInterface.addIndex("financial_records", ["created_by"], {
      name: "idx_financial_records_created_by",
    });

    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((table) => (typeof table === "string" ? table : Object.values(table)[0]));

    if (tableNames.includes("clubs")) {
      await queryInterface.addConstraint("financial_records", {
        fields: ["club_id"],
        type: "foreign key",
        name: "fk_financial_records_club_id",
        references: {
          table: "clubs",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeConstraint("financial_records", "fk_financial_records_club_id");
    } catch (_error) {
      // constraint may not exist in environments without clubs table
    }

    await queryInterface.dropTable("financial_records");
  },
};

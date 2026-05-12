"use strict";

const CORE_TABLES = ["clubs", "club_members", "activities", "approvals", "financial_records"];

const PLACEHOLDER_STRATEGY =
  "When this table is created, include tenant_id (INTEGER UNSIGNED, NOT NULL), FK to tenants.id, and tenant composite indexes for status/created_at when columns exist.";

async function getTableNames(queryInterface) {
  const rows = await queryInterface.showAllTables();
  return rows.map((row) => (typeof row === "string" ? row : Object.values(row)[0]));
}

async function getTableDefinition(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName);
  } catch (_error) {
    return null;
  }
}

async function ensureDefaultTenant(queryInterface) {
  const [tenantRows] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE code = 'default' LIMIT 1"
  );

  if (tenantRows.length > 0) {
    return tenantRows[0].id;
  }

  await queryInterface.sequelize.query(
    "INSERT INTO tenants (name, code, status, created_at, updated_at) VALUES ('Default Tenant', 'default', 'active', NOW(), NOW())"
  );

  const [newTenantRows] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE code = 'default' LIMIT 1"
  );

  return newTenantRows[0].id;
}

async function hasConstraint(queryInterface, tableName, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND CONSTRAINT_NAME = :constraintName`,
    {
      replacements: { tableName, constraintName },
    }
  );

  return rows.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await getTableNames(queryInterface);
    const defaultTenantId = await ensureDefaultTenant(queryInterface);

    for (const tableName of CORE_TABLES) {
      if (!allTables.includes(tableName)) {
        console.warn(`[phasea-tenant-id-migration] "${tableName}" not found. ${PLACEHOLDER_STRATEGY}`);
        continue;
      }

      const tableDef = await getTableDefinition(queryInterface, tableName);
      if (!tableDef) {
        continue;
      }

      if (!tableDef.tenant_id) {
        await queryInterface.addColumn(tableName, "tenant_id", {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
        });
      }

      await queryInterface.sequelize.query(
        `UPDATE \`${tableName}\` SET tenant_id = :tenantId WHERE tenant_id IS NULL`,
        { replacements: { tenantId: defaultTenantId } }
      );

      await queryInterface.changeColumn(tableName, "tenant_id", {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      });

      const tenantConstraintName = `fk_${tableName}_tenant_id`;
      if (!(await hasConstraint(queryInterface, tableName, tenantConstraintName))) {
        await queryInterface.addConstraint(tableName, {
          fields: ["tenant_id"],
          type: "foreign key",
          name: tenantConstraintName,
          references: {
            table: "tenants",
            field: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        });
      }

      await queryInterface.addIndex(tableName, ["tenant_id"], {
        name: `idx_${tableName}_tenant_id`,
      });

      if (tableDef.status) {
        await queryInterface.addIndex(tableName, ["tenant_id", "status"], {
          name: `idx_${tableName}_tenant_status`,
        });
      }

      if (tableDef.created_at) {
        await queryInterface.addIndex(tableName, ["tenant_id", "created_at"], {
          name: `idx_${tableName}_tenant_created_at`,
        });
      }
    }
  },

  async down(queryInterface) {
    const allTables = await getTableNames(queryInterface);

    for (const tableName of CORE_TABLES) {
      if (!allTables.includes(tableName)) {
        continue;
      }

      const tableDef = await getTableDefinition(queryInterface, tableName);
      if (!tableDef || !tableDef.tenant_id) {
        continue;
      }

      for (const indexName of [
        `idx_${tableName}_tenant_created_at`,
        `idx_${tableName}_tenant_status`,
        `idx_${tableName}_tenant_id`,
      ]) {
        try {
          await queryInterface.removeIndex(tableName, indexName);
        } catch (_error) {
          // index may not exist
        }
      }

      try {
        await queryInterface.removeConstraint(tableName, `fk_${tableName}_tenant_id`);
      } catch (_error) {
        // constraint may not exist
      }

      await queryInterface.removeColumn(tableName, "tenant_id");
    }
  },
};

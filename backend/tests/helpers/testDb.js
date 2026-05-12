const db = require("../../src/models");

async function syncTestDatabase() {
  await db.sequelize.sync({ force: true });
}

async function closeTestDatabase() {
  await db.sequelize.close();
}

module.exports = {
  db,
  syncTestDatabase,
  closeTestDatabase,
};

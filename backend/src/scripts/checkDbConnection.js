require("dotenv").config();
const sequelize = require("../config/database");

async function check() {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log("Database connection successful.");
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
}

check();

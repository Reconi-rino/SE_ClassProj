const { Sequelize } = require("sequelize");

const dialect = process.env.DB_DIALECT || "mysql";
const baseOptions = {
  dialect,
  logging: false,
};

if (dialect === "sqlite") {
  baseOptions.storage = process.env.DB_STORAGE || ":memory:";
} else {
  baseOptions.host = process.env.DB_HOST || "127.0.0.1";
  baseOptions.port = Number(process.env.DB_PORT || 3306);
  baseOptions.timezone = "+08:00";
}

const sequelize = new Sequelize(
  process.env.DB_NAME || "campus_club_system",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  baseOptions
);

module.exports = sequelize;

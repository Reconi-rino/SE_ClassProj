require("dotenv").config();

const common = {
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campus_club_system",
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  dialect: "mysql",
  logging: false,
};

module.exports = {
  development: common,
  test: { ...common, database: process.env.DB_NAME_TEST || "campus_club_system_test" },
  production: common,
};

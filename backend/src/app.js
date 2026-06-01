const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const sequelize = require("./config/database");
const authRoutes = require("./routes/auth.routes");
const businessRoutes = require("./routes/business.routes");
const financialRoutes = require("./routes/financial.routes");
const clubRoutes = require("./routes/club.routes");
const tenantRoutes = require("./routes/tenant.routes");
const todoRoutes = require("./routes/todo.routes");
const clubTaskRoutes = require("./routes/clubTask.routes");
const publicRoutes = require("./routes/public.routes");
const { resolveTenantContext } = require("./middleware/tenant.middleware");
const { ensureDefaultAdmin } = require("./controllers/authController");

const PORT = process.env.PORT || 3001;

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(resolveTenantContext);

  // 静态文件服务：上传的文件
  app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      message: "Backend is running",
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/business", businessRoutes);
  app.use("/api/financial-records", financialRoutes);
  app.use("/api/clubs", clubRoutes);
  app.use("/api/tenants", tenantRoutes);
  app.use("/api/todos", todoRoutes);
  app.use("/api/club-tasks", clubTaskRoutes);

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  });

  return app;
}

const app = createApp();

async function startServer(port = PORT) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in environment variables");
    }
    await sequelize.authenticate();
    await ensureDefaultAdmin();
    console.log("Database connection successful.");
    const server = app.listen(port, () => {
      console.log(`Backend server running on http://localhost:${port}`);
    });
    return server;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  createApp,
  startServer,
};

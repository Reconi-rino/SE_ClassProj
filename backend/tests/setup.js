const fs = require("fs");
const path = require("path");

const artifactsDir = path.resolve(__dirname, "..", "test-artifacts");
const auditFile = path.join(artifactsDir, "audit.log");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.AUDIT_LOG_FILE = auditFile;
process.env.DEFAULT_ADMIN_EMAIL = "admin@test.local";
process.env.DEFAULT_ADMIN_USERNAME = "admin";
process.env.DEFAULT_ADMIN_PASSWORD = "Admin@Test#123";
process.env.DEFAULT_ADMIN_STUDENT_ID = "00000000001";

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

beforeEach(() => {
  if (fs.existsSync(auditFile)) {
    fs.unlinkSync(auditFile);
  }
});

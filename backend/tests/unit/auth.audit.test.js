const fs = require("fs");
const request = require("supertest");
const { app } = require("../../src/app");
const { syncTestDatabase } = require("../helpers/testDb");
const { createUser, signToken } = require("../helpers/testData");

describe("Auth API unit tests with audit logging", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  test("login writes success audit event", async () => {
    const { user, password } = await createUser({
      username: "login_user",
      email: "login@test.local",
      student_id: "10000000001",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const logLines = fs
      .readFileSync(process.env.AUDIT_LOG_FILE, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(logLines.some((entry) => entry.action === "auth.login" && entry.outcome === "success")).toBe(true);
  });

  test("reset password writes success audit event", async () => {
    const { user } = await createUser({
      username: "reset_user",
      email: "reset@test.local",
      student_id: "10000000002",
    });
    const token = signToken(user);

    const response = await request(app)
      .post("/api/auth/reset-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newPassword: "Reset@1234",
        confirmNewPassword: "Reset@1234",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const logLines = fs
      .readFileSync(process.env.AUDIT_LOG_FILE, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const resetEvent = logLines.find((entry) => entry.action === "auth.reset_password");
    expect(resetEvent).toBeTruthy();
    expect(resetEvent.target).toMatchObject({ type: "user", id: user.id });
  });

  test("register returns 409 on duplicate email", async () => {
    await createUser({
      username: "exists_user",
      email: "exists@test.local",
      student_id: "10000000003",
    });

    const response = await request(app).post("/api/auth/register").send({
      username: "another_user",
      email: "exists@test.local",
      password: "Password@123",
      student_id: "10000000004",
      role: "student",
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });
});

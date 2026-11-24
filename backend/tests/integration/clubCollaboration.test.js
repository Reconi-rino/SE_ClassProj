/* eslint-env jest */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const request = require("supertest");
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccms-collaboration-"));
const originalUploadDir = process.env.CCMS_UPLOAD_DIR;
process.env.CCMS_UPLOAD_DIR = uploadDir;
const { app } = require("../../src/app");
const { db, syncTestDatabase, closeTestDatabase } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub, signToken } = require("../helpers/testData");

describe("Club collaboration and task ownership", () => {
  let campus;
  let founder;
  let student;
  let outsider;
  let club;

  function api(method, path, user) {
    return request(app)[method](path).set("x-tenant-code", campus.code)
      .set("Authorization", `Bearer ${signToken(user, campus)}`);
  }

  beforeAll(async () => {
    await syncTestDatabase();
    campus = await createTenant();
    ({ user: founder } = await createUser());
    ({ user: student } = await createUser());
    ({ user: outsider } = await createUser());
    await Promise.all([founder, student, outsider].map((user) => addTenantMembership(campus, user)));
    club = await createClub({ tenant: campus, founder });
  });

  afterAll(async () => {
    if (originalUploadDir === undefined) delete process.env.CCMS_UPLOAD_DIR;
    else process.env.CCMS_UPLOAD_DIR = originalUploadDir;
    await closeTestDatabase();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  test("a founder assigns a task and the assigned student can update progress", async () => {
    const members = `/api/clubs/${club.id}/members`;
    await api("post", `${members}/join`, student).send({ role: "admin" }).expect(403);
    await api("post", `${members}/join`, founder).send({ user_id: student.id }).expect(201);
    const list = await api("get", members, founder).expect(200);
    expect(list.body.data).toMatchObject({ can_manage: true, members: expect.arrayContaining([
      expect.objectContaining({ user_id: student.id, role: "member" }),
    ]) });

    const taskPayload = { club_id: club.id, title: "Set up exhibit", assignee_id: student.id, due_date: null };
    await api("post", "/api/club-tasks", founder).send({ ...taskPayload, assignee_id: outsider.id }).expect(400);
    const { body: { data: task } } = await api("post", "/api/club-tasks", founder).send(taskPayload).expect(201);
    await db.ClubTask.create({
      tenant_id: campus.id, club_id: club.id, created_by: founder.id, title: "Other task",
      assignee_id: founder.id, assignee_ids: `${founder.id},9${student.id}7`,
    });
    const assigned = await api("get", "/api/club-tasks/my", student).expect(200);
    expect(assigned.body.data.map(({ id }) => id)).toEqual([task.id]);
    const taskPath = `/api/club-tasks/${task.id}`;
    await api("patch", taskPath, student).send({ club_id: club.id, title: "Changed title" }).expect(403);
    const changed = await api("patch", taskPath, student).send({ club_id: club.id, status: "completed" }).expect(200);
    expect(changed.body.data.status).toBe("completed");
    await api("get", `${taskPath}/attachments`, outsider).expect(403);
    const membership = list.body.data.members.find(({ user_id }) => user_id === student.id);
    await api("delete", `${members}/${membership.id}`, founder).expect(200);
    const afterRemoval = await api("get", "/api/club-tasks/my", student).expect(200);
    expect(afterRemoval.body.data).toEqual([]);
    await api("get", taskPath, student).expect(403);
    await api("patch", taskPath, student).send({ club_id: club.id, status: "in_progress" }).expect(403);
    await api("get", `${taskPath}/attachments/download`, student).expect(403);
  });

  test("padded task IDs use the same attachment folder and can read older files", async () => {
    const { body: { data: task } } = await api("post", "/api/todos", student)
      .send({ title: "Download task" }).expect(201);
    const contents = Buffer.from("Meeting notes");
    const paddedId = `00${task.id}`;
    const { body: { data: file } } = await api("post", `/api/todos/${paddedId}/attachments`, student)
      .attach("file", contents, "notes.txt").expect(201);
    const correctFolder = path.join(uploadDir, "personal", String(task.id));
    const legacyFolder = path.join(uploadDir, "personal", paddedId);
    const storedPath = path.join(correctFolder, file.stored_name);
    expect(fs.readFileSync(storedPath)).toEqual(contents);
    fs.mkdirSync(legacyFolder, { recursive: true });
    fs.renameSync(storedPath, path.join(legacyFolder, file.stored_name));

    const { body } = await api("get", `/api/todos/${task.id}/attachments/download`, student)
      .buffer(true).parse((stream, callback) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => callback(null, Buffer.concat(chunks)));
        stream.on("error", callback);
      }).expect(200);
    expect(new AdmZip(body).readFile("notes.txt")).toEqual(contents);
  });

  test("personal tasks can omit deadlines and only their owner can list attachments", async () => {
    const { body: { data: task } } = await api("post", "/api/todos", student)
      .send({ title: "Personal reminder", due_date: null }).expect(201);
    expect(task.due_date).toBeNull();
    const path = `/api/todos/${task.id}/attachments`;
    await api("get", path, student).expect(200);
    await api("get", path, founder).expect(404);
  });
});

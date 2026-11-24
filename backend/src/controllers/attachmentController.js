const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { TaskAttachment } = require("../models");
const { uploadAttachment, handleMulterError, UPLOAD_DIR } = require("../utils/upload");
const personalTasks = require("../services/task.service");
const clubTasks = require("../services/clubTask.service");
const { handleServiceError } = require("../utils/errorResponse");

function requireTaskAccess(uploading = false) {
  return async (req, res, next) => {
    const taskId = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(taskId) || taskId < 1 || taskId > 4294967295) {
      return res.status(400).json({ success: false, message: "无效的任务编号。" });
    }
    try {
      const tenantId = req.tenant.id;
      const actorUserId = req.user.id;
      if (req.params.taskType === "club") {
        const { canManage, isAssignee } = await clubTasks.getClubTaskAccess({ tenantId, actorUserId, taskId });
        if (uploading && !canManage && !isAssignee) {
          return res.status(403).json({ success: false, message: "无权上传此任务的附件。" });
        }
        req.taskAttachmentTypes = [...(canManage ? ["reference"] : []), ...(isAssignee ? ["submission"] : [])];
      } else {
        await personalTasks.getTask({ tenantId, userId: actorUserId, taskId });
        req.taskAttachmentTypes = ["reference", "submission"];
      }
      return next();
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  };
}

async function listAttachments(req, res) {
  try {
    const { taskType } = req.params;
    const taskId = parseInt(req.params.id, 10);
    const attachments = await TaskAttachment.findAll({
      where: { tenant_id: req.tenant.id, task_type: taskType, task_id: taskId },
      order: [["created_at", "DESC"]],
    });
    return res.status(200).json({ success: true, data: attachments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function uploadFile(req, res) {
  uploadAttachment(req, res, async (err) => {
    if (err) return handleMulterError(err, req, res, () => {});
    if (!req.file) {
      return res.status(400).json({ success: false, message: "请选择要上传的文件" });
    }

    try {
      const { taskType } = req.params;
      const taskId = parseInt(req.params.id, 10);
      const attachmentType = req.body.attachment_type || "reference";
      if (!req.taskAttachmentTypes.includes(attachmentType)) {
        await fs.promises.unlink(req.file.path);
        return res.status(403).json({ success: false, message: "无权上传此类型的附件。" });
      }

      const attachment = await TaskAttachment.create({
        tenant_id: req.tenant.id,
        task_type: taskType,
        task_id: taskId,
        file_name: req.file.originalname,
        stored_name: req.file.filename,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user.id,
        attachment_type: attachmentType,
      });

      return res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(500).json({ success: false, message: error.message });
    }
  });
}

function legacyUploadFolders(typeFolder, taskId) {
  if (!fs.existsSync(typeFolder)) return [];
  return fs.readdirSync(typeFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^0+\d+$/.test(entry.name) && Number(entry.name) === taskId)
    .map((entry) => path.join(typeFolder, entry.name));
}

async function downloadAttachments(req, res) {
  try {
    const { taskType } = req.params;
    const taskId = parseInt(req.params.id, 10);

    const attachments = await TaskAttachment.findAll({
      where: {
        tenant_id: req.tenant.id,
        task_type: taskType,
        task_id: taskId,
        ...(req.query.type ? { attachment_type: req.query.type } : {}),
      },
    });

    if (attachments.length === 0) {
      return res.status(404).json({ success: false, message: "没有可下载的文件" });
    }

    const zip = new AdmZip();
    const usedNames = new Set();
    const typeFolder = path.join(UPLOAD_DIR, taskType);
    let legacyFolders;
    for (const att of attachments) {
      let filePath = path.join(typeFolder, String(taskId), att.stored_name);
      if (!fs.existsSync(filePath)) {
        // Older uploads used the URL spelling as the folder name, including leading zeroes.
        legacyFolders ??= legacyUploadFolders(typeFolder, taskId);
        filePath = legacyFolders.map((folder) => path.join(folder, att.stored_name)).find((file) => fs.existsSync(file));
      }
      if (!filePath) {
        return res.status(404).json({ success: false, message: "有附件文件缺失，无法下载完整压缩包。" });
      }
      const original = path.basename(att.file_name.replace(/\\/g, "/"));
      let name = original === "." || original === ".." || !original ? att.stored_name : original;
      while (usedNames.has(name)) name = `${att.id}-${name}`;
      usedNames.add(name);
      zip.addLocalFile(filePath, "", name);
    }

    const zipBuffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="task-${taskType}-${taskId}.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.send(zipBuffer);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = { requireTaskAccess, listAttachments, uploadFile, downloadAttachments };

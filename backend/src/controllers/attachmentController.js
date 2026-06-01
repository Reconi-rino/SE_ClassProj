const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { TaskAttachment } = require("../models");
const { uploadAttachment, handleMulterError } = require("../utils/upload");

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

      const attachment = await TaskAttachment.create({
        tenant_id: req.tenant.id,
        task_type: taskType,
        task_id: taskId,
        file_name: req.file.originalname,
        stored_name: req.file.filename,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user.id,
        attachment_type: req.body.attachment_type || "reference",
      });

      return res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });
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

    const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads");
    const zip = new AdmZip();
    attachments.forEach((att) => {
      const filePath = path.join(UPLOAD_DIR, taskType, String(taskId), att.stored_name);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      }
    });

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

module.exports = { listAttachments, uploadFile, downloadAttachments };

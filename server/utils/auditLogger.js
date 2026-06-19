const AuditLog = require('../models/AuditLog');
const MatterTimeline = require('../models/MatterTimeline');

async function logAudit({ action, entityType, entityId, userId, userName, details, changes, req }) {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId,
      userId,
      userName,
      details,
      changes,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent']
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

async function addTimelineEntry({ matter, entryType, title, description, referenceType, referenceId, createdBy, metadata, supersedes }) {
  try {
    if (supersedes) {
      await MatterTimeline.updateMany({ _id: supersedes }, { $set: { isSuperseded: true } });
    }
    const entry = await MatterTimeline.create({
      matter,
      entryType,
      title,
      description,
      referenceType,
      referenceId,
      createdBy,
      metadata,
      supersedes
    });
    return entry;
  } catch (err) {
    console.error('Timeline entry write failed:', err.message);
  }
}

module.exports = { logAudit, addTimelineEntry };

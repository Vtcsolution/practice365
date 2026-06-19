const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.entityId) filter.entityId = req.query.entityId;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.search) {
      filter.details = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'firstName lastName email role')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: logs
    });
  } catch (err) {
    next(err);
  }
};

// No update/delete endpoints — audit log is append-only at both API and schema level

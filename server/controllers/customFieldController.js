const CustomField = require('../models/CustomField');
const { logAudit } = require('../utils/auditLogger');

exports.getCustomFields = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.practiceArea) filter.practiceArea = req.query.practiceArea;
    if (req.query.appliesTo) filter.appliesTo = req.query.appliesTo;
    filter.isActive = true;

    const fields = await CustomField.find(filter).sort('displayOrder name');
    res.json({ success: true, count: fields.length, data: fields });
  } catch (err) {
    next(err);
  }
};

exports.createCustomField = async (req, res, next) => {
  try {
    const field = await CustomField.create({ ...req.body, createdBy: req.user._id });

    await logAudit({
      action: 'create',
      entityType: 'custom_field',
      entityId: field._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Custom field created: ${field.name} for ${field.appliesTo} (${field.practiceArea})`,
      req
    });

    res.status(201).json({ success: true, data: field });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomField = async (req, res, next) => {
  try {
    const field = await CustomField.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!field) return res.status(404).json({ success: false, message: 'Custom field not found' });

    await logAudit({
      action: 'update',
      entityType: 'custom_field',
      entityId: field._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Custom field updated: ${field.name}`,
      req
    });

    res.json({ success: true, data: field });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomField = async (req, res, next) => {
  try {
    const field = await CustomField.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!field) return res.status(404).json({ success: false, message: 'Custom field not found' });

    await logAudit({
      action: 'delete',
      entityType: 'custom_field',
      entityId: field._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Custom field deactivated: ${field.name}`,
      req
    });

    res.json({ success: true, message: 'Custom field deactivated' });
  } catch (err) {
    next(err);
  }
};

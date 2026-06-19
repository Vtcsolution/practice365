const Client = require('../models/Client');
const Matter = require('../models/Matter');
const CustomField = require('../models/CustomField');
const { logAudit } = require('../utils/auditLogger');

async function buildCustomFieldSearch(search, appliesTo) {
  const defs = await CustomField.find({ appliesTo, isActive: true }).select('fieldKey');
  return defs.map(cf => ({ [`customFields.${cf.fieldKey}`]: { $regex: search, $options: 'i' } }));
}

exports.getClients = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    if (req.query.search) {
      const cfConditions = await buildCustomFieldSearch(req.query.search, 'client');
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { company: { $regex: req.query.search, $options: 'i' } },
        ...cfConditions
      ];
    }

    const clients = await Client.find(filter)
      .populate('assignedAttorney', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, count: clients.length, data: clients });
  } catch (err) {
    next(err);
  }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('assignedAttorney', 'firstName lastName email')
      .populate('portalUserId', 'email lastLogin');
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const matters = await Matter.find({ client: client._id })
      .select('name matterNumber status practiceArea openDate')
      .sort('-openDate');

    res.json({ success: true, data: { ...client.toObject(), matters } });
  } catch (err) {
    next(err);
  }
};

exports.createClient = async (req, res, next) => {
  try {
    const client = await Client.create(req.body);

    await logAudit({
      action: 'create',
      entityType: 'client',
      entityId: client._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Client created: ${client.firstName} ${client.lastName}`,
      req
    });

    res.status(201).json({ success: true, data: client });
  } catch (err) {
    next(err);
  }
};

exports.updateClient = async (req, res, next) => {
  try {
    const before = await Client.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Client not found' });

    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    await logAudit({
      action: 'update',
      entityType: 'client',
      entityId: client._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Client updated: ${client.firstName} ${client.lastName}`,
      changes: { before: before.toObject(), after: client.toObject() },
      req
    });

    res.json({ success: true, data: client });
  } catch (err) {
    next(err);
  }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const activeMatters = await Matter.countDocuments({ client: client._id, status: { $ne: 'closed' } });
    if (activeMatters > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete client with active matters' });
    }

    client.isActive = false;
    await client.save();

    await logAudit({
      action: 'update',
      entityType: 'client',
      entityId: client._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Client deactivated: ${client.firstName} ${client.lastName}`,
      req
    });

    res.json({ success: true, message: 'Client deactivated' });
  } catch (err) {
    next(err);
  }
};

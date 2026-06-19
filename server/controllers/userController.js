const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

exports.getUsers = async (req, res, next) => {
  try {
    const filter = { role: { $ne: 'client' } };
    if (req.query.role) filter.role = req.query.role;
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';

    const users = await User.find(filter).sort('lastName firstName');

    if (req.hideBilling) {
      users.forEach(u => { u.billingRate = undefined; });
    }

    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.hideBilling) user.billingRate = undefined;

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    if (!req.user.permissions.canManageUsers && req.user.role !== 'attorney') {
      return res.status(403).json({ success: false, message: 'Not authorized to manage users' });
    }

    const before = await User.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'User not found' });

    const allowedFields = ['firstName', 'lastName', 'phone', 'barNumber', 'billingRate',
      'practiceAreas', 'isActive', 'role', 'permissions'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    await logAudit({
      action: 'update',
      entityType: 'user',
      entityId: user._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Updated user: ${user.firstName} ${user.lastName}`,
      changes: { before: before.toObject(), after: user.toObject() },
      req
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, phone, barNumber, billingRate, practiceAreas } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const permissions = {
      canViewBillingRates: role === 'attorney',
      canViewTrustDetails: role === 'attorney',
      canManageUsers: false,
      canAccessAllMatters: role === 'attorney'
    };

    const user = await User.create({
      firstName, lastName, email, password, role: role || 'staff',
      phone, barNumber, billingRate, practiceAreas, permissions
    });

    await logAudit({
      action: 'register',
      entityType: 'user',
      entityId: user._id,
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      details: `User registered with role: ${user.role}`,
      req
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save({ validateModifiedOnly: true });

    await logAudit({
      action: 'login',
      entityType: 'user',
      entityId: user._id,
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      details: 'User logged in',
      req
    });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const fields = ['firstName', 'lastName', 'phone', 'barNumber', 'practiceAreas'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

function sendTokenResponse(user, statusCode, res) {
  const token = user.getSignedJwtToken();
  const userData = user.toObject();
  delete userData.password;
  res.status(statusCode).json({ success: true, token, data: userData });
}

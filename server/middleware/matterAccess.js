const Matter = require('../models/Matter');

const checkMatterAccess = async (req, res, next) => {
  const matterId = req.params.matterId || req.params.id || req.body.matter;
  if (!matterId) return next();

  try {
    const matter = await Matter.findById(matterId);
    if (!matter) {
      return res.status(404).json({ success: false, message: 'Matter not found' });
    }

    if (req.user.role === 'client') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (req.user.permissions.canAccessAllMatters) {
      req.matter = matter;
      return next();
    }

    if (matter.isRestricted) {
      const isAuthorized =
        matter.responsibleAttorney.toString() === req.user._id.toString() ||
        matter.originatingAttorney?.toString() === req.user._id.toString() ||
        matter.authorizedUsers.some(u => u.toString() === req.user._id.toString());

      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You do not have access to this matter' });
      }
    }

    req.matter = matter;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkMatterAccess };

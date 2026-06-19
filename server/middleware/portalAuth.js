const Client = require('../models/Client');

const portalScope = async (req, res, next) => {
  if (req.user.role !== 'client') return next();

  if (!req.user.linkedClientId) {
    return res.status(403).json({ success: false, message: 'No client record linked to this portal account' });
  }

  const client = await Client.findById(req.user.linkedClientId);
  if (!client || !client.portalAccess) {
    return res.status(403).json({ success: false, message: 'Portal access not granted' });
  }

  req.portalClientId = req.user.linkedClientId;
  next();
};

const enforceClientScope = (entityClientField = 'client') => {
  return (req, res, next) => {
    if (req.user.role !== 'client') return next();
    if (!req.portalClientId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    req._clientScopeField = entityClientField;
    next();
  };
};

module.exports = { portalScope, enforceClientScope };

const Matter = require('../models/Matter');
const Client = require('../models/Client');
const FirmSettings = require('../models/FirmSettings');
const CustomField = require('../models/CustomField');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

async function buildCustomFieldSearch(search, appliesTo) {
  const defs = await CustomField.find({ appliesTo, isActive: true }).select('fieldKey');
  return defs.map(cf => ({ [`customFields.${cf.fieldKey}`]: { $regex: search, $options: 'i' } }));
}

exports.getMatters = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.client) filter.client = req.query.client;
    if (req.query.practiceArea) filter.practiceArea = req.query.practiceArea;
    if (req.query.responsibleAttorney) filter.responsibleAttorney = req.query.responsibleAttorney;
    if (req.query.search) {
      const cfConditions = await buildCustomFieldSearch(req.query.search, 'matter');
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { matterNumber: { $regex: req.query.search, $options: 'i' } },
        ...cfConditions
      ];
    }

    // Non-admin staff can only see unrestricted matters or matters they're authorized for
    if (req.user.role === 'staff' && !req.user.permissions.canAccessAllMatters) {
      filter.$or = filter.$or || [];
      filter.$and = [
        ...(filter.$or.length ? [{ $or: filter.$or }] : []),
        {
          $or: [
            { isRestricted: false },
            { responsibleAttorney: req.user._id },
            { authorizedUsers: req.user._id }
          ]
        }
      ];
      delete filter.$or;
    }

    const matters = await Matter.find(filter)
      .populate('client', 'firstName lastName company')
      .populate('responsibleAttorney', 'firstName lastName')
      .sort('-updatedAt');

    if (req.hideBilling) {
      matters.forEach(m => {
        m.billingRateOverride = undefined;
        m.totalBilledAmount = undefined;
        m.outstandingBalance = undefined;
        if (m.retainer) {
          m.retainer.amount = undefined;
          m.retainer.currentBalance = undefined;
        }
      });
    }

    res.json({ success: true, count: matters.length, data: matters });
  } catch (err) {
    next(err);
  }
};

exports.getMatter = async (req, res, next) => {
  try {
    const matter = await Matter.findById(req.params.id)
      .populate('client', 'firstName lastName email phone company')
      .populate('responsibleAttorney', 'firstName lastName email')
      .populate('originatingAttorney', 'firstName lastName')
      .populate('authorizedUsers', 'firstName lastName email');

    if (!matter) return res.status(404).json({ success: false, message: 'Matter not found' });

    res.json({ success: true, data: matter });
  } catch (err) {
    next(err);
  }
};

exports.createMatter = async (req, res, next) => {
  try {
    // Guard: client must exist (not a lead)
    const client = await Client.findById(req.body.client);
    if (!client) {
      return res.status(400).json({ success: false, message: 'Valid client required. Matters cannot be created against leads — convert the lead first.' });
    }

    const matterData = {
      ...req.body,
      responsibleAttorney: req.body.responsibleAttorney || req.user._id,
      originatingAttorney: req.body.originatingAttorney || req.user._id
    };

    const matter = await Matter.create(matterData);

    await addTimelineEntry({
      matter: matter._id,
      entryType: 'matter_created',
      title: 'Matter created',
      description: `Matter "${matter.name}" created for client ${client.firstName} ${client.lastName}`,
      createdBy: req.user._id
    });

    await logAudit({
      action: 'create',
      entityType: 'matter',
      entityId: matter._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Matter created: ${matter.name} (${matter.matterNumber})`,
      req
    });

    res.status(201).json({ success: true, data: matter });
  } catch (err) {
    next(err);
  }
};

exports.updateMatter = async (req, res, next) => {
  try {
    const before = await Matter.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Matter not found' });

    const matter = await Matter.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    if (req.body.status && req.body.status !== before.status) {
      await addTimelineEntry({
        matter: matter._id,
        entryType: 'status_change',
        title: `Status changed to ${matter.status}`,
        description: `Matter status changed from "${before.status}" to "${matter.status}"`,
        createdBy: req.user._id,
        metadata: { from: before.status, to: matter.status }
      });

      if (matter.status === 'closed' && !matter.closeDate) {
        matter.closeDate = new Date();
        await matter.save();
      }
    }

    await logAudit({
      action: req.body.status !== before.status ? 'status_change' : 'update',
      entityType: 'matter',
      entityId: matter._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Matter updated: ${matter.name}`,
      changes: { before: before.toObject(), after: matter.toObject() },
      req
    });

    res.json({ success: true, data: matter });
  } catch (err) {
    next(err);
  }
};

exports.grantAccess = async (req, res, next) => {
  try {
    const matter = await Matter.findById(req.params.id);
    if (!matter) return res.status(404).json({ success: false, message: 'Matter not found' });

    const { userId } = req.body;
    if (!matter.authorizedUsers.includes(userId)) {
      matter.authorizedUsers.push(userId);
      await matter.save();
    }

    await logAudit({
      action: 'matter_access_grant',
      entityType: 'matter',
      entityId: matter._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Access granted to user ${userId} on matter ${matter.name}`,
      req
    });

    res.json({ success: true, data: matter });
  } catch (err) {
    next(err);
  }
};

exports.revokeAccess = async (req, res, next) => {
  try {
    const matter = await Matter.findById(req.params.id);
    if (!matter) return res.status(404).json({ success: false, message: 'Matter not found' });

    const { userId } = req.body;
    matter.authorizedUsers = matter.authorizedUsers.filter(u => u.toString() !== userId);
    await matter.save();

    await logAudit({
      action: 'matter_access_revoke',
      entityType: 'matter',
      entityId: matter._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Access revoked for user ${userId} on matter ${matter.name}`,
      req
    });

    res.json({ success: true, data: matter });
  } catch (err) {
    next(err);
  }
};

exports.getMatterStatuses = async (req, res, next) => {
  try {
    let settings = await FirmSettings.findOne();
    if (!settings) {
      settings = await FirmSettings.create({});
    }
    res.json({ success: true, data: Object.fromEntries(settings.matterStatuses) });
  } catch (err) {
    next(err);
  }
};

const Lead = require('../models/Lead');
const Client = require('../models/Client');
const Matter = require('../models/Matter');
const User = require('../models/User');
const SignatureRequest = require('../models/SignatureRequest');
const CustomField = require('../models/CustomField');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');
const { runConflictCheck } = require('../utils/conflictCheck');

async function buildCustomFieldSearch(search, appliesTo) {
  const defs = await CustomField.find({ appliesTo, isActive: true }).select('fieldKey');
  return defs.map(cf => ({ [`customFields.${cf.fieldKey}`]: { $regex: search, $options: 'i' } }));
}

const VALID_TRANSITIONS = {
  new: ['contacted', 'declined', 'lost'],
  contacted: ['engagement_sent', 'declined', 'lost'],
  engagement_sent: ['converted', 'declined', 'lost'],
  converted: [],
  declined: [],
  lost: ['new']
};

exports.createLead = async (req, res, next) => {
  try {
    const leadData = { ...req.body };
    if (req.user) {
      leadData.assignedTo = leadData.assignedTo || req.user._id;
    }

    let conflictResult = { hasConflict: false, conflictDetails: [] };
    if (leadData.opposingPartyName) {
      conflictResult = await runConflictCheck(leadData.opposingPartyName);
    }
    leadData.conflictCheckResult = {
      ...conflictResult,
      checkedAt: new Date(),
      checkedBy: req.user?._id
    };

    const lead = await Lead.create(leadData);

    if (req.user) {
      await logAudit({
        action: 'create',
        entityType: 'lead',
        entityId: lead._id,
        userId: req.user._id,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        details: `Lead created: ${lead.firstName} ${lead.lastName}`,
        req
      });
    }

    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

exports.getLeads = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.practiceArea) filter.practiceArea = req.query.practiceArea;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.search) {
      const cfConditions = await buildCustomFieldSearch(req.query.search, 'lead');
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        ...cfConditions
      ];
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    next(err);
  }
};

exports.getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('convertedClientId')
      .populate('convertedMatterId');
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const before = await Lead.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (before.status === 'converted') {
      return res.status(400).json({ success: false, message: 'Cannot modify a converted lead' });
    }

    const { status, ...updates } = req.body;
    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    await logAudit({
      action: 'update',
      entityType: 'lead',
      entityId: lead._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Lead updated: ${lead.firstName} ${lead.lastName}`,
      changes: { before: before.toObject(), after: lead.toObject() },
      req
    });

    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

exports.updateLeadStatus = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const { status, reason } = req.body;
    const allowed = VALID_TRANSITIONS[lead.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${lead.status}' to '${status}'`
      });
    }

    if (status === 'converted') {
      return res.status(400).json({
        success: false,
        message: 'Lead conversion can only happen via engagement letter signature. Use POST /api/leads/:id/convert'
      });
    }

    const oldStatus = lead.status;
    lead.status = status;
    if (status === 'declined') lead.declinedReason = reason;
    if (status === 'lost') lead.lostReason = reason;
    await lead.save();

    await logAudit({
      action: 'status_change',
      entityType: 'lead',
      entityId: lead._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Lead status changed from ${oldStatus} to ${status}`,
      changes: { before: { status: oldStatus }, after: { status } },
      req
    });

    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

exports.convertLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.status !== 'engagement_sent') {
      return res.status(400).json({
        success: false,
        message: 'Lead must be in "engagement_sent" status to convert. Engagement letter must be signed first.'
      });
    }

    // Spec §1.3: conversion requires e-signature OR attorney explicitly marks as signed externally
    const completedSig = await SignatureRequest.findOne({ leadId: lead._id, status: 'completed' });
    if (!completedSig && !req.body.confirmedExternalSignature) {
      return res.status(400).json({
        success: false,
        message: 'Conversion requires a completed e-signature, or pass confirmedExternalSignature: true if the engagement letter was signed outside the system.'
      });
    }

    const client = await Client.create({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      practiceArea: lead.practiceArea,
      portalAccess: true,
      originLeadId: lead._id,
      assignedAttorney: lead.assignedTo,
      customFields: lead.customFields
    });

    const matter = await Matter.create({
      name: `${lead.firstName} ${lead.lastName} — ${lead.practiceArea}`,
      client: client._id,
      leadId: lead._id,
      practiceArea: lead.practiceArea,
      status: 'open',
      responsibleAttorney: lead.assignedTo || req.user._id,
      originatingAttorney: req.user._id,
      description: lead.caseDescription,
      opposingParty: lead.opposingPartyName,
      opposingCounsel: lead.opposingPartyAttorney,
      openDate: new Date()
    });

    lead.status = 'converted';
    lead.convertedClientId = client._id;
    lead.convertedMatterId = matter._id;
    lead.convertedAt = new Date();
    lead.engagementLetterSignedAt = new Date();
    await lead.save();

    // Create portal user for client
    const portalPassword = require('crypto').randomBytes(16).toString('hex');
    const portalUser = await User.create({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      password: portalPassword,
      role: 'client',
      linkedClientId: client._id
    });
    client.portalUserId = portalUser._id;
    await client.save();

    await addTimelineEntry({
      matter: matter._id,
      entryType: 'matter_created',
      title: 'Matter created from lead conversion',
      description: `Converted from lead: ${lead.firstName} ${lead.lastName}`,
      referenceType: 'lead',
      referenceId: lead._id,
      createdBy: req.user._id
    });

    await logAudit({
      action: 'lead_convert',
      entityType: 'lead',
      entityId: lead._id,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Lead converted to Client (${client._id}) and Matter (${matter._id})`,
      req
    });

    res.json({
      success: true,
      data: { lead, client, matter },
      message: 'Lead converted successfully'
    });
  } catch (err) {
    next(err);
  }
};

exports.conflictCheck = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const result = await runConflictCheck(name);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const FixedCharge = require('../models/FixedCharge');
const Matter = require('../models/Matter');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

exports.getFixedCharges = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.isBilled !== undefined) filter.isBilled = req.query.isBilled === 'true';
    if (req.query.isBillable !== undefined) filter.isBillable = req.query.isBillable === 'true';

    const charges = await FixedCharge.find(filter)
      .populate('matter', 'name matterNumber')
      .populate('user', 'firstName lastName')
      .sort('-date');

    const data = charges.map(c => {
      const obj = c.toObject();
      if (req.hideBilling) delete obj.amount;
      return obj;
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

exports.createFixedCharge = async (req, res, next) => {
  try {
    const matter = await Matter.findById(req.body.matter).populate('client');
    if (!matter) return res.status(400).json({ success: false, message: 'Valid matter required' });
    if (!matter.client) return res.status(400).json({ success: false, message: 'Matter must be linked to a converted client' });

    const charge = await FixedCharge.create({
      matter: req.body.matter,
      user: req.user._id,
      date: req.body.date || new Date(),
      amount: req.body.amount,
      clientDescription: req.body.clientDescription,
      internalNote: req.body.internalNote || '',
      isBillable: req.body.isBillable !== false,
      isBilled: false
    });

    await addTimelineEntry({
      matter: charge.matter,
      entryType: 'fixed_charge',
      title: `Fixed charge: $${charge.amount.toFixed(2)}${charge.isBillable ? '' : ' (non-billable)'}`,
      description: charge.clientDescription,
      referenceType: 'fixed_charge',
      referenceId: charge._id,
      createdBy: req.user._id
    });

    matter.lastActivityDate = new Date();
    await matter.save();

    await logAudit({
      action: 'create', entityType: 'fixed_charge', entityId: charge._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Fixed charge $${charge.amount} on ${matter.name}${charge.isBillable ? '' : ' (non-billable)'}`, req
    });

    const populated = await FixedCharge.findById(charge._id)
      .populate('matter', 'name matterNumber')
      .populate('user', 'firstName lastName');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

exports.updateFixedCharge = async (req, res, next) => {
  try {
    const charge = await FixedCharge.findById(req.params.id);
    if (!charge) return res.status(404).json({ success: false, message: 'Fixed charge not found' });
    if (charge.isBilled) return res.status(400).json({ success: false, message: 'Cannot edit a billed charge' });

    const allowed = ['clientDescription', 'internalNote', 'amount', 'date', 'isBillable'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const updated = await FixedCharge.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('matter', 'name matterNumber')
      .populate('user', 'firstName lastName');

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteFixedCharge = async (req, res, next) => {
  try {
    const charge = await FixedCharge.findById(req.params.id);
    if (!charge) return res.status(404).json({ success: false, message: 'Fixed charge not found' });
    if (charge.isBilled) return res.status(400).json({ success: false, message: 'Cannot delete a billed charge' });

    await FixedCharge.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Fixed charge deleted' });
  } catch (err) {
    next(err);
  }
};

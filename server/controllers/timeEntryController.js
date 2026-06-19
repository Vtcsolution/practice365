const TimeEntry = require('../models/TimeEntry');
const Matter = require('../models/Matter');
const { resolveRate, isChargeableTime } = require('../utils/rateResolver');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

// In-memory concurrent timer store. Key: `${userId}:${matterId}`
// Value: { matterId, startedAt, description }
// Survives server restarts only via the timerStartedAt stored on the draft entry.
const activeSessions = new Map();

exports.discardTimer = (req, res) => {
  const { matterId } = req.body;
  if (!matterId) return res.status(400).json({ success: false, message: 'matterId required' });
  const key = `${req.user._id}:${matterId}`;
  activeSessions.delete(key);
  res.json({ success: true, message: 'Timer discarded' });
};

exports.startTimer = async (req, res, next) => {
  try {
    const { matterId, description } = req.body;
    if (!matterId) return res.status(400).json({ success: false, message: 'matterId required' });

    const matter = await Matter.findById(matterId).populate('client');
    if (!matter) return res.status(400).json({ success: false, message: 'Matter not found' });
    if (!matter.client) return res.status(400).json({ success: false, message: 'Matter must be linked to a converted client' });

    const key = `${req.user._id}:${matterId}`;
    if (activeSessions.has(key)) {
      return res.status(400).json({ success: false, message: 'A timer is already running for this matter. Stop it before starting another.' });
    }

    const startedAt = new Date();
    activeSessions.set(key, { matterId, startedAt, description: description || '' });

    res.json({ success: true, data: { matterId, startedAt, description: description || '' } });
  } catch (err) {
    next(err);
  }
};

exports.stopTimer = async (req, res, next) => {
  try {
    const { matterId } = req.body;
    if (!matterId) return res.status(400).json({ success: false, message: 'matterId required' });

    const key = `${req.user._id}:${matterId}`;
    const session = activeSessions.get(key);
    if (!session) return res.status(400).json({ success: false, message: 'No active timer for this matter' });

    const stoppedAt = req.body.stoppedAt ? new Date(req.body.stoppedAt) : new Date();
    const durationMinutes = Math.round((stoppedAt - session.startedAt) / 60000);
    activeSessions.delete(key);

    if (durationMinutes < 1) {
      return res.json({ success: true, message: 'Timer stopped (under 1 minute — no entry created)', data: null });
    }

    const matter = await Matter.findById(matterId).populate('client');
    const rate = await resolveRate(req.user._id, matterId);
    const chargeable = isChargeableTime(matter);
    const lineAmount = chargeable ? Math.round(rate * (durationMinutes / 60) * 100) / 100 : 0;

    const clientDescription = req.body.clientDescription || session.description || 'Timer entry';
    const entry = await TimeEntry.create({
      matter: matterId, user: req.user._id, date: session.startedAt,
      durationMinutes, clientDescription,
      internalNote: req.body.internalNote || '',
      billingRate: rate, lineAmount,
      isBillable: matter.billingType !== 'pro_bono', isBilled: false,
      entryMethod: 'timer', timerStartedAt: session.startedAt, timerStoppedAt: stoppedAt
    });

    await addTimelineEntry({
      matter: matterId, entryType: 'time_entry',
      title: `Timer stopped: ${durationMinutes} min @ $${rate}/hr`,
      description: clientDescription,
      referenceType: 'time_entry', referenceId: entry._id,
      createdBy: req.user._id,
      metadata: { minutes: durationMinutes, rate, amount: lineAmount, chargeable }
    });

    matter.lastActivityDate = new Date();
    matter.totalBilledHours = (matter.totalBilledHours || 0) + durationMinutes / 60;
    await matter.save();

    await logAudit({
      action: 'time_entry_create', entityType: 'time_entry', entityId: entry._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Timer entry: ${durationMinutes} min on ${matter.name} @ $${rate}/hr = $${lineAmount}`, req
    });

    const populated = await TimeEntry.findById(entry._id)
      .populate('matter', 'name matterNumber billingType')
      .populate('user', 'firstName lastName');

    res.json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

exports.getActiveTimers = (req, res) => {
  const userId = req.user._id.toString();
  const timers = [];
  for (const [key, session] of activeSessions.entries()) {
    if (key.startsWith(`${userId}:`)) {
      timers.push({
        matterId: session.matterId,
        startedAt: session.startedAt,
        description: session.description,
        elapsedMinutes: Math.round((Date.now() - session.startedAt) / 60000)
      });
    }
  }
  res.json({ success: true, count: timers.length, data: timers });
};

exports.getTimeEntries = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.user) filter.user = req.query.user;
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }
    if (req.query.isBilled !== undefined) filter.isBilled = req.query.isBilled === 'true';
    if (req.query.isBillable !== undefined) filter.isBillable = req.query.isBillable === 'true';

    const entries = await TimeEntry.find(filter)
      .populate('matter', 'name matterNumber billingType')
      .populate('user', 'firstName lastName')
      .sort('-date');

    // Strip internal notes if staff without billing access
    const data = entries.map(e => {
      const obj = e.toObject();
      if (req.hideBilling) {
        delete obj.billingRate;
        delete obj.lineAmount;
      }
      return obj;
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

exports.createTimeEntry = async (req, res, next) => {
  try {
    const matter = await Matter.findById(req.body.matter).populate('client');
    if (!matter) return res.status(400).json({ success: false, message: 'Valid matter required' });
    if (!matter.client) return res.status(400).json({ success: false, message: 'Matter must be linked to a converted client' });

    // Resolve rate at creation time — locked to this entry, never retroactive
    const rate = await resolveRate(req.user._id, req.body.matter);
    const durationHours = req.body.durationMinutes / 60;

    // Flat-fee/contingency: time logs for tracking but generates $0 charge
    const chargeable = isChargeableTime(matter);
    const lineAmount = chargeable ? Math.round(rate * durationHours * 100) / 100 : 0;

    const entry = await TimeEntry.create({
      matter: req.body.matter,
      user: req.user._id,
      date: req.body.date || new Date(),
      durationMinutes: req.body.durationMinutes,
      clientDescription: req.body.clientDescription,
      internalNote: req.body.internalNote || '',
      billingRate: rate,
      lineAmount,
      isBillable: matter.billingType !== 'pro_bono',
      isBilled: false,
      entryMethod: req.body.entryMethod || 'manual',
      timerStartedAt: req.body.timerStartedAt,
      timerStoppedAt: req.body.timerStoppedAt
    });

    await addTimelineEntry({
      matter: entry.matter,
      entryType: 'time_entry',
      title: `Time logged: ${req.body.durationMinutes} min @ $${rate}/hr`,
      description: entry.clientDescription,
      referenceType: 'time_entry',
      referenceId: entry._id,
      createdBy: req.user._id,
      metadata: { minutes: entry.durationMinutes, rate, amount: lineAmount, chargeable }
    });

    matter.lastActivityDate = new Date();
    matter.totalBilledHours = (matter.totalBilledHours || 0) + durationHours;
    await matter.save();

    await logAudit({
      action: 'time_entry_create', entityType: 'time_entry', entityId: entry._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `${entry.durationMinutes} min on ${matter.name} @ $${rate}/hr = $${lineAmount}`, req
    });

    const populated = await TimeEntry.findById(entry._id)
      .populate('matter', 'name matterNumber billingType')
      .populate('user', 'firstName lastName');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

exports.updateTimeEntry = async (req, res, next) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Time entry not found' });
    if (entry.isBilled) return res.status(400).json({ success: false, message: 'Cannot edit a billed time entry' });

    const updates = {};
    if (req.body.clientDescription !== undefined) updates.clientDescription = req.body.clientDescription;
    if (req.body.internalNote !== undefined) updates.internalNote = req.body.internalNote;
    if (req.body.date !== undefined) updates.date = req.body.date;

    // If duration changes, recalculate line amount using the ORIGINAL rate (locked at creation)
    if (req.body.durationMinutes !== undefined) {
      updates.durationMinutes = req.body.durationMinutes;
      const matter = await Matter.findById(entry.matter);
      const chargeable = isChargeableTime(matter);
      updates.lineAmount = chargeable
        ? Math.round(entry.billingRate * (req.body.durationMinutes / 60) * 100) / 100
        : 0;
    }

    const updated = await TimeEntry.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('matter', 'name matterNumber billingType')
      .populate('user', 'firstName lastName');

    await logAudit({
      action: 'time_entry_update', entityType: 'time_entry', entityId: updated._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: 'Time entry updated', req
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteTimeEntry = async (req, res, next) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Time entry not found' });
    if (entry.isBilled) return res.status(400).json({ success: false, message: 'Cannot delete a billed time entry' });

    await TimeEntry.findByIdAndDelete(req.params.id);

    await logAudit({
      action: 'delete', entityType: 'time_entry', entityId: entry._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Time entry deleted: ${entry.durationMinutes} min`, req
    });

    res.json({ success: true, message: 'Time entry deleted' });
  } catch (err) {
    next(err);
  }
};

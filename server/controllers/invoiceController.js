const Invoice = require('../models/Invoice');
const TimeEntry = require('../models/TimeEntry');
const FixedCharge = require('../models/FixedCharge');
const Matter = require('../models/Matter');
const FirmSettings = require('../models/FirmSettings');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

/**
 * Server-side enforcement: Internal Notes NEVER appear in invoice responses.
 * This is enforced in the payload, not just hidden in UI.
 */
function sanitizeInvoice(invoice) {
  const obj = typeof invoice.toObject === 'function' ? invoice.toObject() : { ...invoice };
  if (obj.lineItems) {
    obj.lineItems = obj.lineItems.map(li => {
      const { internalNote, ...safe } = li;
      return safe;
    });
  }
  return obj;
}

exports.getInvoices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.client) filter.client = req.query.client;
    if (req.query.overdue === 'true') {
      filter.status = { $in: ['sent', 'partially_paid'] };
      filter.dueDate = { $lt: new Date() };
    }

    const invoices = await Invoice.find(filter)
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt');

    const data = invoices.map(sanitizeInvoice);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('matter', 'name matterNumber practiceArea')
      .populate('client', 'firstName lastName email phone address company');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    res.json({ success: true, data: sanitizeInvoice(invoice) });
  } catch (err) {
    next(err);
  }
};

exports.generateInvoice = async (req, res, next) => {
  try {
    const { matterId, periodStart, periodEnd, dueDate } = req.body;
    const matter = await Matter.findById(matterId).populate('client');
    if (!matter) return res.status(400).json({ success: false, message: 'Matter not found' });
    if (!matter.client) return res.status(400).json({ success: false, message: 'Matter has no client' });

    const dateFilter = {};
    if (periodStart) dateFilter.$gte = new Date(periodStart);
    if (periodEnd) dateFilter.$lte = new Date(periodEnd);
    const dateQuery = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const timeEntries = await TimeEntry.find({
      matter: matterId, isBilled: false, isBillable: true, ...dateQuery
    }).sort('date');

    const fixedCharges = await FixedCharge.find({
      matter: matterId, isBilled: false, isBillable: true, ...dateQuery
    }).sort('date');

    if (timeEntries.length === 0 && fixedCharges.length === 0) {
      return res.status(400).json({ success: false, message: 'No unbilled entries found for this period' });
    }

    const lineItems = [];

    // Time entries: show Client-Facing Description, date, duration, rate, total
    // Internal Notes NEVER included
    timeEntries.forEach(te => {
      lineItems.push({
        type: 'time_entry',
        referenceId: te._id,
        date: te.date,
        description: te.clientDescription,
        quantity: Math.round((te.durationMinutes / 60) * 100) / 100,
        rate: te.billingRate,
        amount: te.lineAmount
      });
    });

    // Fixed charges: show Client-Facing Description, date, amount
    fixedCharges.forEach(fc => {
      lineItems.push({
        type: 'fixed_charge',
        referenceId: fc._id,
        date: fc.date,
        description: fc.clientDescription,
        amount: fc.amount
      });
    });

    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

    let settings = await FirmSettings.findOne();
    if (!settings) settings = await FirmSettings.create({});
    const invoiceNumber = `${settings.invoicePrefix}-${settings.nextInvoiceNumber}`;
    settings.nextInvoiceNumber += 1;
    await settings.save();

    const invoice = await Invoice.create({
      invoiceNumber,
      matter: matterId,
      client: matter.client._id,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      lineItems,
      subtotal,
      total: subtotal,
      balanceDue: subtotal,
      createdBy: req.user._id
    });

    // Mark source entries as billed
    await TimeEntry.updateMany(
      { _id: { $in: timeEntries.map(te => te._id) } },
      { isBilled: true, invoiceId: invoice._id }
    );
    await FixedCharge.updateMany(
      { _id: { $in: fixedCharges.map(fc => fc._id) } },
      { isBilled: true, invoiceId: invoice._id }
    );

    await addTimelineEntry({
      matter: matterId, entryType: 'invoice_created',
      title: `Invoice ${invoiceNumber} created — $${subtotal.toFixed(2)}`,
      description: `Draft invoice with ${lineItems.length} line items`,
      referenceType: 'invoice', referenceId: invoice._id, createdBy: req.user._id
    });

    matter.outstandingBalance = (matter.outstandingBalance || 0) + subtotal;
    matter.lastActivityDate = new Date();
    await matter.save();

    await logAudit({
      action: 'invoice_create', entityType: 'invoice', entityId: invoice._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Invoice ${invoiceNumber}: $${subtotal.toFixed(2)} (${timeEntries.length} time + ${fixedCharges.length} charges)`, req
    });

    res.status(201).json({ success: true, data: sanitizeInvoice(invoice) });
  } catch (err) {
    next(err);
  }
};

exports.updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Finalized invoices cannot be edited. Use a credit/adjustment entry instead.'
      });
    }

    const allowed = ['dueDate', 'notes', 'lineItems', 'adjustments'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.lineItems) {
      const subtotal = updates.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
      updates.subtotal = subtotal;
      updates.total = subtotal + (updates.adjustments || invoice.adjustments || 0);
      updates.balanceDue = updates.total - (invoice.amountPaid || 0);
    }
    if (updates.adjustments !== undefined) {
      updates.total = (invoice.subtotal || 0) + updates.adjustments;
      updates.balanceDue = updates.total - (invoice.amountPaid || 0);
    }

    const updated = await Invoice.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: sanitizeInvoice(updated) });
  } catch (err) {
    next(err);
  }
};

exports.finalizeInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.isFinalized) return res.status(400).json({ success: false, message: 'Already finalized' });
    if (invoice.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft invoices can be finalized' });

    invoice.isFinalized = true;
    invoice.finalizedAt = new Date();
    invoice.finalizedBy = req.user._id;
    invoice.status = 'sent';
    invoice.sentAt = new Date();
    invoice.sentBy = req.user._id;
    await invoice.save();

    await addTimelineEntry({
      matter: invoice.matter, entryType: 'invoice_sent',
      title: `Invoice ${invoice.invoiceNumber} finalized & sent`,
      referenceType: 'invoice', referenceId: invoice._id, createdBy: req.user._id
    });

    await logAudit({
      action: 'invoice_finalize', entityType: 'invoice', entityId: invoice._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Invoice ${invoice.invoiceNumber} finalized — $${invoice.total.toFixed(2)}`, req
    });

    res.json({ success: true, data: sanitizeInvoice(invoice) });
  } catch (err) {
    next(err);
  }
};

exports.addAdjustment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (!invoice.isFinalized) return res.status(400).json({ success: false, message: 'Adjustments only apply to finalized invoices' });

    const { type, description, amount } = req.body;
    if (!description || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Description and amount required' });
    }

    invoice.lineItems.push({
      type: type || 'adjustment',
      date: new Date(),
      description,
      amount: amount
    });

    invoice.adjustments = (invoice.adjustments || 0) + amount;
    invoice.total = invoice.subtotal + invoice.adjustments;
    invoice.balanceDue = invoice.total - invoice.amountPaid;
    await invoice.save();

    await logAudit({
      action: 'update', entityType: 'invoice', entityId: invoice._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Adjustment added to ${invoice.invoiceNumber}: $${amount} — ${description}`, req
    });

    res.json({ success: true, data: sanitizeInvoice(invoice) });
  } catch (err) {
    next(err);
  }
};

exports.getOverdueInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({
      status: { $in: ['sent', 'partially_paid'] },
      dueDate: { $lt: new Date() }
    })
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .sort('dueDate');

    res.json({ success: true, count: invoices.length, data: invoices.map(sanitizeInvoice) });
  } catch (err) {
    next(err);
  }
};

exports.voidInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Cannot void a paid invoice' });

    // Un-bill the source entries so they can be re-invoiced
    await TimeEntry.updateMany({ invoiceId: invoice._id }, { isBilled: false, $unset: { invoiceId: 1 } });
    await FixedCharge.updateMany({ invoiceId: invoice._id }, { isBilled: false, $unset: { invoiceId: 1 } });

    invoice.status = 'void';
    await invoice.save();

    const matter = await Matter.findById(invoice.matter);
    if (matter) {
      matter.outstandingBalance = Math.max(0, (matter.outstandingBalance || 0) - invoice.balanceDue);
      await matter.save();
    }

    await logAudit({
      action: 'invoice_void', entityType: 'invoice', entityId: invoice._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Invoice ${invoice.invoiceNumber} voided`, req
    });

    res.json({ success: true, data: sanitizeInvoice(invoice) });
  } catch (err) {
    next(err);
  }
};

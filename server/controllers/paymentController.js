const Invoice = require('../models/Invoice');
const Matter = require('../models/Matter');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');
const { sendPaymentReceipt, sendPaymentFailedNotification } = require('../utils/emailService');

let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('000000')) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {}

exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const invoice = await Invoice.findById(invoiceId)
      .populate('client', 'firstName lastName email')
      .populate('matter', 'name');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'draft') return res.status(400).json({ success: false, message: 'Draft invoices are not visible to clients' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Invoice already paid' });
    if (invoice.balanceDue <= 0) return res.status(400).json({ success: false, message: 'No balance due' });

    // Portal client scope check
    if (req.user.role === 'client') {
      if (invoice.client._id.toString() !== req.portalClientId?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    if (stripe) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(invoice.balanceDue * 100),
        currency: 'usd',
        metadata: {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          clientName: `${invoice.client.firstName} ${invoice.client.lastName}`
        }
      });

      return res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          amount: invoice.balanceDue,
          invoiceNumber: invoice.invoiceNumber
        }
      });
    }

    // Test mode fallback — simulate payment intent
    const fakeClientSecret = `pi_test_${Date.now()}_secret_${Math.random().toString(36).slice(2)}`;
    res.json({
      success: true,
      data: {
        clientSecret: fakeClientSecret,
        amount: invoice.balanceDue,
        invoiceNumber: invoice.invoiceNumber,
        testMode: true
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.confirmPayment = async (req, res, next) => {
  try {
    const { invoiceId, paymentIntentId, amount } = req.body;
    const invoice = await Invoice.findById(invoiceId)
      .populate('client', 'firstName lastName email')
      .populate('matter', 'name');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const paymentAmount = amount || invoice.balanceDue;

    invoice.payments.push({
      amount: paymentAmount,
      date: new Date(),
      method: 'stripe',
      stripePaymentIntentId: paymentIntentId || `pi_test_${Date.now()}`,
      reference: `Payment via Stripe`
    });

    invoice.amountPaid = (invoice.amountPaid || 0) + paymentAmount;
    invoice.balanceDue = invoice.total - invoice.amountPaid;

    if (invoice.balanceDue <= 0) {
      invoice.status = 'paid';
      invoice.balanceDue = 0;
    } else {
      invoice.status = 'partially_paid';
    }
    await invoice.save();

    // Update matter outstanding balance
    const matter = await Matter.findById(invoice.matter);
    if (matter) {
      matter.outstandingBalance = Math.max(0, (matter.outstandingBalance || 0) - paymentAmount);

      // Auto-update retainer if tagged as retainer payment (Section 1.5)
      if (req.body.isRetainerPayment && matter.retainer) {
        matter.retainer.currentBalance = (matter.retainer.currentBalance || 0) + paymentAmount;
        matter.retainer.amountCollected = (matter.retainer.amountCollected || 0) + paymentAmount;
        matter.retainer.collected = true;
        matter.retainer.collectedDate = new Date();
        matter.retainer.lastReplenishedAt = new Date();
        matter.retainer.payments.push({
          amount: paymentAmount, date: new Date(),
          method: 'stripe', reference: paymentIntentId
        });
      }
      await matter.save();
    }

    await addTimelineEntry({
      matter: invoice.matter._id || invoice.matter,
      entryType: 'payment_received',
      title: `Payment received: $${paymentAmount.toFixed(2)}`,
      description: `${invoice.invoiceNumber} — ${invoice.status === 'paid' ? 'Paid in full' : 'Partial payment'}`,
      referenceType: 'invoice', referenceId: invoice._id,
      createdBy: req.user._id,
      metadata: { amount: paymentAmount, method: 'stripe' }
    });

    await logAudit({
      action: 'payment_received', entityType: 'invoice', entityId: invoice._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `$${paymentAmount.toFixed(2)} payment on ${invoice.invoiceNumber}`, req
    });

    await sendPaymentReceipt({
      recipientEmail: invoice.client.email,
      invoiceNumber: invoice.invoiceNumber,
      amount: paymentAmount,
      matterName: invoice.matter.name || 'N/A'
    });

    res.json({ success: true, data: invoice, message: invoice.status === 'paid' ? 'Invoice paid in full' : 'Partial payment recorded' });
  } catch (err) {
    next(err);
  }
};

exports.handlePaymentFailure = async (req, res, next) => {
  try {
    const { invoiceId, reason } = req.body;
    const invoice = await Invoice.findById(invoiceId)
      .populate('client', 'firstName lastName email')
      .populate('matter', 'name responsibleAttorney');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (invoice.status === 'partially_paid') {
      invoice.status = 'sent';
    }
    await invoice.save();

    await logAudit({
      action: 'payment_failed', entityType: 'invoice', entityId: invoice._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Payment failed on ${invoice.invoiceNumber}: ${reason}`, req
    });

    // Notify attorney
    if (invoice.matter?.responsibleAttorney) {
      const attorney = await require('../models/User').findById(invoice.matter.responsibleAttorney);
      if (attorney) {
        await sendPaymentFailedNotification({
          attorneyEmail: attorney.email,
          clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.balanceDue,
          reason: reason || 'Unknown error'
        });
      }
    }

    res.json({ success: true, message: 'Payment failure recorded and attorney notified' });
  } catch (err) {
    next(err);
  }
};

exports.getStripeConfig = async (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      testMode: !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('000000')
    }
  });
};

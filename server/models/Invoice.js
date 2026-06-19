const mongoose = require('mongoose');

const invoiceLineItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['time_entry', 'fixed_charge', 'adjustment', 'credit'],
    required: true
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  date: { type: Date, required: true },
  description: { type: String, required: true },
  quantity: { type: Number },
  rate: { type: Number },
  amount: { type: Number, required: true }
}, { _id: true });

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  method: {
    type: String,
    enum: ['stripe', 'check', 'wire', 'cash', 'other'],
    default: 'stripe'
  },
  stripePaymentIntentId: String,
  reference: String,
  notes: String
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true, required: true },
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'void'],
    default: 'draft'
  },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  periodStart: { type: Date },
  periodEnd: { type: Date },
  lineItems: [invoiceLineItemSchema],
  subtotal: { type: Number, default: 0 },
  adjustments: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  payments: [paymentSchema],
  isFinalized: { type: Boolean, default: false },
  finalizedAt: Date,
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: Date,
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

invoiceSchema.index({ matter: 1, status: 1 });
invoiceSchema.index({ client: 1, status: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);

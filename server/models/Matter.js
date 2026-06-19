const mongoose = require('mongoose');

const retainerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['evergreen', 'replenishing', 'fixed', 'none'],
    default: 'none'
  },
  amount: { type: Number, default: 0 },
  collected: { type: Boolean, default: false },
  collectedDate: Date,
  amountCollected: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  minimumBalance: { type: Number, default: 0 },
  replenishThreshold: { type: Number, default: 0 },
  replenishAmount: { type: Number, default: 0 },
  lastReplenishedAt: Date,
  payments: [{
    amount: Number,
    date: Date,
    method: String,
    reference: String
  }]
}, { _id: false });

const matterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  matterNumber: { type: String, unique: true, trim: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  additionalClients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }],
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  practiceArea: { type: String, required: true, trim: true },
  status: {
    type: String,
    default: 'open'
  },
  customStatus: { type: String, trim: true },
  description: { type: String },
  openDate: { type: Date, default: Date.now },
  closeDate: Date,
  statuteOfLimitations: Date,
  responsibleAttorney: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originatingAttorney: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorizedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  billingType: {
    type: String,
    enum: ['hourly', 'flat_fee', 'contingency', 'pro_bono'],
    default: 'hourly'
  },
  flatFeeAmount: { type: Number },
  contingencyPercentage: { type: Number },
  billingRateOverride: { type: Number },
  retainer: { type: retainerSchema, default: () => ({}) },
  opposingParty: { type: String, trim: true },
  opposingCounsel: { type: String, trim: true },
  courtName: { type: String, trim: true },
  caseNumber: { type: String, trim: true },
  judge: { type: String, trim: true },
  isRestricted: { type: Boolean, default: false },
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed },
  // Summary fields — auto-updated from timeline events
  lastActivityDate: Date,
  nextDeadline: Date,
  lastClientContactDate: Date,
  totalBilledHours: { type: Number, default: 0 },
  totalBilledAmount: { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 }
}, { timestamps: true });

matterSchema.pre('save', async function(next) {
  if (!this.matterNumber) {
    const count = await mongoose.model('Matter').countDocuments();
    this.matterNumber = `MAT-${String(count + 1001).padStart(5, '0')}`;
  }
  next();
});

matterSchema.index({ client: 1 });
matterSchema.index({ status: 1 });
matterSchema.index({ responsibleAttorney: 1 });
matterSchema.index({ name: 'text', matterNumber: 'text' });

module.exports = mongoose.model('Matter', matterSchema);

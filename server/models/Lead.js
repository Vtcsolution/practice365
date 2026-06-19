const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'phone', 'walk-in', 'advertisement', 'other'],
    default: 'website'
  },
  referralSource: { type: String, trim: true },
  practiceArea: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['new', 'contacted', 'engagement_sent', 'converted', 'declined', 'lost'],
    default: 'new'
  },
  opposingPartyName: { type: String, trim: true },
  opposingPartyAttorney: { type: String, trim: true },
  conflictCheckResult: {
    hasConflict: { type: Boolean, default: false },
    conflictDetails: [{ type: String }],
    checkedAt: Date,
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  caseDescription: { type: String },
  intakeNotes: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  convertedClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  convertedMatterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter' },
  convertedAt: Date,
  declinedReason: { type: String },
  lostReason: { type: String },
  engagementLetterSent: { type: Boolean, default: false },
  engagementLetterSignedAt: Date,
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed },
  intakeFormData: { type: Map, of: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

leadSchema.index({ status: 1 });
leadSchema.index({ opposingPartyName: 'text', firstName: 'text', lastName: 'text' });
leadSchema.index({ email: 1 });

module.exports = mongoose.model('Lead', leadSchema);

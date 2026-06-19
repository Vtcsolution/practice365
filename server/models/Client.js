const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
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
  company: { type: String, trim: true },
  clientType: {
    type: String,
    enum: ['individual', 'business'],
    default: 'individual'
  },
  portalAccess: { type: Boolean, default: false },
  portalUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  originLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  practiceArea: { type: String, trim: true },
  assignedAttorney: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

clientSchema.index({ email: 1 });
clientSchema.index({ firstName: 'text', lastName: 'text', company: 'text' });

module.exports = mongoose.model('Client', clientSchema);

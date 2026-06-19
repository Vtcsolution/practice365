const mongoose = require('mongoose');

const firmSettingsSchema = new mongoose.Schema({
  firmName: { type: String, default: 'Practice365 Law Firm' },
  logoUrl: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  defaultBillingRate: { type: Number, default: 250 },
  practiceAreas: [{ type: String }],
  matterStatuses: {
    type: Map,
    of: [String],
    default: {
      default: ['open', 'pending', 'closed'],
      litigation: ['open', 'discovery', 'trial', 'appeal', 'settled', 'closed'],
      estate_planning: ['open', 'drafting', 'review', 'executed', 'closed'],
      real_estate: ['open', 'due_diligence', 'closing', 'closed'],
      business: ['open', 'formation', 'compliance', 'closed']
    }
  },
  invoicePrefix: { type: String, default: 'INV' },
  nextInvoiceNumber: { type: Number, default: 1001 },
  inactivityAlertDays: { type: Number, default: 14 },
  brandColors: {
    primary: { type: String, default: '#2e5cff' },
    secondary: { type: String, default: '#0b1d3a' }
  }
}, { timestamps: true });

module.exports = mongoose.model('FirmSettings', firmSettingsSchema);

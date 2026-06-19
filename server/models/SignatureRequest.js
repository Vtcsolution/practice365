const mongoose = require('mongoose');

const signatureRequestSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter', required: true },
  signerName: { type: String, required: true },
  signerEmail: { type: String, required: true, lowercase: true },
  token: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'opened', 'completed', 'declined', 'expired'],
    default: 'pending'
  },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sentAt: { type: Date, default: Date.now },
  completedAt: Date,
  signedDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  certificateDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  auditTrail: [{
    event: {
      type: String,
      enum: ['link_sent', 'link_opened', 'pages_viewed', 'fields_completed', 'signature_applied', 'completion'],
      required: true
    },
    timestamp: { type: Date, default: Date.now },
    signerIp: String,
    userAgent: String,
    details: String
  }],
  isUsed: { type: Boolean, default: false },
  // If this signature triggers lead conversion
  triggersConversion: { type: Boolean, default: false },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }
}, { timestamps: true });

signatureRequestSchema.index({ matter: 1 });
signatureRequestSchema.index({ signerEmail: 1 });

module.exports = mongoose.model('SignatureRequest', signatureRequestSchema);

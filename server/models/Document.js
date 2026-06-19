const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number },
  mimeType: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  checksum: { type: String }
}, { _id: true });

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  originalFileName: { type: String, required: true },
  description: { type: String },
  folder: { type: String, default: '/' },
  tags: [{ type: String, trim: true }],
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  currentVersion: { type: Number, default: 1 },
  versions: [documentVersionSchema],
  mimeType: { type: String },
  fileSize: { type: Number },
  filePath: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sharedToPortal: { type: Boolean, default: false },
  sharedAt: Date,
  sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // E-signature fields
  sentForSignature: { type: Boolean, default: false },
  signatureStatus: {
    type: String,
    enum: ['none', 'pending', 'completed', 'declined'],
    default: 'none'
  },
  signatureAuditTrail: [{
    event: String,
    timestamp: Date,
    signerIp: String,
    details: String
  }],
  signedDocumentPath: String,
  certificatePath: String,
  isTemplate: { type: Boolean, default: false },
  practiceAreaTemplate: { type: String }
}, { timestamps: true });

documentSchema.index({ matter: 1 });
documentSchema.index({ client: 1 });
documentSchema.index({ name: 'text', tags: 'text' });

module.exports = mongoose.model('Document', documentSchema);

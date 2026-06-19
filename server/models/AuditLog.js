const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'create', 'update', 'delete', 'status_change',
      'login', 'logout', 'register',
      'upload', 'version_create', 'document_share',
      'time_entry_create', 'time_entry_update',
      'invoice_create', 'invoice_finalize', 'invoice_send', 'invoice_void',
      'payment_received', 'payment_failed',
      'message_sent', 'message_read',
      'signature_sent', 'signature_completed',
      'lead_convert', 'permission_change',
      'matter_access_grant', 'matter_access_revoke',
      'portal_access_grant', 'portal_access_revoke'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: [
      'lead', 'client', 'matter', 'user',
      'calendar_event', 'note', 'document',
      'time_entry', 'fixed_charge', 'invoice',
      'message', 'custom_field', 'firm_settings'
    ]
  },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  details: { type: String },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  ipAddress: { type: String },
  userAgent: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  strict: true
});

// Append-only: no update or delete at schema level
auditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Audit log entries cannot be modified');
});
auditLogSchema.pre('updateOne', function() {
  throw new Error('Audit log entries cannot be modified');
});
auditLogSchema.pre('updateMany', function() {
  throw new Error('Audit log entries cannot be modified');
});
auditLogSchema.pre('findOneAndDelete', function() {
  throw new Error('Audit log entries cannot be deleted');
});
auditLogSchema.pre('deleteOne', function() {
  throw new Error('Audit log entries cannot be deleted');
});
auditLogSchema.pre('deleteMany', function() {
  throw new Error('Audit log entries cannot be deleted');
});

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

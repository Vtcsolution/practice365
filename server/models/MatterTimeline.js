const mongoose = require('mongoose');

const matterTimelineSchema = new mongoose.Schema({
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter', required: true },
  entryType: {
    type: String,
    required: true,
    enum: [
      'status_change', 'note_added', 'document_uploaded',
      'time_entry', 'fixed_charge', 'invoice_created',
      'invoice_sent', 'payment_received', 'message_sent',
      'message_received', 'deadline_set', 'deadline_completed',
      'event_scheduled', 'client_contact', 'signature_sent',
      'signature_completed', 'matter_created', 'matter_closed',
      'retainer_payment', 'custom'
    ]
  },
  title: { type: String, required: true },
  description: { type: String },
  referenceType: { type: String },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metadata: mongoose.Schema.Types.Mixed,
  // Immutability: edits create new entries, never modify existing
  supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'MatterTimeline' },
  isSuperseded: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Immutability enforcement
matterTimelineSchema.pre('findOneAndUpdate', function() {
  throw new Error('Timeline entries are immutable — create a new entry instead');
});
matterTimelineSchema.pre('updateOne', function() {
  throw new Error('Timeline entries are immutable — create a new entry instead');
});
matterTimelineSchema.pre('updateMany', function() {
  // Allow only isSuperseded flag updates
  const update = this.getUpdate();
  const keys = Object.keys(update.$set || update);
  if (keys.length === 1 && keys[0] === 'isSuperseded') return;
  throw new Error('Timeline entries are immutable — create a new entry instead');
});

matterTimelineSchema.index({ matter: 1, createdAt: -1 });
matterTimelineSchema.index({ entryType: 1 });

module.exports = mongoose.model('MatterTimeline', matterTimelineSchema);

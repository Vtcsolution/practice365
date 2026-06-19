const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema({
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },
  durationMinutes: { type: Number, required: true, min: 0 },
  clientDescription: { type: String, required: true },
  internalNote: { type: String },
  billingRate: { type: Number, required: true },
  lineAmount: { type: Number, required: true },
  isBillable: { type: Boolean, default: true },
  isBilled: { type: Boolean, default: false },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  // Timer tracking
  timerStartedAt: Date,
  timerStoppedAt: Date,
  entryMethod: {
    type: String,
    enum: ['manual', 'timer'],
    default: 'manual'
  }
}, { timestamps: true });

timeEntrySchema.index({ matter: 1, date: -1 });
timeEntrySchema.index({ user: 1, date: -1 });
timeEntrySchema.index({ isBilled: 1, matter: 1 });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);

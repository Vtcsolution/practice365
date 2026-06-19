const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  interval: { type: Number, required: true },
  unit: { type: String, enum: ['minutes', 'hours', 'days'], required: true },
  sent: { type: Boolean, default: false },
  sentAt: Date
}, { _id: true });

const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  allDay: { type: Boolean, default: false },
  location: { type: String, trim: true },
  eventType: {
    type: String,
    enum: ['meeting', 'hearing', 'deadline', 'deposition', 'filing', 'consultation', 'other'],
    default: 'meeting'
  },
  isDeadline: { type: Boolean, default: false },
  deadlineCompleted: { type: Boolean, default: false },
  deadlineCompletedAt: Date,
  deadlineCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reminders: [reminderSchema],
  recurrence: {
    type: { type: String, enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], default: 'none' },
    interval: { type: Number, default: 1 },
    endDate: Date
  },
  isPrivate: { type: Boolean, default: false },
  color: { type: String }
}, { timestamps: true });

calendarEventSchema.index({ startDate: 1 });
calendarEventSchema.index({ matter: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ isDeadline: 1, deadlineCompleted: 1, startDate: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

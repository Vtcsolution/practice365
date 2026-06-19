/**
 * Reminder dispatcher — runs on a setInterval started in server.js.
 * Every POLL_INTERVAL_MS it finds calendar-event reminders that are due
 * but not yet sent, fires the notification email, and marks them sent.
 *
 * Spec §3.2: reminders go to the responsible attorney by default; attendees
 * are also notified if attached to the event.
 */

const CalendarEvent = require('../models/CalendarEvent');
const Matter = require('../models/Matter');
const User = require('../models/User');
const { sendDeadlineReminder } = require('./emailService');

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

function intervalToMs(value, unit) {
  const factors = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
  return value * (factors[unit] || 0);
}

function intervalLabel(value, unit) {
  return `${value} ${unit}`;
}

async function dispatchDueReminders() {
  const now = new Date();

  // Only look at upcoming, incomplete deadlines that still have unsent reminders
  const events = await CalendarEvent.find({
    isDeadline: true,
    deadlineCompleted: false,
    startDate: { $gt: now },
    'reminders.sent': false
  })
    .populate('matter', 'name responsibleAttorney')
    .populate('attendees', 'email firstName lastName')
    .populate('createdBy', 'email firstName lastName');

  for (const event of events) {
    let modified = false;

    for (const reminder of event.reminders) {
      if (reminder.sent) continue;

      const fireAt = new Date(event.startDate.getTime() - intervalToMs(reminder.interval, reminder.unit));
      if (fireAt > now) continue; // not yet due

      // Collect recipients: responsible attorney + attendees + event creator
      const recipientEmails = new Set();

      if (event.matter?.responsibleAttorney) {
        const attorney = await User.findById(event.matter.responsibleAttorney).select('email');
        if (attorney?.email) recipientEmails.add(attorney.email);
      }
      if (event.createdBy?.email) recipientEmails.add(event.createdBy.email);
      for (const attendee of event.attendees || []) {
        if (attendee?.email) recipientEmails.add(attendee.email);
      }

      const label = intervalLabel(reminder.interval, reminder.unit);
      const matterName = event.matter?.name || null;

      for (const email of recipientEmails) {
        await sendDeadlineReminder({
          recipientEmail: email,
          eventTitle: event.title,
          matterName,
          dueDate: event.startDate,
          intervalLabel: label
        }).catch(err => console.error('[Reminder] Email failed:', err.message));
      }

      reminder.sent = true;
      reminder.sentAt = now;
      modified = true;
    }

    if (modified) {
      await event.save();
    }
  }
}

function startReminderDispatcher() {
  console.log('[Reminder] Dispatcher started — polling every 60s');
  setInterval(async () => {
    try {
      await dispatchDueReminders();
    } catch (err) {
      console.error('[Reminder] Dispatch error:', err.message);
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { startReminderDispatcher };

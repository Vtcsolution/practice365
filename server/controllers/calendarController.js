const CalendarEvent = require('../models/CalendarEvent');
const Matter = require('../models/Matter');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

async function refreshNextDeadline(matterId) {
  const next = await CalendarEvent.findOne({
    matter: matterId, isDeadline: true, deadlineCompleted: false,
    startDate: { $gte: new Date() }
  }).sort('startDate');
  await Matter.findByIdAndUpdate(matterId, { nextDeadline: next?.startDate || null });
}

exports.getEvents = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.start || req.query.end) {
      filter.startDate = {};
      if (req.query.start) filter.startDate.$gte = new Date(req.query.start);
      if (req.query.end) filter.startDate.$lte = new Date(req.query.end);
    }
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.type) filter.eventType = req.query.type;
    if (req.query.isDeadline !== undefined) filter.isDeadline = req.query.isDeadline === 'true';
    if (req.query.attorney) {
      filter.$or = [
        { createdBy: req.query.attorney },
        { attendees: req.query.attorney }
      ];
    }

    const events = await CalendarEvent.find(filter)
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .populate('attendees', 'firstName lastName')
      .sort('startDate');

    res.json({ success: true, count: events.length, data: events });
  } catch (err) {
    next(err);
  }
};

exports.getEvent = async (req, res, next) => {
  try {
    const event = await CalendarEvent.findById(req.params.id)
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .populate('attendees', 'firstName lastName email')
      .populate('deadlineCompletedBy', 'firstName lastName');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

exports.createEvent = async (req, res, next) => {
  try {
    const eventData = { ...req.body, createdBy: req.user._id };
    if (eventData.attendees && !eventData.attendees.includes(req.user._id.toString())) {
      eventData.attendees.push(req.user._id);
    }
    const event = await CalendarEvent.create(eventData);

    if (event.matter) {
      await addTimelineEntry({
        matter: event.matter,
        entryType: event.isDeadline ? 'deadline_set' : 'event_scheduled',
        title: event.isDeadline ? `Deadline set: ${event.title}` : `Event scheduled: ${event.title}`,
        description: `${event.eventType} on ${new Date(event.startDate).toLocaleDateString()}${event.description ? ' — ' + event.description : ''}`,
        referenceType: 'calendar_event',
        referenceId: event._id,
        createdBy: req.user._id
      });

      if (event.isDeadline) {
        await refreshNextDeadline(event.matter);
      }
    }

    await logAudit({
      action: 'create', entityType: 'calendar_event', entityId: event._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `${event.isDeadline ? 'Deadline' : 'Event'} created: ${event.title}`, req
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const before = await CalendarEvent.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Event not found' });

    const event = await CalendarEvent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    // Recalculate next deadline if a deadline's date was changed
    if (event.matter && event.isDeadline && req.body.startDate) {
      await refreshNextDeadline(event.matter);
    }

    await logAudit({
      action: 'update', entityType: 'calendar_event', entityId: event._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Event updated: ${event.title}`,
      changes: { before: before.toObject(), after: event.toObject() }, req
    });

    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

exports.completeDeadline = async (req, res, next) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (!event.isDeadline) return res.status(400).json({ success: false, message: 'Not a deadline' });

    event.deadlineCompleted = true;
    event.deadlineCompletedAt = new Date();
    event.deadlineCompletedBy = req.user._id;
    await event.save();

    if (event.matter) {
      await addTimelineEntry({
        matter: event.matter,
        entryType: 'deadline_completed',
        title: `Deadline completed: ${event.title}`,
        description: `Completed on ${event.deadlineCompletedAt.toLocaleDateString()}`,
        referenceType: 'calendar_event',
        referenceId: event._id,
        createdBy: req.user._id,
        metadata: { completedAt: event.deadlineCompletedAt }
      });

      await refreshNextDeadline(event.matter);
      await Matter.findByIdAndUpdate(event.matter, { lastActivityDate: new Date() });
    }

    await logAudit({
      action: 'status_change', entityType: 'calendar_event', entityId: event._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Deadline completed: ${event.title}`, req
    });

    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.isDeadline && event.deadlineCompleted) {
      return res.status(400).json({ success: false, message: 'Completed deadlines are retained on the timeline and cannot be deleted' });
    }
    await CalendarEvent.findByIdAndDelete(req.params.id);

    // If a pending deadline was deleted, recalculate the matter's next deadline
    if (event.matter && event.isDeadline && !event.deadlineCompleted) {
      await refreshNextDeadline(event.matter);
    }

    await logAudit({
      action: 'delete', entityType: 'calendar_event', entityId: event._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Event deleted: ${event.title}`, req
    });

    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getOverdueDeadlines = async (req, res, next) => {
  try {
    const deadlines = await CalendarEvent.find({
      isDeadline: true, deadlineCompleted: false,
      startDate: { $lt: new Date() }
    })
      .populate('matter', 'name matterNumber')
      .populate('createdBy', 'firstName lastName')
      .sort('startDate');

    res.json({ success: true, count: deadlines.length, data: deadlines });
  } catch (err) {
    next(err);
  }
};

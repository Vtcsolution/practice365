const Matter = require('../models/Matter');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const CalendarEvent = require('../models/CalendarEvent');
const TimeEntry = require('../models/TimeEntry');
const Invoice = require('../models/Invoice');
const MatterTimeline = require('../models/MatterTimeline');
const FirmSettings = require('../models/FirmSettings');

exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    // Configurable inactivity period
    let settings = await FirmSettings.findOne();
    if (!settings) settings = await FirmSettings.create({});
    const inactivityDays = settings.inactivityAlertDays || 14;
    const inactivityCutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);

    const userFilter = req.query.attorney ? { user: req.query.attorney } : { user: req.user._id };

    const [
      activeMatters,
      pendingLeads,
      totalClients,
      overdueDeadlines,
      todayEvents,
      todayHours, weekHours, monthHours, yearHours,
      draftBills, unpaidBills, overdueBills, paidBillsYTD,
      recentActivity,
      inactiveMatters,
      retainerAlerts,
      overdueInvoicesList
    ] = await Promise.all([
      Matter.countDocuments({ status: { $ne: 'closed' } }),
      Lead.countDocuments({ status: { $in: ['new', 'contacted'] } }),
      Client.countDocuments({ isActive: true }),
      CalendarEvent.countDocuments({ isDeadline: true, deadlineCompleted: false, startDate: { $lt: today } }),
      CalendarEvent.find({ startDate: { $gte: today, $lte: endOfDay } })
        .populate('matter', 'name matterNumber')
        .select('title startDate eventType isDeadline matter').lean(),
      TimeEntry.aggregate([{ $match: { date: { $gte: today, $lte: endOfDay }, ...userFilter } }, { $group: { _id: null, total: { $sum: '$durationMinutes' } } }]),
      TimeEntry.aggregate([{ $match: { date: { $gte: weekStart }, ...userFilter } }, { $group: { _id: null, total: { $sum: '$durationMinutes' } } }]),
      TimeEntry.aggregate([{ $match: { date: { $gte: monthStart }, ...userFilter } }, { $group: { _id: null, total: { $sum: '$durationMinutes' } } }]),
      TimeEntry.aggregate([{ $match: { date: { $gte: yearStart }, ...userFilter } }, { $group: { _id: null, total: { $sum: '$durationMinutes' } } }]),
      Invoice.aggregate([{ $match: { status: 'draft' } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } }]),
      Invoice.aggregate([{ $match: { status: { $in: ['sent', 'partially_paid'] } } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$balanceDue' } } }]),
      Invoice.aggregate([{ $match: { status: { $in: ['sent', 'partially_paid'] }, dueDate: { $lt: today } } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$balanceDue' } } }]),
      Invoice.aggregate([{ $match: { status: 'paid', updatedAt: { $gte: yearStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      MatterTimeline.find({}).populate('createdBy', 'firstName lastName').populate('matter', 'name matterNumber').sort('-createdAt').limit(15).lean(),
      // Matters with no activity in trailing period
      Matter.find({
        status: { $ne: 'closed' },
        $or: [
          { lastActivityDate: { $lt: inactivityCutoff } },
          { lastActivityDate: { $exists: false } }
        ]
      }).select('name matterNumber client lastActivityDate status').populate('client', 'firstName lastName').lean(),
      // Matters with retainer not collected despite logged time (Section 1.5)
      Matter.find({
        status: { $ne: 'closed' },
        'retainer.type': { $ne: 'none' },
        'retainer.collected': { $ne: true },
        totalBilledHours: { $gt: 0 }
      }).select('name matterNumber client retainer totalBilledHours').populate('client', 'firstName lastName').lean(),
      // Overdue invoices list
      Invoice.find({
        status: { $in: ['sent', 'partially_paid'] },
        dueDate: { $lt: today }
      }).populate('client', 'firstName lastName').populate('matter', 'name matterNumber').sort('dueDate').lean()
    ]);

    // Overdue deadlines list
    const overdueDeadlinesList = await CalendarEvent.find({
      isDeadline: true, deadlineCompleted: false, startDate: { $lt: today }
    }).populate('matter', 'name matterNumber').populate('createdBy', 'firstName lastName').sort('startDate').lean();

    // Pending leads list
    const pendingLeadsList = await Lead.find({
      status: { $in: ['new', 'contacted'] }
    }).populate('assignedTo', 'firstName lastName').sort('-createdAt').lean();

    res.json({
      success: true,
      data: {
        activeMatters,
        pendingLeads,
        totalClients,
        overdueDeadlines,
        todayEvents,
        hours: {
          today: (todayHours[0]?.total || 0) / 60,
          week: (weekHours[0]?.total || 0) / 60,
          month: (monthHours[0]?.total || 0) / 60,
          year: (yearHours[0]?.total || 0) / 60
        },
        billing: {
          draft: { count: draftBills[0]?.count || 0, total: draftBills[0]?.total || 0 },
          unpaid: { count: unpaidBills[0]?.count || 0, total: unpaidBills[0]?.total || 0 },
          overdue: { count: overdueBills[0]?.count || 0, total: overdueBills[0]?.total || 0 },
          collectedYTD: paidBillsYTD[0]?.total || 0
        },
        recentActivity,
        inactivityDays,
        // Dashboard lists — each item links to the underlying record
        overdueDeadlinesList,
        overdueInvoicesList,
        inactiveMatters,
        retainerAlerts,
        pendingLeadsList
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    let settings = await FirmSettings.findOne();
    if (!settings) settings = await FirmSettings.create({});

    const allowed = [
      'firmName', 'logoUrl', 'phone', 'email', 'website', 'address',
      'defaultBillingRate', 'practiceAreas', 'matterStatuses',
      'invoicePrefix', 'inactivityAlertDays', 'brandColors'
    ];
    allowed.forEach(f => { if (req.body[f] !== undefined) settings[f] = req.body[f]; });
    await settings.save();

    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      action: 'update', entityType: 'firm_settings', entityId: settings._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: 'Firm settings updated', req
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    let settings = await FirmSettings.findOne();
    if (!settings) settings = await FirmSettings.create({});
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

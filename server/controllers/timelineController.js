const MatterTimeline = require('../models/MatterTimeline');

exports.getTimeline = async (req, res, next) => {
  try {
    const filter = { matter: req.params.matterId };
    if (req.query.type) filter.entryType = req.query.type;
    if (req.query.hideSuperseded !== 'false') filter.isSuperseded = false;

    const entries = await MatterTimeline.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, count: entries.length, data: entries });
  } catch (err) {
    next(err);
  }
};

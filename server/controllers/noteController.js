const Note = require('../models/Note');
const Matter = require('../models/Matter');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

exports.getNotes = async (req, res, next) => {
  try {
    const filter = { isLatestVersion: true };
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.client) filter.client = req.query.client;
    if (req.query.noteType) filter.noteType = req.query.noteType;
    if (req.query.search) {
      filter.content = { $regex: req.query.search, $options: 'i' };
    }

    // Scope by user permissions — exclude notes on restricted matters the user can't access
    if (req.user.role === 'staff' && !req.user.permissions.canAccessAllMatters) {
      if (filter.matter) {
        const matter = await Matter.findById(filter.matter);
        if (matter?.isRestricted) {
          const hasAccess =
            matter.responsibleAttorney.toString() === req.user._id.toString() ||
            matter.authorizedUsers.some(u => u.toString() === req.user._id.toString());
          if (!hasAccess) {
            return res.json({ success: true, count: 0, data: [] });
          }
        }
      } else {
        // Unscoped search: exclude notes from restricted matters this user can't access
        const restrictedMatters = await Matter.find({
          isRestricted: true,
          responsibleAttorney: { $ne: req.user._id },
          authorizedUsers: { $ne: req.user._id }
        }).select('_id');
        if (restrictedMatters.length > 0) {
          filter.matter = { $nin: restrictedMatters.map(m => m._id) };
        }
      }
    }

    const notes = await Note.find(filter)
      .populate('createdBy', 'firstName lastName')
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, count: notes.length, data: notes });
  } catch (err) {
    next(err);
  }
};

exports.getNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('previousVersion');
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });

    // Get version history
    let versions = [];
    if (note.previousVersion) {
      let current = note;
      while (current.previousVersion) {
        const prev = await Note.findById(current.previousVersion)
          .populate('createdBy', 'firstName lastName');
        if (prev) versions.push(prev);
        current = prev;
      }
    }

    res.json({ success: true, data: { ...note.toObject(), versionHistory: versions } });
  } catch (err) {
    next(err);
  }
};

exports.createNote = async (req, res, next) => {
  try {
    const note = await Note.create({ ...req.body, createdBy: req.user._id });

    if (note.matter) {
      await addTimelineEntry({
        matter: note.matter,
        entryType: 'note_added',
        title: `Note added (${note.noteType.replace('_', ' ')})`,
        description: note.content.substring(0, 200),
        referenceType: 'note',
        referenceId: note._id,
        createdBy: req.user._id
      });

      await Matter.findByIdAndUpdate(note.matter, { lastActivityDate: new Date() });
      if (note.noteType === 'client_call') {
        await Matter.findByIdAndUpdate(note.matter, { lastClientContactDate: new Date() });
      }
    }

    await logAudit({
      action: 'create', entityType: 'note', entityId: note._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Note created (${note.noteType}) on ${note.matter ? 'matter' : 'client'}`, req
    });

    const populated = await Note.findById(note._id)
      .populate('createdBy', 'firstName lastName')
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

exports.editNote = async (req, res, next) => {
  try {
    const original = await Note.findById(req.params.id);
    if (!original) return res.status(404).json({ success: false, message: 'Note not found' });

    original.isLatestVersion = false;
    await original.save();

    const newNote = await Note.create({
      content: req.body.content,
      noteType: req.body.noteType || original.noteType,
      matter: original.matter,
      client: original.client,
      createdBy: req.user._id,
      previousVersion: original._id,
      isLatestVersion: true
    });

    await logAudit({
      action: 'update', entityType: 'note', entityId: newNote._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Note edited (new version from ${original._id})`, req
    });

    const populated = await Note.findById(newNote._id)
      .populate('createdBy', 'firstName lastName')
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName');

    res.json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

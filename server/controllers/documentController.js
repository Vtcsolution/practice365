const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Matter = require('../models/Matter');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');

exports.getDocuments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.client) filter.client = req.query.client;
    if (req.query.folder) filter.folder = req.query.folder;
    if (req.query.tag) filter.tags = req.query.tag;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { tags: { $regex: req.query.search, $options: 'i' } },
        { originalFileName: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const docs = await Document.find(filter)
      .populate('uploadedBy', 'firstName lastName')
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    next(err);
  }
};

exports.getDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('uploadedBy', 'firstName lastName')
      .populate('matter', 'name matterNumber practiceArea')
      .populate('client', 'firstName lastName')
      .populate('versions.uploadedBy', 'firstName lastName');
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { matter, client, folder, tags, description, name } = req.body;
    const fileName = name || req.file.originalname;
    const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [];

    // Versioning: check if same filename + folder + matter/client exists
    const existingQuery = {
      originalFileName: req.file.originalname,
      folder: folder || '/'
    };
    if (matter) existingQuery.matter = matter;
    if (client) existingQuery.client = client;

    const existing = await Document.findOne(existingQuery);

    if (existing) {
      const newVersionNum = existing.currentVersion + 1;
      existing.versions.push({
        versionNumber: newVersionNum,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user._id
      });
      existing.currentVersion = newVersionNum;
      existing.filePath = req.file.path;
      existing.fileSize = req.file.size;
      existing.mimeType = req.file.mimetype;
      existing.uploadedBy = req.user._id;
      if (description) existing.description = description;
      if (parsedTags.length) existing.tags = [...new Set([...existing.tags, ...parsedTags])];
      await existing.save();

      if (existing.matter) {
        await addTimelineEntry({
          matter: existing.matter, entryType: 'document_uploaded',
          title: `Document updated: ${fileName} (v${newVersionNum})`,
          description: `New version uploaded`,
          referenceType: 'document', referenceId: existing._id,
          createdBy: req.user._id
        });
      }

      await logAudit({
        action: 'version_create', entityType: 'document', entityId: existing._id,
        userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
        details: `Document version ${newVersionNum} uploaded: ${fileName}`, req
      });

      const populated = await Document.findById(existing._id)
        .populate('uploadedBy', 'firstName lastName')
        .populate('matter', 'name matterNumber')
        .populate('client', 'firstName lastName');

      return res.json({ success: true, data: populated, versioned: true });
    }

    // New document
    const doc = await Document.create({
      name: fileName,
      originalFileName: req.file.originalname,
      description,
      folder: folder || '/',
      tags: parsedTags,
      matter,
      client,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      uploadedBy: req.user._id,
      versions: [{
        versionNumber: 1,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user._id
      }]
    });

    if (doc.matter) {
      await addTimelineEntry({
        matter: doc.matter, entryType: 'document_uploaded',
        title: `Document uploaded: ${fileName}`,
        referenceType: 'document', referenceId: doc._id,
        createdBy: req.user._id
      });
      await Matter.findByIdAndUpdate(doc.matter, { lastActivityDate: new Date() });
    }

    await logAudit({
      action: 'upload', entityType: 'document', entityId: doc._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Document uploaded: ${fileName}`, req
    });

    const populated = await Document.findById(doc._id)
      .populate('uploadedBy', 'firstName lastName')
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

exports.updateDocument = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'description', 'folder', 'tags'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const doc = await Document.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('uploadedBy', 'firstName lastName')
      .populate('matter', 'name matterNumber');
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    await logAudit({
      action: 'update', entityType: 'document', entityId: doc._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Document updated: ${doc.name}`, req
    });

    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    await Document.findByIdAndDelete(req.params.id);

    await logAudit({
      action: 'delete', entityType: 'document', entityId: doc._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Document deleted: ${doc.name}`, req
    });

    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};

// Serve file for in-browser preview
exports.serveFile = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    let filePath = doc.filePath;
    if (req.query.version) {
      const ver = doc.versions.find(v => v.versionNumber === parseInt(req.query.version));
      if (ver) filePath = ver.filePath;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk' });
    }

    const mimeType = doc.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

exports.downloadFile = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    let filePath = doc.filePath;
    if (req.query.version) {
      const ver = doc.versions.find(v => v.versionNumber === parseInt(req.query.version));
      if (ver) filePath = ver.filePath;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk' });
    }

    res.download(filePath, doc.originalFileName);
  } catch (err) {
    next(err);
  }
};

exports.getFolders = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.client) filter.client = req.query.client;

    const folders = await Document.distinct('folder', filter);
    res.json({ success: true, data: folders.sort() });
  } catch (err) {
    next(err);
  }
};

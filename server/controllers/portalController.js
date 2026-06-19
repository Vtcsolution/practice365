const Client = require('../models/Client');
const Matter = require('../models/Matter');
const Document = require('../models/Document');
const Invoice = require('../models/Invoice');
const FirmSettings = require('../models/FirmSettings');

exports.getFirmBranding = async (req, res, next) => {
  try {
    let settings = await FirmSettings.findOne();
    if (!settings) settings = await FirmSettings.create({});
    res.json({
      success: true,
      data: {
        firmName: settings.firmName,
        logoUrl: settings.logoUrl,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        address: settings.address,
        brandColors: settings.brandColors
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getPortalProfile = async (req, res, next) => {
  try {
    const client = await Client.findById(req.portalClientId)
      .populate('assignedAttorney', 'firstName lastName email phone');
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (err) {
    next(err);
  }
};

exports.getPortalMatters = async (req, res, next) => {
  try {
    const matters = await Matter.find({ client: req.portalClientId })
      .populate('responsibleAttorney', 'firstName lastName')
      .select('name matterNumber status practiceArea openDate responsibleAttorney lastActivityDate')
      .sort('-updatedAt');
    res.json({ success: true, count: matters.length, data: matters });
  } catch (err) {
    next(err);
  }
};

exports.getPortalMatter = async (req, res, next) => {
  try {
    const matter = await Matter.findOne({ _id: req.params.id, client: req.portalClientId })
      .populate('responsibleAttorney', 'firstName lastName email');
    if (!matter) return res.status(404).json({ success: false, message: 'Matter not found' });
    res.json({ success: true, data: matter });
  } catch (err) {
    next(err);
  }
};

exports.getPortalDocuments = async (req, res, next) => {
  try {
    const matters = await Matter.find({ client: req.portalClientId }).select('_id');
    const matterIds = matters.map(m => m._id);

    const docs = await Document.find({
      sharedToPortal: true,
      $or: [
        { client: req.portalClientId },
        { matter: { $in: matterIds } }
      ]
    })
      .populate('matter', 'name')
      .select('name originalFileName mimeType fileSize folder tags createdAt matter sharedAt')
      .sort('-sharedAt');

    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    next(err);
  }
};

exports.getPortalInvoices = async (req, res, next) => {
  try {
    // Exclude Draft status — clients should never see drafts
    const invoices = await Invoice.find({
      client: req.portalClientId,
      status: { $ne: 'draft' }
    })
      .populate('matter', 'name matterNumber')
      .sort('-createdAt');

    // Strip internal notes from line items
    const safe = invoices.map(inv => {
      const obj = inv.toObject();
      obj.lineItems = obj.lineItems.map(li => {
        const { internalNote, ...rest } = li;
        return rest;
      });
      return obj;
    });

    res.json({ success: true, count: safe.length, data: safe });
  } catch (err) {
    next(err);
  }
};

exports.shareDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    doc.sharedToPortal = true;
    doc.sharedAt = new Date();
    doc.sharedBy = req.user._id;
    await doc.save();

    res.json({ success: true, message: 'Document shared to portal', data: doc });
  } catch (err) {
    next(err);
  }
};

exports.unshareDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    doc.sharedToPortal = false;
    await doc.save();

    res.json({ success: true, message: 'Document removed from portal', data: doc });
  } catch (err) {
    next(err);
  }
};

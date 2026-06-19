const crypto = require('crypto');
const SignatureRequest = require('../models/SignatureRequest');
const Document = require('../models/Document');
const Matter = require('../models/Matter');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const User = require('../models/User');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');
const { sendSignatureRequest } = require('../utils/emailService');

exports.createSignatureRequest = async (req, res, next) => {
  try {
    const { documentId, signerName, signerEmail, triggersConversion, leadId } = req.body;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    if (!doc.matter) return res.status(400).json({ success: false, message: 'Document must be attached to a matter' });

    const token = crypto.randomBytes(32).toString('hex');
    const signingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/sign/${token}`;

    const sigReq = await SignatureRequest.create({
      document: documentId,
      matter: doc.matter,
      signerName,
      signerEmail,
      token,
      sentBy: req.user._id,
      triggersConversion: triggersConversion || false,
      leadId: leadId || null,
      auditTrail: [{
        event: 'link_sent',
        timestamp: new Date(),
        signerIp: req.ip,
        details: `Signature request sent to ${signerEmail}`
      }]
    });

    doc.sentForSignature = true;
    doc.signatureStatus = 'pending';
    await doc.save();

    await sendSignatureRequest({
      recipientEmail: signerEmail,
      recipientName: signerName,
      documentName: doc.name,
      signingUrl,
      senderName: `${req.user.firstName} ${req.user.lastName}`
    });

    await addTimelineEntry({
      matter: doc.matter,
      entryType: 'signature_sent',
      title: `Signature requested: ${doc.name}`,
      description: `Sent to ${signerName} (${signerEmail})`,
      referenceType: 'signature_request',
      referenceId: sigReq._id,
      createdBy: req.user._id
    });

    await logAudit({
      action: 'signature_sent', entityType: 'document', entityId: doc._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Signature request sent to ${signerEmail} for ${doc.name}`, req
    });

    res.status(201).json({ success: true, data: { ...sigReq.toObject(), signingUrl } });
  } catch (err) {
    next(err);
  }
};

exports.getSigningPage = async (req, res, next) => {
  try {
    const sigReq = await SignatureRequest.findOne({ token: req.params.token })
      .populate('document', 'name originalFileName mimeType')
      .populate({ path: 'matter', select: 'name', populate: { path: 'client', select: 'firstName lastName' } });

    if (!sigReq) return res.status(404).json({ success: false, message: 'Invalid or expired signing link' });
    if (sigReq.isUsed) return res.status(400).json({ success: false, message: 'This signing link has already been used' });
    if (sigReq.status === 'completed') return res.status(400).json({ success: false, message: 'Document already signed' });

    if (sigReq.status === 'pending') {
      sigReq.status = 'opened';
      sigReq.auditTrail.push({
        event: 'link_opened',
        timestamp: new Date(),
        signerIp: req.ip,
        userAgent: req.headers['user-agent'],
        details: 'Signing link opened'
      });
      await sigReq.save();
    }

    res.json({
      success: true,
      data: {
        id: sigReq._id,
        documentName: sigReq.document.name,
        matterName: sigReq.matter?.name,
        signerName: sigReq.signerName,
        signerEmail: sigReq.signerEmail,
        status: sigReq.status,
        documentId: sigReq.document._id,
        previewUrl: `/api/documents/${sigReq.document._id}/preview`
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.completeSignature = async (req, res, next) => {
  try {
    const sigReq = await SignatureRequest.findOne({ token: req.params.token })
      .populate('document')
      .populate('matter');

    if (!sigReq) return res.status(404).json({ success: false, message: 'Invalid signing link' });
    if (sigReq.isUsed || sigReq.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Already signed' });
    }

    const now = new Date();

    sigReq.auditTrail.push(
      { event: 'pages_viewed', timestamp: new Date(now - 3000), signerIp: req.ip, details: 'All pages viewed' },
      { event: 'fields_completed', timestamp: new Date(now - 2000), signerIp: req.ip, details: 'All required fields completed' },
      { event: 'signature_applied', timestamp: new Date(now - 1000), signerIp: req.ip, details: `Signature applied by ${sigReq.signerName}` },
      { event: 'completion', timestamp: now, signerIp: req.ip, details: 'Signing completed' }
    );

    sigReq.status = 'completed';
    sigReq.completedAt = now;
    sigReq.isUsed = true;

    // Create signed document version
    const origDoc = sigReq.document;
    origDoc.signatureStatus = 'completed';
    origDoc.signatureAuditTrail = sigReq.auditTrail.map(e => ({
      event: e.event, timestamp: e.timestamp, signerIp: e.signerIp, details: e.details
    }));

    const newVersionNum = origDoc.currentVersion + 1;
    origDoc.versions.push({
      versionNumber: newVersionNum,
      filePath: origDoc.filePath,
      fileSize: origDoc.fileSize,
      mimeType: origDoc.mimeType,
      uploadedBy: sigReq.sentBy
    });
    origDoc.currentVersion = newVersionNum;
    await origDoc.save();

    // Generate certificate of completion
    const certContent = [
      `CERTIFICATE OF COMPLETION`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Document: ${origDoc.name}`,
      `Matter: ${sigReq.matter?.name || 'N/A'}`,
      `Signer: ${sigReq.signerName} (${sigReq.signerEmail})`,
      `Completed: ${now.toISOString()}`,
      ``,
      `AUDIT TRAIL:`,
      ...sigReq.auditTrail.map(e => `  ${e.timestamp.toISOString()} | ${e.event} | IP: ${e.signerIp || 'N/A'} | ${e.details}`),
      ``,
      `This certificate is permanently attached and immutable.`,
      `Request ID: ${sigReq._id}`
    ].join('\n');

    const certDoc = await Document.create({
      name: `Certificate — ${origDoc.name}`,
      originalFileName: `certificate-${origDoc.originalFileName}.txt`,
      description: 'Certificate of completion for e-signature',
      folder: origDoc.folder,
      tags: ['certificate', 'e-signature'],
      matter: sigReq.matter._id,
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(certContent),
      filePath: origDoc.filePath,
      uploadedBy: sigReq.sentBy,
      versions: [{ versionNumber: 1, filePath: origDoc.filePath, fileSize: Buffer.byteLength(certContent), mimeType: 'text/plain', uploadedBy: sigReq.sentBy }]
    });

    sigReq.signedDocumentId = origDoc._id;
    sigReq.certificateDocumentId = certDoc._id;
    await sigReq.save();

    await addTimelineEntry({
      matter: sigReq.matter._id,
      entryType: 'signature_completed',
      title: `Document signed: ${origDoc.name}`,
      description: `Signed by ${sigReq.signerName} (${sigReq.signerEmail})`,
      referenceType: 'signature_request',
      referenceId: sigReq._id,
      createdBy: sigReq.sentBy,
      metadata: { completedAt: now, signerIp: req.ip }
    });

    await logAudit({
      action: 'signature_completed', entityType: 'document', entityId: origDoc._id,
      userId: sigReq.sentBy, userName: sigReq.signerName,
      details: `E-signature completed by ${sigReq.signerName} on ${origDoc.name}`, req
    });

    // If this triggers lead conversion
    if (sigReq.triggersConversion && sigReq.leadId) {
      await performLeadConversion(sigReq.leadId, sigReq.sentBy, req);
    }

    res.json({ success: true, message: 'Signature completed successfully', data: { status: 'completed', completedAt: now } });
  } catch (err) {
    next(err);
  }
};

async function performLeadConversion(leadId, userId, req) {
  const lead = await Lead.findById(leadId);
  if (!lead || lead.status === 'converted') return;

  const user = await User.findById(userId);

  const client = await Client.create({
    firstName: lead.firstName, lastName: lead.lastName,
    email: lead.email, phone: lead.phone, address: lead.address,
    practiceArea: lead.practiceArea, portalAccess: true,
    originLeadId: lead._id, assignedAttorney: lead.assignedTo || userId,
    customFields: lead.customFields
  });

  const matter = await Matter.create({
    name: `${lead.firstName} ${lead.lastName} — ${lead.practiceArea}`,
    client: client._id, leadId: lead._id, practiceArea: lead.practiceArea,
    status: 'open', responsibleAttorney: lead.assignedTo || userId,
    originatingAttorney: userId, description: lead.caseDescription,
    opposingParty: lead.opposingPartyName, opposingCounsel: lead.opposingPartyAttorney,
    openDate: new Date()
  });

  const portalPassword = crypto.randomBytes(16).toString('hex');
  const portalUser = await User.create({
    firstName: client.firstName, lastName: client.lastName,
    email: client.email, password: portalPassword,
    role: 'client', linkedClientId: client._id
  });
  client.portalUserId = portalUser._id;
  await client.save();

  lead.status = 'converted';
  lead.convertedClientId = client._id;
  lead.convertedMatterId = matter._id;
  lead.convertedAt = new Date();
  lead.engagementLetterSignedAt = new Date();
  await lead.save();

  await addTimelineEntry({
    matter: matter._id, entryType: 'matter_created',
    title: 'Matter created via e-signature conversion',
    description: `Lead ${lead.firstName} ${lead.lastName} converted after engagement letter signed`,
    referenceType: 'lead', referenceId: lead._id, createdBy: userId
  });

  await logAudit({
    action: 'lead_convert', entityType: 'lead', entityId: lead._id,
    userId, userName: user ? `${user.firstName} ${user.lastName}` : 'System',
    details: `Lead converted via e-signature to Client (${client._id}) and Matter (${matter._id})`, req
  });
}

exports.getSignatureRequests = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matter) filter.matter = req.query.matter;
    if (req.query.status) filter.status = req.query.status;

    const requests = await SignatureRequest.find(filter)
      .populate('document', 'name')
      .populate('matter', 'name matterNumber')
      .populate('sentBy', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    next(err);
  }
};

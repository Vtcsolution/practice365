const { Message, MessageThread } = require('../models/Message');
const Document = require('../models/Document');
const Matter = require('../models/Matter');
const Client = require('../models/Client');
const User = require('../models/User');
const { logAudit, addTimelineEntry } = require('../utils/auditLogger');
const { sendMessageNotification } = require('../utils/emailService');

exports.getThreads = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matter) filter.matter = req.query.matter;

    // Client portal: strictly scoped to their own client record
    if (req.user.role === 'client') {
      filter.client = req.portalClientId || req.user.linkedClientId;
    } else if (req.query.client) {
      filter.client = req.query.client;
    }

    const threads = await MessageThread.find(filter)
      .populate('matter', 'name matterNumber')
      .populate('client', 'firstName lastName')
      .sort('-lastMessageAt');

    res.json({ success: true, count: threads.length, data: threads });
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const thread = await MessageThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    // Client portal scope enforcement
    if (req.user.role === 'client') {
      const clientId = req.portalClientId || req.user.linkedClientId;
      if (thread.client.toString() !== clientId?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const messages = await Message.find({ thread: req.params.threadId })
      .populate('sender', 'firstName lastName role')
      .sort('createdAt');

    // Mark unread messages as delivered/read
    const unreadIds = messages
      .filter(m => m.sender._id.toString() !== req.user._id.toString() && m.status !== 'read')
      .map(m => m._id);

    if (unreadIds.length) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { status: 'read', readAt: new Date(), deliveredAt: new Date() }
      );
    }

    res.json({ success: true, count: messages.length, data: messages });
  } catch (err) {
    next(err);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { threadId, matter, client, subject, body, attachments } = req.body;

    let thread;
    if (threadId) {
      thread = await MessageThread.findById(threadId);
      if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    } else {
      if (!matter) return res.status(400).json({ success: false, message: 'Matter is required for new threads' });
      const matterDoc = await Matter.findById(matter).populate('client');
      if (!matterDoc) return res.status(400).json({ success: false, message: 'Matter not found' });

      thread = await MessageThread.create({
        matter,
        client: client || matterDoc.client._id,
        subject: subject || `Message regarding ${matterDoc.name}`,
        participants: []
      });
    }

    // Client portal scope enforcement
    if (req.user.role === 'client') {
      const clientId = req.portalClientId || req.user.linkedClientId;
      if (thread.client.toString() !== clientId?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const senderType = req.user.role === 'client' ? 'client' : 'firm';

    // Handle attachments — file into matter's document store tagged by thread
    let processedAttachments = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.documentId) {
          const doc = await Document.findById(att.documentId);
          if (doc) {
            if (!doc.tags.includes(`thread-${thread._id}`)) {
              doc.tags.push(`thread-${thread._id}`);
              await doc.save();
            }
            processedAttachments.push({
              documentId: doc._id, fileName: doc.name,
              filePath: doc.filePath, fileSize: doc.fileSize, mimeType: doc.mimeType
            });
          }
        }
      }
    }

    const message = await Message.create({
      thread: thread._id,
      sender: req.user._id,
      senderType,
      body,
      attachments: processedAttachments,
      status: 'sent'
    });

    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = body.substring(0, 100);
    thread.messageCount += 1;
    await thread.save();

    // Timeline entry
    await addTimelineEntry({
      matter: thread.matter,
      entryType: senderType === 'firm' ? 'message_sent' : 'message_received',
      title: `Message ${senderType === 'firm' ? 'sent to client' : 'received from client'}`,
      description: body.substring(0, 200),
      referenceType: 'message',
      referenceId: message._id,
      createdBy: req.user._id
    });

    // Update matter last client contact if client sent message
    if (senderType === 'client') {
      await Matter.findByIdAndUpdate(thread.matter, { lastClientContactDate: new Date(), lastActivityDate: new Date() });
    } else {
      await Matter.findByIdAndUpdate(thread.matter, { lastActivityDate: new Date() });
    }

    // Email notification (preview only, not full body)
    try {
      if (senderType === 'firm') {
        const clientDoc = await Client.findById(thread.client);
        if (clientDoc) {
          const matterDoc = await Matter.findById(thread.matter);
          await sendMessageNotification({
            recipientEmail: clientDoc.email,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            matterName: matterDoc?.name || 'your matter',
            messagePreview: body.substring(0, 100)
          });
        }
      } else {
        const matterDoc = await Matter.findById(thread.matter).populate('responsibleAttorney');
        if (matterDoc?.responsibleAttorney) {
          await sendMessageNotification({
            recipientEmail: matterDoc.responsibleAttorney.email,
            senderName: `${req.user.firstName} ${req.user.lastName} (Client)`,
            matterName: matterDoc.name,
            messagePreview: body.substring(0, 100)
          });
        }
      }
    } catch (e) {
      console.error('Email notification failed:', e.message);
    }

    await logAudit({
      action: 'message_sent', entityType: 'message', entityId: message._id,
      userId: req.user._id, userName: `${req.user.firstName} ${req.user.lastName}`,
      details: `Message sent in thread for matter ${thread.matter}`, req
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName role');

    res.status(201).json({ success: true, data: { message: populated, thread } });
  } catch (err) {
    next(err);
  }
};

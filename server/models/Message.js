const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageThread', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderType: {
    type: String,
    enum: ['firm', 'client'],
    required: true
  },
  body: { type: String, required: true },
  attachments: [{
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    fileName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String
  }],
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredAt: Date,
  readAt: Date,
  emailNotificationSent: { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.index({ thread: 1, createdAt: 1 });

const messageThreadSchema = new mongoose.Schema({
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  subject: { type: String, trim: true },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['firm', 'client'] }
  }],
  lastMessageAt: Date,
  lastMessagePreview: { type: String },
  messageCount: { type: Number, default: 0 },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

messageThreadSchema.index({ matter: 1 });
messageThreadSchema.index({ client: 1 });

const Message = mongoose.model('Message', messageSchema);
const MessageThread = mongoose.model('MessageThread', messageThreadSchema);

module.exports = { Message, MessageThread };

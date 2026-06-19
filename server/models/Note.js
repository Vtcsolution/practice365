const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  noteType: {
    type: String,
    enum: ['client_call', 'internal', 'research', 'court_appearance', 'general'],
    default: 'general'
  },
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Immutability: edits create a new note referencing the original
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
  isLatestVersion: { type: Boolean, default: true }
}, { timestamps: true });

noteSchema.index({ matter: 1, createdAt: -1 });
noteSchema.index({ client: 1, createdAt: -1 });
noteSchema.index({ content: 'text' });

module.exports = mongoose.model('Note', noteSchema);

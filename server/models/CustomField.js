const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  fieldKey: { type: String, required: true, trim: true },
  fieldType: {
    type: String,
    enum: ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'textarea', 'email', 'phone', 'url'],
    required: true
  },
  options: [{ type: String }],
  practiceArea: { type: String, required: true, trim: true },
  appliesTo: {
    type: String,
    enum: ['lead', 'client', 'matter'],
    required: true
  },
  isRequired: { type: Boolean, default: false },
  isSearchable: { type: Boolean, default: true },
  defaultValue: mongoose.Schema.Types.Mixed,
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

customFieldSchema.index({ practiceArea: 1, appliesTo: 1 });
customFieldSchema.index({ fieldKey: 1, practiceArea: 1, appliesTo: 1 }, { unique: true });

module.exports = mongoose.model('CustomField', customFieldSchema);

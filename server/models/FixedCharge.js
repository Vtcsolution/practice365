const mongoose = require('mongoose');

const fixedChargeSchema = new mongoose.Schema({
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'Matter', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },
  amount: { type: Number, required: true },
  clientDescription: { type: String, required: true },
  internalNote: { type: String },
  isBillable: { type: Boolean, default: true },
  isBilled: { type: Boolean, default: false },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }
}, { timestamps: true });

fixedChargeSchema.index({ matter: 1, date: -1 });
fixedChargeSchema.index({ isBilled: 1, matter: 1 });

module.exports = mongoose.model('FixedCharge', fixedChargeSchema);

// models/AuditLog.js
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'score_override'
  targetType: { type: String }, // e.g., 'Submission'
  targetId: { type: mongoose.Schema.Types.ObjectId },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);

// models/ProctorLog.js
const mongoose = require('mongoose');

const ProctorLogSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testSet: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSet' },
  eventType: { type: String, enum: ['webcam_snapshot','tab_switch','warning','face_missing','screen_share','proctor_note'], required: true },
  eventData: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProctorLog', ProctorLogSchema);

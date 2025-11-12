// models/Submission.js
const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testSet: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSet', required: true },
  skill: { type: String, enum: ['Listening', 'Reading', 'Writing', 'Speaking'], required: true },
  response: { type: mongoose.Schema.Types.Mixed, required: true }, // answers array OR essay string OR audio URL
  rawScore: { type: Number, default: 0 },
  bandScore: { type: Number, default: 0 },
  aiFeedback: { type: String, default: '' },
  aiLinguisticScore: { type: Number, default: 0 },
  aiAcousticScore: { type: Number, default: 0 },
  originalBandScore: { type: Number },
  overrideReason: { type: String, default: '' },
  overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isOverridden: { type: Boolean, default: false },
  status: { type: String, enum: ['pending','processing','done','failed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);

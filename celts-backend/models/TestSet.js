// models/TestSet.js
const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  correctAnswer: { type: String }, // for MCQ (Listening/Reading)
  options: [{ type: String }],
  promptDetails: { type: String },
  wordLimit: { type: Number },
  skill: { type: String, enum: ['Listening', 'Reading', 'Writing', 'Speaking'], required: true },
  marks: { type: Number, default: 1 }
}, { _id: true });

const TestSetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  assignedTo: [{ type: String }], // cohort names or 'all'
  questions: [QuestionSchema],
  durationMinutes: { type: Number, required: true },
  isPublished: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date }, // optional scheduled start
  endTime: { type: Date } // optional scheduled end
}, { timestamps: true });

module.exports = mongoose.model('TestSet', TestSetSchema);

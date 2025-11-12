// models/Batch.js
const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g. "MBA-1A"
  program: { type: String, required: false }, // optional: "MBA" or "B.Tech"
  year: { type: Number, required: false }, // optional: 2025
  section: { type: String, required: false }, // e.g. "A"
  faculty: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Faculties assigned to this batch
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Students in this batch
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Admin who created
}, { timestamps: true });

module.exports = mongoose.model('Batch', BatchSchema);

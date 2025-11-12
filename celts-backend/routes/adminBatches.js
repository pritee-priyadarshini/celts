// routes/adminBatches.js
const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/**
 * GET /api/admin/batches
 * - Admin (or authorized roles) fetches all batches
 * - Returns populated faculty names + student counts (friendly for frontend)
 */
router.get('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const batches = await Batch.find({})
      .populate({ path: 'faculty', select: 'name email' })
      .populate({ path: 'students', select: 'name email' })
      .sort({ createdAt: -1 })
      .lean();

    // normalize to frontend-friendly shape
    const out = batches.map(b => ({
      _id: b._id,
      name: b.name,
      program: b.program,
      year: b.year,
      section: b.section,
      createdAt: b.createdAt,
      faculty: Array.isArray(b.faculty) ? b.faculty.map(f => (f ? (f.name || f.email || String(f._id)) : null)).filter(Boolean) : [],
      students: Array.isArray(b.students) ? b.students.map(s => (s ? (s.name || s.email || String(s._id)) : null)).filter(Boolean) : []
    }));

    res.json(out);
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ message: 'Server error fetching batches' });
  }
});

/**
 * POST /api/admin/batches
 * - Create a new batch
 * - Returns the created batch (populated friendly shape)
 */
router.post('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { name, program, year, section } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Batch name is required' });

    const newBatch = await Batch.create({
      name: name.trim(),
      program,
      year,
      section,
      createdBy: req.user?._id
    });

    // populate for response
    const populated = await Batch.findById(newBatch._id)
      .populate({ path: 'faculty', select: 'name email' })
      .populate({ path: 'students', select: 'name email' })
      .lean();

    const out = {
      _id: populated._id,
      name: populated.name,
      program: populated.program,
      year: populated.year,
      section: populated.section,
      createdAt: populated.createdAt,
      faculty: Array.isArray(populated.faculty) ? populated.faculty.map(f => (f ? (f.name || f.email || String(f._id)) : null)).filter(Boolean) : [],
      students: Array.isArray(populated.students) ? populated.students.map(s => (s ? (s.name || s.email || String(s._id)) : null)).filter(Boolean) : []
    };

    // Return created object (so frontend can append immediately)
    res.status(201).json(out);
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(500).json({ message: 'Server error creating batch' });
  }
});

/**
 * POST /api/admin/batches/:batchId/assign-faculty/:facultyId
 * - Assign a faculty to a batch (adds if not present)
 */
router.post('/:batchId/assign-faculty/:facultyId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, facultyId } = req.params;

    // Validate user exists and is faculty
    const user = await User.findById(facultyId);
    if (!user) return res.status(404).json({ message: 'Faculty not found' });
    if (user.role !== 'faculty') return res.status(400).json({ message: 'User is not a faculty' });

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // Add if not already present
    if (!batch.faculty.some(f => String(f) === String(facultyId))) {
      batch.faculty.push(facultyId);
      await batch.save();
    }

    // Return updated populated batch
    const populated = await Batch.findById(batch._id).populate({ path: 'faculty', select: 'name email' }).populate({ path: 'students', select: 'name email' }).lean();
    res.json({
      message: 'Faculty assigned to batch',
      batch: populated
    });
  } catch (err) {
    console.error('Error assigning faculty:', err);
    res.status(500).json({ message: 'Server error assigning faculty' });
  }
});

/**
 * POST /api/admin/batches/:batchId/assign-student/:studentId
 * - Assign a student to a batch (adds if not present)
 */
router.post('/:batchId/assign-student/:studentId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, studentId } = req.params;

    // Validate user exists and is student
    const user = await User.findById(studentId);
    if (!user) return res.status(404).json({ message: 'Student not found' });
    if (user.role !== 'student') return res.status(400).json({ message: 'User is not a student' });

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // Add if not already present
    if (!batch.students.some(s => String(s) === String(studentId))) {
      batch.students.push(studentId);
      await batch.save();
    }

    const populated = await Batch.findById(batch._id).populate({ path: 'faculty', select: 'name email' }).populate({ path: 'students', select: 'name email' }).lean();
    res.json({
      message: 'Student assigned to batch',
      batch: populated
    });
  } catch (err) {
    console.error('Error assigning student:', err);
    res.status(500).json({ message: 'Server error assigning student' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/**
 * GET /api/admin/batches
 */
router.get('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const batches = await Batch.find({})
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' })
      .sort({ createdAt: -1 })
      .lean();

    const out = batches.map(b => ({
      _id: b._id,
      name: b.name,
      program: b.program,
      year: b.year,
      section: b.section,
      createdAt: b.createdAt,
      faculty: Array.isArray(b.faculty)
        ? b.faculty.map(f => f?.name || f?.email || String(f?._id))
        : [],
      students: Array.isArray(b.students)
        ? b.students.map(s => s?.name || s?.email || String(s?._id))
        : []
    }));

    res.json(out);
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ message: 'Server error fetching batches' });
  }
});

/**
 * POST /api/admin/batches
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

    const populated = await Batch.findById(newBatch._id)
      .populate({ path: 'faculty', select: 'name email' })
      .populate({ path: 'students', select: 'name email' })
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(500).json({ message: 'Server error creating batch' });
  }
});

/**
 * PUT /api/admin/batches/:id
 * - Update batch details
 */
router.put('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, program, year, section } = req.body;

    const updated = await Batch.findByIdAndUpdate(
      id,
      { name, program, year, section },
      { new: true, runValidators: true }
    )
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' });

    if (!updated) return res.status(404).json({ message: 'Batch not found' });

    res.json(updated);
  } catch (err) {
    console.error('Error updating batch:', err);
    res.status(500).json({ message: 'Server error updating batch' });
  }
});

/**
 * DELETE /api/admin/batches/:id
 * - Delete a batch
 */
router.delete('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Batch.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Batch not found' });
    res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('Error deleting batch:', err);
    res.status(500).json({ message: 'Server error deleting batch' });
  }
});

/**
 * POST /api/admin/batches/:batchId/assign-faculty/:facultyId
 * - Assign or replace faculty for a batch (only one allowed)
 */
router.post('/:batchId/assign-faculty/:facultyId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, facultyId } = req.params;

    const faculty = await User.findById(facultyId);
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });
    if (faculty.role !== 'faculty') return res.status(400).json({ message: 'User is not a faculty' });

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // ✅ Only one faculty allowed — replace existing
    batch.faculty = [facultyId];
    await batch.save();

    const populated = await Batch.findById(batch._id)
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' })
      .lean();

    res.json({ message: 'Faculty assigned successfully', batch: populated });
  } catch (err) {
    console.error('Error assigning faculty:', err);
    res.status(500).json({ message: 'Server error assigning faculty' });
  }
});

/**
 * POST /api/admin/batches/:batchId/assign-student/:studentId
 * - Assign a student to a batch (only one batch per student allowed)
 */
router.post('/:batchId/assign-student/:studentId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, studentId } = req.params;

    // ✅ Validate student existence and role
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (student.role !== 'student') return res.status(400).json({ message: 'User is not a student' });

    // ✅ Validate batch existence
    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // ✅ Check if student already belongs to another batch
    const existingBatch = await Batch.findOne({ students: studentId });
    if (existingBatch && String(existingBatch._id) !== String(batchId)) {
      return res.status(400).json({
        message: `Student is already assigned to batch "${existingBatch.name}". Unassign first before adding to another batch.`
      });
    }

    // ✅ Add only if not already in current batch
    if (!batch.students.some(s => String(s) === String(studentId))) {
      batch.students.push(studentId);
      await batch.save();
    }

    const populated = await Batch.findById(batch._id)
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' })
      .lean();

    res.json({ message: 'Student assigned successfully', batch: populated });
  } catch (err) {
    console.error('Error assigning student:', err);
    res.status(500).json({ message: 'Server error assigning student' });
  }
});



/**
 * DELETE /api/admin/batches/:batchId/unassign-student/:studentId
 * - Removes a student from a batch
 */
router.delete('/:batchId/unassign-student/:studentId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, studentId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const beforeCount = batch.students.length;
    batch.students = batch.students.filter(sid => String(sid) !== String(studentId));
    if (batch.students.length === beforeCount) {
      return res.status(400).json({ message: 'Student not found in this batch' });
    }

    await batch.save();

    const populated = await Batch.findById(batch._id)
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' })
      .lean();

    res.json({ message: 'Student removed from batch', batch: populated });
  } catch (err) {
    console.error('Error unassigning student:', err);
    res.status(500).json({ message: 'Server error unassigning student' });
  }
});


// In routes for admin batches (same file you sent)

// GET /api/admin/batches/:id  -> returns full populated objects (with _id)
router.get('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findById(id)
      .populate({ path: 'faculty', select: '_id name email systemId' })
      .populate({ path: 'students', select: '_id name email systemId' })
      .lean();

    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // return as-is (populated arrays with _id) so the frontend gets ids
    return res.json({
      _id: batch._id,
      name: batch.name,
      program: batch.program,
      year: batch.year,
      section: batch.section,
      createdAt: batch.createdAt,
      faculty: Array.isArray(batch.faculty)
        ? batch.faculty.map(f => ({
            _id: f._id,
            name: f.name,
            email: f.email,
            systemId: f.systemId
          }))
        : [],
      students: Array.isArray(batch.students)
        ? batch.students.map(s => ({
            _id: s._id,
            name: s.name,
            email: s.email,
            systemId: s.systemId
          }))
        : []
    });
  } catch (err) {
    console.error('Error fetching batch detail:', err);
    res.status(500).json({ message: 'Server error fetching batch detail' });
  }
});




module.exports = router;

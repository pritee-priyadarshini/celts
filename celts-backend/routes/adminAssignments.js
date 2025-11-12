// routes/adminAssignments.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// helper
function removeStudentIdFromArray(arr, studentId) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(id => id.toString() !== studentId.toString());
}

function isValidId(id) { return mongoose.Types.ObjectId.isValid(id); }

router.post('/faculty-batch', protect, restrictTo(['admin']), async (req, res) => {
  const { facultyId, cohort } = req.body;
  if (!facultyId || !cohort) return res.status(400).json({ message: 'facultyId and cohort required' });
  if (!isValidId(facultyId)) return res.status(400).json({ message: 'invalid facultyId' });
  try {
    const faculty = await User.findById(facultyId);
    if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ message: 'Faculty not found' });
    faculty.cohort = cohort; await faculty.save();
    return res.json({ message: 'cohort assigned', faculty: faculty.toJSON() });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

router.post('/student-to-faculty', protect, restrictTo(['admin']), async (req, res) => {
  const { studentId, facultyId } = req.body;
  if (!studentId || !facultyId) return res.status(400).json({ message: 'studentId and facultyId required' });
  if (!isValidId(studentId) || !isValidId(facultyId)) return res.status(400).json({ message: 'invalid id' });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const student = await User.findById(studentId).session(session);
    const newFaculty = await User.findById(facultyId).session(session);
    if (!student || student.role !== 'student') { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Student not found' }); }
    if (!newFaculty || newFaculty.role !== 'faculty') { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Faculty not found' }); }

    const oldFacultyId = student.assignedFaculty ? student.assignedFaculty.toString() : null;
    student.assignedFaculty = newFaculty._id;
    if (newFaculty.cohort) student.cohort = newFaculty.cohort;
    await student.save({ session });

    if (!Array.isArray(newFaculty.students)) newFaculty.students = [];
    if (!newFaculty.students.find(id => id.toString() === student._id.toString())) {
      newFaculty.students.push(student._id);
      await newFaculty.save({ session });
    }

    if (oldFacultyId && oldFacultyId !== newFaculty._id.toString()) {
      const oldFaculty = await User.findById(oldFacultyId).session(session);
      if (oldFaculty) { oldFaculty.students = removeStudentIdFromArray(oldFaculty.students, student._id); await oldFaculty.save({ session }); }
    }

    await session.commitTransaction(); session.endSession();

    const updatedStudent = await User.findById(student._id).select('-password').populate('assignedFaculty','name email cohort');
    const updatedFaculty = await User.findById(newFaculty._id).select('-password').populate('students','name email cohort');

    return res.json({ message: 'assigned', student: updatedStudent, faculty: updatedFaculty });
  } catch (err) {
    await session.abortTransaction().catch(()=>{}); session.endSession();
    // fallback non-transactional (best-effort)
    try {
      const student = await User.findById(studentId);
      const newFaculty = await User.findById(facultyId);
      student.assignedFaculty = newFaculty._id; if (newFaculty.cohort) student.cohort = newFaculty.cohort; await student.save();
      if (!Array.isArray(newFaculty.students)) newFaculty.students = [];
      if (!newFaculty.students.find(id => id.toString()===student._id.toString())) { newFaculty.students.push(student._id); await newFaculty.save(); }
      if (student.assignedFaculty && student.assignedFaculty.toString() !== newFaculty._id.toString()) {
        const oldFaculty = await User.findById(student.assignedFaculty);
        if (oldFaculty) { oldFaculty.students = removeStudentIdFromArray(oldFaculty.students, student._id); await oldFaculty.save(); }
      }
      const updatedStudent = await User.findById(student._id).select('-password').populate('assignedFaculty','name email cohort');
      const updatedFaculty = await User.findById(newFaculty._id).select('-password').populate('students','name email cohort');
      return res.json({ message: 'assigned (fallback)', student: updatedStudent, faculty: updatedFaculty });
    } catch (err2) {
      return res.status(500).json({ message: 'assignment failed', details: err2.message });
    }
  }
});

router.post('/unassign-student', protect, restrictTo(['admin']), async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'studentId required' });
  if (!isValidId(studentId)) return res.status(400).json({ message: 'invalid id' });
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const student = await User.findById(studentId).session(session);
    if (!student || student.role !== 'student') { await session.abortTransaction(); session.endSession(); return res.status(404).json({message:'Student not found'}); }
    const oldFacultyId = student.assignedFaculty ? student.assignedFaculty.toString() : null;
    student.assignedFaculty = undefined; await student.save({ session });
    if (oldFacultyId) {
      const oldFaculty = await User.findById(oldFacultyId).session(session);
      if (oldFaculty) { oldFaculty.students = removeStudentIdFromArray(oldFaculty.students, student._id); await oldFaculty.save({ session }); }
    }
    await session.commitTransaction(); session.endSession();
    const updatedStudent = await User.findById(student._id).select('-password');
    return res.json({ message: 'unassigned', student: updatedStudent });
  } catch (err) {
    await session.abortTransaction().catch(()=>{}); session.endSession();
    // fallback
    try {
      const student = await User.findById(studentId);
      if (!student || student.role !== 'student') return res.status(404).json({ message: 'Student not found' });
      const oldFacultyId = student.assignedFaculty ? student.assignedFaculty.toString() : null;
      student.assignedFaculty = undefined; await student.save();
      if (oldFacultyId) {
        const oldFaculty = await User.findById(oldFacultyId);
        if (oldFaculty) { oldFaculty.students = removeStudentIdFromArray(oldFaculty.students, student._id); await oldFaculty.save(); }
      }
      const updatedStudent = await User.findById(student._id).select('-password');
      return res.json({ message: 'unassigned (fallback)', student: updatedStudent });
    } catch (err2) {
      return res.status(500).json({ message: 'unassign failed', details: err2.message });
    }
  }
});

router.get('/faculty/:facultyId/students', protect, restrictTo(['admin','faculty']), async (req, res) => {
  const facultyId = req.params.facultyId;
  if (!isValidId(facultyId)) return res.status(400).json({ message: 'invalid id' });
  try {
    const faculty = await User.findById(facultyId).select('-password').populate('students','name email cohort');
    if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ message: 'Faculty not found' });
    if (req.user.role === 'faculty' && req.user._id.toString() !== facultyId) return res.status(403).json({ message: 'Forbidden' });
    return res.json({ faculty: { id: faculty._id, name: faculty.name, cohort: faculty.cohort }, students: faculty.students || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/faculties', protect, restrictTo(['admin']), async (req, res) => {
  const { cohort } = req.query;
  const filter = { role: 'faculty' }; if (cohort) filter.cohort = cohort;
  try {
    const faculties = await User.find(filter).select('-password').lean();
    const withCounts = await Promise.all(faculties.map(async f => {
      const count = await User.countDocuments({ assignedFaculty: f._id });
      return { ...f, studentCount: count };
    }));
    return res.json(withCounts);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;

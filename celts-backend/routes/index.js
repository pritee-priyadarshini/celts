// routes/index.js
// Main router - SRS-compliant entry points and a few admin endpoints kept here.
// Replace your existing file with this one.

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../models/User');
const TestSet = require('../models/TestSet');
const Submission = require('../models/Submission');

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { submissionQueue } = require('../services/queue'); // queue (fallback inline if no Redis)
const { rawToBand } = require('../utils/scoring'); // if needed elsewhere

// additional routers you already created
const adminAssignRoutes = require('./adminAssignments');
const adminBulkRoutes = require('./adminBulk');
const proctorRoutes = require('./proctor');
const mediaRoutes = require('./media');
const facultyRoutes = require('./faculty');
const studentRoutes = require('./student');
const authRoutes = require('./auth'); 
const adminBatchRoutes = require('./adminBatches');




// Helper: generate JWT token
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// Root health check
router.get('/', (req, res) => res.json({ message: 'CELTS Backend running successfully!', timestamp: Date.now() }));

// Mount other routers (these files should exist and export a router)
router.use('/auth', require('./auth'));
router.use('/admin/assign', adminAssignRoutes);
router.use('/admin/bulk', adminBulkRoutes);
router.use('/proctor', proctorRoutes);
router.use('/media', mediaRoutes);
router.use('/faculty', facultyRoutes);
router.use('/student', studentRoutes);
router.use('/admin/batches', adminBatchRoutes);


// ---------- ADMIN: Get user ----------
router.get('/admin/users', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});



// ---------- ADMIN: Create / Onboard user (enhanced with optional immediate assignment) ----------
router.post('/admin/users', protect, restrictTo(['admin']), async (req, res) => {
  const { name, email, systemId,  password, role, canEditScores = false, assignedFaculty, cohort } = req.body;
  try {
    if (!name || !email || !systemId || !password) return res.status(400).json({ message: 'name, email, id and password are required' });

    if (await User.findOne({ email })) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
      name,
      email,
      systemId,
      password,
      role,
      facultyPermissions: { canEditScores },
      cohort: cohort || ''
    });

    // If admin provided assignedFaculty for a student, attach bidirectionally (best-effort)
    if (assignedFaculty && role === 'student' && mongoose.Types.ObjectId.isValid(assignedFaculty)) {
      const faculty = await User.findById(assignedFaculty);
      if (faculty && faculty.role === 'faculty') {
        user.assignedFaculty = faculty._id;
        await user.save();
        if (!Array.isArray(faculty.students)) faculty.students = [];
        if (!faculty.students.find(id => id.toString() === user._id.toString())) {
          faculty.students.push(user._id);
          await faculty.save();
        }
      }
    }

    return res.status(201).json({ message: `${role} account created successfully.`, user: user.toJSON() });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ message: 'Error creating user', details: error.message });
  }
});


// ---------- ADMIN: Update user ----------
router.put('/admin/users/:id', protect, restrictTo(['admin']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const allowed = ['name', 'email', 'systemId', 'role', 'cohort', 'assignedFaculty', 'facultyPermissions'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If facultyPermissions passed as an object, only accept canEditScores boolean
    if (updates.facultyPermissions && typeof updates.facultyPermissions === 'object') {
      updates.facultyPermissions = { canEditScores: Boolean(updates.facultyPermissions.canEditScores) };
    }

    // If changing assignedFaculty ensure valid faculty id or null
    if (updates.assignedFaculty) {
      if (!mongoose.Types.ObjectId.isValid(updates.assignedFaculty)) {
        return res.status(400).json({ message: 'Invalid assignedFaculty id' });
      }
      const fac = await User.findById(updates.assignedFaculty);
      if (!fac || fac.role !== 'faculty') return res.status(400).json({ message: 'Assigned user is not a faculty' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Keep track of old assignedFaculty to update reverse refs if needed
    const oldAssigned = user.assignedFaculty ? user.assignedFaculty.toString() : null;

    // apply updates
    Object.assign(user, updates);
    await user.save();

    // If assignedFaculty changed and user is a student -> ensure bidirectional ref
    if (user.role === 'student') {
      const newAssigned = user.assignedFaculty ? user.assignedFaculty.toString() : null;
      if (oldAssigned !== newAssigned) {
        // remove from old faculty.students
        if (oldAssigned && mongoose.Types.ObjectId.isValid(oldAssigned)) {
          const oldFac = await User.findById(oldAssigned);
          if (oldFac && Array.isArray(oldFac.students)) {
            oldFac.students = oldFac.students.filter(sid => sid.toString() !== user._id.toString());
            await oldFac.save();
          }
        }
        // add to new faculty.students
        if (newAssigned && mongoose.Types.ObjectId.isValid(newAssigned)) {
          const newFac = await User.findById(newAssigned);
          if (newFac && newFac.role === 'faculty') {
            newFac.students = newFac.students || [];
            if (!newFac.students.find(sid => sid.toString() === user._id.toString())) {
              newFac.students.push(user._id);
              await newFac.save();
            }
          }
        }
      }
    }

    const out = user.toObject();
    delete out.password;
    res.json({ message: 'User updated', user: out });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user', details: error.message });
  }
});


// ---------- ADMIN: Delete User ----------
router.delete('/admin/users/:id', protect, restrictTo(['admin']), async (req, res) => {
  const id = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clean up relationships if needed
    if (user.role === 'student' && user.assignedFaculty) {
      await User.updateOne(
        { _id: user.assignedFaculty },
        { $pull: { students: user._id } }
      );
    }

    if (user.role === 'faculty' && Array.isArray(user.students) && user.students.length > 0) {
      await User.updateMany(
        { _id: { $in: user.students } },
        { $unset: { assignedFaculty: "" } }
      );
    }

    // ✅ Use modern delete method
    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user', details: error.message });
  }
});




// ---------- ADMIN: Update faculty permissions ----------
router.patch('/admin/faculty/:id/permissions', protect, restrictTo(['admin']), async (req, res) => {
  const { canEditScores } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid faculty id' });
    const faculty = await User.findById(req.params.id);
    if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ message: 'Faculty user not found' });
    faculty.facultyPermissions.canEditScores = Boolean(canEditScores);
    await faculty.save();
    return res.json({ message: `Faculty ${faculty.name} permissions updated. Can edit scores: ${faculty.facultyPermissions.canEditScores}` });
  } catch (error) {
    console.error('Update faculty permissions error:', error);
    return res.status(500).json({ message: 'Error updating permissions', details: error.message });
  }
});

// ---------- ADMIN: Analytics (simple live metrics) ----------
router.get('/admin/analytics', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTests = await TestSet.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
    // Example additional metric: average band across all submissions with band > 0
    const agg = await Submission.aggregate([
      { $match: { bandScore: { $gt: 0 } } },
      { $group: { _id: null, avgBand: { $avg: '$bandScore' } } }
    ]);
    const avgOverallBandScore = (agg[0] && agg[0].avgBand) ? Number(agg[0].avgBand.toFixed(2)) : null;

    return res.json({
      totalUsers,
      totalTests,
      totalSubmissions,
      avgOverallBandScore: avgOverallBandScore || 6.5,
      completionRate: '78%', // keep mocked for now
      message: 'Comprehensive analytics dashboard data.'
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ message: 'Error generating analytics', details: error.message });
  }
});

// ---------- Student submission status endpoint (helpful for async processing) ----------
router.get('/student/submission/:id/status', protect, restrictTo(['student']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid submission id' });
    const submission = await Submission.findById(id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (submission.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
    return res.json({ status: submission.status, bandScore: submission.bandScore, aiFeedback: submission.aiFeedback });
  } catch (error) {
    console.error('Submission status error:', error);
    return res.status(500).json({ message: 'Error fetching submission status', details: error.message });
  }
});

// Admin or faculty with permission might want to re-run scoring (useful for debugging).
router.post('/admin/submission/:id/reprocess', protect, restrictTo(['admin','faculty']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid submission id' });
    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ message: 'Submission not found' });

    // Enqueue processing again
    const jobData = {
      submissionId: sub._id.toString(),
      studentId: sub.student.toString(),
      testId: sub.testSet.toString(),
      skill: sub.skill,
      response: sub.response
    };
    const job = await submissionQueue.add(jobData);
    return res.json({ message: 'Reprocess job queued', jobId: job.id || null });
  } catch (error) {
    console.error('Reprocess submission error:', error);
    return res.status(500).json({ message: 'Error queuing reprocess', details: error.message });
  }
});

module.exports = router;

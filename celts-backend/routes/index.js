// routes/index.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const TestSet = require('../models/TestSet');
const Submission = require('../models/Submission');

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { submissionQueue } = require('../services/queue');

const adminAssignRoutes = require('./adminAssignments');
const adminBulkRoutes = require('./adminBulk');
const adminBatchRoutes = require('./adminBatches');
const proctorRoutes = require('./proctor');
const mediaRoutes = require('./media');
const facultyRoutes = require('./faculty');
const studentRoutes = require('./student');
const teacherTestsRoutes = require('./teacherTests');
const studentStatsRoutes = require('./studentStats');

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
router.use('/teacher/tests', teacherTestsRoutes);
router.use('/student', studentStatsRoutes);
router.use('/studentStats', studentStatsRoutes);



// ADMIN: Get user
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



// ADMIN: Create / Onboard user (enhanced with optional immediate assignment)
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


// ADMIN: Update user
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


// ADMIN: Delete User
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

    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user', details: error.message });
  }
});


// ADMIN: Reset user password
router.patch('/admin/users/:id/password', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!newPassword || newPassword.length < 4) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 4 characters.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;

    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[Admin change password] error:', err);
    return res
      .status(500)
      .json({ message: 'Server error updating password' });
  }
}
);



// ADMIN: Update faculty permissions 
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



// ADMIN: Analytics (simple live metrics)
router.get('/admin/analytics', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTests = await TestSet.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
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
      message: 'Comprehensive analytics dashboard data.'
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ message: 'Error generating analytics', details: error.message });
  }
});



// Student submission status endpoint 
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



// Admin or faculty with permission might want to re-run scoring 
router.post('/admin/submission/:id/reprocess', protect, restrictTo(['admin', 'faculty']), async (req, res) => {
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


// GET /api/admin/tests
router.get("/admin/tests", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const tests = await TestSet.find({})
      .populate("createdBy", "name systemId")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      tests: tests.map((t) => ({
        _id: t._id,
        title: t.title,
        description: t.description || "",
        type: t.type,
        timeLimitMinutes: t.timeLimitMinutes || null,
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        readingSections: t.readingSections || [],
        listeningSections: t.listeningSections || [],
        questions: t.questions || [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        assignedBatches: t.assignedBatches || [],
        assignedStudents: t.assignedStudents || [],
        createdBy: t.createdBy
          ? {
            _id: t.createdBy._id,
            name: t.createdBy.name,
            systemId: t.createdBy.systemId,
          }
          : null,
      })),
    });
  } catch (err) {
    console.error("[GET /admin/tests] error:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching test sets" });
  }
}
);

// GET /api/admin/tests/:id
router.get("/admin/tests/:id", protect, restrictTo(["admin"]), async (req, res) => {
  const { id } = req.params;

  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid test id" });
  }

  try {
    const test = await TestSet.findById(id)
      .populate("createdBy", "name systemId")
      .lean();

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    return res.json({
      _id: test._id,
      title: test.title,
      description: test.description || "",
      type: test.type,
      timeLimitMinutes: test.timeLimitMinutes || null,
      startTime: test.startTime || null,
      endTime: test.endTime || null,
      readingSections: test.readingSections || [],
      listeningSections: test.listeningSections || [],
      questions: test.questions || [],
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      assignedBatches: test.assignedBatches || [],
      assignedStudents: test.assignedStudents || [],
      createdBy: test.createdBy
        ? {
          _id: test.createdBy._id,
          name: test.createdBy.name,
          systemId: test.createdBy.systemId,
        }
        : null,
    });
  } catch (err) {
    console.error("[GET /admin/tests/:id] error:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching test set" });
  }
}
);


module.exports = router;
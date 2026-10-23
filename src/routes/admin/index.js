const express = require('express');
const User = require('../../models/User');
const Teacher = require('../../models/Teacher');
const Course = require('../../models/Course');
const Lecture = require('../../models/Lecture');
const Homework = require('../../models/Homework');
const Package = require('../../models/Package');
const Subscription = require('../../models/Subscription');
const AuditLog = require('../../models/AuditLog');
const { STAFF_ROLES } = require('../../config');
const catchAsync = require('../../utils/catchAsync');
const { addDays } = require('../../utils/helpers');
const { authenticate, requireRole, teacherScope } = require('../../middleware/auth');
const { courses, lectures, homework, packages } = require('./resources');

const router = express.Router();
router.use(authenticate, requireRole(...STAFF_ROLES));

router.use('/teachers', require('./teachers'));
router.use('/users', require('./users'));
router.use('/subscriptions', require('./subscriptions'));
router.use('/courses', courses);
router.use('/lectures', lectures);
router.use('/homework', homework);
router.use('/packages', packages);

router.get('/stats', catchAsync(async (req, res) => {
  const sup = req.user.role === 'super_admin';
  const scope = teacherScope(req.user);
  const live = { ...scope, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
  const [courseN, lectureN, homeworkN, packageN, activeSubs, rev] = await Promise.all([
    Course.countDocuments(scope), Lecture.countDocuments(scope), Homework.countDocuments(scope),
    Package.countDocuments(scope), Subscription.countDocuments(live),
    Subscription.aggregate([{ $match: scope }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
  ]);
  const out = { courses: courseN, lectures: lectureN, homework: homeworkN, packages: packageN, activeSubs, revenue: rev[0]?.total || 0 };
  if (sup) {
    [out.students, out.teachers, out.newStudents7d] = await Promise.all([
      User.countDocuments({ role: 'student' }), Teacher.countDocuments(),
      User.countDocuments({ role: 'student', createdAt: { $gte: addDays(-7) } }),
    ]);
  } else {
    out.students = (await Subscription.distinct('user', scope)).length;
  }
  res.json({ status: 'ok', stats: out });
}));

router.get('/audit', requireRole('super_admin'), catchAsync(async (req, res) => {
  const q = {};
  if (typeof req.query.entity === 'string' && /^\w+$/.test(req.query.entity)) q.entity = req.query.entity;
  const items = await AuditLog.find(q).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ status: 'ok', items });
}));

module.exports = router;

const express = require('express');
const Course = require('../models/Course');
const Lecture = require('../models/Lecture');
const Homework = require('../models/Homework');
const Package = require('../models/Package');
const Subscription = require('../models/Subscription');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { accessibleCourseIds } = require('../utils/access');
const { authenticate, requireRole } = require('../middleware/auth');
const { idParam } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate, requireRole('student'));
router.param('id', idParam);

// كل كورسات سنة الطالب (المقفول ظاهر بعلامة قفل عشان يشوف الباقات)
router.get('/courses', catchAsync(async (req, res) => {
  const [{ ids }, courses] = await Promise.all([
    accessibleCourseIds(req.user._id),
    Course.find({ grade: req.user.grade, isPublished: true }).sort({ order: 1, createdAt: 1 })
      .populate('teacher', 'name slug subject isActive').lean(),
  ]);
  const list = courses.filter((c) => c.teacher?.isActive);
  const counts = await Lecture.aggregate([
    { $match: { course: { $in: list.map((c) => c._id) }, isPublished: true } },
    { $group: { _id: '$course', n: { $sum: 1 }, free: { $sum: { $cond: ['$isFree', 1, 0] } } } },
  ]);
  const m = new Map(counts.map((c) => [String(c._id), c]));
  res.json({
    status: 'ok',
    courses: list.map((c) => ({
      id: c._id, title: c.title, description: c.description,
      teacher: { name: c.teacher.name, slug: c.teacher.slug, subject: c.teacher.subject },
      unlocked: ids.has(String(c._id)),
      lectures: m.get(String(c._id))?.n || 0,
      freeLectures: m.get(String(c._id))?.free || 0,
    })),
  });
}));

// محاضرات كورس (من غير ID الفيديو)
router.get('/courses/:id/lectures', catchAsync(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.id, grade: req.user.grade, isPublished: true })
    .populate('teacher', 'name slug isActive');
  if (!course || !course.teacher?.isActive) throw new AppError(404, 'الكورس غير موجود', 'NOT_FOUND');
  const { ids } = await accessibleCourseIds(req.user._id);
  const unlocked = ids.has(String(course._id));
  const lectures = await Lecture.find({ course: course._id, isPublished: true })
    .sort({ order: 1, createdAt: 1 }).select('-youtubeId').lean();
  res.json({
    status: 'ok',
    course: { id: course._id, title: course.title, description: course.description, teacher: course.teacher.name, teacherSlug: course.teacher.slug, unlocked },
    lectures: lectures.map((l) => ({
      id: l._id, title: l.title, description: l.description, durationMin: l.durationMin,
      isFree: l.isFree, locked: !unlocked && !l.isFree,
    })),
  });
}));

// مشاهدة محاضرة: هنا بس بيتبعت رابط الفيديو، وبعد التأكد من الاشتراك
router.get('/lectures/:id', catchAsync(async (req, res) => {
  const lec = await Lecture.findOne({ _id: req.params.id, isPublished: true })
    .populate('course', 'title grade isPublished');
  if (!lec || !lec.course?.isPublished || lec.course.grade !== req.user.grade) throw new AppError(404, 'المحاضرة غير موجودة', 'NOT_FOUND');
  if (!(await Teacher.exists({ _id: lec.teacher, isActive: true }))) throw new AppError(404, 'المحاضرة غير موجودة', 'NOT_FOUND');

  let allowed = lec.isFree;
  if (!allowed) allowed = (await accessibleCourseIds(req.user._id)).ids.has(String(lec.course._id));
  if (!allowed) throw new AppError(403, 'المحاضرة دي محتاجة اشتراك في باقة', 'NO_SUBSCRIPTION');

  res.json({
    status: 'ok',
    lecture: {
      id: lec._id, title: lec.title, description: lec.description,
      courseId: lec.course._id, courseTitle: lec.course.title,
      embedUrl: `https://www.youtube-nocookie.com/embed/${lec.youtubeId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=1`,
    },
  });
}));

router.get('/homework', catchAsync(async (req, res) => {
  const { ids } = await accessibleCourseIds(req.user._id);
  const items = await Homework.find({ course: { $in: [...ids] }, isPublished: true })
    .sort({ dueDate: 1, createdAt: -1 })
    .populate('course', 'title').populate('teacher', 'name').populate('lecture', 'title').lean();
  res.json({ status: 'ok', items });
}));

router.get('/subscriptions', catchAsync(async (req, res) => {
  const subs = await Subscription.find({ user: req.user._id }).sort({ createdAt: -1 })
    .populate('package', 'title grade').populate('teacher', 'name slug').lean();
  const now = Date.now();
  res.json({
    status: 'ok',
    items: subs.map((s) => ({ ...s, active: !s.expiresAt || new Date(s.expiresAt).getTime() > now })),
  });
}));

// الباقات المتاحة لسنة الطالب
router.get('/packages', catchAsync(async (req, res) => {
  const [pkgs, { subs }] = await Promise.all([
    Package.find({ grade: req.user.grade, isActive: true }).sort({ order: 1, price: 1 })
      .populate('teacher', 'name slug subject isActive').lean(),
    accessibleCourseIds(req.user._id),
  ]);
  const owned = new Set(subs.map((s) => String(s.package?._id)));
  res.json({
    status: 'ok',
    items: pkgs.filter((p) => p.teacher?.isActive).map((p) => ({
      id: p._id, title: p.title, description: p.description, price: p.price, durationDays: p.durationDays || null,
      teacher: { name: p.teacher.name, slug: p.teacher.slug, subject: p.teacher.subject },
      owned: owned.has(String(p._id)),
    })),
  });
}));

module.exports = router;

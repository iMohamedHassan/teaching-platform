const express = require('express');
const Teacher = require('../models/Teacher');
const Package = require('../models/Package');
const Lecture = require('../models/Lecture');
const cfg = require('../config');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.get('/meta', (req, res) => {
  res.json({ status: 'ok', brand: cfg.brandName, grades: cfg.GRADES, whatsapp: cfg.whatsapp });
});

router.get('/teachers', catchAsync(async (req, res) => {
  const items = await Teacher.find({ isActive: true }).sort({ order: 1, createdAt: 1 })
    .select('name slug subject photoUrl grades').lean();
  res.json({ status: 'ok', items });
}));

router.get('/teachers/:slug', catchAsync(async (req, res) => {
  const slug = String(req.params.slug).toLowerCase();
  const t = await Teacher.findOne({ slug, isActive: true }).select('name slug subject bio photoUrl grades').lean();
  if (!t) throw new AppError(404, 'المدرس غير موجود', 'NOT_FOUND');

  const pkgs = await Package.find({ teacher: t._id, isActive: true }).sort({ order: 1, price: 1 })
    .populate('courses', 'title').lean();
  const idMap = new Map();
  pkgs.forEach((p) => p.courses.forEach((c) => idMap.set(String(c._id), c._id)));
  const counts = await Lecture.aggregate([
    { $match: { course: { $in: [...idMap.values()] }, isPublished: true } },
    { $group: { _id: '$course', n: { $sum: 1 } } },
  ]);
  const n = new Map(counts.map((c) => [String(c._id), c.n]));

  res.json({
    status: 'ok',
    teacher: t,
    packages: pkgs.map((p) => ({
      id: p._id, title: p.title, description: p.description, price: p.price, grade: p.grade,
      durationDays: p.durationDays || null,
      courses: p.courses.map((c) => c.title),
      lectures: p.courses.reduce((a, c) => a + (n.get(String(c._id)) || 0), 0),
    })),
  });
}));

module.exports = router;

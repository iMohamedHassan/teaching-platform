const express = require('express');
const { z } = require('zod');
const User = require('../../models/User');
const Session = require('../../models/Session');
const Subscription = require('../../models/Subscription');
const Teacher = require('../../models/Teacher');
const cfg = require('../../config');
const AppError = require('../../utils/AppError');
const catchAsync = require('../../utils/catchAsync');
const audit = require('../../utils/audit');
const { escapeRegex } = require('../../utils/helpers');
const { phone, password, oid } = require('../../utils/schemas');
const { requirePerm, requireRole } = require('../../middleware/auth');
const { validate, idParam } = require('../../middleware/validate');
const { sensitiveLimiter } = require('../../middleware/security');

const router = express.Router();
router.param('id', idParam);
const isSuper = (u) => u.role === 'super_admin';
const superOnly = requireRole('super_admin');

const listQuery = z.object({
  q: z.string().trim().max(60).optional(),
  role: z.enum(cfg.ROLES).optional(),
  grade: z.enum(cfg.GRADE_KEYS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const createSchema = z.object({
  name: z.string().trim().min(3).max(80), phone, password,
  role: z.enum(['assistant', 'student', 'parent']),
  teacher: oid.optional(), grade: z.enum(cfg.GRADE_KEYS).optional(), parentPhone: phone.optional(),
});
const updateSchema = z.object({
  name: z.string().trim().min(3).max(80), phone,
  grade: z.enum(cfg.GRADE_KEYS), parentPhone: phone.nullish(),
  isActive: z.boolean(), maxDevices: z.coerce.number().int().min(1).max(10),
  teacher: oid,
}).partial();

const slim = (u) => ({ ...u, devices: undefined, devicesCount: u.devices?.length || 0 });

// قائمة المستخدمين: السوبر أدمن كلهم، المدرس/المساعد طلاب اشتروا من مدرسه بس
router.get('/', requirePerm('students:read'), validate(listQuery, 'query'), catchAsync(async (req, res) => {
  const { q, role, grade, page, limit } = req.query;
  const filter = {};
  if (isSuper(req.user)) { if (role) filter.role = role; }
  else {
    filter.role = 'student';
    filter._id = { $in: await Subscription.distinct('user', { teacher: req.user.teacher }) };
  }
  if (grade) filter.grade = grade;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { phone: re }, { parentPhone: re }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('teacher', 'name').lean(),
    User.countDocuments(filter),
  ]);
  res.json({ status: 'ok', items: items.map(slim), total, page, pages: Math.ceil(total / limit) || 1 });
}));

// تفاصيل مستخدم: بياناته + اشتراكاته + أجهزته
router.get('/:id', requirePerm('students:read'), catchAsync(async (req, res) => {
  const u = await User.findById(req.params.id).populate('teacher', 'name').lean();
  if (!u) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  const subFilter = { user: u._id };
  if (!isSuper(req.user)) {
    subFilter.teacher = req.user.teacher;
    if (u.role !== 'student' || !(await Subscription.exists(subFilter))) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  }
  const subs = await Subscription.find(subFilter).sort({ createdAt: -1 })
    .populate('package', 'title grade price').populate('teacher', 'name').lean();
  const now = Date.now();
  res.json({
    status: 'ok',
    user: isSuper(req.user) ? u : { ...u, devices: undefined },
    subscriptions: subs.map((s) => ({ ...s, active: !s.expiresAt || new Date(s.expiresAt).getTime() > now })),
    sessions: isSuper(req.user) ? await Session.countDocuments({ user: u._id }) : undefined,
  });
}));

// ---- من هنا السوبر أدمن بس ----
router.post('/', superOnly, validate(createSchema), catchAsync(async (req, res) => {
  const { password: pw, ...data } = req.body;
  if (data.role === 'assistant') {
    if (!data.teacher || !(await Teacher.exists({ _id: data.teacher }))) throw new AppError(400, 'اختار المدرس اللي المساعد تابع له', 'VALIDATION');
  } else delete data.teacher;
  if (data.role === 'student' && !data.grade) throw new AppError(400, 'اختار السنة الدراسية للطالب', 'VALIDATION');
  if (await User.exists({ phone: data.phone })) throw new AppError(409, 'رقم الموبايل ده مستخدم بالفعل', 'DUPLICATE');
  const u = await User.create({ ...data, password: await User.hash(pw) });
  audit(req, 'create', 'user', u._id, { name: u.name, role: u.role });
  res.status(201).json({ status: 'ok', item: u.toPublic() });
}));

router.patch('/:id', superOnly, validate(updateSchema), catchAsync(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  if (req.body.isActive === false && u._id.equals(req.user._id)) throw new AppError(400, 'ماينفعش توقف حسابك انت', 'VALIDATION');
  if (req.body.teacher && u.role !== 'assistant') delete req.body.teacher;
  u.set(req.body);
  await u.save();
  if (req.body.isActive === false) await Session.deleteMany({ user: u._id });
  audit(req, 'update', 'user', u._id, { name: u.name, fields: Object.keys(req.body) });
  res.json({ status: 'ok', item: u.toPublic() });
}));

router.post('/:id/reset-password', superOnly, sensitiveLimiter, validate(z.object({ password })), catchAsync(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  u.password = await User.hash(req.body.password);
  u.failedLogins = 0; u.lockUntil = undefined;
  await u.save({ validateBeforeSave: false });
  await Session.deleteMany({ user: u._id });
  audit(req, 'reset-password', 'user', u._id, { name: u.name });
  res.json({ status: 'ok' });
}));

router.post('/:id/reset-devices', superOnly, catchAsync(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  u.devices = [];
  await u.save({ validateBeforeSave: false });
  await Session.deleteMany({ user: u._id });
  audit(req, 'reset-devices', 'user', u._id, { name: u.name });
  res.json({ status: 'ok' });
}));

router.post('/:id/unlock', superOnly, catchAsync(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } });
  if (!u) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  audit(req, 'unlock', 'user', u._id, { name: u.name });
  res.json({ status: 'ok' });
}));

router.delete('/:id', superOnly, sensitiveLimiter, catchAsync(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
  if (u._id.equals(req.user._id)) throw new AppError(400, 'ماينفعش تحذف حسابك', 'VALIDATION');
  if (u.role === 'super_admin') throw new AppError(400, 'ماينفعش حذف سوبر أدمن من هنا', 'VALIDATION');
  if (u.role === 'teacher') throw new AppError(400, 'احذف المدرس من صفحة المدرسين', 'VALIDATION');
  await Promise.all([Subscription.deleteMany({ user: u._id }), Session.deleteMany({ user: u._id })]);
  await u.deleteOne();
  audit(req, 'delete', 'user', u._id, { name: u.name, phone: u.phone, role: u.role });
  res.json({ status: 'ok' });
}));

module.exports = router;

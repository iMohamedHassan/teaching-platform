const express = require('express');
const { z } = require('zod');
const Teacher = require('../../models/Teacher');
const User = require('../../models/User');
const Session = require('../../models/Session');
const Course = require('../../models/Course');
const Lecture = require('../../models/Lecture');
const Homework = require('../../models/Homework');
const Package = require('../../models/Package');
const Subscription = require('../../models/Subscription');
const cfg = require('../../config');
const AppError = require('../../utils/AppError');
const catchAsync = require('../../utils/catchAsync');
const audit = require('../../utils/audit');
const { phone, password } = require('../../utils/schemas');
const { requireRole } = require('../../middleware/auth');
const { validate, idParam } = require('../../middleware/validate');
const { sensitiveLimiter } = require('../../middleware/security');

const router = express.Router();
router.param('id', idParam);

const teacherSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسم المدرس').max(80),
  slug: z.string().trim().toLowerCase().min(2).max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'الرابط بالإنجليزي: حروف صغيرة وأرقام وشرطة بس (مثال: mohamed-saad)')
    .refine((s) => !cfg.RESERVED_SLUGS.includes(s), 'الرابط ده محجوز للنظام، اختار غيره'),
  subject: z.string().trim().min(2, 'اكتب المادة').max(60),
  bio: z.string().trim().max(1000).nullish(),
  photoUrl: z.string().trim().url('رابط الصورة غير صحيح').max(500).refine((u) => /^https:\/\//.test(u), 'لازم الرابط يبدأ بـ https').nullish(),
  grades: z.array(z.enum(cfg.GRADE_KEYS)).optional(),
  revenueShare: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
});
const createSchema = teacherSchema.extend({ account: z.object({ phone, password }) });
const updateSchema = teacherSchema.partial();

// القراءة: السوبر أدمن كله، المدرس/المساعد مدرسه بس
router.get('/', catchAsync(async (req, res) => {
  const q = req.user.role === 'super_admin' ? {} : { _id: req.user.teacher };
  const items = await Teacher.find(q).sort({ order: 1, createdAt: 1 }).lean();
  const accounts = await User.find({ teacher: { $in: items.map((t) => t._id) }, role: 'teacher' }).select('phone teacher').lean();
  const byTeacher = new Map(accounts.map((a) => [String(a.teacher), a.phone]));
  res.json({ status: 'ok', items: items.map((t) => ({ ...t, accountPhone: byTeacher.get(String(t._id)) })) });
}));

const superOnly = requireRole('super_admin');

// إضافة مدرس = ملف المدرس + حساب دخول له
router.post('/', superOnly, validate(createSchema), catchAsync(async (req, res) => {
  const { account, ...data } = req.body;
  if (await User.exists({ phone: account.phone })) throw new AppError(409, 'رقم الموبايل ده مستخدم بالفعل', 'DUPLICATE');
  const t = await Teacher.create(data);
  try {
    await User.create({ name: data.name, phone: account.phone, password: await User.hash(account.password), role: 'teacher', teacher: t._id });
  } catch (e) { await t.deleteOne(); throw e; }
  audit(req, 'create', 'teacher', t._id, { name: t.name, slug: t.slug });
  res.status(201).json({ status: 'ok', item: t });
}));

router.patch('/:id', superOnly, validate(updateSchema), catchAsync(async (req, res) => {
  const t = await Teacher.findById(req.params.id);
  if (!t) throw new AppError(404, 'المدرس غير موجود', 'NOT_FOUND');
  t.set(req.body);
  await t.save();
  audit(req, 'update', 'teacher', t._id, { name: t.name, fields: Object.keys(req.body) });
  res.json({ status: 'ok', item: t });
}));

// حذف نهائي للمدرس وكل محتواه وباقاته واشتراكات طلابه وحساباته
router.delete('/:id', superOnly, sensitiveLimiter, catchAsync(async (req, res) => {
  const t = await Teacher.findById(req.params.id);
  if (!t) throw new AppError(404, 'المدرس غير موجود', 'NOT_FOUND');
  const staff = await User.find({ teacher: t._id }).select('_id').lean();
  await Promise.all([
    Lecture.deleteMany({ teacher: t._id }), Homework.deleteMany({ teacher: t._id }),
    Course.deleteMany({ teacher: t._id }), Subscription.deleteMany({ teacher: t._id }),
    Package.deleteMany({ teacher: t._id }),
    Session.deleteMany({ user: { $in: staff.map((s) => s._id) } }),
    User.deleteMany({ teacher: t._id }),
  ]);
  await t.deleteOne();
  audit(req, 'delete', 'teacher', t._id, { name: t.name, slug: t.slug });
  res.json({ status: 'ok' });
}));

module.exports = router;

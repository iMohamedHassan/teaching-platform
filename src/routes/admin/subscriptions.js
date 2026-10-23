const express = require('express');
const { z } = require('zod');
const Subscription = require('../../models/Subscription');
const Package = require('../../models/Package');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const catchAsync = require('../../utils/catchAsync');
const audit = require('../../utils/audit');
const { addDays } = require('../../utils/helpers');
const { phone, oid } = require('../../utils/schemas');
const { requirePerm, requireRole, teacherScope } = require('../../middleware/auth');
const { validate, idParam } = require('../../middleware/validate');
const { sensitiveLimiter } = require('../../middleware/security');

const router = express.Router();
router.param('id', idParam);

const createSchema = z.object({
  phone, package: oid,
  days: z.coerce.number().int().min(1).max(3650).nullish(),
  method: z.enum(['cash', 'vodafone_cash', 'instapay', 'free', 'other']).default('other'),
  amountPaid: z.coerce.number().min(0).max(1000000).optional(),
  note: z.string().trim().max(300).nullish(),
});

router.get('/', requirePerm('students:read'), catchAsync(async (req, res) => {
  const q = { ...teacherScope(req.user) };
  if (typeof req.query.user === 'string' && /^[a-f\d]{24}$/i.test(req.query.user)) q.user = req.query.user;
  const items = await Subscription.find(q).sort({ createdAt: -1 }).limit(300)
    .populate('user', 'name phone').populate('package', 'title grade').populate('teacher', 'name').lean();
  const now = Date.now();
  res.json({ status: 'ok', items: items.map((s) => ({ ...s, active: !s.expiresAt || new Date(s.expiresAt).getTime() > now })) });
}));

// تفعيل باقة لطالب يدوي (دفع كاش/فودافون كاش/إنستا باي/مجاني). الدفع الأوتوماتيك في المرحلة 3.
router.post('/', requireRole('super_admin'), validate(createSchema), catchAsync(async (req, res) => {
  const b = req.body;
  const user = await User.findOne({ phone: b.phone, role: 'student' });
  if (!user) throw new AppError(404, 'مفيش طالب مسجل بالرقم ده', 'NOT_FOUND');
  const pkg = await Package.findById(b.package);
  if (!pkg) throw new AppError(404, 'الباقة غير موجودة', 'NOT_FOUND');
  if (pkg.grade !== user.grade) throw new AppError(400, 'الباقة دي لسنة دراسية تانية غير سنة الطالب', 'VALIDATION');

  const active = await Subscription.exists({ user: user._id, package: pkg._id, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  if (active) throw new AppError(409, 'الطالب مشترك بالفعل في الباقة دي', 'DUPLICATE');

  const days = b.days ?? pkg.durationDays;
  const sub = await Subscription.create({
    user: user._id, package: pkg._id, teacher: pkg.teacher,
    expiresAt: days ? addDays(days) : null,
    method: b.method,
    amountPaid: b.amountPaid ?? (b.method === 'free' ? 0 : pkg.price),
    note: b.note || undefined, grantedBy: req.user._id,
  });
  audit(req, 'grant', 'subscription', sub._id, { student: user.name, phone: user.phone, package: pkg.title, amount: sub.amountPaid });
  res.status(201).json({ status: 'ok', item: sub });
}));

router.delete('/:id', requireRole('super_admin'), sensitiveLimiter, catchAsync(async (req, res) => {
  const sub = await Subscription.findByIdAndDelete(req.params.id);
  if (!sub) throw new AppError(404, 'الاشتراك غير موجود', 'NOT_FOUND');
  audit(req, 'revoke', 'subscription', sub._id, { user: sub.user, package: sub.package });
  res.json({ status: 'ok' });
}));

module.exports = router;

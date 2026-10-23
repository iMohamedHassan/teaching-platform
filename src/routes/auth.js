const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const Session = require('../models/Session');
const cfg = require('../config');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { normalizePhone, sha256, addDays } = require('../utils/helpers');
const { signAccess, newRefreshToken, setAuthCookies, clearAuthCookies } = require('../utils/tokens');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middleware/security');

const router = express.Router();

const phone = z.string().trim().transform(normalizePhone).refine((p) => /^01[0125]\d{8}$/.test(p), 'رقم الموبايل غير صحيح (مثال: 01012345678)');
const password = z.string().min(8, 'كلمة السر 8 أحرف على الأقل').max(72, 'كلمة السر طويلة');

const registerSchema = z.object({
  name: z.string().trim().min(6, 'اكتب الاسم ثلاثي').max(80),
  phone,
  parentPhone: phone,
  grade: z.enum(cfg.GRADE_KEYS, { errorMap: () => ({ message: 'اختار السنة الدراسية' }) }),
  password,
}).refine((d) => d.phone !== d.parentPhone, { message: 'رقم ولي الأمر لازم يكون مختلف عن رقمك', path: ['parentPhone'] })
  .refine((d) => d.password !== d.phone, { message: 'كلمة السر ماينفعش تكون رقم الموبايل', path: ['password'] });

const loginSchema = z.object({ phone, password: z.string().min(1, 'اكتب كلمة السر').max(72) });
const changePassSchema = z.object({ current: z.string().min(1), password });

// hash وهمي عشان وقت الرد يبقى متقارب سواء الرقم موجود أو لأ
const DUMMY = bcrypt.hashSync('dummy-password', 11);

async function startSession(req, res, user, deviceId) {
  // نفس الجهاز = نفس الجلسة (نمسح القديمة)
  await Session.deleteMany({ user: user._id, deviceId });
  const refresh = newRefreshToken();
  const session = await Session.create({
    user: user._id, tokenHash: sha256(refresh), deviceId,
    userAgent: (req.get('user-agent') || '').slice(0, 250), ip: req.ip,
    expiresAt: addDays(cfg.refreshTtlDays),
  });
  setAuthCookies(res, { access: signAccess(user._id, session._id), refresh, deviceId });
}

router.post('/register', registerLimiter, validate(registerSchema), catchAsync(async (req, res) => {
  const { name, phone: ph, parentPhone, grade, password: pw } = req.body;
  if (await User.exists({ phone: ph })) throw new AppError(409, 'رقم الموبايل مسجل بالفعل، سجّل دخولك', 'DUPLICATE');
  const user = await User.create({ name, phone: ph, parentPhone, grade, role: 'student', password: await User.hash(pw) });
  res.status(201).json({ status: 'ok', message: 'تم إنشاء الحساب، سجّل دخولك', user: user.toPublic() });
}));

router.post('/login', loginLimiter, validate(loginSchema), catchAsync(async (req, res) => {
  const { phone: ph, password: pw } = req.body;
  const bad = new AppError(401, 'رقم الموبايل أو كلمة السر غير صحيحة', 'BAD_CREDENTIALS');

  const user = await User.findOne({ phone: ph }).select('+password');
  if (!user) { await bcrypt.compare(pw, DUMMY); throw bad; }

  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60e3);
    throw new AppError(423, `الحساب مقفول مؤقتاً بسبب محاولات كتير. جرّب بعد ${mins} دقيقة`, 'LOCKED');
  }

  if (!(await user.checkPassword(pw))) {
    const lock = user.failedLogins + 1 >= cfg.maxFailedLogins;
    await User.updateOne({ _id: user._id }, lock
      ? { $set: { failedLogins: 0, lockUntil: new Date(Date.now() + cfg.lockMinutes * 60e3) } }
      : { $inc: { failedLogins: 1 } });
    throw bad;
  }
  if (!user.isActive) throw new AppError(403, 'الحساب موقوف، تواصل مع الإدارة', 'INACTIVE');

  // حد الأجهزة (للطلاب وأولياء الأمور فقط)
  let deviceId = req.cookies?.did;
  if (!deviceId || !/^[\w-]{20,64}$/.test(deviceId)) deviceId = crypto.randomUUID();
  const ua = (req.get('user-agent') || '').slice(0, 250);
  const known = user.devices.find((d) => d.id === deviceId);
  if (user.role === 'student' || user.role === 'parent') {
    if (!known && user.devices.length >= user.maxDevices) {
      throw new AppError(403, `الحساب مسجل على ${user.maxDevices} أجهزة بالفعل. تواصل مع الإدارة لتصفير الأجهزة.`, 'DEVICE_LIMIT');
    }
  }
  if (known) { known.lastSeen = new Date(); known.userAgent = ua; known.ip = req.ip; }
  else user.devices.push({ id: deviceId, userAgent: ua, ip: req.ip });

  user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  await startSession(req, res, user, deviceId);
  res.json({ status: 'ok', user: user.toPublic() });
}));

router.post('/refresh', refreshLimiter, catchAsync(async (req, res) => {
  const rt = req.cookies?.rt;
  const fail = () => { clearAuthCookies(res); return new AppError(401, 'انتهت الجلسة، سجّل دخولك تاني', 'SESSION_INVALID'); };
  if (!rt) throw fail();
  const h = sha256(rt);
  const now = new Date();
  const s = await Session.findOne({ $or: [{ tokenHash: h }, { prevHash: h, prevUntil: { $gt: now } }] });
  if (!s || s.expiresAt < now) throw fail();
  const user = await User.findById(s.user);
  if (!user || !user.isActive) throw fail();

  if (s.tokenHash === h) {
    // تدوير الـ refresh token
    const next = newRefreshToken();
    s.prevHash = h; s.prevUntil = new Date(Date.now() + 15e3);
    s.tokenHash = sha256(next); s.lastUsedAt = now; s.expiresAt = addDays(cfg.refreshTtlDays);
    await s.save();
    setAuthCookies(res, { access: signAccess(user._id, s._id), refresh: next });
  } else {
    // طلب متزامن بالتوكن القديم خلال 15 ثانية: نديه access بس (الـ refresh الجديد وصله من الطلب التاني)
    setAuthCookies(res, { access: signAccess(user._id, s._id) });
  }
  res.json({ status: 'ok' });
}));

router.post('/logout', catchAsync(async (req, res) => {
  if (req.cookies?.rt) await Session.deleteOne({ tokenHash: sha256(req.cookies.rt) });
  clearAuthCookies(res);
  res.json({ status: 'ok' });
}));

router.post('/logout-all', authenticate, catchAsync(async (req, res) => {
  await Session.deleteMany({ user: req.user._id });
  clearAuthCookies(res);
  res.json({ status: 'ok' });
}));

router.get('/me', authenticate, (req, res) => res.json({ status: 'ok', user: req.user.toPublic() }));

router.post('/change-password', authenticate, validate(changePassSchema), catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.checkPassword(req.body.current))) throw new AppError(400, 'كلمة السر الحالية غلط', 'BAD_CREDENTIALS');
  if (req.body.password === user.phone) throw new AppError(400, 'كلمة السر ماينفعش تكون رقم الموبايل', 'VALIDATION');
  user.password = await User.hash(req.body.password);
  await user.save({ validateBeforeSave: false });
  await Session.deleteMany({ user: user._id, _id: { $ne: req.session._id } }); // نطلّع باقي الأجهزة
  res.json({ status: 'ok', message: 'تم تغيير كلمة السر' });
}));

module.exports = router;

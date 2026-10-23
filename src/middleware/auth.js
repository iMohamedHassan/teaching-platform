const User = require('../models/User');
const Session = require('../models/Session');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { verifyAccess } = require('../utils/tokens');
const { can, STAFF_ROLES } = require('../config');

// 1) هل المستخدم مسجل دخول وجلسته لسه صالحة؟
exports.authenticate = catchAsync(async (req, res, next) => {
  const token = req.cookies?.at;
  if (!token) throw new AppError(401, 'سجّل دخولك الأول', 'NO_TOKEN');
  let payload;
  try { payload = verifyAccess(token); } catch (_) { throw new AppError(401, 'انتهت الجلسة', 'TOKEN_EXPIRED'); }

  const [user, session] = await Promise.all([User.findById(payload.sub), Session.findById(payload.sid)]);
  if (!user || !session || String(session.user) !== String(user._id)) {
    throw new AppError(401, 'الجلسة غير صالحة، سجّل دخولك تاني', 'SESSION_INVALID');
  }
  if (!user.isActive) throw new AppError(403, 'الحساب موقوف، تواصل مع الإدارة', 'INACTIVE');
  req.user = user;
  req.session = session;
  next();
});

// 2) صلاحية حسب الدور
exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'مالكش صلاحية لده', 'FORBIDDEN'));

// 3) صلاحية حسب الإذن (RBAC)
exports.requirePerm = (perm) => (req, res, next) =>
  can(req.user.role, perm) ? next() : next(new AppError(403, 'مالكش صلاحية لده', 'FORBIDDEN'));

// 4) نطاق البيانات: السوبر أدمن يشوف كله، المدرس/المساعد يشوف محتوى مدرسه بس
exports.teacherScope = (user) => {
  if (user.role === 'super_admin') return {};
  if (STAFF_ROLES.includes(user.role) && user.teacher) return { teacher: user.teacher };
  throw new AppError(403, 'حسابك مش مربوط بمدرس', 'FORBIDDEN');
};

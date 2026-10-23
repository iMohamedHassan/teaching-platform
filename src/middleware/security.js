const rateLimit = require('express-rate-limit');
const cfg = require('../config');
const AppError = require('../utils/AppError');

const limiter = (windowMs, limit, message, extra = {}) =>
  rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { status: 'fail', message, code: 'RATE_LIMIT' },
    ...extra,
  });

// عام على كل الـ API
exports.apiLimiter = limiter(15 * 60e3, 800, 'طلبات كتير، استنى شوية وحاول تاني');
// أشد على تسجيل الدخول (الطلبات الناجحة مش بتتحسب)
exports.loginLimiter = limiter(15 * 60e3, 20, 'محاولات دخول كتير، استنى 15 دقيقة', { skipSuccessfulRequests: true });
exports.registerLimiter = limiter(60 * 60e3, 10, 'عملت حسابات كتير، حاول بعد ساعة');
exports.refreshLimiter = limiter(15 * 60e3, 120, 'طلبات كتير، استنى شوية');
// للعمليات الحساسة في الأدمن (حذف/تصفير باسورد...)
exports.sensitiveLimiter = limiter(60 * 60e3, 60, 'عمليات حساسة كتير، استنى شوية');

// حماية CSRF: أي طلب يغيّر بيانات لازم يحمل هيدر مخصوص (المتصفح مش بيسمح لموقع تاني يضيفه)
// + لو فيه Origin لازم يطابق موقعنا.
exports.csrfGuard = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return next(new AppError(403, 'طلب غير مسموح', 'CSRF'));
  const origin = req.get('origin');
  if (origin && origin !== cfg.appOrigin && !cfg.corsOrigins.includes(origin)) {
    return next(new AppError(403, 'طلب غير مسموح', 'CSRF'));
  }
  next();
};

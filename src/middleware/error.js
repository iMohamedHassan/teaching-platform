const AppError = require('../utils/AppError');

exports.notFoundApi = (req, res, next) => next(new AppError(404, 'المسار غير موجود', 'NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let e = err;
  if (err.name === 'ValidationError' && err.errors) {
    e = new AppError(400, Object.values(err.errors).map((x) => x.message)[0] || 'بيانات غير صحيحة', 'VALIDATION');
  } else if (err.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const labels = {
      phone: 'رقم الموبايل',
      slug: 'الرابط (slug)',
      tokenHash: 'رمز الجلسة',
      name: 'الاسم',
    };
    const label = labels[key] || 'هذا الحقل';
    e = new AppError(409, `${label} مستخدم بالفعل`, 'DUPLICATE');
  } else if (err.name === 'CastError') {
    e = new AppError(400, 'قيمة غير صالحة', 'BAD_ID');
  } else if (err.type === 'entity.too.large') {
    e = new AppError(413, 'حجم الطلب كبير', 'TOO_LARGE');
  } else if (err.type === 'entity.parse.failed') {
    e = new AppError(400, 'صيغة JSON غير صحيحة', 'BAD_JSON');
  }
  if (!(e instanceof AppError)) {
    console.error(err);
    e = new AppError(500, 'حصل خطأ في السيرفر، حاول تاني', 'SERVER');
  }
  res.status(e.status).json({ status: e.status >= 500 ? 'error' : 'fail', message: e.message, code: e.code, errors: e.errors });
};

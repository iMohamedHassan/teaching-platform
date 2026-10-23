const AppError = require('../utils/AppError');

// يتحقق من body/query بـ Zod. أي حقل مش معرّف في الـ schema بيتشال (حماية من mass assignment).
exports.validate = (schema, src = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[src]);
  if (!r.success) {
    const errors = r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, errors[0].message, 'VALIDATION', errors));
  }
  req[src] = r.data;
  next();
};

// يتأكد إن :id شكله ObjectId
exports.idParam = (req, res, next, id) =>
  /^[a-f\d]{24}$/i.test(id) ? next() : next(new AppError(400, 'معرّف غير صالح', 'BAD_ID'));

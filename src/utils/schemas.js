const { z } = require('zod');
const { normalizePhone } = require('./helpers');

exports.phone = z.string().trim().transform(normalizePhone).refine((p) => /^01[0125]\d{8}$/.test(p), 'رقم الموبايل غير صحيح (مثال: 01012345678)');
exports.password = z.string().min(8, 'كلمة السر 8 أحرف على الأقل').max(72, 'كلمة السر طويلة');
exports.oid = z.string().regex(/^[a-f\d]{24}$/i, 'معرّف غير صالح');

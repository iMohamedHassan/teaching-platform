const { Schema, model } = require('mongoose');
const { GRADE_KEYS } = require('../config');

// باقة = مجموعة كورسات بسعر ومدة. مثال: باقة الترم كامل ماث - مستر محمد سعد - أولى ثانوي - 499 جنيه
const schema = new Schema({
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  grade: { type: String, enum: GRADE_KEYS, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1500 },
  price: { type: Number, required: true, min: 0, max: 1000000 },
  durationDays: { type: Number, min: 1, max: 3650 },   // فاضي = بدون انتهاء
  courses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('Package', schema);

const { Schema, model } = require('mongoose');
const { GRADE_KEYS } = require('../config');

// "كورس" = مجلد محاضرات، مثال: محاضرات شهر أكتوبر 2026/2027
const schema = new Schema({
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  grade: { type: String, enum: GRADE_KEYS, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000 },
  order: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Course', schema);

const { Schema, model } = require('mongoose');
const { GRADE_KEYS } = require('../config');

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9]+(-[a-z0-9]+)*$/ },
  subject: { type: String, required: true, trim: true, maxlength: 60 },
  bio: { type: String, trim: true, maxlength: 1000 },
  photoUrl: { type: String, trim: true, maxlength: 500 },
  grades: { type: [{ type: String, enum: GRADE_KEYS }], default: [] },
  revenueShare: { type: Number, min: 0, max: 100, default: 0 }, // نسبة المدرس % (للتسويات في المرحلة 3)
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('Teacher', schema);

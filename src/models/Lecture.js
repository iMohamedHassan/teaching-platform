const { Schema, model } = require('mongoose');

const schema = new Schema({
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 2000 },
  youtubeId: { type: String, required: true, match: /^[\w-]{11}$/ },
  durationMin: { type: Number, min: 0, max: 1000 },
  order: { type: Number, default: 0 },
  isFree: { type: Boolean, default: false },      // حصة مجانية لأي طالب في نفس السنة
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Lecture', schema);

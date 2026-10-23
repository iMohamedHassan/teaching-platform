const { Schema, model } = require('mongoose');

// المرحلة 1: واجب بوصف + رابط ملف + موعد تسليم. التسليم والتصحيح في المرحلة 2.
const schema = new Schema({
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  lecture: { type: Schema.Types.ObjectId, ref: 'Lecture' },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 3000 },
  fileUrl: { type: String, trim: true, maxlength: 500 },
  dueDate: Date,
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Homework', schema);

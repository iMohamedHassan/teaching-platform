const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, GRADE_KEYS } = require('../config');

const deviceSchema = new Schema({
  id: { type: String, required: true },
  userAgent: String,
  ip: String,
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
}, { _id: false });

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'student', index: true },
  grade: { type: String, enum: GRADE_KEYS },
  parentPhone: { type: String, trim: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', index: true }, // لحسابات المدرس والمساعد
  isActive: { type: Boolean, default: true },
  failedLogins: { type: Number, default: 0 },
  lockUntil: Date,
  lastLoginAt: Date,
  maxDevices: { type: Number, default: 2, min: 1, max: 10 },
  devices: { type: [deviceSchema], default: [] },
}, { timestamps: true });

schema.statics.hash = (plain) => bcrypt.hash(plain, 11);
schema.methods.checkPassword = function (plain) { return bcrypt.compare(plain, this.password); };

schema.methods.toPublic = function () {
  return {
    id: this._id, name: this.name, phone: this.phone, role: this.role,
    grade: this.grade, parentPhone: this.parentPhone, teacher: this.teacher,
  };
};

module.exports = model('User', schema);

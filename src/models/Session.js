const { Schema, model } = require('mongoose');

const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  prevHash: String,          // السماح بطلبَي refresh متزامنين من تابين
  prevUntil: Date,
  deviceId: { type: String, required: true },
  userAgent: String,
  ip: String,
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL: Mongo يمسحها تلقائي
}, { timestamps: true });

schema.index({ prevHash: 1 }, { sparse: true });

module.exports = model('Session', schema);

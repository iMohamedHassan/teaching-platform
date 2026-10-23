const { Schema, model } = require('mongoose');

// الاشتراك هو اللي بيفتح المحتوى للطالب. بيتعمل يدوي من الأدمن دلوقتي، ومن الدفع/الأكواد في المرحلة 3.
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  package: { type: Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  startsAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  method: { type: String, enum: ['cash', 'vodafone_cash', 'instapay', 'code', 'online', 'free', 'other'], default: 'other' },
  amountPaid: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true, maxlength: 300 },
  grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('Subscription', schema);

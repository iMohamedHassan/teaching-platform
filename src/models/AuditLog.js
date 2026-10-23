const { Schema, model } = require('mongoose');

const schema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  role: String,
  action: { type: String, required: true },
  entity: { type: String, required: true, index: true },
  entityId: Schema.Types.Mixed,
  meta: Schema.Types.Mixed,
  ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.index({ createdAt: -1 });

module.exports = model('AuditLog', schema);

const AuditLog = require('../models/AuditLog');

// تسجيل أي عملية إدارية. مابيوقفش الطلب لو فشل التسجيل.
module.exports = (req, action, entity, entityId, meta) =>
  AuditLog.create({
    actor: req.user?._id,
    actorName: req.user?.name,
    role: req.user?.role,
    action, entity, entityId, meta,
    ip: req.ip,
  }).catch((e) => console.error('audit failed:', e.message));

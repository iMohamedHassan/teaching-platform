const Subscription = require('../models/Subscription');

// الاشتراكات الفعّالة للطالب (expiresAt فاضي = بدون انتهاء)
exports.activeSubscriptions = (userId) =>
  Subscription.find({ user: userId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
    .populate({ path: 'package', select: 'title courses teacher' });

// الكورسات اللي الطالب يقدر يفتحها = اتحاد كورسات كل باقة مشترك فيها
exports.accessibleCourseIds = async (userId) => {
  const subs = await exports.activeSubscriptions(userId);
  const ids = new Set();
  subs.forEach((s) => (s.package?.courses || []).forEach((c) => ids.add(String(c))));
  return { ids, subs };
};

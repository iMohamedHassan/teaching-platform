// الاستخدام:
//   npm run seed        -> بيعمل السوبر أدمن بس (من ADMIN_* في .env)
//   npm run seed:demo   -> + مدرسين تجريبيين (مستر محمد سعد ماث / مستر أحمد كمال تاريخ) بباقة وكورس لكل واحد
const crypto = require('crypto');
const cfg = require('../config');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const Package = require('../models/Package');
const { normalizePhone } = require('../utils/helpers');

const demo = process.argv.includes('--demo');
const randomPw = () => crypto.randomBytes(9).toString('base64url');

async function ensureAdmin() {
  const phone = normalizePhone(process.env.ADMIN_PHONE);
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!/^01[0125]\d{8}$/.test(phone)) throw new Error('ADMIN_PHONE غير صحيح');
  if (pw.length < 8) throw new Error('ADMIN_PASSWORD لازم 8 أحرف على الأقل');
  if (cfg.isProd && pw === 'ChangeMe_12345') throw new Error('غيّر ADMIN_PASSWORD قبل ما تشغل السييد في الإنتاج');
  if (await User.exists({ phone })) return console.log(`السوبر أدمن موجود بالفعل (${phone})`);
  await User.create({ name: process.env.ADMIN_NAME || 'مدير المنصة', phone, role: 'super_admin', password: await User.hash(pw) });
  console.log(`تم إنشاء السوبر أدمن: ${phone}`);
}

async function ensureDemoTeacher({ name, slug, subject, phone, bio }) {
  if (await Teacher.exists({ slug })) return console.log(`المدرس ${slug} موجود بالفعل`);
  const t = await Teacher.create({ name, slug, subject, bio, grades: ['sec1'] });
  const pw = randomPw();
  await User.create({ name, phone, role: 'teacher', teacher: t._id, password: await User.hash(pw) });
  const c = await Course.create({ teacher: t._id, grade: 'sec1', title: `${subject} - الترم الأول`, order: 1 });
  await Package.create({
    teacher: t._id, grade: 'sec1', title: `باقة الترم كامل ${subject} - ${name}`,
    description: 'كل محاضرات الترم الأول + الواجبات.', price: 499, durationDays: 120, courses: [c._id],
  });
  console.log(`مدرس تجريبي: ${name}  /${slug}  موبايل: ${phone}  باسورد: ${pw}   (احفظه، مش هيظهر تاني)`);
}

(async () => {
  await connectDB();
  await ensureAdmin();
  if (demo) {
    await ensureDemoTeacher({ name: 'مستر محمد سعد', slug: 'mohamed-saad', subject: 'ماث', phone: '01000000011', bio: 'مدرس رياضيات للمرحلة الثانوية.' });
    await ensureDemoTeacher({ name: 'مستر أحمد كمال', slug: 'ahmed-kamal', subject: 'تاريخ', phone: '01000000012', bio: 'مدرس تاريخ للمرحلة الثانوية.' });
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const need = (k, d) => {
  const v = process.env[k] ?? d;
  if (v === undefined || v === '') throw new Error(`Missing environment variable: ${k}`);
  return v;
};

const jwtSecret = need('JWT_ACCESS_SECRET');
if (isProd && jwtSecret.length < 32) throw new Error('JWT_ACCESS_SECRET must be at least 32 chars in production');

const appUrl = need('APP_URL', 'http://localhost:3000').replace(/\/$/, '');

// ---- السنين الدراسية: عدّل هنا لو عايز تضيف/تشيل سنة ----
const GRADES = [
  { key: 'prep1', label: 'الصف الأول الإعدادي' },
  { key: 'prep2', label: 'الصف الثاني الإعدادي' },
  { key: 'prep3', label: 'الصف الثالث الإعدادي' },
  { key: 'sec1', label: 'الصف الأول الثانوي' },
  { key: 'sec2', label: 'الصف الثاني الثانوي' },
  { key: 'sec3', label: 'الصف الثالث الثانوي' },
];

const ROLES = ['super_admin', 'teacher', 'assistant', 'student', 'parent'];
const STAFF_ROLES = ['super_admin', 'teacher', 'assistant'];

// ---- مصفوفة الصلاحيات (RBAC) ----
const PERMISSIONS = {
  super_admin: ['*'],
  teacher: ['content:read', 'content:write', 'content:delete', 'students:read', 'packages:read'],
  assistant: ['content:read', 'content:write', 'students:read', 'packages:read'],
  student: [],
  parent: [],
};
const can = (role, perm) => {
  const p = PERMISSIONS[role] || [];
  return p.includes('*') || p.includes(perm);
};

// أسماء ممنوع تتستخدم كرابط مدرس (slug) لأنها بتتعارض مع صفحات النظام
const RESERVED_SLUGS = [
  'admin', 'api', 'login', 'logout', 'register', 'student', 'parent', 'teacher', 'teachers',
  'css', 'js', 'img', 'assets', 'public', 'health', 'static', 'favicon.ico', 'robots.txt',
  'index', 'about', 'contact', 'terms', 'privacy', 'dashboard', 'me', 'account', 'pay', 'payment',
];

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: need('MONGODB_URI'),
  appUrl,
  appOrigin: new URL(appUrl).origin,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  brandName: process.env.BRAND_NAME || 'منصتي',
  whatsapp: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  jwtSecret,
  accessTtlMin: Number(process.env.ACCESS_TOKEN_MINUTES) || 15,
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  maxFailedLogins: Number(process.env.MAX_FAILED_LOGINS) || 5,
  lockMinutes: Number(process.env.LOCK_MINUTES) || 15,
  GRADES, GRADE_KEYS: GRADES.map((g) => g.key),
  ROLES, STAFF_ROLES, PERMISSIONS, can, RESERVED_SLUGS,
};

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const morgan = require('morgan');
const mongoose = require('mongoose');

const cfg = require('./src/config');
const connectDB = require('./src/config/db');
const Teacher = require('./src/models/Teacher');
const catchAsync = require('./src/utils/catchAsync');
const { apiLimiter, csrfGuard } = require('./src/middleware/security');
const { notFoundApi, errorHandler } = require('./src/middleware/error');

const app = express();
const PUB = path.join(__dirname, 'public');

app.set('trust proxy', 1);      // Render/Nginx: عشان الـ IP الحقيقي يتقرأ صح في الـ rate limiting
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'frame-src': ['https://www.youtube-nocookie.com'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': cfg.isProd ? [] : null,
    },
  },
  // يوتيوب بيحتاج Referer عشان يشغّل الفيديو المضمّن
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(morgan(cfg.isProd ? 'combined' : 'dev'));

const allowed = new Set([cfg.appOrigin, ...cfg.corsOrigins]);
app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.has(o)), credentials: true }));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize());   // يمنع NoSQL injection (مفاتيح بتبدأ بـ $ أو فيها .)
app.use(hpp());             // يمنع تكرار البارامترات

app.get('/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// ---------------- API ----------------
app.use('/api', apiLimiter, csrfGuard);
// المرحلة 3: webhooks الدفع هتتحط هنا قبل csrfGuard (بتتحقق بالتوقيع HMAC بدل الكوكيز)
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/public', require('./src/routes/public'));
app.use('/api/me', require('./src/routes/student'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', notFoundApi);

// ---------------- الصفحات ----------------
app.use(express.static(PUB, { extensions: ['html'], maxAge: cfg.isProd ? '10m' : 0 }));

// /mohamed-saad  ->  صفحة المدرس
app.get('/:slug', catchAsync(async (req, res, next) => {
  const slug = req.params.slug.toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || cfg.RESERVED_SLUGS.includes(slug)) return next();
  if (!(await Teacher.exists({ slug, isActive: true }))) return next();
  res.sendFile(path.join(PUB, 'teacher.html'));
}));

app.use((req, res) => res.status(404).sendFile(path.join(PUB, '404.html')));
app.use(errorHandler);

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

connectDB()
  .then(() => app.listen(cfg.port, () => console.log(`Server running on ${cfg.appUrl} (port ${cfg.port})`)))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });

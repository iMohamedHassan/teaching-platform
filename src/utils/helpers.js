const crypto = require('crypto');

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// يحوّل أي صيغة لرقم موبايل مصري محلي: 01XXXXXXXXX
const normalizePhone = (s) => {
  let v = String(s ?? '')
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[^\d+]/g, '');
  v = v.replace(/^(\+20|0020|20(?=1\d{9}$))/, '0');
  if (/^1[0125]\d{8}$/.test(v)) v = '0' + v;
  return v;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const YT_ID = /^[\w-]{11}$/;
// يستخرج ID الفيديو من أي رابط يوتيوب (watch / youtu.be / embed / shorts / live) أو ID مباشر
const parseYouTubeId = (input) => {
  const s = String(input ?? '').trim();
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return YT_ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && YT_ID.test(v)) return v;
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch (_) { /* not a url */ }
  return null;
};

const addDays = (days, from = new Date()) => new Date(from.getTime() + days * 864e5);

module.exports = { normalizePhone, escapeRegex, sha256, parseYouTubeId, addDays };

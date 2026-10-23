/* أدوات مشتركة بين كل الصفحات */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
let refreshing = null;

async function api(path, { method = 'GET', body, _retried } = {}) {
  const opt = { method, credentials: 'same-origin', headers: { ...XHR } };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch('/api' + path, opt); }
  catch (_) { throw Object.assign(new Error('مفيش اتصال بالإنترنت'), { status: 0 }); }
  let data = {};
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (res.status === 401 && data.code === 'TOKEN_EXPIRED' && !_retried) {
    // طلب واحد بس للـ refresh حتى لو كذا طلب فشلوا مع بعض
    refreshing = refreshing || fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: XHR })
      .finally(() => setTimeout(() => { refreshing = null; }, 50));
    const r = await refreshing;
    if (r.ok) return api(path, { method, body, _retried: true });
  }
  if (!res.ok) throw Object.assign(new Error(data.message || 'حصل خطأ، حاول تاني'), { status: res.status, code: data.code });
  return data;
}

// ---- بيانات المنصة (الاسم والسنين) ----
let META = { brand: '', grades: [], whatsapp: '' };
let _metaP;
const loadMeta = () => (_metaP = _metaP || api('/public/meta').then((m) => {
  META = m;
  $$('.js-brand').forEach((e) => { e.textContent = m.brand; });
  return m;
}));
const gradeLabel = (k) => META.grades.find((g) => g.key === k)?.label || k || '—';
const setTitle = (t) => { document.title = t ? `${t} | ${META.brand}` : META.brand; };

// ---- تنسيقات ----
const money = (n) => `${Number(n || 0).toLocaleString('en-US')} جنيه`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const initial = (name) => {
  const w = String(name || '؟').trim().split(/\s+/);
  const skip = ['مستر', 'أستاذ', 'استاذ', 'دكتور', 'د.', 'مس'];
  return (skip.includes(w[0]) && w[1] ? w[1] : w[0]).charAt(0);
};

// ---- جلسة المستخدم ----
const homeFor = (role) => (role === 'student' ? '/student' : ['super_admin', 'teacher', 'assistant'].includes(role) ? '/admin' : '/');
async function me() { try { return (await api('/auth/me')).user; } catch (_) { return null; } }
const never = () => new Promise(() => {});
async function requireUser(roles) {
  const u = await me();
  if (!u) { location.replace('/login?next=' + encodeURIComponent(location.pathname)); return never(); }
  if (roles && !roles.includes(u.role)) { location.replace(homeFor(u.role)); return never(); }
  return u;
}
async function logout() { try { await api('/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ } location.href = '/login'; }

async function renderNav(el) {
  const u = await me();
  el.innerHTML = u
    ? `<a class="btn sm" href="${homeFor(u.role)}">لوحتي</a><button class="btn sm ghost" id="navLogout" type="button">خروج</button>`
    : '<a class="btn sm ghost" href="/login">تسجيل الدخول</a><a class="btn sm" href="/login#register">حساب جديد</a>';
  $('#navLogout')?.addEventListener('click', logout);
  return u;
}

// ---- تنبيهات ----
function toast(msg, type) {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), 3800);
}

// ---- الوضع الليلي/النهاري ----
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-theme-toggle]')) return;
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (_) { /* private mode */ }
});

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cfg = require('../config');

const signAccess = (userId, sid) =>
  jwt.sign({ sub: String(userId), sid: String(sid) }, cfg.jwtSecret, { expiresIn: `${cfg.accessTtlMin}m`, algorithm: 'HS256' });

const verifyAccess = (token) => jwt.verify(token, cfg.jwtSecret, { algorithms: ['HS256'] });

const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

const base = { httpOnly: true, secure: cfg.isProd, sameSite: 'lax' };

const setAuthCookies = (res, { access, refresh, deviceId }) => {
  if (access) res.cookie('at', access, { ...base, path: '/', maxAge: cfg.accessTtlMin * 60e3 });
  if (refresh) res.cookie('rt', refresh, { ...base, path: '/api/auth', maxAge: cfg.refreshTtlDays * 864e5 });
  if (deviceId) res.cookie('did', deviceId, { ...base, path: '/', maxAge: 365 * 864e5 });
};

const clearAuthCookies = (res) => {
  res.clearCookie('at', { ...base, path: '/' });
  res.clearCookie('rt', { ...base, path: '/api/auth' });
};

module.exports = { signAccess, verifyAccess, newRefreshToken, setAuthCookies, clearAuthCookies };

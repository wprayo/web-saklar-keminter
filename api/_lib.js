// Modul internal dipakai bersama oleh semua fungsi di /api.
// Nama diawali "_" supaya Vercel TIDAK menjadikan file ini sebuah endpoint
// sendiri — ini murni kode bantu, bukan route.
//
// Sengaja pakai modul bawaan Node.js saja (crypto, fetch) supaya tidak ada
// dependency npm tambahan yang perlu di-install: proyek ini tetap "zero
// dependency" walau sekarang punya login sendiri.

const crypto = require('crypto');

/* ---------------- base64url ---------------- */
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}

/* ---------------- session token (mirip JWT, HMAC-SHA256) ---------------- */
function signSession(payload, secret, maxAgeSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = Object.assign({}, payload, { exp: Math.floor(Date.now() / 1000) + maxAgeSeconds });
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return h + '.' + p + '.' + sig;
}

function verifySession(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(p)); } catch (e) { return null; }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

/* ---------------- password hashing (scrypt bawaan Node) ---------------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------------- cookie ---------------- */
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
const THIRTY_DAYS = 60 * 60 * 24 * 30;
function setSessionCookie(res, token, maxAgeSeconds) {
  res.setHeader('Set-Cookie',
    'session=' + token + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + (maxAgeSeconds || THIRTY_DAYS));
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

/* ---------------- Supabase REST (PostgREST) lewat service role key ---------------- */
async function sbFetch(path, options) {
  options = options || {};
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur di Environment Variables.');
    err.status = 500;
    throw err;
  }
  const res = await fetch(url + '/rest/v1' + path, {
    method: options.method || 'GET',
    body: options.body,
    headers: Object.assign({
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    }, options.headers || {})
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.hint)) || res.statusText || 'Database error';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- guard session untuk endpoint yang butuh login ---------------- */
function requireSession(req, res) {
  const cookies = parseCookies(req);
  const payload = verifySession(cookies.session, process.env.JWT_SECRET);
  if (!payload || !payload.sub) {
    res.status(401).json({ error: 'Sesi berakhir atau belum masuk, silakan login lagi.' });
    return null;
  }
  return payload; // { sub: userId, username, exp }
}

module.exports = {
  signSession, verifySession,
  hashPassword, verifyPassword,
  parseCookies, setSessionCookie, clearSessionCookie, THIRTY_DAYS,
  sbFetch, requireSession
};

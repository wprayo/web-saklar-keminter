const { hashPassword, signSession, setSessionCookie, sbFetch, THIRTY_DAYS } = require('./_lib');

function sanitizeUsername(u) { return String(u || '').trim().toLowerCase(); }
function validUsername(u) { return /^[a-z0-9_.]{3,20}$/.test(u); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan JWT_SECRET di Vercel.' });
  }

  const username = sanitizeUsername(req.body && req.body.username);
  const password = (req.body && req.body.password) || '';

  if (!validUsername(username)) {
    return res.status(400).json({ error: 'Username 3-20 karakter: huruf kecil, angka, titik, garis bawah.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }

  try {
    const existing = await sbFetch('/users?username=eq.' + encodeURIComponent(username) + '&select=id');
    if (existing && existing.length) {
      return res.status(409).json({ error: 'Username sudah dipakai, coba username lain.' });
    }

    const password_hash = hashPassword(password);
    const created = await sbFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password_hash })
    });
    const user = created[0];

    const token = signSession({ sub: user.id, username: user.username }, process.env.JWT_SECRET, THIRTY_DAYS);
    setSessionCookie(res, token, THIRTY_DAYS);
    res.status(200).json({ username: user.username });
  } catch (e) {
    if (/duplicate key|already exists/i.test(e.message || '')) {
      return res.status(409).json({ error: 'Username sudah dipakai, coba username lain.' });
    }
    res.status(500).json({ error: 'Gagal mendaftar: ' + e.message });
  }
};

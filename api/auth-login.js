const { verifyPassword, signSession, setSessionCookie, sbFetch, THIRTY_DAYS } = require('./_lib');

function sanitizeUsername(u) { return String(u || '').trim().toLowerCase(); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan JWT_SECRET di Vercel.' });
  }

  const username = sanitizeUsername(req.body && req.body.username);
  const password = (req.body && req.body.password) || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  try {
    const rows = await sbFetch('/users?username=eq.' + encodeURIComponent(username) + '&select=id,username,password_hash');
    const user = rows && rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }
    const token = signSession({ sub: user.id, username: user.username }, process.env.JWT_SECRET, THIRTY_DAYS);
    setSessionCookie(res, token, THIRTY_DAYS);
    res.status(200).json({ username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Gagal masuk: ' + e.message });
  }
};

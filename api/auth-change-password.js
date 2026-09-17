const { requireSession, hashPassword, verifyPassword, sbFetch } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = requireSession(req, res); // sudah kirim 401 sendiri kalau gagal
  if (!session) return;

  const currentPassword = (req.body && req.body.currentPassword) || '';
  const newPassword = (req.body && req.body.newPassword) || '';
  if (!currentPassword) return res.status(400).json({ error: 'Isi password saat ini.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });

  try {
    const rows = await sbFetch('/users?id=eq.' + session.sub + '&select=id,password_hash');
    const user = rows && rows[0];
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Password saat ini salah.' });
    }

    const password_hash = hashPassword(newPassword);
    await sbFetch('/users?id=eq.' + session.sub, {
      method: 'PATCH',
      body: JSON.stringify({ password_hash }),
      prefer: 'return=minimal'
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengganti password: ' + e.message });
  }
};

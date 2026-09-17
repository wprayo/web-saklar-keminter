const { requireSession } = require('./_lib');

module.exports = async (req, res) => {
  const session = requireSession(req, res); // sudah kirim 401 sendiri kalau gagal
  if (!session) return;
  res.status(200).json({ username: session.username });
};

// Endpoint publik: cuma kirim setelan broker MQTT bawaan ke browser.
// Kredensial Supabase TIDAK lagi lewat sini sejak login dipindah ke tabel
// users sendiri — browser sekarang hanya bicara ke /api/auth-* dan
// /api/devices, tidak pernah langsung ke Supabase.

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json({
    host: process.env.MQTT_HOST || '',
    protocol: process.env.MQTT_PROTOCOL || 'wss',
    port: Number(process.env.MQTT_PORT || 8084),
    path: process.env.MQTT_PATH || '/mqtt',
    user: process.env.MQTT_USER || '',
    pass: process.env.MQTT_PASS || ''
  });
};

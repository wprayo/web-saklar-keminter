// Mengirim setelan broker bawaan ke halaman, diambil dari Environment Variables
// di dashboard Vercel. Dengan begini kredensial tidak ikut masuk ke repo Git.
//
// Catatan jujur: nilainya tetap sampai ke browser, jadi masih bisa dilihat
// di tab Network. Ini mengurangi kebocoran lewat source code, bukan
// menjadikannya rahasia. Untuk MQTT dari browser memang tidak ada cara lain
// selain broker dikasih user terbatas + ACL per topik.

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
    pass: process.env.MQTT_PASS || '',

    // Supabase anon key memang didesain untuk dipakai di browser (public),
    // keamanan datanya dijaga oleh Row Level Security, bukan dengan
    // menyembunyikan key ini. Tetap disalurkan lewat endpoint ini supaya
    // pengguna cukup isi Environment Variables tanpa mengedit index.html.
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
};

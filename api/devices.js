const { requireSession, sbFetch } = require('./_lib');

function rowToDevice(row) {
  return {
    id: row.id,
    name: row.name,
    deviceCode: row.device_code,
    secretToken: row.secret_token,
    useDefault: row.use_default,
    host: row.host || '',
    protocol: row.protocol || 'wss',
    port: row.port || 8084,
    path: row.path || '/mqtt',
    useAuth: row.use_auth,
    user: row.broker_user || '',
    pass: row.broker_pass || '',
    activeSwitches: row.active_switches,
    switchNames: Array.isArray(row.switch_names) && row.switch_names.length
      ? row.switch_names : ['Saklar 1', 'Saklar 2', 'Saklar 3', 'Saklar 4'],
    switchStates: row.switch_states || { s1: false, s2: false, s3: false, s4: false }
  };
}

function deviceToRow(dev) {
  const row = {};
  if (dev.name !== undefined) row.name = dev.name;
  if (dev.deviceCode !== undefined) row.device_code = dev.deviceCode;
  if (dev.secretToken !== undefined) row.secret_token = dev.secretToken;
  if (dev.useDefault !== undefined) row.use_default = dev.useDefault;
  if (dev.host !== undefined) row.host = dev.host;
  if (dev.protocol !== undefined) row.protocol = dev.protocol;
  if (dev.port !== undefined) row.port = dev.port;
  if (dev.path !== undefined) row.path = dev.path;
  if (dev.useAuth !== undefined) row.use_auth = dev.useAuth;
  if (dev.user !== undefined) row.broker_user = dev.user;
  if (dev.pass !== undefined) row.broker_pass = dev.pass;
  if (dev.activeSwitches !== undefined) row.active_switches = dev.activeSwitches;
  if (dev.switchNames !== undefined) row.switch_names = dev.switchNames;
  if (dev.switchStates !== undefined) row.switch_states = dev.switchStates;
  return row;
}

module.exports = async (req, res) => {
  const session = requireSession(req, res); // sudah kirim 401 sendiri kalau gagal
  if (!session) return;
  const userId = session.sub;

  try {
    if (req.method === 'GET') {
      const rows = await sbFetch('/devices?user_id=eq.' + userId + '&order=created_at.asc');
      return res.status(200).json((rows || []).map(rowToDevice));
    }

    if (req.method === 'POST') {
      const row = deviceToRow(req.body || {});
      row.user_id = userId;
      const created = await sbFetch('/devices', { method: 'POST', body: JSON.stringify(row) });
      return res.status(200).json(rowToDevice(created[0]));
    }

    if (req.method === 'PUT') {
      const id = req.body && req.body.id;
      if (!id) return res.status(400).json({ error: 'id perangkat wajib diisi.' });
      const row = deviceToRow(req.body || {});
      const updated = await sbFetch(
        '/devices?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + userId,
        { method: 'PATCH', body: JSON.stringify(row) }
      );
      if (!updated || !updated.length) return res.status(404).json({ error: 'Perangkat tidak ditemukan.' });
      return res.status(200).json(rowToDevice(updated[0]));
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: 'id perangkat wajib diisi.' });
      await sbFetch(
        '/devices?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + userId,
        { method: 'DELETE', prefer: 'return=minimal' }
      );
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

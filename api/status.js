// GET -> is everything set up? Tells the page what is missing.
const { env, send, dbx, ROOT, checkAuth, authReady, TYPES, PURPOSES } = require('./_lib');

module.exports = async (req, res) => {
  const missing = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET'].filter(k => !env(k));
  if (missing.length) return send(res, 200, { ready: false, step: 'env', missing });
  if (!authReady()) return send(res, 200, { ready: false, step: 'email', configured: false });
  if (!req.headers.cookie) return send(res, 200, { ready: false, step: 'email', configured: true });
  if (!await checkAuth(req, res)) return;
  if (!env('DROPBOX_REFRESH_TOKEN')) return send(res, 200, { ready: false, step: 'connect' });
  try {
    const me = await dbx('users/get_current_account');
    send(res, 200, { ready: true, user:req.user, account: me.name && me.name.display_name, root: ROOT(), types: TYPES, purposes: PURPOSES });
  } catch (e) {
    send(res, 200, { ready: false, step: 'connect', error: e.message });
  }
};

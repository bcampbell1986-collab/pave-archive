// GET -> is everything set up? Tells the page what is missing.
const { env, send, dbx, ROOT, checkPasscode, TYPES, PURPOSES } = require('./_lib');

module.exports = async (req, res) => {
  const missing = ['APP_PASSCODE', 'DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET'].filter(k => !env(k));
  if (missing.length) return send(res, 200, { ready: false, step: 'env', missing });
  if (!req.headers['x-app-passcode']) return send(res, 200, { ready: false, step: 'passcode' });
  if (!checkPasscode(req, res)) return;
  if (!env('DROPBOX_REFRESH_TOKEN')) return send(res, 200, { ready: false, step: 'connect' });
  try {
    const me = await dbx('users/get_current_account');
    send(res, 200, { ready: true, account: me.name && me.name.display_name, root: ROOT(), types: TYPES, purposes: PURPOSES });
  } catch (e) {
    send(res, 200, { ready: false, step: 'connect', error: e.message });
  }
};

// POST form {passcode} -> sends you to Dropbox to approve this app (one time).
const { env, checkPasscode, redirectUri, signState } = require('./_lib');

module.exports = async (req, res) => {
  if (req.body === undefined || typeof req.body === 'string') {
    let raw = typeof req.body === 'string' ? req.body : '';
    if (!raw) { const chunks = []; for await (const c of req) chunks.push(c); raw = Buffer.concat(chunks).toString(); }
    req.body = Object.fromEntries(new URLSearchParams(raw));
  }
  if (!checkPasscode(req, res)) return;
  const url = new URL('https://www.dropbox.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: env('DROPBOX_APP_KEY'),
    response_type: 'code',
    token_access_type: 'offline', // gives a refresh token that does not expire
    redirect_uri: redirectUri(req),
    state: signState(),
  });
  res.statusCode = 303;
  res.setHeader('Location', url.toString());
  res.end();
};

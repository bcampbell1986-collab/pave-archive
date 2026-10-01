// Administrator POST -> sends you to Dropbox to approve this app (one time).
const { env, checkAuth, redirectUri, signState } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode=405;return res.end(); }
  if (!await checkAuth(req, res)) return;
  if (req.user.role !== 'admin') {res.statusCode=403;return res.end('Administrator required.');}
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

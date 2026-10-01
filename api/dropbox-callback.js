// Dropbox sends you back here after you approve. Shows the refresh token ONCE
// so you can paste it into Vercel as DROPBOX_REFRESH_TOKEN.
const { env, redirectUri, checkState } = require('./_lib');

const page = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><body style="font:16px system-ui;background:#f4eae4;color:#422330;max-width:640px;margin:40px auto;padding:0 16px">
<h1>${title}</h1>${body}</body>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const q = new URL(req.url, 'http://x').searchParams;
  if (q.get('error')) return res.end(page('Not connected', `<p>Dropbox said: ${esc(q.get('error_description') || q.get('error'))}</p>`));
  if (!checkState(q.get('state'))) { res.statusCode = 400; return res.end(page('Link expired', '<p>Go back to the app and click Connect Dropbox again.</p>')); }

  const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(env('DROPBOX_APP_KEY') + ':' + env('DROPBOX_APP_SECRET')).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code') || '', redirect_uri: redirectUri(req) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) { res.statusCode = 502; return res.end(page('Not connected', `<p>${esc(j.error_description || j.error || 'Dropbox did not return a token.')}</p>`)); }

  res.end(page('Almost done ✅', `
<p><b>Step 1.</b> Copy this code:</p>
<textarea readonly onclick="this.select()" style="width:100%;height:90px;font:14px monospace">${esc(j.refresh_token)}</textarea>
<p><b>Step 2.</b> In Vercel → your project → Settings → Environment Variables, add<br>
<code>DROPBOX_REFRESH_TOKEN</code> = the code above.</p>
<p><b>Step 3.</b> Vercel → Deployments → ⋯ → <b>Redeploy</b>.</p>
<p><b>Step 4.</b> Open the app again. It will say “Dropbox connected”.</p>
<p style="color:#775e68">Keep this code private. It lets the app put files in your Dropbox. Close this tab when done.</p>`));
};

// Shared helpers for the Pave Archive API (Vercel serverless functions).
// Files starting with "_" in /api are not turned into routes by Vercel.
const crypto = require('crypto');

const env = (k, d = '') => (process.env[k] || d).trim();
const ROOT = () => {
  let r = env('DROPBOX_ROOT', '/Pave Archive');
  if (!r.startsWith('/')) r = '/' + r;
  return r.replace(/\/+$/, '');
};
const BIG_FILE = 140 * 1024 * 1024; // temp upload links allow up to 150 MB

// ---------- passcode ----------
function checkPasscode(req, res) {
  const want = env('APP_PASSCODE');
  if (!want) {
    send(res, 500, { error: 'APP_PASSCODE is not set in Vercel. Add it, then redeploy.' });
    return false;
  }
  const got = String(req.headers['x-app-passcode'] || (req.body && req.body.passcode) || '');
  const a = crypto.createHash('sha256').update(got).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    send(res, 401, { error: 'Wrong passcode.' });
    return false;
  }
  return true;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

// ---------- Dropbox auth ----------
let cached = { token: null, exp: 0 };
async function getAccessToken() {
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const key = env('DROPBOX_APP_KEY'), secret = env('DROPBOX_APP_SECRET'), refresh = env('DROPBOX_REFRESH_TOKEN');
  if (!key || !secret) throw httpError(500, 'Dropbox app key/secret are not set in Vercel.');
  if (!refresh) throw httpError(503, 'Dropbox is not connected yet. Open Setup and click "Connect Dropbox".');
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(502, 'Dropbox refused the saved connection. Reconnect Dropbox. (' + (j.error_description || j.error || r.status) + ')');
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 300) * 1000 };
  return cached.token;
}

async function dbx(endpoint, args) {
  const token = await getAccessToken();
  const r = await fetch('https://api.dropboxapi.com/2/' + endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: args === undefined ? 'null' : JSON.stringify(args),
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = { error_summary: text }; }
  if (!r.ok) { const e = httpError(r.status === 409 ? 409 : 502, j.error_summary || 'Dropbox error'); e.dropbox = j; throw e; }
  return j;
}

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

function redirectUri(req) {
  return 'https://pave-archive.vercel.app/api/dropbox-callback';
}

// signed "state" so only someone with the passcode can start Connect
function signState() {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', env('DROPBOX_APP_SECRET') + env('APP_PASSCODE')).update(ts).digest('hex');
  return ts + '.' + sig;
}
function checkState(state) {
  const [ts, sig] = String(state || '').split('.');
  if (!ts || !sig || !Number.isFinite(Number(ts)) || Number(ts)>Date.now() || Date.now() - Number(ts) > 15 * 60 * 1000) return false;
  const want = crypto.createHmac('sha256', env('DROPBOX_APP_SECRET') + env('APP_PASSCODE')).update(ts).digest('hex');
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

// ---------- THE SORTING RULES ----------
const TYPES = {
  Photos: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'webp', 'tif', 'tiff', 'bmp', 'dng', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'avif'],
  Videos: ['mov', 'mp4', 'm4v', 'avi', 'mkv', 'webm', '3gp', 'mts', 'm2ts', 'wmv', 'hevc'],
  Documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'key', 'pages', 'numbers', 'txt', 'rtf', 'odt', 'ods', 'md'],
  Design: ['psd', 'ai', 'indd', 'svg', 'eps', 'sketch', 'fig', 'dwg', 'dxf', 'skp'],
  Audio: ['mp3', 'wav', 'm4a', 'aac', 'aiff', 'flac'],
};
const PURPOSES = ['House Walk Through', 'Production - install', 'Furniture - rentals', 'Damage - returns', 'Final deliverables', 'Contracts - invoices'];

function fileType(name, mime = '') {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  for (const [folder, exts] of Object.entries(TYPES)) if (exts.includes(ext)) return folder;
  if (mime.startsWith('image/')) return 'Photos';
  if (mime.startsWith('video/')) return 'Videos';
  if (mime.startsWith('audio/')) return 'Audio';
  return 'Other files';
}

// Dropbox-safe folder/file name piece
function clean(part, max = 120) {
  let s = String(part || '').normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
  if (s.length > max) {
    const dot = s.lastIndexOf('.');
    const ext = dot > 0 && s.length - dot <= 10 ? s.slice(dot) : '';
    s = s.slice(0, max - ext.length).trim() + ext;
  }
  return s;
}

function validDate(d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d || '')) {
    const t = new Date(d + 'T12:00:00Z');
    if (!isNaN(t) && t.getUTCFullYear() > 1990 && t <= new Date(Date.now() + 2 * 864e5)) return d;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Where a file goes:
 *   {ROOT}/{Client}/{Project}/[{Purpose}/]{Photos|Videos|Documents|...}/{YYYY-MM}/{YYYY-MM-DD} {original name}
 */
function buildPath({ client, project, purpose, name, type, date }) {
  const c = clean(client, 80), p = clean(project, 100);
  if (!c) throw httpError(400, 'Client is required.');
  if (!p) throw httpError(400, 'Project is required.');
  const day = validDate(date);
  let file = clean(name, 150) || 'file';
  if (!file.startsWith(day)) file = `${day} ${file}`;
  const parts = [ROOT(), c, p];
  if (purpose && PURPOSES.includes(purpose)) parts.push(purpose);
  parts.push(fileType(name, type), day.slice(0, 7), file);
  return parts.join('/');
}

module.exports = { TYPES, env, ROOT, BIG_FILE, checkPasscode, send, readJson, getAccessToken, dbx, httpError, redirectUri, signState, checkState, buildPath, fileType, clean, PURPOSES };

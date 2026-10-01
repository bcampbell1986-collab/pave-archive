// POST {client, project, purpose, name, size, type, date}
// -> decides the Dropbox path (sorting rules) and returns a way to upload straight to Dropbox.
const { checkPasscode, send, readJson, buildPath, dbx, getAccessToken, BIG_FILE } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!checkPasscode(req, res)) return;
  try {
    const b = await readJson(req);
    const size = Number(b.size) || 0;
    const path = buildPath(b);

    // Skip true duplicates: same path already in Dropbox with the same size.
    try {
      const meta = await dbx('files/get_metadata', { path });
      if (meta['.tag'] === 'file' && meta.size === size) return send(res, 200, { skip: true, path: meta.path_display });
    } catch (e) { if (e.status !== 409) throw e; } // 409 = not found, which is normal

    if (size > BIG_FILE) {
      // Big videos: browser uploads in 8 MB chunks with a short-lived token.
      const token = await getAccessToken();
      return send(res, 200, { mode: 'chunked', token, path });
    }
    const r = await dbx('files/get_temporary_upload_link', {
      commit_info: { path, mode: 'add', autorename: true, mute: true },
      duration: 3600,
    });
    send(res, 200, { mode: 'link', link: r.link, path });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

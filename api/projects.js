// GET -> clients and projects that already exist in Dropbox, so people pick the same names.
const { checkAuth, send, dbx, ROOT } = require('./_lib');

async function folders(path) {
  const out = [];
  let r = await dbx('files/list_folder', { path, recursive: false, limit: 2000 });
  for (;;) {
    r.entries.filter(e => e['.tag'] === 'folder').forEach(e => out.push(e.name));
    if (!r.has_more) break;
    r = await dbx('files/list_folder/continue', { cursor: r.cursor });
  }
  return out.sort((a, b) => a.localeCompare(b));
}

module.exports = async (req, res) => {
  if (!await checkAuth(req, res)) return;
  try {
    let clients = [];
    try { clients = await folders(ROOT()); } catch (e) { if (e.status !== 409) throw e; } // root not made yet
    const list = await Promise.all(clients.map(async c => ({ client: c, projects: await folders(ROOT() + '/' + c).catch(() => []) })));
    send(res, 200, { clients: list });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

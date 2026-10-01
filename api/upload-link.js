// POST {client, project, purpose, name, size, type, date}
// -> decides the Dropbox path (sorting rules) and returns a way to upload straight to Dropbox.
const { checkAuth, send, readJson, buildPath, dbx, getAccessToken, BIG_FILE } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!await checkAuth(req, res)) return;
  try {
    const b = await readJson(req);
    const size = Number(b.size);
    if(!Number.isSafeInteger(size)||size<0||! /^[a-f0-9]{64}$/.test(b.contentHash||'')) return send(res,400,{error:'Valid original size and hash required'});
    const path = buildPath(b);

    // Skip true duplicates: same path already in Dropbox with the same size.
    try {
      const meta = await dbx('files/get_metadata', { path });
      if (meta['.tag'] === 'file' && meta.size === size && meta.content_hash === b.contentHash) return send(res, 200, { skip: true, path: meta.path_display });
    } catch (e) { if (e.status !== 409) throw e; } // 409 = not found, which is normal

    const quota=await dbx('users/get_space_usage');
    if(!Number.isFinite(quota.allocation.allocated)||quota.allocation.allocated-quota.used<size)return send(res,409,{error:'Insufficient Dropbox space. Keep originals.'});
    // Create only the selected destination's missing child folders.
    const parent=path.slice(0,path.lastIndexOf('/'));let current='';
    for(const part of parent.split('/').filter(Boolean)){current+='/'+part;try{await dbx('files/get_metadata',{path:current});}catch(e){if(e.status!==409)throw e;try{await dbx('files/create_folder_v2',{path:current,autorename:false});}catch(create){if(create.status!==409)throw create;const existing=await dbx('files/get_metadata',{path:current});if(existing['.tag']!=='folder')throw create;}}}

    if (size > BIG_FILE) {
      // Big videos: browser uploads in 8 MB chunks with a short-lived token.
      const {seal}=require('./upload-session');
      return send(res,200,{mode:'chunked',session:seal({path,size,exp:Date.now()+12*3600000}),path});
    }
    const r = await dbx('files/get_temporary_upload_link', {
      commit_info: { path, mode: 'add', autorename: false, mute: true, strict_conflict: true },
      duration: 3600,
    });
    send(res, 200, { mode: 'link', link: r.link, path });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

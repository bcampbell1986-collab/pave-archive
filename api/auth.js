const {env,send,readJson,authReady,authRequest,setSession,approvedUser,ADMIN_EMAIL}=require('./_lib');
const APP_ORIGIN='https://pave-archive.vercel.app';
module.exports=async(req,res)=>{
  if(req.method!=='POST')return send(res,405,{error:'POST only'});
  if(req.headers.origin!==APP_ORIGIN)return send(res,403,{error:'Open Pāvé to sign in.'});
  if(!authReady())return send(res,503,{error:'Email login setup is pending. Connect Supabase to enable sign-in.'});
  try {
    const b=await readJson(req);
    if(b.action==='logout'){setSession(res,'','');return send(res,200,{ok:true});}
    if(b.action==='login'){
      const email=String(b.email||'').trim().toLowerCase();
      const allowed=[ADMIN_EMAIL,...env('PAVE_APPROVED_EMAILS').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)];
      if(!allowed.includes(email))return send(res,403,{error:'Ask your administrator to approve your email first.'});
      await authRequest('otp?redirect_to='+encodeURIComponent(APP_ORIGIN+'/'),{email,create_user:true});
      return send(res,200,{ok:true});
    }
    if(b.action==='session'){
      if(typeof b.access_token!=='string'||typeof b.refresh_token!=='string')return send(res,400,{error:'Invalid email sign-in link.'});
      const user=await authRequest('user',null,b.access_token);
      const approved=approvedUser(user);
      if(!approved)return send(res,403,{error:'Your email needs administrator approval.'});
      setSession(res,b.access_token,b.refresh_token);
      return send(res,200,{ok:true,user:approved});
    }
    return send(res,400,{error:'Unknown sign-in action.'});
  }catch(e){return send(res,e.status===429?429:400,{error:e.status===429?'Please wait before requesting another link.':'Email sign-in failed. Check the Supabase email setup and try again.'});}
};

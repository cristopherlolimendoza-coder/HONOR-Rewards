const SECURITY_HEADERS={
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy':'same-origin',
  'Cross-Origin-Resource-Policy':'same-site',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':"default-src 'self'; img-src 'self' https://raw.githubusercontent.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
};

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const clean=s=>String(s??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const ipOf=req=>clean(req.headers.get('CF-Connecting-IP')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');
const sameOrigin=req=>{const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin};

async function ensureRateTable(db){
  if(!db)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS security_rate(key TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0,window_start INTEGER NOT NULL DEFAULT 0,blocked_until INTEGER NOT NULL DEFAULT 0)`).run();
}
async function rateState(db,key){
  await ensureRateTable(db);const now=Math.floor(Date.now()/1000),r=await db.prepare(`SELECT count,window_start,blocked_until FROM security_rate WHERE key=?`).bind(key).first();
  return {now,row:r,blocked:Number(r?.blocked_until||0)>now,retry:Math.max(0,Number(r?.blocked_until||0)-now)};
}
async function recordLoginFailure(db,key){
  const s=await rateState(db,key);if(s.blocked)return s;const windowSec=900,blockSec=1800,limit=5,now=s.now,r=s.row;
  if(!r||Number(r.window_start||0)+windowSec<=now){await db.prepare(`INSERT OR REPLACE INTO security_rate(key,count,window_start,blocked_until) VALUES(?,?,?,0)`).bind(key,1,now).run();return {blocked:false,retry:0}}
  const count=Number(r.count||0)+1;if(count>=limit){const until=now+blockSec;await db.prepare(`UPDATE security_rate SET count=?,blocked_until=? WHERE key=?`).bind(count,until,key).run();return {blocked:true,retry:blockSec}}
  await db.prepare(`UPDATE security_rate SET count=? WHERE key=?`).bind(count,key).run();return {blocked:false,retry:0};
}
async function clearRate(db,key){if(db)await db.prepare(`DELETE FROM security_rate WHERE key=?`).bind(key).run().catch(()=>{})}
async function consumeRedeemRate(db,key){
  await ensureRateTable(db);const limit=60,windowSec=600,blockSec=1800,now=Math.floor(Date.now()/1000),r=await db.prepare(`SELECT count,window_start,blocked_until FROM security_rate WHERE key=?`).bind(key).first();
  if(Number(r?.blocked_until||0)>now)return {ok:false,retry:Number(r.blocked_until)-now};
  if(!r||Number(r.window_start||0)+windowSec<=now){await db.prepare(`INSERT OR REPLACE INTO security_rate(key,count,window_start,blocked_until) VALUES(?,?,?,0)`).bind(key,1,now).run();return {ok:true}}
  const count=Number(r.count||0)+1;if(count>limit){const until=now+blockSec;await db.prepare(`UPDATE security_rate SET count=?,blocked_until=? WHERE key=?`).bind(count,until,key).run();return {ok:false,retry:blockSec}}
  await db.prepare(`UPDATE security_rate SET count=? WHERE key=?`).bind(count,key).run();return {ok:true};
}

async function sendCanjeEmail(env,payload,result){
  try{
    if(!env.BREVO_API_KEY||!env.NOTIFY_FROM||!env.NOTIFY_EMAILS)return;
    const recipients=clean(env.NOTIFY_EMAILS).split(',').map(x=>x.trim()).filter(Boolean).slice(0,10);
    if(!recipients.length)return;
    const p=env.DB?await env.DB.prepare(`SELECT name FROM products WHERE id=?`).bind(clean(payload?.productId)).first().catch(()=>null):null;
    const productName=p?.name||clean(payload?.productId)||'Premio';
    const clients=Array.isArray(payload?.clients)?payload.clients:[];
    const total=clients.reduce((s,c)=>s+(Array.isArray(c?.models)?c.models:[]).reduce((a,m)=>a+(Number(m?.qty)||0),0),0);
    const rows=clients.map((c,i)=>{
      const models=(Array.isArray(c?.models)?c.models:[]).map(m=>`${esc(clean(m?.model))} (${Number(m?.qty)||0})`).join('<br>');
      return `<tr><td style="padding:7px;border:1px solid #d0d5dd">${i+1}</td><td style="padding:7px;border:1px solid #d0d5dd">${esc(clean(c?.ruc))}</td><td style="padding:7px;border:1px solid #d0d5dd">${esc(clean(c?.company))}</td><td style="padding:7px;border:1px solid #d0d5dd">${models}</td></tr>`;
    }).join('');
    const html=`<div style="font-family:Arial,sans-serif;color:#17212b"><h2 style="margin-bottom:6px">Nuevo canje HONOR Rewards</h2><p style="color:#667085;margin-top:0">Se registró una nueva solicitud y está pendiente de revisión.</p><p><b>Ejecutivo:</b> ${esc(clean(payload?.executive))}<br><b>Canal:</b> ${esc(clean(payload?.channel))}<br><b>Premio:</b> ${esc(productName)}<br><b>Total de unidades:</b> ${total}<br><b>Estado:</b> En revisión</p><table style="border-collapse:collapse;width:100%;max-width:760px"><tr><th style="padding:7px;border:1px solid #d0d5dd;text-align:left">#</th><th style="padding:7px;border:1px solid #d0d5dd;text-align:left">RUC</th><th style="padding:7px;border:1px solid #d0d5dd;text-align:left">Razón social</th><th style="padding:7px;border:1px solid #d0d5dd;text-align:left">Modelos / cantidades</th></tr>${rows}</table>${clean(payload?.comment)?`<p><b>Comentario:</b> ${esc(clean(payload.comment))}</p>`:''}<p style="margin-top:20px"><a href="https://honor-rewards.pages.dev/admin/" style="background:#0057ff;color:white;text-decoration:none;padding:11px 16px;border-radius:9px;display:inline-block;font-weight:bold">Abrir panel administrador</a></p><p style="font-size:12px;color:#98a2b3">Solicitud ${esc(result?.id||'')}</p></div>`;
    const body={sender:{name:'HONOR Rewards',email:clean(env.NOTIFY_FROM)},to:recipients.map(email=>({email})),subject:`Nuevo canje HONOR Rewards · ${clean(payload?.executive)} · ${productName}`,htmlContent:html};
    const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'accept':'application/json','api-key':env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)console.error('brevo_email_error',r.status,await r.text().catch(()=>''));
  }catch(e){console.error('notification_error',e)}
}

function secure(response,path){
  const headers=new Headers(response.headers);for(const [k,v] of Object.entries(SECURITY_HEADERS))headers.set(k,v);
  if(path.startsWith('/admin')||path.startsWith('/api/admin'))headers.set('Cache-Control','no-store, max-age=0');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function finish(response,path){
  const secured=secure(response,path),type=secured.headers.get('content-type')||'';if(!type.includes('text/html'))return secured;
  return new HTMLRewriter().on('body',{element(el){el.append('<script src="/image-fix.js?v=23"></script>',{html:true});}}).transform(secured);
}

export async function onRequest(context){
  const {request,env}=context,url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/',method=request.method.toUpperCase(),ip=ipOf(request);
  if(!['GET','HEAD','OPTIONS'].includes(method)&&!sameOrigin(request))return finish(json({error:'Origen no permitido.'},403),path);
  const len=Number(request.headers.get('content-length')||0);
  if(path==='/api/admin/login'&&len>4096)return finish(json({error:'Solicitud demasiado grande.'},413),path);
  if(path==='/api/redeem'&&len>24576)return finish(json({error:'Solicitud demasiado grande.'},413),path);

  let redeemPayload=null;
  if(path==='/api/admin/login'&&method==='POST'&&env.DB){const s=await rateState(env.DB,`login:${ip}`);if(s.blocked)return finish(json({error:'Demasiados intentos. Intenta nuevamente en unos minutos.'},429,{'retry-after':String(s.retry)}),path)}
  if(path==='/api/redeem'&&method==='POST'&&env.DB){const s=await consumeRedeemRate(env.DB,`redeem:${ip}`);if(!s.ok)return finish(json({error:'Demasiadas solicitudes desde esta conexión. Intenta nuevamente más tarde.'},429,{'retry-after':String(s.retry)}),path);redeemPayload=await request.clone().json().catch(()=>null)}

  let response=await context.next();

  if(path==='/api/admin/login'&&method==='POST'&&env.DB){
    if(response.status===401){const s=await recordLoginFailure(env.DB,`login:${ip}`);if(s.blocked)response=json({error:'Demasiados intentos fallidos. Acceso bloqueado temporalmente.'},429,{'retry-after':String(s.retry)})}
    else if(response.ok){await clearRate(env.DB,`login:${ip}`);try{const d=await response.clone().json();if(d&&typeof d==='object'&&'token' in d){delete d.token;const h=new Headers(response.headers);h.delete('content-length');response=new Response(JSON.stringify(d),{status:response.status,headers:h})}}catch{}}
  }

  if(path==='/api/redeem'&&method==='POST'&&response.status===201&&redeemPayload){const result=await response.clone().json().catch(()=>({}));context.waitUntil(sendCanjeEmail(env,redeemPayload,result))}
  return finish(response,path);
}

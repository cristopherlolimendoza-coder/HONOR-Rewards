const SECURITY_HEADERS={
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy':'same-origin',
  'Cross-Origin-Resource-Policy':'same-site',
  'Strict-Transport-Security':'max-age=31536000',
  'Content-Security-Policy':"default-src 'self'; img-src 'self' https://raw.githubusercontent.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
};

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const clean=s=>String(s??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const ipOf=req=>clean(req.headers.get('CF-Connecting-IP')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');
const sameOrigin=req=>{const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin};

async function ensureSecurityTable(db){
  if(!db)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS security_rate(key TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0,window_start INTEGER NOT NULL DEFAULT 0,blocked_until INTEGER NOT NULL DEFAULT 0)`).run();
}
async function blocked(db,key){
  await ensureSecurityTable(db);const now=Math.floor(Date.now()/1000),r=await db.prepare(`SELECT count,window_start,blocked_until FROM security_rate WHERE key=?`).bind(key).first();
  if(Number(r?.blocked_until||0)>now)return {blocked:true,retry:Number(r.blocked_until)-now};return {blocked:false,retry:0,row:r,now};
}
async function recordFailure(db,key,limit=5,windowSec=900,blockSec=1800){
  const s=await blocked(db,key);if(s.blocked)return s;const now=s.now,r=s.row;
  if(!r||Number(r.window_start||0)+windowSec<=now){await db.prepare(`INSERT OR REPLACE INTO security_rate(key,count,window_start,blocked_until) VALUES(?,?,?,0)`).bind(key,1,now).run();return {blocked:false,retry:0}}
  const count=Number(r.count||0)+1;if(count>=limit){const until=now+blockSec;await db.prepare(`UPDATE security_rate SET count=?,blocked_until=? WHERE key=?`).bind(count,until,key).run();return {blocked:true,retry:blockSec}}
  await db.prepare(`UPDATE security_rate SET count=? WHERE key=?`).bind(count,key).run();return {blocked:false,retry:0}
}
async function clearRate(db,key){if(db)await db.prepare(`DELETE FROM security_rate WHERE key=?`).bind(key).run().catch(()=>{})}
async function consumeRate(db,key,limit=60,windowSec=600,blockSec=1800){
  await ensureSecurityTable(db);const now=Math.floor(Date.now()/1000),r=await db.prepare(`SELECT count,window_start,blocked_until FROM security_rate WHERE key=?`).bind(key).first();
  if(Number(r?.blocked_until||0)>now)return {ok:false,retry:Number(r.blocked_until)-now};
  if(!r||Number(r.window_start||0)+windowSec<=now){await db.prepare(`INSERT OR REPLACE INTO security_rate(key,count,window_start,blocked_until) VALUES(?,?,?,0)`).bind(key,1,now).run();return {ok:true}}
  const count=Number(r.count||0)+1;if(count>limit){const until=now+blockSec;await db.prepare(`UPDATE security_rate SET count=?,blocked_until=? WHERE key=?`).bind(count,until,key).run();return {ok:false,retry:blockSec}}
  await db.prepare(`UPDATE security_rate SET count=? WHERE key=?`).bind(count,key).run();return {ok:true}
}

async function sendCanjeNotifications(env,payload,result){
  try{
    const recipients=clean(env.NOTIFY_EMAILS).split(',').map(x=>x.trim()).filter(Boolean);
    const product=env.DB?await env.DB.prepare(`SELECT name FROM products WHERE id=?`).bind(clean(payload?.productId)).first().catch(()=>null):null;
    const productName=product?.name||clean(payload?.productId)||'Premio';
    const clients=Array.isArray(payload?.clients)?payload.clients:[];
    const detail=clients.map((c,i)=>({cliente:i+1,ruc:clean(c.ruc),razonSocial:clean(c.company),modelos:(Array.isArray(c.models)?c.models:[]).map(m=>({modelo:clean(m.model),cantidad:Number(m.qty)||0}))}));
    const event={event:'honor_rewards_new_redeem',id:result?.id||'',fecha:new Date().toISOString(),ejecutivo:clean(payload?.executive),canal:clean(payload?.channel),premio:productName,totalUnidades:detail.reduce((s,c)=>s+c.modelos.reduce((a,m)=>a+m.cantidad,0),0),clientes:detail,comentario:clean(payload?.comment),estado:'En revisión'};
    const tasks=[];
    if(env.NOTIFY_WEBHOOK_URL){tasks.push(fetch(env.NOTIFY_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json','user-agent':'HONOR-Rewards/1.0'},body:JSON.stringify(event)}).then(r=>{if(!r.ok)throw new Error(`Webhook ${r.status}`)}))}
    if(env.RESEND_API_KEY&&env.NOTIFY_FROM&&recipients.length){
      const rows=detail.map(c=>`<tr><td style="padding:6px;border:1px solid #ddd">${c.cliente}</td><td style="padding:6px;border:1px solid #ddd">${esc(c.ruc)}</td><td style="padding:6px;border:1px solid #ddd">${esc(c.razonSocial)}</td><td style="padding:6px;border:1px solid #ddd">${c.modelos.map(m=>`${esc(m.modelo)} (${m.cantidad})`).join('<br>')}</td></tr>`).join('');
      const html=`<h2>Nuevo canje HONOR Rewards</h2><p><b>Ejecutivo:</b> ${esc(event.ejecutivo)}<br><b>Canal:</b> ${esc(event.canal)}<br><b>Premio:</b> ${esc(event.premio)}<br><b>Total unidades:</b> ${event.totalUnidades}<br><b>Estado:</b> En revisión</p><table style="border-collapse:collapse"><tr><th style="padding:6px;border:1px solid #ddd">#</th><th style="padding:6px;border:1px solid #ddd">RUC</th><th style="padding:6px;border:1px solid #ddd">Razón social</th><th style="padding:6px;border:1px solid #ddd">Modelos</th></tr>${rows}</table>${event.comentario?`<p><b>Comentario:</b> ${esc(event.comentario)}</p>`:''}<p><a href="https://honor-rewards.pages.dev/admin/">Abrir panel administrador</a></p>`;
      tasks.push(fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','Idempotency-Key':`honor-rewards/${event.id||Date.now()}`},body:JSON.stringify({from:env.NOTIFY_FROM,to:recipients,subject:`Nuevo canje HONOR Rewards · ${event.ejecutivo} · ${event.premio}`,html})}).then(r=>{if(!r.ok)throw new Error(`Email ${r.status}`)}));
    }
    if(tasks.length)await Promise.allSettled(tasks);
  }catch(e){console.error('notification_error',e)}
}

function secure(response,path){
  const headers=new Headers(response.headers);for(const [k,v] of Object.entries(SECURITY_HEADERS))headers.set(k,v);
  if(path.startsWith('/admin')||path.startsWith('/api/admin'))headers.set('Cache-Control','no-store, max-age=0');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function finishHtml(response,path){
  const secured=secure(response,path),type=secured.headers.get('content-type')||'';if(!type.includes('text/html'))return secured;
  return new HTMLRewriter().on('body',{element(el){el.append('<script src="/image-fix.js?v=23"></script>',{html:true});}}).transform(secured);
}

export async function onRequest(context){
  const {request,env}=context,url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/',method=request.method.toUpperCase(),ip=ipOf(request);
  if(!['GET','HEAD','OPTIONS'].includes(method)&&!sameOrigin(request))return finishHtml(json({error:'Origen no permitido.'},403),path);
  const len=Number(request.headers.get('content-length')||0);if(path==='/api/admin/login'&&len>4096)return finishHtml(json({error:'Solicitud demasiado grande.'},413),path);if(path==='/api/redeem'&&len>24576)return finishHtml(json({error:'Solicitud demasiado grande.'},413),path);
  let redeemPayload=null;
  if(path==='/api/admin/login'&&method==='POST'&&env.DB){const s=await blocked(env.DB,`login:${ip}`);if(s.blocked)return finishHtml(json({error:'Demasiados intentos. Intenta nuevamente más tarde.'},429,{'retry-after':String(s.retry)}),path)}
  if(path==='/api/redeem'&&method==='POST'&&env.DB){const s=await consumeRate(env.DB,`redeem:${ip}`,60,600,1800);if(!s.ok)return finishHtml(json({error:'Demasiadas solicitudes desde esta conexión. Intenta nuevamente más tarde.'},429,{'retry-after':String(s.retry)}),path);redeemPayload=await request.clone().json().catch(()=>null)}
  let response=await context.next();
  if(path==='/api/admin/login'&&method==='POST'&&env.DB){if(response.status===401){const s=await recordFailure(env.DB,`login:${ip}`,5,900,1800);if(s.blocked)response=json({error:'Demasiados intentos fallidos. Acceso bloqueado temporalmente.'},429,{'retry-after':String(s.retry)})}else if(response.ok){await clearRate(env.DB,`login:${ip}`);try{const d=await response.clone().json();if(d&&typeof d==='object'&&'token' in d){delete d.token;const h=new Headers(response.headers);response=json(d,response.status,Object.fromEntries(h.entries()))}}catch{}}}
  if(path==='/api/redeem'&&method==='POST'&&response.status===201&&redeemPayload){const result=await response.clone().json().catch(()=>({}));context.waitUntil(sendCanjeNotifications(env,redeemPayload,result))}
  return finishHtml(response,path);
}

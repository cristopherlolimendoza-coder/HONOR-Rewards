const ALLOWED_MODELS = [
  'HONOR X5D','HONOR X6D 5G','HONOR X7e Plus','HONOR X8D','HONOR 600 E',
  'HONOR 600 Smart','HONOR 600 5G','HONOR 600 Pro 5G','HONOR Magic 8 Lite','HONOR Magic 8 Pro'
];
const ALLOWED_CHANNELS = ['Inside Sales','Hunter','Regiones'];
const DEFAULT_PRODUCTS = [
  {id:'cafe',name:'Stanley Café-To-Go',tier:'Atractivo',quota:10,stock:8,sort:1,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/cafe.webp'},
  {id:'aerolight',name:'Stanley Aerolight',tier:'Atractivo',quota:15,stock:8,sort:2,img:'/assets/stanley-aerolight-black.webp'},
  {id:'vitalize',name:'Stanley Vitalize Shaker',tier:'Atractivo',quota:20,stock:5,sort:3,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/vitalize.webp'},
  {id:'earbuds',name:'HONOR Choice Auriculares',tier:'Premium',quota:10,stock:10,sort:4,img:'/assets/honor-choice-auriculares.webp'},
  {id:'airfryer',name:'HONOR Choice Air Fryer',tier:'Premium',quota:40,stock:5,sort:5,img:'/assets/honor-choice-air-fryer.webp'},
  {id:'robot',name:'Aspiradora Robot HONOR Choice R3',tier:'Excepcional',quota:50,stock:3,sort:6,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/robot.webp'}
];

const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}
});
const clean = s => String(s ?? '').trim();

function monthKey(d=new Date()){
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).formatToParts(d);
  const y = parts.find(x=>x.type==='year')?.value;
  const m = parts.find(x=>x.type==='month')?.value;
  return `${y}-${m}`;
}

async function ensureColumn(db,table,column,definition){
  const q = await db.prepare(`PRAGMA table_info(${table})`).all();
  if(!(q.results||[]).some(x=>x.name===column)){
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

async function initDB(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS products(
    id TEXT PRIMARY KEY,name TEXT NOT NULL,tier TEXT NOT NULL,quota INTEGER NOT NULL,
    total_stock INTEGER NOT NULL,available INTEGER NOT NULL,reserved INTEGER NOT NULL DEFAULT 0,
    approved INTEGER NOT NULL DEFAULT 0,delivered INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,img TEXT,description TEXT,inventory_month TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS requests(
    id TEXT PRIMARY KEY,created_at TEXT NOT NULL,executive TEXT NOT NULL,channel TEXT NOT NULL,
    product_id TEXT NOT NULL,total_qty INTEGER NOT NULL,comment TEXT,status TEXT NOT NULL,
    admin_note TEXT DEFAULT '',cycle_month TEXT,affects_stock INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS request_lines(
    id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL,ruc TEXT NOT NULL,
    company TEXT NOT NULL,model TEXT NOT NULL,qty INTEGER NOT NULL,
    FOREIGN KEY(request_id) REFERENCES requests(id)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS system_meta(key TEXT PRIMARY KEY,value TEXT)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits(
    key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,count INTEGER NOT NULL
  )`).run();

  await ensureColumn(db,'products','inventory_month','TEXT');
  await ensureColumn(db,'products','approved','INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db,'requests','cycle_month','TEXT');
  await ensureColumn(db,'requests','affects_stock','INTEGER NOT NULL DEFAULT 1');

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_requests_cycle ON requests(cycle_month)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_request_lines_request ON request_lines(request_id)`).run();

  const current = monthKey();
  for(const p of DEFAULT_PRODUCTS){
    await db.prepare(`INSERT OR IGNORE INTO products(
      id,name,tier,quota,total_stock,available,reserved,approved,delivered,sort_order,img,description,inventory_month
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      p.id,p.name,p.tier,p.quota,p.stock,p.stock,0,0,0,p.sort,p.img,'',current
    ).run();
    await db.prepare(`UPDATE products SET name=?,tier=?,sort_order=?,img=?,description='' WHERE id=?`)
      .bind(p.name,p.tier,p.sort,p.img,p.id).run();
  }

  await db.prepare(`UPDATE requests SET cycle_month=substr(created_at,1,7) WHERE cycle_month IS NULL OR cycle_month=''`).run();
  await db.prepare(`UPDATE requests SET affects_stock=1 WHERE affects_stock IS NULL`).run();

  const mismatch = await db.prepare(`SELECT COUNT(*) AS n FROM products WHERE inventory_month IS NULL OR inventory_month<>?`).bind(current).first();
  if(Number(mismatch?.n||0)>0){
    await db.prepare(`UPDATE products SET available=total_stock,reserved=0,approved=0,delivered=0,inventory_month=?`).bind(current).run();
  }
}

function b64url(bytes){
  let s=''; for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(s){
  s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='=';
  const raw=atob(s); return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function keyFor(secret){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function makeSession(env){
  const secret=env.SESSION_SECRET||env.ADMIN_PASSWORD;
  if(!secret)throw new Error('SESSION_SECRET no configurada');
  const payload=b64url(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000})));
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',await keyFor(secret),new TextEncoder().encode(payload)));
  return payload+'.'+b64url(sig);
}
function tokenFrom(req){
  const cookie=req.headers.get('cookie')||'';
  return cookie.match(/(?:^|;\s*)hr_admin=([^;]+)/)?.[1]||'';
}
async function isAdmin(req,env){
  try{
    const secret=env.SESSION_SECRET||env.ADMIN_PASSWORD;if(!secret)return false;
    const token=tokenFrom(req);if(!token)return false;
    const [payload,sig]=token.split('.');if(!payload||!sig)return false;
    const ok=await crypto.subtle.verify('HMAC',await keyFor(secret),fromB64url(sig),new TextEncoder().encode(payload));
    if(!ok)return false;
    const obj=JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return Number(obj.exp)>Date.now();
  }catch{return false}
}

async function hashText(value){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function clientIp(req){return req.headers.get('CF-Connecting-IP')||'unknown'}
async function consumeRate(db,key,limit,windowMs){
  const now=Date.now();
  const row=await db.prepare(`SELECT window_start,count FROM rate_limits WHERE key=?`).bind(key).first();
  if(!row || now-Number(row.window_start)>=windowMs){
    await db.prepare(`INSERT OR REPLACE INTO rate_limits(key,window_start,count) VALUES(?,?,1)`).bind(key,now).run();
    return {allowed:true,remaining:Math.max(0,limit-1)};
  }
  if(Number(row.count)>=limit)return {allowed:false,remaining:0,retryAfter:Math.ceil((windowMs-(now-Number(row.window_start)))/1000)};
  await db.prepare(`UPDATE rate_limits SET count=count+1 WHERE key=?`).bind(key).run();
  return {allowed:true,remaining:Math.max(0,limit-Number(row.count)-1)};
}
async function clearRate(db,key){await db.prepare(`DELETE FROM rate_limits WHERE key=?`).bind(key).run().catch(()=>{})}
function sameOrigin(req){
  const origin=req.headers.get('origin');
  if(!origin)return true;
  return origin===new URL(req.url).origin;
}
async function bodyWithinLimit(req,maxBytes=24000){
  const len=Number(req.headers.get('content-length')||0);
  return !len || len<=maxBytes;
}

async function catalog(db){
  const {results}=await db.prepare(`SELECT id,name,tier,quota,total_stock,available,reserved,approved,delivered,sort_order,img,description,inventory_month FROM products ORDER BY sort_order`).all();
  return (results||[]).map(p=>({...p,stock:p.total_stock,desc:''}));
}

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function sendRedeemEmail(env,payload){
  const apiKey=clean(env.BREVO_API_KEY);
  const recipients=clean(env.NOTIFY_EMAILS).split(',').map(x=>x.trim()).filter(Boolean).slice(0,2);
  const from=clean(env.NOTIFY_FROM);
  if(!apiKey||recipients.length!==2||!from)return {sent:false,reason:'not_configured'};
  const rows=payload.clients.map((c,i)=>{
    const models=(c.models||[]).map(m=>`${escapeHtml(m.model)}: <b>${Number(m.qty)||0}</b>`).join(' · ');
    return `<tr><td style="padding:8px;border:1px solid #e5e7eb">${i+1}</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(c.ruc)}</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(c.company)}</td><td style="padding:8px;border:1px solid #e5e7eb">${models}</td></tr>`;
  }).join('');
  const adminUrl='https://honor-rewards.pages.dev/admin/';
  const html=`<div style="font-family:Arial,sans-serif;color:#17212b;max-width:760px;margin:auto">
    <h2 style="margin-bottom:4px">Nuevo canje HONOR Rewards</h2>
    <p style="color:#667085;margin-top:0">Se registró una nueva solicitud y ya figura En revisión.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0">
      <tr><td style="padding:7px"><b>Ejecutivo</b></td><td style="padding:7px">${escapeHtml(payload.executive)}</td></tr>
      <tr><td style="padding:7px"><b>Canal</b></td><td style="padding:7px">${escapeHtml(payload.channel)}</td></tr>
      <tr><td style="padding:7px"><b>Premio</b></td><td style="padding:7px">${escapeHtml(payload.productName)}</td></tr>
      <tr><td style="padding:7px"><b>Total unidades</b></td><td style="padding:7px">${payload.totalQty}</td></tr>
      <tr><td style="padding:7px"><b>Fecha</b></td><td style="padding:7px">${escapeHtml(payload.createdAt)}</td></tr>
    </table>
    <table style="border-collapse:collapse;width:100%;margin:16px 0"><thead><tr><th style="padding:8px;border:1px solid #e5e7eb">#</th><th style="padding:8px;border:1px solid #e5e7eb">RUC</th><th style="padding:8px;border:1px solid #e5e7eb">Razón social</th><th style="padding:8px;border:1px solid #e5e7eb">Modelos / cantidades</th></tr></thead><tbody>${rows}</tbody></table>
    ${payload.comment?`<p><b>Comentario:</b> ${escapeHtml(payload.comment)}</p>`:''}
    <p><a href="${adminUrl}" style="display:inline-block;background:#0057ff;color:white;text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:bold">Abrir panel administrador</a></p>
  </div>`;
  const response=await fetch('https://api.brevo.com/v3/smtp/email',{
    method:'POST',
    headers:{'accept':'application/json','api-key':apiKey,'content-type':'application/json'},
    body:JSON.stringify({
      sender:{name:clean(env.NOTIFY_FROM_NAME)||'HONOR Rewards',email:from},
      to:recipients.map(email=>({email})),
      subject:`Nuevo canje HONOR Rewards · ${payload.productName} · ${payload.executive}`,
      htmlContent:html
    })
  });
  if(!response.ok)throw new Error(`Brevo ${response.status}`);
  return {sent:true};
}
async function sendRedeemWebhook(env,payload){
  const url=clean(env.NOTIFY_WEBHOOK_URL);if(!url)return {sent:false,reason:'not_configured'};
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event:'honor_rewards.redeem',...payload,adminUrl:'https://honor-rewards.pages.dev/admin/'})});
  if(!r.ok)throw new Error(`Webhook ${r.status}`);return {sent:true};
}
async function notifyRedeem(env,payload){
  const jobs=[];
  if(env.BREVO_API_KEY&&env.NOTIFY_EMAILS&&env.NOTIFY_FROM)jobs.push(sendRedeemEmail(env,payload));
  if(env.NOTIFY_WEBHOOK_URL)jobs.push(sendRedeemWebhook(env,payload));
  if(!jobs.length)return;
  await Promise.allSettled(jobs);
}

async function createRedeem(req,db,env,waitUntil){
  if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
  if(!(await bodyWithinLimit(req)))return json({error:'Solicitud demasiado grande.'},413);
  const ipHash=await hashText(clientIp(req));
  const rl=await consumeRate(db,`redeem:${ipHash}`,30,10*60*1000);
  if(!rl.allowed)return json({error:'Demasiadas solicitudes en poco tiempo. Intenta nuevamente en unos minutos.'},429,{'retry-after':String(rl.retryAfter||600)});

  const body=await req.json().catch(()=>null);
  if(!body)return json({error:'Datos inválidos.'},400);
  const executive=clean(body.executive),channel=clean(body.channel),productId=clean(body.productId),comment=clean(body.comment);
  const clients=Array.isArray(body.clients)?body.clients:[];
  if(!executive||executive.length>120||!channel||!productId||!clients.length)return json({error:'Completa los datos requeridos.'},400);
  if(!ALLOWED_CHANNELS.includes(channel))return json({error:'Canal no permitido. Usa Inside Sales, Hunter o Regiones.'},400);
  if(clients.length>2)return json({error:'Solo se permiten hasta 2 clientes por canje.'},400);
  if(comment.length>500)return json({error:'El comentario es demasiado largo.'},400);

  let total=0;const lines=[];
  for(let i=0;i<clients.length;i++){
    const c=clients[i]||{},ruc=clean(c.ruc),company=clean(c.company),models=Array.isArray(c.models)?c.models:[];
    if(!/^\d{11}$/.test(ruc)||!company||company.length>180||!models.length||models.length>10)return json({error:`Revisa RUC, razón social y modelos del cliente ${i+1}.`},400);
    for(const m of models){
      const model=clean(m.model),qty=Number(m.qty);
      if(!ALLOWED_MODELS.includes(model))return json({error:`Modelo HONOR no permitido en el cliente ${i+1}.`},400);
      if(!Number.isInteger(qty)||qty<=0||qty>10000)return json({error:`Revisa las cantidades del cliente ${i+1}.`},400);
      total+=qty; lines.push({ruc,company,model,qty});
    }
  }

  const product=await db.prepare(`SELECT * FROM products WHERE id=?`).bind(productId).first();
  if(!product)return json({error:'Premio no encontrado.'},404);
  if(total<Number(product.quota))return json({error:`Faltan ${Number(product.quota)-total} unidades para alcanzar la cuota.`},400);
  const hold=await db.prepare(`UPDATE products SET available=available-1,reserved=reserved+1 WHERE id=? AND available>0`).bind(productId).run();
  if(!hold?.meta?.changes)return json({error:'Este premio ya no tiene stock disponible.'},409);

  const id=crypto.randomUUID(),now=new Date().toISOString(),cycle=monthKey();
  try{
    await db.prepare(`INSERT INTO requests(id,created_at,executive,channel,product_id,total_qty,comment,status,admin_note,cycle_month,affects_stock) VALUES(?,?,?,?,?,?,?,?,?,?,1)`)
      .bind(id,now,executive,channel,productId,total,comment,'En revisión','',cycle).run();
    for(const l of lines)await db.prepare(`INSERT INTO request_lines(request_id,ruc,company,model,qty) VALUES(?,?,?,?,?)`).bind(id,l.ruc,l.company,l.model,l.qty).run();
  }catch(e){
    await db.prepare(`DELETE FROM request_lines WHERE request_id=?`).bind(id).run().catch(()=>{});
    await db.prepare(`DELETE FROM requests WHERE id=?`).bind(id).run().catch(()=>{});
    await db.prepare(`UPDATE products SET available=available+1,reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END WHERE id=?`).bind(productId).run().catch(()=>{});
    throw e;
  }

  const notifyPayload={id,createdAt:now,executive,channel,productName:product.name,totalQty:total,comment,clients};
  const notification=notifyRedeem(env,notifyPayload).catch(()=>{});
  if(waitUntil)waitUntil(notification); else await notification;
  return json({ok:true,id,status:'En revisión',message:'Solicitud registrada correctamente.'},201);
}

async function adminRequests(db,requestedMonth){
  const current=monthKey(),month=requestedMonth==='all'?'all':(requestedMonth||current);
  const stmt=month==='all'
    ? db.prepare(`SELECT r.*,p.name AS product_name,p.quota FROM requests r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC`)
    : db.prepare(`SELECT r.*,p.name AS product_name,p.quota FROM requests r JOIN products p ON p.id=r.product_id WHERE r.cycle_month=? ORDER BY r.created_at DESC`).bind(month);
  const {results}=await stmt.all();
  for(const r of(results||[])){
    const q=await db.prepare(`SELECT ruc,company,model,qty FROM request_lines WHERE request_id=? ORDER BY id`).bind(r.id).all();r.lines=q.results||[];
  }
  const mq=await db.prepare(`SELECT DISTINCT cycle_month FROM requests WHERE cycle_month IS NOT NULL AND cycle_month<>'' ORDER BY cycle_month DESC`).all();
  return {requests:results||[],months:(mq.results||[]).map(x=>x.cycle_month),currentMonth:current,selectedMonth:month};
}

async function updateStatus(req,db){
  if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
  const b=await req.json().catch(()=>null);if(!b)return json({error:'Datos inválidos.'},400);
  const id=clean(b.id),next=clean(b.status),note=clean(b.note);
  if(!['Aprobado','Rechazado','Entregado'].includes(next))return json({error:'Estado inválido.'},400);
  const r=await db.prepare(`SELECT * FROM requests WHERE id=?`).bind(id).first();if(!r)return json({error:'Solicitud no encontrada.'},404);
  const old=r.status;if(old===next){await db.prepare(`UPDATE requests SET admin_note=? WHERE id=?`).bind(note,id).run();return json({ok:true,status:next})}
  const allowed=(old==='En revisión'&&['Aprobado','Rechazado','Entregado'].includes(next))||(old==='Aprobado'&&['Rechazado','Entregado'].includes(next));
  if(!allowed)return json({error:'Cambio de estado no permitido.'},400);
  const affects=Number(r.affects_stock??1)===1&&r.cycle_month===monthKey();
  if(affects&&old==='En revisión'&&next==='Aprobado')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,approved=approved+1 WHERE id=?`).bind(r.product_id).run();
  else if(affects&&old==='En revisión'&&next==='Rechazado')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,available=available+1 WHERE id=?`).bind(r.product_id).run();
  else if(affects&&old==='En revisión'&&next==='Entregado')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,delivered=delivered+1 WHERE id=?`).bind(r.product_id).run();
  else if(affects&&old==='Aprobado'&&next==='Rechazado')await db.prepare(`UPDATE products SET approved=CASE WHEN approved>0 THEN approved-1 ELSE 0 END,available=available+1 WHERE id=?`).bind(r.product_id).run();
  else if(affects&&old==='Aprobado'&&next==='Entregado')await db.prepare(`UPDATE products SET approved=CASE WHEN approved>0 THEN approved-1 ELSE 0 END,delivered=delivered+1 WHERE id=?`).bind(r.product_id).run();
  await db.prepare(`UPDATE requests SET status=?,admin_note=? WHERE id=?`).bind(next,note,id).run();
  return json({ok:true,status:next});
}

async function deleteRequest(req,db){
  if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
  const b=await req.json().catch(()=>null),id=clean(b?.id);if(!id)return json({error:'Solicitud inválida.'},400);
  const r=await db.prepare(`SELECT * FROM requests WHERE id=?`).bind(id).first();if(!r)return json({error:'Solicitud no encontrada.'},404);
  const affects=Number(r.affects_stock??1)===1&&r.cycle_month===monthKey();
  if(affects&&r.status==='En revisión')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,available=available+1 WHERE id=?`).bind(r.product_id).run();
  else if(affects&&r.status==='Aprobado')await db.prepare(`UPDATE products SET approved=CASE WHEN approved>0 THEN approved-1 ELSE 0 END,available=available+1 WHERE id=?`).bind(r.product_id).run();
  await db.prepare(`DELETE FROM request_lines WHERE request_id=?`).bind(id).run();
  await db.prepare(`DELETE FROM requests WHERE id=?`).bind(id).run();
  return json({ok:true});
}
async function updateProduct(req,db){
  if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
  const b=await req.json().catch(()=>null);if(!b)return json({error:'Datos inválidos.'},400);
  const id=clean(b.id),quota=Number(b.quota),total=Number(b.total_stock);
  if(!id||!Number.isInteger(quota)||quota<1||!Number.isInteger(total)||total<0)return json({error:'Valores inválidos.'},400);
  const p=await db.prepare(`SELECT * FROM products WHERE id=?`).bind(id).first();if(!p)return json({error:'Premio no encontrado.'},404);
  const committed=Number(p.reserved)+Number(p.approved)+Number(p.delivered);
  if(total<committed)return json({error:`El stock mensual no puede ser menor a ${committed} porque ya existen premios comprometidos.`},400);
  await db.prepare(`UPDATE products SET quota=?,total_stock=?,available=?,inventory_month=? WHERE id=?`).bind(quota,total,total-committed,monthKey(),id).run();
  return json({ok:true});
}
async function resetCurrentMonth(req,db){
  if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
  const current=monthKey();
  await db.prepare(`UPDATE requests SET affects_stock=0 WHERE cycle_month=? AND COALESCE(affects_stock,1)=1`).bind(current).run();
  await db.prepare(`UPDATE products SET available=total_stock,reserved=0,approved=0,delivered=0,inventory_month=?`).bind(current).run();
  return json({ok:true,currentMonth:current,message:'Stock mensual restablecido. Las cuotas y el histórico se conservaron.'});
}

export async function onRequest(context){
  const {request,env}=context,url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
  if(path==='/api/health'&&request.method==='GET')return json({
    ok:true,databaseConfigured:!!env.DB,adminPasswordConfigured:!!env.ADMIN_PASSWORD,
    sessionSecretConfigured:!!env.SESSION_SECRET,notificationsConfigured:!!(env.BREVO_API_KEY&&env.NOTIFY_EMAILS&&env.NOTIFY_FROM)
  });
  if(!env.DB)return json({error:'Base de datos aún no vinculada.'},503);
  try{await initDB(env.DB)}catch(e){return json({error:'No se pudo inicializar la base de datos.',detail:String(e?.message||e)},500)}
  try{
    if(path==='/api/catalog'&&request.method==='GET')return json({products:await catalog(env.DB),currentMonth:monthKey()});
    if(path==='/api/redeem'&&request.method==='POST')return createRedeem(request,env.DB,env,context.waitUntil?.bind(context));
    if(path==='/api/admin/login'&&request.method==='POST'){
      if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
      if(!env.ADMIN_PASSWORD)return json({error:'ADMIN_PASSWORD aún no configurada en Cloudflare.'},503);
      const key=`login:${await hashText(clientIp(request))}`;
      const rl=await consumeRate(env.DB,key,5,15*60*1000);
      if(!rl.allowed)return json({error:'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.'},429,{'retry-after':String(rl.retryAfter||900)});
      const b=await request.json().catch(()=>({}));
      if(String(b.password||'')!==String(env.ADMIN_PASSWORD))return json({error:'Contraseña incorrecta.'},401);
      await clearRate(env.DB,key);
      const token=await makeSession(env);
      return json({ok:true},200,{'set-cookie':`hr_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
    }
    if(path==='/api/admin/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':'hr_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
    if(path.startsWith('/api/admin/')){
      if(!(await isAdmin(request,env)))return json({error:'No autorizado.'},401);
      if(path==='/api/admin/me'&&request.method==='GET')return json({ok:true});
      if(path==='/api/admin/requests'&&request.method==='GET')return json(await adminRequests(env.DB,url.searchParams.get('month')));
      if(path==='/api/admin/products'&&request.method==='GET')return json({products:await catalog(env.DB),currentMonth:monthKey()});
      if(path==='/api/admin/status'&&request.method==='POST')return updateStatus(request,env.DB);
      if(path==='/api/admin/delete'&&request.method==='POST')return deleteRequest(request,env.DB);
      if(path==='/api/admin/product'&&request.method==='POST')return updateProduct(request,env.DB);
      if(path==='/api/admin/reset-month'&&request.method==='POST')return resetCurrentMonth(request,env.DB);
    }
    return json({error:'Ruta no encontrada.'},404);
  }catch(e){return json({error:'Error interno.',detail:String(e?.message||e)},500)}
}

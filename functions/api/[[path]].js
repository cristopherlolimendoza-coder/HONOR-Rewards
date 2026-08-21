const DEFAULT_PRODUCTS=[
{id:'cafe',name:'Stanley Café-To-Go',tier:'Atractivo',quota:10,stock:8,sort:1,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/cafe.webp',desc:'Premio atractivo para canje rápido.'},
{id:'aerolight',name:'Stanley Aerolight',tier:'Atractivo',quota:15,stock:8,sort:2,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/aerolight.webp',desc:'Botella ligera Stanley para campañas recurrentes.'},
{id:'vitalize',name:'Stanley Vitalize Shaker',tier:'Atractivo',quota:20,stock:5,sort:3,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/vitalize.webp',desc:'Premio atractivo para metas intermedias.'},
{id:'earbuds',name:'HONOR Choice Auriculares',tier:'Premium',quota:10,stock:10,sort:4,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/earbuds.webp',desc:'Premio premium de alta rotación.'},
{id:'airfryer',name:'HONOR Choice Air Fryer',tier:'Premium',quota:40,stock:5,sort:5,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/airfryer.webp',desc:'Premio premium para operaciones de mayor volumen.'},
{id:'robot',name:'Aspiradora Robot HONOR Choice R3',tier:'Excepcional',quota:50,stock:3,sort:6,img:'https://raw.githubusercontent.com/cristopherlolimendoza-coder/APORTES-B2B/main/rewards/assets/robot.webp',desc:'Premio excepcional para cierres de mayor impacto.'}
];

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const clean=s=>String(s??'').trim();

async function initDB(db){
  await db.exec(`
  CREATE TABLE IF NOT EXISTS products(
    id TEXT PRIMARY KEY,name TEXT NOT NULL,tier TEXT NOT NULL,quota INTEGER NOT NULL,
    total_stock INTEGER NOT NULL,available INTEGER NOT NULL,reserved INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL,img TEXT,description TEXT
  );
  CREATE TABLE IF NOT EXISTS requests(
    id TEXT PRIMARY KEY,created_at TEXT NOT NULL,executive TEXT NOT NULL,channel TEXT NOT NULL,
    product_id TEXT NOT NULL,total_qty INTEGER NOT NULL,comment TEXT,status TEXT NOT NULL,
    admin_note TEXT DEFAULT '',FOREIGN KEY(product_id) REFERENCES products(id)
  );
  CREATE TABLE IF NOT EXISTS request_lines(
    id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL,ruc TEXT NOT NULL,
    company TEXT NOT NULL,model TEXT NOT NULL,qty INTEGER NOT NULL,
    FOREIGN KEY(request_id) REFERENCES requests(id)
  );`);
  for(const p of DEFAULT_PRODUCTS){
    await db.prepare(`INSERT OR IGNORE INTO products
      (id,name,tier,quota,total_stock,available,reserved,delivered,sort_order,img,description)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(p.id,p.name,p.tier,p.quota,p.stock,p.stock,0,0,p.sort,p.img,p.desc).run();
  }
}

function b64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromB64url(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function keyFor(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function makeSession(env){const secret=env.SESSION_SECRET||env.ADMIN_PASSWORD;if(!secret)throw new Error('ADMIN_PASSWORD no configurada');const payload=b64url(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000})));const sig=new Uint8Array(await crypto.subtle.sign('HMAC',await keyFor(secret),new TextEncoder().encode(payload)));return payload+'.'+b64url(sig)}
async function isAdmin(req,env){try{const secret=env.SESSION_SECRET||env.ADMIN_PASSWORD;if(!secret)return false;const cookie=req.headers.get('cookie')||'';const m=cookie.match(/(?:^|;\s*)hr_admin=([^;]+)/);if(!m)return false;const [payload,sig]=m[1].split('.');if(!payload||!sig)return false;const ok=await crypto.subtle.verify('HMAC',await keyFor(secret),fromB64url(sig),new TextEncoder().encode(payload));if(!ok)return false;const obj=JSON.parse(new TextDecoder().decode(fromB64url(payload)));return Number(obj.exp)>Date.now()}catch{return false}}

async function catalog(db){
  const {results}=await db.prepare(`SELECT id,name,tier,quota,total_stock,available,reserved,delivered,sort_order,img,description FROM products ORDER BY sort_order`).all();
  return results.map(p=>({...p,stock:p.total_stock,desc:p.description}));
}

async function createRedeem(req,db){
  const body=await req.json().catch(()=>null);if(!body)return json({error:'Datos inválidos.'},400);
  const executive=clean(body.executive),channel=clean(body.channel),productId=clean(body.productId),comment=clean(body.comment);
  const clients=Array.isArray(body.clients)?body.clients:[];
  if(!executive||!channel||!productId||!clients.length)return json({error:'Completa los datos requeridos.'},400);
  let total=0;const lines=[];
  for(let i=0;i<clients.length;i++){
    const c=clients[i]||{},ruc=clean(c.ruc),company=clean(c.company),models=Array.isArray(c.models)?c.models:[];
    if(!/^\d{1,11}$/.test(ruc)||!company||!models.length)return json({error:`Revisa los datos del cliente ${i+1}.`},400);
    for(const m of models){const model=clean(m.model),qty=Number(m.qty);if(!model||!Number.isInteger(qty)||qty<=0)return json({error:`Revisa las cantidades del cliente ${i+1}.`},400);total+=qty;lines.push({ruc,company,model,qty})}
  }
  const product=await db.prepare(`SELECT * FROM products WHERE id=?`).bind(productId).first();
  if(!product)return json({error:'Premio no encontrado.'},404);
  if(total<Number(product.quota))return json({error:`Faltan ${Number(product.quota)-total} unidades para alcanzar la cuota.`},400);
  const hold=await db.prepare(`UPDATE products SET available=available-1,reserved=reserved+1 WHERE id=? AND available>0`).bind(productId).run();
  if(!hold?.meta?.changes)return json({error:'Este premio ya no tiene stock disponible.'},409);
  const id=crypto.randomUUID();const now=new Date().toISOString();
  try{
    await db.prepare(`INSERT INTO requests(id,created_at,executive,channel,product_id,total_qty,comment,status,admin_note) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(id,now,executive,channel,productId,total,comment,'En revisión','').run();
    for(const l of lines)await db.prepare(`INSERT INTO request_lines(request_id,ruc,company,model,qty) VALUES(?,?,?,?,?)`).bind(id,l.ruc,l.company,l.model,l.qty).run();
  }catch(e){await db.prepare(`UPDATE products SET available=available+1,reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END WHERE id=?`).bind(productId).run();throw e}
  return json({ok:true,id,status:'En revisión'},201);
}

async function adminRequests(db){
  const {results}=await db.prepare(`SELECT r.*,p.name AS product_name,p.quota FROM requests r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC`).all();
  for(const r of results){const q=await db.prepare(`SELECT ruc,company,model,qty FROM request_lines WHERE request_id=? ORDER BY id`).bind(r.id).all();r.lines=q.results||[]}
  return results;
}

async function updateStatus(req,db){
  const b=await req.json().catch(()=>null);if(!b)return json({error:'Datos inválidos.'},400);
  const id=clean(b.id),next=clean(b.status),note=clean(b.note);if(!['Aprobado','Rechazado','Entregado'].includes(next))return json({error:'Estado inválido.'},400);
  const r=await db.prepare(`SELECT * FROM requests WHERE id=?`).bind(id).first();if(!r)return json({error:'Solicitud no encontrada.'},404);
  const old=r.status;if(old===next){await db.prepare(`UPDATE requests SET admin_note=? WHERE id=?`).bind(note,id).run();return json({ok:true})}
  if(old==='En revisión'&&next==='Rechazado')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,available=available+1 WHERE id=?`).bind(r.product_id).run();
  else if(old==='Aprobado'&&next==='Rechazado')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,available=available+1 WHERE id=?`).bind(r.product_id).run();
  else if((old==='En revisión'||old==='Aprobado')&&next==='Entregado')await db.prepare(`UPDATE products SET reserved=CASE WHEN reserved>0 THEN reserved-1 ELSE 0 END,delivered=delivered+1 WHERE id=?`).bind(r.product_id).run();
  else if(old==='En revisión'&&next==='Aprobado'){}
  else return json({error:'Cambio de estado no permitido.'},400);
  await db.prepare(`UPDATE requests SET status=?,admin_note=? WHERE id=?`).bind(next,note,id).run();return json({ok:true});
}

async function updateProduct(req,db){
  const b=await req.json().catch(()=>null);if(!b)return json({error:'Datos inválidos.'},400);
  const id=clean(b.id),quota=Number(b.quota),total=Number(b.total_stock);if(!id||!Number.isInteger(quota)||quota<1||!Number.isInteger(total)||total<0)return json({error:'Valores inválidos.'},400);
  const p=await db.prepare(`SELECT * FROM products WHERE id=?`).bind(id).first();if(!p)return json({error:'Premio no encontrado.'},404);
  const committed=Number(p.reserved)+Number(p.delivered);if(total<committed)return json({error:`El stock total no puede ser menor a ${committed} porque ya existen premios reservados/entregados.`},400);
  const available=total-committed;await db.prepare(`UPDATE products SET quota=?,total_stock=?,available=? WHERE id=?`).bind(quota,total,available,id).run();return json({ok:true});
}

export async function onRequest(context){
  const {request,env}=context;const url=new URL(request.url);const path=url.pathname.replace(/\/+$/,'')||'/';
  if(!env.DB)return json({error:'Base de datos aún no vinculada.'},503);
  await initDB(env.DB);
  try{
    if(path==='/api/catalog'&&request.method==='GET')return json({products:await catalog(env.DB)});
    if(path==='/api/redeem'&&request.method==='POST')return createRedeem(request,env.DB);
    if(path==='/api/admin/login'&&request.method==='POST'){
      if(!env.ADMIN_PASSWORD)return json({error:'ADMIN_PASSWORD aún no configurada en Cloudflare.'},503);
      const b=await request.json().catch(()=>({}));if(String(b.password||'')!==String(env.ADMIN_PASSWORD))return json({error:'Contraseña incorrecta.'},401);
      const token=await makeSession(env);return json({ok:true},200,{'set-cookie':`hr_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
    }
    if(path==='/api/admin/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':'hr_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
    if(path.startsWith('/api/admin/')){
      if(!(await isAdmin(request,env)))return json({error:'No autorizado.'},401);
      if(path==='/api/admin/me'&&request.method==='GET')return json({ok:true});
      if(path==='/api/admin/requests'&&request.method==='GET')return json({requests:await adminRequests(env.DB)});
      if(path==='/api/admin/products'&&request.method==='GET')return json({products:await catalog(env.DB)});
      if(path==='/api/admin/status'&&request.method==='POST')return updateStatus(request,env.DB);
      if(path==='/api/admin/product'&&request.method==='POST')return updateProduct(request,env.DB);
    }
    return json({error:'Ruta no encontrada.'},404);
  }catch(e){return json({error:'Error interno.',detail:String(e?.message||e)},500)}
}
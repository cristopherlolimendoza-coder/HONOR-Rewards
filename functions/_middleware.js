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

function secure(response,path){
  const headers=new Headers(response.headers);
  for(const [k,v] of Object.entries(SECURITY_HEADERS))headers.set(k,v);
  if(path.startsWith('/admin')||path.startsWith('/api/admin'))headers.set('Cache-Control','no-store, max-age=0');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export async function onRequest(context){
  const path=new URL(context.request.url).pathname;
  let response=secure(await context.next(),path);
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  return new HTMLRewriter()
    .on('body',{element(el){el.append('<script src="/image-fix.js?v=23"></script>',{html:true});}})
    .transform(response);
}

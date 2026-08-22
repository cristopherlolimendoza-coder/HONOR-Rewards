export async function onRequest(context){
  const response=await context.next();
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html')) return response;
  return new HTMLRewriter()
    .on('body',{element(el){el.append('<script src="/image-fix.js?v=4"></script>',{html:true});}})
    .transform(response);
}

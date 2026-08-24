(()=>{
  const directSources={
    'Stanley Aerolight':'/assets/stanley-aerolight-exact-v15.webp?v=16'
  };
  const b64Sources={
    'HONOR Choice Auriculares':'/assets/earbuds-v9.b64',
    'HONOR Choice Air Fryer':'/assets/airfryer-v9.b64',
    'Aspiradora Robot HONOR Choice R3':'/assets/honor-choice-robot-r3.b64'
  };
  const data={...directSources};
  let applying=false;

  function applyOne(name,src){
    document.querySelectorAll('.card').forEach(card=>{
      const cardName=card.querySelector('h3')?.textContent?.trim();
      const img=card.querySelector('.photo img');
      if(cardName===name&&img&&img.getAttribute('src')!==src){
        img.src=src;
        img.removeAttribute('srcset');
        img.style.objectFit='contain';
        img.style.maxWidth='100%';
        img.style.maxHeight='100%';
      }
    });
    const modalName=document.getElementById('productName')?.textContent?.trim();
    const modalImg=document.getElementById('productImage');
    if(modalName===name&&modalImg&&modalImg.getAttribute('src')!==src){
      modalImg.src=src;
      modalImg.removeAttribute('srcset');
      modalImg.style.objectFit='contain';
      modalImg.style.maxWidth='100%';
      modalImg.style.maxHeight='100%';
    }
  }

  function apply(){
    if(applying)return;
    applying=true;
    try{Object.entries(data).forEach(([name,src])=>applyOne(name,src));}
    finally{applying=false;}
  }

  async function loadB64(name,url){
    try{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)throw new Error(`${r.status}`);
      const b64=(await r.text()).replace(/\s+/g,'');
      if(!b64.startsWith('UklG'))throw new Error('archivo WebP inválido');
      const src=`data:image/webp;base64,${b64}`;
      data[name]=src;
      applyOne(name,src);
    }catch(e){console.error(`No se pudo cargar ${name}`,e);}
  }

  function start(){
    new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true,characterData:true});
    apply();
    Object.entries(b64Sources).forEach(([name,url])=>loadB64(name,url));
  }

  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('click',()=>setTimeout(apply,0),true);
})();
(()=>{
  const fixes={
    'Stanley Aerolight':['/assets/stanley-aerolight.b64'],
    'HONOR Choice Auriculares':['/assets/honor-choice-auriculares-prefix.b64','/assets/honor-choice-auriculares.b64'],
    'HONOR Choice Air Fryer':['/assets/honor-choice-air-fryer-prefix.b64','/assets/honor-choice-air-fryer.b64'],
    'Aspiradora Robot HONOR Choice R3':['/assets/honor-choice-robot-r3.b64']
  };
  const data={};
  let applying=false;

  async function load(){
    await Promise.all(Object.entries(fixes).map(async([name,urls])=>{
      try{
        const parts=await Promise.all(urls.map(async url=>{
          const r=await fetch(url,{cache:'no-store'});
          if(!r.ok) throw new Error(url+' '+r.status);
          return (await r.text()).replace(/\s+/g,'');
        }));
        const b64=parts.join('');
        if(b64) data[name]='data:image/png;base64,'+b64;
      }catch(e){console.warn('Imagen no cargada:',name,e);}
    }));
    apply();
  }

  function apply(){
    if(applying) return;
    applying=true;
    try{
      document.querySelectorAll('.card').forEach(card=>{
        const name=card.querySelector('h3')?.textContent?.trim();
        const img=card.querySelector('.photo img');
        if(name&&img&&data[name]&&img.src!==data[name]) img.src=data[name];
      });
      const modalName=document.getElementById('productName')?.textContent?.trim();
      const modalImg=document.getElementById('productImage');
      if(modalName&&modalImg&&data[modalName]&&modalImg.src!==data[modalName]) modalImg.src=data[modalName];
    }finally{applying=false;}
  }

  const obs=new MutationObserver(()=>apply());
  const start=()=>obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  if(document.body) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('click',()=>setTimeout(apply,0),true);
  load();
})();
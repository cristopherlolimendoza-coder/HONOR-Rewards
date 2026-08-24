(()=>{
  const fixes={
    'Stanley Aerolight':'/assets/stanley-aerolight-v11.b64',
    'HONOR Choice Auriculares':'/assets/earbuds-v9.b64',
    'HONOR Choice Air Fryer':'/assets/airfryer-v9.b64',
    'Aspiradora Robot HONOR Choice R3':'/assets/honor-choice-robot-r3.b64'
  };
  const data={};
  let applying=false;

  async function load(){
    await Promise.all(Object.entries(fixes).map(async([name,url])=>{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok) throw new Error(`${name}: ${r.status}`);
      const b64=(await r.text()).replace(/\s+/g,'');
      data[name]=`data:image/webp;base64,${b64}`;
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
        if(name&&img&&data[name]&&img.src!==data[name]){
          img.src=data[name];
          img.removeAttribute('srcset');
          img.style.objectFit='contain';
          img.style.maxWidth='100%';
          img.style.maxHeight='100%';
        }
      });
      const modalName=document.getElementById('productName')?.textContent?.trim();
      const modalImg=document.getElementById('productImage');
      if(modalName&&modalImg&&data[modalName]&&modalImg.src!==data[modalName]){
        modalImg.src=data[modalName];
        modalImg.removeAttribute('srcset');
        modalImg.style.objectFit='contain';
        modalImg.style.maxWidth='100%';
        modalImg.style.maxHeight='100%';
      }
    }finally{applying=false;}
  }

  const start=()=>{
    new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true,characterData:true});
    apply();
    load().catch(e=>console.error('Error cargando imágenes HONOR Rewards',e));
  };
  if(document.body) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('click',()=>setTimeout(apply,0),true);
})();
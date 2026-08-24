(()=>{
  const fixes={
    'HONOR Choice Auriculares':'/assets/honor-choice-auriculares.webp?v=6',
    'HONOR Choice Air Fryer':'/assets/honor-choice-air-fryer.webp?v=6'
  };
  let applying=false;

  function apply(){
    if(applying) return;
    applying=true;
    try{
      document.querySelectorAll('.card').forEach(card=>{
        const name=card.querySelector('h3')?.textContent?.trim();
        const img=card.querySelector('.photo img');
        const src=fixes[name];
        if(name&&img&&src&&img.getAttribute('src')!==src){
          img.src=src;
          img.removeAttribute('srcset');
          img.style.objectFit='contain';
        }
      });

      const modalName=document.getElementById('productName')?.textContent?.trim();
      const modalImg=document.getElementById('productImage');
      const modalSrc=fixes[modalName];
      if(modalName&&modalImg&&modalSrc&&modalImg.getAttribute('src')!==modalSrc){
        modalImg.src=modalSrc;
        modalImg.removeAttribute('srcset');
        modalImg.style.objectFit='contain';
      }
    }finally{
      applying=false;
    }
  }

  const start=()=>{
    const obs=new MutationObserver(()=>apply());
    obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    apply();
  };

  if(document.body) start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('click',()=>setTimeout(apply,0),true);
})();
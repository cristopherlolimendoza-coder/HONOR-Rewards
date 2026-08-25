(()=>{
  const directSources={
    'Stanley Aerolight':'data:image/webp;base64,UklGRpgIAABXRUJQVlA4IIwIAACQOACdASrhAOEAPhkMhUGhBCbBOwQAYS0t3C6SMk3/UfjN2HvsT2FzkX28/LflL8iuZi8nX9V/JT8nuTuAB+P/zT/C/k5/dPaz+B8y+5O/sn5cdCz5R6iH9J/1v+A/Jz4rP8Dz/fQv/M/wX7afJL/Q/8t+a/96///K3fsgK/2Ksvr6eu0xjoiFW/Obhe5iLsKwSnk1cd92zv21+Duv+r8mFRydiPoVa6oJvHV+dkefZ1z6zm8kOMgA39Thch2+XHgJOb8/YNZelU/aXgOpYIsKl3w6N3arPaLhX6Dkq5kEaX5mWxyKdPKnnlChg3H1ZeG47a2o3XJCqfJXb2QAb+p6Gch8f76uPOlROXriWJVWbaVEpd8OyuAKwNbZiXq+ARwjMsk+b4TVSj6gA39j7H4SvpnggfAtqlJ63wgDxQU/DssqJ2A84Co1JR53qU835Y5FRaQ5IM2TylXI8aH869gTJdMtQ3FscioneoZVPEXy92OaDOL46Jy8XqLHIqLYa6zmHdW7BexOqcFJxeZB00/DssqJ3K6ajHonQLOBIyADf1Ct4qXFU/+yjx3L8EnQsOCHSDwmQwBrHnl1GCRkAG/tBCgPlbflQD4XsgApAAD+//HGIuX1+t2ivaMWm4z/B9nAf8wDeWKMdQynPf/JUPObxqm7v8P34Xv0/53oVQjBc2flPHcdtOV4F0fT/G5PEJfwCTYWPWWMpQHrX9uVYLEtnerJpY6ivoyKckX52Qjj6DAhDy/Ln3Fx+n/UkorMA4tYUysfgaYqnDllP4T+IeC4iBLsYzYD9ZM/BNZ9KzwufXXtZMyzA6Vn3P+1cB8qhpsCiv4pQGJ5rM9lbJp1/vTKJbRVhhpUo1zEjaZBPn2yCKoI7jGFg7/8MR9Loz7wEWOTFE4BPq45thhi9X8ZggIR9dMiIt8O8e3XuMXItqfeL8VbYesRqnPwGL7ztXG3cwwofBV5Zhf21qBjKh7lP4sNh7Fz59GgkwBF9DR87ZBkO4kLNCF9hpCJ/mnUTRWKh1bWNKUL2uPGvfQ6+3/n5q43VeHLx5AFFJgWoKEURpAHddb39i5/QW8HyMM7EaN2DZP/AAF1ZlIVA2o1GryXThig0BN0dWRJfRzO8Rw28U6ClL7AVCe/+ZXMD/22/sA/zjujCWwR7n48iOc5SGhbNNzmfsU06NPjVYchDyf9M9Uchjc7zDRdMSOdXpB+J4i8YHTCoOGY6tivyeZ6YlJnQU8Dm//0YZIfbwxrHFYP6zXdvW3LwH0DZM0fSU8IF9ejbbvJ4joruCaCscJhkWGlB7LldplvrNlQ5bJZ1JNh62x4GmoKfD0DxhbydLUF6h3wQMRY3ZQXzEUChRd2bVfTQd+K6L1MSWEjtUSYuPOc4W5djEr9oRX/qdQ/0qeJjPIAq/p2F/n2SPff3clN4krnMwxYQ2XiJ16wJdJWcjdw5dR0Nj60qyZgtEInFroWusdw63jjf20p+husJHn509vN1M5pt4INAsLaPkKxpNI4fvQyyuZtyD4YkAZvIoBewxBFF1PVDkwDHmgGnoHZwzxYtIzJRRdh2RapHgrOyEgthZMyokQqIQm4AvYiMsVqi7w3xeFmCBe0kV/sJzvJM4dKiVbYhZBCliVbinS0EWSaZHAz3nQtNTeVYdAOqtfVqWQ0x512AXtB2a8ISXQVfUC+ys6f/JJcGnBZYpquhXQu6se4pWiotLoCUFppmT6ORg+jXo37JHXbV1EvqWj/xw7sF/YAuf/2ItAZxHqU5hqT8XZ76fP9Acl0DBszxg+sb6ZpqZmCtXvS96J6NU4zwCFxO5XFk6g/t6evXddBPxTjgZWkskKmoAdKtCiyHYKst0f1BBMIPP5qI8+64D69UxkNX/yJ1iwaDVVQTxYsti++qhDa13OovabThSweMuIh1MgEQNB47U3AS9TSN0Pat3Rd/9+2PZoZ+9u93xbUr/gdd3EXl8girEsFm6XmPELX1DyObveAagBbL87w+15qeQfsGlY6v8EkYgWN4IoDhVhmaUQK3h0UxfywnWDT/qqBvF86k1bRwCOZ5IuD3oT6Ff3VNzthH94FWZuqp5Ih2FFD+E/tbrZol7Es+OxGqKkBb4fyuymTuoqOU7zFm+n8E9u+Vkpqq85/6dZwsctToYEH5YdNtWD/pfioV0Jf5BqHv0gmzR7wCCIq7fgdeoZzN0DqICaocp7xzYQuhrfzGBuUh7Fwr0uFsoGlswsFO94xCWkhwbIoP3MaWoQvMrQW29XGpMZiz08PIiNZlIiUwG8IGXq3Srmd8FBjlZApNh9b8zrVTnAtgvKtsIDRBoGyPY+w62qjdvcfD4VLZvwHH7iEd5BFT8HrLNBLLUkPGcmGeDwihTFloP9ZR4zJnH/GSRbyaVGVJvgu12IxzThO08u057tHm8MYm/LKPpZpyO1ysiTHEvLz3vUjz/nUdDabdYjV0F0EDRpJ+BsBx2j4GZ7yfLiU6ACADNRIHFTLnMoXRbrHCJUMsPZnxRsyXeIGL7Hii1i6yzUpfPy1NRxDPD6Qry87dRwES2ZkC6qh5zoqo5/W3JKzPTNVB5FG/iRBGRR3ZKCY4Nc9B+lA96lj4QKUDwfyWH+A8p72dS1bPpkUZscdr2/xByqWkxUnxdEoDJsyXPw2tr5vDtzWGN/M2hhCnHezg4UMHwmRhahdi0GBkEfIjBWBvcr5dN25gRTwVlcSFhzKWHGXTecKDMczy3evB7fXuvazkhSV811e5/c77Ier/+LGer7HcxoPcq1pgFGBtw/CAZvTigL7Y02WMvBc94Ux+k5fG+jS5G0LWIvCIn6Esdvk3DX3H/B4vAd+vGHu8UkAnN38MkUAjsjhF30JmxE//5nZT8MTxLiswl/wWu8pihf0W94pkqoBRpnqT3Rt80uZeDYjXoqjiDpgAAA'
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
        img.style.imageRendering='auto';
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
      modalImg.style.imageRendering='auto';
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
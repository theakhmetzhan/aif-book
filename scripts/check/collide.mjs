// Sweeps every page turn and reports any pop-up or string vertex that ends up inside a page or board slab.
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage(); await p.setViewport({width:800,height:500});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>['error','warn','warning'].includes(m.type())&&errs.push(m.text().slice(0,200)));
await p.goto(''+(process.env.URL||"http://localhost:5181/aif-book/")+'?freeze=1&p=0',{waitUntil:'networkidle0'}); await p.waitForFunction(()=>document.body.classList.contains('ready'),{timeout:90000});
const res=await p.evaluate(async ()=>{
  const B=__book.book, THREE_V=(x,y,z)=>({x,y,z});
  const PW=14, PH=20, ST=0.15, BW=14.5, BT=0.2;
  const step=+(new URLSearchParams(location.search).get('step')||0.02);
  const worst=[]; let checked=0;
  const inv=new (B.group.matrixWorld.constructor)();
  for(let pp=0; pp<=B.sheets.length+0.0001; pp+=0.01){
    const q=Math.round(pp*1000)/1000; B.set(q,0,0); B.group.updateMatrixWorld(true);
    // slabs in each sheet's pivot frame
    const slabs=B.sheets.map(s=>{ const m=s.pivot.matrixWorld.clone().invert(); return s.isBoard?{m,x0:0,x1:14.3,y0:s.bot,y1:s.top,z:10.3}:{m,x0:0.07,x1:PW+0.07,y0:s.bot,y1:s.top,z:PH/2}; });
    // page against page: points over every sheet's faces tested against every other sheet
    B.sheets.forEach((s,si)=>{ const x0=s.isBoard?0:0.07, x1=s.isBoard?14.3:PW+0.07, zz=s.isBoard?10.3:PH/2;
      for(let a=0;a<=12;a++) for(let c=0;c<=6;c++) for(const y of [s.bot,s.top]){ const v=new (B.group.position.constructor)(x0+(x1-x0)*a/12, y, -zz+2*zz*c/6).applyMatrix4(s.pivot.matrixWorld); checked++;
        slabs.forEach((t,ti)=>{ if(ti===si) return; const l=v.clone().applyMatrix4(t.m); const tol=0.004;
          if(l.x>t.x0+tol&&l.x<t.x1-tol&&l.y>t.y0+tol&&l.y<t.y1-tol&&Math.abs(l.z)<t.z-tol){ worst.push({p:q,face:'sheet'+si,sheet:ti,depth:+Math.min(l.y-t.y0,t.y1-l.y).toFixed(4),obj:'page'}); } }); } });
    for(const f of B.faces){ if(!f.root.visible) continue;
      f.root.traverse(o=>{ if(!o.isMesh||!o.visible||!o.geometry) return; let vis=true; for(let a=o;a;a=a.parent) if(!a.visible) vis=false; if(!vis) return;
        if(o.material && o.material.visible===false) return;
        const pos=o.geometry.attributes.position; const v=new (B.group.position.constructor)();
        const stride=Math.max(1,Math.floor(pos.count/400));
        for(let i=0;i<pos.count;i+=stride){ v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld); checked++;
          slabs.forEach((s,si)=>{ const l=v.clone().applyMatrix4(s.m); const tol=0.004;
            if(l.x>s.x0+tol&&l.x<s.x1-tol&&l.y>s.y0+tol&&l.y<s.y1-tol&&Math.abs(l.z)<s.z-tol){ const depth=Math.min(l.y-s.y0,s.y1-l.y); worst.push({p:q,face:f.name,sheet:si,depth:+depth.toFixed(4),obj:o.name||o.geometry.type}); } });
        } });
    }
  }
  worst.sort((a,b)=>b.depth-a.depth);
  return {checked, n:worst.length, top:worst.slice(0,25), byFace:Object.entries(worst.reduce((a,w)=>{const k=w.face+'@'+w.sheet;a[k]=(a[k]||0)+1;return a;},{}))};
  function BH_(){}
});
console.log(JSON.stringify(res,null,1)); console.log('errors',errs); await b.close();

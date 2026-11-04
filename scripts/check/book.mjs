// Sweeps every page turn and measures the book as a physical object; prints the numbers and fails on any that breaks a rule of a real book.
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage(); await p.setViewport({width:800,height:500});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>['error','warn','warning'].includes(m.type())&&errs.push(m.text().slice(0,200)));
await p.goto(''+(process.env.URL||"http://localhost:5181/aif-book/")+'?freeze=1&p=0',{waitUntil:'networkidle0'}); await p.waitForFunction(()=>document.body.classList.contains('ready'),{timeout:90000});
const r=await p.evaluate(()=>{
  const B=__book.book, S=B.sheets, N=S.length, BT=0.2, W=S[0].yR, V=B.group.position.constructor, dp=0.0025;
  const out={strip:[1e9,0], desk:0, spineInBlock:0, thickness:[1e9,0], gutterStep:0, poseJump:0, angleJump:0, phiReversals:0, phiStep:0, backGap:0};
  const at=(s,x,y)=>{const c=Math.cos(s.theta),n=Math.sin(s.theta),q=s.pivot.position;return [q.x+x*c-y*n,q.y+x*n+y*c];};
  let prev=null; const phi={}, fold=f=>Math.PI/2-Math.abs(f.pieces[0].fold.rotation.x);
  for(let i=0;i<=N/dp;i++){ const q=+(i*dp).toFixed(4); B.set(q,0); B.group.updateMatrixWorld(true);
    const F=S[0].pivot.position,K=S[N-1].pivot.position,l=Math.hypot(F.x-K.x,F.y-K.y); out.strip=[Math.min(out.strip[0],l),Math.max(out.strip[1],l)];
    // the case rests on the desk: nothing of it or the block goes below the boards' outer faces lying flat
    for(const s of S) for(const x of [0,s.isBoard?14.3:14.07]) for(const y of [s.top,s.bot]) out.desk=Math.min(out.desk,at(s,x,y)[1]+BT);
    const P=B.spine.geometry.attributes.position; for(let v=0;v<P.count;v++) out.desk=Math.min(out.desk,P.getY(v)+BT);
    // the spine stays outside the block: no spine vertex inside a page
    for(const s of S){ if(s.isBoard) continue; const c=Math.cos(s.theta),n=Math.sin(s.theta),o=s.pivot.position; for(let v=0;v<P.count;v+=2){ const dx=P.getX(v)-o.x,dy=P.getY(v)-o.y,lx=dx*c+dy*n,ly=-dx*n+dy*c; if(lx>0.07&&lx<14.07&&ly>s.bot&&ly<s.top) out.spineInBlock=Math.max(out.spineInBlock,Math.min(ly-s.bot,s.top-ly,lx-0.07)); } }
    // the block's back ends on the boards' hinges, so nothing separates the block from the case
    const Q=B.back.geometry.attributes.position; out.backGap=Math.max(out.backGap,Math.hypot(Q.getX(0)-F.x,Q.getY(0)-F.y),Math.hypot(Q.getX(N-1)-K.x,Q.getY(N-1)-K.y));
    // a page is the same thickness everywhere, always: its two faces measured in the world, and no scale on the sheet
    for(const s of S){ if(s.isBoard) continue; const a=new V(5,s.top,0).applyMatrix4(s.pivot.matrixWorld),c=new V(5,s.bot,0).applyMatrix4(s.pivot.matrixWorld),t=a.distanceTo(c); out.thickness=[Math.min(out.thickness[0],t),Math.max(out.thickness[1],t)]; }
    // an open spread: the two page surfaces meet at the gutter, with no step for a shadow to fall from
    if(Math.abs(q-Math.round(q))<1e-6&&q>=1&&q<=N-1){ const k=Math.round(q),L=S[k-1],R=S[k],y0=(s,y)=>{const a=at(s,0,y),u=[Math.cos(s.theta),Math.sin(s.theta)];return a[1]-a[0]/u[0]*u[1];}; out.gutterStep=Math.max(out.gutterStep,Math.abs(y0(L,L.bot)-y0(R,R.top))); }
    // nothing jumps: every sheet moves and turns continuously
    const now=S.map(s=>[s.pivot.position.x,s.pivot.position.y,s.theta]); if(prev) now.forEach((a,j)=>{out.poseJump=Math.max(out.poseJump,Math.hypot(a[0]-prev[j][0],a[1]-prev[j][1])); out.angleJump=Math.max(out.angleJump,Math.abs(a[2]-prev[j][2]));}); prev=now;
    // a pop-up rises only while its spread opens and falls only while it shuts, a little at a time
    for(const f of B.faces){ const v=f.root.visible?fold(f):0,k=f.spread,last=phi[f.name]; phi[f.name]=v; if(last===undefined) continue; const d=v-last; out.phiStep=Math.max(out.phiStep,Math.abs(d)); if(q>k-1&&q<=k&&d<-1e-6) out.phiReversals++; if(q>k&&q<=k+1&&d>1e-6) out.phiReversals++; }
  }
  return out;
});
const fails=[]; const need=(c,m)=>{ if(!c) fails.push(m); };
need(r.strip[1]-r.strip[0]<0.05,'the strip changes length'); need(r.desk>-0.005,'something goes through the desk'); need(r.spineInBlock===0,'the spine enters the block');
need(r.thickness[1]-r.thickness[0]<1e-4,'a page changes thickness'); need(r.gutterStep<0.02,'a step at the gutter'); need(r.backGap<1e-4,'the block leaves the case');
need(r.poseJump<0.05,'a sheet jumps'); need(r.angleJump<0.05,'a sheet snaps round'); need(r.phiReversals===0,'a pop-up reverses'); need(r.phiStep<0.1,'a pop-up snaps');
console.log(JSON.stringify(r,null,1)); console.log('errors',errs); console.log(fails.length?'FAIL: '+fails.join('; '):'PASS'); await b.close(); process.exit(fails.length||errs.length?1:0);

// Drives the book with the app's own page spring at 60 fps and follows every leaf's fore-edge, because a still frame cannot show how the block's slope arrives.
// Each leaf's shift is taken against the board it rests on. The slope must grow with the opening from the first movement, every leaf together, with no threshold in it.
// usage: URL=http://localhost:5185/aif-book/ node scripts/check/motion.mjs [curves.json]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage(); await p.setViewport({width:800,height:500});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.env.URL||'http://localhost:5181/aif-book/')+'?freeze=1&shot=1&dpr=1&t=2&p=0',{waitUntil:'networkidle0'}); await p.waitForFunction(()=>document.body.classList.contains('ready'),{timeout:90000});
const r=await p.evaluate(()=>{
  const B=__book.book, S=B.sheets, N=S.length, REACH=14.07, leaves=S.filter(s=>!s.isBoard).map(s=>s.i);
  const pose=q=>{ B.caseAt=q; B.set(q,0); };
  const board=q=>q<N/2?S[N-1].pivot.position.x:S[0].pivot.position.x+B.D; // the board that lies still, wherever the book's centre has gone
  const shift=(s,q)=>s.pivot.position.x-board(q);
  // the app's spring, line for line
  const run=(from,to)=>{ const w=6.2, dt=1/60, turning=Math.min(from,to), f=[]; let q=from, pv=0;
    for(let i=0;i<600;i++){ const k=+q.toFixed(5); pose(k); const c=B.centerX();
      f.push({t:i*dt,p:k,e:S[turning].e,x:S.map(s=>s.pivot.position.x+REACH*Math.cos(s.theta)-c),d:S.map(s=>shift(s,k))});
      if(k===to&&i>0) break;
      pv+=(w*w*(to-q)-2*w*pv)*dt; pv=Math.max(-5,Math.min(5,pv)); q+=pv*dt; if(Math.abs(to-q)<1e-4&&Math.abs(pv)<1e-3){ q=to; pv=0; } }
    return {from,to,turning,frames:f}; };
  const judge=m=>{ const f=m.frames, rest=leaves.filter(i=>i!==m.turning), e0=f[0].e, e1=f[f.length-1].e, o=f.map(a=>(a.e-e0)/(e1-e0)), moved=rest.filter(i=>Math.abs(f[f.length-1].d[i]-f[0].d[i])>0.05);
    let lag=0,lagAt=-1,apart=0,back=0; const end=f[f.length-1].d;
    for(let t=0;t<f.length;t++){ const off=moved.map(i=>f[t].d[i]-f[0].d[i]-o[t]*(end[i]-f[0].d[i])); if(!off.length) continue; const worst=Math.max(...off.map(Math.abs)); if(worst>lag){ lag=worst; lagAt=f[t].p; } const v=moved.filter(i=>Math.abs(end[i]-f[0].d[i])>0.25).map(i=>(f[t].d[i]-f[0].d[i])/(end[i]-f[0].d[i])); if(!v.length) continue; apart=Math.max(apart,Math.max(...v)-Math.min(...v)); }
    for(const i of rest){ const a=f[0].d[i], z=f[f.length-1].d[i], lo=Math.min(a,z), hi=Math.max(a,z); for(const g of f) back=Math.max(back,lo-g.d[i],g.d[i]-hi); }
    let step=0; for(const i of rest) for(let t=1;t<f.length;t++) step=Math.max(step,Math.abs(f[t].d[i]-f[t-1].d[i]));
    return {name:`${m.from}>${m.to}`,frames:f.length,moved:moved.length,lag,lagAt,apart,back,step}; };
  const moves=[[0,1],[1,0],[8,7],[7,8]]; for(let k=1;k<7;k++) moves.push([k,k+1],[k+1,k]);
  const runs=moves.map(([a,c])=>run(a,c)), table=runs.map(judge);
  // the same shifts against p itself, so a threshold shows wherever the spring happens to carry it: a kink is a jump in speed, a step a jump in acceleration
  const dp=1/2048, n=N/dp, d=leaves.map(()=>new Float64Array(n+1)), turn=new Uint8Array(n+1); for(let i=0;i<=n;i++){ const q=i*dp; pose(q); leaves.forEach((k,j)=>d[j][i]=shift(S[k],q)); }
  let kink=0,kinkAt=-1,kinkOf=-1,step=0,stepAt=-1,stepOf=-1; const spots=[];
  d.forEach((a,j)=>{ const k=leaves[j]; for(let i=2;i<n-1;i++){ const q=i*dp; if(q>k-2*dp&&q<k+1+2*dp) continue; // its own turn is a swing, judged as a swing
    const v=Math.abs(a[i+1]-2*a[i]+a[i-1])/dp, s=Math.abs(a[i+2]-3*a[i+1]+3*a[i]-a[i-1])/dp/dp; if(v>kink){ kink=v; kinkAt=q; kinkOf=k; } if(s>step){ step=s; stepAt=q; stepOf=k; } if(s>8) spots.push([+q.toFixed(3),k,+s.toFixed(1)]); } });
  return {table,kink,kinkAt,kinkOf,step,stepAt,stepOf,spots,runs:runs.filter(m=>['0>1','1>0','3>4','7>8'].includes(`${m.from}>${m.to}`))};
});
const {runs,spots,...out}=r; const worst=k=>Math.max(...r.table.map(a=>a[k]));
if(process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify({runs,spots,table:r.table,kink:r.kink,kinkAt:r.kinkAt,step:r.step,stepAt:r.stepAt}));
console.log(r.table.map(a=>`${a.name}\tframes ${a.frames}\tmoved ${a.moved}\tlag ${a.lag.toFixed(3)} cm at ${a.lagAt}\tapart ${a.apart.toFixed(3)}\tback ${a.back.toFixed(4)}\tstep ${a.step.toFixed(4)}`).join('\n'));
console.log(JSON.stringify({kink:out.kink,kinkAt:out.kinkAt,kinkOf:out.kinkOf,step:out.step,stepAt:out.stepAt,stepOf:out.stepOf}));
const fails=[]; const need=(c,m)=>{ if(!c) fails.push(m); };
need(worst('lag')<0.05,'the slope does not grow with the opening'); need(worst('apart')<0.05,'the leaves do not move together'); need(worst('back')<0.025,'a leaf goes past where it ends and comes back');
need(r.kink<0.5,'a leaf changes speed at a threshold'); need(r.step<8,'a leaf changes acceleration at a threshold');
console.log('errors',errs); console.log(fails.length?'FAIL: '+fails.join('; '):'PASS'); await b.close(); process.exit(fails.length||errs.length?1:0);

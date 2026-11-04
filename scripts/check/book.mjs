// Sweeps every page turn and measures the book as a physical object; prints the numbers and fails on any that breaks a rule of a real book.
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage(); await p.setViewport({width:800,height:500});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>['error','warn','warning'].includes(m.type())&&errs.push(m.text().slice(0,200)));
await p.goto(''+(process.env.URL||"http://localhost:5181/aif-book/")+'?freeze=1&shot=1&dpr=1&t=2&p=0',{waitUntil:'networkidle0'}); await p.waitForFunction(()=>document.body.classList.contains('ready'),{timeout:90000});
const r=await p.evaluate(()=>{
  const B=__book.book, S=B.sheets, N=S.length, BT=0.2, W=S[0].yR, V=B.group.position.constructor, dp=0.0025;
  const out={strip:[1e9,0], desk:0, spineInBlock:0, thickness:[1e9,0], fillOnTurningPage:0, fillJump:0, poseJump:0, spineJump:0, spineCross:0, spineOpen:0, spineInBoard:0, pocket:0, pocketAt:-1, leafCross:0, clothOffDesk:1e9, clothOffDeskAt:-1, edgeSeam:0, boardLift:0, gutterRun:0, angleJump:0, phiReversals:0, phiStep:0};
  const at=(s,x,y)=>{const c=Math.cos(s.theta),n=Math.sin(s.theta),q=s.pivot.position;return [q.x+x*c-y*n,q.y+x*n+y*c];};
  // the gaps the eye sees: end-on, the book's section and the desk drawn solid; any air they shut in is a gap, however it is lit
  const C=0.02, X0=-20, Y0=-0.26, GW=2000, GH=150, grid=new Uint8Array(GW*GH);
  const tri=(a,b,c)=>{ const lo=Math.floor((Math.min(a[1],b[1],c[1])-Y0)/C), hi=Math.ceil((Math.max(a[1],b[1],c[1])-Y0)/C); for(let r=Math.max(0,lo);r<=Math.min(GH-1,hi);r++){ const y=Y0+(r+.5)*C; let x0=1e9,x1=-1e9; for(const [p,q] of [[a,b],[b,c],[c,a]]){ if((p[1]-y)*(q[1]-y)>0) continue; if(p[1]===q[1]){ x0=Math.min(x0,p[0],q[0]); x1=Math.max(x1,p[0],q[0]); continue; } const x=p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1]); x0=Math.min(x0,x); x1=Math.max(x1,x); } if(x1<x0) continue; for(let k=Math.max(0,Math.floor((x0-X0)/C));k<=Math.min(GW-1,Math.floor((x1-X0)/C));k++) grid[r*GW+k]=1; } };
  const line=(a,b)=>{ const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/C*2)+1; for(let i=0;i<=n;i++){ const x=a[0]+(b[0]-a[0])*i/n,y=a[1]+(b[1]-a[1])*i/n,k=Math.floor((x-X0)/C),r=Math.floor((y-Y0)/C); if(k>=0&&k<GW&&r>=0&&r<GH) grid[r*GW+k]=1; } };
  const quad=(s,x0,x1,y0,y1)=>{ const p=[at(s,x0,y0),at(s,x1,y0),at(s,x1,y1),at(s,x0,y1)]; tri(p[0],p[1],p[2]); tri(p[0],p[2],p[3]); };
  const mesh=m=>{ const P=m.geometry.attributes.position,I=m.geometry.index.array,v=i=>[P.getX(i),P.getY(i)]; for(let t=0;t<I.length;t+=3){ const a=v(I[t]),b=v(I[t+1]),c=v(I[t+2]); tri(a,b,c); line(a,b); line(b,c); line(c,a); } };
  const pockets=()=>{ grid.fill(0); for(let r=0;r<GH&&Y0+(r+1)*C<=-BT+0.001;r++) grid.fill(1,r*GW,(r+1)*GW);
    for(const s of S) quad(s,s.isBoard?0:0.07,s.isBoard?14.3:14.07,s.bot,s.top);
    for(const f of B.fillers){ if(!f.m.visible) continue; const s=S.find(t=>t.pivot===f.m.parent),e=f.m.matrix.elements,v=(x,y)=>at(s,e[0]*x+e[4]*y+e[12],e[5]*y+e[13]),a=v(-7,-f.g/2),b=v(7,-f.g/2),c=v(7,f.g/2),d=v(-7,f.g/2); tri(a,b,c); tri(a,c,d); }
    mesh(B.spine); mesh(B.back);
    const st=[]; for(let k=0;k<GW;k++) if(!grid[(GH-1)*GW+k]){ grid[(GH-1)*GW+k]=2; st.push((GH-1)*GW+k); } for(let r=0;r<GH;r++) for(const k of [0,GW-1]) if(!grid[r*GW+k]){ grid[r*GW+k]=2; st.push(r*GW+k); }
    while(st.length){ const i=st.pop(),k=i%GW; for(const j of [k>0?i-1:-1,k<GW-1?i+1:-1,i-GW,i+GW]) if(j>=0&&j<grid.length&&!grid[j]){ grid[j]=2; st.push(j); } }
    let n=0; for(let i=0;i<grid.length;i++) if(!grid[i]) n++; return n*C*C; };
  let prev=null, prevSpine=null; const phi={}, fold=f=>Math.PI/2-Math.abs(f.pieces[0].fold.rotation.x);
  for(let i=0;i<=N/dp;i++){ const q=+(i*dp).toFixed(4); B.set(q,0); B.group.updateMatrixWorld(true);
    const F=S[0].pivot.position,K=S[N-1].pivot.position, sp=B.spine.geometry.attributes.position; let l=0; for(let v=B.jointSeg;v<B.spineSeg-B.jointSeg;v++) l+=Math.hypot(sp.getX(v*2+2)-sp.getX(v*2),sp.getY(v*2+2)-sp.getY(v*2)); out.strip=[Math.min(out.strip[0],l),Math.max(out.strip[1],l)]; // along the strip itself, without its joints
    // the case rests on the desk: nothing of it or the block goes below the boards' outer faces lying flat
    for(const s of S) for(const x of [0,s.isBoard?14.3:14.07]) for(const y of [s.top,s.bot]) out.desk=Math.min(out.desk,at(s,x,y)[1]+BT);
    const P=B.spine.geometry.attributes.position; for(let v=0;v<P.count;v++) out.desk=Math.min(out.desk,P.getY(v)+BT);
    // the spine stays outside the block: no spine vertex inside a page
    for(const s of S){ if(s.isBoard) continue; const c=Math.cos(s.theta),n=Math.sin(s.theta),o=s.pivot.position; for(let v=0;v<P.count;v+=2){ const dx=P.getX(v)-o.x,dy=P.getY(v)-o.y,lx=dx*c+dy*n,ly=-dx*n+dy*c; if(lx>0.07&&lx<14.07&&ly>s.bot&&ly<s.top) out.spineInBlock=Math.max(out.spineInBlock,Math.min(ly-s.bot,s.top-ly,lx-0.07)); } }
    // nor a board: a board's cloth lies on its face and goes no deeper
    for(const s of [S[0],S[N-1]]){ const c=Math.cos(s.theta),n=Math.sin(s.theta),o=s.pivot.position; for(let v=0;v<P.count;v+=2){ const dx=P.getX(v)-o.x,dy=P.getY(v)-o.y,lx=dx*c+dy*n,ly=-dx*n+dy*c; if(lx>0&&lx<14.3&&ly>s.bot&&ly<s.top) out.spineInBoard=Math.max(out.spineInBoard,Math.min(ly-s.bot,s.top-ly,lx)); } }
    // a page is the same thickness everywhere, always: its two faces measured in the world, and no scale on the sheet
    for(const s of S){ if(s.isBoard) continue; const a=new V(5,s.top,0).applyMatrix4(s.pivot.matrixWorld),c=new V(5,s.bot,0).applyMatrix4(s.pivot.matrixWorld),t=a.distanceTo(c); out.thickness=[Math.min(out.thickness[0],t),Math.max(out.thickness[1],t)]; }
    // what is seen at a page's edge must not grow or shrink with it either: the folded card between the leaves stays on a page at rest and changes gradually
    for(const f of B.fillers){ const h=f.m.visible?f.m.scale.y*(f.g??B.gaps[f.k]):0; if(f.h!==undefined) out.fillJump=Math.max(out.fillJump,Math.abs(h-f.h)); f.h=h; const host=S.find(s=>s.pivot===f.m.parent); if(h>0&&host.t>0&&host.t<1) out.fillOnTurningPage++; }
    // seen from above an open spread is two pages and the fold between them, with no wide strip of anything else
    if(Math.abs(q-Math.round(q))<1e-6&&q>=1&&q<=N-1){ const k=Math.round(q),L=S[k-1],R=S[k]; out.gutterRun=Math.max(out.gutterRun,Math.abs(at(L,L.isBoard?0:0.07,0)[0]-at(R,R.isBoard?0:0.07,0)[0])); }
    { const P=B.back.geometry.attributes.position, F=B.rootFan, M=(N-1)*B.rootSeg; let fold=0; for(let j=0;j<M;j++) for(let c=0;c<F;c++){ const a=B.rootCap(0,j,c), d=a+F+1, u=[P.getX(d)-P.getX(a),P.getY(d)-P.getY(a)], w=[P.getX(a+1)-P.getX(a),P.getY(a+1)-P.getY(a)]; fold+=Math.max(0,u[1]*w[0]-u[0]*w[1]); } out.leafCross=Math.max(out.leafCross,fold); } // cm² of the block's ends where leaves pass through each other: they may fan, not cross
    { const P=B.spine.geometry.attributes.position, n=B.spineSeg, ring=2*(n+1); for(let k=1;k<n;k++){ const h=P.getY((ring-1-k)*2)+BT; if(h<out.clothOffDesk){ out.clothOffDesk=h; out.clothOffDeskAt=q; } } } // the cloth's inside, lying on the desk: level with it, the two fight for the same pixels and the desk flickers through the joint
    if(i%8===0){ const a=pockets(); if(a>out.pocket){ out.pocket=a; out.pocketAt=q; } }
    // open, both boards lie on the desk: no ramp, nothing floating
    if(q>=1&&q<=N-1) for(const s of [S[0],S[N-1]]) for(const x of [0,14.3]) out.boardLift=Math.max(out.boardLift,at(s,x,s===S[0]?s.top:s.bot)[1]+BT);
    // nothing jumps: every sheet moves and turns continuously
    const now=S.map(s=>[s.pivot.position.x,s.pivot.position.y,s.theta]); if(prev) now.forEach((a,j)=>{out.poseJump=Math.max(out.poseJump,Math.hypot(a[0]-prev[j][0],a[1]-prev[j][1])); out.angleJump=Math.max(out.angleJump,Math.abs(a[2]-prev[j][2]));}); prev=now;
    // nor does any part of the spine, cloth or lining
    const sv=Array.from(P.array); if(prevSpine) for(let v=0;v<sv.length;v+=3) out.spineJump=Math.max(out.spineJump,Math.hypot(sv[v]-prevSpine[v],sv[v+1]-prevSpine[v+1])); prevSpine=sv;
    // the spine's section never passes through itself: no edge of the loop of cloth and lining crosses another
    { const R=P.count/2, X=j=>[P.getX(j*2),P.getY(j*2)]; for(let a=0;a<R;a++) for(let c=a+2;c<R;c++){ if(a===0&&c===R-1) continue; const A=X(a),A2=X(a+1),D=X(c),D2=X((c+1)%R),u=[A2[0]-A[0],A2[1]-A[1]],w=[D2[0]-D[0],D2[1]-D[1]],det=u[0]*w[1]-u[1]*w[0]; if(Math.abs(det)<1e-9) continue; const t=((D[0]-A[0])*w[1]-(D[1]-A[1])*w[0])/det,e=((D[0]-A[0])*u[1]-(D[1]-A[1])*u[0])/det; if(t>1e-6&&t<1-1e-6&&e>1e-6&&e<1-1e-6) out.spineCross++; } }
    // and it is closed at head and tail: welded by position, every edge has a face on both sides
    if(q%1===0){ const I=B.spine.geometry.index.array,key=v=>[P.getX(v),P.getY(v),P.getZ(v)].map(x=>x.toFixed(5)).join(),e={}; for(let t=0;t<I.length;t+=3){ const k=[I[t],I[t+1],I[t+2]].map(key); if(new Set(k).size<3) continue; for(let j=0;j<3;j++){ const m=[k[j],k[(j+1)%3]].sort().join('|'); e[m]=(e[m]||0)+1; } } out.spineOpen+=Object.values(e).filter(c=>c===1).length; }
    // a pop-up rises only while its spread opens and falls only while it shuts, a little at a time
    for(const f of B.faces){ const v=f.root.visible?fold(f):0,k=f.spread,last=phi[f.name]; phi[f.name]=v; if(last===undefined) continue; const d=v-last; out.phiStep=Math.max(out.phiStep,Math.abs(d)); if(q>k-1&&q<=k&&d<-1e-6) out.phiReversals++; if(q>k&&q<=k+1&&d>1e-6) out.phiReversals++; }
  }
  // a paper line runs unbroken from the block's side into its bend: where the end of the block meets a sheet, both must be at the same point of the line pattern
  for(const q of [0,1,2,3,4,5,6,7,8]){ B.set(q,0); const U=B.back.geometry.attributes.uv; for(let i=1;i<N-1;i++){ const s=S[i], g=s.edge.geometry.attributes.uv; let lo=1e9,hi=-1e9; for(let v=0;v<g.count;v++){ lo=Math.min(lo,g.getY(v)); hi=Math.max(hi,g.getY(v)); } const want=s.e>0.5?lo:hi; out.edgeSeam=Math.max(out.edgeSeam,Math.abs(U.getY(B.rootCap(0,i*B.rootSeg,B.rootFan))-want)); } }
  return out;
});
// the owner's top view: what lies between the two surfaces of a first or last spread must render as paper, not as a dark strip. Measured in the rendered frame
r.gutterTone=await p.evaluate(async()=>{ const B=__book, cam=B.cam, V=cam.position.constructor, gl=B.renderer.getContext(), S=B.book.sheets, tick=()=>new Promise(k=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(k)))); let worst=1e9;
  B.rig.L.box.min.set(-1e3,-1e3,-1e3); B.rig.L.box.max.set(1e3,1e3,1e3); B.rig.L.rMin=1; B.rig.L.phiMin=0.001; B.rig.L.thetaMin=-7; B.rig.L.thetaMax=7;
  for(const [q,leaf,board] of [[1,S[1],S[0]],[7,S[6],S[7]]]){ B.set(q); B.rig.lookFrom(new V(-1.584,56.06,5.025),new V(-2.082,-1.124,1.352)); B.room.freeze=true; B.renderer.shadowMap.needsUpdate=true; await tick(); await tick();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px); const g=B.book.group.position.x;
    const lum=x=>{ const v=new V(x,2,0).project(cam),i=Math.round((v.x+1)/2*w),j=Math.round((v.y+1)/2*h),o=(j*w+i)*4; return .3*px[o]+.59*px[o+1]+.11*px[o+2]; }, med=a=>a.slice().sort((p,q)=>p-q)[a.length>>1];
    const a=leaf.pivot.position.x+g+(q===1?0.07:-0.07), b=board.pivot.position.x+g, inner=[...Array(9)].map((_,i)=>lum(a+(b-a)*(.2+.6*i/8))), page=[...Array(9)].map((_,i)=>lum(a+(a-b)/Math.abs(a-b)*(2+i/4)));
    worst=Math.min(worst,med(inner)/med(page)); }
  return worst; });
const fails=[]; const need=(c,m)=>{ if(!c) fails.push(m); };
need(r.strip[1]-r.strip[0]<0.02,'the strip changes length'); need(r.desk>-0.005,'something goes through the desk'); need(r.spineInBlock===0,'the spine enters the block');
need(r.thickness[1]-r.thickness[0]<1e-4&&r.fillOnTurningPage===0&&r.fillJump<0.05,'a page changes thickness'); need(r.pocket<0.01,'a gap between pages, spine and boards'); need(r.boardLift<0.005,'a board is off the desk'); need(r.gutterRun<0.95&&r.gutterTone>0.5,'a wide dark strip at the gutter');
need(r.poseJump<0.05,'a sheet jumps'); need(r.spineJump<0.05,'the spine jumps'); need(r.spineCross===0,'the spine passes through itself'); need(r.spineOpen===0,'the spine is open at its head or tail'); need(r.clothOffDesk>0.005,'the inside of the cloth lies in the plane of the desk, which flickers through the joint'); need(r.edgeSeam<0.002,'the paper lines break where the block\'s end meets a sheet'); need(r.leafCross<0.02,'leaves in the block pass through each other'); need(r.spineInBoard<0.005,'the spine enters a board'); need(r.angleJump<0.05,'a sheet snaps round'); need(r.phiReversals===0,'a pop-up reverses'); need(r.phiStep<0.1,'a pop-up snaps');
console.log(JSON.stringify(r,null,1)); console.log('errors',errs); console.log(fails.length?'FAIL: '+fails.join('; '):'PASS'); await b.close(); process.exit(fails.length||errs.length?1:0);

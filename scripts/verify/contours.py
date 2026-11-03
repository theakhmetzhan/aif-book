import math, json
P=json.load(open('hills.json'))['peaks']
def f(x,v): return sum(a*math.exp(-((x-px)**2+(v-pv)**2)/(2*s*s)) for px,pv,s,a in P)
X0,X1,V0,V1,R=1.0,13.0,3.2,17.2,0.05
nx,nv=int((X1-X0)/R)+1,int((V1-V0)/R)+1
G=[[f(X0+i*R,V0+j*R) for i in range(nx)] for j in range(nv)]
def loops(L):
    segs=[]
    def P_(i,j,a,b):
        # interpolate along edge between grid pts a,b
        (i1,j1),(i2,j2)=a,b; v1,v2=G[j1][i1],G[j2][i2]; t=(L-v1)/(v2-v1)
        return (round(X0+(i1+(i2-i1)*t)*R,4), round(V0+(j1+(j2-j1)*t)*R,4))
    for j in range(nv-1):
        for i in range(nx-1):
            c=[(i,j),(i+1,j),(i+1,j+1),(i,j+1)]
            idx=sum((G[q][p]>=L)<<k for k,(p,q) in enumerate(c))
            if idx in (0,15): continue
            e=[(c[0],c[1]),(c[1],c[2]),(c[2],c[3]),(c[3],c[0])]
            cut=[k for k,(a,b) in enumerate(e) if (G[a[1]][a[0]]>=L)!=(G[b[1]][b[0]]>=L)]
            pts=[P_(i,j,*e[k]) for k in cut]
            if len(pts)==2: segs.append(tuple(pts))
            else:  # saddle: pair by center value
                cen=(sum(G[q][p] for p,q in c)/4)>=L
                if (idx in (5,) )^cen: segs+= [(pts[0],pts[1]),(pts[2],pts[3])]
                else: segs+= [(pts[0],pts[3]),(pts[1],pts[2])]
    # stitch
    from collections import defaultdict
    nb=defaultdict(list)
    for a,b in segs: nb[a].append(b); nb[b].append(a)
    seen=set(); out=[]
    for s in list(nb):
        if s in seen: continue
        loop=[s]; seen.add(s); prev=None; cur=s
        while True:
            nxt=[p for p in nb[cur] if p!=prev and p not in seen]
            if not nxt: break
            prev,cur=cur,nxt[0]; seen.add(cur); loop.append(cur)
        if len(loop)>8: out.append(loop)
    return out
def simplify(pl,eps=0.015):
    if len(pl)<3: return pl
    a,b=pl[0],pl[-1]; dmax,ix=0,0
    for k in range(1,len(pl)-1):
        p=pl[k]; dx,dy=b[0]-a[0],b[1]-a[1]; n=math.hypot(dx,dy) or 1
        d=abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/n
        if d>dmax: dmax,ix=d,k
    if dmax>eps: return simplify(pl[:ix+1],eps)[:-1]+simplify(pl[ix:],eps)
    return [a,b]
levels=[]
for L in range(2,11):
    ls=[(lambda l,m:(simplify(l[:m+1])[:-1]+simplify(l[m:]+[l[0]])[:-1]))(l,len(l)//2) for l in loops(L)]
    levels.append({'level':L,'loops':ls})
    print(L,[len(l) for l in ls])
json.dump(levels,open('contours.json','w'))

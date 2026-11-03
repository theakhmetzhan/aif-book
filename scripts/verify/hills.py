import math, json
P=[(9.0,8.6,1.9,9.0),(4.4,13.0,1.5,5.6),(6.8,11.0,3.4,2.0)]
def f(x,v): return sum(a*math.exp(-((x-px)**2+(v-pv)**2)/(2*s*s)) for px,pv,s,a in P)
STEP=0.3
D=[(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]
def climb(x,v):
    path=[(x,v)]
    while True:
        best=max(((x+dx*STEP,v+dv*STEP) for dx,dv in D),key=lambda p:f(*p))
        if f(*best)<=f(x,v): return path
        x,v=best; path.append((round(x,3),round(v,3)))
out={}
for name,st in [('local',(2.0,15.2)),('global',(11.6,13.0))]:
    p=climb(*st); out[name]={'path':p,'top':round(f(*p[-1]),2),'steps':len(p)-1}
    print(name,'steps',len(p)-1,'end',p[-1],'height',round(f(*p[-1]),2))
# boundary check: figure frame x 1.2..12.8, v 3.4..17.0
mx=max(f(x/10,v/10) for x in range(12,129) for v in (34,170))
my=max(f(x/10,v/10) for v in range(34,171) for x in (12,128))
print('max on frame', round(max(mx,my),3), 'peak',round(f(9.0,8.6),2), round(f(4.4,13.0),2))
json.dump({'peaks':P,'step':STEP,**out},open('hills.json','w'),indent=1)

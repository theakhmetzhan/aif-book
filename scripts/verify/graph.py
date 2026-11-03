import math, heapq, json
from collections import deque
N={'S':(2.2,11.6),'A':(3.9,7.4),'B':(4.6,13.8),'C':(6.6,10.0),'D':(6.4,5.2),'E':(9.4,12.6),'F':(9.2,8.2),'H':(9.6,3.6),'G':(12.0,6.2)}
E=[('S','A',5),('S','B',4),('S','C',6),('A','D',4),('B','C',5),('B','E',6),('C','F',4),('C','D',6),('D','H',6),('E','F',5),('F','G',4),('H','G',4),('E','G',8)]
d=lambda a,b: math.dist(N[a],N[b])
for a,b,c in E: assert c>=d(a,b), (a,b,c,d(a,b))
h={n:round(d(n,'G'),1) for n in N}
adj={n:[] for n in N}
for a,b,c in E: adj[a].append((b,c)); adj[b].append((a,c))
for n in adj: adj[n].sort()
# consistency
for a,b,c in E: assert h[a]<=c+h[b]+1e-9 and h[b]<=c+h[a]+1e-9
def bfs():
    fr=deque(['S']); par={'S':None}; order=[]
    while fr:
        u=fr.popleft(); order.append(u)
        if u=='G': break
        for v,_ in adj[u]:
            if v not in par: par[v]=u; fr.append(v)
    p=[];u='G'
    while u: p.append(u); u=par[u]
    return order,p[::-1]
def best(useh):
    fr=[(h['S'] if useh else 0,0,'S',None)]; done={}; order=[]
    while fr:
        f,g,u,pa=heapq.heappop(fr)
        if u in done: continue
        done[u]=(g,pa); order.append((u,g,round(f,1)))
        if u=='G': break
        for v,c in adj[u]:
            if v not in done: heapq.heappush(fr,(g+c+(h[v] if useh else 0),g+c,v,u))
    p=[];u='G'
    while u: p.append(u); u=done[u][1]
    return order,p[::-1],done['G'][0]
cost=lambda p: sum(next(c for a,b,c in E if {a,b}=={x,y}) for x,y in zip(p,p[1:]))
bo,bp=bfs(); uo,up,uc=best(False); ao,ap,ac=best(True)
print('h',h)
print('BFS expanded',len(bo),bo,'path',bp,'cost',cost(bp))
print('UCS expanded',len(uo),[o[0] for o in uo],'path',up,'cost',uc)
print('A* expanded',len(ao),ao,'path',ap,'cost',ac)
json.dump({'nodes':N,'edges':E,'h':h,'bfs':{'order':bo,'path':bp,'cost':cost(bp)},'ucs':{'order':[o[0] for o in uo],'path':up,'cost':uc},'astar':{'order':ao,'path':ap,'cost':ac}},open('graph.json','w'),indent=1)
# frontier at termination of A*
import itertools
fr=[(h['S'],0,'S',None)]; done={}; gen={'S':(0,None)}
while fr:
    f,g,u,pa=heapq.heappop(fr)
    if u in done: continue
    done[u]=g
    if u=='G': break
    for v,c in adj[u]:
        if v not in done:
            if v not in gen or g+c<gen[v][0]: gen[v]=(g+c,u)
            heapq.heappush(fr,(g+c+h[v],g+c,v,u))
front={n:(gen[n][0],round(gen[n][0]+h[n],1)) for n in gen if n not in done}
print('frontier',front,'never generated',[n for n in N if n not in gen])

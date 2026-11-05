# Case VII: a two-state hidden Markov model: filtering, prediction, smoothing, Viterbi, each checked against brute-force enumeration.
import json, os, itertools
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'hmm.json')
S = ['Active', 'Quiet']; PI = [0.3, 0.7]; T = [[0.7, 0.3], [0.2, 0.8]]; E = {'Lit': [0.8, 0.1], 'Dark': [0.2, 0.9]}
OBS = ['Lit', 'Lit', 'Dark', 'Lit']; n = len(OBS)
norm = lambda v: [x / sum(v) for x in v]
pred = lambda b: [sum(b[i] * T[i][j] for i in range(2)) for j in range(2)]
f = []; predicted = []
b = PI[:]
for t, o in enumerate(OBS):
    if t: b = pred(b)
    predicted.append(b[:]); b = norm([b[j] * E[o][j] for j in range(2)]); f.append(b[:])
nxt = pred(f[-1])
back = [[1, 1] for _ in OBS]
for t in range(n - 2, -1, -1):
    back[t] = [sum(T[i][j] * E[OBS[t + 1]][j] * back[t + 1][j] for j in range(2)) for i in range(2)]
sm = [norm([f[t][i] * back[t][i] for i in range(2)]) for t in range(n)]
d = [[PI[j] * E[OBS[0]][j] for j in range(2)]]; ptr = []
for t in range(1, n):
    row, p = [], []
    for j in range(2):
        c = [d[-1][i] * T[i][j] for i in range(2)]; k = c.index(max(c)); row.append(c[k] * E[OBS[t]][j]); p.append(k)
    d.append(row); ptr.append(p)
last = d[-1].index(max(d[-1])); path = [last]
for p in reversed(ptr): path.insert(0, p[path[0]])
def score(x):
    p = PI[x[0]] * E[OBS[0]][x[0]]
    for t in range(1, n): p *= T[x[t - 1]][x[t]] * E[OBS[t]][x[t]]
    return p
allp = {x: score(x) for x in itertools.product((0, 1), repeat=n)}
assert max(allp, key=allp.get) == tuple(path)
tot = sum(allp.values())
for t in range(n): assert abs(sum(v for x, v in allp.items() if x[t] == 0) / tot - sm[t][0]) < 1e-12
for t in range(n):
    part = {}
    for x in itertools.product((0, 1), repeat=t + 1):
        p = PI[x[0]] * E[OBS[0]][x[0]]
        for u in range(1, t + 1): p *= T[x[u - 1]][x[u]] * E[OBS[u]][x[u]]
        part[x] = p
    assert abs(sum(v for x, v in part.items() if x[t] == 0) / sum(part.values()) - f[t][0]) < 1e-12
for t in range(n): print('night', t + 1, OBS[t], 'predict A', round(predicted[t][0], 4), 'filter A', round(f[t][0], 4), 'smooth A', round(sm[t][0], 4), 'viterbi', S[path[t]], 'delta', [round(x, 5) for x in d[t]])
print('next night A', round(nxt[0], 4), 'path score', round(allp[tuple(path)], 5), 'evidence P', round(tot, 5), 'share', round(allp[tuple(path)] / tot, 3))
print('night2 step: predict', [round(x, 4) for x in predicted[1]], 'x emission', [round(predicted[1][j] * E['Lit'][j], 4) for j in range(2)])
json.dump({'states': S, 'pi': PI, 'T': T, 'E': E, 'obs': OBS, 'predicted': predicted, 'filter': f, 'next': nxt, 'smooth': sm, 'delta': d, 'path': path, 'score': allp[tuple(path)], 'evidence': tot}, open(OUT, 'w'), indent=1)

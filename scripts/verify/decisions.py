# Case VIII: expected utility, then classical machine learning, on invented tips. No libraries: every model is fitted here, from scratch.
import json, math, os, random
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'decisions.json')
# rational choice
acts = {'Raid tonight': [(0.70, 100), (0.30, -60)], 'Wait for the warrant': [(0.95, 60), (0.05, -10)]}
eu = {a: sum(p * u for p, u in o) for a, o in acts.items()}
print('EU', {k: round(v, 2) for k, v in eu.items()})
GUARD, LOSS = 2000, 16000; tau = GUARD / LOSS
print('threshold', tau)
# 24 invented tips: x = detail (0-10), y = source record (0-10); label 1 = real
rng = random.Random(23)
def tip(real):
    d = rng.gauss(5.8 if real else 4.2, 1.8); s = rng.gauss(5.6 if real else 4.0, 1.8)
    c = lambda v: round(min(10, max(0, v)), 1)
    return [c(d), c(s), real]
data = [tip(i % 3 == 0) for i in range(36)]; data = [[a, b, int(c)] for a, b, c in data]
rng.shuffle(data); train, test = data[:24], data[24:]
print('train real', sum(r[2] for r in train), 'of', len(train), 'test real', sum(r[2] for r in test), 'of', len(test))
sig = lambda z: 1 / (1 + math.exp(-z))
w = [0.0, 0.0, 0.0]; eta = 0.05 # logistic regression by batch gradient descent on the log loss
for epoch in range(20000):
    g = [0, 0, 0]
    for a, b, y in train:
        e = sig(w[0] * a + w[1] * b + w[2]) - y; g[0] += e * a; g[1] += e * b; g[2] += e
    w = [wi - eta * gi / len(train) for wi, gi in zip(w, g)]
P = lambda r: sig(w[0] * r[0] + w[1] * r[1] + w[2])
loss = -sum(r[2] * math.log(P(r)) + (1 - r[2]) * math.log(1 - P(r)) for r in train) / len(train)
print('weights', [round(x, 3) for x in w], 'train loss', round(loss, 3))
def metrics(rows, t):
    tp = sum(P(r) >= t and r[2] == 1 for r in rows); fp = sum(P(r) >= t and r[2] == 0 for r in rows); fn = sum(P(r) < t and r[2] == 1 for r in rows); tn = sum(P(r) < t and r[2] == 0 for r in rows)
    acc = (tp + tn) / len(rows); pr = tp / (tp + fp) if tp + fp else None; re = tp / (tp + fn) if tp + fn else None; f1 = 2 * pr * re / (pr + re) if pr and re else None
    return {'tp': tp, 'fp': fp, 'fn': fn, 'tn': tn, 'acc': acc, 'prec': pr, 'rec': re, 'f1': f1, 'cost': fp * GUARD + tp * GUARD + fn * LOSS}
m5, mt = metrics(test, 0.5), metrics(test, tau)
always = {'acc': sum(1 - r[2] for r in test) / len(test), 'cost': sum(r[2] for r in test) * LOSS}
print('test tau .5', m5); print('test tau', tau, mt); print('always "hoax"', always); print('train acc .5', metrics(train, .5)['acc'])
print('test probabilities', sorted((round(P(r), 2), r[2]) for r in test))
# decision tree: one split then one more, by Gini impurity
gini = lambda rows: 1 - sum((sum(r[2] == k for r in rows) / len(rows)) ** 2 for k in (0, 1)) if rows else 0
def split(rows):
    best = None
    for f in (0, 1):
        vs = sorted({r[f] for r in rows})
        for a, b in zip(vs, vs[1:]):
            t = round((a + b) / 2, 2); L = [r for r in rows if r[f] <= t]; R = [r for r in rows if r[f] > t]
            s = (len(L) * gini(L) + len(R) * gini(R)) / len(rows)
            if best is None or s < best[0] - 1e-12: best = (s, f, t, L, R)
    return best
root = split(train); nm = ['detail', 'record']
def describe(rows): return {'n': len(rows), 'real': sum(r[2] for r in rows)}
s2 = [split(root[3]), split(root[4])]
print('root', nm[root[1]], '<=', root[2], describe(root[3]), describe(root[4]), 'gini', round(gini(train), 3), '->', round(root[0], 3))
for k, s in enumerate(s2): print(' child', k, nm[s[1]], '<=', s[2], describe(s[3]), describe(s[4]))
def tree(r):
    c = 0 if r[root[1]] <= root[2] else 1; s = s2[c]; side = s[3] if r[s[1]] <= s[2] else s[4]
    return int(sum(x[2] for x in side) * 2 >= len(side))
print('tree test acc', sum(tree(r) == r[2] for r in test) / len(test), 'train acc', sum(tree(r) == r[2] for r in train) / len(train))
# Naive Bayes on two yes/no words, Laplace smoothing
nb_rows = [(1, 1, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1), (1, 1, 1), (1, 0, 1), (0, 0, 0), (1, 0, 0), (0, 0, 0), (0, 1, 0), (0, 0, 0), (0, 0, 0), (1, 0, 0), (0, 0, 0)] # (names a place, names a time, real)
def nb(x):
    sc = {}
    for y in (0, 1):
        rows = [r for r in nb_rows if r[2] == y]; p = len(rows) / len(nb_rows)
        for f in (0, 1):
            k = sum(r[f] == x[f] for r in rows); p *= (k + 1) / (len(rows) + 2)
        sc[y] = p
    return sc[1] / (sc[0] + sc[1]), sc
print('NB rows real', sum(r[2] for r in nb_rows), 'of', len(nb_rows), 'P(real|place,time)', nb((1, 1)), 'P(real|none)', nb((0, 0)))
# linear regression, closed form: tips that came in, by hours since the crime
xs = [1, 2, 3, 4, 6, 8]; ys = [31, 27, 26, 20, 15, 9]
mx, my = sum(xs) / 6, sum(ys) / 6; b1 = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs); b0 = my - b1 * mx
mse = sum((y - (b1 * x + b0)) ** 2 for x, y in zip(xs, ys)) / 6
print('line', round(b1, 2), round(b0, 2), 'mse', round(mse, 2), 'at 5:', round(b1 * 5 + b0, 1))
# k-means on the tips, ignoring labels
pts = [r[:2] for r in data]; cs = [pts[0][:], pts[1][:]]
for it in range(1, 100):
    g = [[], []]
    for p in pts: g[min((0, 1), key=lambda k: (p[0] - cs[k][0]) ** 2 + (p[1] - cs[k][1]) ** 2)].append(p)
    new = [[sum(q[i] for q in c) / len(c) for i in (0, 1)] for c in g]
    if new == cs: break
    cs = new
print('kmeans', it, 'iterations, sizes', [len(c) for c in g], 'centres', [[round(x, 1) for x in c] for c in cs])
json.dump({'eu': eu, 'acts': acts, 'guard': GUARD, 'loss': LOSS, 'tau': tau, 'w': w, 'test': [{'x': r[:2], 'y': r[2], 'p': P(r)} for r in test], 'train': train, 'm5': m5, 'mt': mt, 'always': always, 'tree': {'root': [nm[root[1]], root[2], describe(root[3]), describe(root[4])], 'kids': [[nm[s[1]], s[2], describe(s[3]), describe(s[4])] for s in s2], 'giniRoot': gini(train), 'giniSplit': root[0], 'testAcc': sum(tree(r) == r[2] for r in test) / len(test), 'trainAcc': sum(tree(r) == r[2] for r in train) / len(train)}, 'nb': {'both': nb((1, 1))[0], 'none': nb((0, 0))[0]}, 'line': [b1, b0, mse], 'kmeans': {'it': it, 'sizes': [len(c) for c in g], 'centres': cs}}, open(OUT, 'w'), indent=1)

# Case VI: Bayes' rule on a forensic test, then exact and sampled inference in a four-node Bayesian network.
import json, os, random, itertools
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'bayes.json')
prior, sens, fpr, N = 0.02, 0.98, 0.05, 10000
post = sens * prior / (sens * prior + fpr * (1 - prior))
guilty = N * prior; tp = guilty * sens; fp = (N - guilty) * fpr
print('posterior', round(post, 4), 'of', N, ':', guilty, 'guilty', tp, 'match;', N - guilty, 'innocent', fp, 'match;', tp, '/', tp + fp)
# network: Break-in -> Window <- Storm, Break-in -> Print
P_B, P_S = 0.02, 0.10
P_W = {(1, 1): 0.99, (1, 0): 0.90, (0, 1): 0.30, (0, 0): 0.001}
P_M = {1: 0.80, 0: 0.05}
def joint(b, s, w, m):
    p = (P_B if b else 1 - P_B) * (P_S if s else 1 - P_S)
    p *= P_W[(b, s)] if w else 1 - P_W[(b, s)]
    return p * (P_M[b] if m else 1 - P_M[b])
assert abs(sum(joint(*x) for x in itertools.product((0, 1), repeat=4)) - 1) < 1e-12
def ask(var, **ev):
    names = 'bswm'; num = den = 0
    for x in itertools.product((0, 1), repeat=4):
        v = dict(zip(names, x))
        if any(v[k] != e for k, e in ev.items()): continue
        p = joint(*x); den += p; num += p * v[var]
    return num / den
rows = {'B': ask('b'), 'B|W': ask('b', w=1), 'B|W,S': ask('b', w=1, s=1), 'B|W,notS': ask('b', w=1, s=0), 'B|W,M': ask('b', w=1, m=1), 'B|W,S,M': ask('b', w=1, s=1, m=1), 'S|W': ask('s', w=1), 'S': ask('s'), 'W': sum(joint(b, s, 1, m) for b, s, m in itertools.product((0, 1), repeat=3))}
for k, v in rows.items(): print(k, round(v, 4))
# enumeration shown step by step for P(B | W)
pbw = sum(joint(1, s, 1, m) for s in (0, 1) for m in (0, 1)); pnw = sum(joint(0, s, 1, m) for s in (0, 1) for m in (0, 1))
print('P(B,W)', round(pbw, 5), 'P(notB,W)', round(pnw, 5))
rng = random.Random(42); kept = rain = 0; NS = 100000
for _ in range(NS):
    b = rng.random() < P_B; s = rng.random() < P_S; w = rng.random() < P_W[(int(b), int(s))]; rng.random()
    if w: kept += 1; rain += b
print('rejection sampling: kept', kept, 'of', NS, 'estimate', round(rain / kept, 4))
json.dump({'prior': prior, 'sens': sens, 'fpr': fpr, 'post': post, 'N': N, 'guilty': guilty, 'tp': tp, 'fp': fp, 'P_B': P_B, 'P_S': P_S, 'P_W': {f'{a}{b}': v for (a, b), v in P_W.items()}, 'P_M': P_M, 'rows': rows, 'pbw': pbw, 'pnw': pnw, 'sample': {'n': NS, 'kept': kept, 'est': rain / kept}, 'params': {'network': 1 + 1 + 4 + 2, 'joint': 2 ** 4 - 1}}, open(OUT, 'w'), indent=1)

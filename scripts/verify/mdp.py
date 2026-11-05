# Case V: one grid world, solved twice: value iteration knows the rules, Q-learning only tries things.
import json, os, random
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'mdp.json')
MAP = ['....G', '.#.X.', 'S....']
H, W = 3, 5; GAMMA, STEP, GOAL, TRAP, P_OK, P_SIDE = 0.9, -1, 10, -10, 0.8, 0.1
ACTS = {'N': (-1, 0), 'E': (0, 1), 'S': (1, 0), 'W': (0, -1)}; SIDE = {'N': 'WE', 'S': 'EW', 'E': 'NS', 'W': 'SN'}
cells = [(r, c) for r in range(H) for c in range(W) if MAP[r][c] != '#']
term = lambda s: MAP[s[0]][s[1]] in 'GX'
free = [s for s in cells if not term(s)]
def move(s, a):
    r, c = s[0] + ACTS[a][0], s[1] + ACTS[a][1]
    return (r, c) if 0 <= r < H and 0 <= c < W and MAP[r][c] != '#' else s
def reward(n): return GOAL if MAP[n[0]][n[1]] == 'G' else TRAP if MAP[n[0]][n[1]] == 'X' else STEP
def outcomes(s, a): return [(P_OK, move(s, a))] + [(P_SIDE, move(s, b)) for b in SIDE[a]]
def q(s, a, V): return sum(p * (reward(n) + GAMMA * V[n]) for p, n in outcomes(s, a))

V = {s: 0.0 for s in cells}; sweeps = []; k = 0
while True:
    new = dict(V)
    for s in free: new[s] = max(q(s, a, V) for a in ACTS)
    d = max(abs(new[s] - V[s]) for s in cells); V = new; k += 1
    sweeps.append({'k': k, 'V': {f'{r},{c}': round(v, 2) for (r, c), v in V.items()}, 'delta': d})
    if d < 1e-6: break
pi = {s: max(ACTS, key=lambda a: q(s, a, V)) for s in free}
for r in range(H): print(' '.join(('    #   ' if MAP[r][c] == '#' else f'{V[(r, c)]:6.2f}{pi.get((r, c), "*")} ') for c in range(W)))
print('sweeps', k)
print('Q at start', {a: round(q((2, 0), a, V), 2) for a in ACTS})
start = (2, 0)
for t in (1, 2, 3, 4, 5, 6, 10, 20): print('after sweep', t, 'V(start)', sweeps[t - 1]['V']['2,0'], 'V(2,4)', sweeps[t - 1]['V']['2,4'], 'V(0,3)', sweeps[t-1]['V']['0,3'])
qs = {a: round(q((1, 2), a, V), 2) for a in ACTS}
print('Q at (1,2), next to the trap', qs)
print('one backup, cell above trap (0,3) moving E: ', [(p, n, reward(n), round(V[n], 2)) for p, n in outcomes((0, 3), 'E')], round(q((0, 3), 'E', V), 2))

# Q-learning: same world, sampled; the learner sees only (s, a, r, s')
rng = random.Random(1303); A = list(ACTS); Q = {(s, a): 0.0 for s in free for a in A}; visits = {k: 0 for k in Q}
EPS, EPISODES = 0.3, 50000
def env(s, a):
    x, acc = rng.random(), 0
    for p, n in outcomes(s, a):
        acc += p
        if x < acc: return n
    return n
snap = {}; example = None; steps = 0
best = lambda s: max(A, key=lambda a: Q[(s, a)])
for ep in range(1, EPISODES + 1):
    s = rng.choice(free) # each attempt starts somewhere new, so every street gets walked
    for _ in range(200):
        a = rng.choice(A) if rng.random() < EPS else best(s)
        n = env(s, a); r = reward(n); fut = 0 if term(n) else max(Q[(n, b)] for b in A)
        visits[(s, a)] += 1; alpha = 20 / (20 + visits[(s, a)]) # big steps at first, smaller as evidence piles up
        old = Q[(s, a)]; target = r + GAMMA * fut; Q[(s, a)] = old + alpha * (target - old); steps += 1
        if example is None and s == (0, 2) and a == 'E' and n == (0, 3) and fut > 5:
            o, f = round(old, 2), round(fut, 2); t = round(r + GAMMA * f, 2); example = {'ep': ep, 's': s, 'a': a, 'alpha': round(alpha, 2), 'old': o, 'r': r, 'fut': f, 'target': t, 'new': round(o + round(alpha, 2) * (t - o), 2)}
        s = n
        if term(s): break
    if ep in (10, 100, 1000, 10000, EPISODES):
        snap[ep] = {'V': {f'{r},{c}': round(max(Q[((r, c), b)] for b in A), 2) for (r, c) in free}, 'pi': {f'{r},{c}': best((r, c)) for (r, c) in free}, 'match': sum(best(x) == pi[x] for x in free), 'rms': (sum((max(Q[(x, b)] for b in A) - V[x]) ** 2 for x in free) / len(free)) ** 0.5}
        print('episodes', ep, 'policy matches', snap[ep]['match'], 'of', len(free), 'rms', round(snap[ep]['rms'], 2))
print('example update', example, 'total steps', steps)
print('learned V', snap[EPISODES]['V']); print('learned pi', snap[EPISODES]['pi'])
json.dump({'map': MAP, 'gamma': GAMMA, 'V': {f'{r},{c}': round(v, 2) for (r, c), v in V.items()}, 'pi': {f'{r},{c}': a for (r, c), a in pi.items()}, 'sweeps': k, 'qS': {a: round(q(start, a, V), 2) for a in ACTS},
           'trace': {str(t): sweeps[t - 1]['V'] for t in (1, 2, 3, 5, 10)}, 'q': {'eps': EPS, 'episodes': EPISODES, 'snap': snap, 'example': example, 'steps': steps}}, open(OUT, 'w'), indent=1)

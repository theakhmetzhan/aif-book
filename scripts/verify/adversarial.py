# Case IV: a game tree solved by minimax, alpha-beta and expectimax; then every game of tic-tac-toe.
import json, math, os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'adversarial.json')
MOVES = ['Docks', 'Market', 'Station']
LEAVES = [[6, 11, 8], [4, 9, 13], [16, 7, 5]]

def alphabeta(tree):
    """Root is MAX, its children MIN, leaves known. Returns value and the (i, j) leaves looked at."""
    alpha, seen, values = -math.inf, [], []
    for i, kids in enumerate(tree):
        beta = math.inf
        for j, u in enumerate(kids):
            seen.append((i, j)); beta = min(beta, u)
            if beta <= alpha: break
        values.append(beta); alpha = max(alpha, beta)
    return alpha, seen, values

mins = [min(k) for k in LEAVES]
root = max(mins); best = mins.index(root)
ab, seen, bounds = alphabeta(LEAVES)
assert ab == root
pruned = [(i, j) for i in range(3) for j in range(3) if (i, j) not in seen]
means = [sum(k) / 3 for k in LEAVES]
print('minimax MIN values', dict(zip(MOVES, mins)), 'root', root, MOVES[best])
print('alpha-beta looked at', len(seen), 'of 9; pruned', pruned, 'bounds', bounds)
print('expectimax (each route 1/3)', {m: round(v, 2) for m, v in zip(MOVES, means)}, MOVES[means.index(max(means))])
# move ordering: the same tree, children sorted well and badly
good = sorted([sorted(k) for k in LEAVES], key=min, reverse=True); bad = sorted([sorted(k, reverse=True) for k in LEAVES], key=min)
order = {'best first': len(alphabeta(good)[1]), 'worst first': len(alphabeta(bad)[1])}
print('leaves looked at by ordering', order)

# tic-tac-toe, the whole tree
LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]
def won(b):
    for a, c, d in LINES:
        if b[a] and b[a] == b[c] == b[d]: return b[a]
    return 0
count = {'nodes': 0, 'games': 0}
def full(b, p):
    count['nodes'] += 1; w = won(b)
    if w or 0 not in b: count['games'] += 1; return w
    vals = []
    for i in range(9):
        if not b[i]: b[i] = p; vals.append(full(b, -p)); b[i] = 0
    return max(vals) if p == 1 else min(vals)
abn = {'nodes': 0}
def prune(b, p, al, be):
    abn['nodes'] += 1; w = won(b)
    if w or 0 not in b: return w
    v = -2 if p == 1 else 2
    for i in range(9):
        if b[i]: continue
        b[i] = p; c = prune(b, -p, al, be); b[i] = 0
        if p == 1: v = max(v, c); al = max(al, v)
        else: v = min(v, c); be = min(be, v)
        if al >= be: break
    return v
v1 = full([0] * 9, 1); v2 = prune([0] * 9, 1, -2, 2)
assert v1 == v2 == 0
print('tic-tac-toe value', v1, count, 'alpha-beta positions', abn['nodes'], 'share', round(abn['nodes'] / count['nodes'] * 100, 1))
chess = 100 * math.log10(35)
print('35^100 = 10^%.1f; half the depth 35^50 = 10^%.1f' % (chess, chess / 2))
json.dump({'moves': MOVES, 'leaves': LEAVES, 'mins': mins, 'root': root, 'best': best, 'seen': seen, 'pruned': pruned, 'means': means,
           'order': order, 'ttt': {'value': v1, 'positions': count['nodes'], 'games': count['games'], 'alphabeta': abn['nodes']}}, open(OUT, 'w'), indent=1)

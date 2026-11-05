# Case IX: a perceptron learns AND and cannot learn XOR; a small network with one hidden layer, trained by backpropagation, can.
import json, math, os, random
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'neural.json')
X = [(0, 0), (0, 1), (1, 0), (1, 1)]; AND = [0, 0, 0, 1]; XOR = [0, 1, 1, 0]
step = lambda z: 1 if z >= 0 else 0
def perceptron(Y, epochs=1000, eta=0.1):
    w = [0.0, 0.0]; b = 0.0; trace = []; bestc = 0
    for ep in range(1, epochs + 1):
        err = 0
        for x, y in zip(X, Y):
            e = y - step(w[0] * x[0] + w[1] * x[1] + b)
            if e: err += 1; w = [round(w[0] + eta * e * x[0], 10), round(w[1] + eta * e * x[1], 10)]; b = round(b + eta * e, 10)
            trace.append((ep, x, y, e, w[:], b))
        c = sum(step(w[0] * x[0] + w[1] * x[1] + b) == y for x, y in zip(X, Y)); bestc = max(bestc, c)
        if err == 0: return ep, w, b, c, bestc, trace
    return None, w, b, c, bestc, trace
ep, w, b, c, _, tr = perceptron(AND); print('AND: clean pass at epoch', ep, 'w', w, 'b', b)
print('first updates', [t for t in tr[:8]])
epx, wx, bx, cx, bestx, _ = perceptron(XOR); print('XOR after 1000 epochs: converged', epx, 'right', cx, 'best', bestx, 'w', wx, 'b', bx)
sig = lambda z: 1 / (1 + math.exp(-z))
def train(seed, H=2, eta=0.5, epochs=20000):
    r = random.Random(seed)
    W1 = [[r.uniform(-1, 1) for _ in range(2)] for _ in range(H)]; b1 = [r.uniform(-1, 1) for _ in range(H)]; W2 = [r.uniform(-1, 1) for _ in range(H)]; b2 = r.uniform(-1, 1)
    curve = []
    def fwd(x):
        h = [sig(W1[j][0] * x[0] + W1[j][1] * x[1] + b1[j]) for j in range(H)]; return h, sig(sum(W2[j] * h[j] for j in range(H)) + b2)
    for e in range(epochs + 1):
        if e in (0, 100, 1000, 2000, 5000, 10000, 20000) or e == epochs: curve.append((e, sum((y - fwd(x)[1]) ** 2 for x, y in zip(X, XOR)) / 4))
        if e == epochs: break
        for x, y in zip(X, XOR):
            h, o = fwd(x); do = (o - y) * o * (1 - o)
            dh = [do * W2[j] * h[j] * (1 - h[j]) for j in range(H)]
            for j in range(H):
                W2[j] -= eta * do * h[j]; b1[j] -= eta * dh[j]
                for i in range(2): W1[j][i] -= eta * dh[j] * x[i]
            b2 -= eta * do
    return W1, b1, W2, b2, curve, [fwd(x)[1] for x in X], [fwd(x)[0] for x in X]
res = {}
for H in (2, 3):
    ok = [s for s in range(20) if all(round(o) == y for o, y in zip(train(s, H)[5], XOR))]; res[H] = ok; print('hidden', H, 'solves XOR on', len(ok), 'of 20 seeds', ok)
seed = res[2][0]; W1, b1, W2, b2, curve, out, hid = train(seed)
print('seed', seed, 'W1', W1, 'b1', b1, 'W2', W2, 'b2', b2); print('curve', [(e, round(l, 4)) for e, l in curve]); print('outputs', [round(o, 3) for o in out]); print('hidden', [[round(v, 2) for v in h] for h in hid])
print('parameters', 2 * 2 + 2 + 2 + 1)
# the slide's two formulas on one neuron of this network, for the worked forward pass at x = (1, 0)
z = [W1[j][0] * 1 + b1[j] for j in range(2)]; print('forward (1,0): z', [round(v, 2) for v in z], 'h', [round(sig(v), 2) for v in z])
json.dump({'and': {'epoch': ep, 'w': w, 'b': b}, 'xor': {'right': cx, 'best': bestx}, 'seeds': {'h2': len(res[2]), 'h3': len(res[3]), 'of': 20}, 'net': {'seed': seed, 'W1': W1, 'b1': b1, 'W2': W2, 'b2': b2, 'curve': curve, 'out': out, 'hidden': hid}}, open(OUT, 'w'), indent=1)

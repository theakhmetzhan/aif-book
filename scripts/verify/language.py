# Case X: a word-pair language model trained on a few invented case notes; temperature; one attention step; layered safeguards.
import json, math, os, random, re
from collections import Counter, defaultdict
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'language.json')
NOTES = '''reed opened the door . moss opened the safe . kerr locked the safe . reed locked the door .
moss saw the safe . kerr saw the safe . reed saw the door . moss hid the ledger .
kerr opened the ledger . reed found the key . moss locked the door . kerr found the safe .
the safe was empty . the safe was open . the door was open . the ledger was missing .
reed saw the safe . moss found the ledger . kerr hid the key . reed saw the door .'''
words = NOTES.split(); sents = [s.strip() + ' .' for s in NOTES.replace('\n', ' ').split(' . ') if s.strip()]
sents = [s.replace(' . .', ' .') for s in sents]
pairs = defaultdict(Counter)
for a, b in zip(words, words[1:]): pairs[a][b] += 1
print('words', len(words), 'vocabulary', len(set(words)), 'pairs seen', sum(len(c) for c in pairs.values()), 'sentences', len(sents))
after = pairs['the']; tot = sum(after.values()); P = {w: c / tot for w, c in after.most_common()}
print('after the', after.most_common(), tot)
def temp(p, T):
    z = {w: math.exp(math.log(v) / T) for w, v in p.items()}; s = sum(z.values()); return {w: v / s for w, v in z.items()}
T = {str(t): temp(P, t) for t in (0.5, 1, 2)}
for t, d in T.items(): print('T', t, {w: round(v, 3) for w, v in sorted(d.items(), key=lambda x: -x[1])})
rng = random.Random(7); fresh = []
def gen():
    s = [rng.choice(['reed', 'moss', 'kerr'])]
    while s[-1] != '.' and len(s) < 12:
        c = pairs[s[-1]]; s.append(rng.choices(list(c), list(c.values()))[0])
    return ' '.join(s)
n = 0; total = 1000; outs = Counter()
for _ in range(total):
    g = gen(); outs[g] += 1
    if g not in sents: n += 1
print('sampled', total, 'new sentences', n, 'share', round(n / total, 3), 'distinct', len(outs)); print([s for s, _ in outs.most_common() if s not in sents][:14])
claim = 'reed opened the safe .'
print(claim, 'in notes?', claim in sents, 'all pairs seen?', all(pairs[a][b] for a, b in zip(claim.split(), claim.split()[1:])), 'probability', round(math.prod(pairs[a][b] / sum(pairs[a].values()) for a, b in zip(claim.split()[0:], claim.split()[1:])), 5))
# one attention step: "it" looks back over the sentence. Vectors chosen by hand for the demonstration; a real model learns them.
toks = ['the', 'safe', 'was', 'empty', 'because', 'it']
K = {'the': [0.1, 0.0, 0.1], 'safe': [1.0, 0.9, 0.0], 'was': [0.0, 0.2, 0.3], 'empty': [0.6, 0.1, 0.2], 'because': [0.1, 0.1, 0.5], 'it': [0.5, 0.4, 0.3]}
q = [1.2, 1.0, 0.1]; sc = [sum(a * b for a, b in zip(q, K[t])) / math.sqrt(3) for t in toks]; e = [math.exp(x) for x in sc]; att = [x / sum(e) for x in e]
print('attention', {t: round(a, 3) for t, a in zip(toks, att)})
# layered safeguards: share of harmful outputs that pass every layer, if each layer independently misses this share
miss = [0.2, 0.1, 0.1, 0.05]; through = math.prod(miss)
print('misses', miss, 'through all four', through, '= 1 in', round(1 / through))
print('with layers correlated (all four fail together on half of what the first misses):', miss[0] * 0.5)
claimP = math.prod(pairs[a][b] / sum(pairs[a].values()) for a, b in zip(claim.split(), claim.split()[1:]))
json.dump({'notes': NOTES, 'claimP': claimP, 'n': len(words), 'vocab': len(set(words)), 'after': after.most_common(), 'P': P, 'T': T, 'sampled': total, 'new': n, 'claim': claim, 'attention': dict(zip(toks, att)), 'miss': miss, 'through': through}, open(OUT, 'w'), indent=1)

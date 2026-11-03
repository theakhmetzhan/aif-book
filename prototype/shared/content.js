// PROTOTYPE sample content: preface + Chapter II (Search) + opening of Chapter III.
// Same text in every variant so only the look differs.
export const book = {
  title: 'Ushqyn',
  kazakh: 'Ұшқын',
  subtitle: 'The Spark That Learned to Think',
  author: 'Akhmetzhan Turlybek',
  course: 'AI Fundamentals · QAIRU · 2026',
};

export const sections = [
  {
    id: 'preface', world: 'spark', kicker: 'Preface',
    title: 'A spark on the steppe',
    body: [
      'Before there was a map, before there was a plan, there was a single point of light on a dark steppe. It could sense a little of the world and it could act on a little of the world. Nothing more.',
      'In this book that spark is called Ushqyn, which means “spark” in Kazakh. Each chapter gives it one new way of thinking, the same ideas a first-year AI course teaches, in the order we learned them.',
      'Scroll, read, and play: every algorithm in this book runs live in your browser.',
    ],
  },
  {
    id: 'ch2', world: 'steppe', kicker: 'Chapter II',
    title: 'The Paths',
    body: [
      'Ushqyn wants to reach a far camp. To a computer, “reach a far camp” means nothing until we formulate it as a search problem: a set of states, an initial state, actions, a transition model, a goal test and a cost for each step.',
    ],
  },
  {
    id: 'ch2-graph', world: 'graph', kicker: 'II · State space',
    title: 'The steppe becomes a graph',
    body: [
      'Each place Ushqyn could stand becomes a node. Each move between places becomes an edge with a cost. The whole steppe collapses into a state-space graph, and solving the problem means finding a path through it.',
      'An uninformed search knows nothing about where the goal lies. Breadth-first search (BFS) expands every node at depth 1, then every node at depth 2, like a ripple on water. It is complete, and with equal step costs it finds the shortest path, but it may expand a huge number of nodes.',
    ],
  },
  {
    id: 'ch2-astar', world: 'graph', kicker: 'II · Informed search',
    title: 'A* looks toward the goal',
    toy: 'search',
    body: [
      'A* ranks every frontier node by f(n) = g(n) + h(n): the cost already paid, g, plus a heuristic guess of the cost still to go, h. If h never overestimates the true remaining cost (it is admissible), A* still returns an optimal path, usually after expanding far fewer nodes.',
      'Try it: draw walls, then run BFS and A*. Both find a path of the same length; count how many nodes each one had to expand.',
    ],
  },
  {
    id: 'ch3', world: 'mountains', kicker: 'Chapter III',
    title: 'The Mountains',
    body: [
      'Sometimes the path does not matter, only the destination: the best arrangement, the highest point. The steppe folds into mountains, and Ushqyn learns local search: climb uphill, and beware the peaks that are only locally high.',
    ],
  },
];

export const chapters = [
  ['I', 'Waking', 'Agents & environments'],
  ['II', 'The Paths', 'Search, A*, heuristics'],
  ['III', 'The Mountains', 'Local search & CSP'],
  ['IV', 'The Board', 'Adversarial search'],
  ['V', 'The Storm', 'MDPs & reinforcement learning'],
  ['VI', 'The Night Sky', 'Probability & Bayesian networks'],
  ['VII', 'The Hidden Engine', 'HMMs & filtering'],
  ['VIII', 'The Saxaul Tree', 'Decisions & classical ML'],
  ['IX', 'The Roots', 'Perceptrons & neural networks'],
  ['X', 'The River of Words', 'LLMs, generative AI, safety'],
];

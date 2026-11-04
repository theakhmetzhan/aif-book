# EVIDENCE · A Casebook of Artificial Intelligence

A 3D pop-up casebook of AI fundamentals, lying open on a detective's desk at night, in front of the evidence board used to plan it. At desk level the paper exhibits tell the story; lean over the book and the pages beneath give the full explanation.

Endterm project for AI Fundamentals (AIF1303), QAIRU, Fall 2026, by Akhmetzhan Turlybek. This edition contains Cases I–III.

**Read it:** https://theakhmetzhan.github.io/aif-book/

## Controls
- **Look around:** drag (one finger on a phone).
- **Come closer:** scroll, or pinch. It zooms toward whatever is under the pointer.
- **Move sideways:** right-drag, shift-drag, or drag with two fingers.
- **Turn a page:** click or tap the page, or press ← → (Home and End jump to the covers).
- **Views:** the Desk / Read / Room buttons at the bottom right, or H (also Escape), R and O. Read leans over the open spread (on a phone it frames the text page); Room steps back to show the whole board and desk.
- **Keyboard camera:** ↑ ↓ tilt, A D orbit, + − zoom.
- **Sound:** M, or the button at the bottom left. Sound starts after your first click: light rain at the window, distant thunder after the lightning, the desk clock, and the pages.
- **Screen readers:** the text of the open spread is mirrored into the page as plain HTML and announced when the spread changes.

## How it is built
- **Case:** two cloth boards and a stiff spine strip of fixed length, joined by flexible joints. Shut, the strip stands against the block. Open, the case lies flat on the desk and stays put: the strip lies between the boards, each stack of pages sits on its board, and the crease between the top pages crosses the strip as pages turn. Both top pages roll down into the crease, and the leaves rise out of the spine in a fan, each bend nested inside the one above, so the section is paper all the way to the cloth.
- **Pages:** stiff card, always the same thickness, that turns about the back of the block. The stacks shear toward the crease, as real paper does. Every pop-up piece is a rigid card hinged to its page by a glued tab.
- **Folding:** all pieces on a page share one fold angle, set by the angle between the two pages of the spread, so they only rise as it opens. They stay inside their half of that wedge, so paper never passes through paper.
- **Collision check:** `scripts/check/collide.mjs` runs every page turn and checks every pop-up and page vertex against every page. `scripts/check/book.mjs` measures the book through every turn: the gaps the eye sees (air shut in by the book and the desk, air under the paper at either end of the book, the inside of the spine showing through the block, paper poking through the cloth, a board off the desk, a dark strip at the gutter), the strip's length, page thickness, that the spine stays one closed section, and that no sheet or pop-up jumps or reverses. `scripts/check/shots.mjs` captures every rest state and every turn in eighths, from desk level, from above and from each camera an owner complaint came from, at 1920x1080 with a 3x render of the spine and gutter: those frames are looked at, one by one.
- **Figure data:** the data in `src/data/` is generated and checked in Python, in `scripts/verify/`.

Develop: `npm i && npm run dev`. Third-party assets and sounds are credited in `public/assets/CREDITS.md` and `public/audio/CREDITS.md`. The fonts (SIL Open Font License) are served from `public/fonts/`.

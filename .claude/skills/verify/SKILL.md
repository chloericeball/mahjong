---
name: verify
description: How to build, launch, and drive this mahjong app to verify changes end-to-end.
---

# Verifying the mahjong app

## Launch
- `npm run dev` (background) starts the ws game server (tsx, port 3000) and Vite client on **http://localhost:5173** (Vite proxies `/ws`).
- Wait ~3s, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173` should return 200.

## Drive the GUI
- Use `puppeteer-core` (already a devDependency) with the system Chrome at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `headless: true`.
- The driver script **must live inside the repo** (e.g. `.drive.tmp.ts`, delete after) so
  node can resolve `puppeteer-core`; run with `npx tsx`.
- Useful selectors: home nav cards `button.nav-card`; lesson hub items `.hub-item`;
  lesson tiles `.l-choices .tile`; feedback `.l-feedback.good` / `.l-feedback.bad`;
  advance button in `.l-nav`; puzzle hand `.l-hand .tile`; in-game table `.table`.
- Flows worth driving: home → Learn → complete lesson 1 (tap answers, indexes
  [2,2,2,2,0] after the two info steps) → hub shows ✓; home → Puzzles → tap a tile →
  feedback → Next puzzle; home → "Play vs AI" → `.table` renders.

## Checks that are NOT verification (CI territory)
- `npm test` = engine tests + `src/lessons.test.ts` (validates every lesson exercise
  answer and the puzzle generator against `shared/win.ts`).
- `npm run typecheck`, `npm run test:e2e` (ws-protocol solo game + lobby).

## Gotchas
- `/favicon.ico` 404s in the console — pre-existing, harmless.
- Game state is server-side; reloading the page mid-game loses the session.

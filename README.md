# 麻雀 Mahjong

Hong Kong–rules mahjong you can play online with friends (room codes) or solo against AI.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Friends on the same network can join via the
`Network:` URL Vite prints (share the 4-letter room code with them).

- **Play vs AI** — instant solo game against 3 bots
- **Create Room** — get a room code; empty seats are filled by AI when the host starts
- **Join** — enter a friend's room code
- If a player disconnects mid-game, the AI takes over their seat; they can
  rejoin with the room code to reclaim it.

## Learning to play

- **How to Play guide** — illustrated rules reference (goal, tiles, turns, claiming, scoring, tips), available from the lobby and via the `? How to play` button during a game
- **Coach mode** (🎓 toggle in the top bar, on by default) — live hints while you play:
  suggested discard highlighted each turn, the exact tiles you're waiting on when ready (聽牌),
  and plain-English explanations + a recommendation whenever Pung/Chow/Kong/Win buttons appear

## Deploy (Render)

The repo includes `render.yaml`. One-time setup:

1. Go to https://render.com and sign in with GitHub
2. **New → Blueprint**, pick this repo, click **Deploy**

You'll get a `https://mahjong-….onrender.com` URL — share it with friends; room codes
work across the internet. In production a single Node process serves the built client
and the WebSocket on one port (`npm run build && npm start`, honors `$PORT`).

Note: on Render's free plan the server sleeps after ~15 idle minutes; the first visit
after that takes ~a minute to wake. Games live in memory, so a restart clears rooms.

## Rules implemented

- Classic Hong Kong 13-tile play: chow 上 / pung 碰 / kong 槓 (concealed, exposed, added), flowers with auto-replacement, claim priority (win > pung/kong > chow, nearest-seat tiebreak)
- Faan scoring: common hand, all pungs, mixed/pure one suit, dragon & wind pungs, small/great dragons & winds, all honors, thirteen orphans, flowers, self-draw, fully concealed, last-tile & kong-replacement wins (capped at 13 faan)
- Payments: base = 2^faan (capped at 2^10); self-draw collects from all three, discarder pays full on a discard win
- Dealer repeats on dealer win or wall-exhaustion draw; prevailing wind advances each full dealer rotation

## Project layout

- `shared/` — rules engine + AI, used by both server and tests
  - `tiles.ts` wall & tile utilities · `win.ts` win detection + faan scoring · `game.ts` state machine · `ai.ts` bot heuristics
- `server/index.ts` — WebSocket server (rooms, claims timeout, bot driver)
- `src/` — React client

## Tests

```bash
npm test              # engine unit tests + 30 simulated AI games
npx tsx server/e2e.test.ts   # end-to-end over WebSocket (needs `npm run dev` running)
npm run typecheck
```

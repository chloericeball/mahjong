// Quick sanity tests: npx tsx shared/engine.test.ts
import { isWinningHand, scoreHand, waitingTiles } from './win';
import { Game } from './game';
import { chooseDiscard, chooseClaim, shouldSelfKong } from './ai';

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL: ${name}`); }
}

// --- win detection ---
check('basic win: 4 chows + pair',
  isWinningHand(['d1','d2','d3','d4','d5','d6','b1','b2','b3','c7','c8','c9','wE','wE'], []));
check('all pungs win',
  isWinningHand(['d1','d1','d1','b5','b5','b5','c9','c9','c9','gR','gR','gR','wN','wN'], []));
check('not a win (no pair)',
  !isWinningHand(['d1','d2','d3','d4','d5','d6','d7','d8','d9','b1','b2','b3','c1','c2'], []));
check('win with melds',
  isWinningHand(['d1','d2','d3','wE','wE'], [
    { kind: 'pung', codes: ['gR','gR','gR'] },
    { kind: 'chow', codes: ['b1','b2','b3'] },
    { kind: 'kong', codes: ['c5','c5','c5','c5'] },
  ]));
check('thirteen orphans',
  isWinningHand(['d1','d9','b1','b9','c1','c9','wE','wS','wW','wN','gR','gG','gW','gR'], []));

// --- waits ---
const waits = waitingTiles(['d1','d2','d3','d4','d5','d6','b1','b2','b3','c7','c8','wE','wE'], []);
check('waiting on c6/c9', waits.includes('c6') && waits.includes('c9') && waits.length === 2);

// --- scoring ---
const ctx = { selfDrawn: false, seatWind: 'wE', roundWind: 'wE', flowers: [], seatIndex: 0 };
const s1 = scoreHand(['d1','d2','d3','d4','d5','d6','d7','d8','d9','d1','d2','d3','d5','d5'], [], ctx as any);
check('pure one suit >= 7 faan', s1.faan >= 7);
const s2 = scoreHand(['gR','gR','gR','gG','gG','gG','gW','gW','gW','d1','d2','d3','d5','d5'], [], ctx as any);
check('great dragons >= 8 faan', s2.faan >= 8);
const s3 = scoreHand(['wE','wE','wE','d1','d2','d3','d4','d5','d6','b1','b2','b3','c5','c5'], [], ctx as any);
check('seat+round wind = double count', s3.elements.filter(e => e.name.includes('Wind')).length === 2);

// --- full game simulation with AI ---
for (let trial = 0; trial < 30; trial++) {
  const game = new Game([
    { name: 'A', isBot: true }, { name: 'B', isBot: true },
    { name: 'C', isBot: true }, { name: 'D', isBot: true },
  ]);
  game.startHand();
  let steps = 0;
  while (game.phase !== 'handEnd' && steps++ < 1000) {
    if (game.phase === 'discard') {
      const seat = game.turn;
      const acts = game.selfActions(seat);
      if (acts.canWin) { game.declareSelfWin(seat); continue; }
      const kong = acts.kongs.find((k) => shouldSelfKong(game, seat, k));
      if (kong) { game.declareKong(seat, kong); continue; }
      game.discard(seat, chooseDiscard(game, seat));
    } else if (game.phase === 'claiming') {
      for (const pc of [...game.pendingClaims]) {
        if (pc.response) continue;
        const d = chooseClaim(game, pc.seat, pc.options, pc.chowChoices);
        game.respondClaim(pc.seat, d.kind, d.chow);
      }
    } else {
      break;
    }
  }
  check(`sim ${trial}: hand completes`, game.phase === 'handEnd' && steps < 1000);
  if (game.lastResult?.type === 'win') {
    const sum = game.lastResult.payments!.reduce((a, b) => a + b, 0);
    check(`sim ${trial}: payments zero-sum`, sum === 0);
  }
  // tile conservation: wall + hands + melds + flowers + discards + drawn == 144
  const total = game.wall.length
    + game.players.reduce((a, p) => a + p.hand.length + p.melds.reduce((x, m) => x + m.codes.length, 0) + p.flowers.length + p.discards.length, 0)
    + (game.drawnTile ? 1 : 0)
    + (game.lastResult?.type === 'win' && game.lastResult.loser !== undefined ? 1 : 0);
  check(`sim ${trial}: tiles conserved (${total})`, total === 144);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

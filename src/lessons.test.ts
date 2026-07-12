// Validates that every interactive lesson exercise agrees with the game engine,
// and stress-tests the puzzle generator. Run: npm run test:lessons

import { LESSONS } from './lessons';
import { isWinningHand, waitingTiles } from '../shared/win';
import { toCounts } from '../shared/tiles';
import { genPuzzle } from './Puzzles';

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

function distinctWaitsByDiscard(hand: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const code of new Set(hand)) {
    const rest = [...hand];
    rest.splice(rest.indexOf(code), 1);
    m.set(code, waitingTiles(rest, []));
  }
  return m;
}

for (const lesson of LESSONS) {
  console.log(`Lesson: ${lesson.title}`);
  lesson.steps.forEach((step, si) => {
    const tag = `${lesson.id} step ${si} (${step.kind})`;

    // Any step showing a 13-tile "hand" and asking to pick winning tiles:
    // correct choices must be exactly the engine's waits among the choices.
    if ((step.kind === 'tap' || step.kind === 'multi') && step.rows) {
      const handRow = step.rows.find((r) => r.tiles.length === 13);
      if (handRow) {
        const waits = waitingTiles(handRow.tiles, []);
        check(toCounts(handRow.tiles).every((c) => c <= 4), `${tag}: >4 copies of a tile`);
        step.choices.forEach((c, i) => {
          const shouldWin = step.correct.includes(i);
          check(waits.includes(c) === shouldWin,
            `${tag}: choice ${c} — engine says ${waits.includes(c) ? 'wait' : 'not a wait'}, lesson says ${shouldWin ? 'wait' : 'not'} (waits: ${waits.join(' ')})`);
        });
      }
    }

    // Yes/No "is this a winning hand" checks on 14-tile rows.
    if (step.kind === 'choice' && step.rows) {
      const handRow = step.rows.find((r) => r.tiles.length === 14);
      const isYesNo = step.options.some((o) => /^Yes/.test(o)) && step.options.some((o) => /^No/.test(o));
      if (handRow && isYesNo) {
        const wins = isWinningHand(handRow.tiles, []);
        const lessonSaysYes = step.options[step.correct].startsWith('Yes');
        check(wins === lessonSaysYes, `${tag}: engine says wins=${wins}, lesson answer says ${lessonSaysYes}`);
        check(toCounts(handRow.tiles).every((c) => c <= 4), `${tag}: >4 copies of a tile`);
      }
    }

    // Discard exercises: the correct discard(s) must be the strict best
    // (most distinct waits, and > 0); all other discards strictly worse.
    if (step.kind === 'discard') {
      check(step.hand.length === 14, `${tag}: hand has ${step.hand.length} tiles, want 14`);
      check(toCounts(step.hand).every((c) => c <= 4), `${tag}: >4 copies of a tile`);
      const m = distinctWaitsByDiscard(step.hand);
      const best = Math.max(...[...m.values()].map((w) => w.length));
      check(best > 0, `${tag}: no discard makes the hand ready`);
      for (const [code, waits] of m) {
        const isCorrect = step.correct.includes(code);
        if (isCorrect) {
          check(waits.length === best, `${tag}: "correct" ${code} keeps ${waits.length} waits, best is ${best}`);
        } else {
          check(waits.length < best, `${tag}: ${code} ties the best (${waits.length} waits) but isn't listed as correct`);
        }
      }
    }
  });
}

// Puzzle generator stress test
console.log('Puzzle generator: 500 random puzzles');
let rngState = 42;
const rng = () => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 2 ** 32;
};
for (let i = 0; i < 500; i++) {
  const p = genPuzzle(rng);
  check(p.hand.length === 14, `puzzle ${i}: hand length ${p.hand.length}`);
  check(toCounts(p.hand).every((c) => c <= 4), `puzzle ${i}: >4 copies of a tile`);
  check(!isWinningHand(p.hand, []), `puzzle ${i}: already a winning hand`);
  check(p.bestWaits > 0, `puzzle ${i}: unsolvable`);
  const best = Math.max(...[...p.waitsByDiscard.values()].map((w) => w.length));
  check(best === p.bestWaits, `puzzle ${i}: bestWaits mismatch`);
}

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll lesson & puzzle checks passed ✓');

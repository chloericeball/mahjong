import React, { useMemo, useState } from 'react';
import { Tile } from './Tile';
import { KINDS, SUIT_CODES, toCounts, sortTiles } from '../shared/tiles';
import { isWinningHand, waitingTiles } from '../shared/win';

const STREAK_KEY = 'mj-puzzle-streak';
const BEST_KEY = 'mj-puzzle-best';

export function puzzleBest(): number {
  return Number(localStorage.getItem(BEST_KEY) || 0);
}

interface Puzzle {
  hand: string[]; // 14 codes, unsorted
  waitsByDiscard: Map<string, string[]>;
  bestWaits: number;
}

/** Build a random 14-tile hand that is exactly one good discard away from ready. */
export function genPuzzle(rng: () => number = Math.random): Puzzle {
  for (;;) {
    const codes: string[] = [];
    for (let s = 0; s < 4; s++) {
      if (rng() < 0.62) {
        const suit = SUIT_CODES[Math.floor(rng() * 3)];
        const start = 1 + Math.floor(rng() * 7);
        codes.push(`${suit}${start}`, `${suit}${start + 1}`, `${suit}${start + 2}`);
      } else {
        const k = KINDS[Math.floor(rng() * KINDS.length)];
        codes.push(k, k, k);
      }
    }
    const pk = KINDS[Math.floor(rng() * KINDS.length)];
    codes.push(pk, pk);
    if (toCounts(codes).some((c) => c > 4)) continue;

    // Break the winning hand: swap one random tile for a random stray.
    codes.splice(Math.floor(rng() * codes.length), 1);
    codes.push(KINDS[Math.floor(rng() * KINDS.length)]);
    if (toCounts(codes).some((c) => c > 4)) continue;
    if (isWinningHand(codes, [])) continue; // stray completed it — no puzzle

    const waitsByDiscard = new Map<string, string[]>();
    let bestWaits = 0;
    for (const code of new Set(codes)) {
      const rest = [...codes];
      rest.splice(rest.indexOf(code), 1);
      const w = waitingTiles(rest, []);
      waitsByDiscard.set(code, w);
      bestWaits = Math.max(bestWaits, w.length);
    }
    if (bestWaits === 0) continue; // shouldn't happen, but be safe
    return { hand: codes, waitsByDiscard, bestWaits };
  }
}

export const Puzzles: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [n, setN] = useState(0); // puzzle number, bump to regenerate
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [streak, setStreak] = useState(() => Number(localStorage.getItem(STREAK_KEY) || 0));
  const [best, setBest] = useState(puzzleBest);

  const puzzle = useMemo(() => genPuzzle(), [n]);
  const hand = useMemo(
    () => sortTiles(puzzle.hand.map((code, id) => ({ id, code }))),
    [puzzle],
  );

  const picked = pickedId === null ? null : hand.find((t) => t.id === pickedId)!;
  const pickedWaits = picked ? puzzle.waitsByDiscard.get(picked.code)! : null;
  const solved = pickedWaits !== null && pickedWaits.length === puzzle.bestWaits;

  const bestDiscards = [...puzzle.waitsByDiscard.entries()]
    .filter(([, w]) => w.length === puzzle.bestWaits)
    .map(([code]) => code);
  const bestWaitTiles = puzzle.waitsByDiscard.get(bestDiscards[0])!;

  const pick = (id: number, code: string) => {
    if (pickedId !== null) return;
    setPickedId(id);
    const w = puzzle.waitsByDiscard.get(code)!;
    const ok = w.length === puzzle.bestWaits;
    const s = ok ? streak + 1 : 0;
    setStreak(s);
    localStorage.setItem(STREAK_KEY, String(s));
    if (s > best) { setBest(s); localStorage.setItem(BEST_KEY, String(s)); }
  };

  return (
    <div className="learn-screen">
      <div className="panel-card lesson-card">
        <div className="l-head">
          <button className="close-btn" onClick={onClose}>← Home</button>
          <span className="l-title">🧩 Discard Trainer</span>
          <span className="l-count">🔥 {streak} · best {best}</span>
        </div>

        <div className="l-body">
          <p className="l-prompt">
            Puzzle #{n + 1}: it's your turn with 14 tiles. Tap the discard that leaves
            you <b>ready 聽牌</b> with the widest wait.
          </p>
          <div className="l-choices l-hand">
            {hand.map((t) => (
              <Tile key={t.id} code={t.code} size="md"
                selected={pickedId === t.id}
                onClick={pickedId === null ? () => pick(t.id, t.code) : undefined} />
            ))}
          </div>
        </div>

        {picked && (
          <div className={`l-feedback ${solved ? 'good' : 'bad'}`}>
            {solved ? (
              <span className="fb-tiles">
                ✓ Perfect! Discarding <Tile code={picked.code} size="sm" /> leaves you winning on:
                {pickedWaits!.map((c, i) => <Tile key={i} code={c} size="sm" />)}
              </span>
            ) : (
              <span className="fb-tiles">
                ✗ Discarding <Tile code={picked.code} size="sm" />
                {pickedWaits!.length === 0
                  ? ' leaves you NOT ready.'
                  : <> waits only on: {pickedWaits!.map((c, i) => <Tile key={i} code={c} size="sm" />)}.</>}
                {' '}Better: throw <Tile code={bestDiscards[0]} size="sm" /> to win on:
                {bestWaitTiles.map((c, i) => <Tile key={i} code={c} size="sm" />)}
              </span>
            )}
          </div>
        )}

        <div className="l-nav">
          {picked && (
            <button className="primary" onClick={() => { setN(n + 1); setPickedId(null); }}>
              Next puzzle →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

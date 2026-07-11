import { TileCode, toCounts, KINDS, isSuited, rankOf, isHonor } from './tiles';
import { Meld } from './win';
import { Game, ClaimKind } from './game';

/**
 * Score a concealed hand's structure: complete sets are worth the most, then
 * partial sets (pairs, adjacent tiles, one-gap tiles). Used to compare options.
 */
export function handScore(codes: TileCode[], melds: Meld[]): number {
  const counts = toCounts(codes);
  let best = 0;

  function walk(cnts: number[], i: number, sets: number, partials: number, hasPair: boolean) {
    while (i < 34 && cnts[i] === 0) i++;
    if (i >= 34) {
      const maxSets = 4 - melds.length;
      const s = Math.min(sets, maxSets);
      const p = Math.min(partials, maxSets - s + (hasPair ? 0 : 1));
      const score = s * 100 + p * 30 + (hasPair ? 25 : 0);
      if (score > best) best = score;
      return;
    }
    const code = KINDS[i];
    // triplet
    if (cnts[i] >= 3) {
      cnts[i] -= 3; walk(cnts, i, sets + 1, partials, hasPair); cnts[i] += 3;
    }
    // sequence
    if (isSuited(code) && rankOf(code) <= 7 && cnts[i + 1] > 0 && cnts[i + 2] > 0) {
      cnts[i]--; cnts[i + 1]--; cnts[i + 2]--;
      walk(cnts, i, sets + 1, partials, hasPair);
      cnts[i]++; cnts[i + 1]++; cnts[i + 2]++;
    }
    // pair (as the pair, or as a partial pung)
    if (cnts[i] >= 2) {
      cnts[i] -= 2;
      if (!hasPair) walk(cnts, i, sets, partials, true);
      walk(cnts, i, sets, partials + 1, hasPair);
      cnts[i] += 2;
    }
    // adjacent partial chow
    if (isSuited(code) && rankOf(code) <= 8 && cnts[i + 1] > 0) {
      cnts[i]--; cnts[i + 1]--;
      walk(cnts, i, sets, partials + 1, hasPair);
      cnts[i]++; cnts[i + 1]++;
    }
    // gap partial chow
    if (isSuited(code) && rankOf(code) <= 7 && cnts[i + 2] > 0) {
      cnts[i]--; cnts[i + 2]--;
      walk(cnts, i, sets, partials + 0.8, hasPair);
      cnts[i]++; cnts[i + 2]++;
    }
    // skip this tile (isolated)
    cnts[i]--;
    walk(cnts, i, sets, partials, hasPair);
    cnts[i]++;
  }

  walk([...counts], 0, 0, 0, false);
  return best;
}

/** Small bonus for keeping honors that could become scoring pungs early on. */
function tileKeepBonus(code: TileCode, codes: TileCode[]): number {
  if (isHonor(code)) {
    const n = codes.filter((c) => c === code).length;
    return n >= 2 ? 8 : -6; // lone honors are dead weight
  }
  return 0;
}

/** Choose which tile id to discard. */
export function chooseDiscard(game: Game, seat: number): number {
  const p = game.players[seat];
  const tiles = [...p.hand];
  if (game.drawnTile && game.turn === seat) tiles.push(game.drawnTile);
  let bestId = tiles[tiles.length - 1].id;
  let bestScore = -Infinity;
  for (const t of tiles) {
    const remaining = tiles.filter((x) => x.id !== t.id).map((x) => x.code);
    const s = handScore(remaining, p.melds)
      + remaining.reduce((acc, c) => acc + tileKeepBonus(c, remaining) * 0.01, 0)
      - tileKeepBonus(t.code, tiles.map((x) => x.code)) * 0.5;
    if (s > bestScore) { bestScore = s; bestId = t.id; }
  }
  return bestId;
}

/** Decide whether/how to claim a discard. */
export function chooseClaim(
  game: Game, seat: number, options: ClaimKind[], chowChoices: TileCode[][],
): { kind: ClaimKind | 'pass'; chow?: TileCode[] } {
  if (options.includes('win')) return { kind: 'win' };
  const p = game.players[seat];
  const codes = p.hand.map((t) => t.code);
  const tile = game.lastDiscard!.tile.code;
  const before = handScore(codes, p.melds);

  const evalAfter = (removed: TileCode[]): number => {
    const rest = [...codes];
    for (const r of removed) rest.splice(rest.indexOf(r), 1);
    // after claiming we hold a completed extra set; hand needs one fewer set
    return handScore(rest, [...p.melds, { kind: 'pung', codes: [tile, tile, tile] }]) + 100;
  };

  let best: { kind: ClaimKind | 'pass'; chow?: TileCode[]; score: number } = { kind: 'pass', score: before + 12 };
  if (options.includes('kong')) {
    const s = evalAfter([tile, tile, tile]) + 10; // kong: replacement draw + faan potential
    if (s > best.score) best = { kind: 'kong', score: s };
  }
  if (options.includes('pung')) {
    const s = evalAfter([tile, tile]);
    if (s > best.score) best = { kind: 'pung', score: s };
  }
  if (options.includes('chow')) {
    for (const pair of chowChoices) {
      const s = evalAfter(pair) - 5; // chows are worth slightly less (no faan)
      if (s > best.score) best = { kind: 'chow', chow: pair, score: s };
    }
  }
  return { kind: best.kind, chow: best.chow };
}

/** Decide whether to declare a kong on own turn. */
export function shouldSelfKong(game: Game, seat: number, code: TileCode): boolean {
  const p = game.players[seat];
  const codes = [...p.hand.map((t) => t.code)];
  if (game.drawnTile && game.turn === seat) codes.push(game.drawnTile.code);
  const before = handScore(codes, p.melds);
  const after = handScore(codes.filter((c) => c !== code), [...p.melds, { kind: 'kong', codes: [code, code, code, code] }]) + 100;
  return after + 15 >= before; // kong gives a free draw; lean toward yes
}

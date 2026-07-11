import {
  TileCode, KINDS, KIND_INDEX, toCounts, isSuited, isHonor, suitOf, rankOf, isTerminal,
} from './tiles';

export type MeldKind = 'chow' | 'pung' | 'kong';

export interface Meld {
  kind: MeldKind;
  codes: TileCode[]; // 3 codes for chow/pung, 4 for kong
  concealed?: boolean; // concealed kong
}

/** Tiles eligible for thirteen orphans. */
const ORPHANS = ['d1', 'd9', 'b1', 'b9', 'c1', 'c9', 'wE', 'wS', 'wW', 'wN', 'gR', 'gG', 'gW'];

/** Can `counts` (concealed tiles) fully decompose into `nSets` sets plus one pair? */
function decompose(counts: number[], nSets: number, hasPair: boolean): boolean {
  if (nSets === 0 && hasPair) return counts.every((c) => c === 0);
  let i = counts.findIndex((c) => c > 0);
  if (i === -1) return false;
  // pair
  if (!hasPair && counts[i] >= 2) {
    counts[i] -= 2;
    if (decompose(counts, nSets, true)) { counts[i] += 2; return true; }
    counts[i] += 2;
  }
  if (nSets > 0) {
    // triplet
    if (counts[i] >= 3) {
      counts[i] -= 3;
      if (decompose(counts, nSets - 1, hasPair)) { counts[i] += 3; return true; }
      counts[i] += 3;
    }
    // sequence (only within a suit, ranks 1-7 start)
    const code = KINDS[i];
    if (isSuited(code) && rankOf(code) <= 7 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      counts[i]--; counts[i + 1]--; counts[i + 2]--;
      if (decompose(counts, nSets - 1, hasPair)) {
        counts[i]++; counts[i + 1]++; counts[i + 2]++;
        return true;
      }
      counts[i]++; counts[i + 1]++; counts[i + 2]++;
    }
  }
  return false;
}

export function isThirteenOrphans(concealed: TileCode[]): boolean {
  if (concealed.length !== 14) return false;
  const set = new Set(concealed);
  return ORPHANS.every((t) => set.has(t)) && concealed.every((t) => ORPHANS.includes(t));
}

/**
 * Is this a winning hand? `concealed` are hand tiles including the winning tile;
 * melds are exposed sets. concealed.length must be 14 - 3*melds.length.
 */
export function isWinningHand(concealed: TileCode[], melds: Meld[]): boolean {
  if (concealed.length !== 14 - 3 * melds.length) return false;
  if (melds.length === 0 && isThirteenOrphans(concealed)) return true;
  const counts = toCounts(concealed);
  return decompose(counts, 4 - melds.length, false);
}

/** All distinct decompositions found for scoring: returns one representative decomposition. */
interface Decomp {
  sets: { kind: 'chow' | 'pung'; codes: TileCode[] }[];
  pair: TileCode;
}

function findDecomp(counts: number[], nSets: number): Decomp | null {
  function helper(cnts: number[], remaining: number, pair: TileCode | null, acc: Decomp['sets']): Decomp | null {
    const i = cnts.findIndex((c) => c > 0);
    if (i === -1) return remaining === 0 && pair ? { sets: [...acc], pair } : null;
    if (!pair && cnts[i] >= 2) {
      cnts[i] -= 2;
      const r = helper(cnts, remaining, KINDS[i], acc);
      cnts[i] += 2;
      if (r) return r;
    }
    if (remaining > 0) {
      if (cnts[i] >= 3) {
        cnts[i] -= 3;
        acc.push({ kind: 'pung', codes: [KINDS[i], KINDS[i], KINDS[i]] });
        const r = helper(cnts, remaining - 1, pair, acc);
        acc.pop(); cnts[i] += 3;
        if (r) return r;
      }
      const code = KINDS[i];
      if (isSuited(code) && rankOf(code) <= 7 && cnts[i + 1] > 0 && cnts[i + 2] > 0) {
        cnts[i]--; cnts[i + 1]--; cnts[i + 2]--;
        acc.push({ kind: 'chow', codes: [KINDS[i], KINDS[i + 1], KINDS[i + 2]] });
        const r = helper(cnts, remaining - 1, pair, acc);
        acc.pop(); cnts[i]++; cnts[i + 1]++; cnts[i + 2]++;
        if (r) return r;
      }
    }
    return null;
  }
  return helper([...counts], nSets, null, []);
}

export interface WinContext {
  selfDrawn: boolean;
  seatWind: TileCode;  // e.g. 'wE'
  roundWind: TileCode;
  flowers: TileCode[]; // this player's exposed flowers
  seatIndex: number;   // 0..3 (E=0), for flower matching
  lastTileOfWall?: boolean;
  wonOnKongReplacement?: boolean;
}

export interface ScoreResult {
  faan: number;
  elements: { name: string; faan: number }[];
}

const FAAN_CAP = 13;

/** Hong Kong faan scoring. */
export function scoreHand(concealed: TileCode[], melds: Meld[], ctx: WinContext): ScoreResult {
  const elements: { name: string; faan: number }[] = [];
  const add = (name: string, faan: number) => elements.push({ name, faan });

  const allCodes = [...concealed, ...melds.flatMap((m) => m.codes)];

  // Limit hands first
  if (melds.length === 0 && isThirteenOrphans(concealed)) {
    add('Thirteen Orphans 十三么', FAAN_CAP);
    return finish();
  }

  const counts = toCounts(concealed);
  const decomp = findDecomp(counts, 4 - melds.length);
  const allSets = [
    ...(decomp?.sets ?? []),
    ...melds.map((m) => ({ kind: m.kind === 'chow' ? 'chow' as const : 'pung' as const, codes: m.codes.slice(0, 3) })),
  ];
  const pair = decomp?.pair;

  const suits = new Set(allCodes.filter(isSuited).map(suitOf));
  const hasHonors = allCodes.some(isHonor);

  const allPungs = allSets.length === 4 && allSets.every((s) => s.kind === 'pung');
  const allChows = allSets.length === 4 && allSets.every((s) => s.kind === 'chow');

  // Suit-based
  if (suits.size === 0 && hasHonors) {
    add('All Honors 字一色', FAAN_CAP);
    return finish();
  }
  const orphanPungs = allSets.every((s) => s.kind === 'pung' && isTerminal(s.codes[0])) && pair && isTerminal(pair) && !hasHonors;
  if (allSets.length === 4 && orphanPungs) {
    add('All Terminals 清么九', FAAN_CAP);
    return finish();
  }

  // Dragon pungs
  const pungCodes = allSets.filter((s) => s.kind === 'pung').map((s) => s.codes[0]);
  const dragonPungs = pungCodes.filter((c) => c.startsWith('g'));
  if (dragonPungs.length === 3) {
    add('Great Dragons 大三元', 8);
  } else if (dragonPungs.length === 2 && pair && pair.startsWith('g')) {
    add('Small Dragons 小三元', 5);
  } else {
    for (const c of dragonPungs) add(`Dragon Pung (${c === 'gR' ? '中' : c === 'gG' ? '發' : '白'})`, 1);
  }

  // Wind pungs
  const windPungs = pungCodes.filter((c) => c.startsWith('w'));
  if (windPungs.length === 4) {
    add('Great Winds 大四喜', FAAN_CAP);
    return finish();
  }
  if (windPungs.length === 3 && pair && pair.startsWith('w')) {
    add('Small Winds 小四喜', 6);
  } else {
    for (const c of windPungs) {
      if (c === ctx.seatWind) add('Seat Wind', 1);
      if (c === ctx.roundWind) add('Round Wind', 1);
    }
  }

  if (suits.size === 1 && !hasHonors) add('Pure One Suit 清一色', 7);
  else if (suits.size === 1 && hasHonors) add('Mixed One Suit 混一色', 3);

  if (allPungs) add('All Pungs 對對糊', 3);
  if (allChows && !hasHonors && ctx.flowers.length === 0) add('Common Hand 平糊', 1);

  // Flowers: matching own seat flower/season = 1 each; no flowers = 1
  if (ctx.flowers.length === 0) {
    add('No Flowers', 1);
  } else {
    const seatNum = ctx.seatIndex + 1;
    for (const f of ctx.flowers) {
      const n = Number(f[1]);
      if (n === seatNum || n === seatNum + 4) add(`Seat Flower (${f})`, 1);
    }
    if (ctx.flowers.length === 8) { add('All Eight Flowers', FAAN_CAP); return finish(); }
  }

  if (ctx.selfDrawn) add('Self Draw 自摸', 1);
  if (melds.filter((m) => !(m.kind === 'kong' && m.concealed)).length === 0) add('Fully Concealed 門前清', 1);
  if (ctx.lastTileOfWall) add('Last Tile 海底撈月', 1);
  if (ctx.wonOnKongReplacement) add('Won on Kong 槓上開花', 1);

  return finish();

  function finish(): ScoreResult {
    const faan = Math.min(FAAN_CAP, elements.reduce((s, e) => s + e.faan, 0));
    return { faan, elements };
  }
}

/** Which tile codes would complete this hand? (concealed has 13 - 3*melds tiles) */
export function waitingTiles(concealed: TileCode[], melds: Meld[]): TileCode[] {
  const waits: TileCode[] = [];
  for (const kind of KINDS) {
    if (concealed.filter((c) => c === kind).length >= 4) continue;
    if (isWinningHand([...concealed, kind], melds)) waits.push(kind);
  }
  return waits;
}

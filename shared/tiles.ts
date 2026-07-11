// Tile codes:
//   d1-d9  dots (circles/筒)
//   b1-b9  bamboo (索)
//   c1-c9  characters (萬)
//   wE wS wW wN  winds
//   gR gG gW  dragons (red 中, green 發, white 白)
//   f1-f8  flowers/seasons (f1-f4 flowers, f5-f8 seasons)

export type TileCode = string;

export interface Tile {
  id: number; // unique 0..143
  code: TileCode;
}

export const SUIT_CODES = ['d', 'b', 'c'] as const;
export const WIND_CODES = ['wE', 'wS', 'wW', 'wN'] as const;
export const DRAGON_CODES = ['gR', 'gG', 'gW'] as const;

// The 34 distinct playable tile kinds, in canonical index order.
export const KINDS: TileCode[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `d${n}`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `b${n}`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `c${n}`),
  ...WIND_CODES,
  ...DRAGON_CODES,
];

export const KIND_INDEX: Record<TileCode, number> = Object.fromEntries(
  KINDS.map((k, i) => [k, i]),
);

export function isFlower(code: TileCode): boolean {
  return code.startsWith('f');
}

export function isHonor(code: TileCode): boolean {
  return code.startsWith('w') || code.startsWith('g');
}

export function isSuited(code: TileCode): boolean {
  return code[0] === 'd' || code[0] === 'b' || code[0] === 'c';
}

export function suitOf(code: TileCode): string {
  return code[0];
}

export function rankOf(code: TileCode): number {
  return isSuited(code) ? Number(code[1]) : 0;
}

export function isTerminal(code: TileCode): boolean {
  const r = rankOf(code);
  return r === 1 || r === 9;
}

/** Build the full 144-tile wall, shuffled. */
export function buildWall(rng: () => number = Math.random): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (const kind of KINDS) {
    for (let i = 0; i < 4; i++) tiles.push({ id: id++, code: kind });
  }
  for (let n = 1; n <= 8; n++) tiles.push({ id: id++, code: `f${n}` });
  // Fisher-Yates
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/** Convert a list of tile codes into a 34-length count array. Flowers ignored. */
export function toCounts(codes: TileCode[]): number[] {
  const counts = new Array(34).fill(0);
  for (const c of codes) {
    const idx = KIND_INDEX[c];
    if (idx !== undefined) counts[idx]++;
  }
  return counts;
}

/** Sort order for displaying a hand. */
export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const ia = KIND_INDEX[a.code] ?? 100 + Number(a.code.slice(1));
    const ib = KIND_INDEX[b.code] ?? 100 + Number(b.code.slice(1));
    return ia - ib || a.id - b.id;
  });
}

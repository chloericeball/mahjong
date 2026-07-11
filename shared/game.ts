import { Tile, TileCode, buildWall, isFlower, sortTiles, WIND_CODES } from './tiles';
import { Meld, isWinningHand, scoreHand, ScoreResult, WinContext } from './win';

export type Phase =
  | 'dealing'
  | 'discard'   // current player holds an extra tile and must discard (or kong/win)
  | 'claiming'  // a discard is on the table; others may claim
  | 'handEnd';

export interface PlayerState {
  name: string;
  isBot: boolean;
  connected: boolean;
  hand: Tile[];      // concealed tiles
  melds: Meld[];
  flowers: TileCode[];
  discards: TileCode[];
  score: number;
}

export type ClaimKind = 'win' | 'kong' | 'pung' | 'chow';

export interface PendingClaim {
  seat: number;
  options: ClaimKind[];
  chowChoices: TileCode[][]; // possible chow tile-pairs from hand
  response?: { kind: ClaimKind | 'pass'; chow?: TileCode[] };
}

export interface HandResult {
  type: 'win' | 'draw';
  winner?: number;
  loser?: number; // discarder, if win by discard
  score?: ScoreResult;
  payments?: number[]; // delta per seat
  winningHand?: { concealed: TileCode[]; melds: Meld[]; flowers: TileCode[] };
}

export interface GameEvent {
  type: string;
  [k: string]: unknown;
}

const CLAIM_PRIORITY: Record<ClaimKind, number> = { win: 3, kong: 2, pung: 2, chow: 1 };

export class Game {
  players: PlayerState[];
  wall: Tile[] = [];
  phase: Phase = 'dealing';
  turn = 0;              // seat whose turn it is
  dealer = 0;
  roundWind = 0;         // 0..3 index into WIND_CODES
  handNumber = 0;
  lastDiscard: { tile: Tile; seat: number } | null = null;
  pendingClaims: PendingClaim[] = [];
  drawnTile: Tile | null = null; // the tile just drawn by `turn` player
  lastResult: HandResult | null = null;
  justKonged = false;    // current pending discard follows a kong replacement draw
  events: GameEvent[] = [];

  constructor(names: { name: string; isBot: boolean }[]) {
    this.players = names.map((n) => ({
      name: n.name, isBot: n.isBot, connected: true,
      hand: [], melds: [], flowers: [], discards: [], score: 0,
    }));
  }

  emit(e: GameEvent) { this.events.push(e); }
  takeEvents(): GameEvent[] { const e = this.events; this.events = []; return e; }

  seatWind(seat: number): TileCode {
    return WIND_CODES[(seat - this.dealer + 4) % 4];
  }

  startHand() {
    this.wall = buildWall();
    this.lastDiscard = null;
    this.pendingClaims = [];
    this.lastResult = null;
    this.justKonged = false;
    for (const p of this.players) {
      p.hand = []; p.melds = []; p.flowers = []; p.discards = [];
    }
    // deal 13 to everyone
    for (let r = 0; r < 13; r++) {
      for (let s = 0; s < 4; s++) {
        const seat = (this.dealer + s) % 4;
        this.players[seat].hand.push(this.wall.pop()!);
      }
    }
    // replace flowers
    for (let s = 0; s < 4; s++) this.replaceFlowers((this.dealer + s) % 4);
    // dealer draws 14th
    this.turn = this.dealer;
    this.phase = 'discard';
    this.drawnTile = this.drawClean(this.dealer);
    this.emit({ type: 'handStart', dealer: this.dealer, round: this.roundWind, hand: this.handNumber });
  }

  private replaceFlowers(seat: number) {
    const p = this.players[seat];
    let found = true;
    while (found) {
      found = false;
      for (let i = 0; i < p.hand.length; i++) {
        if (isFlower(p.hand[i].code)) {
          p.flowers.push(p.hand[i].code);
          this.emit({ type: 'flower', seat, code: p.hand[i].code });
          p.hand.splice(i, 1);
          const t = this.wall.shift(); // replacement from back of wall
          if (t) p.hand.push(t);
          found = true;
          break;
        }
      }
    }
    p.hand = sortTiles(p.hand);
  }

  /** Draw for a seat, auto-replacing flowers. Returns the drawn tile or null (wall empty). */
  private drawClean(seat: number, fromBack = false): Tile | null {
    const p = this.players[seat];
    while (true) {
      const t = fromBack ? this.wall.shift() : this.wall.pop();
      if (!t) return null;
      if (isFlower(t.code)) {
        p.flowers.push(t.code);
        this.emit({ type: 'flower', seat, code: t.code });
        continue;
      }
      return t;
    }
  }

  concealedCodes(seat: number, includeDrawn: boolean): TileCode[] {
    const codes = this.players[seat].hand.map((t) => t.code);
    if (includeDrawn && this.drawnTile && this.turn === seat) codes.push(this.drawnTile.code);
    return codes;
  }

  /** Actions available to the current player in 'discard' phase. */
  selfActions(seat: number): { canWin: boolean; kongs: TileCode[] } {
    if (this.phase !== 'discard' || this.turn !== seat) return { canWin: false, kongs: [] };
    const codes = this.concealedCodes(seat, true);
    const canWin = isWinningHand(codes, this.players[seat].melds);
    const kongs: TileCode[] = [];
    const countMap: Record<string, number> = {};
    for (const c of codes) countMap[c] = (countMap[c] || 0) + 1;
    for (const [c, n] of Object.entries(countMap)) if (n === 4) kongs.push(c);
    // added kong: drawn/held tile matches an existing pung meld
    for (const m of this.players[seat].melds) {
      if (m.kind === 'pung' && codes.includes(m.codes[0])) kongs.push(m.codes[0]);
    }
    return { canWin, kongs: [...new Set(kongs)] };
  }

  /** Player discards a tile (by tile id, from hand or the drawn tile). */
  discard(seat: number, tileId: number): boolean {
    if (this.phase !== 'discard' || this.turn !== seat) return false;
    const p = this.players[seat];
    let tile: Tile | null = null;
    if (this.drawnTile && this.drawnTile.id === tileId) {
      tile = this.drawnTile;
      this.drawnTile = null;
    } else {
      const idx = p.hand.findIndex((t) => t.id === tileId);
      if (idx === -1) return false;
      tile = p.hand.splice(idx, 1)[0];
      if (this.drawnTile) { p.hand.push(this.drawnTile); this.drawnTile = null; }
    }
    p.hand = sortTiles(p.hand);
    p.discards.push(tile.code);
    this.lastDiscard = { tile, seat };
    this.justKonged = false;
    this.emit({ type: 'discard', seat, code: tile.code });
    this.computeClaims();
    if (this.pendingClaims.length === 0) this.advanceTurn();
    else this.phase = 'claiming';
    return true;
  }

  private computeClaims() {
    this.pendingClaims = [];
    if (!this.lastDiscard) return;
    const { tile, seat: from } = this.lastDiscard;
    for (let s = 0; s < 4; s++) {
      if (s === from) continue;
      const p = this.players[s];
      const codes = p.hand.map((t) => t.code);
      const options: ClaimKind[] = [];
      const chowChoices: TileCode[][] = [];
      if (isWinningHand([...codes, tile.code], p.melds)) options.push('win');
      const same = codes.filter((c) => c === tile.code).length;
      if (same >= 2) options.push('pung');
      if (same >= 3) options.push('kong');
      if (s === (from + 1) % 4 && tile.code[0].match(/[dbc]/) && !tile.code.startsWith('w') && !tile.code.startsWith('g')) {
        const suit = tile.code[0];
        const r = Number(tile.code[1]);
        const has = (n: number) => n >= 1 && n <= 9 && codes.includes(`${suit}${n}`);
        if (has(r - 2) && has(r - 1)) chowChoices.push([`${suit}${r - 2}`, `${suit}${r - 1}`]);
        if (has(r - 1) && has(r + 1)) chowChoices.push([`${suit}${r - 1}`, `${suit}${r + 1}`]);
        if (has(r + 1) && has(r + 2)) chowChoices.push([`${suit}${r + 1}`, `${suit}${r + 2}`]);
        if (chowChoices.length > 0) options.push('chow');
      }
      if (options.length > 0) this.pendingClaims.push({ seat: s, options, chowChoices });
    }
  }

  /** Record a claim response. Returns true if all claims are now resolved. */
  respondClaim(seat: number, kind: ClaimKind | 'pass', chow?: TileCode[]): boolean {
    const pc = this.pendingClaims.find((c) => c.seat === seat);
    if (!pc || pc.response) return false;
    if (kind !== 'pass' && !pc.options.includes(kind)) return false;
    pc.response = { kind, chow };
    if (this.pendingClaims.every((c) => c.response)) {
      this.resolveClaims();
      return true;
    }
    return false;
  }

  private resolveClaims() {
    const responded = this.pendingClaims.filter((c) => c.response && c.response.kind !== 'pass');
    this.pendingClaims = [];
    if (responded.length === 0) { this.advanceTurn(); return; }
    // priority: win > pung/kong > chow; ties (multiple wins) -> nearest after discarder
    const from = this.lastDiscard!.seat;
    responded.sort((a, b) => {
      const pa = CLAIM_PRIORITY[a.response!.kind as ClaimKind];
      const pb = CLAIM_PRIORITY[b.response!.kind as ClaimKind];
      if (pa !== pb) return pb - pa;
      return ((a.seat - from + 4) % 4) - ((b.seat - from + 4) % 4);
    });
    const winner = responded[0];
    const kind = winner.response!.kind as ClaimKind;
    const { tile } = this.lastDiscard!;
    const p = this.players[winner.seat];
    // remove tile from discarder's pile (it's claimed)
    const dp = this.players[from].discards;
    if (dp[dp.length - 1] === tile.code) dp.pop();

    if (kind === 'win') {
      this.finishWin(winner.seat, tile.code, false);
      return;
    }

    const takeFromHand = (code: TileCode, n: number): Tile[] => {
      const taken: Tile[] = [];
      for (let i = p.hand.length - 1; i >= 0 && taken.length < n; i--) {
        if (p.hand[i].code === code) taken.push(...p.hand.splice(i, 1));
      }
      return taken;
    };

    if (kind === 'pung') {
      takeFromHand(tile.code, 2);
      p.melds.push({ kind: 'pung', codes: [tile.code, tile.code, tile.code] });
      this.emit({ type: 'claim', kind: 'pung', seat: winner.seat, code: tile.code, from });
      this.turn = winner.seat;
      this.phase = 'discard';
      this.drawnTile = null;
      this.lastDiscard = null;
    } else if (kind === 'kong') {
      takeFromHand(tile.code, 3);
      p.melds.push({ kind: 'kong', codes: [tile.code, tile.code, tile.code, tile.code] });
      this.emit({ type: 'claim', kind: 'kong', seat: winner.seat, code: tile.code, from });
      this.turn = winner.seat;
      this.lastDiscard = null;
      this.drawKongReplacement(winner.seat);
    } else { // chow
      const pair = winner.response!.chow ?? winner.chowChoices[0];
      const used: TileCode[] = [];
      for (const c of pair) used.push(...takeFromHand(c, 1).map((t) => t.code));
      p.melds.push({ kind: 'chow', codes: [tile.code, ...pair].sort() });
      this.emit({ type: 'claim', kind: 'chow', seat: winner.seat, code: tile.code, from });
      this.turn = winner.seat;
      this.phase = 'discard';
      this.drawnTile = null;
      this.lastDiscard = null;
    }
    p.hand = sortTiles(p.hand);
  }

  private advanceTurn() {
    this.turn = (this.turn + 1) % 4;
    this.lastDiscard = this.lastDiscard; // stays visible in discard pile
    const t = this.drawClean(this.turn);
    if (!t) { this.finishDraw(); return; }
    this.drawnTile = t;
    this.phase = 'discard';
    this.emit({ type: 'draw', seat: this.turn, wallCount: this.wall.length });
  }

  /** Declare kong from 'discard' phase (concealed or added). */
  declareKong(seat: number, code: TileCode): boolean {
    if (this.phase !== 'discard' || this.turn !== seat) return false;
    const p = this.players[seat];
    const all: Tile[] = [...p.hand];
    if (this.drawnTile) all.push(this.drawnTile);
    const matching = all.filter((t) => t.code === code);
    const pungMeld = p.melds.find((m) => m.kind === 'pung' && m.codes[0] === code);

    if (matching.length === 4) {
      // concealed kong
      p.hand = p.hand.filter((t) => t.code !== code);
      if (this.drawnTile?.code === code) this.drawnTile = null;
      if (this.drawnTile) { p.hand.push(this.drawnTile); this.drawnTile = null; }
      p.melds.push({ kind: 'kong', codes: [code, code, code, code], concealed: true });
      this.emit({ type: 'kong', seat, code, concealed: true });
    } else if (pungMeld && matching.length >= 1) {
      // added kong
      const idx = this.drawnTile?.code === code
        ? -1
        : p.hand.findIndex((t) => t.code === code);
      if (this.drawnTile?.code === code) this.drawnTile = null;
      else if (idx >= 0) p.hand.splice(idx, 1);
      else return false;
      if (this.drawnTile) { p.hand.push(this.drawnTile); this.drawnTile = null; }
      pungMeld.kind = 'kong';
      pungMeld.codes = [code, code, code, code];
      this.emit({ type: 'kong', seat, code, concealed: false });
    } else {
      return false;
    }
    p.hand = sortTiles(p.hand);
    this.drawKongReplacement(seat);
    return true;
  }

  private drawKongReplacement(seat: number) {
    const t = this.drawClean(seat, true);
    if (!t) { this.finishDraw(); return; }
    this.drawnTile = t;
    this.phase = 'discard';
    this.justKonged = true;
    this.emit({ type: 'draw', seat, wallCount: this.wall.length, fromBack: true });
  }

  /** Declare win from own turn (self-draw). */
  declareSelfWin(seat: number): boolean {
    if (this.phase !== 'discard' || this.turn !== seat) return false;
    const codes = this.concealedCodes(seat, true);
    if (!isWinningHand(codes, this.players[seat].melds)) return false;
    this.finishWin(seat, null, true);
    return true;
  }

  private finishWin(seat: number, discardCode: TileCode | null, selfDrawn: boolean) {
    const p = this.players[seat];
    const concealed = selfDrawn
      ? this.concealedCodes(seat, true)
      : [...p.hand.map((t) => t.code), discardCode!];
    const ctx: WinContext = {
      selfDrawn,
      seatWind: this.seatWind(seat),
      roundWind: WIND_CODES[this.roundWind],
      flowers: p.flowers,
      seatIndex: (seat - this.dealer + 4) % 4,
      lastTileOfWall: this.wall.length === 0,
      wonOnKongReplacement: selfDrawn && this.justKonged,
    };
    const score = scoreHand(concealed, p.melds, ctx);
    const base = Math.pow(2, Math.min(score.faan, 10));
    const payments = [0, 0, 0, 0];
    if (selfDrawn) {
      for (let s = 0; s < 4; s++) if (s !== seat) { payments[s] -= base; payments[seat] += base; }
    } else {
      const loser = this.lastDiscard!.seat;
      payments[loser] -= base * 3;
      payments[seat] += base * 3;
    }
    for (let s = 0; s < 4; s++) this.players[s].score += payments[s];
    this.lastResult = {
      type: 'win',
      winner: seat,
      loser: selfDrawn ? undefined : this.lastDiscard!.seat,
      score,
      payments,
      winningHand: { concealed: [...concealed].sort(), melds: p.melds, flowers: p.flowers },
    };
    this.phase = 'handEnd';
    this.emit({ type: 'win', seat, selfDrawn, faan: score.faan });
    // dealer repeats if dealer won
    if (seat !== this.dealer) this.rotateDealer();
    this.handNumber++;
  }

  private finishDraw() {
    this.lastResult = { type: 'draw' };
    this.phase = 'handEnd';
    this.emit({ type: 'drawGame' });
    this.handNumber++;
    // dealer repeats on draw (goulash) — no rotation
  }

  private rotateDealer() {
    this.dealer = (this.dealer + 1) % 4;
    if (this.dealer === 0) this.roundWind = (this.roundWind + 1) % 4;
  }
}

import http from 'http';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { Game, ClaimKind } from '../shared/game';
import { chooseDiscard, chooseClaim, shouldSelfKong } from '../shared/ai';
import { sortTiles, WIND_CODES } from '../shared/tiles';
import { waitingTiles } from '../shared/win';

const PORT = Number(process.env.PORT) || 3001;
const BOT_NAMES = ['Bot Mei', 'Bot Ho', 'Bot Ling', 'Bot Chan'];
const CLAIM_TIMEOUT_MS = 12_000;
const BOT_DELAY_MS = 900;

interface Seat {
  ws: WebSocket | null;
  name: string;
  isBot: boolean;
  coach?: boolean;
}

interface Room {
  code: string;
  seats: Seat[];
  game: Game | null;
  hostSeat: number;
  claimTimer: NodeJS.Timeout | null;
  botTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, Room>();
const clientRoom = new Map<WebSocket, { room: Room; seat: number }>();

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws: WebSocket | null, msg: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/** Build the personalized view of the game for one seat. */
function viewFor(room: Room, seat: number) {
  const g = room.game;
  if (!g) {
    return {
      type: 'state',
      code: room.code,
      seat,
      started: false,
      players: room.seats.map((s, i) => s ? { name: s.name, isBot: s.isBot, connected: s.isBot || !!s.ws, seat: i } : null),
      hostSeat: room.hostSeat,
    };
  }
  const p = g.players[seat];
  const isMyTurn = g.turn === seat && g.phase === 'discard';
  const acts = g.selfActions(seat);
  const myClaim = g.phase === 'claiming' ? g.pendingClaims.find((c) => c.seat === seat && !c.response) : null;

  // Coach hints for beginners
  let hint: Record<string, unknown> | null = null;
  if (room.seats[seat]?.coach && g.phase !== 'handEnd') {
    hint = {};
    const handCodes = p.hand.map((t) => t.code);
    if (isMyTurn && !acts.canWin) {
      const discardId = chooseDiscard(g, seat);
      hint.discardId = discardId;
      const all = [...p.hand, ...(g.drawnTile ? [g.drawnTile] : [])];
      const after = all.filter((t) => t.id !== discardId).map((t) => t.code);
      hint.waitsAfter = waitingTiles(after, p.melds);
    } else if (!isMyTurn) {
      hint.waits = waitingTiles(handCodes, p.melds);
    }
    if (myClaim) {
      const advice = chooseClaim(g, seat, myClaim.options, myClaim.chowChoices);
      hint.claimAdvice = advice.kind;
      if (advice.chow) hint.claimChow = advice.chow;
    }
  }

  return {
    type: 'state',
    code: room.code,
    seat,
    started: true,
    phase: g.phase,
    turn: g.turn,
    dealer: g.dealer,
    roundWind: WIND_CODES[g.roundWind],
    seatWinds: [0, 1, 2, 3].map((s) => g.seatWind(s)),
    wallCount: g.wall.length,
    hand: sortTiles(p.hand).map((t) => ({ id: t.id, code: t.code })),
    drawn: isMyTurn && g.drawnTile ? { id: g.drawnTile.id, code: g.drawnTile.code } : null,
    canWin: isMyTurn && acts.canWin,
    kongs: isMyTurn ? acts.kongs : [],
    claim: myClaim ? { options: myClaim.options, chowChoices: myClaim.chowChoices } : null,
    hint,
    lastDiscard: g.lastDiscard ? { code: g.lastDiscard.tile.code, seat: g.lastDiscard.seat } : null,
    players: g.players.map((pl, i) => ({
      name: pl.name,
      isBot: pl.isBot,
      connected: pl.isBot || !!room.seats[i]?.ws,
      seat: i,
      handCount: pl.hand.length + (g.turn === i && g.drawnTile ? 1 : 0),
      melds: pl.melds,
      flowers: pl.flowers,
      discards: pl.discards,
      score: pl.score,
    })),
    result: g.lastResult ? {
      ...g.lastResult,
      winnerName: g.lastResult.winner !== undefined ? g.players[g.lastResult.winner].name : undefined,
      loserName: g.lastResult.loser !== undefined ? g.players[g.lastResult.loser].name : undefined,
    } : null,
    hostSeat: room.hostSeat,
  };
}

function broadcast(room: Room) {
  room.seats.forEach((s, i) => { if (s && !s.isBot) send(s.ws, viewFor(room, i)); });
}

function broadcastEvents(room: Room) {
  const events = room.game?.takeEvents() ?? [];
  if (events.length === 0) return;
  room.seats.forEach((s) => {
    if (s && !s.isBot) for (const e of events) send(s.ws, { type: 'event', event: e });
  });
}

/** Run bot actions until a human needs to act (with small delays for pacing). */
function pumpBots(room: Room) {
  const g = room.game;
  if (!g) return;
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }

  if (g.phase === 'claiming') {
    // bots respond immediately; humans get a timeout
    let resolved = false;
    for (const pc of [...g.pendingClaims]) {
      if (pc.response) continue;
      const seatInfo = room.seats[pc.seat];
      if (seatInfo?.isBot || !seatInfo?.ws) {
        const d = chooseClaim(g, pc.seat, pc.options, pc.chowChoices);
        resolved = g.respondClaim(pc.seat, d.kind, d.chow) || resolved;
      }
    }
    broadcastEvents(room);
    broadcast(room);
    if (resolved || (g.phase as string) !== 'claiming') { schedulePump(room); return; }
    // still waiting on humans — arm timeout
    if (!room.claimTimer && g.phase === 'claiming') {
      room.claimTimer = setTimeout(() => {
        room.claimTimer = null;
        for (const pc of [...g.pendingClaims]) if (!pc.response) g.respondClaim(pc.seat, 'pass');
        broadcastEvents(room);
        broadcast(room);
        schedulePump(room);
      }, CLAIM_TIMEOUT_MS);
    }
    return;
  }

  if (room.claimTimer) { clearTimeout(room.claimTimer); room.claimTimer = null; }

  if (g.phase === 'discard') {
    const seat = g.turn;
    const seatInfo = room.seats[seat];
    if (seatInfo?.isBot || !seatInfo?.ws) {
      room.botTimer = setTimeout(() => {
        room.botTimer = null;
        const acts = g.selfActions(seat);
        if (acts.canWin) g.declareSelfWin(seat);
        else {
          const kong = acts.kongs.find((k) => shouldSelfKong(g, seat, k));
          if (kong) g.declareKong(seat, kong);
          else g.discard(seat, chooseDiscard(g, seat));
        }
        broadcastEvents(room);
        broadcast(room);
        schedulePump(room);
      }, BOT_DELAY_MS);
    }
  }
}

function schedulePump(room: Room) {
  setTimeout(() => pumpBots(room), 30);
}

function startGame(room: Room) {
  // fill empty seats with bots
  let b = 0;
  for (let i = 0; i < 4; i++) {
    if (!room.seats[i]) room.seats[i] = { ws: null, name: BOT_NAMES[b++], isBot: true };
  }
  const existing = room.game;
  room.game = new Game(room.seats.map((s) => ({ name: s.name, isBot: s.isBot })));
  if (existing) {
    // carry over scores / dealer across hands
    room.game.dealer = existing.dealer;
    room.game.roundWind = existing.roundWind;
    room.game.handNumber = existing.handNumber;
    existing.players.forEach((p, i) => { room.game!.players[i].score = p.score; });
  }
  room.game.startHand();
  broadcastEvents(room);
  broadcast(room);
  schedulePump(room);
}

function handleMessage(ws: WebSocket, raw: string) {
  let msg: any;
  try { msg = JSON.parse(raw); } catch { return; }
  const ctx = clientRoom.get(ws);

  if (msg.type === 'create') {
    const room: Room = { code: makeCode(), seats: [], game: null, hostSeat: 0, claimTimer: null, botTimer: null };
    room.seats[0] = { ws, name: String(msg.name || 'Player').slice(0, 16), isBot: false };
    rooms.set(room.code, room);
    clientRoom.set(ws, { room, seat: 0 });
    if (msg.solo) startGame(room);
    else broadcast(room);
    return;
  }

  if (msg.type === 'join') {
    const room = rooms.get(String(msg.code || '').toUpperCase());
    if (!room) { send(ws, { type: 'error', message: 'Room not found' }); return; }
    // rejoin a bot-substituted or empty human seat if game started
    let seat = -1;
    if (room.game) {
      seat = room.seats.findIndex((s) => s && !s.isBot && !s.ws);
      if (seat === -1) { send(ws, { type: 'error', message: 'Game already started and full' }); return; }
      room.seats[seat].ws = ws;
      room.seats[seat].name = String(msg.name || room.seats[seat].name).slice(0, 16);
      room.game.players[seat].name = room.seats[seat].name;
    } else {
      for (let i = 0; i < 4; i++) if (!room.seats[i]) { seat = i; break; }
      if (seat === -1) { send(ws, { type: 'error', message: 'Room is full' }); return; }
      room.seats[seat] = { ws, name: String(msg.name || 'Player').slice(0, 16), isBot: false };
    }
    clientRoom.set(ws, { room, seat });
    broadcast(room);
    return;
  }

  if (!ctx) return;
  const { room, seat } = ctx;
  const g = room.game;

  switch (msg.type) {
    case 'coach':
      if (room.seats[seat]) {
        room.seats[seat].coach = !!msg.on;
        send(ws, viewFor(room, seat));
      }
      break;
    case 'start':
      if (seat === room.hostSeat && !room.game) startGame(room);
      break;
    case 'nextHand':
      if (g && g.phase === 'handEnd') {
        g.startHand();
        broadcastEvents(room);
        broadcast(room);
        schedulePump(room);
      }
      break;
    case 'discard':
      if (g && g.discard(seat, Number(msg.tileId))) {
        broadcastEvents(room); broadcast(room); pumpBots(room);
      }
      break;
    case 'selfWin':
      if (g && g.declareSelfWin(seat)) { broadcastEvents(room); broadcast(room); }
      break;
    case 'kong':
      if (g && g.declareKong(seat, String(msg.code))) {
        broadcastEvents(room); broadcast(room); pumpBots(room);
      }
      break;
    case 'claim':
      if (g && g.phase === 'claiming') {
        const kind = msg.kind as ClaimKind | 'pass';
        g.respondClaim(seat, kind, msg.chow);
        broadcastEvents(room); broadcast(room);
        if ((g.phase as string) !== 'claiming' && room.claimTimer) {
          clearTimeout(room.claimTimer); room.claimTimer = null;
        }
        pumpBots(room);
      }
      break;
  }
}

// HTTP server: serves the built client (dist/) in production, plus the /ws endpoint.
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2',
};

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = (req.url || '/').split('?')[0];
    let file = path.normalize(path.join(DIST, url === '/' ? 'index.html' : url));
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    let data: Buffer;
    try {
      data = await fsp.readFile(file);
    } catch {
      file = path.join(DIST, 'index.html'); // SPA fallback
      data = await fsp.readFile(file);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found — run `npm run build` first?');
  }
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
wss.on('connection', (ws) => {
  ws.on('message', (data) => handleMessage(ws, data.toString()));
  ws.on('close', () => {
    const ctx = clientRoom.get(ws);
    clientRoom.delete(ws);
    if (!ctx) return;
    const { room, seat } = ctx;
    if (room.seats[seat]) room.seats[seat].ws = null;
    if (!room.game) {
      // in lobby: free the seat entirely
      delete room.seats[seat];
      if (room.seats.every((s) => !s || !s.ws)) { rooms.delete(room.code); return; }
      if (seat === room.hostSeat) room.hostSeat = room.seats.findIndex((s) => s && s.ws);
    } else {
      // mid-game: bots take over via pumpBots' "no ws" check
      if (room.seats.every((s) => !s || s.isBot || !s.ws)) {
        if (room.claimTimer) clearTimeout(room.claimTimer);
        if (room.botTimer) clearTimeout(room.botTimer);
        rooms.delete(room.code);
        return;
      }
      pumpBots(room);
    }
    broadcast(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Mahjong server listening on http://localhost:${PORT} (ws at /ws)`);
});

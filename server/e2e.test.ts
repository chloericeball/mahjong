// E2E driver: plays a solo game as a "human" via the Vite ws proxy,
// and checks the create/join multiplayer flow.
import WebSocket from 'ws';

const URL = 'ws://localhost:5173/ws';

function connect(): Promise<WebSocket> {
  return new Promise((res, rej) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}

async function soloGame() {
  const ws = await connect();
  let hands = 0;
  let acted = false;
  let done: (v: string) => void;
  const finished = new Promise<string>((r) => (done = r));
  const timeout = setTimeout(() => done('TIMEOUT'), 90_000);

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'event') return;
    if (msg.type !== 'state' || !msg.started) return;

    if (msg.phase === 'handEnd') {
      hands++;
      console.log(`hand ended: ${msg.result.type}` +
        (msg.result.type === 'win' ? ` — ${msg.result.winnerName}, ${msg.result.score.faan} faan, payments ${JSON.stringify(msg.result.payments)}` : ''));
      if (hands >= 2) { clearTimeout(timeout); ws.close(); done('OK'); return; }
      ws.send(JSON.stringify({ type: 'nextHand' }));
      return;
    }
    // my turn: win if possible, else discard the drawn tile (or last hand tile)
    if (msg.phase === 'discard' && msg.turn === msg.seat) {
      if (msg.canWin) { ws.send(JSON.stringify({ type: 'selfWin' })); return; }
      const t = msg.drawn ?? msg.hand[msg.hand.length - 1];
      ws.send(JSON.stringify({ type: 'discard', tileId: t.id }));
      acted = true;
      return;
    }
    // claim prompt: take pung if offered (exercise claims), else pass
    if (msg.claim) {
      if (msg.claim.options.includes('pung')) {
        ws.send(JSON.stringify({ type: 'claim', kind: 'pung' }));
      } else {
        ws.send(JSON.stringify({ type: 'claim', kind: 'pass' }));
      }
    }
  });

  ws.send(JSON.stringify({ type: 'create', name: 'Tester', solo: true }));
  const result = await finished;
  console.log(`solo game: ${result} (human acted: ${acted})`);
  if (result !== 'OK') process.exit(1);
}

async function multiplayerLobby() {
  const host = await connect();
  const guest = await connect();
  let code = '';

  const hostState = new Promise<void>((res) => {
    host.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.type === 'state' && !code) { code = m.code; res(); }
    });
  });
  host.send(JSON.stringify({ type: 'create', name: 'Host' }));
  await hostState;
  console.log(`room created: ${code}`);

  const guestJoined = new Promise<any>((res) => {
    guest.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.type === 'state') res(m);
      if (m.type === 'error') { console.error('join error:', m.message); process.exit(1); }
    });
  });
  guest.send(JSON.stringify({ type: 'join', code, name: 'Friend' }));
  const gs = await guestJoined;
  console.log(`guest joined at seat ${gs.seat}; players: ${gs.players.filter(Boolean).map((p: any) => p.name).join(', ')}`);

  // host starts; both should get started state with 2 bots filling in
  const guestStarted = new Promise<any>((res) => {
    guest.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.type === 'state' && m.started) res(m);
    });
  });
  host.send(JSON.stringify({ type: 'start' }));
  const started = await guestStarted;
  const bots = started.players.filter((p: any) => p.isBot).length;
  console.log(`game started; bots filling seats: ${bots}, guest hand size: ${started.hand.length}`);
  if (bots !== 2 || started.hand.length !== 13) process.exit(1);
  host.close(); guest.close();
}

async function main() {
  await multiplayerLobby();
  await soloGame();
  console.log('ALL E2E CHECKS PASSED');
  process.exit(0);
}
main();

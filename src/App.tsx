import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Table } from './Table';
import { Learn, loadProgress } from './Learn';
import { Puzzles, puzzleBest } from './Puzzles';
import { LESSONS } from './lessons';

export interface PlayerView {
  name: string;
  isBot: boolean;
  connected: boolean;
  seat: number;
  handCount?: number;
  melds?: { kind: string; codes: string[]; concealed?: boolean }[];
  flowers?: string[];
  discards?: string[];
  score?: number;
}

export interface GameView {
  type: 'state';
  code: string;
  seat: number;
  started: boolean;
  phase?: string;
  turn?: number;
  dealer?: number;
  roundWind?: string;
  seatWinds?: string[];
  wallCount?: number;
  hand?: { id: number; code: string }[];
  drawn?: { id: number; code: string } | null;
  canWin?: boolean;
  kongs?: string[];
  claim?: { options: string[]; chowChoices: string[][] } | null;
  hint?: {
    discardId?: number;
    waits?: string[];
    waitsAfter?: string[];
    claimAdvice?: string;
    claimChow?: string[];
  } | null;
  lastDiscard?: { code: string; seat: number } | null;
  players: (PlayerView | null)[];
  result?: any;
  hostSeat: number;
}

export type SendFn = (msg: Record<string, unknown>) => void;

export default function App() {
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('mj-name') || '');
  const [joinCode, setJoinCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState<'home' | 'learn' | 'puzzles'>('home');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setError(''); };
    ws.onclose = () => { setConnected(false); setView(null); setError('Disconnected from server'); };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') { setView(msg); setError(''); }
      else if (msg.type === 'error') setError(msg.message);
    };
    return () => ws.close();
  }, []);

  const sendMsg: SendFn = useCallback((msg) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const saveName = () => {
    const n = name.trim() || 'Player';
    localStorage.setItem('mj-name', n);
    return n;
  };

  if (!view) {
    if (screen === 'learn') return <Learn onClose={() => setScreen('home')} />;
    if (screen === 'puzzles') return <Puzzles onClose={() => setScreen('home')} />;

    const lessonsDone = loadProgress().size;
    const best = puzzleBest();
    return (
      <div className="lobby home">
        <h1>麻雀 Mahjong</h1>
        <p className="subtitle">Hong Kong rules · play, solve puzzles, learn interactively</p>
        {!connected && <p className="error">Connecting to server…</p>}
        {error && <p className="error">{error}</p>}
        <input
          placeholder="Your name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="nav-card play-card">
          <div className="nav-card-head"><span className="nav-icon">🀄</span>
            <span><b>Play</b><small>vs AI instantly, or online with friends</small></span>
          </div>
          <div className="lobby-actions">
            <button className="primary" disabled={!connected}
              onClick={() => sendMsg({ type: 'create', name: saveName(), solo: true })}>
              Play vs AI
            </button>
            <button disabled={!connected}
              onClick={() => sendMsg({ type: 'create', name: saveName() })}>
              Create Room
            </button>
          </div>
          <div className="join-row">
            <input
              placeholder="Room code"
              value={joinCode}
              maxLength={4}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button disabled={!connected || joinCode.length !== 4}
              onClick={() => sendMsg({ type: 'join', code: joinCode, name: saveName() })}>
              Join
            </button>
          </div>
        </div>

        <button className="nav-card" onClick={() => setScreen('puzzles')}>
          <div className="nav-card-head"><span className="nav-icon">🧩</span>
            <span><b>Puzzles</b><small>find the best discard · best streak: {best} 🔥</small></span>
          </div>
        </button>

        <button className="nav-card" onClick={() => setScreen('learn')}>
          <div className="nav-card-head"><span className="nav-icon">🎓</span>
            <span><b>Learn</b><small>interactive lessons · {lessonsDone}/{LESSONS.length} complete</small></span>
          </div>
          <div className="nav-progress"><div style={{ width: `${(lessonsDone / LESSONS.length) * 100}%` }} /></div>
        </button>
      </div>
    );
  }

  if (!view.started) {
    return (
      <div className="lobby">
        <h1>Room {view.code}</h1>
        <p className="subtitle">Share this code with friends. Empty seats become AI players.</p>
        <ul className="player-list">
          {[0, 1, 2, 3].map((i) => {
            const p = view.players[i];
            return (
              <li key={i}>
                {p ? `${p.name}${i === view.hostSeat ? ' (host)' : ''}` : <em>open seat — AI will fill</em>}
              </li>
            );
          })}
        </ul>
        {view.seat === view.hostSeat ? (
          <button className="primary" onClick={() => sendMsg({ type: 'start' })}>Start Game</button>
        ) : (
          <p>Waiting for host to start…</p>
        )}
      </div>
    );
  }

  return <Table view={view} send={sendMsg} />;
}

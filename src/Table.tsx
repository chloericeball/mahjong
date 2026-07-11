import React, { useState, useEffect } from 'react';
import { GameView, SendFn, PlayerView } from './App';
import { Tile, TileBack, windName } from './Tile';
import { Guide } from './Guide';

const WIND_CHAR: Record<string, string> = { wE: '東', wS: '南', wW: '西', wN: '北' };

const CLAIM_EXPLAIN: Record<string, string> = {
  win: 'This discard completes your hand — take it and win!',
  kong: 'Kong 槓: you hold three of these; claim the fourth for a face-up set plus a bonus draw.',
  pung: 'Pung 碰: you hold a pair of these; claim the discard to complete a face-up triplet.',
  chow: 'Chow 上: the tile from the player to your left completes a run with two of your tiles.',
  pass: 'Pass: keep your hand concealed and wait for a better tile.',
};

export const Table: React.FC<{ view: GameView; send: SendFn }> = ({ view, send }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [coach, setCoach] = useState(() => localStorage.getItem('mj-coach') !== 'off');

  useEffect(() => {
    localStorage.setItem('mj-coach', coach ? 'on' : 'off');
    send({ type: 'coach', on: coach });
  }, [coach, send]);
  const me = view.seat;
  const rel = (offset: number) => (me + offset) % 4;
  const p = (seat: number) => view.players[seat] as PlayerView;

  const myTurn = view.turn === me && view.phase === 'discard';
  const claim = view.claim;
  const hint = view.hint;
  const [chowPick, setChowPick] = useState(false);

  const doDiscard = (id: number) => {
    if (!myTurn) return;
    if (selected === id) {
      send({ type: 'discard', tileId: id });
      setSelected(null);
    } else {
      setSelected(id);
    }
  };

  const Melds: React.FC<{ pl: PlayerView }> = ({ pl }) => (
    <div className="melds">
      {pl.melds?.map((m, i) => (
        <div className="meld" key={i}>
          {m.codes.map((c, j) => (
            m.concealed && j > 0 && j < 3
              ? <TileBack key={j} size="sm" />
              : <Tile key={j} code={c} size="sm" />
          ))}
        </div>
      ))}
      {pl.flowers && pl.flowers.length > 0 && (
        <div className="meld flowers">
          {pl.flowers.map((f, i) => <Tile key={i} code={f} size="sm" />)}
        </div>
      )}
    </div>
  );

  const Opponent: React.FC<{ seat: number; pos: 'top' | 'left' | 'right' }> = ({ seat, pos }) => {
    const pl = p(seat);
    return (
      <div className={`opponent ${pos} ${view.turn === seat ? 'active' : ''}`}>
        <div className="p-label">
          <span className="p-wind">{WIND_CHAR[view.seatWinds![seat]]}</span>
          <span className="p-name">{pl.name}{!pl.connected && ' ⚠'}</span>
          <span className="p-score">{pl.score}</span>
          {seat === view.dealer && <span className="dealer-chip">莊</span>}
        </div>
        <div className="opp-hand">
          {Array.from({ length: pl.handCount ?? 0 }).map((_, i) => <TileBack key={i} />)}
        </div>
        <Melds pl={pl} />
      </div>
    );
  };

  const Discards: React.FC<{ seat: number }> = ({ seat }) => {
    const pl = p(seat);
    const last = view.lastDiscard;
    return (
      <div className="discard-zone">
        <div className="dz-label">{WIND_CHAR[view.seatWinds![seat]]} {pl.name}</div>
        <div className="dz-tiles">
          {pl.discards?.map((c, i) => (
            <Tile key={i} code={c} size="sm"
              highlight={!!last && last.seat === seat && i === pl.discards!.length - 1} />
          ))}
        </div>
      </div>
    );
  };

  const result = view.result;

  return (
    <div className="table">
      <div className="topbar">
        <span>Room <b>{view.code}</b></span>
        <span>Round: {windName(view.roundWind!)}</span>
        <span>Wall: {view.wallCount}</span>
        <button className={`chip-btn ${coach ? 'on' : ''}`} onClick={() => setCoach(!coach)}>
          🎓 Coach {coach ? 'on' : 'off'}
        </button>
        <button className="chip-btn" onClick={() => setShowGuide(true)}>? How to play</button>
      </div>
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}

      <Opponent seat={rel(2)} pos="top" />
      <Opponent seat={rel(3)} pos="left" />
      <Opponent seat={rel(1)} pos="right" />

      <div className="center">
        <div className="discards-grid">
          <Discards seat={rel(2)} />
          <div className="dz-row">
            <Discards seat={rel(3)} />
            <Discards seat={rel(1)} />
          </div>
          <Discards seat={me} />
        </div>
      </div>

      <div className={`me ${myTurn ? 'active' : ''}`}>
        <Melds pl={p(me)} />

        {coach && hint && (
          <div className="coach-bar">
            {myTurn && view.canWin && <span>🎓 You have a winning hand — press <b>Win 糊</b>!</span>}
            {myTurn && !view.canWin && hint.discardId !== undefined && (
              <span>
                🎓 Coach suggests discarding the glowing tile
                {hint.waitsAfter && hint.waitsAfter.length > 0 && (
                  <> — then you'd win on: {hint.waitsAfter.map((c, i) => <Tile key={i} code={c} size="sm" />)}</>
                )}
              </span>
            )}
            {!myTurn && !claim && hint.waits && hint.waits.length > 0 && (
              <span>🎓 You're ready 聽牌! You win on: {hint.waits.map((c, i) => <Tile key={i} code={c} size="sm" />)}</span>
            )}
            {claim && hint.claimAdvice && (
              <span>
                🎓 {CLAIM_EXPLAIN[hint.claimAdvice] ?? ''}{' '}
                <b>Coach says: {hint.claimAdvice === 'pass' ? 'Pass' : `take the ${hint.claimAdvice.charAt(0).toUpperCase() + hint.claimAdvice.slice(1)}`}</b>
              </span>
            )}
          </div>
        )}

        <div className="my-hand">
          {view.hand?.map((t) => (
            <Tile key={t.id} code={t.code} size="lg"
              onClick={myTurn ? () => doDiscard(t.id) : undefined}
              selected={selected === t.id}
              highlight={coach && myTurn && hint?.discardId === t.id} />
          ))}
          {view.drawn && (
            <div className="drawn-slot">
              <Tile code={view.drawn.code} size="lg"
                onClick={myTurn ? () => doDiscard(view.drawn!.id) : undefined}
                selected={selected === view.drawn.id}
                highlight={coach && myTurn && hint?.discardId === view.drawn.id} />
            </div>
          )}
        </div>
        <div className="p-label mine">
          <span className="p-wind">{WIND_CHAR[view.seatWinds![me]]}</span>
          <span className="p-name">{p(me).name}</span>
          <span className="p-score">{p(me).score}</span>
          {me === view.dealer && <span className="dealer-chip">莊</span>}
          {myTurn && <span className="turn-hint">{selected !== null ? 'tap again to discard' : 'your turn — pick a tile'}</span>}
        </div>

        <div className="actions">
          {myTurn && view.canWin && (
            <button className="act win" onClick={() => send({ type: 'selfWin' })}>Win 糊</button>
          )}
          {myTurn && view.kongs?.map((k) => (
            <button key={k} className="act" onClick={() => send({ type: 'kong', code: k })}>Kong 槓 ({k})</button>
          ))}
          {claim && !chowPick && (
            <>
              {claim.options.includes('win') && (
                <button className="act win" title={CLAIM_EXPLAIN.win} onClick={() => send({ type: 'claim', kind: 'win' })}>Win 糊</button>
              )}
              {claim.options.includes('kong') && (
                <button className="act" title={CLAIM_EXPLAIN.kong} onClick={() => send({ type: 'claim', kind: 'kong' })}>Kong 槓</button>
              )}
              {claim.options.includes('pung') && (
                <button className="act" title={CLAIM_EXPLAIN.pung} onClick={() => send({ type: 'claim', kind: 'pung' })}>Pung 碰</button>
              )}
              {claim.options.includes('chow') && (
                <button className="act" title={CLAIM_EXPLAIN.chow} onClick={() => {
                  if (claim.chowChoices.length === 1) send({ type: 'claim', kind: 'chow', chow: claim.chowChoices[0] });
                  else setChowPick(true);
                }}>Chow 上</button>
              )}
              <button className="act pass" onClick={() => send({ type: 'claim', kind: 'pass' })}>Pass</button>
            </>
          )}
          {claim && chowPick && (
            <>
              {claim.chowChoices.map((pair, i) => (
                <button key={i} className="act" onClick={() => { send({ type: 'claim', kind: 'chow', chow: pair }); setChowPick(false); }}>
                  {pair.join(' + ')}
                </button>
              ))}
              <button className="act pass" onClick={() => setChowPick(false)}>Back</button>
            </>
          )}
        </div>
      </div>

      {view.phase === 'handEnd' && result && (
        <div className="overlay">
          <div className="result-card">
            {result.type === 'draw' ? (
              <h2>Draw — wall exhausted 流局</h2>
            ) : (
              <>
                <h2>{result.winnerName} wins! {result.loserName ? `(off ${result.loserName})` : '(self-draw 自摸)'}</h2>
                <div className="win-tiles">
                  {result.winningHand?.melds?.map((m: any, i: number) => (
                    <span className="meld" key={`m${i}`}>{m.codes.map((c: string, j: number) => <Tile key={j} code={c} size="sm" />)}</span>
                  ))}
                  {result.winningHand?.concealed?.map((c: string, i: number) => <Tile key={i} code={c} size="sm" />)}
                </div>
                <table className="faan-table">
                  <tbody>
                    {result.score?.elements?.map((e: any, i: number) => (
                      <tr key={i}><td>{e.name}</td><td>{e.faan} faan</td></tr>
                    ))}
                    <tr className="total"><td>Total</td><td>{result.score?.faan} faan</td></tr>
                  </tbody>
                </table>
              </>
            )}
            <table className="score-table">
              <tbody>
                {view.players.map((pl, i) => pl && (
                  <tr key={i}>
                    <td>{pl.name}</td>
                    <td className={result.payments?.[i] > 0 ? 'gain' : result.payments?.[i] < 0 ? 'loss' : ''}>
                      {result.payments ? (result.payments[i] > 0 ? `+${result.payments[i]}` : result.payments[i]) : ''}
                    </td>
                    <td>{pl.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="primary" onClick={() => send({ type: 'nextHand' })}>Next Hand</button>
          </div>
        </div>
      )}
    </div>
  );
};

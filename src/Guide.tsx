import React from 'react';
import { Tile } from './Tile';

const T: React.FC<{ codes: string; gap?: boolean }> = ({ codes }) => (
  <span className="g-tiles">
    {codes.split(' ').map((c, i) => (c === '·' ? <span key={i} className="g-gap" /> : <Tile key={i} code={c} size="sm" />))}
  </span>
);

export const Guide: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="overlay" onClick={onClose}>
    <div className="result-card guide-card" onClick={(e) => e.stopPropagation()}>
      <div className="guide-head">
        <h2>How to Play 麻雀</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <section>
        <h3>The goal</h3>
        <p>
          Build a winning hand of <b>14 tiles</b>: four <b>sets</b> of three plus one <b>pair</b>.
          A set is either a <b>run</b> of three consecutive tiles in one suit, or a <b>triplet</b> of
          identical tiles.
        </p>
        <p className="g-example">
          <T codes="d1 d2 d3 · b4 b5 b6 · c7 c8 c9 · gR gR gR · wE wE" />
          <br />
          <small>run + run + run + triplet + pair = win! 糊</small>
        </p>
      </section>

      <section>
        <h3>The tiles</h3>
        <p>Three suits, numbered 1–9 (four copies of each tile exist):</p>
        <p className="g-example">
          <b>Dots 筒</b> <T codes="d1 d5 d9" /> &nbsp; <b>Bamboo 索</b> <T codes="b1 b5 b9" /> &nbsp;
          <b>Characters 萬</b> <T codes="c1 c5 c9" />
        </p>
        <p>
          Honor tiles have no numbers — they only form triplets and pairs, never runs:
        </p>
        <p className="g-example">
          <b>Winds</b> <T codes="wE wS wW wN" /> (East, South, West, North) &nbsp;
          <b>Dragons</b> <T codes="gR gG gW" /> (Red, Green, White)
        </p>
        <p>
          <b>Flowers</b> <T codes="f1 f6" /> are bonus tiles: when you draw one it's set aside
          for bonus points and you draw a replacement automatically.
        </p>
      </section>

      <section>
        <h3>Your turn</h3>
        <p>
          You always hold 13 tiles. On your turn you <b>draw</b> a tile, then <b>discard</b> one
          (tap a tile, then tap it again to confirm). If the drawn tile completes your hand,
          declare <b>Win 糊</b> instead — that's a <i>self-draw 自摸</i> and everyone pays you.
        </p>
      </section>

      <section>
        <h3>Claiming discards</h3>
        <p>When someone discards a tile you need, buttons appear. You may claim it to:</p>
        <ul>
          <li><b>Chow 上</b> — complete a run. Only allowed from the player to your <b>left</b>. <T codes="b4 b5" /> + their <T codes="b6" /></li>
          <li><b>Pung 碰</b> — complete a triplet, from <b>any</b> player. <T codes="c3 c3" /> + their <T codes="c3" /></li>
          <li><b>Kong 槓</b> — four of a kind. You get a bonus draw to stay at the right count.</li>
          <li><b>Win 糊</b> — the discard completes your hand; the discarder pays for everyone.</li>
        </ul>
        <p>
          Claimed sets are placed face-up and can't change. Win beats Pung/Kong, which beat Chow.
          After claiming you discard as usual. If you don't want it, press <b>Pass</b>.
        </p>
      </section>

      <section>
        <h3>Getting ready 聽牌</h3>
        <p>
          When you're one tile away from winning you are <b>ready</b> (聽牌). Turn on
          <b> Coach mode</b> and the app shows exactly which tiles you're waiting for, and
          suggests a discard every turn while you learn.
        </p>
        <p className="g-example">
          <T codes="d1 d2 d3 d4 d5 d6 b1 b2 b3 c7 c8 wE wE" />
          <br />
          <small>this hand wins on <T codes="c6" /> or <T codes="c9" /> — a two-sided wait</small>
        </p>
      </section>

      <section>
        <h3>Scoring (faan 番)</h3>
        <p>Bigger patterns earn more faan; each faan doubles the payout (base = 2<sup>faan</sup>).</p>
        <table className="faan-table">
          <tbody>
            <tr><td>Common hand 平糊 (all runs)</td><td>1</td></tr>
            <tr><td>Self-draw 自摸 / Seat or Round wind triplet / Dragon triplet</td><td>1 each</td></tr>
            <tr><td>All triplets 對對糊</td><td>3</td></tr>
            <tr><td>Mixed one suit 混一色 (one suit + honors)</td><td>3</td></tr>
            <tr><td>Pure one suit 清一色</td><td>7</td></tr>
            <tr><td>Great dragons 大三元 (all 3 dragon triplets)</td><td>8</td></tr>
            <tr><td>Thirteen orphans 十三么 / All honors 字一色</td><td>13 (limit)</td></tr>
          </tbody>
        </table>
        <p><small>Win by discard: the discarder pays 3× base. Self-draw: all three players pay base each — so discard carefully!</small></p>
      </section>

      <section>
        <h3>Beginner tips</h3>
        <ul>
          <li>Keep pairs — you always need exactly one, and pairs grow into triplets.</li>
          <li>Middle tiles (4–6) make runs most easily; lone honor tiles are usually safe early discards.</li>
          <li>Watch the discard pool: if a tile appears 3–4 times, stop waiting on it.</li>
          <li>Late in the hand, discarding tiles others just discarded is safest.</li>
        </ul>
      </section>

      <button className="primary" onClick={onClose}>Got it — let's play</button>
    </div>
  </div>
);

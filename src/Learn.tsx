import React, { useState, useCallback } from 'react';
import { Tile } from './Tile';
import { Guide } from './Guide';
import { LESSONS, Lesson, Step, TileRow } from './lessons';
import { sortTiles } from '../shared/tiles';

const PROGRESS_KEY = 'mj-lessons-done';

export function loadProgress(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveProgress(done: Set<string>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done]));
}

const Rows: React.FC<{ rows?: TileRow[] }> = ({ rows }) =>
  rows ? (
    <div className="l-rows">
      {rows.map((r, i) => (
        <div className="l-row" key={i}>
          {r.label && <span className="l-row-label">{r.label}</span>}
          <span className="g-tiles">
            {r.tiles.map((c, j) =>
              c === '·' ? <span key={j} className="g-gap" /> : <Tile key={j} code={c} size="sm" />
            )}
          </span>
        </div>
      ))}
    </div>
  ) : null;

type Verdict = null | 'correct' | 'wrong';

const StepView: React.FC<{ step: Step; onResult: (v: Verdict) => void; verdict: Verdict }> = ({
  step, onResult, verdict,
}) => {
  const [picked, setPicked] = useState<number[]>([]);
  const locked = verdict === 'correct';

  // reset picks when retrying
  const retryReset = useCallback(() => { setPicked([]); onResult(null); }, [onResult]);

  if (step.kind === 'info') {
    return (
      <>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <Rows rows={step.rows} />
      </>
    );
  }

  if (step.kind === 'tap') {
    return (
      <>
        <p className="l-prompt">{step.prompt}</p>
        <Rows rows={step.rows} />
        <div className="l-choices">
          {step.choices.map((c, i) => (
            <Tile
              key={i} code={c} size="lg"
              selected={picked[0] === i}
              onClick={locked ? undefined : () => {
                setPicked([i]);
                onResult(step.correct.includes(i) ? 'correct' : 'wrong');
              }}
            />
          ))}
        </div>
      </>
    );
  }

  if (step.kind === 'multi') {
    const toggle = (i: number) => {
      if (locked) return;
      if (verdict === 'wrong') retryReset();
      setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
    };
    const check = () => {
      const want = [...step.correct].sort().join(',');
      const got = [...picked].sort().join(',');
      onResult(want === got ? 'correct' : 'wrong');
    };
    return (
      <>
        <p className="l-prompt">{step.prompt}</p>
        <Rows rows={step.rows} />
        <div className="l-choices">
          {step.choices.map((c, i) => (
            <Tile key={i} code={c} size="lg" selected={picked.includes(i)}
              onClick={locked ? undefined : () => toggle(i)} />
          ))}
        </div>
        {!locked && (
          <button className="primary l-check" disabled={picked.length === 0} onClick={check}>
            Check
          </button>
        )}
      </>
    );
  }

  if (step.kind === 'discard') {
    const hand = sortTiles(step.hand.map((code, id) => ({ id, code })));
    return (
      <>
        <p className="l-prompt">{step.prompt}</p>
        <div className="l-choices l-hand">
          {hand.map((t) => (
            <Tile key={t.id} code={t.code} size="md"
              selected={picked[0] === t.id}
              onClick={locked ? undefined : () => {
                setPicked([t.id]);
                onResult(step.correct.includes(t.code) ? 'correct' : 'wrong');
              }} />
          ))}
        </div>
      </>
    );
  }

  // choice
  return (
    <>
      <p className="l-prompt">{step.prompt}</p>
      <Rows rows={step.rows} />
      <div className="l-options">
        {step.options.map((o, i) => (
          <button key={i}
            className={`l-option ${picked[0] === i ? (verdict === 'correct' ? 'right' : 'chosen') : ''}`}
            disabled={locked}
            onClick={() => {
              setPicked([i]);
              onResult(i === step.correct ? 'correct' : 'wrong');
            }}>
            {o}
          </button>
        ))}
      </div>
    </>
  );
};

const LessonPlayer: React.FC<{ lesson: Lesson; onExit: (completed: boolean) => void }> = ({
  lesson, onExit,
}) => {
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [stepKey, setStepKey] = useState(0); // remount StepView on retry/advance
  const step = lesson.steps[idx];
  const isLast = idx === lesson.steps.length - 1;
  const canAdvance = step.kind === 'info' || verdict === 'correct';

  const next = () => {
    if (isLast) { onExit(true); return; }
    setIdx(idx + 1);
    setVerdict(null);
    setStepKey((k) => k + 1);
  };

  const retry = () => { setVerdict(null); setStepKey((k) => k + 1); };

  return (
    <div className="learn-screen">
      <div className="panel-card lesson-card">
        <div className="l-head">
          <button className="close-btn" onClick={() => onExit(false)}>← Lessons</button>
          <span className="l-title">{lesson.icon} {lesson.title}</span>
          <span className="l-count">{idx + 1} / {lesson.steps.length}</span>
        </div>
        <div className="l-progress"><div style={{ width: `${((idx + (canAdvance ? 1 : 0)) / lesson.steps.length) * 100}%` }} /></div>

        <div className="l-body">
          <StepView key={stepKey} step={step} verdict={verdict} onResult={setVerdict} />
        </div>

        {verdict === 'correct' && step.kind !== 'info' && (
          <div className="l-feedback good">✓ Correct! {(step as any).explain}</div>
        )}
        {verdict === 'wrong' && (
          <div className="l-feedback bad">
            ✗ Not quite. {(step as any).wrong ?? 'Have another look.'}
            {step.kind !== 'multi' && <button className="l-retry" onClick={retry}>Try again</button>}
          </div>
        )}

        <div className="l-nav">
          {canAdvance && (
            <button className="primary" onClick={next}>
              {isLast ? 'Finish lesson 🎉' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const Learn: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [done, setDone] = useState<Set<string>>(loadProgress);
  const [active, setActive] = useState<Lesson | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  if (active) {
    return (
      <LessonPlayer
        lesson={active}
        onExit={(completed) => {
          if (completed) {
            const d = new Set(done); d.add(active.id);
            setDone(d); saveProgress(d);
          }
          setActive(null);
        }}
      />
    );
  }

  const firstUnfinished = LESSONS.find((l) => !done.has(l.id));

  return (
    <div className="learn-screen">
      <div className="panel-card hub-card">
        <div className="l-head">
          <button className="close-btn" onClick={onClose}>← Home</button>
          <span className="l-title">🎓 Learn Mahjong</span>
          <span className="l-count">{done.size} / {LESSONS.length}</span>
        </div>
        <div className="l-progress"><div style={{ width: `${(done.size / LESSONS.length) * 100}%` }} /></div>
        <p className="hub-blurb">
          Interactive lessons — you learn by tapping tiles, not by reading rules.
          {firstUnfinished && <> Up next: <b>{firstUnfinished.title}</b>.</>}
          {!firstUnfinished && <> All lessons complete — time to play! 🏆</>}
        </p>
        <div className="hub-list">
          {LESSONS.map((l, i) => (
            <button key={l.id} className={`hub-item ${done.has(l.id) ? 'done' : ''}`} onClick={() => setActive(l)}>
              <span className="hub-icon">{l.icon}</span>
              <span className="hub-text">
                <span className="hub-title">{i + 1}. {l.title}</span>
                <span className="hub-blurb-sm">{l.blurb}</span>
              </span>
              <span className="hub-check">{done.has(l.id) ? '✓' : '›'}</span>
            </button>
          ))}
        </div>
        <button className="link-btn" onClick={() => setShowGuide(true)}>
          Prefer reading? Open the full rules reference
        </button>
        {showGuide && <Guide onClose={() => setShowGuide(false)} />}
      </div>
    </div>
  );
};

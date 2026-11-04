// Breathing, then the 15-minute timer with pause, early finish and quit.
import {
  IS_TEST, TOTAL_MS, state, esc, fmtClock, taskById, currentTask, setP, setFull, stopLoops,
  animateP, paint, setText, announce, setTitle, bar, saveSession, clearSession, elapsed,
} from './core.js';
import { primeAudio, chime, askNotify, notify, requestWake } from './effects.js';
import { renderHome } from './home.js';
import { renderReflect } from './reflect.js';

let lastSec = -1;

// Main build: today's task in order. Choose build: the task that was picked.
export function start(t = currentTask()) {
  primeAudio();
  askNotify();
  requestWake();
  state.session = { taskId: t.id, title: t.title, startedAt: null, pausedAt: null, pausedTotal: 0, endedAt: null, early: false };
  breathe();
}

function breathe() {
  state.mode = 'breathe';
  stopLoops();
  setFull(false);
  setP(0);
  setTitle('Breathe');
  paint(`<div class="frame">${bar('<p></p>')}
    <main class="screen">
      <h1 class="task cue">Take ten deep breaths.</h1>
      <p class="hint">Breathe in for five seconds, then out for five.</p>
      <div class="actions">
        <button class="btn primary big" data-act="begin">Start task</button>
      </div>
    </main></div>`);
}

export function startTimer() {
  state.session.startedAt = Date.now();
  saveSession();
  announce(IS_TEST ? 'Timer started. 5 seconds.' : 'Timer started. 15 minutes.');
  runTimer();
}

export function runTimer() {
  const session = state.session;
  state.mode = 'timer';
  stopLoops();
  setFull(false);
  requestWake();
  const t = taskById(session.taskId) || { title: session.title };
  lastSec = -1;
  document.body.toggleAttribute('data-paused', !!session.pausedAt);
  paint(`<div class="frame">${bar(`<p class="bar-task">${esc(t.title)}</p>`)}
    <main class="screen timer">
      <p class="clock" data-clock role="timer" aria-label="Time left">${fmtClock(TOTAL_MS / 1000)}</p>
      <div class="actions">
        ${t.early ? '<button class="btn primary" data-act="early">Done early</button>' : ''}
        <button class="btn" data-act="pause" data-pause>${session.pausedAt ? 'Resume' : 'Pause'}</button>
        <button class="btn quiet" data-act="quit">End without saving</button>
      </div>
    </main></div>`);
  tick();
  schedule();
}

export function tick() {
  cancelAnimationFrame(state.frame);
  const e = elapsed();
  setP(Math.min(1, e / TOTAL_MS));
  const sec = Math.ceil(Math.max(0, TOTAL_MS - e) / 1000);
  if (sec !== lastSec) {
    lastSec = sec;
    setText('[data-clock]', fmtClock(sec));
    setTitle(state.session.pausedAt ? `Paused at ${fmtClock(sec)}` : `${fmtClock(sec)} left`);
  }
  if (e >= TOTAL_MS) { finish(false); return; }
  if (!state.session.pausedAt) state.frame = requestAnimationFrame(tick);
}

// rAF stops in background tabs; a timeout makes sure the end still fires.
function schedule() {
  clearTimeout(state.endTimer);
  if (!state.session || state.session.pausedAt) return;
  state.endTimer = setTimeout(tick, Math.max(0, TOTAL_MS - elapsed()) + 50);
}

export function togglePause() {
  const session = state.session;
  if (session.pausedAt) {
    session.pausedTotal += Date.now() - session.pausedAt;
    session.pausedAt = null;
    setText('[data-pause]', 'Pause');
    document.body.removeAttribute('data-paused');
    lastSec = -1;
    tick();
    schedule();
  } else {
    session.pausedAt = Date.now();
    stopLoops();
    setText('[data-pause]', 'Resume');
    document.body.setAttribute('data-paused', '');
    lastSec = -1;
    tick();
  }
  saveSession();
}

export function finish(early) {
  const session = state.session;
  stopLoops();
  if (session.pausedAt) {
    session.pausedTotal += Date.now() - session.pausedAt;
    session.pausedAt = null;
  }
  session.endedAt = early ? Date.now() : session.startedAt + session.pausedTotal + TOTAL_MS;
  session.early = early;
  saveSession();
  document.body.removeAttribute('data-paused');

  if (!early) {
    chime();
    try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch {}
    notify('Time’s up', session.title);
    announce('Time’s up.');
  }
  animateP(1, early ? 900 : 400, renderReflect);
}

export function quit() {
  if (!confirm('End this session? It won’t be saved.')) return;
  clearSession();
  renderHome();
}

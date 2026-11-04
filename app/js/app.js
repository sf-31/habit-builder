// Entry point: wires up events and routing, then restores any saved session.
import { TOTAL_MS, state, store, dry, syncScroll, saveSession, elapsed } from './core.js';
import { primeAudio, requestWake } from './effects.js';
import { renderHome, restart } from './home.js';
import { start, startTimer, runTimer, tick, togglePause, finish, quit } from './timer.js';
import { renderReflect, save } from './reflect.js';
import { renderReport, exportData, clearTest } from './report.js';

// ---------- events ----------

const actions = {
  start,
  begin: () => { primeAudio(); requestWake(); startTimer(); },
  pause: togglePause,
  early: () => finish(true),
  quit,
  restart,
  export: exportData,
  clear: clearTest,
};

dry.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
});
dry.addEventListener('submit', (e) => {
  if (e.target.matches('[data-form]')) { e.preventDefault(); save(e.target); }
});
dry.addEventListener('change', (e) => {
  if (e.target.name === 'again') {
    const err = dry.querySelector('[data-error]');
    if (err) err.hidden = true;
  }
  if (e.target.matches('[data-pick]')) {
    if (e.target.value) store.set('pick', e.target.value);
    else store.del('pick');
    renderHome();
    dry.querySelector('[data-pick]')?.focus();
  }
});

// Audio can only start after a tap; re-prime after a reload mid-timer.
document.addEventListener('pointerdown', () => { if (state.mode === 'timer') primeAudio(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const { mode } = state;
  if (mode === 'breathe' || mode === 'timer') requestWake();
  if (mode === 'timer') tick();
  if (mode === 'home') renderHome(); // the day may have changed
});

window.addEventListener('scroll', syncScroll, { passive: true });
window.addEventListener('resize', syncScroll);

function route() {
  const { mode } = state;
  if (mode === 'breathe' || mode === 'timer' || mode === 'reflect') {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    return;
  }
  if (location.hash === '#report') renderReport();
  else renderHome();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- boot ----------

const saved = store.get('session', null);
if (saved && saved.startedAt) {
  state.session = saved;
  if (!saved.endedAt && elapsed() >= TOTAL_MS) {
    saved.endedAt = saved.startedAt + saved.pausedTotal + TOTAL_MS;
    saved.pausedAt = null;
    saveSession();
  }
  if (saved.endedAt) renderReflect();
  else runTimer();
} else {
  if (saved) store.del('session');
  route();
}

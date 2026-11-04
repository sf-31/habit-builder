// Entry point: wires up events and routing, then restores any saved session.
import { IS_CHOOSE, sessionMs, state, store, dry, syncScroll, saveSession, elapsed, taskById } from './core.js';
import { primeAudio, requestWake } from './effects.js';
import { renderHome, restart, customTask, changeLength } from './home.js';
import { start, startTimer, runTimer, tick, togglePause, finish, quit } from './timer.js';
import { renderReflect, save } from './reflect.js';
import { renderReport, exportData, clearTest } from './report.js';
import { renderManage, saveTask, editTask, cancelEdit, removeTask, useStarter } from './manage.js';

// ---------- events ----------

const actions = {
  start: () => start(),
  choose: (b) => start(taskById(b.dataset.id)),
  begin: () => { primeAudio(); requestWake(); startTimer(); },
  pause: togglePause,
  early: () => finish(true),
  quit,
  restart,
  shorter: () => changeLength(-1),
  longer: () => changeLength(1),
  export: exportData,
  clear: clearTest,
  'edit-task': editTask,
  'cancel-edit': cancelEdit,
  'remove-task': removeTask,
  starter: useStarter,
};

dry.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
});
dry.addEventListener('submit', (e) => {
  if (e.target.matches('[data-form]')) { e.preventDefault(); save(e.target); }
  if (e.target.matches('[data-task-form]')) { e.preventDefault(); saveTask(e.target); }
  if (e.target.matches('[data-custom-form]')) {
    e.preventDefault();
    const t = customTask(e.target);
    if (t) start(t);
  }
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
  else if (location.hash === '#tasks' && IS_CHOOSE) renderManage();
  else renderHome();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- boot ----------

const saved = store.get('session', null);
if (saved && saved.startedAt) {
  state.session = saved;
  if (!saved.endedAt && elapsed() >= sessionMs()) {
    saved.endedAt = saved.startedAt + saved.pausedTotal + sessionMs();
    saved.pausedAt = null;
    saveSession();
  }
  if (saved.endedAt) renderReflect();
  else runTimer();
} else {
  if (saved) store.del('session');
  route();
}

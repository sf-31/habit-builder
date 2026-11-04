// Config, storage, shared state and the helpers every screen uses.

// The built-in list from tasks.js. The choose build only uses it as a starter list.
export const BUILTIN = Array.isArray(window.TASKS) ? window.TASKS : [];

// The test build is served from /test/. It keeps its own data.
export const IS_TEST = /\/test(\/|$)/.test(location.pathname);
// The choose build (/choose/, nothing links to it) keeps its own editable
// task list and lets you pick each day's task. It also keeps its own data.
export const IS_CHOOSE = /\/choose(\/|$)/.test(location.pathname);
// The test build uses a 5-second timer so you can run through the whole flow quickly.
export const TOTAL_MS = IS_TEST ? 5 * 1000 : 15 * 60 * 1000;
// The timer length can be changed on the start screen, in 5-minute steps.
// The test build scales it the same way, so 15 "minutes" there is 5 seconds.
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 60;
export const STEP_MINUTES = 5;
export const msFor = (minutes) => (TOTAL_MS * minutes) / 15;
const PREFIX = `fifteen:${IS_TEST ? 'test:' : ''}${IS_CHOOSE ? 'choose:' : ''}`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export const store = {
  get(name, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + name);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(name, value) {
    try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); } catch {}
  },
  del(name) {
    try { localStorage.removeItem(PREFIX + name); } catch {}
  },
};

const root = document.documentElement;
export const dry = document.getElementById('dry');
const wetInner = document.querySelector('#wet .wet-inner');
const live = document.getElementById('live');

// Mutable state shared between modules.
export const state = {
  mode: 'home',
  frame: 0,
  endTimer: 0,
  session: null,
};
let curP = 0;

// ---------- helpers ----------

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const shortDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const longToday = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
export const fmtClock = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

export const getMinutes = () => {
  const m = store.get('minutes', 15);
  return Number.isInteger(m) && m % STEP_MINUTES === 0 && m >= MIN_MINUTES && m <= MAX_MINUTES ? m : 15;
};
export const getLog = () => store.get('log', []);
export const getCycle = () => store.get('cycle', 1);
export const getTasks = () => (IS_CHOOSE ? store.get('tasks', []) : BUILTIN);
export const taskById = (id) => getTasks().find((t) => t.id === id);
// Test build only: a task picked from the menu on the start screen.
export const pickedTask = () => (IS_TEST ? taskById(store.get('pick', null)) : null);
export const currentTask = () => pickedTask() || upcoming()[0];
export const doneToday = () => getLog().some((r) => r.date === dayKey());
function upcoming() {
  const cycle = getCycle();
  const done = new Set(getLog().filter((r) => r.cycle === cycle).map((r) => r.taskId));
  return getTasks().filter((t) => !done.has(t.id));
}

export function setP(p) {
  curP = p;
  root.style.setProperty('--p', p.toFixed(4));
}
export function setFull(on) { document.body.toggleAttribute('data-full', on); }
export function stopLoops() { cancelAnimationFrame(state.frame); clearTimeout(state.endTimer); }

export function animateP(to, ms, done) {
  cancelAnimationFrame(state.frame);
  const from = curP;
  if (reduceMotion.matches) { setP(to); done && done(); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    setP(from + (to - from) * e);
    if (k < 1) state.frame = requestAnimationFrame(step);
    else done && done();
  };
  state.frame = requestAnimationFrame(step);
}

export function paint(html) {
  dry.innerHTML = html;
  wetInner.innerHTML = html;
  syncScroll();
}
export function setText(sel, text) {
  document.querySelectorAll(sel).forEach((el) => {
    if (el.textContent !== text) el.textContent = text;
  });
}
export function announce(msg) {
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 60);
}
export function syncScroll() {
  wetInner.style.transform = `translateY(${-window.scrollY}px)`;
}
export function setTitle(t) {
  document.title = `${IS_TEST ? '[test] ' : ''}${t}`;
}

export function bar(left, right = '') {
  const tag = IS_TEST ? '<span class="tag">Test build</span>' : '';
  return `<header class="bar">${left}${tag ? `<p>${tag}</p>` : ''}${right}</header>`;
}
export const dateLeft = () => `<p>${esc(longToday())}</p>`;
export const reportLink = IS_CHOOSE
  ? '<p class="links"><a class="link" href="#tasks">Your tasks</a><a class="link" href="#report">Your report</a></p>'
  : '<a class="link" href="#report">Your report</a>';

// ---------- session ----------

export const saveSession = () => store.set('session', state.session);
export const clearSession = () => { state.session = null; store.del('session'); };
// Sessions saved before the length was adjustable have no minutes: 15.
export const sessionMs = () => msFor(state.session.minutes ?? 15);
export function elapsed() {
  const s = state.session;
  const now = s.endedAt ?? s.pausedAt ?? Date.now();
  return Math.max(0, now - s.startedAt - s.pausedTotal);
}

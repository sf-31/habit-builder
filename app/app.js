(() => {
  'use strict';

  const TASKS = Array.isArray(window.TASKS) ? window.TASKS : [];

  // The test build is served from /test/. It keeps its own data.
  const IS_TEST = /\/test(\/|$)/.test(location.pathname);
  // The test build uses a 5-second timer so you can run through the whole flow quickly.
  const TOTAL_MS = IS_TEST ? 5 * 1000 : 15 * 60 * 1000;
  const PREFIX = IS_TEST ? 'fifteen:test:' : 'fifteen:';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const store = {
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
  const dry = document.getElementById('dry');
  const wetInner = document.querySelector('#wet .wet-inner');
  const live = document.getElementById('live');

  let mode = 'home';
  let frame = 0;
  let endTimer = 0;
  let session = null;
  let audio = null;
  let wakeLock = null;
  let curP = 0;
  let lastSec = -1;

  // ---------- helpers ----------

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shortDate = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const longToday = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtClock = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

  const getLog = () => store.get('log', []);
  const getCycle = () => store.get('cycle', 1);
  const taskById = (id) => TASKS.find((t) => t.id === id);
  // Test build only: a task picked from the menu on the start screen.
  const pickedTask = () => (IS_TEST ? taskById(store.get('pick', null)) : null);
  const currentTask = () => pickedTask() || upcoming()[0];
  const doneToday = () => getLog().some((r) => r.date === dayKey());
  function upcoming() {
    const cycle = getCycle();
    const done = new Set(getLog().filter((r) => r.cycle === cycle).map((r) => r.taskId));
    return TASKS.filter((t) => !done.has(t.id));
  }

  function setP(p) {
    curP = p;
    root.style.setProperty('--p', p.toFixed(4));
  }
  function setFull(on) { document.body.toggleAttribute('data-full', on); }
  function stopLoops() { cancelAnimationFrame(frame); clearTimeout(endTimer); }

  function animateP(to, ms, done) {
    cancelAnimationFrame(frame);
    const from = curP;
    if (reduceMotion.matches) { setP(to); done && done(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setP(from + (to - from) * e);
      if (k < 1) frame = requestAnimationFrame(step);
      else done && done();
    };
    frame = requestAnimationFrame(step);
  }

  function paint(html) {
    dry.innerHTML = html;
    wetInner.innerHTML = html;
    syncScroll();
  }
  function setText(sel, text) {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.textContent !== text) el.textContent = text;
    });
  }
  function announce(msg) {
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 60);
  }
  function syncScroll() {
    wetInner.style.transform = `translateY(${-window.scrollY}px)`;
  }
  function setTitle(t) {
    document.title = `${IS_TEST ? '[test] ' : ''}${t}`;
  }

  function bar(left, right = '') {
    const tag = IS_TEST ? '<span class="tag">Test build</span>' : '';
    return `<header class="bar">${left}${tag ? `<p>${tag}</p>` : ''}${right}</header>`;
  }
  const dateLeft = () => `<p>${esc(longToday())}</p>`;
  const reportLink = '<a class="link" href="#report">Your report</a>';

  // ---------- session ----------

  const saveSession = () => store.set('session', session);
  const clearSession = () => { session = null; store.del('session'); };
  function elapsed() {
    const now = session.endedAt ?? session.pausedAt ?? Date.now();
    return Math.max(0, now - session.startedAt - session.pausedTotal);
  }

  // ---------- notifications, sound, wake lock ----------

  function primeAudio() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch {}
  }
  function chime() {
    if (!audio) return;
    try {
      audio.resume();
      const now = audio.currentTime;
      [[659.25, 0], [880, 0.4], [1318.5, 0.8]].forEach(([f, d]) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + d);
        g.gain.exponentialRampToValueAtTime(0.22, now + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.8);
        o.connect(g).connect(audio.destination);
        o.start(now + d);
        o.stop(now + d + 1.9);
      });
    } catch {}
  }
  function askNotify() {
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch {}
    }
  }
  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, tag: 'fifteen' });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {}
  }
  async function requestWake() {
    try {
      if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch {}
  }
  function releaseWake() {
    try { wakeLock && wakeLock.release(); } catch {}
    wakeLock = null;
  }

  // ---------- screens ----------

  function renderHome() {
    mode = 'home';
    stopLoops();
    setFull(false);
    setP(0);
    releaseWake();
    setTitle('Fifteen');

    const picked = pickedTask();
    const next = currentTask();
    let body;

    if (!TASKS.length) {
      body = `<main class="screen">
        <h1 class="task">Add a task to begin.</h1>
        <p class="hint">Tasks live in tasks.js. Add one, then reload this page.</p>
      </main>`;
    } else if (!next) {
      body = `<main class="screen">
        <p class="count">All ${TASKS.length} tasks done</p>
        <h1 class="task">You’ve been through the whole list.</h1>
        <p class="hint">Look over your report to see what to keep. When you’re ready, start the list again from the top.</p>
        <div class="actions">
          <a class="btn primary big" href="#report">See your report</a>
          <button class="btn" data-act="restart">Start the list again</button>
        </div>
      </main>`;
    } else if (doneToday() && !picked) {
      body = `<main class="screen">
        <p class="count">Done for today</p>
        <h1 class="task">See you tomorrow.</h1>
      </main>`;
    } else {
      const aside = next.early ? '<p class="aside">You can finish early once you’ve found it.</p>' : '';
      body = `<main class="screen">
        <h1 class="task">${esc(next.title)}</h1>
        ${next.hint ? `<p class="hint">${esc(next.hint)}</p>` : ''}
        <div class="actions">
          <button class="btn primary big" data-act="start">Start</button>
          ${aside}
        </div>
      </main>`;
    }

    if (IS_TEST && TASKS.length) body = body.replace('<main class="screen">', `<main class="screen">${pickerHtml(picked)}`);
    paint(`<div class="frame">${bar(dateLeft(), reportLink)}${body}</div>`);
  }

  function pickerHtml(picked) {
    const opts = TASKS.map((t) => `<option value="${esc(t.id)}"${picked === t ? ' selected' : ''}>${esc(t.title)}</option>`).join('');
    return `<label class="pick">Show task
      <select data-pick><option value="">Next in order</option>${opts}</select>
    </label>`;
  }

  function start() {
    const t = currentTask();
    primeAudio();
    askNotify();
    requestWake();
    session = { taskId: t.id, title: t.title, startedAt: null, pausedAt: null, pausedTotal: 0, endedAt: null, early: false };
    breathe();
  }

  function breathe() {
    mode = 'breathe';
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

  function startTimer() {
    session.startedAt = Date.now();
    saveSession();
    announce(IS_TEST ? 'Timer started. 5 seconds.' : 'Timer started. 15 minutes.');
    runTimer();
  }

  function runTimer() {
    mode = 'timer';
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

  function tick() {
    cancelAnimationFrame(frame);
    const e = elapsed();
    setP(Math.min(1, e / TOTAL_MS));
    const sec = Math.ceil(Math.max(0, TOTAL_MS - e) / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      setText('[data-clock]', fmtClock(sec));
      setTitle(session.pausedAt ? `Paused at ${fmtClock(sec)}` : `${fmtClock(sec)} left`);
    }
    if (e >= TOTAL_MS) { finish(false); return; }
    if (!session.pausedAt) frame = requestAnimationFrame(tick);
  }

  // rAF stops in background tabs; a timeout makes sure the end still fires.
  function schedule() {
    clearTimeout(endTimer);
    if (!session || session.pausedAt) return;
    endTimer = setTimeout(tick, Math.max(0, TOTAL_MS - elapsed()) + 50);
  }

  function togglePause() {
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

  function finish(early) {
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

  function renderReflect() {
    mode = 'reflect';
    stopLoops();
    releaseWake();
    setFull(true);
    setP(0);
    const t = taskById(session.taskId) || { title: session.title };
    setTitle(session.early ? 'Finished early' : 'Time’s up');
    paint(`<div class="frame">${bar(dateLeft())}
      <main class="screen reflect">
        <p class="count">${session.early ? 'Finished early' : 'Time’s up'}</p>
        <h1 class="task">${esc(t.title)}</h1>
        <form class="reflect-form" data-form novalidate>
          <fieldset class="choice">
            <legend>Would you do this again?</legend>
            <div class="options">
              <label class="opt"><input type="radio" name="again" value="yes"><span>Yes</span></label>
              <label class="opt"><input type="radio" name="again" value="unsure"><span>Not sure</span></label>
              <label class="opt"><input type="radio" name="again" value="no"><span>No</span></label>
            </div>
          </fieldset>
          <label class="note">
            <span>Anything to remember? Optional.</span>
            <input type="text" name="note" maxlength="280" autocomplete="off" placeholder="${t.early ? 'What did you find?' : 'How it went'}">
          </label>
          <div class="actions">
            <button class="btn primary big" type="submit">Mark complete</button>
          </div>
          <p class="form-error" data-error role="alert" hidden>Choose yes, not sure or no first.</p>
        </form>
      </main></div>`);
  }

  function save(form) {
    const again = form.querySelector('input[name="again"]:checked');
    const err = form.querySelector('[data-error]');
    if (!again) { err.hidden = false; form.querySelector('input[name="again"]').focus(); return; }
    const log = getLog();
    log.push({
      taskId: session.taskId,
      title: session.title,
      date: dayKey(),
      finishedAt: new Date().toISOString(),
      minutes: Math.max(1, Math.round(elapsed() / 60000)),
      early: !!session.early,
      again: again.value,
      note: form.note.value.trim(),
      cycle: getCycle(),
    });
    store.set('log', log);
    store.del('pick');
    clearSession();
    announce('Marked complete.');
    renderHome();
    setP(1);
    animateP(0, 1500);
  }

  function quit() {
    if (!confirm('End this session? It won’t be saved.')) return;
    clearSession();
    renderHome();
  }

  function restart() {
    if (!confirm('Start the list again from the first task? Your report keeps everything you’ve done.')) return;
    store.set('cycle', getCycle() + 1);
    location.hash = '';
    renderHome();
  }

  // ---------- report ----------

  const GROUPS = [
    { key: 'yes', name: 'Do again' },
    { key: 'unsure', name: 'Not sure' },
    { key: 'no', name: 'Skip next time' },
  ];

  function renderReport() {
    mode = 'report';
    stopLoops();
    setFull(false);
    setP(0);
    setTitle('Your report');

    const log = getLog();
    const byTask = new Map();
    for (const r of log) {
      const e = byTask.get(r.taskId) || { times: 0 };
      e.times += 1;
      e.last = r;
      byTask.set(r.taskId, e);
    }
    const groups = { yes: [], unsure: [], no: [] };
    for (const e of byTask.values()) (groups[e.last.again] || groups.unsure).push(e);
    for (const g of Object.values(groups)) g.sort((a, b) => b.last.finishedAt.localeCompare(a.last.finishedAt));

    const groupHtml = GROUPS.map(({ key, name }) => {
      const items = groups[key];
      const list = items.length
        ? `<ul class="items">${items.map(({ last, times }) => {
            const meta = [shortDate(last.date)];
            if (last.early) meta.push('finished early');
            if (times > 1) meta.push(`done ${times} times`);
            return `<li class="item">
              <p class="item-title">${esc(last.title)}</p>
              <p class="item-meta">${esc(meta.join(', '))}</p>
              ${last.note ? `<p class="item-note">${esc(last.note)}</p>` : ''}
            </li>`;
          }).join('')}</ul>`
        : '<p class="empty">None yet.</p>';
      return `<section class="group">
        <h2><span class="mark ${key}" aria-hidden="true"></span>${name}<span class="n">${items.length}</span></h2>
        ${list}
      </section>`;
    }).join('');

    paint(`<div class="frame">${bar('<p><a class="link" href="#today">Today’s task</a></p>')}
      <main class="report">
        <h1>Your report</h1>
        <div class="groups">${groupHtml}</div>
        <footer class="data">
          <button class="btn quiet" data-act="export">Export data</button>
          ${IS_TEST ? '<button class="btn quiet" data-act="clear">Clear test data</button>' : ''}
        </footer>
      </main></div>`);
  }

  function exportData() {
    const data = { app: 'fifteen', version: 1, exportedAt: new Date().toISOString(), cycle: getCycle(), log: getLog() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fifteen-${IS_TEST ? 'test-' : ''}${dayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearTest() {
    if (!confirm('Delete all test data in this browser?')) return;
    ['log', 'cycle', 'session', 'pick'].forEach(store.del);
    renderReport();
  }

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
  document.addEventListener('pointerdown', () => { if (mode === 'timer') primeAudio(); });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (mode === 'breathe' || mode === 'timer') requestWake();
    if (mode === 'timer') tick();
    if (mode === 'home') renderHome(); // the day may have changed
  });

  window.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener('resize', syncScroll);

  function route() {
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
    session = saved;
    if (!session.endedAt && elapsed() >= TOTAL_MS) {
      session.endedAt = session.startedAt + session.pausedTotal + TOTAL_MS;
      session.pausedAt = null;
      saveSession();
    }
    if (session.endedAt) renderReflect();
    else runTimer();
  } else {
    if (saved) store.del('session');
    route();
  }
})();

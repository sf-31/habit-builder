// The start screen: today's task, done for today, or the end of the list.
import {
  TASKS, IS_TEST, state, store, esc, getCycle, pickedTask, currentTask, doneToday,
  setP, setFull, stopLoops, paint, setTitle, bar, dateLeft, reportLink,
} from './core.js';
import { releaseWake } from './effects.js';

export function renderHome() {
  state.mode = 'home';
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

export function restart() {
  if (!confirm('Start the list again from the first task? Your report keeps everything you’ve done.')) return;
  store.set('cycle', getCycle() + 1);
  location.hash = '';
  renderHome();
}

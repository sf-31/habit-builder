// The start screen: today's task (or, in the choose build, a list to pick
// from), done for today, or the end of the list.
import {
  IS_TEST, IS_CHOOSE, state, store, esc, dry, shortDate, getLog, getTasks, getCycle, pickedTask, currentTask, doneToday,
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

  // Keep anything typed into the one-off box when the screen re-renders.
  const draft = dry.querySelector('[data-custom-form] input')?.value || '';
  const tasks = getTasks();
  const picked = pickedTask();
  const next = currentTask();
  let body;

  if (!tasks.length) {
    body = IS_CHOOSE
      ? `<main class="screen">
        <h1 class="task">Add a task to begin.</h1>
        <p class="hint">Make a list of things you’d like to spend fifteen minutes on. Each day, you pick one.</p>
        <div class="actions"><a class="btn primary big" href="#tasks">Add tasks</a></div>
      </main>`
      : `<main class="screen">
        <h1 class="task">Add a task to begin.</h1>
        <p class="hint">Tasks live in tasks.js. Add one, then reload this page.</p>
      </main>`;
  } else if (!IS_CHOOSE && !next) {
    body = `<main class="screen">
      <p class="count">All ${tasks.length} tasks done</p>
      <h1 class="task">You’ve been through the whole list.</h1>
      <p class="hint">Look over your report to see what to keep. When you’re ready, start the list again from the top.</p>
      <div class="actions">
        <a class="btn primary big" href="#report">See your report</a>
        <button class="btn" data-act="restart">Start the list again</button>
      </div>
    </main>`;
  } else if (doneToday() && !picked && !(IS_CHOOSE && IS_TEST)) {
    body = `<main class="screen">
      <p class="count">Done for today</p>
      <h1 class="task">See you tomorrow.</h1>
    </main>`;
  } else if (IS_CHOOSE) {
    body = chooseHtml(tasks, draft);
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

  if (IS_TEST && !IS_CHOOSE && tasks.length) body = body.replace('<main class="screen">', `<main class="screen">${pickerHtml(tasks, picked)}`);
  paint(`<div class="frame">${bar(dateLeft(), reportLink)}${body}</div>`);
}

// Choose build: every task is a button. Picking one starts it. Below the
// list, a one-off task that isn't on the list can be typed in and started.
function chooseHtml(tasks, draft) {
  const lastDone = new Map(getLog().map((r) => [r.taskId, r.date]));
  const items = tasks.map((t) => {
    const meta = [];
    if (lastDone.has(t.id)) meta.push(`Last done ${shortDate(lastDone.get(t.id))}`);
    if (t.early) meta.push('Can finish early');
    return `<li><button class="choose-item" data-act="choose" data-id="${esc(t.id)}">
      <span class="choose-title">${esc(t.title)}</span>
      ${t.hint ? `<span class="choose-hint">${esc(t.hint)}</span>` : ''}
      ${meta.length ? `<span class="choose-meta">${esc(meta.join(' · '))}</span>` : ''}
    </button></li>`;
  }).join('');
  return `<main class="screen choose">
    <h1 class="task">What will you do today?</h1>
    <ul class="choose-list">${items}</ul>
    <form class="custom-form" data-custom-form novalidate>
      <label class="note"><span>Or something else, just for today</span>
        <input type="text" name="custom" maxlength="120" autocomplete="off" value="${esc(draft)}"></label>
      <div class="actions"><button class="btn" type="submit">Start</button></div>
      <p class="form-error" data-error role="alert" hidden>Say what you’ll do first.</p>
    </form>
  </main>`;
}

// The one-off task typed into the choose screen, or null (with an error shown).
// Its id comes from its title, so doing the same thing twice counts as one task
// in the report, and it can't clash with a list task's id.
export function customTask(form) {
  const input = form.elements.custom;
  const title = input.value.trim();
  if (!title) { form.querySelector('[data-error]').hidden = false; input.focus(); return null; }
  return { id: `once:${title.toLowerCase()}`, title, custom: true };
}

function pickerHtml(tasks, picked) {
  const opts = tasks.map((t) => `<option value="${esc(t.id)}"${picked === t ? ' selected' : ''}>${esc(t.title)}</option>`).join('');
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

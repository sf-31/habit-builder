// After the timer: "Would you do this again?", then save to the log.
import {
  state, store, esc, dayKey, getLog, getCycle, taskById, setP, setFull, stopLoops, animateP,
  paint, announce, setTitle, bar, dateLeft, clearSession, elapsed,
} from './core.js';
import { releaseWake } from './effects.js';
import { renderHome } from './home.js';

export function renderReflect() {
  const session = state.session;
  state.mode = 'reflect';
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

export function save(form) {
  const session = state.session;
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

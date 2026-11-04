// After the timer: "Would you do this again?", then save to the log.
import {
  state, store, esc, dayKey, getLog, getCycle, taskById, setP, setFull, stopLoops, animateP,
  paint, announce, setTitle, bar, dateLeft, clearSession, usedMinutes, timeNote, sessionMinutes,
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
  // A one-off task from the choose screen skips the question and the note.
  const questions = session.custom ? '' : `<fieldset class="choice">
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
        </label>`;
  const used = timeNote(usedMinutes(), sessionMinutes(), session.early);
  paint(`<div class="frame">${bar(dateLeft())}
    <main class="screen reflect">
      <p class="count">${session.early ? 'Finished early' : 'Time’s up'}</p>
      <h1 class="task">${esc(t.title)}</h1>
      ${used ? `<p class="hint" data-used>${used[0].toUpperCase() + used.slice(1)}.</p>` : ''}
      <form class="reflect-form" data-form novalidate>
        ${questions}
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
  if (!again && !session.custom) { err.hidden = false; form.querySelector('input[name="again"]').focus(); return; }
  const log = getLog();
  log.push({
    taskId: session.taskId,
    title: session.title,
    date: dayKey(),
    finishedAt: new Date().toISOString(),
    minutes: usedMinutes(),
    length: sessionMinutes(),
    early: !!session.early,
    again: again ? again.value : null,
    note: session.custom ? '' : form.note.value.trim(),
    cycle: getCycle(),
    ...(session.custom && { custom: true }),
  });
  store.set('log', log);
  store.del('pick');
  clearSession();
  announce('Marked complete.');
  renderHome();
  setP(1);
  animateP(0, 1500);
}

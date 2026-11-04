// Choose build only (#tasks): add, edit and remove your own tasks.
import {
  BUILTIN, state, store, esc, dry, getTasks, setP, setFull, stopLoops, paint, announce, setTitle, bar,
} from './core.js';

let editing = null; // id of the task loaded into the form, or null when adding

export function renderManage() {
  state.mode = 'manage';
  stopLoops();
  setFull(false);
  setP(0);
  setTitle('Your tasks');

  const tasks = getTasks();
  const t = tasks.find((x) => x.id === editing);
  if (!t) editing = null;

  const list = tasks.length
    ? `<ul class="items">${tasks.map((x) => `<li class="item">
        <p class="item-title">${esc(x.title)}</p>
        ${x.hint ? `<p class="item-note">${esc(x.hint)}</p>` : ''}
        ${x.early ? '<p class="item-meta">Can finish early</p>' : ''}
        <p class="item-acts">
          <button class="btn quiet" data-act="edit-task" data-id="${esc(x.id)}">Edit</button>
          <button class="btn quiet" data-act="remove-task" data-id="${esc(x.id)}">Remove</button>
        </p>
      </li>`).join('')}</ul>`
    : `<p class="empty">No tasks yet.</p>
      ${BUILTIN.length ? '<p><button class="btn" data-act="starter">Start from the suggested list</button></p>' : ''}`;

  paint(`<div class="frame">${bar('<p><a class="link" href="#today">Today’s task</a></p>')}
    <main class="report manage">
      <h1>Your tasks</h1>
      <div class="manage-cols">
        <form class="task-form" data-task-form novalidate>
          <h2>${t ? 'Edit task' : 'Add a task'}</h2>
          <label class="note"><span>Task</span>
            <input type="text" name="task" maxlength="120" autocomplete="off" value="${t ? esc(t.title) : ''}"></label>
          <label class="note"><span>Hint. Optional.</span>
            <input type="text" name="hint" maxlength="200" autocomplete="off" value="${t?.hint ? esc(t.hint) : ''}"></label>
          <label class="check"><input type="checkbox" name="early"${t?.early ? ' checked' : ''}>
            <span>Can be finished early (for finding something, not doing something)</span></label>
          <div class="actions">
            <button class="btn primary" type="submit">${t ? 'Save changes' : 'Add task'}</button>
            ${t ? '<button class="btn quiet" type="button" data-act="cancel-edit">Cancel</button>' : ''}
          </div>
          <p class="form-error" data-error role="alert" hidden>Give the task a name first.</p>
        </form>
        <section class="group">
          <h2>Your list<span class="n">${tasks.length}</span></h2>
          ${list}
        </section>
      </div>
    </main></div>`);
}

export function saveTask(form) {
  const f = form.elements;
  const title = f.task.value.trim();
  if (!title) { form.querySelector('[data-error]').hidden = false; f.task.focus(); return; }
  const task = { title };
  const hint = f.hint.value.trim();
  if (hint) task.hint = hint;
  if (f.early.checked) task.early = true;

  const tasks = getTasks();
  const i = tasks.findIndex((x) => x.id === editing);
  if (i >= 0) tasks[i] = { id: editing, ...task };
  else tasks.push({ id: newId(), ...task });
  store.set('tasks', tasks);
  announce(i >= 0 ? 'Task saved.' : 'Task added.');
  editing = null;
  renderManage();
  dry.querySelector('input[name="task"]').focus();
}

// Ids are never reused, even after a task is removed, so the report stays right.
function newId() {
  const n = store.get('nextId', 1);
  store.set('nextId', n + 1);
  return `c${n}`;
}

export function editTask(b) {
  editing = b.dataset.id;
  renderManage();
  dry.querySelector('input[name="task"]').focus();
}

export function cancelEdit() {
  editing = null;
  renderManage();
}

export function removeTask(b) {
  const tasks = getTasks();
  const t = tasks.find((x) => x.id === b.dataset.id);
  if (!confirm(`Remove “${t.title}”? Your report keeps everything you’ve done.`)) return;
  store.set('tasks', tasks.filter((x) => x !== t));
  announce('Task removed.');
  renderManage();
}

export function useStarter() {
  store.set('tasks', BUILTIN.map((t) => ({ ...t })));
  renderManage();
}

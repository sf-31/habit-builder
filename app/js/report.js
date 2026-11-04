// The report: every task grouped by whether you'd do it again, plus export.
import {
  IS_TEST, state, store, esc, dayKey, shortDate, getLog, getCycle,
  setP, setFull, stopLoops, paint, setTitle, bar,
} from './core.js';

const GROUPS = [
  { key: 'yes', name: 'Do again' },
  { key: 'unsure', name: 'Not sure' },
  { key: 'no', name: 'Skip next time' },
];

export function renderReport() {
  state.mode = 'report';
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

export function exportData() {
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

export function clearTest() {
  if (!confirm('Delete all test data in this browser?')) return;
  ['log', 'cycle', 'session', 'pick'].forEach(store.del);
  renderReport();
}

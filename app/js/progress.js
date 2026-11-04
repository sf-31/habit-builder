// How often a task gets done this week and this month, against a target.
// Days before your first-ever task don't count, so a new start isn't
// marked down for days you weren't using the app.
import { store, dry, dayKey, getLog } from './core.js';

export const MIN_TARGET = 5;
export const MAX_TARGET = 100;
const STEP_TARGET = 5;
const DEFAULT_TARGET = 80;

export const getTarget = () => {
  const t = store.get('target', DEFAULT_TARGET);
  return Number.isInteger(t) && t % STEP_TARGET === 0 && t >= MIN_TARGET && t <= MAX_TARGET ? t : DEFAULT_TARGET;
};

const unitDays = (n) => (n === 1 ? 'day' : 'days');
const plural = (n) => `${n} ${unitDays(n)}`;
const keysFrom = (first, length) => Array.from({ length }, (_, i) =>
  dayKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)));

// Each day is done, missed, today (not done yet), later, or before you started.
function period(name, unit, keys, ctx) {
  const { today, start, done, target } = ctx;
  const cells = keys.map((k) => (k > today ? 'later' : k < start ? 'before' : done.has(k) ? 'done' : k === today ? 'today' : 'missed'));
  const count = (...s) => cells.filter((c) => s.includes(c)).length;
  const hit = count('done');
  const counted = count('done', 'missed');
  const left = count('today', 'later');
  const need = Math.ceil((target * (cells.length - count('before'))) / 100) - hit;

  let cls = 'ok';
  let status;
  if (!counted || hit * 100 >= target * counted) {
    status = need > 0
      ? `On track. ${need} more ${unitDays(need)} this ${unit} reaches ${target}%.`
      : `You’ve reached ${target}% this ${unit}.`;
  } else if (need <= left) {
    cls = 'behind';
    status = `Behind. Do a task on ${need} of the ${plural(left)} left to reach ${target}%.`;
  } else {
    cls = 'off';
    status = `${target}% is out of reach this ${unit}. The most you can get to is ${Math.floor(((hit + left) * 100) / (cells.length - count('before')))}%.`;
  }

  const pct = counted ? Math.round((hit * 100) / counted) : null;
  // Monday-first calendar: the first day sits in its weekday's column.
  const [y, m, d] = keys[0].split('-').map(Number);
  const col = ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
  const dots = cells.map((c, i) => `<li class="day ${c}"${i ? '' : ` style="grid-column-start:${col}"`}></li>`).join('');

  return `<section class="rate">
    <h2>${name}</h2>
    <p class="rate-pct">${pct == null ? '—' : `${pct}%`}</p>
    <p class="rate-of">${counted ? `${hit} of ${plural(counted)}` : 'No days yet'}</p>
    <div class="meter" aria-hidden="true">
      <span class="meter-fill" style="width:${pct ?? 0}%"></span>
      <span class="meter-target" style="left:${target}%"></span>
    </div>
    <ol class="days" aria-hidden="true">${dots}</ol>
    <p class="rate-status ${cls}">${status}</p>
  </section>`;
}

export function progressHtml() {
  const log = getLog();
  const now = new Date();
  const today = dayKey(now);
  const ctx = {
    today,
    start: log.reduce((min, r) => (r.date < min ? r.date : min), today),
    done: new Set(log.map((r) => r.date)),
    target: getTarget(),
  };
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const t = ctx.target;

  return `<div class="progress">
    <div class="length target" role="group" aria-label="Target">
      <span>Aim for a task on</span>
      <button class="step" data-act="target-down" aria-label="Lower target"${t <= MIN_TARGET ? ' disabled' : ''}>−</button>
      <span class="length-value" data-target aria-live="polite">${t}%</span>
      <button class="step" data-act="target-up" aria-label="Raise target"${t >= MAX_TARGET ? ' disabled' : ''}>+</button>
      <span>of days</span>
    </div>
    <div class="rates">
      ${period('This week', 'week', keysFrom(monday, 7), ctx)}
      ${period('This month', 'month', keysFrom(first, monthDays), ctx)}
    </div>
  </div>`;
}

// Steps the target, re-renders with `render`, and keeps focus on the stepper.
export function changeTarget(dir, render) {
  store.set('target', Math.min(MAX_TARGET, Math.max(MIN_TARGET, getTarget() + dir * STEP_TARGET)));
  render();
  const [first, other] = dir < 0 ? ['target-down', 'target-up'] : ['target-up', 'target-down'];
  const b = dry.querySelector(`[data-act="${first}"]`);
  (b.disabled ? dry.querySelector(`[data-act="${other}"]`) : b).focus();
}

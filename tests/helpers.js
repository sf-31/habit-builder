// Shared constants and helpers for the spec files.
const { test, expect } = require('./fixtures');

const MAIN = '/';
const TEST = '/test/';
const MORNING = new Date('2026-11-03T09:00:00');
const FIFTEEN_MIN = 15 * 60 * 1000;

// ---------- helpers ----------

const dry = (page, sel) => page.locator(`#dry ${sel}`);
const heading = (page) => dry(page, 'h1');
const btn = (page, name) => dry(page, `button:text-is("${name}")`);

// Time in the page only moves when a test moves it.
async function open(page, path = MAIN, { time = MORNING } = {}) {
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.goto(path);
}

// Lets the app's short timers and animations finish.
const settle = (page) => page.clock.runFor(2000);

// Writes app storage, then reloads so the app boots with it.
async function seed(page, path, data) {
  const prefix = path === TEST ? 'fifteen:test:' : 'fifteen:';
  await page.evaluate(({ prefix, data }) => {
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(prefix + k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }, { prefix, data });
  await page.reload();
}

const stored = (page, key, path = MAIN) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), (path === TEST ? 'fifteen:test:' : 'fifteen:') + key);

const calls = (page) => page.evaluate(() => window.__calls);

const entry = (taskId, title, over = {}) => ({
  taskId, title, date: '2026-11-01', finishedAt: '2026-11-01T10:00:00.000Z',
  minutes: 15, early: false, again: 'yes', note: '', cycle: 1, ...over,
});

async function startTask(page) {
  await btn(page, 'Start').click();
  await btn(page, 'Start task').click();
  await page.clock.runFor(100);
}

// Jumps the clock forward, then lets a few frames run so the screen catches up.
async function advance(page, ms) {
  await page.clock.fastForward(ms);
  await page.clock.runFor(100);
}

// Runs the timer out and waits for the tide animation to finish.
async function runOut(page, ms = FIFTEEN_MIN) {
  await page.clock.fastForward(ms + 100);
  await settle(page);
  await expect(dry(page, '.count')).toHaveText('Time’s up');
}

async function complete(page, answer = 'Yes', note = '') {
  await dry(page, `.opt:has(span:text-is("${answer}"))`).click();
  if (note) await dry(page, 'input[name=note]').fill(note);
  await btn(page, 'Mark complete').click();
  await settle(page);
}

module.exports = {
  test, expect, MAIN, TEST, MORNING, FIFTEEN_MIN, dry, heading, btn, open, settle, seed, stored, calls, entry, startTask, advance, runOut, complete,
};

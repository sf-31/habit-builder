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

// ---------- start screen ----------

test.describe('start screen', () => {
  test('shows the first task, today’s date and a report link', async ({ page }) => {
    await open(page);
    await expect(heading(page)).toHaveText('Do stream of consciousness writing (like morning pages)');
    await expect(dry(page, '.bar')).toContainText('Tuesday, November 3');
    await expect(dry(page, 'a[href="#report"]')).toHaveText('Your report');
    await expect(page).toHaveTitle('Fifteen');
    await expect(dry(page, '.tag')).toHaveCount(0);
    await expect(dry(page, '[data-pick]')).toHaveCount(0);
    await expect(dry(page, '.aside')).toHaveCount(0);
  });

  test('tasks you can finish early say so', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: [entry('morning-pages', 'x')] });
    await page.clock.setSystemTime(new Date('2026-11-04T09:00:00'));
    await page.reload();
    await expect(heading(page)).toHaveText('Find a new musical artist to listen to');
    await expect(dry(page, '.aside')).toHaveText('You can finish early once you’ve found it.');
  });

  test('tasks run in order and a missed day shows the same task', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: [entry('morning-pages', 'x', { date: '2026-10-20' })] });
    // Two weeks later, the next task is still the second one.
    await expect(heading(page)).toHaveText('Find a new musical artist to listen to');
  });

  test('after finishing, today shows done and tomorrow shows the next task', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: [entry('morning-pages', 'x', { date: '2026-11-03' })] });
    await expect(dry(page, '.count')).toHaveText('Done for today');
    await expect(heading(page)).toHaveText('See you tomorrow.');
    await expect(dry(page, '[data-act=start]')).toHaveCount(0);

    await page.clock.setSystemTime(new Date('2026-11-04T08:00:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(heading(page)).toHaveText('Find a new musical artist to listen to');
  });

  test('a hidden tab does not re-render', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { window.__hidden = true; document.querySelector('#dry h1').textContent = 'marker'; });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(heading(page)).toHaveText('marker');
  });

  test('task names are escaped and hints are shown', async ({ page }) => {
    await page.route('**/tasks.js', (r) => r.fulfill({
      contentType: 'text/javascript',
      body: `window.TASKS = [{ id: 'a', title: 'Tom & <b>Jerry</b>', hint: 'Use "quotes"' }];`,
    }));
    await open(page);
    await expect(heading(page)).toHaveText('Tom & <b>Jerry</b>');
    await expect(dry(page, '.hint')).toHaveText('Use "quotes"');
  });

  test('an empty task list asks you to add one', async ({ page }) => {
    await page.route('**/tasks.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.TASKS = [];' }));
    await open(page);
    await expect(heading(page)).toHaveText('Add a task to begin.');
  });

  test('a missing task list is treated as empty', async ({ page }) => {
    await page.route('**/tasks.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await open(page);
    await expect(heading(page)).toHaveText('Add a task to begin.');
  });

  test('unreadable saved data is ignored', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: '{not json', session: '{nope' });
    await expect(heading(page)).toHaveText('Do stream of consciousness writing (like morning pages)');
  });

  test.describe('when storage refuses writes', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
        Storage.prototype.removeItem = () => { throw new Error('SecurityError'); };
      });
    });
    test('the flow still works for this visit', async ({ page }) => {
      await open(page);
      await startTask(page);
      await page.clock.fastForward(FIFTEEN_MIN + 100);
      await settle(page);
      await expect(dry(page, '.count')).toHaveText('Time’s up');
      // Nothing could be saved, so the same task is still waiting.
      await complete(page);
      await expect(heading(page)).toHaveText('Do stream of consciousness writing (like morning pages)');
    });
  });

  test('reopening long after the timer ran out goes to the question', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, {
      session: { taskId: 'walk', title: 'Go on a walk', startedAt: MORNING.getTime() - 2 * FIFTEEN_MIN, pausedAt: MORNING.getTime() - FIFTEEN_MIN, pausedTotal: 0, endedAt: null },
    });
    await expect(dry(page, '.count')).toHaveText('Time’s up');
    const session = await stored(page, 'session');
    expect(session.pausedAt).toBeNull();
    expect(session.endedAt).toBe(MORNING.getTime() - FIFTEEN_MIN);
  });

  test('a session that never reached the timer is discarded', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { session: { taskId: 'walk', title: 'Go on a walk', startedAt: null } });
    await expect(dry(page, '[data-act=start]')).toBeVisible();
    expect(await stored(page, 'session')).toBeNull();
  });
});

// ---------- breathing and timer ----------

test.describe('breathing and timer', () => {
  test('breathing page gives the direction only, and the timer waits for you', async ({ page }) => {
    await open(page);
    await btn(page, 'Start').click();
    await expect(heading(page)).toHaveText('Take ten deep breaths.');
    await expect(dry(page, '.hint')).toHaveText('Breathe in for five seconds, then out for five.');
    await expect(dry(page, 'main')).not.toContainText('stream of consciousness');
    await expect(dry(page, 'main')).not.toContainText('timer');
    await expect(page).toHaveTitle('Breathe');

    await page.clock.fastForward(5 * 60 * 1000);
    await expect(heading(page)).toHaveText('Take ten deep breaths.');
    await expect(dry(page, '[data-clock]')).toHaveCount(0);

    await btn(page, 'Start task').click();
    await page.clock.runFor(100);
    await expect(dry(page, '[data-clock]')).toHaveText('15:00');
    await expect(dry(page, '.bar-task')).toHaveText('Do stream of consciousness writing (like morning pages)');
    await expect(page.locator('#live')).toHaveText('Timer started. 15 minutes.');
  });

  test('the timer counts down and the tide rises', async ({ page }) => {
    await open(page);
    await startTask(page);
    await advance(page, 60 * 1000);
    await expect(dry(page, '[data-clock]')).toHaveText('14:00');
    await expect(page).toHaveTitle('14:00 left');
    const p = await page.evaluate(() => Number(document.documentElement.style.getPropertyValue('--p')));
    expect(p).toBeCloseTo(1 / 15, 2);
  });

  test('pause freezes the clock and resume continues', async ({ page }) => {
    await open(page);
    await startTask(page);
    await advance(page, 30 * 1000);
    await btn(page, 'Pause').click();
    await expect(btn(page, 'Resume')).toBeVisible();
    await expect(page).toHaveTitle('Paused at 14:30');
    await expect(page.locator('body')).toHaveAttribute('data-paused', '');
    expect((await stored(page, 'session')).pausedAt).not.toBeNull();

    await page.clock.fastForward(20 * 60 * 1000);
    await expect(dry(page, '[data-clock]')).toHaveText('14:30');

    await btn(page, 'Resume').click();
    await expect(btn(page, 'Pause')).toBeVisible();
    await advance(page, 30 * 1000);
    await expect(dry(page, '[data-clock]')).toHaveText('14:00');
    await expect(page.locator('body')).not.toHaveAttribute('data-paused', '');
  });

  test('buttons still work while paused', async ({ page }) => {
    await open(page);
    await startTask(page);
    await btn(page, 'Pause').click();
    await btn(page, 'Resume').click({ timeout: 2000 });
    await btn(page, 'Pause').click({ timeout: 2000 });
    page.once('dialog', (d) => d.dismiss());
    await btn(page, 'End without saving').click({ timeout: 2000 });
    await expect(btn(page, 'Resume')).toBeVisible();
  });

  test('end without saving asks first', async ({ page }) => {
    await open(page);
    await startTask(page);
    page.once('dialog', (d) => d.dismiss());
    await btn(page, 'End without saving').click();
    await expect(dry(page, '[data-clock]')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await btn(page, 'End without saving').click();
    await expect(btn(page, 'Start')).toBeVisible();
    expect(await stored(page, 'session')).toBeNull();
    expect(await stored(page, 'log')).toBeNull();
  });

  test('reloading mid-timer picks up where it was', async ({ page }) => {
    await open(page);
    await startTask(page);
    await advance(page, 2 * 60 * 1000);
    await page.reload();
    await expect(dry(page, '[data-clock]')).toHaveText('13:00');
  });

  test('reloading while paused stays paused', async ({ page }) => {
    await open(page);
    await startTask(page);
    await btn(page, 'Pause').click();
    await page.reload();
    await expect(btn(page, 'Resume')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-paused', '');
  });

  test('reopening after the time ran out goes to the question', async ({ page }) => {
    await open(page);
    await startTask(page);
    await page.evaluate(() => { window.__hidden = true; });
    await page.reload();
    await page.clock.fastForward(FIFTEEN_MIN + 1000);
    await page.reload();
    await expect(dry(page, '.count')).toHaveText('Time’s up');
    expect((await stored(page, 'session')).endedAt).not.toBeNull();
    await page.reload();
    await expect(dry(page, '.count')).toHaveText('Time’s up');
  });

  test('a session for a task that was since removed keeps its name', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, {
      session: { taskId: 'gone', title: 'Old task', startedAt: MORNING.getTime(), pausedAt: null, pausedTotal: 0, endedAt: null },
    });
    await expect(dry(page, '.bar-task')).toHaveText('Old task');
    await dry(page, '[data-act=pause]').click();
    await page.clock.fastForward(1000);
    await seed(page, MAIN, {
      session: { taskId: 'gone', title: 'Old task', startedAt: MORNING.getTime(), pausedAt: null, pausedTotal: 0, endedAt: MORNING.getTime() + 1000, early: true },
    });
    await expect(heading(page)).toHaveText('Old task');
  });

  test('going to the report mid-session is ignored', async ({ page }) => {
    await open(page);
    await startTask(page);
    await page.evaluate(() => { location.hash = '#report'; });
    await expect(dry(page, '[data-clock]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('');

    // The same happens with no hash at all.
    await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
    await expect(dry(page, '[data-clock]')).toBeVisible();
  });

  test('returning to the tab refreshes the timer and wake lock', async ({ page }) => {
    await open(page);
    await btn(page, 'Start').click();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await btn(page, 'Start task').click();
    await page.evaluate(() => { window.__hidden = true; });
    await page.clock.fastForward(60 * 1000);
    await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await expect(dry(page, '[data-clock]')).toHaveText('14:00');
    expect((await calls(page)).filter((c) => c === 'wake').length).toBeGreaterThanOrEqual(1);
  });

  test('scrolling keeps the tide layer aligned', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: Array.from({ length: 12 }, (_, i) => entry(`t${i}`, `Task ${i}`)) });
    await page.goto(`${MAIN}#report`);
    await page.setViewportSize({ width: 400, height: 300 });
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('.wet-inner').style.transform === `translateY(${-window.scrollY}px)`)).toBe(true);
  });
});

// ---------- finishing ----------

test.describe('finishing', () => {
  test.describe('with notifications allowed', () => {
    test.use({ stubs: { permission: 'granted' } });

    test('time’s up chimes, vibrates and notifies', async ({ page }) => {
      await open(page);
      await startTask(page);
      await runOut(page);
      const c = await calls(page);
      expect(c).toContain('osc');
      expect(c).toContain('vibrate:250,120,250');
      expect(c).toContain('notify:Time’s up:Do stream of consciousness writing (like morning pages)');
      expect(c).not.toContain('requestPermission');
      await expect(page.locator('#live')).toHaveText('Time’s up.');
      await expect(page.locator('body')).toHaveAttribute('data-full', '');

      await page.evaluate(() => window.__lastNotification.onclick());
      expect(await calls(page)).toEqual(expect.arrayContaining(['focus', 'close']));
    });
  });

  test('asks for notification permission when starting', async ({ page }) => {
    await open(page);
    await btn(page, 'Start').click();
    expect(await calls(page)).toContain('requestPermission');
  });

  test.describe('with notifications blocked', () => {
    test.use({ stubs: { permission: 'denied' } });
    test('does not notify', async ({ page }) => {
      await open(page);
      await startTask(page);
      await runOut(page);
      const c = await calls(page);
      expect(c.some((x) => x.startsWith('notify'))).toBe(false);
      expect(c).not.toContain('requestPermission');
    });
  });

  test('you must answer before marking complete', async ({ page }) => {
    await open(page);
    await startTask(page);
    await runOut(page);
    await expect(heading(page)).toHaveText('Do stream of consciousness writing (like morning pages)');
    await expect(dry(page, 'input[name=note]')).toHaveAttribute('placeholder', 'How it went');
    await btn(page, 'Mark complete').click();
    await expect(dry(page, '[data-error]')).toBeVisible();
    await dry(page, '.opt:has(span:text-is("No"))').click();
    await expect(dry(page, '[data-error]')).toBeHidden();
  });

  test('marking complete saves the answer and note', async ({ page }) => {
    await open(page);
    await startTask(page);
    await runOut(page);
    await complete(page, 'Not sure', '  three pages  ');
    await expect(heading(page)).toHaveText('See you tomorrow.');
    await expect(page.locator('#live')).toHaveText('Marked complete.');
    const [rec] = await stored(page, 'log');
    expect(rec).toMatchObject({
      taskId: 'morning-pages', title: 'Do stream of consciousness writing (like morning pages)',
      date: '2026-11-03', minutes: 15, early: false, again: 'unsure', note: 'three pages', cycle: 1,
    });
    expect(await stored(page, 'session')).toBeNull();
  });

  test('done early ends the timer for tasks with a goal', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: [entry('morning-pages', 'x', { date: '2026-11-02' })] });
    await startTask(page);
    await advance(page, 4 * 60 * 1000);
    await btn(page, 'Pause').click();
    await btn(page, 'Done early').click();
    await settle(page);
    await expect(dry(page, '.count')).toHaveText('Finished early');
    await expect(page).toHaveTitle('Finished early');
    await expect(dry(page, 'input[name=note]')).toHaveAttribute('placeholder', 'What did you find?');
    expect(await calls(page)).not.toContain('osc');
    await complete(page, 'Yes', 'Big Thief');
    const log = await stored(page, 'log');
    expect(log[1]).toMatchObject({ taskId: 'new-artist', early: true, minutes: 4, note: 'Big Thief' });
  });

  test('tasks without a goal have no done early button', async ({ page }) => {
    await open(page);
    await startTask(page);
    await expect(btn(page, 'Done early')).toHaveCount(0);
  });

  test.describe('with reduced motion', () => {
    test('the tide jumps instead of animating', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page);
      await seed(page, MAIN, { log: [entry('morning-pages', 'x', { date: '2026-11-02' })] });
      await startTask(page);
      // No clock ticks needed: with reduced motion nothing animates.
      await btn(page, 'Done early').click();
      await expect(dry(page, '.count')).toHaveText('Finished early');
      await dry(page, '.opt:has(span:text-is("Yes"))').click();
      await btn(page, 'Mark complete').click();
      await expect(heading(page)).toHaveText('See you tomorrow.');
      expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--p'))).toBe('0.0000');
    });
  });
});

// ---------- browser features that fail or are missing ----------

test.describe('when browser features fail', () => {
  test.use({
    stubs: {
      audioThrows: true, permissionThrows: true, wakeThrows: true, vibrateThrows: true,
      permission: 'granted', notifyThrows: true,
    },
  });
  test('the flow still works', async ({ page }) => {
    await open(page);
    await startTask(page);
    await runOut(page);
    await complete(page);
    await expect(heading(page)).toHaveText('See you tomorrow.');
  });
});

test.describe('when asking for notification permission fails', () => {
  test.use({ stubs: { permissionThrows: true } });
  test('starting still works', async ({ page }) => {
    await open(page);
    await btn(page, 'Start').click();
    await expect(heading(page)).toHaveText('Take ten deep breaths.');
  });
});

test.describe('when the chime and releasing the wake lock fail', () => {
  test.use({ stubs: { chimeThrows: true, releaseThrows: true, permission: 'granted' } });
  test('the flow still works', async ({ page }) => {
    await open(page);
    await startTask(page);
    await runOut(page);
    await expect(page.locator('#live')).toHaveText('Time’s up.');
  });
});

test.describe('when the browser has none of these features', () => {
  test.use({ stubs: { noAudio: true, noNotification: true, noWakeLock: true, noVibrate: true } });
  test('the flow still works', async ({ page }) => {
    await open(page);
    await startTask(page);
    await runOut(page);
    await complete(page);
    await expect(heading(page)).toHaveText('See you tomorrow.');
  });
});

test('the wake lock is released when the timer ends', async ({ page }) => {
  await open(page);
  await startTask(page);
  await runOut(page);
  expect(await calls(page)).toContain('release');
});

test('tapping during a restored timer re-enables sound', async ({ page }) => {
  await open(page);
  await startTask(page);
  await page.reload();
  expect(await calls(page)).not.toContain('audio');
  await dry(page, '[data-clock]').dispatchEvent('pointerdown');
  expect(await calls(page)).toContain('audio');
  // Pointer events elsewhere don't create audio.
  await page.evaluate(() => { window.__calls.length = 0; });
  await btn(page, 'Pause').click();
  page.once('dialog', (d) => d.accept());
  await btn(page, 'End without saving').click();
  await dry(page, 'h1').dispatchEvent('pointerdown');
  expect((await calls(page)).filter((c) => c === 'audio')).toHaveLength(0);
});

// ---------- report ----------

test.describe('report', () => {
  test('groups tasks by whether you’d do them again', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, {
      log: [
        entry('walk', 'Go on a walk', { again: 'no', date: '2026-10-28', finishedAt: '2026-10-28T10:00:00Z' }),
        entry('walk', 'Go on a walk', { again: 'yes', date: '2026-11-01', finishedAt: '2026-11-01T10:00:00Z', cycle: 2 }),
        entry('meditate', 'Meditate', { again: 'yes', date: '2026-11-02', finishedAt: '2026-11-02T10:00:00Z' }),
        entry('recipe', 'Find a recipe', { again: 'no', early: true, note: '<script>x</script>' }),
        entry('odd', 'Odd answer', { again: 'maybe' }),
      ],
    });
    await page.goto(`${MAIN}#report`);
    await expect(heading(page)).toHaveText('Your report');
    await expect(page).toHaveTitle('Your report');

    const group = (name) => dry(page, `.group:has(h2:has-text("${name}"))`);
    await expect(group('Do again').locator('.item-title')).toHaveText(['Meditate', 'Go on a walk']);
    await expect(group('Do again').locator('.n')).toHaveText('2');
    await expect(group('Do again').locator('.item-meta').nth(1)).toHaveText('Nov 1, done 2 times');
    await expect(group('Skip next time').locator('.item-meta')).toHaveText('Nov 1, finished early');
    await expect(group('Skip next time').locator('.item-note')).toHaveText('<script>x</script>');
    await expect(group('Not sure').locator('.item-title')).toHaveText('Odd answer');
    await expect(dry(page, 'main')).not.toContainText('Still to come');
    await expect(dry(page, 'main')).not.toContainText('Import');
    await expect(btn(page, 'Clear test data')).toHaveCount(0);
  });

  test('an empty report shows empty groups only', async ({ page }) => {
    await open(page, `${MAIN}#report`);
    await expect(dry(page, '.empty')).toHaveText(['None yet.', 'None yet.', 'None yet.']);
    await expect(dry(page, '.summary')).toHaveCount(0);
  });

  test('links back to today’s task', async ({ page }) => {
    await open(page, `${MAIN}#report`);
    await dry(page, 'a:has-text("Today’s task")').click();
    await expect(btn(page, 'Start')).toBeVisible();
    await dry(page, 'a:has-text("Your report")').click();
    await expect(heading(page)).toHaveText('Your report');
  });

  test('exports history as a JSON file', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: [entry('walk', 'Go on a walk')], cycle: 2 });
    await page.goto(`${MAIN}#report`);
    const [download] = await Promise.all([page.waitForEvent('download'), btn(page, 'Export data').click()]);
    expect(download.suggestedFilename()).toBe('fifteen-2026-11-03.json');
    const data = JSON.parse(await (await download.createReadStream()).toArray().then((b) => Buffer.concat(b).toString()));
    expect(data).toMatchObject({ app: 'fifteen', version: 1, cycle: 2, log: [{ taskId: 'walk' }] });
    await page.clock.runFor(1500);
  });
});

// ---------- end of the list ----------

test.describe('end of the list', () => {
  const allDone = () => ['a', 'b'].map((id) => entry(id, id.toUpperCase(), { date: '2026-11-01' }));

  test.beforeEach(async ({ page }) => {
    await page.route('**/tasks.js', (r) => r.fulfill({
      contentType: 'text/javascript',
      body: `window.TASKS = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];`,
    }));
  });

  test('says you’re done and offers to start again', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: allDone() });
    await expect(dry(page, '.count')).toHaveText('All 2 tasks done');
    await expect(heading(page)).toHaveText('You’ve been through the whole list.');

    page.once('dialog', (d) => d.dismiss());
    await btn(page, 'Start the list again').click();
    expect(await stored(page, 'cycle')).toBeNull();

    page.once('dialog', (d) => d.accept());
    await btn(page, 'Start the list again').click();
    expect(await stored(page, 'cycle')).toBe(2);
    await expect(heading(page)).toHaveText('A');
  });

  test('see your report link works', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { log: allDone() });
    await dry(page, 'a:has-text("See your report")').click();
    await expect(heading(page)).toHaveText('Your report');
  });
});

// ---------- test build ----------

test.describe('test build', () => {
  test('is marked, uses a 5-second timer and keeps its own data', async ({ page }) => {
    await open(page, TEST);
    await expect(dry(page, '.tag')).toHaveText('Test build');
    await expect(page).toHaveTitle('[test] Fifteen');
    await startTask(page);
    await expect(dry(page, '[data-clock]')).toHaveText('0:05');
    await expect(page.locator('#live')).toHaveText('Timer started. 5 seconds.');
    await runOut(page, 5000);
    await complete(page);
    expect(await stored(page, 'log', TEST)).toHaveLength(1);
    expect(await stored(page, 'log', MAIN)).toBeNull();
    expect((await stored(page, 'log', TEST))[0].minutes).toBe(1);
  });

  test('lets you pick which task is shown', async ({ page }) => {
    await open(page, TEST);
    const picker = dry(page, '[data-pick]');
    await expect(picker).toHaveValue('');
    await picker.selectOption('wait-wait');
    await expect(heading(page)).toHaveText('Listen to Wait Wait... Don’t Tell Me!');
    await expect(dry(page, '[data-pick]')).toBeFocused();
    await page.reload();
    await expect(dry(page, '[data-pick]')).toHaveValue('wait-wait');

    await startTask(page);
    await expect(dry(page, '.bar-task')).toHaveText('Listen to Wait Wait... Don’t Tell Me!');
    await runOut(page, 5000);
    await complete(page);
    await expect(heading(page)).toHaveText('See you tomorrow.');
    expect((await stored(page, 'log', TEST))[0].taskId).toBe('wait-wait');
    expect(await stored(page, 'pick', TEST)).toBeNull();

    // A picked task shows even when today's is done.
    await dry(page, '[data-pick]').selectOption('meditate');
    await expect(heading(page)).toHaveText('Meditate');
    await dry(page, '[data-pick]').selectOption('');
    await expect(heading(page)).toHaveText('See you tomorrow.');
  });

  test('the picker is not shown when there are no tasks', async ({ page }) => {
    await page.route('**/tasks.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.TASKS = [];' }));
    await open(page, TEST);
    await expect(dry(page, '[data-pick]')).toHaveCount(0);
  });

  test('exports with a test file name and can clear test data', async ({ page }) => {
    await open(page, TEST);
    await seed(page, TEST, { log: [entry('walk', 'Go on a walk')], pick: 'walk' });
    await page.goto(`${TEST}#report`);
    const [download] = await Promise.all([page.waitForEvent('download'), btn(page, 'Export data').click()]);
    expect(download.suggestedFilename()).toBe('fifteen-test-2026-11-03.json');

    page.once('dialog', (d) => d.dismiss());
    await btn(page, 'Clear test data').click();
    expect(await stored(page, 'log', TEST)).toHaveLength(1);

    page.once('dialog', (d) => d.accept());
    await btn(page, 'Clear test data').click();
    await expect(dry(page, '.empty')).toHaveCount(3);
    expect(await stored(page, 'log', TEST)).toBeNull();
    expect(await stored(page, 'pick', TEST)).toBeNull();
  });
});

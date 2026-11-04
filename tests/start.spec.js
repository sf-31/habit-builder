const { test, expect, MAIN, MORNING, FIFTEEN_MIN, dry, heading, open, settle, seed, stored, entry, startTask, complete } = require('./helpers');

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


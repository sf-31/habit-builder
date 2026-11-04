const { test, expect, MAIN, MORNING, FIFTEEN_MIN, dry, heading, btn, open, seed, stored, calls, entry, startTask, advance } = require('./helpers');

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


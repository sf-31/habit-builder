const { test, expect, MAIN, dry, heading, btn, open, settle, seed, stored, calls, entry, startTask, advance, runOut, complete } = require('./helpers');

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
    await expect(dry(page, '[data-used]')).toHaveCount(0);
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
    await expect(dry(page, '[data-used]')).toHaveText('Finished early after 4 of 15 min.');
    expect(await calls(page)).not.toContain('osc');
    await complete(page, 'Yes', 'Big Thief');
    const log = await stored(page, 'log');
    expect(log[1]).toMatchObject({ taskId: 'new-artist', early: true, minutes: 4, length: 15, note: 'Big Thief' });
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


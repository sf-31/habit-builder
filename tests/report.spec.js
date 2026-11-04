const { test, expect, MAIN, TEST, dry, heading, btn, open, seed, stored, entry, startTask, runOut, complete } = require('./helpers');

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

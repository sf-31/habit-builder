const { test, expect, MAIN, CHOOSE, TEST_CHOOSE, dry, heading, btn, open, settle, seed, stored, entry, runOut, complete } = require('./helpers');

const mine = [
  { id: 'c1', title: 'Water the plants' },
  { id: 'c2', title: 'Find a <new> podcast', hint: 'Something "different"', early: true },
];

// Announcements land after a short timeout.
async function heard(page, msg) {
  await page.clock.runFor(100);
  await expect(page.locator('#live')).toHaveText(msg);
}

const field = (page, name) => dry(page, `input[name=${name}]`);

async function addTask(page, title, { hint = '', early = false } = {}) {
  await field(page, 'task').fill(title);
  if (hint) await field(page, 'hint').fill(hint);
  if (early) await field(page, 'early').check();
  await btn(page, 'Add task').click();
}

test.describe('choose build', () => {
  test('nothing on the main build leads to it', async ({ page }) => {
    await open(page, `${MAIN}#tasks`);
    await expect(heading(page)).toHaveText('Do stream of consciousness writing (like morning pages)');
    await expect(dry(page, 'a[href="#tasks"]')).toHaveCount(0);
    expect(await page.content()).not.toContain('choose/');
  });

  test('it is kept out of search results and redirects to a trailing slash', async ({ page }) => {
    await open(page, '/choose');
    expect(new URL(page.url()).pathname).toBe(CHOOSE);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(dry(page, '.tag')).toHaveCount(0);
  });

  test('starts empty and can copy the suggested list', async ({ page }) => {
    await open(page, CHOOSE);
    await expect(heading(page)).toHaveText('Add a task to begin.');
    await dry(page, 'a:text-is("Add tasks")').click();
    await expect(heading(page)).toHaveText('Your tasks');
    await expect(page).toHaveTitle('Your tasks');
    await expect(dry(page, '.empty')).toHaveText('No tasks yet.');
    await btn(page, 'Start from the suggested list').click();
    await expect(dry(page, '.group .item')).toHaveCount(14);
    expect((await stored(page, 'tasks', CHOOSE))[1]).toEqual({ id: 'new-artist', title: 'Find a new musical artist to listen to', early: true });
  });

  test('without a suggested list there is nothing to copy', async ({ page }) => {
    await page.route('**/tasks.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.TASKS = [];' }));
    await open(page, `${CHOOSE}#tasks`);
    await expect(dry(page, '.empty')).toHaveText('No tasks yet.');
    await expect(btn(page, 'Start from the suggested list')).toHaveCount(0);
  });

  test('adds tasks with new ids that are never reused', async ({ page }) => {
    await open(page, `${CHOOSE}#tasks`);
    await btn(page, 'Add task').click();
    await expect(dry(page, '[data-error]')).toBeVisible();
    await expect(field(page, 'task')).toBeFocused();

    await addTask(page, '  Stretch  ', { hint: 'Slowly', early: true });
    await expect(field(page, 'task')).toHaveValue('');
    await expect(field(page, 'task')).toBeFocused();
    await heard(page, 'Task added.');
    await addTask(page, 'Sketch');
    expect(await stored(page, 'tasks', CHOOSE)).toEqual([
      { id: 'c1', title: 'Stretch', hint: 'Slowly', early: true },
      { id: 'c2', title: 'Sketch' },
    ]);
    await expect(dry(page, '.item').first()).toContainText('Can finish early');

    page.once('dialog', (d) => d.accept());
    await dry(page, '.item:has-text("Sketch") [data-act=remove-task]').click();
    await addTask(page, 'Tidy');
    expect((await stored(page, 'tasks', CHOOSE)).map((t) => t.id)).toEqual(['c1', 'c3']);
  });

  test('edits a task, or cancels editing', async ({ page }) => {
    await open(page, `${CHOOSE}#tasks`);
    await seed(page, CHOOSE, { tasks: mine });
    await dry(page, '.item:nth-child(2) [data-act=edit-task]').click();
    await expect(dry(page, '.task-form h2')).toHaveText('Edit task');
    await expect(field(page, 'task')).toHaveValue('Find a <new> podcast');
    await expect(field(page, 'task')).toBeFocused();
    await expect(field(page, 'hint')).toHaveValue('Something "different"');
    await expect(field(page, 'early')).toBeChecked();

    await btn(page, 'Cancel').click();
    await expect(dry(page, '.task-form h2')).toHaveText('Add a task');
    await expect(field(page, 'task')).toHaveValue('');

    await dry(page, '.item:nth-child(2) [data-act=edit-task]').click();
    await field(page, 'task').fill('Find a podcast');
    await field(page, 'hint').fill('');
    await field(page, 'early').uncheck();
    await btn(page, 'Save changes').click();
    await heard(page, 'Task saved.');
    expect(await stored(page, 'tasks', CHOOSE)).toEqual([mine[0], { id: 'c2', title: 'Find a podcast' }]);
  });

  test('removing a task asks first', async ({ page }) => {
    await open(page, `${CHOOSE}#tasks`);
    await seed(page, CHOOSE, { tasks: mine });
    page.once('dialog', (d) => d.dismiss());
    await dry(page, '.item:nth-child(1) [data-act=remove-task]').click();
    await expect(dry(page, '.group .item')).toHaveCount(2);

    page.once('dialog', (d) => { expect(d.message()).toContain('Water the plants'); d.accept(); });
    await dry(page, '.item:nth-child(1) [data-act=remove-task]').click();
    await expect(dry(page, '.group .item')).toHaveCount(1);
    await heard(page, 'Task removed.');
    expect(await stored(page, 'tasks', CHOOSE)).toEqual([mine[1]]);
  });

  test('you pick the task, and it keeps its own data', async ({ page }) => {
    await open(page, CHOOSE);
    await seed(page, CHOOSE, { tasks: mine, log: [entry('c1', 'Water the plants', { date: '2026-11-01' })] });
    await expect(heading(page)).toHaveText('What will you do today?');
    await expect(dry(page, '.bar a[href="#tasks"]')).toHaveText('Your tasks');
    await expect(dry(page, '.bar a[href="#report"]')).toHaveText('Your report');
    await expect(dry(page, '.choose-item')).toHaveCount(2);
    await expect(dry(page, '.choose-item').nth(0).locator('.choose-meta')).toHaveText('Last done Nov 1');
    const second = dry(page, '.choose-item').nth(1);
    await expect(second.locator('.choose-title')).toHaveText('Find a <new> podcast');
    await expect(second.locator('.choose-hint')).toHaveText('Something "different"');
    await expect(second.locator('.choose-meta')).toHaveText('Can finish early');

    await second.click();
    await btn(page, 'Start task').click();
    await page.clock.runFor(100);
    await expect(dry(page, '.bar-task')).toHaveText('Find a <new> podcast');
    await btn(page, 'Done early').click();
    await settle(page);
    await complete(page, 'No');
    await expect(heading(page)).toHaveText('See you tomorrow.');

    const log = await stored(page, 'log', CHOOSE);
    expect(log[1]).toMatchObject({ taskId: 'c2', title: 'Find a <new> podcast', early: true, again: 'no' });
    expect(await stored(page, 'log', MAIN)).toBeNull();

    await page.clock.setSystemTime(new Date('2026-11-04T08:00:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(dry(page, '.choose-item')).toHaveCount(2);
  });

  test('the report and the way back work', async ({ page }) => {
    await open(page, CHOOSE);
    await seed(page, CHOOSE, { tasks: mine, log: [entry('c1', 'Water the plants')] });
    await dry(page, 'a[href="#report"]').click();
    await expect(dry(page, '.item-title')).toHaveText('Water the plants');
    await dry(page, 'a[href="#today"]').click();
    await dry(page, '.bar a[href="#tasks"]').click();
    await dry(page, 'a[href="#today"]').click();
    await expect(heading(page)).toHaveText('What will you do today?');
  });
});

test.describe('choose test build', () => {
  test('uses a short timer, its own data and lets you go again the same day', async ({ page }) => {
    await open(page, TEST_CHOOSE);
    await expect(dry(page, '.tag')).toHaveText('Test build');
    await seed(page, TEST_CHOOSE, { tasks: mine });
    await expect(dry(page, '[data-pick]')).toHaveCount(0);
    await dry(page, '.choose-item').first().click();
    await btn(page, 'Start task').click();
    await page.clock.runFor(100);
    await runOut(page, 5000);
    await complete(page);
    await expect(dry(page, '.choose-item')).toHaveCount(2);
    expect(await stored(page, 'log', TEST_CHOOSE)).toHaveLength(1);
    expect(await stored(page, 'tasks', CHOOSE)).toBeNull();

    await page.goto(`${TEST_CHOOSE}#report`);
    page.once('dialog', (d) => d.accept());
    await btn(page, 'Clear test data').click();
    expect(await stored(page, 'tasks', TEST_CHOOSE)).toBeNull();
    expect(await stored(page, 'log', TEST_CHOOSE)).toBeNull();
  });
});

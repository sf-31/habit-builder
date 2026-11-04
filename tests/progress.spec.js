const { test, expect, MAIN, TEST, dry, btn, open, seed, stored, entry } = require('./helpers');

// ---------- this week / this month (today is Tuesday 2026-11-03) ----------

const rate = (page, name) => dry(page, `.rate:has(h2:text-is("${name}"))`);
const target = (page) => dry(page, '[data-target]');
const up = (page) => dry(page, '[data-act=target-up]');
const down = (page) => dry(page, '[data-act=target-down]');
const days = (...dates) => dates.map((date, i) => entry(`t${i}`, `Task ${i}`, { date }));

async function report(page, data, path = MAIN) {
  await open(page);
  await seed(page, path, data);
  await page.goto(`${path}#report`);
}

test.describe('progress', () => {
  test('nothing counts before your first task', async ({ page }) => {
    await open(page, `${MAIN}#report`);
    await expect(target(page)).toHaveText('80%');
    const week = rate(page, 'This week');
    await expect(week.locator('.rate-pct')).toHaveText('—');
    await expect(week.locator('.rate-of')).toHaveText('No days yet');
    await expect(week.locator('.rate-status')).toHaveText('On track. 5 more days this week reaches 80%.');
    await expect(rate(page, 'This month').locator('.rate-status')).toHaveText('On track. 23 more days this month reaches 80%.');
  });

  test('shows how you’re doing against the target', async ({ page }) => {
    await report(page, { log: days('2026-11-02', '2026-11-03'), target: 25 });
    const week = rate(page, 'This week');
    await expect(week.locator('.rate-pct')).toHaveText('100%');
    await expect(week.locator('.rate-of')).toHaveText('2 of 2 days');
    await expect(week.locator('.rate-status')).toHaveText('You’ve reached 25% this week.');
    await expect(week.locator('.day')).toHaveClass(['day done', 'day done', ...Array(5).fill('day later')]);

    const month = rate(page, 'This month');
    await expect(month.locator('.rate-status')).toHaveText('On track. 6 more days this month reaches 25%.');
    await expect(month.locator('.day')).toHaveCount(30);
    // November 1 is a Sunday, so it sits in the last column. It was before the first task.
    await expect(month.locator('.day').first()).toHaveClass('day before');
    await expect(month.locator('.day').first()).toHaveAttribute('style', 'grid-column-start:7');
    await expect(month.locator('.meter-target')).toHaveAttribute('style', 'left:25%');
  });

  test('says when you’re behind and when the target is out of reach', async ({ page }) => {
    await report(page, { log: days('2026-10-01', '2026-11-01') });
    const week = rate(page, 'This week');
    const month = rate(page, 'This month');
    await expect(week.locator('.rate-pct')).toHaveText('0%');
    await expect(week.locator('.rate-of')).toHaveText('0 of 1 day');
    await expect(week.locator('.rate-status')).toHaveText('Behind. Do a task on 6 of the 6 days left to reach 80%.');
    await expect(week.locator('.day')).toHaveClass(['day missed', 'day today', ...Array(5).fill('day later')]);
    await expect(month.locator('.rate-pct')).toHaveText('50%');
    await expect(month.locator('.rate-of')).toHaveText('1 of 2 days');
    await expect(month.locator('.rate-status')).toHaveText('Behind. Do a task on 23 of the 28 days left to reach 80%.');
    await expect(month.locator('.meter-fill')).toHaveAttribute('style', 'width:50%');

    for (let i = 0; i < 4; i++) await up(page).click();
    await expect(target(page)).toHaveText('100%');
    expect(await stored(page, 'target')).toBe(100);
    await expect(up(page)).toBeDisabled();
    await expect(down(page)).toBeFocused();
    await expect(week.locator('.rate-status')).toHaveText('100% is out of reach this week. The most you can get to is 85%.');
    await expect(month.locator('.rate-status')).toHaveText('100% is out of reach this month. The most you can get to is 96%.');
  });

  test('the target steps by 5 between 5% and 100%', async ({ page }) => {
    await report(page, { target: 10 });
    await down(page).click();
    await expect(target(page)).toHaveText('5%');
    await expect(down(page)).toBeDisabled();
    await expect(up(page)).toBeFocused();
    await up(page).click();
    await expect(target(page)).toHaveText('10%');
    await expect(up(page)).toBeFocused();
    await down(page).click();
    await page.reload();
    await expect(target(page)).toHaveText('5%');
  });

  test('a bad stored target falls back to 80%', async ({ page }) => {
    await report(page, { target: 7 });
    await expect(target(page)).toHaveText('80%');
  });

  test('clearing test data resets the target', async ({ page }) => {
    await report(page, { target: 50 }, TEST);
    page.once('dialog', (d) => d.accept());
    await btn(page, 'Clear test data').click();
    expect(await stored(page, 'target', TEST)).toBeNull();
    await expect(target(page)).toHaveText('80%');
  });
});

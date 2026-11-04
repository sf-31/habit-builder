const { test, expect, MAIN, TEST, CHOOSE, dry, btn, open, seed, stored, startTask, advance, runOut } = require('./helpers');

// ---------- timer length ----------

const value = (page) => dry(page, '[data-length]');
const shorter = (page) => dry(page, '[data-act=shorter]');
const longer = (page) => dry(page, '[data-act=longer]');

test.describe('timer length', () => {
  test('defaults to 15 minutes and steps by 5', async ({ page }) => {
    await open(page);
    await expect(value(page)).toHaveText('15 min');
    await longer(page).click();
    await expect(value(page)).toHaveText('20 min');
    await expect(longer(page)).toBeFocused();
    expect(await stored(page, 'minutes')).toBe(20);
    await shorter(page).click();
    await shorter(page).click();
    await expect(value(page)).toHaveText('10 min');
    await expect(shorter(page)).toBeFocused();
  });

  test('stops at 5 and 60 minutes and moves focus off a disabled end', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { minutes: 10 });
    await shorter(page).click();
    await expect(value(page)).toHaveText('5 min');
    await expect(shorter(page)).toBeDisabled();
    await expect(longer(page)).toBeFocused();

    await seed(page, MAIN, { minutes: 55 });
    await longer(page).click();
    await expect(value(page)).toHaveText('60 min');
    await expect(longer(page)).toBeDisabled();
    await expect(shorter(page)).toBeFocused();
  });

  test('a bad stored length falls back to 15', async ({ page }) => {
    await open(page);
    await seed(page, MAIN, { minutes: 7 });
    await expect(value(page)).toHaveText('15 min');
    await seed(page, MAIN, { minutes: 'x' });
    await expect(value(page)).toHaveText('15 min');
  });

  test('the timer runs for the chosen length and survives a reload', async ({ page }) => {
    await open(page);
    await longer(page).click();
    await startTask(page);
    await expect(dry(page, '[data-clock]')).toHaveText('20:00');
    await expect(page.locator('#live')).toHaveText('Timer started. 20 minutes.');
    expect((await stored(page, 'session')).minutes).toBe(20);

    await advance(page, 5 * 60 * 1000);
    await page.reload();
    await expect(dry(page, '[data-clock]')).toHaveText('15:00');
    const p = await page.evaluate(() => Number(document.documentElement.style.getPropertyValue('--p')));
    expect(p).toBeCloseTo(0.25, 2);

    await runOut(page, 15 * 60 * 1000);
    await dry(page, '.opt:has(span:text-is("Yes"))').click();
    await btn(page, 'Mark complete').click();
    expect((await stored(page, 'log'))[0].minutes).toBe(20);
  });

  test('the test build scales the length to seconds', async ({ page }) => {
    await open(page, TEST);
    await longer(page).click();
    await startTask(page);
    await expect(page.locator('#live')).toHaveText('Timer started. 7 seconds.');
    await expect(dry(page, '[data-clock]')).toHaveText('0:07');
  });

  test('the choose build shows it above the list', async ({ page }) => {
    await open(page, CHOOSE);
    await seed(page, CHOOSE, { tasks: [{ id: 'c1', title: 'Water the plants' }] });
    await expect(value(page)).toHaveText('15 min');
    await shorter(page).click();
    await dry(page, '[data-act=choose]').click();
    await btn(page, 'Start task').click();
    await page.clock.runFor(100);
    await expect(dry(page, '[data-clock]')).toHaveText('10:00');
  });
});

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function expectLayoutToFit(page: Page) {
  const layout = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell')!.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      left: shell.left,
      width: shell.width,
      navLeft: nav?.left,
      navWidth: nav?.width,
      navBottom: nav?.bottom,
      height: innerHeight,
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.left).toBeCloseTo(0, 0);
  expect(layout.width).toBeCloseTo(layout.viewport, 0);
  if (layout.navWidth !== undefined) {
    expect(layout.navLeft).toBeCloseTo(0, 0);
    expect(layout.navWidth).toBeCloseTo(layout.viewport, 0);
    expect(layout.navBottom).toBeCloseTo(layout.height, 0);
  }
}

for (const width of [320, 390, 430, 980]) {
  test.describe(`touch browser with ${width}px layout viewport`, () => {
    test.use({
      viewport: { width, height: width === 980 ? 1800 : 844 },
      screen: { width: width === 980 ? 393 : width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test('map, navigation and lesson fill the screen at a readable scale', async ({ page }, testInfo) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
      await expectLayoutToFit(page);

      // Desktop-site mode on a phone can use a 980px layout viewport. Merely
      // widening the container would still leave the text and controls tiny.
      const scale = await page.evaluate(() => {
        const ratio = screen.width / innerWidth;
        return {
          heading: parseFloat(getComputedStyle(document.querySelector('h1')!).fontSize) * ratio,
          button: document.querySelector('.lesson-card .primary')!.getBoundingClientRect().height * ratio,
        };
      });
      expect(scale.heading).toBeGreaterThanOrEqual(23);
      expect(scale.button).toBeGreaterThanOrEqual(39);

      // Map controls and the mage must stay aligned with the scaled terrain.
      const map = await page.locator('.world-map').boundingBox();
      const firstNode = await page.locator('.map-node-wrap').first().boundingBox();
      expect(firstNode!.y + firstNode!.height / 2 - map!.y).toBeCloseTo(map!.height * 360 / 430, 0);
      await expect(page.locator('.map-mage img')).toHaveJSProperty('complete', true);
      await page.screenshot({ path: testInfo.outputPath('map.png') });
      await page.locator('.quiet-note').scrollIntoViewIfNeeded();
      const start = await page.getByRole('button', { name: 'Начать приключение' }).boundingBox();
      const nav = await page.locator('.bottom-nav').boundingBox();
      expect(start!.y + start!.height).toBeLessThanOrEqual(nav!.y);

      await page.getByRole('button', { name: 'Книги', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Маг и книги' })).toBeVisible();
      await expectLayoutToFit(page);
      await page.getByRole('button', { name: 'Задания', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Ежедневное задание' })).toBeVisible();
      await expectLayoutToFit(page);
      await page.getByRole('button', { name: 'Настройки и сохранение' }).click();
      await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
      await expectLayoutToFit(page);
      await page.getByRole('button', { name: 'Карта', exact: true }).click();
      await page.getByRole('button', { name: 'Начать приключение' }).click();
      await expect(page.locator('#question-title')).toBeVisible();
      await expectLayoutToFit(page);
      await page.getByRole('button', { name: 'Ввод', exact: true }).click();
      await expect(page.getByRole('group', { name: 'Доступные буквы' })).toBeVisible();
      await expectLayoutToFit(page);
      await page.screenshot({ path: testInfo.outputPath('lesson.png') });
    });
  });
}

test('touch layout follows orientation and browser viewport height changes', async ({ browser }) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
    for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 700 }]) {
      await page.setViewportSize(viewport);
      await expectLayoutToFit(page);
    }
  } finally {
    await context.close();
  }
});

test('desktop keeps its centered layout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
  const shell = await page.locator('.app-shell').boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  expect(shell!.width).toBe(480);
  expect(shell!.x).toBe(400);
  expect(nav!.width).toBe(shell!.width);
  expect(nav!.x).toBe(shell!.x);
  await expect(page.locator('h1')).toHaveCSS('font-size', '29px');
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });
});

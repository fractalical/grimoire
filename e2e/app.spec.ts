import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Catalog } from '../src/types';
import { initialState, transition } from '../src/domain';
import { createLetterPuzzle, isLetterTile } from '../src/letters';

const catalog: Catalog = JSON.parse(readFileSync(new URL('../public/content/catalog.json', import.meta.url), 'utf8'));

async function openMap(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
}

test('application starts, pages open, and mobile layout fits', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 360, height: 800 });
  await openMap(page);
  await expect(page.getByRole('button', { name: 'Начать приключение' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('map-mobile.png'), fullPage: true });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Книги', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Маг и книги' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(11);
  await page.screenshot({ path: testInfo.outputPath('books.png'), fullPage: true });
  await page.getByRole('button', { name: 'Задания', exact: true }).click();
  await expect(page.getByText('Пройди первый урок, чтобы открыть ежедневное задание.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('daily-locked.png'), fullPage: true });
  await page.getByRole('button', { name: 'На карту', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки и сохранение' }).click();
  await page.getByRole('checkbox', { name: 'Меньше анимации' }).click();
  await expect(page.getByRole('checkbox', { name: 'Меньше анимации' })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Меньше анимации' })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('map-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('wrong answer, letter answer, and feedback survive reload', async ({ page }, testInfo) => {
  await openMap(page);
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  const first = catalog.entries.find(entry => entry.id === catalog.lessons[0].entryIds[0])!;
  const prompt = await page.locator('#question-title').textContent();
  const wrong = catalog.entries.find(entry => entry.id === first.distractorIds[0])!;
  await page.getByRole('button', { name: prompt === first.french ? wrong.russian : wrong.french, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Запомним и попробуем ещё раз.');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Это слово встретится снова.');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.getByRole('button', { name: 'Ввод', exact: true }).click();
  const second = catalog.entries.find(entry => entry.id === catalog.lessons[0].entryIds[1])!;
  await expect(page.getByRole('group', { name: 'Доступные буквы' })).toBeVisible();
  const direction = await page.locator('#question-title').textContent() === second.french ? 'fr-ru' : 'ru-fr';
  const answer = createLetterPuzzle({ accepted: direction === 'fr-ru' ? second.acceptedRu : second.acceptedFr, direction }, 'test').answer;
  await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled();
  for (const char of Array.from(answer).filter(isLetterTile)) await page.getByRole('group', { name: 'Доступные буквы' }).getByRole('button', { name: `Буква ${char}`, exact: true }).and(page.locator('button:enabled')).first().click();
  await page.screenshot({ path: testInfo.outputPath('letter-answer.png'), fullPage: true });
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Верно!');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.screenshot({ path: testInfo.outputPath('feedback.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Верно!');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Сохранить и выйти на карту' }).click();
  await expect(page.getByRole('button', { name: 'Продолжить этап 1 · 1/10' })).toBeVisible();
});

test('save export and invalid import preserve progress', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: 'Настройки и сохранение' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать сохранение' }).click();
  const download = await downloadEvent;
  const save = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(save.schema).toBe(1);
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{oops') });
  await expect(page.getByRole('alert')).toContainText('Не удалось прочитать JSON');
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('alert')).toContainText('Файл сохранения повреждён');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
});

test('imported snapshot supports image answers, completion, and daily tasks', async ({ page }, testInfo) => {
  // A valid earlier content snapshot with a short lesson must remain playable.
  const entry = catalog.entries.find(entry => entry.image)!;
  const shortCatalog = structuredClone(catalog);
  shortCatalog.lessons[0].entryIds = [entry.id];
  const saved = transition(initialState(), { type: 'startLesson', lessonId: 'a1-01' }, shortCatalog, 'test-start');
  // This imported pre-update snapshot offered French-to-Russian questions.
  Object.assign(saved.runs['lesson:a1-01'].question, { direction: 'fr-ru', prompt: entry.french, accepted: entry.acceptedRu });
  await openMap(page);
  await page.getByRole('button', { name: 'Настройки и сохранение' }).click();
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: 'snapshot.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.getByRole('button', { name: 'Продолжить этап 1 · 0/1' }).click();
  await page.getByRole('button', { name: 'Картинки', exact: true }).click();
  await expect(page.locator('.image-options img')).toHaveCount(4);
  await expect.poll(() => page.locator('.image-options img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('image-answer.png'), fullPage: true });
  await page.getByRole('button', { name: entry.image!.alt, exact: true }).click();
  await page.getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Урок пройден!' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Урок пройден!' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('completed.png'), fullPage: true });
  await page.getByRole('button', { name: 'Вернуться на карту' }).click();
  await expect(page.getByLabel('Пройдено 1 из 34 уроков')).toBeVisible();
  await page.getByRole('button', { name: 'Задания', exact: true }).click();
  await page.getByRole('button', { name: 'Начать задание', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '10');
});

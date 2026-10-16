import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Catalog, GameState } from '../src/types';
import { initialState, transition } from '../src/domain';

const catalog: Catalog = JSON.parse(readFileSync(new URL('../public/content/catalog.json', import.meta.url), 'utf8'));
const key = 'lesson:a1-01';
async function importSave(page: Page, state: GameState) {
  await page.goto('/#/settings');
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: 'stages.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state)) });
  await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
}

test('stage summary, rest, next stage and its counter survive reload on mobile', async ({ page }, testInfo) => {
  let state = transition(initialState(), { type: 'startLesson', lessonId: 'a1-01' }, catalog, 'start');
  for (let i = 0; i < 9; i++) {
    const q = state.runs[key].question;
    state = transition(state, { type: 'answer', runKey: key, questionId: q.id, answer: q.mode === 'typed_translation' ? q.letters!.answer : q.entryId }, catalog, `answer-${i}`);
    state = transition(state, { type: 'next', runKey: key }, catalog, `next-${i}`);
  }
  const q = state.runs[key].question;
  const entry = state.runs[key].content[q.entryId];
  await page.setViewportSize({ width: 360, height: 800 });
  await importSave(page, state);
  await page.getByRole('button', { name: 'Продолжить этап 1 · 9/10' }).click();
  const translationMode = page.getByRole('button', { name: 'Перевод', exact: true });
  if (await translationMode.isEnabled()) await translationMode.click();
  await page.getByRole('button', { name: q.direction === 'fr-ru' ? entry.russian : entry.french, exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
  await page.getByRole('button', { name: 'Итоги этапа', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Этап 1 пройден!' })).toBeVisible();
  await expect(page.locator('.stage-word-list dt')).toHaveCount(10);
  await page.screenshot({ path: testInfo.outputPath('stage-complete-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Этап 1 пройден!' })).toBeVisible();
  await page.getByRole('button', { name: 'Отдохнуть и выйти' }).click();
  await page.getByRole('button', { name: 'Итоги этапа 1', exact: true }).click();
  await page.getByRole('button', { name: 'Следующий этап', exact: true }).click();
  await expect(page.locator('.run-progress')).toContainText('Этап 2 / 10');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.stage-overall')).toContainText('10 / 100');
  await expect(page.locator('.encounter-mage')).toHaveAttribute('data-position', '10');
  await page.reload();
  await expect(page.locator('.run-progress')).toContainText('Этап 2 / 10');
  await page.screenshot({ path: testInfo.outputPath('stage-two-mobile.png'), fullPage: true });
});

test('lesson fifteen is available after fourteen and opens in chapter three', async ({ page }, testInfo) => {
  const state = initialState();
  for (const lesson of catalog.lessons.slice(0, 14)) state.completed[lesson.id] = { at: new Date().toISOString(), version: catalog.version };
  await importSave(page, state);
  await page.reload();
  await expect(page.locator('.chapter-line')).toContainText('Уроки 13–18');
  await expect(page.getByRole('heading', { name: 'Расскажи о себе' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать приключение' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('lesson-fifteen-map.png'), fullPage: true });
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  await expect(page.locator('.header-title')).toContainText('УРОК 15');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '10');
  await expect(page.locator('.source-note')).toContainText('A1 15.pdf, стр. 1');
  await expect(page.locator('.answer-option')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.header-title')).toContainText('УРОК 15');
});

for (const order of [16, 17, 18, 19, 20]) test(`lesson ${order} opens in its chapter and keeps a letter question after reload`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const lesson = catalog.lessons[order - 1];
  const state = initialState();
  for (const previous of catalog.lessons.slice(0, order - 1)) state.completed[previous.id] = { at: state.createdAt, version: catalog.version };
  await importSave(page, state);
  await page.reload();
  await expect(page.locator('.chapter-line')).toContainText(order <= 18 ? 'Уроки 13–18' : 'Уроки 19–24');
  await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible();
  await expect(page.locator('.lesson-meta')).toContainText(`${lesson.entryIds.length} слов`);
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  await expect(page.locator('.header-title')).toContainText(`УРОК ${order}`);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '10');
  await expect(page.locator('.source-note')).toContainText(`${lesson.sourceFile}, стр. 1`);
  await expect(page.locator('.answer-option')).toHaveCount(4);
  const prompt = await page.locator('#question-title').textContent();
  await page.getByRole('button', { name: 'Ввод', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Доступные буквы' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#question-title')).toHaveText(prompt!);
  await expect(page.getByRole('group', { name: 'Доступные буквы' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`lesson-${order}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

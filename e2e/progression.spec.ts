import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Catalog, Direction, GameState } from '../src/types';
import { initialState, transition } from '../src/domain';
import { createLetterPuzzle, isLetterTile } from '../src/letters';

const catalog: Catalog = JSON.parse(readFileSync(new URL('../public/content/catalog.json', import.meta.url), 'utf8'));
const key = 'lesson:a1-01';

async function importSave(page: Page, state: GameState) {
  await page.goto('/#/settings');
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: 'test-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state)) });
  await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
}

async function buildAnswer(page: Page, answer: string) {
  for (const char of Array.from(answer).filter(isLetterTile)) await page.getByRole('group', { name: 'Доступные буквы' }).getByRole('button', { name: `Буква ${char}`, exact: true }).and(page.locator('button:enabled')).first().click();
}

test('mage walks to the defeated goblin and the camera follows on the next encounter', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  const mage = page.locator('.encounter-mage');
  const before = await mage.boundingBox();
  // The first catalog entry is toit — крыша. Both prompt directions are valid.
  const prompt = await page.locator('#question-title').textContent();
  await page.getByRole('button', { name: prompt === 'toit' ? 'крыша' : 'toit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Верно!');
  await expect.poll(async () => (await mage.boundingBox())!.x).toBeGreaterThan(before!.x + 50);
  await expect(mage).toHaveAttribute('data-position', '1');
  await page.screenshot({ path: testInfo.outputPath('mage-after-answer.png'), fullPage: true });
  const cameraBefore = await page.locator('.encounter-camera').getAttribute('style');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.locator('.encounter-camera')).not.toHaveAttribute('style', cameraBefore!);
  await expect(mage).toHaveAttribute('data-position', '1');
  await page.reload();
  await expect(mage).toHaveAttribute('data-position', '1');
  await expect(page.locator('.scene-tag')).toContainText('2');
  await page.screenshot({ path: testInfo.outputPath('next-encounter.png'), fullPage: true });
});

test('input mode offers letters without a language selector or free text', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  await page.getByRole('button', { name: 'Ввод', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Доступные буквы' })).toBeVisible();
  const prompt = await page.locator('#question-title').textContent();
  const letters = await page.locator('.letter-bank').textContent();
  await page.getByRole('button', { name: 'Перевод', exact: true }).click();
  await expect(page.locator('#question-title')).toHaveText(prompt!);
  await page.getByRole('button', { name: 'Ввод', exact: true }).click();
  await expect(page.locator('#question-title')).toHaveText(prompt!);
  await expect(page.locator('.letter-bank')).toHaveText(letters!);
  await page.reload();
  await expect(page.locator('#question-title')).toHaveText(prompt!);
  await expect(page.locator('.letter-bank')).toHaveText(letters!);
});

for (const direction of ['fr-ru', 'ru-fr'] as Direction[]) test(`builds a ${direction} phrase, supports corrections, and preserves punctuation`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const entry = catalog.entries.find(entry => entry.french === 'à tout à l’heure')!;
  const shortCatalog = structuredClone(catalog);
  // A short saved content snapshot makes phrase interaction easy to inspect.
  const lesson = shortCatalog.lessons.find(lesson => lesson.id === entry.lessonId)!;
  let state = initialState();
  for (const previous of shortCatalog.lessons.filter(item => item.order < lesson.order)) state.completed[previous.id] = { at: new Date().toISOString(), version: catalog.version };
  lesson.entryIds = [entry.id, lesson.entryIds.find(id => id !== entry.id)!];
  state = transition(state, { type: 'startLesson', lessonId: lesson.id }, shortCatalog, 'start');
  const runKey = `lesson:${lesson.id}`;
  const q = state.runs[runKey].question;
  Object.assign(q, { mode: 'typed_translation', direction, prompt: direction === 'fr-ru' ? entry.french : entry.russian, accepted: direction === 'fr-ru' ? entry.acceptedRu : entry.acceptedFr, options: [] });
  q.letters = createLetterPuzzle(q, 'fixed-phrase');
  await importSave(page, state);
  await page.goto(`/#/play/${encodeURIComponent(runKey)}`);
  const bank = page.getByRole('group', { name: 'Доступные буквы' });
  await expect(bank.getByRole('button')).toHaveCount(q.letters.tiles.length);
  const extra = q.letters.tiles.find(char => !q.letters!.answer.includes(char))!;
  await bank.getByRole('button', { name: `Буква ${extra}`, exact: true }).click();
  await page.getByRole('button', { name: 'Убрать последнюю букву' }).click();
  await expect(page.locator('.letter-slot.filled')).toHaveCount(0);
  await buildAnswer(page, q.letters.answer);
  await page.getByRole('button', { name: 'Очистить ответ', exact: true }).click();
  await expect(page.locator('.letter-slot.filled')).toHaveCount(0);
  await buildAnswer(page, q.letters.answer);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phrase.png'), fullPage: true });
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Верно!');
  await expect(page.locator('.assembled-answer')).toHaveText(q.letters.answer);
});

test('earned books contain only their lesson words and support dictionary search', async ({ page }, testInfo) => {
  const state = initialState();
  for (const lesson of catalog.lessons.slice(0, 3)) state.completed[lesson.id] = { at: new Date().toISOString(), version: catalog.version };
  await importSave(page, state);
  await page.getByRole('button', { name: 'Книги', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Открыть Том II', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Открыть Том I', exact: true }).click();
  const words = catalog.entries.filter(entry => ['a1-01', 'a1-02', 'a1-03'].includes(entry.lessonId));
  await expect(page.locator('.dictionary-entry')).toHaveCount(new Set(words.map(entry => entry.lexemeId)).size);
  await page.screenshot({ path: testInfo.outputPath('dictionary.png') });
  await page.getByRole('searchbox', { name: 'Найти слово или перевод' }).fill('лиса');
  await expect(page.locator('.dictionary-entry')).toHaveCount(1);
  await expect(page.locator('.dictionary-entry')).toContainText('renard');
  await page.getByRole('searchbox', { name: 'Найти слово или перевод' }).fill('fenetre');
  await expect(page.locator('.dictionary-entry')).toContainText('fenêtre');
  await page.getByRole('searchbox', { name: 'Найти слово или перевод' }).fill('zzzzzzzzzz');
  await expect(page.getByText('Ничего не найдено. Попробуй другое слово.')).toBeVisible();
  await page.getByRole('button', { name: 'К коллекции', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Маг и книги' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Открыть Том I', exact: true })).toBeEnabled();
});

test('motion plays normally and is disabled by the saved accessibility preference', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  const mage = page.locator('.encounter-mage');
  const before = await mage.boundingBox();
  const prompt = await page.locator('#question-title').textContent();
  await page.getByRole('button', { name: prompt === 'toit' ? 'крыша' : 'toit', exact: true }).click();
  await expect.poll(() => mage.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0);
  await expect.poll(async () => (await mage.boundingBox())!.x).toBeGreaterThan(before!.x + 20);
  await page.screenshot({ path: testInfo.outputPath('walking.png'), animations: 'allow' });
  await expect.poll(async () => (await mage.boundingBox())!.x).toBeGreaterThan(before!.x + 90);
  await page.getByRole('button', { name: 'Сохранить и выйти на карту' }).click();
  await page.getByRole('button', { name: 'Настройки и сохранение' }).click();
  await page.getByRole('checkbox', { name: 'Меньше анимации' }).click();
  await expect(page.getByRole('checkbox', { name: 'Меньше анимации' })).toBeChecked();
  await page.goto('/#/play/lesson%3Aa1-01');
  await expect(mage).toBeVisible();
  expect(await mage.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
});

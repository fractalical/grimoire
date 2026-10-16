import type { Catalog, Direction, Entry, GameCommand, GameState, Mode, Question, Run } from './types';
import { hash, shuffle } from './random';
import { createLetterPuzzle, validLetterPuzzle } from './letters';
import { completedLessonWords } from './books';
import { firstUnfinishedStage, pendingQueue, stageCount, stageWords, STAGE_SIZE } from './stages';
export { shuffle } from './random';

export const uid = () => crypto.randomUUID();
export function today(zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function initialState(): GameState {
  return { schema: 1, revision: 0, profileId: uid(), createdAt: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris', completed: {}, runs: {}, mastery: {}, lessonWords: {}, settings: { reduceMotion: false }, lastCommand: null };
}
export function normalizeAnswer(value: string, direction: Direction) {
  const normalized = value.normalize('NFC').toLocaleLowerCase().replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ');
  return direction === 'fr-ru' ? normalized.replace(/ё/g, 'е') : normalized;
}
export const rewards = (state: GameState) => { const n = Object.keys(state.completed).length; return { completed: n, books: Math.floor(n / 3), form: Math.floor(n / 6) }; };
export function unlocked(catalog: Catalog, state: GameState, id: string) {
  const lesson = catalog.lessons.find(l => l.id === id);
  return !!lesson && lesson.status === 'published' && catalog.lessons.filter(l => l.order < lesson.order).every(l => !!state.completed[l.id]);
}
export function availableModes(entry: Entry, content: Record<string, Entry>): Mode[] {
  const modes: Mode[] = ['translation_choice', 'typed_translation'];
  if (entry.image && entry.imageDistractorIds?.length === 3 && entry.imageDistractorIds.every(id => !!content[id]?.image)) modes.push('image_choice');
  return modes;
}
function makeQuestion(run: Run, mode: Mode = 'translation_choice', direction?: Direction): Question {
  const entry = run.content[run.queue[0]];
  if (!entry) throw new Error('Встреча недоступна. Вернись на карту.');
  if (!availableModes(entry, run.content).includes(mode)) mode = 'translation_choice';
  const ids = mode === 'image_choice' ? entry.imageDistractorIds! : entry.distractorIds;
  if (mode !== 'typed_translation' && ids.some(id => !run.content[id])) mode = 'typed_translation';
  // A direction belongs to an encounter, not to its mode. Switching formats must
  // never turn the answer into the prompt or allow rerolling the language.
  const seed = `${run.id}:${entry.id}:${run.attempts}`;
  direction ??= mode === 'image_choice' ? 'fr-ru' : hash(seed + ':direction') % 2 ? 'fr-ru' : 'ru-fr';
  if (mode === 'image_choice' && direction !== 'fr-ru') throw new Error('Для этого вопроса доступны перевод и сборка слова.');
  const question: Question = {
    id: `${run.id}:${run.serial}`, entryId: entry.id, mode, direction,
    prompt: direction === 'fr-ru' ? entry.french : entry.russian,
    accepted: direction === 'fr-ru' ? entry.acceptedRu : entry.acceptedFr,
    options: mode === 'typed_translation' ? [] : shuffle([entry.id, ...ids], seed).map(id => ({ id, label: direction === 'fr-ru' ? run.content[id].russian : run.content[id].french, ...(mode === 'image_choice' ? { image: run.content[id].image } : {}) })),
  };
  if (mode === 'typed_translation') question.letters = createLetterPuzzle(question, seed);
  return question;
}
function makeRun(catalog: Catalog, tasks: Entry[], state: GameState, kind: Run['kind'], title: string, now: Date, lessonId?: string, date?: string): Run {
  const allowed = catalog.entries.filter(e => kind === 'daily' ? !!state.completed[e.lessonId] : !!state.completed[e.lessonId] || e.lessonId === lessonId);
  const needed = new Set(tasks.flatMap(e => [e.id, ...e.distractorIds, ...(e.imageDistractorIds || [])]));
  const content = Object.fromEntries(allowed.filter(e => needed.has(e.id)).map(e => [e.id, e]));
  const run: Run = { id: uid(), kind, lessonId, date, timeZone: state.timeZone, title, contentVersion: catalog.version, sourceFiles: Object.fromEntries(catalog.lessons.map(l => [l.id, l.sourceFile])), content, taskIds: tasks.map(e => e.id), queue: tasks.map(e => e.id), defeated: [], serial: 0, attempts: 0, correct: 0, feedback: null, completedAt: null, createdAt: now.toISOString(), question: null as unknown as Question };
  if (!tasks.length) throw new Error('В этом уроке пока нет готовых слов.');
  if (kind !== 'daily') { run.stageIndex = 0; run.stageCompletedAt = null; }
  run.question = makeQuestion(run); return run;
}

function restoreStages(run: Run) {
  if (run.kind === 'daily' || run.stageIndex !== undefined) return;
  if (run.completedAt) { run.stageIndex = stageCount(run) - 1; run.stageCompletedAt = run.completedAt; return; }
  const first = firstUnfinishedStage(run);
  const questionStage = Math.floor(run.taskIds.indexOf(run.question.entryId) / STAGE_SIZE);
  const justFinished = !!run.feedback?.correct && questionStage < first;
  run.stageIndex = justFinished ? questionStage : first;
  run.stageCompletedAt = justFinished ? run.createdAt : null;
  const pending = pendingQueue(run);
  if (questionStage === run.stageIndex) {
    // A persisted feedback still owns its current queue item until Next.
    run.queue = [run.question.entryId, ...pending.filter(id => id !== run.question.entryId)];
  } else {
    run.queue = pending; run.feedback = null; run.serial++;
    run.question = makeQuestion(run);
  }
}
export function dailyTasks(catalog: Catalog, state: GameState, date: string): Entry[] {
  const pool = [...new Map(catalog.entries.filter(e => state.completed[e.lessonId]).map(e => [e.lexemeId, e])).values()].sort((a, b) => a.lexemeId.localeCompare(b.lexemeId));
  const due = pool.filter(e => Object.entries(state.mastery).some(([key, m]) => key.startsWith(`${e.lexemeId}|`) && m.due <= date));
  const seed = `${state.profileId}:${date}:${catalog.version}:daily-v1`;
  const selected = shuffle(due, seed).slice(0, 7);
  const used = new Set(selected.map(e => e.lexemeId));
  return [...selected, ...shuffle(pool.filter(e => !used.has(e.lexemeId)), seed + ':rest')].slice(0, 10);
}
function updateMastery(state: GameState, run: Run, correct: boolean, now: Date) {
  const q = run.question; const entry = run.content[q.entryId]; const key = `${entry.lexemeId}|${q.mode}|${q.direction}`; const date = today(state.timeZone, now);
  const m = state.mastery[key] || { attempts: 0, correct: 0, step: 0, due: date, lastIndependentDate: '' };
  const independent = m.lastIndependentDate !== date;
  m.attempts++; if (correct) m.correct++;
  if (!correct) { m.step = 0; m.due = addDays(date, 1); m.lastError = date; }
  else if (independent && m.due <= date) { m.due = addDays(date, [1, 3, 7, 14][Math.min(m.step, 3)]); m.step = Math.min(m.step + 1, 4); }
  if (independent) m.lastIndependentDate = date;
  state.mastery[key] = m;
}
/** Pure state transition. Persistence compares revisions and commits the whole result atomically. */
export function transition(previous: GameState, command: GameCommand, catalog: Catalog, commandId: string, now = new Date()): GameState {
  if (previous.lastCommand === commandId) return previous;
  const state = structuredClone(previous);
  for (const run of Object.values(state.runs)) restoreStages(run);
  // Preserve older completed snapshots before a replay can replace their run.
  state.lessonWords ??= {};
  for (const lessonId of Object.keys(state.completed)) state.lessonWords[lessonId] ??= structuredClone(completedLessonWords(catalog, state, lessonId));
  if (command.type === 'startLesson') {
    if (!unlocked(catalog, state, command.lessonId)) throw new Error('Сначала пройди предыдущий урок.');
    const key = `lesson:${command.lessonId}`; const old = state.runs[key];
    if (!old || old.completedAt) {
      const lesson = catalog.lessons.find(l => l.id === command.lessonId)!;
      const entries = lesson.entryIds.map(id => catalog.entries.find(e => e.id === id)!);
      state.runs[key] = makeRun(catalog, entries, state, state.completed[lesson.id] ? 'replay' : 'lesson', lesson.title, now, lesson.id);
    }
  } else if (command.type === 'startDaily') {
    if (command.date !== today(state.timeZone, now)) throw new Error('Дата изменилась. Открой сегодняшнее задание ещё раз.');
    const key = `daily:${command.date}`;
    if (!state.runs[key]) {
      const tasks = dailyTasks(catalog, state, command.date);
      if (!tasks.length) throw new Error('Пройди первый урок, чтобы открыть задание.');
      state.runs[key] = makeRun(catalog, tasks, state, 'daily', 'Ежедневное приключение', now, undefined, command.date);
    }
  } else if (command.type === 'settings') {
    if (command.reduceMotion !== undefined) state.settings.reduceMotion = command.reduceMotion;
  } else {
    const run = state.runs[command.runKey];
    if (!run) throw new Error('Прохождение не найдено. Вернись на карту.');
    if (command.type === 'nextStage') {
      if (run.kind === 'daily' || !run.stageCompletedAt || run.completedAt) throw new Error('Сначала заверши текущий этап.');
      run.stageIndex = firstUnfinishedStage(run); run.stageCompletedAt = null;
      run.queue = pendingQueue(run); run.feedback = null; run.serial++;
      run.question = makeQuestion(run);
    } else if (command.type === 'mode') {
      if (run.feedback || run.completedAt) throw new Error('На этот вопрос уже дан ответ.');
      run.serial++; run.question = makeQuestion(run, command.mode, run.question.direction);
    } else if (command.type === 'answer') {
      if (run.feedback || run.completedAt || command.questionId !== run.question.id) throw new Error('Этот ответ уже сохранён.');
      const q = run.question; const entry = run.content[q.entryId];
      const answer = command.answer.trim();
      if (!answer && q.mode === 'typed_translation') throw new Error('Сначала собери ответ из букв.');
      const correct = q.mode === 'typed_translation' ? q.accepted.some(a => normalizeAnswer(a, q.direction) === normalizeAnswer(answer, q.direction)) : answer === q.entryId;
      const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');
      const accentHint = !correct && q.direction === 'ru-fr' && q.accepted.some(a => strip(normalizeAnswer(a, q.direction)) === strip(normalizeAnswer(answer, q.direction)));
      run.feedback = { correct, answer, expected: q.direction === 'fr-ru' ? entry.russian : entry.french, accentHint, questionId: q.id };
      run.attempts++; if (correct) { run.correct++; run.defeated.push(entry.id); }
      updateMastery(state, run, correct, now);
      if (run.kind !== 'daily' && stageWords(run).every(id => run.defeated.includes(id))) run.stageCompletedAt = now.toISOString();
      if (run.defeated.length === run.taskIds.length) {
        run.completedAt = now.toISOString();
        if (run.kind === 'lesson' && run.lessonId && !state.completed[run.lessonId]) {
          state.completed[run.lessonId] = { at: now.toISOString(), version: run.contentVersion };
          state.lessonWords[run.lessonId] = structuredClone(run.taskIds.map(id => run.content[id]));
        }
      }
    } else {
      if (!run.feedback) throw new Error('Сначала ответь на вопрос.');
      if (!run.completedAt) {
        if (run.stageCompletedAt) throw new Error('Этап завершён. Перейди к следующему этапу.');
        const current = run.queue.shift()!;
        const active = new Set(stageWords(run));
        const retryAfter = run.kind === 'daily' ? run.queue.length : run.queue.filter(id => active.has(id)).length;
        if (!run.feedback.correct) run.queue.splice(Math.min(2, retryAfter), 0, current);
        run.feedback = null; run.serial++;
        const nextEntry = run.content[run.queue[0]];
        // First few encounters introduce all available modes, then alternate recognition and recall.
        const mode: Mode = nextEntry.image ? 'image_choice' : run.defeated.length % 4 === 1 ? 'typed_translation' : 'translation_choice';
        run.question = makeQuestion(run, mode);
      }
    }
  }
  state.revision++; state.lastCommand = commandId; return state;
}

/** Validate untrusted imports before opening a write transaction. */
export function validateSave(value: unknown): GameState {
  const fail = () => { throw new Error('Файл сохранения повреждён или имеет неподдерживаемую версию.'); };
  if (!value || typeof value !== 'object') return fail();
  const s = value as GameState;
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v: unknown): v is string => typeof v === 'string' && v.length < 2000;
  if (s.schema !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !str(s.profileId) || !str(s.createdAt) || !str(s.timeZone) || !obj(s.completed) || !obj(s.runs) || !obj(s.mastery) || !obj(s.settings) || typeof s.settings.reduceMotion !== 'boolean' || (s.settings.direction !== undefined && !['fr-ru', 'ru-fr'].includes(s.settings.direction))) return fail();
  try { today(s.timeZone); } catch { return fail(); }
  for (const [id, c] of Object.entries(s.completed)) if (!/^a1-\d{2}$/.test(id) || !obj(c) || !str(c.at) || !str(c.version)) return fail();
  for (const [key, run] of Object.entries(s.runs)) {
    if (!obj(run) || !str(run.id) || !['lesson', 'daily', 'replay'].includes(run.kind) || !str(run.title) || !str(run.timeZone) || !str(run.contentVersion) || !obj(run.sourceFiles) || !obj(run.content) || !Array.isArray(run.taskIds) || !run.taskIds.length || !Array.isArray(run.queue) || !Array.isArray(run.defeated) || !obj(run.question) || !Number.isSafeInteger(run.serial) || !Number.isSafeInteger(run.attempts) || !Number.isSafeInteger(run.correct)) return fail();
    if ((run.kind === 'daily' && key !== `daily:${run.date}`) || (run.kind !== 'daily' && key !== `lesson:${run.lessonId}`)) return fail();
    for (const [id, e] of Object.entries(run.content)) {
      if (!obj(e) || e.id !== id || !str(e.lexemeId) || !str(e.lessonId) || !str(e.french) || !str(e.russian) || !Number.isInteger(e.sourcePage) || !Array.isArray(e.acceptedRu) || !e.acceptedRu.length || !e.acceptedRu.every(str) || !Array.isArray(e.acceptedFr) || !e.acceptedFr.length || !e.acceptedFr.every(str) || !Array.isArray(e.distractorIds)) return fail();
      if (e.image && (!obj(e.image) || typeof e.image.url !== 'string' || !e.image.url.startsWith('/assets/vocab/') || e.image.url.includes('..') || !str(e.image.alt))) return fail();
    }
    if (new Set(run.taskIds).size !== run.taskIds.length || new Set(run.defeated).size !== run.defeated.length || run.taskIds.some(id => !run.content[id]) || run.defeated.some(id => !run.taskIds.includes(id)) || run.queue.some(id => !run.taskIds.includes(id))) return fail();
    const q = run.question;
    if (!str(q.id) || !run.content[q.entryId] || !['translation_choice', 'typed_translation', 'image_choice'].includes(q.mode) || !['fr-ru', 'ru-fr'].includes(q.direction) || !str(q.prompt) || !Array.isArray(q.options) || !Array.isArray(q.accepted) || !q.accepted.every(str)) return fail();
    if (!q.accepted.length || q.letters !== undefined && !validLetterPuzzle(q.letters, q)) return fail();
    for (const o of q.options) if (!obj(o) || !run.content[o.id] || !str(o.label) || (o.image && (!str(o.image.url) || !o.image.url.startsWith('/assets/vocab/') || o.image.url.includes('..') || !str(o.image.alt)))) return fail();
    if (!run.completedAt && run.queue[0] !== q.entryId) return fail();
    if (run.feedback && (typeof run.feedback.correct !== 'boolean' || !str(run.feedback.expected) || run.feedback.questionId !== q.id)) return fail();
    if (run.completedAt && run.defeated.length !== run.taskIds.length) return fail();
    if (run.stageIndex !== undefined) {
      if (!Number.isInteger(run.stageIndex) || run.stageIndex < 0 || run.stageIndex >= stageCount(run)) return fail();
      if (!run.completedAt && !stageWords(run).includes(q.entryId)) return fail();
      if (run.stageCompletedAt && (!str(run.stageCompletedAt) || !stageWords(run).every(id => run.defeated.includes(id)))) return fail();
    }
  }
  for (const m of Object.values(s.mastery)) if (!obj(m) || !Number.isSafeInteger(m.attempts) || !Number.isSafeInteger(m.correct) || !Number.isInteger(m.step) || m.step < 0 || m.step > 4 || !str(m.due) || !str(m.lastIndependentDate)) return fail();
  if (s.lessonWords !== undefined) {
    if (!obj(s.lessonWords)) return fail();
    for (const [lessonId, entries] of Object.entries(s.lessonWords)) {
      if (!s.completed[lessonId] || !Array.isArray(entries)) return fail();
      for (const e of entries) if (!obj(e) || !str(e.id) || !str(e.lexemeId) || e.lessonId !== lessonId || !str(e.french) || !str(e.russian) || !str(e.pronunciation) || !str(e.example) || !Number.isInteger(e.sourcePage)) return fail();
    }
  }
  const migrated = structuredClone(s);
  for (const run of Object.values(migrated.runs)) {
    restoreStages(run);
    if (run.question.mode === 'typed_translation') run.question.letters ??= createLetterPuzzle(run.question, run.question.id);
  }
  return migrated;
}

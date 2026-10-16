import { describe, expect, it } from 'vitest';
import catalogJson from '../public/content/catalog.json';
import type { Catalog, Direction, GameState, Question } from '../src/types';
import { initialState, normalizeAnswer, transition, validateSave } from '../src/domain';
import { assembleLetters, createLetterPuzzle, isLetterTile, validLetterPuzzle } from '../src/letters';
import { collectBooks } from '../src/books';

const catalog = catalogJson as Catalog;
const key = 'lesson:a1-01';
const start = () => transition(initialState(), { type: 'startLesson', lessonId: 'a1-01' }, catalog, 'start');

describe('letter puzzles', () => {
  it('every published word can be built in either language with exactly two extra tiles', () => {
    for (const entry of catalog.entries) for (const direction of ['fr-ru', 'ru-fr'] as Direction[]) {
      const accepted = direction === 'fr-ru' ? entry.acceptedRu : entry.acceptedFr;
      const puzzle = createLetterPuzzle({ accepted, direction }, entry.id);
      const used: number[] = [];
      for (const char of Array.from(puzzle.answer).filter(isLetterTile)) {
        const tile = puzzle.tiles.findIndex((value, index) => value === char && !used.includes(index));
        expect(tile, `${entry.french}: missing ${char}`).toBeGreaterThanOrEqual(0);
        used.push(tile);
      }
      expect(puzzle.tiles).toHaveLength(used.length + 2);
      expect(assembleLetters(puzzle, used)).toBe(puzzle.answer);
      expect(accepted.some(answer => normalizeAnswer(answer, direction) === normalizeAnswer(puzzle.answer, direction))).toBe(true);
      expect(validLetterPuzzle(puzzle, { accepted, direction } as Question)).toBe(true);
      expect(createLetterPuzzle({ accepted, direction }, entry.id)).toEqual(puzzle);
    }
  });

  it('preserves repeated and accented letters and inserts punctuation automatically', () => {
    const puzzle = createLetterPuzzle({ direction: 'ru-fr', accepted: ['à tout à l’heure'] }, 'phrase');
    expect(puzzle.tiles.filter(char => char === 'à')).toHaveLength(2);
    expect(puzzle.tiles).not.toContain(' ');
    expect(puzzle.tiles).not.toContain("'");
    const selected: number[] = [];
    for (const char of Array.from(puzzle.answer).filter(isLetterTile)) selected.push(puzzle.tiles.findIndex((value, index) => value === char && !selected.includes(index)));
    expect(assembleLetters(puzzle, selected)).toBe("à tout à l'heure");
  });

  it('selects one accepted translation instead of asking for a slash-separated list', () => {
    const puzzle = createLetterPuzzle({ direction: 'fr-ru', accepted: ['привет (разговорное)', 'привет'] }, 'one-meaning');
    expect(puzzle.answer).toBe('привет');
  });
});

describe('question direction and legacy saves', () => {
  it('switching formats cannot reveal the reverse prompt or reroll letters', () => {
    let state = start();
    const original = state.runs[key].question;
    state = transition(state, { type: 'mode', runKey: key, mode: 'typed_translation' }, catalog, 'input');
    const puzzle = state.runs[key].question.letters;
    for (let i = 0; i < 5; i++) {
      state = transition(state, { type: 'mode', runKey: key, mode: 'translation_choice' }, catalog, `choice-${i}`);
      state = transition(state, { type: 'mode', runKey: key, mode: 'typed_translation' }, catalog, `input-${i}`);
      expect(state.runs[key].question.prompt).toBe(original.prompt);
      expect(state.runs[key].question.direction).toBe(original.direction);
      expect(state.runs[key].question.letters).toEqual(puzzle);
    }
    expect(validateSave(state).runs[key].question.letters).toEqual(puzzle);
  });

  it('uses both languages across encounters, regardless of the former setting', () => {
    let state = start();
    state.settings.direction = 'fr-ru';
    const directions = new Set<Direction>();
    for (let i = 0; i < 30; i++) {
      state = transition(state, { type: 'mode', runKey: key, mode: 'typed_translation' }, catalog, `mode-${i}`);
      const question = state.runs[key].question;
      directions.add(question.direction);
      state = transition(state, { type: 'answer', runKey: key, questionId: question.id, answer: question.letters!.answer }, catalog, `answer-${i}`);
      state = transition(state, { type: state.runs[key].stageCompletedAt ? 'nextStage' : 'next', runKey: key }, catalog, `next-${i}`);
    }
    expect([...directions].sort()).toEqual(['fr-ru', 'ru-fr']);
  });

  it('migrates an old unfinished input question without resetting progress or language', () => {
    let state = start();
    state = transition(state, { type: 'mode', runKey: key, mode: 'typed_translation' }, catalog, 'input');
    delete state.runs[key].question.letters;
    delete state.lessonWords;
    state.settings.direction = 'ru-fr';
    const original = structuredClone(state);
    const restored = validateSave(state);
    expect(restored.runs[key].question.direction).toBe(original.runs[key].question.direction);
    expect(restored.runs[key].question.letters?.tiles.length).toBeGreaterThan(2);
    expect(restored.revision).toBe(original.revision);
    expect(restored.profileId).toBe(original.profileId);
    expect(state).toEqual(original);
    expect(validateSave(restored)).toEqual(restored);
  });

  it('rejects an imported puzzle missing a required tile', () => {
    const state = transition(start(), { type: 'mode', runKey: key, mode: 'typed_translation' }, catalog, 'input');
    state.runs[key].question.letters!.tiles = ['a', 'b'];
    expect(() => validateSave(state)).toThrow('Файл сохранения повреждён');
  });
});

function completeFirstThree(): GameState {
  const shortCatalog = structuredClone(catalog);
  for (const lesson of shortCatalog.lessons.slice(0, 3)) lesson.entryIds = lesson.entryIds.slice(0, 2);
  let state = initialState();
  for (const lesson of shortCatalog.lessons.slice(0, 3)) {
    const runKey = `lesson:${lesson.id}`;
    state = transition(state, { type: 'startLesson', lessonId: lesson.id }, shortCatalog, `start-${lesson.id}`);
    while (!state.runs[runKey].completedAt) {
      const q = state.runs[runKey].question;
      state = transition(state, { type: 'answer', runKey, questionId: q.id, answer: q.mode === 'typed_translation' ? q.letters!.answer : q.entryId }, shortCatalog, `answer-${q.id}`);
      state = transition(state, { type: 'next', runKey }, shortCatalog, `next-${q.id}`);
    }
  }
  return state;
}

describe('earned dictionaries', () => {
  it('archives the words actually completed, excludes distractors, and locks future volumes', () => {
    const state = completeFirstThree();
    const books = collectBooks(catalog, state);
    expect(books[0].earned).toBe(true);
    expect(books[0].words).toHaveLength(6);
    expect(books[1].earned).toBe(false);
    expect(books[1].words).toEqual([]);
    expect(Object.keys(state.lessonWords!)).toEqual(['a1-01', 'a1-02', 'a1-03']);
    expect(collectBooks(catalog, validateSave(state))).toEqual(books);
  });

  it('keeps a dictionary unchanged after replaying a changed catalog', () => {
    let state = completeFirstThree();
    const before = collectBooks(catalog, state)[0].words;
    state = transition(state, { type: 'startLesson', lessonId: 'a1-01' }, catalog, 'replay');
    expect(state.runs[key].taskIds).toHaveLength(100);
    expect(collectBooks(catalog, state)[0].words).toEqual(before);
  });

  it('restores already earned books from legacy completed runs before starting replay', () => {
    let state = completeFirstThree();
    delete state.lessonWords;
    const before = collectBooks(catalog, state)[0].words;
    state = transition(state, { type: 'startLesson', lessonId: 'a1-01' }, catalog, 'legacy-replay');
    expect(collectBooks(catalog, state)[0].words).toEqual(before);
  });
});

import { describe, expect, it } from 'vitest';
import catalogJson from '../public/content/catalog.json';
import type { Catalog } from '../src/types';
import { initialState, transition, unlocked, validateSave } from '../src/domain';
import { collectBooks } from '../src/books';
import { STAGE_SIZE } from '../src/stages';

const catalog = catalogJson as Catalog;

describe('new lessons and earned dictionaries', () => {
  it('unlocks 16–20 sequentially and keeps lesson 21 unavailable', () => {
    let state = initialState();
    for (const lesson of catalog.lessons.slice(0, 15)) state.completed[lesson.id] = { at: state.createdAt, version: catalog.version };
    for (const lesson of catalog.lessons.slice(15, 20)) {
      expect(unlocked(catalog, state, lesson.id)).toBe(true);
      expect(unlocked(catalog, state, catalog.lessons[lesson.order].id)).toBe(false);
      state = transition(state, { type: 'startLesson', lessonId: lesson.id }, catalog, `start-${lesson.id}`);
      const runKey = `lesson:${lesson.id}`;
      const run = state.runs[runKey];
      // Resume a real catalog snapshot with only its last encounter unfinished.
      run.defeated = run.taskIds.slice(0, -1);
      run.queue = run.taskIds.slice(-1);
      run.stageIndex = Math.floor((run.taskIds.length - 1) / STAGE_SIZE);
      run.attempts = run.correct = run.defeated.length;
      state = transition(state, { type: 'mode', runKey, mode: 'typed_translation' }, catalog, `last-${lesson.id}`);
      state = validateSave(state);
      const q = state.runs[runKey].question;
      state = transition(state, { type: 'answer', runKey, questionId: q.id, answer: q.letters!.answer }, catalog, `finish-${lesson.id}`);
      expect(state.completed[lesson.id]).toBeTruthy();
      expect(state.lessonWords![lesson.id].map(entry => entry.id)).toEqual(lesson.entryIds);
    }
    const sixth = collectBooks(catalog, state)[5];
    expect(sixth.earned).toBe(true);
    const words = sixth.words.map(word => word.entry.french);
    expect(words).toContain('rendre visite');
    expect(words).toContain("carte d'identité");
    expect(words).toContain('répondre');
    expect(sixth.words.every(word => word.lessonOrders.every(order => order >= 16 && order <= 18))).toBe(true);
    // Volume VII still needs lesson 21, even after completing 19 and 20.
    expect(collectBooks(catalog, state)[6].earned).toBe(false);
    expect(unlocked(catalog, state, 'a1-21')).toBe(false);
    expect(validateSave(state).completed).toEqual(state.completed);
  });
});

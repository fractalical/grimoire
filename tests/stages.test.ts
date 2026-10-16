import { describe, expect, it } from 'vitest';
import catalogJson from '../public/content/catalog.json';
import originalNumbers from '../content/lesson-06.json';
import type { Catalog, GameState } from '../src/types';
import { initialState, transition, unlocked, validateSave } from '../src/domain';
import { stageInfo } from '../src/stages';

const catalog = structuredClone(catalogJson) as Catalog;
catalog.lessons[0].entryIds = catalog.lessons[0].entryIds.slice(0, 23);
const key = 'lesson:a1-01';
const start = () => transition(initialState(), { type: 'startLesson', lessonId: 'a1-01' }, catalog, 'start');
function answer(state: GameState, correct = true) {
  const q = state.runs[key].question;
  const value = correct ? q.mode === 'typed_translation' ? q.letters!.answer : q.entryId : 'wrong';
  return transition(state, { type: 'answer', runKey: key, questionId: q.id, answer: value }, catalog, `answer-${state.revision}`);
}
const next = (state: GameState) => transition(state, { type: state.runs[key].stageCompletedAt && !state.runs[key].completedAt ? 'nextStage' : 'next', runKey: key }, catalog, `next-${state.revision}`);

describe('short lesson stages', () => {
  it('keeps the old 22-word lesson six snapshot and offers the expanded set on replay', () => {
    const oldCatalog = structuredClone(catalog);
    const lesson = oldCatalog.lessons[5];
    lesson.entryIds = originalNumbers.entries.map(word => oldCatalog.entries.find(entry => entry.lessonId === lesson.id && entry.french === word.french)!.id);
    let state = initialState();
    for (const previous of oldCatalog.lessons.slice(0, 5)) state.completed[previous.id] = { at: state.createdAt, version: oldCatalog.version };
    state = transition(state, { type: 'startLesson', lessonId: lesson.id }, oldCatalog, 'old-start');
    const runKey = `lesson:${lesson.id}`;
    delete state.runs[runKey].stageIndex;
    delete state.runs[runKey].stageCompletedAt;
    state = transition(validateSave(state), { type: 'startLesson', lessonId: lesson.id }, catalog, 'resume');
    expect(state.runs[runKey].taskIds).toHaveLength(22);
    expect(stageInfo(state.runs[runKey]).total).toBe(3);
    while (!state.runs[runKey].completedAt) {
      const q = state.runs[runKey].question;
      state = transition(state, { type: 'answer', runKey, questionId: q.id, answer: q.mode === 'typed_translation' ? q.letters!.answer : q.entryId }, catalog, `answer-${state.revision}`);
      state = transition(state, { type: state.runs[runKey].stageCompletedAt && !state.runs[runKey].completedAt ? 'nextStage' : 'next', runKey }, catalog, `next-${state.revision}`);
    }
    state = transition(state, { type: 'startLesson', lessonId: lesson.id }, catalog, 'replay');
    expect(state.runs[runKey].taskIds).toHaveLength(catalog.lessons[5].entryIds.length);
    expect(state.lessonWords![lesson.id]).toHaveLength(22);
  });

  it('stops after ten, resumes a saved checkpoint, and grants completion only after the short last stage', () => {
    let state = start();
    for (let i = 0; i < 10; i++) { state = answer(state); if (i < 9) state = next(state); }
    expect(stageInfo(state.runs[key])).toMatchObject({ index: 0, total: 3, completed: 10, size: 10 });
    expect(state.runs[key].stageCompletedAt).toBeTruthy();
    expect(state.completed).toEqual({});
    expect(unlocked(catalog, state, 'a1-02')).toBe(false);
    expect(() => transition(state, { type: 'next', runKey: key }, catalog, 'skip')).toThrow('Этап завершён');
    state = next(validateSave(JSON.parse(JSON.stringify(state))));
    expect(state.runs[key].question.entryId).toBe(catalog.lessons[0].entryIds[10]);
    expect(stageInfo(state.runs[key])).toMatchObject({ index: 1, completed: 0, size: 10 });
    for (let i = 10; i < 23; i++) {
      state = answer(state);
      if (i < 22) state = next(state);
    }
    expect(stageInfo(state.runs[key])).toMatchObject({ index: 2, completed: 3, size: 3 });
    expect(state.runs[key].completedAt).toBeTruthy();
    expect(unlocked(catalog, state, 'a1-02')).toBe(true);
    expect(state.lessonWords!['a1-01']).toHaveLength(23);
    expect(validateSave(state)).toEqual(state);
  });

  it('repeats a wrong answer at the boundary before offering any next-stage word', () => {
    let state = start();
    for (let i = 0; i < 9; i++) state = next(answer(state));
    const last = state.runs[key].question.entryId;
    for (let i = 0; i < 3; i++) {
      state = next(answer(state, false));
      expect(state.runs[key].question.entryId).toBe(last);
      expect(state.runs[key].stageCompletedAt).toBeNull();
      expect(stageInfo(state.runs[key]).completed).toBe(9);
    }
    state = answer(state);
    expect(state.runs[key].stageCompletedAt).toBeTruthy();
    expect(stageInfo(next(state).runs[key]).index).toBe(1);
  });

  it('adds stages to an older save while keeping its current answer and seven completed words', () => {
    let state = start();
    for (let i = 0; i < 6; i++) state = next(answer(state));
    state = answer(state);
    delete state.runs[key].stageIndex;
    delete state.runs[key].stageCompletedAt;
    const restored = validateSave(state);
    expect(restored.runs[key].question).toEqual(state.runs[key].question);
    expect(restored.runs[key].feedback).toEqual(state.runs[key].feedback);
    expect(restored.runs[key].defeated).toEqual(state.runs[key].defeated);
    expect(stageInfo(restored.runs[key])).toMatchObject({ index: 0, completed: 7 });
    expect(next(restored).runs[key].question.entryId).toBe(catalog.lessons[0].entryIds[7]);
    expect(validateSave(restored)).toEqual(restored);
  });

  it('returns to an earlier unresolved word in a legacy run without erasing later successes', () => {
    let state = start();
    for (let i = 0; i < 13; i++) state = next(answer(state));
    const run = state.runs[key];
    const missed = run.taskIds[9];
    run.defeated = run.defeated.filter(id => id !== missed);
    run.queue.splice(2, 0, missed);
    delete run.stageIndex;
    delete run.stageCompletedAt;
    const restored = validateSave(state);
    expect(restored.runs[key].defeated).toEqual(run.defeated);
    expect(restored.runs[key].question.entryId).toBe(missed);
    const advanced = next(answer(restored));
    expect(stageInfo(advanced.runs[key])).toMatchObject({ index: 1, completed: 3 });
    expect(advanced.runs[key].question.entryId).toBe(run.taskIds[13]);
  });

  it('migrates an old save exactly at a stage boundary to its saved summary', () => {
    let state = start();
    for (let i = 0; i < 10; i++) { state = answer(state); if (i < 9) state = next(state); }
    delete state.runs[key].stageIndex;
    delete state.runs[key].stageCompletedAt;
    const restored = validateSave(state);
    expect(restored.runs[key].stageCompletedAt).toBeTruthy();
    expect(stageInfo(restored.runs[key])).toMatchObject({ index: 0, completed: 10 });
    expect(stageInfo(next(restored).runs[key]).index).toBe(1);
  });
});

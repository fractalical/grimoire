import type { Catalog, Entry, GameState } from './types';

export interface DictionaryWord { entry: Entry; lessonOrders: number[] }
export interface Book { number: number; title: string; firstLesson: number; lastLesson: number; earned: boolean; words: DictionaryWord[] }

export function completedLessonWords(catalog: Catalog, state: GameState, lessonId: string): Entry[] {
  if (!state.completed[lessonId]) return [];
  if (state.lessonWords?.[lessonId]) return state.lessonWords[lessonId];
  const run = state.runs[`lesson:${lessonId}`];
  // Use taskIds, not the whole content snapshot, which also includes distractors.
  if (run) return run.taskIds.map(id => run.content[id]).filter((entry): entry is Entry => !!entry);
  const lesson = catalog.lessons.find(item => item.id === lessonId);
  return (lesson?.entryIds || []).map(id => catalog.entries.find(entry => entry.id === id)).filter((entry): entry is Entry => !!entry);
}

export function collectBooks(catalog: Catalog, state: GameState): Book[] {
  const lessons = [...catalog.lessons].sort((a, b) => a.order - b.order);
  return Array.from({ length: Math.floor(lessons.length / 3) }, (_, index) => {
    const group = lessons.slice(index * 3, index * 3 + 3);
    const earned = group.every(lesson => !!state.completed[lesson.id]);
    const words = new Map<string, DictionaryWord>();
    if (earned) for (const lesson of group) for (const entry of completedLessonWords(catalog, state, lesson.id)) {
      const existing = words.get(entry.lexemeId);
      if (existing) {
        if (!existing.lessonOrders.includes(lesson.order)) existing.lessonOrders.push(lesson.order);
      } else words.set(entry.lexemeId, { entry, lessonOrders: [lesson.order] });
    }
    return {
      number: index + 1,
      title: `Том ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][index] || index + 1}`,
      firstLesson: group[0].order, lastLesson: group[2].order, earned,
      words: [...words.values()].sort((a, b) => a.entry.french.localeCompare(b.entry.french, 'fr')),
    };
  });
}

export const dictionarySearch = (text: string) => text.toLocaleLowerCase().replace(/ё/g, 'е').normalize('NFD').replace(/\p{M}/gu, '').trim();

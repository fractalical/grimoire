export type Mode = 'translation_choice' | 'typed_translation' | 'image_choice';
export type Direction = 'fr-ru' | 'ru-fr';
export interface Entry {
  id: string; lexemeId: string; lessonId: string; french: string; russian: string;
  pronunciation: string; example: string; sourcePage: number;
  acceptedRu: string[]; acceptedFr: string[]; distractorIds: string[];
  image?: { url: string; alt: string }; imageDistractorIds?: string[];
}
export interface Lesson { id: string; order: number; title: string; subtitle: string; sourceFile: string; status: 'published' | 'draft'; entryIds: string[] }
export interface Catalog { version: string; lessons: Lesson[]; entries: Entry[]; imageCredits: { url: string; sourceUrl: string; author: string; source: string }[] }
export interface Option { id: string; label: string; image?: { url: string; alt: string } }
export interface LetterPuzzle { answer: string; tiles: string[] }
export interface Question { id: string; entryId: string; mode: Mode; direction: Direction; prompt: string; options: Option[]; accepted: string[]; letters?: LetterPuzzle }
export interface Feedback { correct: boolean; answer: string; expected: string; accentHint: boolean; questionId: string }
export interface Run {
  id: string; kind: 'lesson' | 'daily' | 'replay'; lessonId?: string; date?: string;
  timeZone: string; contentVersion: string; title: string; sourceFiles: Record<string, string>;
  content: Record<string, Entry>; taskIds: string[]; queue: string[]; defeated: string[];
  question: Question; feedback: Feedback | null; serial: number; attempts: number; correct: number;
  completedAt: string | null; createdAt: string;
  stageIndex?: number; stageCompletedAt?: string | null;
}
export interface Mastery { attempts: number; correct: number; step: number; due: string; lastIndependentDate: string; lastError?: string }
export interface GameState {
  schema: 1; revision: number; profileId: string; createdAt: string; timeZone: string;
  completed: Record<string, { at: string; version: string }>;
  runs: Record<string, Run>; mastery: Record<string, Mastery>;
  lessonWords?: Record<string, Entry[]>;
  settings: { reduceMotion: boolean; direction?: Direction }; lastCommand: string | null;
}
export type GameCommand =
  | { type: 'startLesson'; lessonId: string }
  | { type: 'startDaily'; date: string }
  | { type: 'answer'; runKey: string; questionId: string; answer: string }
  | { type: 'next'; runKey: string }
  | { type: 'nextStage'; runKey: string }
  | { type: 'mode'; runKey: string; mode: Mode }
  | { type: 'settings'; reduceMotion?: boolean };

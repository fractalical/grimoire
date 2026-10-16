import type { LetterPuzzle, Question } from './types';
import { shuffle } from './random';

export const isLetterTile = (char: string) => /^[\p{L}\p{N}]$/u.test(char);
const normalize = (value: string) => value.normalize('NFC').toLocaleLowerCase().replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ');

export function createLetterPuzzle(question: Pick<Question, 'accepted' | 'direction'>, seed: string): LetterPuzzle {
  // Prefer a complete standalone accepted translation, rather than a list of synonyms.
  const answer = normalize(question.accepted.find(value => !/[\/;()]/.test(value)) || question.accepted[0]);
  const needed = Array.from(answer).filter(isLetterTile);
  const alphabet = Array.from(question.direction === 'fr-ru'
    ? 'абвгдеёжзийклмнопрстуфхцчшщыэюя'
    : 'abcdefghijklmnopqrstuvwxyzàâçéèêëîïôùûüœ');
  const extras = shuffle(alphabet.filter(char => !needed.includes(char)), seed + ':extras').slice(0, 2);
  return { answer, tiles: shuffle([...needed, ...extras], seed + ':tiles') };
}

export function assembleLetters(puzzle: LetterPuzzle, selected: number[]): string {
  let index = 0;
  return Array.from(puzzle.answer).map(char => isLetterTile(char) ? puzzle.tiles[selected[index++]] || '' : char).join('');
}

export function validLetterPuzzle(value: unknown, question: Question): value is LetterPuzzle {
  if (!value || typeof value !== 'object') return false;
  const puzzle = value as LetterPuzzle;
  if (typeof puzzle.answer !== 'string' || !puzzle.answer || !Array.isArray(puzzle.tiles)
    || !question.accepted.some(answer => normalize(answer) === puzzle.answer)
    || !puzzle.tiles.every(char => typeof char === 'string' && isLetterTile(char))) return false;
  const remaining = [...puzzle.tiles];
  for (const char of Array.from(puzzle.answer).filter(isLetterTile)) {
    const index = remaining.indexOf(char);
    if (index < 0) return false;
    remaining.splice(index, 1);
  }
  return remaining.length === 2;
}

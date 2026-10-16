import { useState } from 'react';
import { Check, Delete, RotateCcw } from 'lucide-react';
import type { Feedback, Question } from './types';
import { assembleLetters, createLetterPuzzle, isLetterTile } from './letters';

export function LetterBuilder({ question, feedback, busy, onSubmit }: {
  question: Question; feedback: Feedback | null; busy: boolean; onSubmit: (answer: string) => void;
}) {
  const puzzle = question.letters || createLetterPuzzle(question, question.id);
  const [selected, setSelected] = useState<number[]>([]);
  const required = Array.from(puzzle.answer).filter(isLetterTile).length;
  const disabled = busy || !!feedback;
  const full = selected.length === required;
  const answer = assembleLetters(puzzle, selected);
  let slot = 0;

  return <div className="letter-builder">
    {feedback ? <div className="assembled-answer" aria-label="Твой ответ">{feedback.answer}</div> : <>
      <div className="letter-slots" role="group" aria-label="Собранный ответ" lang={question.direction === 'fr-ru' ? 'ru' : 'fr'}>
        {Array.from(puzzle.answer).map((char, index) => {
          if (!isLetterTile(char)) return <span key={index} className={`letter-separator ${char === ' ' ? 'word-space' : ''}`} aria-label={char === ' ' ? 'Пробел' : undefined}>{char}</span>;
          const position = slot++;
          const tile = selected[position];
          return <button key={index} className={`letter-slot ${tile !== undefined ? 'filled' : ''}`} type="button" disabled={disabled || tile === undefined} aria-label={tile === undefined ? `Буква ${position + 1}: пусто` : `Убрать ${puzzle.tiles[tile]}, позиция ${position + 1}`} onClick={() => setSelected(current => current.filter((_, i) => i !== position))}>{tile === undefined ? <span aria-hidden="true">·</span> : puzzle.tiles[tile]}</button>;
        })}
      </div>
      <div className="letter-tools"><span>{selected.length} / {required} букв</span><button type="button" disabled={disabled || !selected.length} onClick={() => setSelected(current => current.slice(0, -1))} aria-label="Убрать последнюю букву"><Delete size={17} /></button><button type="button" disabled={disabled || !selected.length} onClick={() => setSelected([])} aria-label="Очистить ответ"><RotateCcw size={17} /></button></div>
      <div className="letter-bank" role="group" aria-label="Доступные буквы" lang={question.direction === 'fr-ru' ? 'ru' : 'fr'}>{puzzle.tiles.map((char, index) => <button className="letter-tile" key={index} type="button" aria-label={`Буква ${char}`} disabled={disabled || full || selected.includes(index)} onClick={() => setSelected(current => current.length < required && !current.includes(index) ? [...current, index] : current)}>{char}</button>)}</div>
      <p className="letter-hint">Собери перевод. Две буквы лишние. Нажми на выбранную букву, чтобы вернуть её.</p>
      <button className="primary" type="button" disabled={disabled || !full} onClick={() => onSubmit(answer)}>Проверить<Check size={18} /></button>
    </>}
  </div>;
}

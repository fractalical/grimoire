import { useState } from 'react';
import { ArrowRight, Check, Keyboard, ListChecks, Image as ImageIcon, Trophy } from 'lucide-react';
import type { Dispatch, Screen } from './App';
import type { GameState, Run } from './types';
import { availableModes, rewards } from './domain';
import { asset, EncounterScene, Mage } from './Scene';
import { LetterBuilder } from './LetterBuilder';
import { stageInfo } from './stages';

interface PlayProps {
  run: Run;
  runKey: string;
  state: GameState;
  busy: boolean;
  dispatch: Dispatch;
  go: (screen: Screen, runKey?: string) => void;
}

const modes = [
  { id: 'translation_choice', label: 'Перевод', icon: ListChecks },
  { id: 'typed_translation', label: 'Ввод', icon: Keyboard },
  { id: 'image_choice', label: 'Картинки', icon: ImageIcon },
] as const;

export function Play({ run, runKey, state, busy, dispatch, go }: PlayProps) {
  const [showStageResult, setShowStageResult] = useState(!!run.stageCompletedAt);
  const [showResult, setShowResult] = useState(!!run.completedAt);
  const counts = rewards(state);
  const stage = stageInfo(run);

  async function next() {
    if (run.completedAt) { setShowResult(true); return; }
    if (run.stageCompletedAt) { setShowStageResult(true); return; }
    await dispatch({ type: 'next', runKey });
  }

  if (run.completedAt && showResult) return <section className="result-card" aria-labelledby="result-title">
    <span className="result-icon"><Trophy size="1.875rem" /></span>
    <p className="eyebrow">ПРОГРЕСС СОХРАНЁН</p>
    <h1 id="result-title">{run.kind === 'daily' ? 'Задание выполнено!' : 'Урок пройден!'}</h1>
    <Mage form={counts.form} className="result-mage" />
    <p>{run.title}</p>
    <div className="result-stats"><span><strong>{run.defeated.length}</strong> слов пройдено</span><span><strong>{run.attempts - run.correct}</strong> ошибок</span></div>
    {run.feedback && <p className="answer-summary"><span lang="fr">{run.content[run.question.entryId].french}</span> — {run.content[run.question.entryId].russian}</p>}
    {run.kind === 'lesson' && <p className="muted">Твой путь продолжается. Все полученные книги доступны в коллекции.</p>}
    <button className="primary" onClick={() => go(run.kind === 'daily' ? 'daily' : 'map')}>Вернуться {run.kind === 'daily' ? 'к заданиям' : 'на карту'}<ArrowRight size="1.125rem" /></button>
  </section>;

  if (run.stageCompletedAt && showStageResult && !run.completedAt) return <section className="result-card" aria-labelledby="stage-result-title">
    <span className="result-icon"><Check size="1.875rem" /></span>
    <p className="eyebrow">ЭТАП {stage.index + 1} / {stage.total} · ПРОГРЕСС СОХРАНЁН</p>
    <h1 id="stage-result-title">Этап {stage.index + 1} пройден!</h1>
    <p>Все {stage.size} слов этого этапа пройдены. Всего в уроке — {run.defeated.length} из {run.taskIds.length}.</p>
    <dl className="stage-word-list">{stage.ids.map(id => <div key={id}><dt lang="fr">{run.content[id].french}</dt><dd>{run.content[id].russian}</dd></div>)}</dl>
    <p className="muted">Следующий этап можно начать сейчас или после отдыха.</p>
    <button className="primary" disabled={busy} onClick={async () => { if (await dispatch({ type: 'nextStage', runKey })) { setShowStageResult(false); window.scrollTo(0, 0); } }}>Следующий этап<ArrowRight size="1.125rem" /></button>
    <button className="secondary" disabled={busy} onClick={() => go('map')}>Отдохнуть и выйти</button>
  </section>;

  return <>
    <div className="run-progress"><span>{run.kind === 'daily' ? 'Пройдено слов' : `Этап ${stage.index + 1} / ${stage.total}`}</span><strong>{stage.completed} / {stage.size}</strong></div>
    <div className="progress-track" role="progressbar" aria-label={run.kind === 'daily' ? 'Прогресс задания' : 'Прогресс этапа'} aria-valuenow={stage.completed} aria-valuemin={0} aria-valuemax={stage.size}><span style={{ width: `${stage.completed / stage.size * 100}%` }} /></div>
    {run.kind !== 'daily' && <p className="stage-overall">Всего в уроке: {run.defeated.length} / {run.taskIds.length} слов</p>}
    <EncounterScene run={run} form={counts.form} />
    <QuestionCard key={run.question.id} run={run} runKey={runKey} busy={busy} dispatch={dispatch} onNext={() => next()} />
  </>;
}

function QuestionCard({ run, runKey, busy, dispatch, onNext }: Pick<PlayProps, 'run' | 'runKey' | 'busy' | 'dispatch'> & { onNext: () => void }) {
  const question = run.question;
  const entry = run.content[question.entryId];
  const feedback = run.feedback;
  const available = availableModes(entry, run.content).filter(mode => mode !== 'image_choice' || question.direction === 'fr-ru');
  const disabled = busy || !!feedback;
  const instruction = question.mode === 'image_choice' ? 'Выбери подходящую картинку' : question.mode === 'translation_choice' ? 'Выбери перевод' : question.direction === 'fr-ru' ? 'Собери перевод по-русски' : 'Собери перевод по-французски';

  function submit(value: string) {
    if (!disabled) void dispatch({ type: 'answer', runKey, questionId: question.id, answer: value });
  }

  return <section className="question-card" aria-labelledby="question-title">
    <div className="mode-tabs" role="group" aria-label="Формат вопроса">{modes.filter(mode => available.includes(mode.id)).map(mode => <button key={mode.id} aria-pressed={question.mode === mode.id} disabled={disabled || question.mode === mode.id} onClick={() => dispatch({ type: 'mode', runKey, mode: mode.id })}><mode.icon size="1rem" />{mode.label}</button>)}</div>
    <p className="eyebrow">{instruction}</p>
    <h1 id="question-title" lang={question.direction === 'fr-ru' ? 'fr' : 'ru'}>{question.prompt}</h1>
    {question.direction === 'fr-ru' && entry.pronunciation && <p className="pronunciation">{entry.pronunciation}</p>}
    {question.mode === 'typed_translation' ? <LetterBuilder question={question} feedback={feedback} busy={busy} onSubmit={submit} /> : <div className={`answer-options ${question.mode === 'image_choice' ? 'image-options' : ''}`}>{question.options.map((option, index) => {
      const correct = !!feedback && option.id === question.entryId;
      const wrong = !!feedback && !feedback.correct && option.id === feedback.answer;
      return <button key={option.id} className={`answer-option ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}`} disabled={disabled} onClick={() => submit(option.id)} aria-label={option.image ? option.image.alt : option.label}>
        {option.image ? <img src={asset(option.image.url)} alt={option.image.alt} /> : <><span className="option-number">{index + 1}</span><span>{option.label}</span></>}
        {correct && <Check size="1.125rem" aria-label="Правильный ответ" />}
      </button>;
    })}</div>}
    {feedback && <div className={`feedback ${feedback.correct ? 'success' : 'retry'}`} role="status">
      <strong>{feedback.correct ? 'Верно! Ещё одно слово на твоём пути.' : feedback.accentHint ? 'Проверь знак над буквой.' : 'Запомним и попробуем ещё раз.'}</strong>
      <p><span lang="fr">{entry.french}</span> — {entry.russian}</p>
      {entry.example && <p className="example" lang="fr">{entry.example}</p>}
      {!feedback.correct && <p className="muted">Это слово встретится снова.</p>}
      <button className="primary" disabled={busy} onClick={onNext}>{run.completedAt ? 'Завершить' : run.stageCompletedAt ? 'Итоги этапа' : 'Дальше'}<ArrowRight size="1.125rem" /></button>
    </div>}
    <p className="source-note">Источник: {run.sourceFiles[entry.lessonId]}, стр. {entry.sourcePage}</p>
  </section>;
}

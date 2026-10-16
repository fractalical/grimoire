import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Download, LockKeyhole, Search, ShieldCheck, Sun, Upload } from 'lucide-react';
import { dateLabel } from './App';
import type { Dispatch } from './App';
import type { Catalog, GameState } from './types';
import { rewards } from './domain';
import { Mage } from './Scene';
import { collectBooks, dictionarySearch } from './books';

export function Books({ catalog, state }: { catalog: Catalog; state: GameState }) {
  const counts = rewards(state);
  const books = collectBooks(catalog, state);
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const book = books.find(item => item.number === selected && item.earned);
  if (book) {
    const query = dictionarySearch(search);
    const words = book.words.filter(({ entry }) => dictionarySearch(`${entry.french} ${entry.russian}`).includes(query));
    return <section className="dictionary" aria-label={`Словарь: ${book.title}`}>
      <button className="dictionary-back" onClick={() => { setSelected(null); setSearch(''); window.scrollTo(0, 0); }}><ArrowLeft size={17} />К коллекции</button>
      <div className="page-heading"><div><p className="eyebrow">СЛОВАРЬ · УРОКИ {book.firstLesson}–{book.lastLesson}</p><h1>{book.title}</h1></div><BookOpen size={32} /></div>
      <p className="muted">Французские слова, переводы и примеры из пройденных уроков.</p>
      <label className="dictionary-search"><Search size={18} /><span className="sr-only">Найти слово или перевод</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Слово или перевод" /></label>
      <p className="dictionary-count" role="status">{query ? `Найдено: ${words.length} из ${book.words.length}` : `Слов в книге: ${book.words.length}`}</p>
      <dl className="dictionary-list">{words.map(({ entry, lessonOrders }) => <div className="dictionary-entry" key={entry.lexemeId}>
        <dt lang="fr">{entry.french}</dt>
        {entry.pronunciation && <dd className="dictionary-pronunciation">[{entry.pronunciation}]</dd>}
        <dd className="dictionary-translation">{entry.russian}</dd>
        {entry.example && <dd className="dictionary-example" lang="fr">{entry.example}</dd>}
        <dd className="source-note">{lessonOrders.length > 1 ? 'Уроки' : 'Урок'} {lessonOrders.join(', ')} · стр. {entry.sourcePage}</dd>
      </div>)}</dl>
      {!words.length && <p className="empty-state">Ничего не найдено. Попробуй другое слово.</p>}
    </section>;
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</p><h1>Маг и книги</h1></div><span className="progress-pill"><BookOpen size={17} />{counts.books} / {books.length}</span></div>
    <section className="hero-card"><Mage form={counts.form} /><div><p className="eyebrow">ОБЛИК {counts.form + 1}</p><h2>{counts.form ? 'Маг знаний' : 'Маг-ученик'}</h2><p className="muted">Новый облик — за каждые 6 пройденных уроков.</p></div></section>
    <p className="section-intro">Каждые 3 пройденных урока приносят книгу со словарём. Открой полученный том, чтобы повторить слова.</p>
    <div className="book-grid">{books.map(item => <article className={`book-card ${item.earned ? 'earned' : ''}`} key={item.number} aria-label={`Книга ${item.number}: ${item.earned ? 'получена' : `после урока ${item.lastLesson}`}`}><button className="book-open" disabled={!item.earned} aria-label={`Открыть ${item.title}`} onClick={() => { setSelected(item.number); setSearch(''); window.scrollTo(0, 0); }}><BookOpen size={36} /><h2>{item.title}</h2><span>{item.earned ? <Check size={13} /> : <LockKeyhole size={13} />}{item.earned ? `${item.words.length} слов` : `Урок ${item.lastLesson}`}</span><small>Уроки {item.firstLesson}–{item.lastLesson}</small></button></article>)}</div>
  </>;
}

interface DailyProps {
  state: GameState;
  date: string;
  busy: boolean;
  onStart: () => void;
  onResume: (key: string) => void;
  onMap: () => void;
}

export function Daily({ state, date, busy, onStart, onResume, onMap }: DailyProps) {
  const unlocked = rewards(state).completed > 0;
  const current = state.runs[`daily:${date}`];
  const previous = Object.entries(state.runs).filter(([, run]) => run.kind === 'daily' && run.date !== date).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));
  return <>
    <div className="page-heading"><div><p className="eyebrow">ПОНЕМНОГУ КАЖДЫЙ ДЕНЬ</p><h1>Ежедневное задание</h1></div></div>
    <section className="daily-card"><span className="result-icon"><Sun size={30} /></span><p className="eyebrow">{dateLabel(date)}</p><h2>{!unlocked ? 'Сначала — первое приключение' : current?.completedAt ? 'На сегодня всё готово!' : 'Знакомые слова, новая тропа'}</h2><p className="muted">{!unlocked ? 'Пройди первый урок, чтобы открыть ежедневное задание.' : current?.completedAt ? `Ты повторил ${current.taskIds.length} слов. Возвращайся завтра за новым заданием.` : 'До 10 слов из пройденных уроков. Повторение поможет сохранить их в памяти.'}</p>
      {current && !current.completedAt && <p>Пройдено {current.defeated.length} из {current.taskIds.length} слов</p>}
      <button className="primary" disabled={busy} onClick={!unlocked ? onMap : current ? () => onResume(`daily:${date}`) : onStart}>{!unlocked ? 'На карту' : current?.completedAt ? 'Посмотреть результат' : current ? 'Продолжить задание' : 'Начать задание'}<ArrowRight size={18} /></button>
    </section>
    {previous.length > 0 && <section className="history"><h2>Прошлые задания</h2>{previous.map(([key, run]) => <button className="history-row" key={key} disabled={busy} onClick={() => onResume(key)}><span>{dateLabel(run.date!)}<small>{run.completedAt ? 'Выполнено' : `${run.defeated.length} / ${run.taskIds.length} слов · продолжить`}</small></span>{run.completedAt ? <Check size={20} /> : <ArrowRight size={20} />}</button>)}</section>}
    <p className="quiet-note">Учебный день определяется по часовому поясу {state.timeZone}.</p>
  </>;
}

interface SettingsProps {
  state: GameState;
  catalog: Catalog;
  busy: boolean;
  dispatch: Dispatch;
  importData: (value: unknown) => Promise<void>;
  onError: (message: string) => void;
}

export function SettingsPage({ state, catalog, busy, dispatch, importData, onError }: SettingsProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  function exportSave() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `grimoire-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readSave(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Файл сохранения слишком большой. Максимум — 5 МБ.');
      let value: unknown;
      try { value = JSON.parse(await file.text()); }
      catch { throw new Error('Не удалось прочитать JSON. Выбери файл сохранения, экспортированный из игры.'); }
      await importData(value);
    } catch (error) { onError((error as Error).message); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">ТВОЙ ГРИМУАР</p><h1>Настройки</h1></div></div>
    <section className="settings-card"><h2>Обучение и движение</h2>
      <label className="setting-row"><span><strong>Меньше анимации</strong><small>Спокойные переходы и эффекты</small></span><input type="checkbox" checked={state.settings.reduceMotion} disabled={busy} onChange={event => dispatch({ type: 'settings', reduceMotion: event.target.checked })} /></label>
      <p className="muted">В режиме «Ввод» собери перевод из букв. Язык вопроса выбирается случайно и остаётся тем же при смене формата.</p>
    </section>
    <section className="settings-card"><h2>Сохранение прогресса</h2><p className="muted">Прогресс хранится в этом браузере. Скачай копию, чтобы перенести его на другое устройство или восстановить после очистки данных браузера.</p>
      <button className="secondary" disabled={busy} onClick={exportSave}><Download size={18} />Скачать сохранение</button>
      <p className="muted">Загрузка файла заменит текущий прогресс данными из сохранения.</p>
      <input className="sr-only" ref={fileInput} type="file" accept=".json,application/json" aria-label="Файл сохранения" disabled={busy} onChange={event => void readSave(event.target.files?.[0])} />
      <button className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={18} />Загрузить сохранение</button>
      <p className="quiet-note"><ShieldCheck size={14} />Ответы сохраняются автоматически</p>
    </section>
    <section className="settings-card"><h2>Учебный материал</h2><p className="muted">Доступно {catalog.lessons.filter(lesson => lesson.status === 'published').length} из {catalog.lessons.length} уроков. Каждый урок разделён на этапы до 10 слов. Слова и выражения взяты из PDF; аудиоупражнения и грамматические задания целиком в игру не переносятся.</p><p className="source-note">Версия словаря: {catalog.version}</p>
      <details><summary>Источники фотографий</summary><ul className="credits-list">{catalog.imageCredits.map(credit => <li key={credit.url}><a href={credit.sourceUrl} target="_blank" rel="noreferrer">{credit.author} · {credit.source}</a></li>)}</ul></details>
    </section>
  </>;
}

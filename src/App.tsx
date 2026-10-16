import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Feather, LockKeyhole, Map as MapIcon, Settings, ShieldCheck, Sun, X } from 'lucide-react';
import type { Catalog, GameCommand, GameState } from './types';
import { rewards, today, transition, uid, unlocked } from './domain';
import { commitState, loadState, replaceState } from './persistence';
import { asset, WorldMap } from './Scene';
import { Play } from './Play';
import { Books, Daily, SettingsPage } from './Pages';
import { stageInfo, STAGE_SIZE } from './stages';

export type Screen = 'map' | 'books' | 'daily' | 'settings' | 'play';
export type Dispatch = (command: GameCommand) => Promise<boolean>;
export const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
function getRoute(): { screen: Screen; runKey?: string } {
  try {
    const [screen, key] = location.hash.replace(/^#\/?/, '').split('/');
    return ['map', 'books', 'daily', 'settings', 'play'].includes(screen) ? { screen: screen as Screen, runKey: key ? decodeURIComponent(key) : undefined } : { screen: 'map' };
  } catch { return { screen: 'map' }; }
}
export default function App() {
  const [catalog, setCatalog] = useState<Catalog>(); const [state, setState] = useState<GameState>();
  const [route, setRoute] = useState(getRoute); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('a1-01'); const [chapter, setChapter] = useState(0); const [walking, setWalking] = useState(false);
  const [clock, setClock] = useState(new Date()); const locked = useRef(false); const live = useRef<GameState | undefined>(undefined);
  const channel = useRef<BroadcastChannel | null>(null);
  const update = useCallback((s: GameState) => { live.current = s; setState(s); }, []);
  useEffect(() => {
    let active = true;
    Promise.all([fetch(asset('/content/catalog.json')).then(r => { if (!r.ok) throw new Error('Не удалось загрузить уроки. Проверь соединение.'); return r.json() as Promise<Catalog>; }), loadState()]).then(([data, saved]) => {
      if (!active) return; if (!data.version || !Array.isArray(data.entries) || !Array.isArray(data.lessons)) throw new Error('Файл уроков повреждён.');
      setCatalog(data); update(saved);
      const next = data.lessons.find(l => l.status === 'published' && !saved.completed[l.id]) || data.lessons[0]; setSelected(next.id); setChapter(Math.floor((next.order - 1) / 6));
    }).catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [update]);
  useEffect(() => {
    const onHash = () => { setRoute(getRoute()); setError(''); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash); const timer = window.setInterval(() => setClock(new Date()), 30000);
    if ('BroadcastChannel' in window) { channel.current = new BroadcastChannel('grimoire-progress'); channel.current.onmessage = () => { if (!locked.current) loadState().then(update).catch(() => {}); }; }
    return () => { window.removeEventListener('hashchange', onHash); window.clearInterval(timer); channel.current?.close(); };
  }, [update]);
  const go = (screen: Screen, runKey?: string) => { location.hash = `/${screen}${runKey ? '/' + encodeURIComponent(runKey) : ''}`; };
  async function dispatch(command: GameCommand): Promise<boolean> {
    if (locked.current || !live.current || !catalog) return false;
    locked.current = true; setBusy(true); setError('');
    try {
      const next = transition(live.current, command, catalog, uid());
      await commitState(next, live.current.revision); update(next); channel.current?.postMessage(next.revision); return true;
    } catch (e) {
      setError((e as Error).message);
      try { update(await loadState()); } catch { /* Preserve the current in-memory snapshot. */ }
      return false;
    } finally { locked.current = false; setBusy(false); }
  }
  async function startLesson(id: string) {
    if (await dispatch({ type: 'startLesson', lessonId: id })) {
      setWalking(true); await new Promise(resolve => setTimeout(resolve, state?.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400));
      setWalking(false); go('play', `lesson:${id}`);
    }
  }
  async function importData(value: unknown) {
    if (locked.current || !live.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const next = await replaceState(value, live.current.revision); update(next); channel.current?.postMessage(next.revision); go('map'); }
    catch (e) { setError((e as Error).message); try { update(await loadState()); } catch { /* Keep save. */ } }
    finally { locked.current = false; setBusy(false); }
  }
  if (!catalog || !state) return <main className="app-shell loading-screen"><BookOpen size={38} /><h1>Открываем гримуар</h1><p role={error ? 'alert' : 'status'}>{error || 'Собираем слова для приключения…'}</p>{error && <button className="primary" onClick={() => location.reload()}>Попробовать ещё раз</button>}</main>;
  const counts = rewards(state); const run = route.runKey ? state.runs[route.runKey] : undefined; const day = today(state.timeZone, clock);
  return <div className={`app-shell ${state.settings.reduceMotion ? 'reduced-motion' : ''}`}>
    <header className="app-header">
      {route.screen === 'play' ? <><button className="icon-button" aria-label="Сохранить и выйти на карту" onClick={() => go('map')} disabled={busy}><ArrowLeft size={22} /></button><div className="header-title"><small>{run?.kind === 'daily' ? 'ЕЖЕДНЕВНОЕ ЗАДАНИЕ' : `УРОК ${catalog.lessons.find(l => l.id === run?.lessonId)?.order || ''}`}</small><strong>{run?.title || 'Приключение'}</strong></div></> : <><a href="#/map" className="brand"><span className="brand-mark"><BookOpen size={23} /></span><span>Гримуар<small>УЧИ ФРАНЦУЗСКИЙ ИГРАЯ</small></span></a><button className="icon-button" aria-label="Настройки и сохранение" onClick={() => go('settings')}><Settings size={20} /></button></>}
    </header>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Закрыть сообщение" onClick={() => setError('')}><X size={18} /></button></div>}
    <main className={route.screen === 'play' ? 'play-main' : 'page-main'}>
      {route.screen === 'map' && <>
        <div className="page-heading"><div><p className="eyebrow">A1 · ПУТЬ УЧЕНИКА</p><h1>Твоё приключение</h1></div><div className="progress-pill" aria-label={`Пройдено ${counts.completed} из 34 уроков`}><Feather size={17} /><strong>{counts.completed}</strong><span>/ 34</span></div></div>
        <div className="chapter-line"><button className="small-icon" disabled={chapter === 0} aria-label="Предыдущая глава" onClick={() => { setChapter(chapter - 1); setSelected(catalog.lessons[(chapter - 1) * 6].id); }}><ChevronLeft size={18} /></button><span>Глава {['I', 'II', 'III', 'IV', 'V', 'VI'][chapter]} <i /> Уроки {chapter * 6 + 1}–{Math.min((chapter + 1) * 6, 34)}</span><button className="small-icon" disabled={chapter === 5} aria-label="Следующая глава" onClick={() => { setChapter(chapter + 1); setSelected(catalog.lessons[(chapter + 1) * 6].id); }}><ChevronRight size={18} /></button></div>
        <WorldMap catalog={catalog} state={state} lessons={catalog.lessons.slice(chapter * 6, chapter * 6 + 6)} selected={selected} onSelect={setSelected} walking={walking} />
        {(() => {
          const lesson = catalog.lessons.find(l => l.id === selected)!; const previous = state.runs[`lesson:${lesson.id}`]; const done = !!state.completed[lesson.id]; const open = unlocked(catalog, state, lesson.id);
          const stage = previous && !previous.completedAt ? stageInfo(previous) : undefined;
          const totalStages = stage?.total || Math.ceil(lesson.entryIds.length / STAGE_SIZE);
          return <section className="lesson-card" aria-label="Выбранный урок"><div className="lesson-card-top"><span className="lesson-seal">{lesson.order.toString().padStart(2, '0')}</span><div><p className="eyebrow">{done ? 'ПРОЙДЕНО' : lesson.status === 'draft' ? 'НОВОЕ ПРИКЛЮЧЕНИЕ СКОРО' : open ? 'ТВОЙ СЛЕДУЮЩИЙ ШАГ' : 'ВПЕРЕДИ НА ТРОПЕ'}</p><h2>{lesson.title}</h2><p className="muted">{lesson.subtitle}</p></div></div>
            {lesson.status === 'published' && <><div className="lesson-meta"><span><BookOpen size={14} /> {previous && !previous.completedAt ? previous.taskIds.length : lesson.entryIds.length} слов</span><span><Sun size={14} /> {totalStages} этапов · до 10 слов</span></div><ol className="stage-markers" aria-label="Этапы урока">{Array.from({ length: totalStages }, (_, index) => <li key={index} className={done || stage && (index < stage.index || index === stage.index && previous?.stageCompletedAt) ? 'complete' : stage && index === stage.index ? 'current' : ''} aria-label={`Этап ${index + 1}${done || stage && (index < stage.index || index === stage.index && previous?.stageCompletedAt) ? ', пройден' : ''}`}>{index + 1}</li>)}</ol></>}
            {previous && !previous.completedAt && <div className="progress-track" aria-label={`Пройдено ${previous.defeated.length} из ${previous.taskIds.length} слов`}><span style={{ width: `${previous.defeated.length / previous.taskIds.length * 100}%` }} /></div>}
            <button className="primary" disabled={!open || busy || walking} onClick={() => startLesson(lesson.id)}>{lesson.status === 'draft' ? 'Урок готовится' : !open ? <><LockKeyhole size={16} /> Пройди урок {lesson.order - 1}</> : <>{stage ? previous?.stageCompletedAt ? `Итоги этапа ${stage.index + 1}` : `Продолжить этап ${stage.index + 1} · ${stage.completed}/${stage.size}` : done ? 'Повторить урок' : 'Начать приключение'}<ArrowRight size={18} /></>}</button>
          </section>;
        })()}
        <button className="daily-shortcut" onClick={() => go('daily')}><span className="sun-icon"><Sun size={23} /></span><span><strong>Маленький шаг каждый день</strong><small>{counts.completed ? 'Случайные слова из пройденных уроков' : 'Откроется после первого урока'}</small></span><ChevronRight size={20} /></button>
        <p className="quiet-note"><ShieldCheck size={13} /> Прогресс сохраняется после каждого ответа</p>
      </>}
      {route.screen === 'play' && (run ? <Play key={run.id} run={run} runKey={route.runKey!} state={state} busy={busy} dispatch={dispatch} go={go} /> : <div className="empty-state"><MapIcon size={40} /><h1>Начнём с карты</h1><p>Выбери урок, чтобы отправиться в приключение.</p><button className="primary" onClick={() => go('map')}>К карте</button></div>)}
      {route.screen === 'books' && <Books catalog={catalog} state={state} />}
      {route.screen === 'daily' && <Daily state={state} date={day} busy={busy} onStart={async () => { if (await dispatch({ type: 'startDaily', date: day })) go('play', `daily:${day}`); }} onResume={key => go('play', key)} onMap={() => go('map')} />}
      {route.screen === 'settings' && <SettingsPage state={state} catalog={catalog} busy={busy} dispatch={dispatch} importData={importData} onError={setError} />}
    </main>
    {route.screen !== 'play' && <nav className="bottom-nav" aria-label="Главная навигация">{([{ key: 'map', label: 'Карта', icon: MapIcon }, { key: 'books', label: 'Книги', icon: BookOpen }, { key: 'daily', label: 'Задания', icon: Sun }] as const).map(item => <button key={item.key} className={route.screen === item.key ? 'active' : ''} aria-current={route.screen === item.key ? 'page' : undefined} onClick={() => go(item.key)}><item.icon size={23} /><span>{item.label}</span>{item.key === 'daily' && counts.completed > 0 && !state.runs[`daily:${day}`]?.completedAt && <i className="nav-dot" />}</button>)}</nav>}
  </div>;
}

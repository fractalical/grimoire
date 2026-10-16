import { useEffect, useRef } from 'react';
import { BookOpen, Check, LockKeyhole, Sparkles } from 'lucide-react';
import type { Catalog, GameState, Lesson, Run } from './types';
import { rewards, unlocked } from './domain';

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const POINTS = [{ x: 24, y: 360 }, { x: 49, y: 300 }, { x: 75, y: 240 }, { x: 52, y: 180 }, { x: 27, y: 120 }, { x: 52, y: 60 }];

function Terrain({ encounter = false }: { encounter?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    const h = encounter ? 226 : 430;
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#dce6bf'; ctx.fillRect(0, 0, 440, h);
    const poly = (points: number[][], color: string) => { ctx.fillStyle = color; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
    // An intentionally small, deterministic pixel field: only redraw on scene changes.
    for (let i = 0; i < 320; i++) { const x = (i * 71 + 13) % 440; const y = (i * 37 + 21) % h; ctx.fillStyle = ['#cbdca8', '#c3d69f', '#e7edcc'][i % 3]; ctx.fillRect(x, y, 3 + i % 5, 2); }
    poly([[354, 0], [401, 0], [440, h], [403, h], [381, h / 2]], '#b7ccab');
    poly([[367, 0], [393, 0], [440, h], [416, h], [391, h / 2]], '#86b8bb');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = '#c0d9cf'; ctx.fillRect(374 + i * 3, i * h / 20, 14, 2); }
    const points = encounter ? [{ x: 18, y: 190 }, { x: 52, y: 130 }, { x: 80, y: 75 }] : POINTS;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1]; const n = encounter ? 6 : 5;
      for (let j = 0; j <= n; j++) {
        const x = Math.round((a.x + (b.x - a.x) * j / n) * 4.4), y = Math.round(a.y + (b.y - a.y) * j / n);
        poly([[x - 17, y], [x, y - 9], [x + 17, y], [x, y + 12]], '#acaa86');
        poly([[x - 17, y - 3], [x, y - 12], [x + 17, y - 3], [x, y + 6]], '#eee6c8');
        ctx.fillStyle = '#f9f3db'; ctx.fillRect(x - 2, y - 8, 9, 2);
      }
    }
    const tree = (x: number, y: number, scale = 1) => {
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
      poly([[-15, 8], [6, 0], [26, 8], [5, 17]], '#bacb9d');
      ctx.fillStyle = '#725f42'; ctx.fillRect(-3, -8, 7, 22);
      poly([[-21, 0], [-16, -8], [-11, -8], [-18, -14], [-11, -23], [-6, -23], [-11, -27], [0, -47], [9, -31], [6, -26], [15, -20], [11, -16], [22, -3], [12, -3], [14, 1]], '#2e674f');
      poly([[-15, -3], [-11, -10], [-5, -10], [-12, -15], [-6, -24], [0, -41], [2, -18], [7, -10], [2, -10], [4, 0]], '#4f8962');
      ctx.fillStyle = '#76a26d'; ctx.fillRect(-7, -24, 5, 4); ctx.fillRect(-12, -11, 7, 3); ctx.restore();
    };
    const trees = encounter ? [[24, 62], [57, 83], [89, 44], [134, 49], [17, 132], [388, 185], [414, 147], [367, 219]] : [[22, 60], [55, 79], [84, 47], [328, 56], [345, 104], [370, 76], [14, 183], [42, 211], [60, 161], [358, 305], [395, 330], [339, 352], [29, 390], [56, 421], [301, 420]];
    trees.forEach(([x, y], i) => tree(x, y, 0.9 + i % 3 * 0.12));
    for (let i = 0; i < 32; i++) { const x = (i * 79 + 39) % 350, y = (i * 53 + 16) % h; ctx.fillStyle = i % 3 ? '#f4f0d5' : '#d9ac74'; ctx.fillRect(x, y, 3, 3); ctx.fillRect(x - 2, y + 2, 7, 2); }
  }, [encounter]);
  return <canvas ref={canvas} width={440} height={encounter ? 226 : 430} aria-hidden="true" className="terrain" />;
}

export function Mage({ form = 0, className = '' }: { form?: number; className?: string }) {
  return <img className={`character ${className}`} src={asset(`/assets/characters/${form > 0 ? 'mage-adept' : 'mage'}.png`)} alt={form > 0 ? 'Маг знаний в новом облике' : 'Маг-ученик'} draggable={false} />;
}
export function WorldMap({ catalog, state, lessons, selected, onSelect, walking }: { catalog: Catalog; state: GameState; lessons: Lesson[]; selected: string; onSelect: (id: string) => void; walking: boolean }) {
  const latest = rewards(state).completed;
  const heroIndex = walking ? Math.max(0, lessons.findIndex(l => l.id === selected)) : lessons.some(l => l.order === latest + 1) ? lessons.findIndex(l => l.order === latest + 1) : 0;
  const hero = POINTS[heroIndex];
  return <div className="world-map" aria-label="Аксонометрическая карта уровней">
    <Terrain />
    <span className="map-caption"><span className="tiny-star">✧</span> ЛЕС ПЕРВЫХ ЗНАНИЙ</span>
    {lessons.map((lesson, i) => {
      const point = POINTS[i]; const done = !!state.completed[lesson.id]; const open = unlocked(catalog, state, lesson.id);
      return <div key={lesson.id} className="map-node-wrap" style={{ left: `${point.x}%`, top: point.y }}>
        {(lesson.order % 3 === 0) && <span className="map-reward" title="Награда за прохождение">{lesson.order % 6 === 0 ? <Sparkles size={14} /> : <BookOpen size={14} />}</span>}
        <button aria-label={`Урок ${lesson.order}: ${lesson.title}${done ? ', пройден' : !open ? ', закрыт' : ', доступен'}`} aria-pressed={selected === lesson.id} onClick={() => onSelect(lesson.id)} className={`map-node ${done ? 'done' : open ? 'available' : 'locked'} ${selected === lesson.id ? 'selected' : ''}`}>
          {done ? <Check size={21} /> : <span>{lesson.order}</span>}
          {!open && !done && <LockKeyhole className="node-lock" size={10} />}
        </button>
        <span className="node-label">{lesson.order.toString().padStart(2, '0')}</span>
      </div>;
    })}
    {lessons.some(lesson => lesson.order === latest + 1) && <div className={`map-mage ${walking ? 'walking' : ''}`} style={{ left: `calc(${hero.x}% - 30px)`, top: hero.y - 80 }}><Mage form={rewards(state).form} /></div>}
  </div>;
}

const trailPoint = (step: number) => ({ x: 75 + step * 140, y: 157 - Math.sin(step * Math.PI / 2) * 32 });

export function EncounterScene({ run, form }: { run: Run; form: number }) {
  // Mode changes increment serial, but must not move the world. A saved answer
  // advances the hero; the following encounter advances the camera along the trail.
  const encounter = run.attempts - (run.feedback ? 1 : 0);
  const position = encounter + (run.feedback?.correct ? 1 : 0);
  const mage = trailPoint(position);
  const target = trailPoint(encounter + 1);
  const waiting = trailPoint(encounter + 2);
  const first = Math.max(0, encounter - 2);
  const steps = Array.from({ length: encounter + 5 - first }, (_, index) => first + index);
  const camera = encounter * 140;

  return <div className="encounter-scene" aria-label={`Тропа знаний: встреча ${encounter + 1}`}>
    <svg className="encounter-art" viewBox="0 0 440 226" aria-hidden="true">
      <rect width="440" height="226" fill="#dce6bf" />
      <g className="encounter-camera" style={{ transform: `translateX(${-camera}px)` }}>
        {steps.map(step => {
          const point = trailPoint(step);
          const next = trailPoint(step + 1);
          const treeX = point.x + 44;
          return <g key={step}>
            {Array.from({ length: 20 }, (_, i) => <rect key={`grass-${i}`} x={point.x - 65 + (i * 37 + step * 11) % 140} y={(i * 43 + step * 19) % 226} width={3 + i % 4} height="2" fill={['#c1d49e', '#eaf0d0', '#b9d098'][i % 3]} />)}
            <g transform={`translate(${treeX}, ${step % 2 ? 47 : 211})`}><ellipse cy="5" rx="22" ry="7" fill="#b9cca1" /><rect x="-3" y="-18" width="6" height="25" fill="#826d4b" /><path d="M0 -56 L-15 -31 L-9 -31 L-23 -8 L-12 -8 L-26 2 L23 2 L12 -12 L18 -12 L6 -32 L12 -32 Z" fill="#346f52" /><path d="M0 -50 L-10 -29 L-5 -29 L-16 -8 L-8 -8 L-18 0 L2 0 Z" fill="#70a16b" /></g>
            {Array.from({ length: 7 }, (_, i) => {
              const x = point.x + (next.x - point.x) * i / 7;
              const y = point.y + (next.y - point.y) * i / 7;
              return <g key={`stone-${i}`} transform={`translate(${x},${y})`}><path d="M-14 0 L0 -7 L14 0 L0 10 Z" fill="#acaa86" /><path d="M-14 -3 L0 -10 L14 -3 L0 4 Z" fill="#eee6c8" /></g>;
            })}
            <g transform={`translate(${point.x}, ${point.y + 20})`}><rect x="-12" y="-7" width="24" height="16" rx="4" fill="#f7edcf" stroke="#b4a27b" /><text textAnchor="middle" y="4" fontSize="10" fill="#77643e">{step + 1}</text></g>
          </g>;
        })}
        {run.defeated.length + 1 < run.taskIds.length && <image href={asset('/assets/characters/goblin.png')} x={waiting.x - 32} y={waiting.y - 61} width="64" height="64" className="trail-character waiting-goblin" />}
        <g style={{ transform: `translate(${target.x}px, ${target.y}px)` }}><image href={asset('/assets/characters/goblin.png')} x="-38" y="-72" width="76" height="76" className={`trail-character current-goblin ${run.feedback?.correct ? 'defeated' : ''}`} />{run.feedback?.correct && <text className="spell" x="-12" y="-55">✦</text>}</g>
        <g className="encounter-mage" data-position={position} style={{ transform: `translate(${mage.x}px, ${mage.y}px)` }}><g className={run.feedback?.correct ? 'mage-stride' : ''}><image href={asset(`/assets/characters/${form > 0 ? 'mage-adept' : 'mage'}.png`)} x="-40" y="-76" width="80" height="80" className="trail-character" /></g></g>
      </g>
    </svg>
    <span className="scene-tag"><span className="live-dot" /> {run.kind === 'daily' ? 'Тропа повторения' : 'Тропа знаний'} · {encounter + 1}</span>
    <span className="scene-step">{run.defeated.length} / {run.taskIds.length} слов</span>
  </div>;
}

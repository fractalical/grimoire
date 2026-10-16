import { initialState, validateSave } from './domain';
import type { GameState } from './types';

const DB = 'grimoire-v1';
let connection: Promise<IDBDatabase> | undefined;
function openDb() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => { connection = undefined; reject(new Error('Хранилище недоступно. Разреши сохранение данных для этого сайта.')); };
    request.onblocked = () => { connection = undefined; reject(new Error('Закрой другие вкладки игры и попробуй ещё раз.')); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = undefined; }; resolve(db); };
  });
  return connection;
}
export async function loadState(): Promise<GameState> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'); const store = tx.objectStore('state'); const request = store.get('profile');
    let value: GameState;
    request.onsuccess = () => { try { value = request.result ? validateSave(request.result) : initialState(); if (!request.result) store.put(value, 'profile'); } catch (e) { tx.abort(); reject(e); } };
    tx.oncomplete = () => resolve(value); tx.onerror = () => reject(new Error('Не удалось прочитать сохранение.')); tx.onabort = () => reject(new Error('Не удалось прочитать сохранение. Данные не сброшены.'));
  });
}
export async function commitState(next: GameState, expectedRevision: number): Promise<GameState> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'); const store = tx.objectStore('state'); const request = store.get('profile');
    let error = 'Не удалось сохранить. Попробуй ещё раз; ответ пока не зачтён.';
    request.onsuccess = () => {
      if (request.result?.revision !== expectedRevision) { error = 'Прогресс изменился в другой вкладке. Он обновлён — повтори действие.'; tx.abort(); return; }
      store.put(next, 'profile');
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(new Error(error)); tx.onabort = () => reject(new Error(error));
  });
}
export async function replaceState(value: unknown, expectedRevision: number): Promise<GameState> {
  const next = validateSave(value); next.revision = expectedRevision + 1; next.lastCommand = null; return commitState(next, expectedRevision);
}

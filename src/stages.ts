import type { Run } from './types';

export const STAGE_SIZE = 10;
export const stageCount = (run: Run) => run.kind === 'daily' ? 1 : Math.ceil(run.taskIds.length / STAGE_SIZE);
export const stageWords = (run: Run, index = run.stageIndex || 0) => run.kind === 'daily' ? run.taskIds : run.taskIds.slice(index * STAGE_SIZE, (index + 1) * STAGE_SIZE);

export function stageInfo(run: Run) {
  const ids = stageWords(run);
  const done = new Set(run.defeated);
  return { index: run.stageIndex || 0, total: stageCount(run), ids, completed: ids.filter(id => done.has(id)).length, size: ids.length };
}

export function firstUnfinishedStage(run: Run): number {
  const position = run.taskIds.findIndex(id => !run.defeated.includes(id));
  return position < 0 ? stageCount(run) - 1 : Math.floor(position / STAGE_SIZE);
}

/** Keep retry order inside each stage; future-stage words cannot bypass errors. */
export function pendingQueue(run: Run): string[] {
  const remaining = [...new Set([...run.queue, ...run.taskIds])].filter(id => !run.defeated.includes(id));
  return remaining.sort((a, b) => Math.floor(run.taskIds.indexOf(a) / STAGE_SIZE) - Math.floor(run.taskIds.indexOf(b) / STAGE_SIZE));
}

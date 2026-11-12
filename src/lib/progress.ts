export function isValidProgressPercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function calculateCompletion(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function canNestTask(parent: { parent_task_id: string | null }): boolean {
  return parent.parent_task_id === null;
}
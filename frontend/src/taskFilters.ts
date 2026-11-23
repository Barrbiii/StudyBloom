export type TaskFilter = 'all' | 'active' | 'completed';
export function filterTasks<T extends { title: string; completed: boolean; priority?: string }>(tasks: T[], search: string, status: TaskFilter, priority: string): T[] {
  const term = search.trim().toLocaleLowerCase('ru-RU');
  return tasks.filter(task => task.title.toLocaleLowerCase('ru-RU').includes(term)
    && (status === 'all' || task.completed === (status === 'completed'))
    && (!priority || (task.priority || 'normal') === priority));
}

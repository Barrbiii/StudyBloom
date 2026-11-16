// Календарные даты считаем в локальном времени: ISO UTC сдвигает день в некоторых зонах.
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}
export function calendarDays(anchor: Date, mode: 'month' | 'week'): Date[] {
  const start = startOfWeek(mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12) : anchor);
  const count = mode === 'week' ? 7 : Math.ceil((((new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + 6) % 7) + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}
export function moveAnchor(anchor: Date, mode: 'month' | 'week', direction: number): Date {
  return mode === 'week' ? addDays(anchor, direction * 7) : new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1, 12);
}

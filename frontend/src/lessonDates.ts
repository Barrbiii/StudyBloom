/** The template's weekday is Monday=0. Date keys deliberately avoid UTC conversion. */
export function occursOn(lesson: { weekday: number; starts_on: string; ends_on: string }, day: string): boolean {
  if (day < lesson.starts_on || day > lesson.ends_on) return false;
  const [year, month, date] = day.split('-').map(Number);
  return (new Date(year, month - 1, date, 12).getDay() + 6) % 7 === lesson.weekday;
}

import React from 'react';
import { CalendarEvent, EventEditor } from './EventEditor';
import { calendarDays, dateKey, moveAnchor, parseDate } from './calendarDates';

type Subject = { id: number; name: string; color: string };
type Deadline = { id: number; title: string; due_date: string; subject_id: number };
type Props = { subjects: Subject[]; deadlines: Deadline[]; onSaved: () => Promise<void> };
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function Calendar({ subjects, deadlines, onSaved }: Props) {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [eventEditor, setEventEditor] = React.useState<CalendarEvent | null | undefined>(undefined);
  const [eventError, setEventError] = React.useState('');
  async function loadEvents() {
    const response = await fetch('/api/events');
    if (!response.ok) throw Error('Не удалось загрузить события');
    setEvents(await response.json()); setEventError('');
  }
  React.useEffect(() => { void loadEvents().catch(() => setEventError('Не удалось загрузить события.')); }, []);
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [mode, setMode] = React.useState<'month' | 'week'>('month');
  const [filter, setFilter] = React.useState('');
  const [editing, setEditing] = React.useState<Deadline | null>(null);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const days = calendarDays(anchor, mode);
  const today = dateKey(new Date());
  const title = mode === 'month'
    ? anchor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    : `${days[0].toLocaleDateString('ru-RU')} — ${days[6].toLocaleDateString('ru-RU')}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/deadlines/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editing.title.trim(), due_date: editing.due_date, subject_id: editing.subject_id }),
      });
      if (!response.ok) throw new Error();
      await onSaved();
      setAnchor(parseDate(editing.due_date));
      setEditing(null);
    } catch { setError('Не удалось сохранить дедлайн. Проверь соединение и попробуй снова.'); }
    finally { setSaving(false); }
  }

  return <section className="panel calendar" aria-label="Календарь дедлайнов">
    {eventError && <p role="alert">{eventError} <button type="button" onClick={() => void loadEvents().catch(() => setEventError('Не удалось загрузить события.'))}>Повторить</button></p>}
    <button type="button" onClick={() => setEventEditor(null)}>Добавить событие</button>
    {eventEditor !== undefined && <EventEditor key={eventEditor?.id ?? "new"} event={eventEditor} onSaved={loadEvents} onClose={() => setEventEditor(undefined)} />}
    <div className="calendar-heading"><h2>Календарь 🌷</h2><div className="calendar-switch">
      <button type="button" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Месяц</button>
      <button type="button" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Неделя</button>
    </div></div>
    <div className="calendar-toolbar">
      <button type="button" aria-label="Предыдущий период" onClick={() => setAnchor(moveAnchor(anchor, mode, -1))}>←</button>
      <h3 aria-live="polite">{title}</h3>
      <button type="button" aria-label="Следующий период" onClick={() => setAnchor(moveAnchor(anchor, mode, 1))}>→</button>
      <button type="button" onClick={() => setAnchor(new Date())}>Сегодня</button>
      <select aria-label="Фильтр календаря по предмету" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="">Все предметы</option>
        {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
    </div>
    <p className="note">Выбери дедлайн, чтобы изменить название, предмет или дату.</p>
    <div className="calendar-scroll"><div className={`calendar-grid ${mode}`}>
      {weekdays.map(day => <div key={day} className="weekday">{day}</div>)}
      {days.map(day => {
        const key = dateKey(day);
        const items = deadlines.filter(item => item.due_date === key && (!filter || String(item.subject_id) === filter));
        return <div key={key} className={`calendar-day ${mode === 'month' && day.getMonth() !== anchor.getMonth() ? 'outside' : ''} ${key === today ? 'today' : ''}`}>
          <time dateTime={key} aria-current={key === today ? 'date' : undefined}>{day.getDate()}</time>
          {events.filter(event => dateKey(new Date(event.starts_at)) <= key && dateKey(new Date(new Date(event.ends_at).getTime() - 1)) >= key).map(event => <button type="button" className="calendar-deadline calendar-event" key={`event-${event.id}`} onClick={() => setEventEditor(event)}>
            {event.title}<small>{new Date(event.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {event.location}</small>
          </button>)}
          {items.map(item => <button key={item.id} type="button" className="calendar-deadline" onClick={() => { setEditing({ ...item }); setError(''); }} aria-label={`Изменить дедлайн: ${item.title}, ${key}`}>
            <span className="subject-dot" style={{ background: subjects.find(s => s.id === item.subject_id)?.color }} />
            {item.title}<small>{subjects.find(s => s.id === item.subject_id)?.name}</small>
          </button>)}
        </div>;
      })}
    </div></div>
    {!deadlines.some(item => days.some(day => dateKey(day) === item.due_date) && (!filter || String(item.subject_id) === filter)) && <p className="note">В этом периоде нет дедлайнов. События показаны отдельно.</p>}
    {editing && <div className="calendar-editor">
      <h3>Редактирование дедлайна</h3>
      <form onSubmit={save}>
        <label>Название<input autoFocus required maxLength={255} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
        <label>Дата<input type="date" required value={editing.due_date} onChange={e => setEditing({ ...editing, due_date: e.target.value })} /></label>
        <label>Предмет<select required value={editing.subject_id} onChange={e => setEditing({ ...editing, subject_id: Number(e.target.value) })}>
          {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select></label>
        <button disabled={saving || !editing.title.trim()} type="submit">{saving ? 'Сохраняем…' : 'Сохранить'}</button>
        <button disabled={saving} type="button" onClick={() => setEditing(null)}>Отмена</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>}
  </section>;
}

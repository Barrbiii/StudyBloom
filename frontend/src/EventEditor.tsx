import { apiFetch } from './api';
import React from 'react';
import { useEditorFocus } from './useEditorFocus';
export type CalendarEvent = { id: number; title: string; starts_at: string; ends_at: string; location: string };
const localTime = (value: string) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
export function EventEditor({ event, onSaved, onClose }: { event: CalendarEvent | null; onSaved: () => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = React.useState(event?.title || '');
  const [start, setStart] = React.useState(event ? localTime(event.starts_at) : '');
  const [end, setEnd] = React.useState(event ? localTime(event.ends_at) : '');
  const [location, setLocation] = React.useState(event?.location || '');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const editor = useEditorFocus(event?.id ?? 'new', onClose, busy);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || new Date(end) <= new Date(start)) { setError('Окончание должно быть позже начала.'); return; }
    await mutate(event ? 'PUT' : 'POST');
  }
  async function mutate(method: string) {
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`/api/events${event ? `/${event.id}` : ''}`, {
        method, headers: { 'Content-Type': 'application/json' },
        ...(method === 'DELETE' ? {} : { body: JSON.stringify({ title: title.trim(), starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), location }) }),
      });
      if (!response.ok) throw Error();
      await onSaved(); onClose();
    } catch { setError('Не удалось сохранить изменение. Попробуй снова.'); }
    finally { setBusy(false); }
  }
  return <section ref={editor.ref as React.Ref<HTMLElement>} onKeyDown={editor.onKeyDown} className="calendar-editor" aria-label="Редактор события" aria-busy={busy}>
    <h3>{event ? 'Изменить событие' : 'Новое событие'}</h3>
    <p className="note">Время указано в часовом поясе этого устройства.</p>
    <form onSubmit={save}>
      <label>Название события<input required maxLength={255} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Начало<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>Окончание<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label>
      <label>Место<input maxLength={255} value={location} onChange={e => setLocation(e.target.value)} /></label>
      <button disabled={busy} type="submit">Сохранить событие</button>
      <button disabled={busy} type="button" onClick={onClose}>Отмена</button>
      {event && <button disabled={busy} type="button" onClick={() => { if (window.confirm('Удалить это событие?')) void mutate('DELETE'); }}>Удалить событие</button>}
    </form>{error && <p role="alert">{error}</p>}
  </section>;
}

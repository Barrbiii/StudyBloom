import React from 'react';
import { apiFetch } from './api';
import { dateKey } from './calendarDates';
type Habit = { id: number; name: string; target: number; unit: string; archived: boolean; value: number; day_target: number; completed: boolean; current_streak: number; best_streak: number; completed_days: number };
type Draft = { id?: number; name: string; target: number; unit: string; archived: boolean };
type Day = { day: string; value: number; target: number; completed: boolean };
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
export function Habits() {
  const [day, setDay] = React.useState(dateKey(new Date()));
  const [items, setItems] = React.useState<Habit[]>([]);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [archived, setArchived] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState('');
  const [history, setHistory] = React.useState<{ name: string; rows: Day[] } | null>(null);
  const [values, setValues] = React.useState<Record<number, string>>({});
  const loadToken = React.useRef(0);
  async function load() {
    const token = ++loadToken.current;
    const r = await apiFetch(`/api/habits?day=${day}&tz=${encodeURIComponent(zone)}`);
    if (!r.ok) throw Error();
    const data: Habit[] = await r.json();
    if (token !== loadToken.current) return;
    setItems(data); setValues(Object.fromEntries(data.map(h => [h.id, String(h.value)]))); setReady(true);
  }
  React.useEffect(() => { setReady(false); setError(''); setHistory(null); void load().catch(() => setError('Не удалось загрузить привычки. Проверь дату и соединение.')); return () => { loadToken.current++; }; }, [day]);
  async function write(path: string, method: string, data: object) {
    const r = await apiFetch(`/api/habits${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw Error();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft || busy) return;
    setBusy(true); setError('');
    try { await write(draft.id ? `/${draft.id}` : '', draft.id ? 'PUT' : 'POST', draft); await load(); setDraft(null); }
    catch { setError('Не удалось сохранить привычку. Проверь название и цель.'); }
    finally { setBusy(false); }
  }
  async function mark(item: Habit, value: number) {
    if (busy) return;
    setBusy(true); setError('');
    try { await write(`/${item.id}/days/${day}?tz=${encodeURIComponent(zone)}`, 'PUT', { value }); await load(); setHistory(null); }
    catch { setError('Не удалось сохранить отметку. Будущие даты и архивные привычки недоступны.'); }
    finally { setBusy(false); }
  }
  async function archive(item: Habit) {
    if (busy || !window.confirm(item.archived ? 'Вернуть привычку из архива?' : 'Убрать привычку в архив? История сохранится.')) return;
    setBusy(true); setError('');
    try { await write(`/${item.id}`, 'PUT', { ...item, archived: !item.archived }); await load(); setHistory(null); }
    catch { setError('Не удалось изменить архив.'); }
    finally { setBusy(false); }
  }
  async function openHistory(item: Habit) {
    setError(''); setHistory(null);
    try { const r = await apiFetch(`/api/habits/${item.id}/history?days=30&tz=${encodeURIComponent(zone)}`); if (!r.ok) throw Error(); setHistory({ name: item.name, rows: await r.json() }); }
    catch { setError('Не удалось загрузить историю.'); }
  }
  return <section className="panel habits" id="habits" aria-label="Привычки и цели">
    <p className="card-kicker">РАСТИ ПО ЧУТЬ-ЧУТЬ</p><h2>Мои маленькие ритуалы</h2>
    <p className="note">Ежедневные цели · часовой пояс {zone}. Сегодня можно ещё продолжить вчерашнюю серию.</p>
    <div className="habit-toolbar"><label>День привычек<input type="date" required max={dateKey(new Date())} value={day} disabled={busy} onChange={e => { if (e.target.value) setDay(e.target.value); }} /></label>
      <button type="button" disabled={busy} onClick={() => setDraft({ name: '', target: 1, unit: 'раз', archived: false })}>Добавить привычку</button>
      <label className="archive-toggle"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />Показать архив</label>
    </div>
    {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => { setError(''); void load().catch(() => setError('Сервер недоступен.')); }}>Повторить загрузку привычек</button></p>}
    {draft && <form className="habit-form" onSubmit={save}>
      <label>Название привычки<input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Ежедневная цель<input type="number" required min={1} max={10000} step={1} value={draft.target} onChange={e => setDraft({ ...draft, target: Number(e.target.value) })} /></label>
      <label>Единица измерения<input required maxLength={24} value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} /></label>
      <button type="submit" disabled={busy}>Сохранить привычку</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>Отмена</button>
    </form>}
    {!ready && !error && <p role="status">Загружаем твои ритуалы…</p>}
    {ready && <div className="habit-grid">{items.filter(h => h.archived === archived).map(item => <article className={`habit-card ${item.completed ? 'is-done' : ''}`} key={item.id}>
      <h3>{item.name}</h3><p className="habit-goal">{item.value} / {item.day_target} {item.unit} {item.completed && <span aria-label="Цель выполнена">✓</span>}</p>
      <div className="habit-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, item.value / item.day_target * 100)}%` }} /></div>
      <p className="note">Серия сейчас: {item.current_streak} · лучшая: {item.best_streak} · успешных дней: {item.completed_days}</p>
      {!item.archived && <form className="habit-mark" onSubmit={e => { e.preventDefault(); void mark(item, Number(values[item.id])); }}>
        <label>Результат: {item.name}<input type="number" required min={0} max={100000} step={1} value={values[item.id] ?? ''} onChange={e => setValues({ ...values, [item.id]: e.target.value })} /></label><button type="submit" disabled={busy}>Сохранить результат</button>
        <button type="button" disabled={busy} onClick={() => void mark(item, item.completed ? 0 : item.day_target)}>{item.completed ? 'Снять отметку' : 'Выполнено'}</button>
      </form>}
      <div className="habit-actions"><button type="button" disabled={busy} onClick={() => setDraft(item)}>Изменить привычку</button><button type="button" disabled={busy} onClick={() => void archive(item)}>{item.archived ? 'Вернуть из архива' : 'В архив'}</button><button type="button" disabled={busy} onClick={() => void openHistory(item)}>История привычки</button></div>
    </article>)}</div>}
    {ready && !items.some(h => h.archived === archived) && <p className="note">{archived ? 'Архив пуст.' : 'Добавь первый ритуал — даже маленькая цель имеет значение.'}</p>}
    {history && <div className="habit-history" role="region" aria-label="История привычки"><h3>{history.name}: последние 30 дней</h3><button type="button" onClick={() => setHistory(null)}>Закрыть историю</button><ul>{history.rows.map(row => <li key={row.day}><time>{row.day}</time> · {row.value} / {row.target} {row.completed ? '✓' : '—'}</li>)}</ul>{!history.rows.length && <p className="note">Отметок за этот период нет.</p>}</div>}
  </section>;
}

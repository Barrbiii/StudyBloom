import React from 'react';
import { apiFetch } from './api';
type Item = { id: number; title: string; completed: boolean };
export function Subtasks({ taskId, title }: { taskId: number; title: string }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [ready, setReady] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [edit, setEdit] = React.useState<Item | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const base = `/api/tasks/${taskId}/subtasks`;
  async function load() { const r = await apiFetch(base); if (!r.ok) throw Error(); setItems(await r.json()); setReady(true); }
  React.useEffect(() => { if (open) void load().catch(() => setError('Не удалось загрузить шаги.')); }, [open]);
  async function write(method: string, suffix: string, data?: object) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await apiFetch(base+suffix, { method, headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
      if (!r.ok) throw Error();
      await load(); setDraft(''); setEdit(null);
    } catch { setError('Не удалось сохранить шаг. Проверь название и соединение.'); }
    finally { setBusy(false); }
  }
  return <div className="subtasks">
    <button type="button" className="subtask-toggle" aria-expanded={open} aria-label={`Шаги задачи: ${title}`} onClick={() => setOpen(!open)}>Шаги задачи {open ? '▴' : '▾'}{ready ? ` · ${items.filter(i => i.completed).length}/${items.length}` : ''}</button>
    {open && <div role="region" aria-label={`Чек-лист: ${title}`}>
      {error && <p role="alert">{error} <button type="button" onClick={() => { setError(''); void load().catch(() => setError('Сервер недоступен.')); }}>Повторить загрузку шагов</button></p>}
      {!ready && !error && <p role="status">Загружаем шаги…</p>}
      {items.map(item => <div className="subtask-row" key={item.id}>
        {edit?.id === item.id ? <form onSubmit={e => { e.preventDefault(); void write('PATCH', `/${item.id}`, { title: edit.title }); }}><input aria-label="Новое название шага" required maxLength={255} value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })}/><button disabled={busy || !edit.title.trim()} type="submit">Сохранить шаг</button><button disabled={busy} type="button" onClick={() => setEdit(null)}>Отмена</button></form> : <>
          <label><input type="checkbox" checked={item.completed} disabled={busy} onChange={() => void write('PATCH', `/${item.id}`, { completed: !item.completed })}/><span>{item.title}</span></label>
          <button type="button" disabled={busy} aria-label={`Переименовать шаг: ${item.title}`} onClick={() => setEdit(item)}>Изменить</button><button type="button" disabled={busy} aria-label={`Удалить шаг: ${item.title}`} onClick={() => { if (window.confirm('Удалить этот шаг?')) void write('DELETE', `/${item.id}`); }}>×</button>
        </>}
      </div>)}
      {ready && !items.length && <p className="note">Разбей задачу на маленькие шаги.</p>}
      <form className="subtask-add" onSubmit={e => { e.preventDefault(); void write('POST', '', { title: draft.trim() }); }}><input aria-label={`Новый шаг: ${title}`} required maxLength={255} placeholder="Следующий маленький шаг…" value={draft} onChange={e => setDraft(e.target.value)}/><button disabled={busy || !draft.trim()} type="submit">Добавить шаг</button></form>
      <p className="note">Шаги и галочка основной задачи независимы.</p>
    </div>}
  </div>;
}

import React from 'react';
import { apiFetch } from './api';
import { addDays, dateKey } from './calendarDates';
type Template = { id: number; title: string; priority: string; cadence: string; starts_on: string; ends_on: string | null; paused: boolean };
const names: Record<string,string> = { daily:'Каждый день', weekly:'Каждую неделю', monthly:'Каждый месяц' };
export function RecurringTasks({ onGenerated }: { onGenerated: () => Promise<void> }) {
  const [items,setItems]=React.useState<Template[]>([]);
  const [title,setTitle]=React.useState(''); const [cadence,setCadence]=React.useState('weekly');
  const [starts,setStarts]=React.useState(dateKey(new Date())); const [ends,setEnds]=React.useState('');
  const [priority,setPriority]=React.useState('normal'); const [from,setFrom]=React.useState(dateKey(new Date()));
  const [through,setThrough]=React.useState(dateKey(addDays(new Date(),6)));
  const [busy,setBusy]=React.useState(false); const [error,setError]=React.useState(''); const [notice,setNotice]=React.useState('');
  async function load() { const r=await apiFetch('/api/recurring-tasks'); if(!r.ok) throw Error(); setItems(await r.json()); }
  React.useEffect(()=>{void load().catch(()=>setError('Не удалось загрузить повторения.'));},[]);
  async function write(path: string, method: string, data: object) {
    const r=await apiFetch('/api/recurring-tasks'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!r.ok) throw Error(); return r.json();
  }
  async function create(e: React.FormEvent) {
    e.preventDefault(); if(busy) return; setBusy(true);setError('');setNotice('');
    try { await write('','POST',{title:title.trim(),cadence,starts_on:starts,ends_on:ends||null,priority}); await load();setTitle(''); }
    catch {setError('Не удалось создать шаблон. Проверь название и даты.');} finally {setBusy(false);}
  }
  async function generate(item: Template) {
    if(busy) return; setBusy(true);setError('');setNotice('');
    try {const result=await write(`/${item.id}/generate`,'POST',{from_day:from,through});await onGenerated();setNotice(`Создано задач: ${result.created}. Уже создавались: ${result.already_generated}.`);}
    catch {setError('Не удалось создать задачи. Выбери период от1 до93 дней и активный шаблон.');}finally{setBusy(false);}
  }
  async function pause(item: Template) {
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await write(`/${item.id}`,'PATCH',{paused:!item.paused});await load();}catch{setError('Не удалось изменить паузу.');}finally{setBusy(false);}
  }
  return <section id="recurring" className="panel recurring" aria-label="Повторяющиеся задачи"><p className="card-kicker">СПОКОЙНЫЙ УЧЕБНЫЙ РИТМ</p><h2>Повторять — значит расти</h2>
    <p className="note">Создай шаблон, затем явно добавь задачи на выбранные даты. Фонового создания нет. Дата повторения появится в названии задачи.</p>
    {error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>{setError('');void load().catch(()=>setError('Сервер недоступен.'));}}>Повторить загрузку повторений</button></p>}
    {notice&&<p role="status">{notice}</p>}
    <form className="repeat-form" onSubmit={create}>
      <label>Название повторения<input required maxLength={230} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Периодичность<select aria-label="Периодичность" value={cadence} onChange={e=>setCadence(e.target.value)}>{Object.entries(names).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label>
      <label>Повторять с<input required type="date" value={starts} onChange={e=>setStarts(e.target.value)}/></label>
      <label>Повторять по<input type="date" value={ends} min={starts} onChange={e=>setEnds(e.target.value)}/></label>
      <label>Приоритет повторения<select aria-label="Приоритет повторения" value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Низкий</option><option value="normal">Обычный</option><option value="high">Высокий</option></select></label>
      <button disabled={busy||!title.trim()} type="submit">Создать шаблон</button>
    </form>
    <div className="repeat-window"><label>Создать начиная с<input required type="date" value={from} disabled={busy} onChange={e=>setFrom(e.target.value)}/></label><label>Создать до<input required type="date" value={through} min={from} disabled={busy} onChange={e=>setThrough(e.target.value)}/></label><small>До93 дней за раз. Повторный запрос не создаёт копий, даже если прежнюю задачу удалили.</small></div>
    <div className="repeat-list">{items.map(item=><article key={item.id}><h3>{item.title}</h3><p>{names[item.cadence]} · с{item.starts_on}{item.ends_on?` по${item.ends_on}`:''} · {item.paused?'на паузе':'активно'}</p><button type="button" disabled={busy||item.paused||!from||!through} onClick={()=>void generate(item)}>Создать задачи за период</button><button type="button" disabled={busy} onClick={()=>void pause(item)}>{item.paused?'Возобновить повторение':'Приостановить повторение'}</button></article>)}</div>
    <p className="note">Пауза сохраняет уже созданные задачи. Для другого правила создай новый шаблон, прежний поставь на паузу.</p>
  </section>;
}

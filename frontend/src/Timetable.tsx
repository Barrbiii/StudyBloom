import React from 'react';
import { useEditorFocus } from './useEditorFocus';
import { useLessons } from './Lessons';
import { apiFetch } from './api';
import { dateKey, addDays } from './calendarDates';
type Subject = { id: number; name: string };
const days = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const fields = [['starts_at','Начало занятия','time'],['ends_at','Конец занятия','time'],['starts_on','С даты','date'],['ends_on','По дату','date'],['room','Аудитория','text'],['teacher','Преподаватель','text']] as const;
export function Timetable({ subjects }: { subjects: Subject[] }) {
  const { lessons, draft, setDraft, load, loadError } = useLessons();
  const [error,setError] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  const editor = useEditorFocus(draft ? draft.id ?? 'new' : null, () => setDraft(null), busy);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if(!draft || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/api/lessons${draft.id ? `/${draft.id}` : ''}`, { method: draft.id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(draft) });
      if(!r.ok) throw Error();
      await load(); setDraft(null);
    } catch { setError('Не удалось сохранить. Проверь время, предмет и диапазон дат.'); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if(!window.confirm('Удалить это занятие из расписания?')) return;
    setBusy(true);
    try { const r = await apiFetch(`/api/lessons/${id}`,{method:'DELETE'}); if(!r.ok) throw Error(); await load(); }
    catch { setError('Не удалось удалить занятие.'); }
    finally { setBusy(false); }
  }
  return <section className="panel timetable" id="timetable" aria-label="Расписание занятий"><p className="card-kicker">ТВОЙ УЧЕБНЫЙ РИТМ</p><h2>Расписание занятий</h2>
    <p className="note">Повторяется еженедельно в указанном периоде. Время местное.</p>
    <button type="button" disabled={!subjects.length || busy} onClick={() => setDraft({ subject_id:subjects[0].id, weekday:0, starts_at:'09:00', ends_at:'10:30', starts_on:dateKey(new Date()), ends_on:dateKey(addDays(new Date(),90)), room:'', teacher:'' })}>Добавить занятие</button>
    {!subjects.length && <p className="note">Сначала добавь предмет.</p>}
    {(error || loadError) && <p role="alert">{error || loadError} <button type="button" onClick={() => void load().catch(() => setError('Сервер недоступен.'))}>Повторить</button></p>}
    {draft && <form ref={editor.ref as React.Ref<HTMLFormElement>} onKeyDown={editor.onKeyDown} className="lesson-form" aria-label="Редактор занятия" aria-busy={busy} onSubmit={save}>
      <label>Предмет занятия<select aria-label="Предмет занятия" required value={draft.subject_id} onChange={e=>setDraft({...draft,subject_id:Number(e.target.value)})}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>День недели<select aria-label="День недели" value={draft.weekday} onChange={e=>setDraft({...draft,weekday:Number(e.target.value)})}>{days.map((day,i)=><option key={day} value={i}>{day}</option>)}</select></label>
      {fields.map(([key,label,type])=><label key={key}>{label}<input type={type} required={type!=='text'} maxLength={type==='text'?120:undefined} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
      <button disabled={busy} type="submit">Сохранить занятие</button><button disabled={busy} type="button" onClick={()=>setDraft(null)}>Отмена</button>
    </form>}
    <div className="lesson-grid">{days.map((day,i)=><div className="lesson-day" key={day}><h3>{day}</h3>{lessons.filter(l=>l.weekday===i).map(l=><article className="lesson-card" key={l.id}><strong>{subjects.find(s=>s.id===l.subject_id)?.name || 'Предмет'}</strong><p>{l.starts_at.slice(0,5)} — {l.ends_at.slice(0,5)}</p><p>{l.room} {l.teacher}</p><small>{l.starts_on} — {l.ends_on}</small><div><button disabled={busy} type="button" onClick={()=>setDraft(l)}>Изменить занятие</button><button disabled={busy} type="button" onClick={()=>void remove(l.id!)}>Удалить занятие</button></div></article>)}{!lessons.some(l=>l.weekday===i)&&<p className="note">Нет занятий</p>}</div>)}</div>
  </section>;
}

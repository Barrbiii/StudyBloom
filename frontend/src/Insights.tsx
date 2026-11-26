import React from 'react';
import { focusCsv } from './focusCsv';
import { apiFetch } from './api';
import { addDays, dateKey, parseDate } from './calendarDates';
type Overview = {
  day: string; timezone: string; tasks: { total: number; completed: number }; overdue_deadlines: number;
  upcoming_deadlines: { id: number; title: string; due_date: string }[];
  lessons_today: { id: number; subject: string; starts_at: string; ends_at: string; room: string; teacher: string }[];
  habits_today: { total: number; completed: number };
  focus_period?: { from_day: string; through: string; days: number };
  focus_week: { day: string; seconds: number; sessions: number }[];
};
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
export function Insights() {
  const [draftFrom,setDraftFrom] = React.useState(dateKey(addDays(new Date(),-6)));
  const [draftThrough,setDraftThrough] = React.useState(dateKey(new Date()));
  const [period,setPeriod] = React.useState<{from: string;through: string} | null>(null);
  const [data, setData] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(true);
  const token = React.useRef(0);
  async function load() {
    const request = ++token.current; setBusy(true);
    try {
      const r = await apiFetch(`/api/dashboard?tz=${encodeURIComponent(zone)}${period ? `&from_day=${period.from}&through=${period.through}` : ''}`);
      if (!r.ok) throw Error();
      const value: Overview = await r.json();
      if (!value?.tasks || !Array.isArray(value.focus_week)) throw Error();
      if (request === token.current) { setData(value); setError(''); }
    } catch { if (request === token.current) { setData(null); setError('Не удалось загрузить обзор. Повтори запрос.'); } }
    finally { if (request === token.current) setBusy(false); }
  }
  React.useEffect(() => {
    void load();
    let pending = 0;
    const changed = () => { window.clearTimeout(pending); pending = window.setTimeout(() => void load(), 100); };
    const visible = () => { if (!document.hidden) changed(); };
    window.addEventListener('studybloom:data-changed', changed);
    document.addEventListener('visibilitychange', visible);
    return () => { token.current++; window.clearTimeout(pending); window.removeEventListener('studybloom:data-changed', changed); document.removeEventListener('visibilitychange', visible); };
  }, [period]);
  function exportFocus() {
    if (!data?.focus_week.length) return;
    const blob = new Blob([focusCsv(data.focus_week,data.timezone)],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href=url;link.download=`studybloom-focus-${data.focus_week[0].day}-${data.focus_week[data.focus_week.length-1].day}.csv`;
    document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const max = Math.max(60, ...(data?.focus_week.map(row => row.seconds) || []));
  const minutes = data?.focus_week.reduce((sum, row) => sum + row.seconds / 60, 0) || 0;
  return <section id="analytics" className="panel insights" aria-label="Обзор и аналитика">
    <div className="panel-heading"><div><p className="card-kicker">ТВОЙ РИТМ, ТВОЙ ПРОГРЕСС</p><h2>Учебная неделя</h2></div><button type="button" disabled={busy} onClick={() => void load()}>Обновить обзор</button></div>
    <form className="analytics-period" onSubmit={e=>{e.preventDefault();setData(null);setPeriod({from:draftFrom,through:draftThrough});}}>
      <label>Аналитика с<input type="date" required min="1970-01-01" max={draftThrough} value={draftFrom} onChange={e=>setDraftFrom(e.target.value)}/></label>
      <label>Аналитика по<input type="date" required min={draftFrom} max={dateKey(new Date())} value={draftThrough} onChange={e=>setDraftThrough(e.target.value)}/></label>
      <button type="submit" disabled={busy}>Применить период</button>
      {[7,30,90].map(n=><button key={n} type="button" disabled={busy} onClick={()=>{const through=dateKey(new Date()), from=dateKey(addDays(new Date(),1-n));setDraftFrom(from);setDraftThrough(through);setData(null);setPeriod({from,through});}}>За {n} дней</button>)}
    </form>
    <p className="note">Период меняет только историю концентрации. Обзор задач и занятий остаётся на сегодня.</p>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Обновляем обзор…</p>}
    {data && <>
      <p className="note">На {parseDate(data.day).toLocaleDateString('ru-RU')} · {data.timezone}. Обновляется после сохранения данных.</p>
      <div className="insight-stats"><div><strong>{data.tasks.completed} / {data.tasks.total}</strong><span>задач выполнено за всё время</span></div><div><strong>{data.habits_today.completed} / {data.habits_today.total}</strong><span>привычек выполнено сегодня</span></div><div><strong>{data.overdue_deadlines}</strong><span>дедлайнов с прошедшей датой</span></div></div>
      <div className="insight-columns"><div><h3>Занятия сегодня</h3>{!data.lessons_today.length && <p className="note">Сегодня занятий нет.</p>}<ul className="agenda-list">{data.lessons_today.map(l => <li key={l.id}><time>{l.starts_at.slice(0,5)}–{l.ends_at.slice(0,5)}</time><strong>{l.subject}</strong><small>{l.room} {l.teacher}</small></li>)}</ul><a href="#timetable">Открыть расписание ↗</a></div>
      <div><h3>Ближайшие дедлайны</h3>{!data.upcoming_deadlines.length && <p className="note">Нет предстоящих дедлайнов.</p>}<ul className="agenda-list">{data.upcoming_deadlines.map(d => <li key={d.id}><time>{parseDate(d.due_date).toLocaleDateString('ru-RU')}</time><strong>{d.title}</strong></li>)}</ul><a href="#calendar">Открыть календарь ↗</a></div></div>
      <button type="button" disabled={busy||!data.focus_week.length} onClick={exportFocus}>Экспорт периода в CSV</button>
      <figure className="focus-chart"><figcaption><h3>Концентрация за период</h3><p>{minutes} минут завершённой концентрации</p></figcaption>
        <p className="note">{data.focus_week[0]?.day} — {data.focus_week[data.focus_week.length-1]?.day}</p>
        <div className="chart-scroll"><div style={{gridTemplateColumns:`repeat(${data.focus_week.length}, minmax(42px, 1fr))`}} className="chart-bars" role="img" aria-label={`Концентрация по дням, всего ${minutes} минут. Точные значения в таблице ниже.`}>{data.focus_week.map(row => <div className="chart-day" key={row.day}><span className="chart-number">{row.seconds / 60}</span><div className="chart-track"><span style={{ height: `${row.seconds / max * 100}%` }} /></div><time dateTime={row.day}>{parseDate(row.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</time></div>)}</div></div>
        <details><summary>Точные значения графика</summary><div className="chart-table"><table><thead><tr><th>Дата</th><th>Минуты</th><th>Сессии</th></tr></thead><tbody>{data.focus_week.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.seconds / 60}</td><td>{row.sessions}</td></tr>)}</tbody></table></div></details>
        <p className="note">Включены все календарные дни выбранного периода. Дата относится к завершению сессии. Перерывы и отменённые сессии исключены.</p>
      </figure>
    </>}
  </section>;
}

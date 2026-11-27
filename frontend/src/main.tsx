import { apiFetch } from './api';
import React from 'react';
import { filterTasks, TaskFilter } from './taskFilters';
import { PersonalExport } from './PersonalExport';
import { RecurringTasks } from './RecurringTasks';
import { Subtasks } from './Subtasks';
import { LessonsProvider } from './Lessons';
import { Insights } from './Insights';
import { Habits } from './Habits';
import { Pomodoro } from './Pomodoro';
import { Timetable } from './Timetable';
import { AuthGate } from './AuthGate';
import { createRoot } from 'react-dom/client';
import './style.css';
import { Calendar } from './Calendar';
import { BloomMark, FlowerSprig } from './Decorations';
import { dateKey, parseDate } from './calendarDates';

type Task = { id: number; title: string; completed: boolean; priority?: string };
type Subject = { id: number; name: string; color: string };
type Deadline = { id: number; title: string; due_date: string; subject_id: number };
const API = '/api/tasks';

function App() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<TaskFilter>('all');
  const [priorityFilter, setPriorityFilter] = React.useState('');
  const [newPriority, setNewPriority] = React.useState('normal');
  const [draft, setDraft] = React.useState('');
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [deadlines, setDeadlines] = React.useState<Deadline[]>([]);
  const [subjectDraft, setSubjectDraft] = React.useState('');
  const [deadlineDraft, setDeadlineDraft] = React.useState('');
  const [deadlineDate, setDeadlineDate] = React.useState('');
  const [selectedSubject, setSelectedSubject] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  async function loadTasks() {
    try {
      const response = await apiFetch(API);
      if (!response.ok) throw new Error('Не удалось загрузить задачи');
      setTasks(await response.json());
      setError('');
    } catch {
      setError('Не удалось подключиться к серверу задач.');
    } finally {
      setLoading(false);
    }
  }

  async function loadStudy() {
    try {
      const [subjectsResponse, deadlinesResponse] = await Promise.all([
        apiFetch('/api/subjects'), apiFetch('/api/deadlines'),
      ]);
      if (!subjectsResponse.ok || !deadlinesResponse.ok) throw new Error();
      const nextSubjects: Subject[] = await subjectsResponse.json();
      setSubjects(nextSubjects);
      setDeadlines(await deadlinesResponse.json());
      setSelectedSubject(current => current || String(nextSubjects[0]?.id || ''));
    } catch {
      setError('Не удалось загрузить предметы и дедлайны.');
    }
  }

  React.useEffect(() => { void loadTasks(); void loadStudy(); }, []);

  async function addSubject(event: React.FormEvent) {
    event.preventDefault();
    if (!subjectDraft.trim()) return;
    try {
      const response = await apiFetch('/api/subjects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subjectDraft.trim() }),
      });
      if (!response.ok) throw new Error();
      setSubjectDraft('');
      await loadStudy();
    } catch { setError('Не удалось добавить предмет.'); }
  }

  async function addDeadline(event: React.FormEvent) {
    event.preventDefault();
    if (!deadlineDraft.trim() || !deadlineDate || !selectedSubject) return;
    try {
      const response = await apiFetch('/api/deadlines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: deadlineDraft.trim(), due_date: deadlineDate,
          subject_id: Number(selectedSubject),
        }),
      });
      if (!response.ok) throw new Error();
      setDeadlineDraft('');
      setDeadlineDate('');
      await loadStudy();
    } catch { setError('Не удалось добавить дедлайн.'); }
  }

  async function deleteDeadline(id: number) {
    try {
      const response = await apiFetch(`/api/deadlines/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await loadStudy();
    } catch { setError('Не удалось удалить дедлайн.'); }
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    try {
      const response = await apiFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority: newPriority }),
      });
      if (!response.ok) throw new Error();
      setDraft('');
      await loadTasks();
    } catch {
      setError('Не удалось добавить задачу.');
    }
  }

  async function toggleTask(task: Task) {
    try {
      const response = await apiFetch(`${API}/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!response.ok) throw new Error();
      await loadTasks();
    } catch {
      setError('Не удалось изменить задачу.');
    }
  }

  async function removeTask(task: Task) {
    try {
      const response = await apiFetch(`${API}/${task.id}`, { method: 'DELETE' });
      if (response.status === 409) { setError('Сначала удали шаги задачи: чек-лист сохранён.'); return; }
      if (!response.ok) throw new Error();
      await loadTasks();
    } catch {
      setError('Не удалось удалить задачу.');
    }
  }

  async function changePriority(task: Task, priority: string) {
    try {
      const response = await apiFetch(`${API}/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }) });
      if (!response.ok) throw Error();
      await loadTasks();
    } catch { setError('Не удалось изменить приоритет.'); }
  }
  const visibleTasks = filterTasks(tasks, search, statusFilter, priorityFilter);
  function exportTasks() {
    const blob = new Blob([JSON.stringify(visibleTasks.map(({ id, title, completed, priority }) => ({ id, title, completed, priority: priority || 'normal' })), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `studybloom-tasks-${dateKey(new Date())}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const completed = tasks.filter(task => task.completed).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const today = dateKey(new Date());
  const upcoming = deadlines.filter(deadline => deadline.due_date >= today);
  const nearest = upcoming[0];

  return <div className="app-shell">
    <a className="skip-link" href="#overview">Перейти к содержимому</a>
    <aside className="sidebar" aria-label="StudyBloom">
      <a href="#overview" className="brand"><BloomMark /><span>StudyBloom<small>место для твоего роста</small></span></a>
      <p className="nav-caption">ТВОЙ ЕЖЕДНЕВНИК</p>
      <nav aria-label="Основная навигация">
        <a href="#overview"><span aria-hidden="true">⌂</span>Обзор</a>
        <a href="#tasks"><span aria-hidden="true">✓</span>Мои задачи</a>
        <a href="#analytics"><span aria-hidden="true">▥</span>Аналитика</a>
        <a href="#recurring"><span aria-hidden="true">↻</span>Повторения</a>
        <a href="#habits"><span aria-hidden="true">❀</span>Привычки</a>
        <a href="#pomodoro"><span aria-hidden="true">◴</span>Pomodoro</a>
        <a href="#timetable"><span aria-hidden="true">▤</span>Расписание</a>
        <a href="#calendar"><span aria-hidden="true">▦</span>Календарь</a>
        <a href="#subjects"><span aria-hidden="true">♧</span>Предметы</a>
        <a href="#deadlines"><span aria-hidden="true">◷</span>Дедлайны</a>
      </nav>
      <div className="sidebar-note"><FlowerSprig /><p>Расцветай<br /><em>в своём темпе.</em></p><span>один маленький шаг за раз</span></div>
      <small className="sidebar-footer">С заботой о твоих планах ♡</small>
    </aside>
    <main id="overview">
      <header className="page-header"><span className="eyebrow">ПЛАНИРУЙ · УЧИСЬ · РАСЦВЕТАЙ</span><time dateTime={today}>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}</time></header>
      <section className="hero">
        <div><p className="eyebrow">ТВОЯ НОВАЯ СТРАНИЦА</p><h1>Большие мечты.<br /><em>Маленькие шаги.</em></h1><p className="hero-description">Освободи место для важного. Собери задачи и учебные планы<br className="desktop-break" /> в одном уютном месте — и двигайся в своём ритме.</p><a className="primary-link" href="#tasks">Запланировать день <span aria-hidden="true">↗</span></a></div>
        <div className="hero-art" aria-hidden="true"><span className="art-caption">a little progress, every day</span><FlowerSprig /><span className="art-star">✧</span><span className="art-heart">♡</span></div>
      </section>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <section className="overview-grid" aria-label="Обзор планов">
        <article className="overview-card"><span className="card-kicker">МАЛЕНЬКИЕ ПОБЕДЫ</span><div className="stat-value">{loading ? '…' : `${completed} / ${tasks.length}`}<span>задач выполнено</span></div><div className="progress-track" role="progressbar" aria-label="Выполненные задачи" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><p>{tasks.length ? 'Каждая галочка — ещё один шаг вперёд.' : 'Всё начинается с первой маленькой задачи.'}</p></article>
        <article className="overview-card next-deadline"><span className="card-kicker">НА ГОРИЗОНТЕ</span><h2>{nearest?.title || 'Место для новых планов'}</h2><p>{nearest ? `${subjects.find(subject => subject.id === nearest.subject_id)?.name || 'Предмет'} · ${parseDate(nearest.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}` : 'Добавь дедлайн — мы сохраним его в календаре.'}</p><a href="#deadlines">{nearest ? 'Открыть дедлайны' : 'Добавить дедлайн'} <span aria-hidden="true">↗</span></a></article>
      </section>
      <Insights />
      <div className="planner-grid">
    <section className="panel tasks-panel" id="tasks">
      <div className="panel-heading"><div><p className="card-kicker">ШАГ ЗА ШАГОМ</p><h2>Мои задачи</h2></div><span className="count-badge">{tasks.length}</span></div>
      <div className="task-filters">
        <input type="search" aria-label="Поиск задач" placeholder="Найти задачу…" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Статус задач" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskFilter)}><option value="all">Все задачи</option><option value="active">Активные</option><option value="completed">Выполненные</option></select>
        <select aria-label="Фильтр приоритета" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">Любой приоритет</option><option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option></select>
        <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter(''); }}>Сбросить фильтры</button>
      </div>
      <p className="note">Показано {visibleTasks.length} из {tasks.length}</p>
      <button type="button" disabled={!visibleTasks.length} onClick={exportTasks}>Экспорт показанных задач</button>
      <form onSubmit={addTask}>
        <input aria-label="Название задачи" placeholder="Добавить задачу..." value={draft} onChange={e => setDraft(e.target.value)} />
        <select aria-label="Приоритет новой задачи" value={newPriority} onChange={e => setNewPriority(e.target.value)}><option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option></select>
        <button type="submit">Добавить +</button>
      </form>
      {loading && <p className="note">Загружаем задачи...</p>}
      {!loading && tasks.length === 0 && <p className="note">Пока нет задач. Добавь первую 🌸</p>}
      {!loading && tasks.length > 0 && visibleTasks.length === 0 && <p className="note">Нет задач по выбранным условиям.</p>}
      {visibleTasks.map(task => <div key={task.id} className={task.completed ? 'task done' : 'task'}>
        <label>
          <input type="checkbox" checked={task.completed} onChange={() => void toggleTask(task)} />
          <span>{task.title}</span>
        </label>
        <select aria-label={`Приоритет: ${task.title}`} value={task.priority || 'normal'} onChange={e => void changePriority(task, e.target.value)}><option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option></select>
        <button type="button" className="delete-task" aria-label={`Удалить: ${task.title}`} onClick={() => void removeTask(task)}>×</button>
        <Subtasks taskId={task.id} title={task.title} />
      </div>)}
      <p className="panel-footnote">Не обязательно успеть всё. Начни с самого важного.</p>
    </section>
    <section className="panel subjects-panel" id="subjects">
      <p className="card-kicker">ТВОЙ УЧЕБНЫЙ МИР</p><h2>Мои предметы</h2>
      <form onSubmit={addSubject}>
        <input aria-label="Название предмета" placeholder="Например, математика" value={subjectDraft} onChange={e => setSubjectDraft(e.target.value)} />
        <button type="submit">Добавить предмет</button>
      </form>
      <div className="subject-list">
        {subjects.map(subject => <span className="subject-chip" key={subject.id}>
          <span className="subject-dot" style={{ background: subject.color }} />{subject.name}
        </span>)}
      </div>
      {subjects.length === 0 && <p className="note">Добавь предмет, чтобы назначать дедлайны.</p>}
    </section>
    <section className="panel deadlines-panel" id="deadlines">
      <p className="card-kicker">ВСЕМУ СВОЁ ВРЕМЯ</p><h2>Дедлайны</h2>
      <form onSubmit={addDeadline} className="deadline-form">
        <input aria-label="Название дедлайна" placeholder="Что нужно сдать?" value={deadlineDraft} onChange={e => setDeadlineDraft(e.target.value)} />
        <input aria-label="Дата дедлайна" type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} required />
        <select aria-label="Предмет" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} required>
          <option value="">Выбери предмет</option>
          {subjects.map(subject => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
        </select>
        <button type="submit" disabled={subjects.length === 0}>Добавить</button>
      </form>
      {deadlines.map(deadline => <div className="deadline-row" key={deadline.id}>
        <span><strong>{deadline.title}</strong><small>{subjects.find(s => s.id === deadline.subject_id)?.name || 'Предмет удалён'} · {parseDate(deadline.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</small></span>
        <button type="button" className="delete-task" aria-label={`Удалить дедлайн: ${deadline.title}`} onClick={() => void deleteDeadline(deadline.id)}>×</button>
      </div>)}
      {deadlines.length === 0 && <p className="note">Пока нет дедлайнов. Можно выдохнуть 🌷</p>}
    </section>
    </div>
    <RecurringTasks onGenerated={loadTasks} />
    <Habits />
    <Pomodoro />
      <Timetable subjects={subjects} />
    <div id="calendar"><Calendar subjects={subjects} deadlines={deadlines} onSaved={loadStudy} /></div>
    <PersonalExport />
    <footer><BloomMark /><span>Пусть твои планы расцветают.</span><small>StudyBloom · твой уютный ежедневник</small></footer>
  </main></div>;
}

createRoot(document.getElementById('root')!).render(<AuthGate><LessonsProvider><App /></LessonsProvider></AuthGate>);

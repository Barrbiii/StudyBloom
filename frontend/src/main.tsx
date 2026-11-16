import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Task = { id: number; title: string; completed: boolean };
type Subject = { id: number; name: string; color: string };
type Deadline = { id: number; title: string; due_date: string; subject_id: number };
const API = '/api/tasks';

function App() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
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
      const response = await fetch(API);
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
        fetch('/api/subjects'), fetch('/api/deadlines'),
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
      const response = await fetch('/api/subjects', {
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
      const response = await fetch('/api/deadlines', {
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
      const response = await fetch(`/api/deadlines/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await loadStudy();
    } catch { setError('Не удалось удалить дедлайн.'); }
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
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
      const response = await fetch(`${API}/${task.id}`, {
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
      const response = await fetch(`${API}/${task.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await loadTasks();
    } catch {
      setError('Не удалось удалить задачу.');
    }
  }

  return <main>
    <header><span>✿ StudyBloom</span><small>your little space to grow ♡</small></header>
    <section className="hero">
      <p>SMALL STEPS, BIG DREAMS ✨</p>
      <h1>Привет, солнышко! 🌷</h1>
      <p>Каждый маленький шаг приближает тебя к мечте.</p>
    </section>
    <section className="panel">
      <h2>Мои задачи ♡</h2>
      <form onSubmit={addTask}>
        <input aria-label="Название задачи" placeholder="Добавить задачу..." value={draft} onChange={e => setDraft(e.target.value)} />
        <button type="submit">Добавить +</button>
      </form>
      {error && <p role="alert" className="note">{error}</p>}
      {loading && <p className="note">Загружаем задачи...</p>}
      {!loading && tasks.length === 0 && <p className="note">Пока нет задач. Добавь первую 🌸</p>}
      {tasks.map(task => <div key={task.id} className={task.completed ? 'task done' : 'task'}>
        <label>
          <input type="checkbox" checked={task.completed} onChange={() => void toggleTask(task)} />
          <span>{task.title}</span>
        </label>
        <button type="button" className="delete-task" aria-label={`Удалить: ${task.title}`} onClick={() => void removeTask(task)}>×</button>
      </div>)}
      <p className="note">Задачи сохраняются в PostgreSQL.</p>
    </section>
    <section className="panel">
      <h2>Мои предметы 📚</h2>
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
    <section className="panel">
      <h2>Ближайшие дедлайны 🗓️</h2>
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
        <span><strong>{deadline.title}</strong><small>{subjects.find(s => s.id === deadline.subject_id)?.name || 'Предмет удалён'} · {deadline.due_date}</small></span>
        <button type="button" className="delete-task" aria-label={`Удалить дедлайн: ${deadline.title}`} onClick={() => void deleteDeadline(deadline.id)}>×</button>
      </div>)}
      {deadlines.length === 0 && <p className="note">Пока нет дедлайнов. Можно выдохнуть 🌷</p>}
    </section>
    <footer>Bloom at your own pace ✿</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);

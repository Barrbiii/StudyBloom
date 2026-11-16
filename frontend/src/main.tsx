import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Task = { id: number; title: string; completed: boolean };
const API = '/api/tasks';

function App() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [draft, setDraft] = React.useState('');
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

  React.useEffect(() => { void loadTasks(); }, []);

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
    <footer>Bloom at your own pace ✿</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);

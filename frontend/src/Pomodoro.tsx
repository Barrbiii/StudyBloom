import React from 'react';
import { apiFetch } from './api';
import { clockLabel, Focus, remaining } from './focusClock';

export function Pomodoro() {
  const [session, setSession] = React.useState<Focus | null>(null);
  const [receivedAt, setReceivedAt] = React.useState(0);
  const [tick, setTick] = React.useState(Date.now());
  const [minutes, setMinutes] = React.useState(25);
  const [mode, setMode] = React.useState<'focus' | 'break'>('focus');
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState('');
  const [history, setHistory] = React.useState<Focus[]>([]);
  const [stats, setStats] = React.useState({ completed_sessions: 0, focus_seconds: 0 });
  const [notice, setNotice] = React.useState('');
  function accept(value: Focus | null) { setSession(value?.id ? value : null); setReceivedAt(Date.now()); setTick(Date.now()); }
  async function load() {
    const responses = await Promise.all(['current', 'history', 'stats'].map(path => apiFetch(`/api/pomodoro/${path}`)));
    if (responses.some(r => !r.ok)) throw Error();
    const [current, past, totals] = await Promise.all(responses.map(r => r.json()));
    accept(current); setHistory(past); setStats(totals); setReady(true);
  }
  React.useEffect(() => {
    void load().catch(() => setError('Не удалось загрузить таймер. Повтори загрузку.'));
    const timer = window.setInterval(() => setTick(Date.now()), 500);
    const visible = () => { if (!document.hidden) void load().catch(() => setError('Не удалось сверить таймер с сервером.')); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const seconds = session ? remaining(session, receivedAt, tick) : minutes * 60;
  async function action(kind: 'start' | 'pause' | 'resume' | 'finish' | 'cancel') {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiFetch(kind === 'start' ? '/api/pomodoro/sessions' : `/api/pomodoro/sessions/${session!.id}/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        ...(kind === 'start' ? { body: JSON.stringify({ mode, minutes }) } : {}),
      });
      if (!response.ok) throw Error();
      await load();
      if (kind === 'finish') setNotice('Сессия сохранена. Ты молодец!');
    } catch { setError('Не удалось выполнить действие. Повтори загрузку: состояние хранится на сервере.'); }
    finally { setBusy(false); }
  }
  return <section id="pomodoro" className="panel pomodoro" aria-label="Pomodoro">
    <p className="card-kicker">ВРЕМЯ ДЛЯ ВАЖНОГО</p><h2>Маленький фокус</h2>
    <p className="note">Один спокойный шаг. Таймер сохранится после обновления страницы.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={() => { setError(''); void load().catch(() => setError('Сервер недоступен.')); }}>Обновить таймер</button>
    {!session && <div className="focus-settings"><label>Режим Pomodoro<select value={mode} onChange={e => { const next = e.target.value as 'focus' | 'break'; setMode(next); setMinutes(next === 'focus' ? 25 : 5); }}><option value="focus">Концентрация</option><option value="break">Перерыв</option></select></label><label>Длительность в минутах<input type="number" min="1" max="120" step="1" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label></div>}
    <div className="focus-clock" role="timer" aria-label="Оставшееся время" aria-live="off">{clockLabel(seconds)}</div>
    <p className="focus-caption">{session ? `${session.mode === 'focus' ? 'Концентрация' : 'Перерыв'} · ${session.state === 'paused' ? 'на паузе' : seconds === 0 ? 'время истекло' : 'идёт сессия'}` : 'Начни, когда будешь готова'}</p>
    <div className="focus-actions">
      {!session ? <button disabled={busy || !ready || !Number.isInteger(minutes) || minutes < 1 || minutes > 120} type="button" onClick={() => void action('start')}>Начать сессию</button> : <>
        {seconds > 0 && <button disabled={busy} type="button" onClick={() => void action(session.state === 'paused' ? 'resume' : 'pause')}>{session.state === 'paused' ? 'Продолжить сессию' : 'Пауза'}</button>}
        {seconds === 0 && <button disabled={busy} type="button" onClick={() => void action('finish')}>Сохранить завершённую сессию</button>}
        <button disabled={busy} type="button" onClick={() => { if (window.confirm('Отменить текущую сессию? Она не попадёт в статистику завершённых.')) void action('cancel'); }}>Отменить сессию</button>
      </>}
    </div>
    <p className="note">По окончании нажми «Сохранить завершённую сессию». В статистику входят только завершённые сессии концентрации.</p>
    {ready && <div className="focus-totals"><span><strong>{stats.completed_sessions || 0}</strong> завершённых сессий</span><span><strong>{Math.floor((stats.focus_seconds || 0) / 60)}</strong> минут концентрации</span></div>}
    <h3>История сессий</h3><p className="note">Последние 100 сессий. Время в часовом поясе устройства.</p>
    <ol className="focus-history">{history.map(item => <li key={item.id}><strong>{item.mode === 'focus' ? 'Концентрация' : 'Перерыв'}</strong><span>{clockLabel(item.elapsed_seconds)} · {item.state === 'completed' ? 'завершена' : 'отменена'}</span><time>{new Date(item.finished_at || item.created_at).toLocaleString('ru-RU')}</time></li>)}</ol>
    {ready && history.length === 0 && <p className="note">Твоя первая сессия ещё впереди.</p>}
  </section>;
}

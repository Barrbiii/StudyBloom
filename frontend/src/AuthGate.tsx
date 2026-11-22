import React from 'react';
import { BloomMark } from './Decorations';

type User = { id: number; username: string };
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [register, setRegister] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  async function check() {
    setChecking(true); setError('');
    try {
      const response = await fetch('/api/auth/me');
      if (response.status === 401) { setUser(null); return; }
      if (!response.ok) throw Error();
      setUser(await response.json());
    } catch { setError('Не удалось проверить сессию. Проверь соединение и повтори.'); }
    finally { setChecking(false); }
  }
  React.useEffect(() => { void check(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const data = JSON.stringify({ username, password });
      const send = (path: string) => fetch(`/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data });
      if (register) {
        const response = await send('register');
        if (!response.ok) { setError(response.status === 409 ? 'Этот логин уже занят.' : 'Не удалось зарегистрироваться. Проверь логин и пароль.'); return; }
      }
      const response = await send('login');
      if (!response.ok) { setError('Не удалось войти. Проверь логин и пароль.'); return; }
      const profile = await response.json();
      setPassword(''); setUser(profile);
    } catch { setError('Сервер недоступен. Попробуй снова.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw Error();
      setUser(null); setPassword('');
    } catch { setError('Не удалось выйти. Попробуй снова.'); }
    finally { setBusy(false); }
  }
  if (checking) return <div className="auth-page" role="status">Открываем твой ежедневник…</div>;
  if (user) return <><div className="account-bar"><span>Твой ежедневник · {user.username}</span><button type="button" disabled={busy} onClick={() => void logout()}>Выйти</button>{error && <p role="alert">{error}</p>}</div>{children}</>;
  return <div className="auth-page"><section className="auth-card">
    <div className="auth-brand"><BloomMark />StudyBloom</div>
    <p className="card-kicker">ТВОЁ МЕСТО ДЛЯ РОСТА</p>
    <h1>{register ? 'Начни свою историю' : 'С возвращением'}</h1>
    <p className="note">Войди, чтобы открыть личные учебные планы.</p>
    <form onSubmit={submit}>
      <label>Логин<input autoComplete="username" pattern="[a-zA-Z0-9_]{3,64}" required minLength={3} maxLength={64} value={username} onChange={e => setUsername(e.target.value)} /></label>
      <small>Латинские буквы, цифры и _ — от 3 символов.</small>
      <label>Пароль<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <small>От 12 символов.</small>
      <button disabled={busy} type="submit">{busy ? 'Подожди…' : register ? 'Создать аккаунт' : 'Войти'}</button>
    </form>
    {error && <p role="alert">{error} <button type="button" onClick={() => void check()}>Проверить соединение</button></p>}
    <button className="auth-switch" disabled={busy} type="button" onClick={() => { setRegister(!register); setError(''); setPassword(''); }}>{register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}</button>
  </section></div>;
}

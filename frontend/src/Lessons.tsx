import React from 'react';
import { apiFetch } from './api';
export type Lesson = { id?: number; subject_id: number; weekday: number; starts_at: string; ends_at: string; starts_on: string; ends_on: string; room: string; teacher: string };
type Store = { lessons: Lesson[]; draft: Lesson | null; setDraft: React.Dispatch<React.SetStateAction<Lesson | null>>; load: () => Promise<void>; loadError: string };
const Context = React.createContext<Store | null>(null);
export function LessonsProvider({ children }: { children: React.ReactNode }) {
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const requestId = React.useRef(0);
  const [draft, setDraft] = React.useState<Lesson | null>(null);
  const [loadError, setError] = React.useState('');
  async function load() {
    const id=++requestId.current;
    const r = await apiFetch('/api/lessons');
    if (!r.ok) throw Error();
    const data: Lesson[] = await r.json();
    if(id===requestId.current){setLessons(data);setError('');}
  }
  React.useEffect(() => { void load().catch(() => setError('Не удалось загрузить расписание.')); return()=>{requestId.current++;}; }, []);
  return <Context.Provider value={{ lessons, draft, setDraft, load, loadError }}>{children}</Context.Provider>;
}
export function useLessons(): Store {
  const value = React.useContext(Context);
  if (!value) throw Error('Нет хранилища расписания');
  return value;
}

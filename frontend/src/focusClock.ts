export type Focus = { id: number; mode: 'focus' | 'break'; state: 'running' | 'paused' | 'completed' | 'cancelled'; duration_seconds: number; elapsed_seconds: number; created_at: string; finished_at: string | null };
export function remaining(session: Focus, receivedAt: number, at: number): number {
  const extra = session.state === 'running' ? Math.max(0, Math.floor((at - receivedAt) / 1000)) : 0;
  return Math.max(0, session.duration_seconds - session.elapsed_seconds - extra);
}
export function clockLabel(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

type Row = { day: string; seconds: number; sessions: number };
export function csvCell(value: string | number): string {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw Error('Некорректное число'); return String(value); }
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g,'""')}"`;
}
export function focusCsv(rows: Row[], timezone: string): string {
  return '\ufeff'+[['date','minutes','sessions','timezone'],...rows.map(r=>[r.day,r.seconds/60,r.sessions,timezone])].map(row=>row.map(v=>csvCell(v)).join(',')).join('\r\n')+'\r\n';
}

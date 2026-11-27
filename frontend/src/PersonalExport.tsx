import React from 'react';
import { apiFetch } from './api';
import { friendlyError, requireOk } from './apiErrors';
export function PersonalExport() {
  const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');const [notice,setNotice]=React.useState('');
  async function download() {
    if(busy)return;setBusy(true);setError('');setNotice('');
    try {
      const r=await requireOk(await apiFetch('/api/export/study'),'Не удалось подготовить архив.');
      const archive=await r.json();
      if(archive.format!=='studybloom-personal'||archive.version!==1||!archive.data)throw Error();
      const blob=new Blob([JSON.stringify(archive,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`studybloom-personal-${archive.generated_at.slice(0,10)}.json`;
      document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Личный архив подготовлен. Проверь загрузки браузера.');
    }catch(error){setError(friendlyError(error,'Не удалось скачать архив. Попробуй ещё раз.'));}
    finally{setBusy(false);}
  }
  return <section className="panel personal-export" id="personal-export" aria-label="Личный архив">
    <p className="card-kicker">СОХРАНИ СВОЙ ПУТЬ</p><h2>Твои планы — с тобой</h2>
    <p>Скачать личные задачи и шаги, предметы, дедлайны, события, расписание, привычки с историей, Pomodoro и повторения в JSON.</p>
    <p className="note">Без логина, пароля и токенов. Это архив учебных данных; автоматического восстановления из него пока нет. Общую резервную копию PostgreSQL он не заменяет.</p>
    <button type="button" disabled={busy} onClick={()=>void download()}>{busy?'Готовим архив…':'Скачать личный архив JSON'}</button>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}

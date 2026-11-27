import { test, expect } from '@playwright/test';
test('ошибки события объясняются без потери ввода и без серверных секретов',async({page})=>{
  let status=409;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let json:any=[];
    if(path==='/api/auth/me')json={id:1,username:'tester'};
    if(path==='/api/events'&&route.request().method()==='POST'){
      if(status===0){await route.abort('failed');return;}
      await route.fulfill({status,json:{detail:status===409?'Конфликт времени':status===422?[{input:'private-password'}]:'Traceback private-password'}});return;
    }
    await route.fulfill({json});
  });
  await page.goto('/');await page.getByRole('button',{name:'Добавить событие',exact:true}).click();
  const editor=page.getByRole('region',{name:'Редактор события'});
  await editor.getByLabel('Название события',{exact:true}).fill('Сохранить мой черновик');
  await editor.getByLabel('Начало',{exact:true}).fill('2026-11-27T10:00');
  await editor.getByLabel('Окончание',{exact:true}).fill('2026-11-27T11:00');
  for(const code of [409,422,429,503,0]){
    status=code;await editor.getByRole('button',{name:'Сохранить событие',exact:true}).click();
    await expect(editor.getByRole('alert')).toBeVisible();
    await expect(editor.getByRole('alert')).not.toContainText('private-password');
    await expect(editor.getByLabel('Название события',{exact:true})).toHaveValue('Сохранить мой черновик');
    await expect(editor.getByRole('button',{name:'Сохранить событие',exact:true})).toBeEnabled();
    if(code===409)await expect(editor.getByRole('alert')).toContainText('Конфликт времени');
    if(code===429)await expect(editor.getByRole('alert')).toContainText('Слишком много');
    if(code===503)await expect(editor.getByRole('alert')).toContainText('временно недоступен');
    if(code===0)await expect(editor.getByRole('alert')).toContainText('соединение');
  }
});
test('старый ответ расписания не затирает созданное занятие',async({page})=>{
  let old:any;let gets=0;
  const lesson={id:1,subject_id:1,weekday:0,starts_at:'09:00',ends_at:'10:00',starts_on:'2026-01-01',ends_on:'2027-12-31',room:'210',teacher:'Волков'};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let json:any=[];
    if(path==='/api/auth/me')json={id:1,username:'tester'};
    if(path==='/api/subjects')json=[{id:1,name:'Алгебра',color:'#a3aa83'}];
    if(path==='/api/lessons'){
      if(route.request().method()==='GET'&&++gets===1){old=route;return;}
      json=route.request().method()==='POST'?lesson:[lesson];
    }
    await route.fulfill({json});
  });
  await page.goto('/');await expect.poll(()=>Boolean(old)).toBe(true);
  await page.getByRole('button',{name:'Добавить занятие',exact:true}).click();
  await page.getByRole('button',{name:'Сохранить занятие',exact:true}).click();
  await expect(page.locator('.lesson-card')).toHaveCount(1);
  const delivered=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lessons'&&r.request().method()==='GET');
  await old.fulfill({json:[]});await delivered;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('.lesson-card')).toHaveCount(1);
});

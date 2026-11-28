import { test, expect } from '@playwright/test';
test('потерянный ответ события сохраняет ключ и повтор не создаёт вторую запись',async({page})=>{
  let lost=true;const keys:string[]=[];const events:any[]=[];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let json:any=[];
    if(path==='/api/auth/me')json={id:1,username:'tester'};
    if(path==='/api/events'){
      if(route.request().method()==='POST'){
        const key=route.request().headers()['idempotency-key'];keys.push(key);
        if(events.length===0)events.push({id:1,...route.request().postDataJSON()});
        if(lost){lost=false;await route.abort('failed');return;}
        json=events[0];
      }else json=events;
    }
    await route.fulfill({json});
  });
  await page.goto('/');await page.getByRole('button',{name:'Добавить событие',exact:true}).click();
  const editor=page.getByRole('region',{name:'Редактор события'});
  await editor.getByLabel('Название события',{exact:true}).fill('Не дублировать');
  await editor.getByLabel('Начало',{exact:true}).fill('2026-11-28T10:00');
  await editor.getByLabel('Окончание',{exact:true}).fill('2026-11-28T11:00');
  await editor.getByRole('button',{name:'Сохранить событие',exact:true}).click();
  await expect(editor.getByRole('alert')).toContainText('соединение');
  await editor.getByRole('button',{name:'Сохранить событие',exact:true}).click();
  await expect(editor).toHaveCount(0);expect(keys).toHaveLength(2);expect(keys[0]).toMatch(/^[a-f0-9]{32}$/);expect(keys[0]).toBe(keys[1]);
  expect(events).toHaveLength(1);
});

import { test, expect } from '@playwright/test';
for(const kind of ['lesson','habit'])test(`отмена ${kind} меняет ключ, повтор в открытой форме сохраняет`,async({page})=>{
  const keys:string[]=[];const endpoint=kind==='lesson'?'/api/lessons':'/api/habits';
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path===endpoint&&route.request().method()==='POST'){keys.push(route.request().headers()['idempotency-key']);await route.abort('failed');return;}
    await route.fulfill({json:path==='/api/auth/me'?{id:1,username:'tester'}:path==='/api/subjects'?[{id:1,name:'Алгебра',color:'#a3aa83'}]:[]});
  });
  await page.goto('/');
  const open=page.getByRole('button',{name:kind==='lesson'?'Добавить занятие':'Добавить привычку',exact:true});
  const form=page.getByRole('form',{name:kind==='lesson'?'Редактор занятия':'Редактор привычки',exact:true});
  const submit=form.getByRole('button',{name:kind==='lesson'?'Сохранить занятие':'Сохранить привычку',exact:true});
  async function prepare(){await open.click();if(kind==='habit')await form.getByLabel('Название привычки',{exact:true}).fill('Одна привычка');}
  await prepare();await submit.click();await expect.poll(()=>keys.length).toBe(1);await expect(submit).toBeEnabled();
  await form.getByLabel(kind==='lesson'?'Аудитория':'Название привычки',{exact:true}).focus();await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  await prepare();await submit.click();await expect.poll(()=>keys.length).toBe(2);await expect(submit).toBeEnabled();
  expect(keys[1]).not.toBe(keys[0]);
  await submit.click();await expect.poll(()=>keys.length).toBe(3);expect(keys[2]).toBe(keys[1]);
});

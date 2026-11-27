import { test, expect } from '@playwright/test';
async function mock(page: any) {
  await page.route('**/api/**',async(route:any)=>{
    const path=new URL(route.request().url()).pathname;
    let json:any=[];
    if(path==='/api/auth/me')json={id:1,username:'tester'};
    if(path==='/api/subjects')json=[{id:1,name:'Алгебра',color:'#a3aa83'}];
    if(path==='/api/deadlines')json=[{id:1,title:'Клавиатурный дедлайн',subject_id:1,due_date:'2026-11-27'}];
    await route.fulfill({json});
  });
}
test('событие открывается с клавиатуры, Tab работает, Escape возвращает фокус',async({page})=>{
  await mock(page);await page.goto('/');
  const opener=page.getByRole('button',{name:'Добавить событие',exact:true});
  await opener.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Название события',{exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.getByLabel('Начало',{exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region',{name:'Редактор события'})).toHaveCount(0);
  await expect(opener).toBeFocused();
});
test('расписание, привычка и дедлайн получают фокус и отменяются независимо',async({page})=>{
  await page.clock.install({time:new Date('2026-11-27T12:00:00')});
  await mock(page);await page.goto('/');
  const lesson=page.getByRole('button',{name:'Добавить занятие',exact:true});await lesson.click();
  await expect(page.getByRole('combobox',{name:'Предмет занятия',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(lesson).toBeFocused();
  await expect(page.getByRole('form',{name:'Редактор занятия'})).toHaveCount(0);
  await page.getByRole('button',{name:'Добавить событие',exact:true}).click();
  const habit=page.getByRole('button',{name:'Добавить привычку',exact:true});await habit.click();
  await expect(page.getByLabel('Название привычки',{exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(habit).toBeFocused();
  await expect(page.getByRole('region',{name:'Редактор события'})).toBeVisible();
  const deadline=page.getByRole('button',{name:'Изменить дедлайн: Клавиатурный дедлайн, 2026-11-27',exact:true});
  await deadline.click();await expect(page.getByRole('region',{name:'Редактор дедлайна'}).getByLabel('Название',{exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(deadline).toBeFocused();
});
test('Escape не закрывает событие при незавершённом сохранении',async({page})=>{
  await mock(page);let held:any;
  await page.route('**/api/events',async route=>{
    if(route.request().method()==='POST'){held=route;return;}
    await route.fulfill({json:[]});
  });
  await page.goto('/');await page.getByRole('button',{name:'Добавить событие',exact:true}).click();
  await page.getByLabel('Название события',{exact:true}).fill('Не терять ввод');
  await page.getByLabel('Начало',{exact:true}).fill('2026-11-27T10:00');
  await page.getByLabel('Окончание',{exact:true}).fill('2026-11-27T11:00');
  await page.getByRole('button',{name:'Сохранить событие',exact:true}).click();
  await expect.poll(()=>Boolean(held)).toBe(true);
  const editor=page.getByRole('region',{name:'Редактор события'});
  await expect(editor).toHaveAttribute('aria-busy','true');
  await page.getByLabel('Название события',{exact:true}).focus();await page.keyboard.press('Escape');
  await expect(editor).toBeVisible();
  await held.fulfill({status:201,json:{id:1,...held.request().postDataJSON()}});
  await expect(editor).toHaveCount(0);
});

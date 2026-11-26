import { test, expect } from '@playwright/test';
test('повторение создаёт задачи, повторяет запрос без копий и ставится на паузу', async ({ page }, info) => {
  let items: any[] = []; let tasks: any[] = []; let generated=false;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname; const method=route.request().method(); let json:any=[];
    if(path==='/api/auth/me') json={id:1,username:'tester'};
    if(path==='/api/recurring-tasks') {if(method==='POST')items.push({id:1,...route.request().postDataJSON(),paused:false});json=method==='POST'?items[0]:items;}
    if(path==='/api/recurring-tasks/1/generate'){if(!generated)tasks.push({id:1,title:'Повторить алгебру · 26.11.2026',completed:false,priority:'normal'});json={created:generated?0:1,already_generated:generated?1:0};generated=true;}
    if(path==='/api/recurring-tasks/1'){items[0]={...items[0],...route.request().postDataJSON()};json=items[0];}
    if(path==='/api/tasks')json=tasks;
    await route.fulfill({json});
  });
  await page.goto('/#recurring');
  const panel=page.getByRole('region',{name:'Повторяющиеся задачи',exact:true});
  await panel.getByLabel('Название повторения',{exact:true}).fill('Повторить алгебру');
  await panel.getByRole('button',{name:'Создать шаблон',exact:true}).click();
  await panel.getByRole('button',{name:'Создать задачи за период',exact:true}).click();
  await expect(page.locator('.task')).toHaveCount(1);
  await panel.getByRole('button',{name:'Создать задачи за период',exact:true}).click();
  await expect(panel.getByRole('status')).toContainText('Создано задач: 0');
  await expect(page.locator('.task')).toHaveCount(1);
  await panel.getByRole('button',{name:'Приостановить повторение',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Создать задачи за период',exact:true})).toBeDisabled();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('recurring-mobile.png')});
});

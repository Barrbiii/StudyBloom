import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('архив скачивается с данными, а отказ сервера позволяет повторить запрос',async({page})=>{
  let fail=true;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me'){await route.fulfill({json:{id:1,username:'tester'}});return;}
    if(path==='/api/export/study'){
      await route.fulfill({status:fail?503:200,json:fail?{detail:'private traceback'}:{format:'studybloom-personal',version:1,generated_at:'2026-11-27T07:00:00Z',data:{tasks:[{id:1,title:'Мой доклад',completed:false}]}}});return;
    }
    await route.fulfill({json:[]});
  });
  await page.goto('/#personal-export');
  const panel=page.getByRole('region',{name:'Личный архив',exact:true});
  await panel.getByRole('button',{name:'Скачать личный архив JSON'}).click();
  await expect(panel.getByRole('alert')).toContainText('временно недоступен');
  await expect(panel.getByRole('alert')).not.toContainText('private');
  fail=false;const downloading=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Скачать личный архив JSON'}).click();
  const download=await downloading;expect(download.suggestedFilename()).toBe('studybloom-personal-2026-11-27.json');
  const path=await download.path();const archive=JSON.parse(await readFile(path!,'utf8'));
  expect(archive.data.tasks[0].title).toBe('Мой доклад');
  await expect(panel.getByRole('status')).toContainText('подготовлен');
});

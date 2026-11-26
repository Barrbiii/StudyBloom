import { test, expect } from '@playwright/test';
test('период графика меняется отдельно от сегодняшнего обзора и помещается на телефоне',async({page},info)=>{
  let requests:string[]=[];
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());let json:any=[];
    if(url.pathname==='/api/auth/me')json={id:1,username:'tester'};
    if(url.pathname==='/api/dashboard'){
      requests.push(url.search);
      const from=url.searchParams.get('from_day')||'2026-11-20',through=url.searchParams.get('through')||'2026-11-26';
      const days=1+Math.round((Date.parse(through)-Date.parse(from))/86400000);
      json={day:'2026-11-26',timezone:'UTC',tasks:{total:2,completed:1},habits_today:{total:0,completed:0},overdue_deadlines:0,lessons_today:[],upcoming_deadlines:[],focus_period:{from_day:from,through,days},focus_week:Array.from({length:days},(_,n)=>({day:new Date(Date.parse(from)+n*86400000).toISOString().slice(0,10),seconds:n===0?1500:0,sessions:n===0?1:0}))};
    }
    await route.fulfill({json});
  });
  await page.goto('/#analytics');
  const panel=page.getByRole('region',{name:'Обзор и аналитика',exact:true});
  await panel.getByLabel('Аналитика с',{exact:true}).fill('2026-10-01');
  await panel.getByLabel('Аналитика по',{exact:true}).fill('2026-10-31');
  await panel.getByRole('button',{name:'Применить период',exact:true}).click();
  await expect(panel.locator('.chart-day')).toHaveCount(31);
  await expect(panel).toContainText('25 минут завершённой концентрации');
  expect(requests.some(s=>s.includes('from_day=2026-10-01')&&s.includes('through=2026-10-31'))).toBe(true);
  await expect(panel.locator('.insight-stats')).toContainText('1 / 2');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('analytics-period-mobile.png')});
});

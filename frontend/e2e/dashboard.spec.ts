import { test, expect } from '@playwright/test';
const overview = () => ({ day: '2026-11-24', timezone: 'Europe/Moscow', tasks: { total: 2, completed: 1 }, overdue_deadlines: 1, upcoming_deadlines: [{ id: 1, title: 'Курсовая', due_date: '2026-11-25' }], lessons_today: [{ id: 1, subject: 'Алгебра', starts_at: '09:00', ends_at: '10:00', room: '210', teacher: 'Волков' }], habits_today: { total: 2, completed: 1 }, focus_week: Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-${18+i}`, seconds: i === 6 ? 1500 : 0, sessions: i === 6 ? 1 : 0 })) });
test('обзор отображает реальные данные API, обновляется после записи и адаптируется', async ({ page }, info) => {
  const data = overview();
  const tasks = [{ id: 1, title: 'Задача для проверки', completed: false }, { id: 2, title: 'Готово', completed: true }];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === '/api/auth/me') json = { id: 1, username: 'tester' };
    if (path === '/api/dashboard') json = data;
    if (path === '/api/tasks') json = tasks;
    if (path === '/api/tasks/1') { tasks[0].completed = true; data.tasks.completed = 2; json = tasks[0]; }
    if (path === '/api/pomodoro/current') json = null;
    await route.fulfill({ json });
  });
  await page.goto('/#analytics');
  const panel = page.getByRole('region', { name: 'Обзор и аналитика', exact: true });
  await expect(panel).toContainText('Алгебра');
  await expect(panel).toContainText('Курсовая');
  await expect(panel).toContainText('25 минут завершённой концентрации');
  await panel.getByText('Точные значения графика', { exact: true }).click();
  await expect(panel.locator('tbody tr')).toHaveCount(7);
  await page.getByRole('checkbox', { name: 'Задача для проверки', exact: true }).check();
  await expect(panel.locator('.insight-stats')).toContainText('2 / 2');
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('dashboard-desktop.png') });
  for (const width of [360, 390, 768]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('dashboard-mobile.png'), fullPage: true });
});
test('обзор при отказе сервера не подставляет показатели и повторяет запрос', async ({ page }) => {
  let failed = true;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') { await route.fulfill({ json: { id: 1, username: 'tester' } }); return; }
    if (path === '/api/dashboard') { await route.fulfill({ status: failed ? 503 : 200, json: failed ? {} : overview() }); return; }
    await route.fulfill({ json: [] });
  });
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Обзор и аналитика', exact: true });
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.locator('.insight-stats')).toHaveCount(0);
  failed = false;
  await panel.getByRole('button', { name: 'Обновить обзор' }).click();
  await expect(panel.locator('.insight-stats')).toBeVisible();
});

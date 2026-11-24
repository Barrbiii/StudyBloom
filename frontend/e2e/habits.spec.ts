import { test, expect } from '@playwright/test';
test('привычка создаётся, отмечается, открывает историю и сохраняется после обновления', async ({ page }, info) => {
  const items: any[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    let json: any = [];
    if (path === '/api/auth/me') json = { id: 1, username: 'tester' };
    if (path === '/api/habits' && request.method() === 'POST') {
      items.push({ ...request.postDataJSON(), id: 1, value: 0, day_target: 10, completed: false, current_streak: 0, best_streak: 0, completed_days: 0 }); json = items[0];
    } else if (path === '/api/habits') json = items;
    if (path.includes('/days/')) { const item = items[0]; item.value = request.postDataJSON().value; item.completed = item.value >= item.day_target; item.current_streak = item.completed ? 1 : 0; json = item; }
    if (path.endsWith('/history') && path.includes('/habits/')) json = [{ day: '2026-11-24', value: items[0]?.value || 0, target: 10, completed: items[0]?.completed || false }];
    if (path === '/api/pomodoro/current') json = null;
    if (path === '/api/pomodoro/stats') json = { completed_sessions: 0, focus_seconds: 0 };
    await route.fulfill({ status: request.method() === 'POST' && path === '/api/habits' ? 201 : 200, json });
  });
  await page.goto('/#habits');
  const panel = page.getByRole('region', { name: 'Привычки и цели', exact: true });
  await panel.getByRole('button', { name: 'Добавить привычку' }).click();
  await panel.getByLabel('Название привычки', { exact: true }).fill('Читать книгу');
  await panel.getByLabel('Ежедневная цель', { exact: true }).fill('10');
  await panel.getByLabel('Единица измерения', { exact: true }).fill('страниц');
  await panel.getByRole('button', { name: 'Сохранить привычку' }).click();
  await expect(panel.locator('.habit-card')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Выполнено', exact: true }).click();
  await expect(panel.getByLabel('Цель выполнена', { exact: true })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole('button', { name: 'Снять отметку' })).toBeVisible();
  await panel.getByRole('button', { name: 'История привычки', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'История привычки' })).toContainText('10 / 10');
  await panel.getByRole('button', { name: 'Закрыть историю' }).click();
  for (const width of [360, 390, 768]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('habits-mobile.png') });
});

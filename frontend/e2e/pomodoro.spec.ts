import { test, expect } from '@playwright/test';
test('Pomodoro восстанавливает паузу, сохраняет завершение и помещается на телефоне', async ({ page }, info) => {
  let current: any = { id: 1, mode: 'focus', state: 'paused', duration_seconds: 60, elapsed_seconds: 30, created_at: '2026-11-24T12:00:00Z', finished_at: null };
  const history: object[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === '/api/auth/me') json = { id: 1, username: 'tester' };
    if (path === '/api/pomodoro/current') json = current;
    if (path === '/api/pomodoro/history') json = history;
    if (path === '/api/pomodoro/stats') json = { completed_sessions: history.length, focus_seconds: history.length * 60 };
    if (path.endsWith('/resume')) { current = { ...current, state: 'running', elapsed_seconds: 60 }; json = current; }
    if (path.endsWith('/finish')) { history.push({ ...current, state: 'completed', finished_at: '2026-11-24T12:01:00Z' }); current = null; json = history[0]; }
    await route.fulfill({ json });
  });
  await page.goto('/#pomodoro');
  const panel = page.getByRole('region', { name: 'Pomodoro', exact: true });
  await expect(panel.getByRole('timer')).toHaveText('00:30');
  await page.reload();
  await expect(panel.getByRole('button', { name: 'Продолжить сессию' })).toBeVisible();
  await panel.getByRole('button', { name: 'Продолжить сессию' }).click();
  await panel.getByRole('button', { name: 'Сохранить завершённую сессию' }).click();
  await expect(panel.locator('.focus-history li')).toHaveCount(1);
  await expect(panel.getByRole('status')).toContainText('Сессия сохранена');
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('pomodoro-mobile.png') });
});
test('ошибка Pomodoro допускает повторную загрузку без вымышленной статистики', async ({ page }) => {
  let fail = true;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') { await route.fulfill({ json: { id: 1, username: 'tester' } }); return; }
    if (path.startsWith('/api/pomodoro/')) {
      if (fail) { await route.fulfill({ status: 503, json: {} }); return; }
      await route.fulfill({ json: path.endsWith('current') ? null : path.endsWith('stats') ? { completed_sessions: 0, focus_seconds: 0 } : [] }); return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Pomodoro', exact: true });
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Начать сессию' })).toBeDisabled();
  await expect(panel.locator('.focus-totals')).toHaveCount(0);
  fail = false;
  await panel.getByRole('button', { name: 'Обновить таймер' }).click();
  await expect(panel.getByRole('button', { name: 'Начать сессию' })).toBeEnabled();
});

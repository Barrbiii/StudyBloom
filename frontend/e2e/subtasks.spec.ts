import { test, expect } from '@playwright/test';
test('чек-лист сохраняет шаги, отметки и новое название после обновления', async ({ page }, info) => {
  let items: any[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method(); let json: any = [];
    if (path === '/api/auth/me') json = { id: 1, username: 'tester' };
    if (path === '/api/tasks') json = [{ id: 1, title: 'Доклад', completed: false }];
    if (path === '/api/tasks/1/subtasks') {
      if (method === 'POST') items.push({ id: 1, ...route.request().postDataJSON(), completed: false });
      json = method === 'POST' ? items[0] : items;
    }
    if (path === '/api/tasks/1/subtasks/1') { items[0] = { ...items[0], ...route.request().postDataJSON() }; json = items[0]; }
    await route.fulfill({ json });
  });
  await page.goto('/#tasks');
  await page.getByRole('button', { name: 'Шаги задачи: Доклад', exact: true }).click();
  await page.getByLabel('Новый шаг: Доклад', { exact: true }).fill('Источники');
  await page.getByRole('button', { name: 'Добавить шаг', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Чек-лист: Доклад', exact: true });
  await panel.getByRole('checkbox', { name: 'Источники', exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Источники', exact: true })).toBeChecked();
  await panel.getByRole('button', { name: 'Переименовать шаг: Источники' }).click();
  await panel.getByLabel('Новое название шага').fill('Проверенные источники');
  await panel.getByRole('button', { name: 'Сохранить шаг', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Шаги задачи: Доклад', exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Проверенные источники', exact: true })).toBeChecked();
  await page.setViewportSize({ width: 360, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('subtasks-mobile.png') });
});

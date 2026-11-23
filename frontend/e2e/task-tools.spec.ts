import { test, expect } from '@playwright/test';

test('фильтры задач и экспорт выбранного списка', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') { await route.fulfill({ json: { id: 1, username: 'tester' } }); return; }
    if (path === '/api/tasks') { await route.fulfill({ json: [{ id: 1, title: 'Математика', completed: false, priority: 'high' }, { id: 2, title: 'История', completed: true, priority: 'normal' }] }); return; }
    await route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.locator('.task')).toHaveCount(2);
  await page.getByLabel('Поиск задач', { exact: true }).fill('матем');
  await expect(page.locator('.task')).toHaveCount(1);
  await page.getByLabel('Статус задач', { exact: true }).selectOption('completed');
  await expect(page.locator('.task')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Экспорт показанных задач' })).toBeDisabled();
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await page.getByLabel('Фильтр приоритета', { exact: true }).selectOption('high');
  await expect(page.locator('.task')).toHaveCount(1);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт показанных задач' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^studybloom-tasks-.*\.json$/);
});

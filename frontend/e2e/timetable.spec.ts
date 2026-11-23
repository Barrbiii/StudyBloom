import { test, expect } from '@playwright/test';

test('создание и повторное редактирование занятия', async ({ page }) => {
  const lessons: object[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') { await route.fulfill({ json: { id: 1, username: 'tester' } }); return; }
    if (path === '/api/subjects') { await route.fulfill({ json: [{ id: 1, name: 'Математика', color: '#a3aa83' }] }); return; }
    if (path === '/api/lessons') {
      if (route.request().method() === 'POST') {
        lessons.push({ ...route.request().postDataJSON(), id: 1 });
        await route.fulfill({ status: 201, json: lessons[0] }); return;
      }
      await route.fulfill({ json: lessons }); return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Добавить занятие', exact: true }).click();
  await page.getByLabel('Аудитория', { exact: true }).fill('210');
  await page.getByLabel('Преподаватель', { exact: true }).fill('Волков');
  await page.getByRole('button', { name: 'Сохранить занятие', exact: true }).click();
  await expect(page.locator('.lesson-card')).toHaveCount(1);
  await expect(page.locator('.lesson-card')).toContainText('210 Волков');
  await page.getByRole('button', { name: 'Изменить занятие', exact: true }).click();
  await expect(page.getByLabel('Преподаватель', { exact: true })).toHaveValue('Волков');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

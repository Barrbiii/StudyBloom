import { test, expect } from '@playwright/test';

// Синтетические ответы API: эти проверки покрывают UI, а не PostgreSQL.
test('ежедневник: формы, календарь и мобильная компоновка', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const tasks = [
    { id: 1, title: 'Подготовить конспект по математике', completed: false },
    { id: 2, title: 'Повторить английские слова', completed: true },
    { id: 3, title: 'Прочитать главу по истории', completed: false },
  ];
  const subjects = [
    { id: 1, name: 'Математика', color: '#a3aa83' },
    { id: 2, name: 'Английский язык', color: '#c48c91' },
    { id: 3, name: 'История', color: '#ba9b7d' },
  ];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST' && path === '/api/tasks') {
      tasks.push({ id: 4, ...route.request().postDataJSON(), completed: false });
      await route.fulfill({ status: 201, json: tasks.at(-1) });
      return;
    }
    await route.fulfill({ json: path === '/api/tasks' ? tasks : path === '/api/subjects' ? subjects : [] });
  });
  await page.goto('/');
  await expect(page.getByText('Подготовить конспект по математике', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.getByLabel('Название задачи', { exact: true }).fill('Проверить новый ежедневник');
  await page.getByRole('button', { name: 'Добавить +', exact: true }).click();
  await expect(page.getByText('Проверить новый ежедневник', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  await page.getByRole('button', { name: 'Неделя', exact: true }).click();
  await expect(page.locator('.calendar-day')).toHaveCount(7);
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation').getByRole('link', { name: 'Мои задачи' }).click();
  await expect(page.getByLabel('Название задачи', { exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('событие создаётся и открывается из сетки календаря', async ({ page }) => {
  const events: object[] = [];
  await page.route('**/api/**', async route => {
    if (new URL(route.request().url()).pathname === '/api/events') {
      if (route.request().method() === 'POST') {
        events.push({ id: 1, ...route.request().postDataJSON() });
        await route.fulfill({ status: 201, json: events[0] }); return;
      }
      await route.fulfill({ json: events }); return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Добавить событие', exact: true }).click();
  await page.getByLabel('Название события', { exact: true }).fill('Консультация');
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  await page.getByLabel('Начало', { exact: true }).fill(`${day}T10:00`);
  await page.getByLabel('Окончание', { exact: true }).fill(`${day}T11:00`);
  await page.getByRole('button', { name: 'Сохранить событие' }).click();
  await expect(page.getByRole('region', { name: 'Редактор события' })).toHaveCount(0);
  await page.locator('.calendar-event').getByText('Консультация').click();
  await expect(page.getByLabel('Название события', { exact: true })).toHaveValue('Консультация');
});

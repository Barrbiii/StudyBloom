import { test, expect } from '@playwright/test';
test('занятия повторяются в календаре, фильтруются и открывают общий редактор', async ({ page }, info) => {
  await page.clock.install({ time: new Date('2026-11-25T12:00:00') });
  let lesson = { id: 1, subject_id: 1, weekday: 2, starts_at: '09:00', ends_at: '10:00', starts_on: '2026-11-01', ends_on: '2026-11-30', room: '210', teacher: 'Волков' };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === '/api/auth/me') json = { id: 1, username: 'tester' };
    if (path === '/api/subjects') json = [{ id: 1, name: 'Алгебра', color: '#a3aa83' }, { id: 2, name: 'История', color: '#c48c91' }];
    if (path === '/api/lessons') json = [lesson];
    if (path === '/api/lessons/1') { lesson = { ...lesson, ...route.request().postDataJSON() }; json = lesson; }
    await route.fulfill({ json });
  });
  await page.goto('/#calendar');
  await expect(page.locator('.calendar-lesson')).toHaveCount(4);
  await page.getByRole('button', { name: 'Изменить занятие: Алгебра, 2026-11-25', exact: true }).click();
  await expect(page.getByLabel('Аудитория', { exact: true })).toHaveValue('210');
  await page.getByLabel('Начало занятия', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Сохранить занятие' }).click();
  await expect(page.locator('.calendar-lesson').first()).toContainText('08:00');
  await page.getByLabel('Фильтр календаря по предмету').selectOption('2');
  await expect(page.locator('.calendar-lesson')).toHaveCount(0);
  await page.getByLabel('Фильтр календаря по предмету').selectOption('');
  await page.getByRole('button', { name: 'Неделя', exact: true }).click();
  await expect(page.locator('.calendar-lesson')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#calendar').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('lessons-calendar-mobile.png') });
});

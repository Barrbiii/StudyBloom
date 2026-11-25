import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occursOn } from '../src/lessonDates.ts';
test('недельный шаблон включает границы периода и правильный день недели', () => {
  const lesson = { weekday: 0, starts_on: '2026-11-02', ends_on: '2026-11-30' };
  for (const day of ['2026-11-02', '2026-11-09', '2026-11-30']) assert.equal(occursOn(lesson, day), true);
  for (const day of ['2026-10-26', '2026-11-03', '2026-12-07']) assert.equal(occursOn(lesson, day), false);
});
test('воскресенье, високосный день и переход года не сдвигаются', () => {
  assert.equal(occursOn({ weekday: 6, starts_on: '2026-12-01', ends_on: '2027-01-31' }, '2027-01-03'), true);
  assert.equal(occursOn({ weekday: 3, starts_on: '2024-02-01', ends_on: '2024-03-01' }, '2024-02-29'), true);
});

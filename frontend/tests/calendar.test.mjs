import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, dateKey, parseDate, moveAnchor, startOfWeek } from '../src/calendarDates.ts';

test('неделя начинается в понедельник даже для воскресенья', () => {
  assert.equal(dateKey(startOfWeek(parseDate('2026-11-22'))), '2026-11-16');
  assert.deepEqual(calendarDays(parseDate('2026-12-31'), 'week').map(dateKey),
    ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});
test('месяц включает все дни високосного февраля и полные недели', () => {
  const days = calendarDays(parseDate('2028-02-15'), 'month').map(dateKey);
  assert.equal(days.length % 7, 0);
  assert.ok(days.includes('2028-02-29'));
  assert.equal(new Set(days).size, days.length);
  assert.equal(days[0], '2028-01-31');
});
test('переход от 31 числа не пропускает следующий месяц', () => {
  assert.equal(dateKey(moveAnchor(parseDate('2026-01-31'), 'month', 1)), '2026-02-01');
  assert.equal(dateKey(moveAnchor(parseDate('2026-12-31'), 'month', 1)), '2027-01-01');
  assert.equal(dateKey(moveAnchor(parseDate('2027-01-01'), 'week', -1)), '2026-12-25');
});
test('строковая дата не сдвигается из-за часового пояса', () => {
  for (const timezone of ['Europe/Moscow', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    process.env.TZ = timezone;
    assert.equal(dateKey(parseDate('2026-12-06')), '2026-12-06');
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remaining, clockLabel } from '../src/focusClock.ts';
const session = { state: 'running', duration_seconds: 1500, elapsed_seconds: 100 };
test('отсчёт использует время, прошедшее с ответа API, включая сон вкладки', () => {
  assert.equal(remaining(session, 1000, 11000), 1390);
  assert.equal(remaining(session, 1000, 2000000), 0);
  assert.equal(remaining(session, 1000, 0), 1400);
});
test('пауза не добавляет время; часы форматируются для длинной сессии', () => {
  assert.equal(remaining({ ...session, state: 'paused' }, 0, 9000000), 1400);
  assert.equal(clockLabel(7200), '120:00');
  assert.equal(clockLabel(-3), '00:00');
  assert.equal(clockLabel(65), '01:05');
});

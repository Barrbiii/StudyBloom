import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, focusCsv } from '../src/focusCsv.ts';
test('экспорт содержит фактические даты, нулевые дни, минуты и часовой пояс',()=>{
  const text=focusCsv([{day:'2026-11-26',seconds:1500,sessions:1},{day:'2026-11-27',seconds:0,sessions:0}],'Europe/Moscow');
  assert.ok(text.startsWith('\ufeff"date","minutes","sessions","timezone"\r\n'));
  assert.ok(text.includes('"2026-11-26",25,1,"Europe/Moscow"'));
  assert.ok(text.includes('"2026-11-27",0,0,"Europe/Moscow"'));
  assert.ok(!text.includes('owner_id')&&!text.includes('token'));
});
test('кавычки и CSV-формулы безопасно экранируются, нечисла отклоняются',()=>{
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('@SUM(1)'), '"\'@SUM(1)"');
  assert.equal(csvCell(-5), '-5');
  assert.throws(()=>csvCell(Infinity));
});

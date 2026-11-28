import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateIntent } from '../src/CreateIntent.ts';
test('потерянный ответ повторяет тот же ключ, правка или подтверждение меняют его',()=>{
 const intent=new CreateIntent(), a=intent.headers('/api/tasks','{"title":"A"}')['Idempotency-Key'];
 assert.match(a,/^[a-f0-9]{32}$/);
 assert.equal(intent.headers('/api/tasks','{"title":"A"}')['Idempotency-Key'],a);
 const b=intent.headers('/api/tasks','{"title":"B"}')['Idempotency-Key'];assert.notEqual(a,b);
 intent.reset();assert.notEqual(intent.headers('/api/tasks','{"title":"B"}')['Idempotency-Key'],b);
});
test('другая форма и другой маршрут не разделяют намерение',()=>{
 const first=new CreateIntent(),second=new CreateIntent();
 const a=first.headers('/api/tasks','{}')['Idempotency-Key'];
 assert.notEqual(second.headers('/api/tasks','{}')['Idempotency-Key'],a);
 assert.notEqual(first.headers('/api/events','{}')['Idempotency-Key'],a);
});

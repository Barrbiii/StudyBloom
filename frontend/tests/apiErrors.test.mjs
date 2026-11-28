import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireOk, friendlyError, ApiFailure } from '../src/apiErrors.ts';
test('конфликт показывает безопасное объяснение, успешный ответ сохраняется',async()=>{
  const r=new Response('{}');assert.equal(await requireOk(r,'Ошибка'),r);
  await assert.rejects(()=>requireOk(new Response(JSON.stringify({detail:'Сначала верни привычку из архива'}),{status:409}),'Ошибка'),/Сначала верни/);
});
test('валидация не раскрывает входные поля и серверная ошибка не показывает секреты',async()=>{
  for(const status of [422,500]) {
    const detail=status===422?[{input:'private-password'}]:'Traceback database-password';
    try{await requireOk(new Response(JSON.stringify({detail}),{status}),'Проверь поля');assert.fail();}
    catch(error){assert.ok(error instanceof ApiFailure);assert.ok(!error.message.includes('password'));}
  }
});
test('ограничение запросов и HTML прокси дают понятное сообщение',async()=>{
  await assert.rejects(()=>requireOk(new Response('nginx',{status:429}),'Ошибка'),/Слишком много/);
  await assert.rejects(()=>requireOk(new Response('<html>private</html>',{status:403}),'Недоступно'),/Недоступно/);
  assert.equal(friendlyError(new Error('raw-secret'),'Безопасно'),'Безопасно');
});

test('удалённое создание объясняется без предложения создать копию',async()=>{
  await assert.rejects(()=>requireOk(new Response(JSON.stringify({detail:'Запись уже удалена. Повтор не создаёт её заново'}),{status:410}),'Ошибка'),/уже удалена/);
});

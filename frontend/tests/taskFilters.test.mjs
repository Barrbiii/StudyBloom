import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTasks } from '../src/taskFilters.ts';
const tasks = [{title:'МАТЕМАТИКА 100%',completed:false,priority:'high'},{title:'История',completed:true},{title:'English',completed:false,priority:'low'}];
test('поиск задач учитывает регистр кириллицы и буквальные символы',()=>{
  assert.deepEqual(filterTasks(tasks,' математика ','all',''),[tasks[0]]);
  assert.deepEqual(filterTasks(tasks,'100%','all',''),[tasks[0]]);
  assert.deepEqual(filterTasks(tasks,'_','all',''),[]);
});
test('статус и приоритет комбинируются, старые задачи имеют обычный приоритет',()=>{
  assert.deepEqual(filterTasks(tasks,'','completed','normal'),[tasks[1]]);
  assert.deepEqual(filterTasks(tasks,'','active','high'),[tasks[0]]);
  assert.deepEqual(filterTasks(tasks,'','completed','high'),[]);
  assert.equal(filterTasks(tasks,'','all','').length,3);
});

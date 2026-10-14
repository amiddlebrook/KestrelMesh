import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const moduleUnderTest=require(resolve('tests/.compiled/index.js'));
test('KestrelMesh: routing matches longest prefix and priority fallback',()=>{
 const a={id:'a',name:'A',provider:'fixture',model_ref:'fixture',priority:10,enabled:1};
 const b={id:'b',name:'B',provider:'fixture',model_ref:'fixture',priority:20,enabled:1};
 assert.equal(moduleUnderTest.chooseModel([a,b],'urgent: hello', [{id:'a',match_prefix:'urg',model_id:'a'},{id:'b',match_prefix:'urgent:',model_id:'b'}]).id,'b');
 assert.equal(moduleUnderTest.chooseModel([a,b],'ordinary').id,'a');
 assert.equal(moduleUnderTest.chooseModel([{...a,enabled:0},b],'ordinary').id,'b');
});
test('KestrelMesh: percentile has correct boundaries',()=>{
 assert.equal(moduleUnderTest.percentile([20,10,30,40],.95),40);assert.equal(moduleUnderTest.percentile([1,2,3,4],.5),2);assert.equal(moduleUnderTest.percentile([],.95),null);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJSON} from '../public/http.js';
const respond=(body,status=200,ct='application/json')=>new Response(body,{status,headers:{'Content-Type':ct}});
test('same-origin API path enforced and query strings retained',async()=>{
 await assert.rejects(requestJSON('https://attacker.example/collect',{fetcher:async()=>respond('{}')}),/same-origin/);
 let requested='';const result=await requestJSON('/api/overview?limit=3',{fetcher:async(path,init)=>{requested=path;assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.ok(init.signal);return respond('{"ok":true}')}});
 assert.equal(requested,'/api/overview?limit=3');assert.equal(result.ok,true);
});
test('credentials go only into Authorization header, with JSON safely encoded',async()=>{
 const payload=await requestJSON('/api/x',{method:'POST',data:{name:'A&B'},token:'test-credential',fetcher:async(path,init)=>{
  assert.equal(init.headers.Authorization,'Bearer test-credential');assert.equal(init.headers['Content-Type'],'application/json');assert.deepEqual(JSON.parse(init.body),{name:'A&B'});return respond('{"id":"r1"}');
 }});assert.equal(payload.id,'r1');
});
test('invalid HTML response is not echoed or parsed as API data',async()=>{
 await assert.rejects(requestJSON('/api/test',{fetcher:async()=>respond('<script>secret</script>',503,'text/html')}),e=>e.message.includes('unexpected response')&&!e.message.includes('secret'));
});
test('rejects malformed JSON without displaying raw content',async()=>{
 await assert.rejects(requestJSON('/api/test',{fetcher:async()=>respond('{bad')}),/invalid JSON/);
});
test('handles disconnected API, bounded error messages, and timeout',async()=>{
 await assert.rejects(requestJSON('/api/test',{fetcher:async()=>{throw Error('secret server stack')}}),e=>e.message.includes('Cannot reach')&&!e.message.includes('secret'));
 await assert.rejects(requestJSON('/api/test',{fetcher:async()=>{const e=new Error();e.name='TimeoutError';throw e}}),/timed out/);
 await assert.rejects(requestJSON('/api/test',{fetcher:async()=>respond('{"error":"Forbidden"}',403)}),/Forbidden/);
});

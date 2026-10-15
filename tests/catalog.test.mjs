import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {catalogCsv,catalogQuery,escapeCatalogText} from '../public/catalog.js';
const require=createRequire(import.meta.url);
const {catalogApi}=require('./.compiled/catalog.js');
function setup(){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={DB:{prepare(sql){let values=[];return{bind(...x){values=x;return this},async all(){return{results:db.prepare(sql).all(...values)}},async first(){return db.prepare(sql).get(...values)??null}}}}};
 return {db,env};
}
async function get(env,path){const u=new URL('https://localhost'+path);const response=await catalogApi(new Request(u),env,u);assert.ok(response);return {status:response.status,body:await response.json()};}

test('allowlisted cursor pagination handles equal timestamps without duplicate or skipped rows',async()=>{
 const {db,env}=setup();
 const stamp='2026-10-15T00:00:00.000Z';
 for(let i=0;i<65;i++){const id='id-'+String(i).padStart(3,'0'),title=i===7?'distinctive l%\_ phrase':`Record ${i}`;db.prepare('INSERT INTO models(id,name,provider,model_ref,priority,enabled,created_at) VALUES(?,?,?,?,?,?,?)').run(id,title,'fixture','fixture-reference',10,1,stamp);}
 const collection='models';
 let cursor='',all=[],pages=0;
 do{const p=await get(env,catalogQuery(collection,{size:20,cursor}));assert.equal(p.status,200);assert.equal(p.body.total,65);assert.ok(p.body.items.length<=20);all.push(...p.body.items.map(r=>r.id));cursor=p.body.next_cursor;pages++;assert.ok(pages<=4);}while(cursor);
 assert.equal(all.length,65);assert.equal(new Set(all).size,65);assert.deepEqual(all,[...all].sort().reverse());assert.equal(pages,4);
 const phrase=await get(env,catalogQuery(collection,{q:'distinctive',size:10}));assert.equal(phrase.body.total,1);
 const reserved=await get(env,catalogQuery(collection,{q:'%'}));assert.equal(reserved.body.total,1,'Percent must match a literal percent, not any text');
 const underscore=await get(env,catalogQuery(collection,{q:'_'}));assert.equal(underscore.body.total,1,'Underscore must match literally');
 const invalid=await catalogApi(new Request('https://localhost/api/catalog/'+collection+'?size=400'),env,new URL('https://localhost/api/catalog/'+collection+'?size=400')).then(()=>null,e=>e);
 assert.equal(invalid?.status,400);db.close();
});

test('facet selection is done in SQL; malformed cursors and mismatched filters fail closed',async()=>{
 const {db,env}=setup(),stamp='2026-10-15T00:00:00.000Z',id='id-000',title='Fixture reference';db.prepare('INSERT INTO models(id,name,provider,model_ref,priority,enabled,created_at) VALUES(?,?,?,?,?,?,?)').run(id,title,'fixture','fixture-reference',10,1,stamp);
 
 const type='models',state='1';
 const result=await get(env,catalogQuery(type,{facet:state}));assert.equal(result.status,200);assert.ok(result.body.items.length>=1);assert.ok(result.body.facets.some(x=>String(x.state)===state));
 const wrong=await catalogApi(new Request('https://localhost/api/catalog/'+type+'?cursor=bad!'),env,new URL('https://localhost/api/catalog/'+type+'?cursor=bad!')).then(()=>null,e=>e);
 assert.equal(wrong?.status,400);
 const unknown=await catalogApi(new Request('https://localhost/api/catalog/no-such-table'),env,new URL('https://localhost/api/catalog/no-such-table')).then(()=>null,e=>e);
 assert.equal(unknown?.status,404);db.close();
});

test('UI escape, query construction and CSV avoid active content and formulas',()=>{
 assert.equal(escapeCatalogText('<img src=x onerror=1>'),'&lt;img src=x onerror=1&gt;');
 assert.match(catalogQuery('datasets',{q:'x&admin=1'}),/q=x%26admin%3D1/);
 assert.ok(!catalogQuery('datasets',{q:'x'}).includes('Bearer'));
 assert.ok(catalogCsv([{name:'=1+1',id:'safe'}]).includes("'=1+1"));
 assert.ok(catalogCsv([{name:'<script>alert(1)</script>'}]).includes('<script>'));
});

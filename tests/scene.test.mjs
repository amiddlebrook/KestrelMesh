import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {numericFields,explicitLinks,sceneSummary,renderOperationalMap} from '../public/operational-map.js';
import {queryAndOrderRecords} from '../public/lens.js';
const escape = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const render=(app,rows,metric)=>renderOperationalMap({appName:app,rows,escape,metric});
test('spatial maps are 5 distinct interaction surfaces with no synthetic record data',()=>{
 const r=[{id:'a',name:'Alpha',status:'passed',accuracy:.95,created_at:'2026-09-01T01:00:00Z'},{id:'b',name:'Beta',status:'failed',accuracy:.42,parent_id:'a',created_at:'2026-10-01T01:00:00Z'}];
 for(const [name,klass] of Object.entries({RivetFlow:'scene-flow',SignalBench:'scene-spectrum',ProofAtlas:'scene-evidence',KestrelMesh:'scene-routing',GradientFoundry:'scene-chronology'})){
  const html=render(name,r);assert.ok(html.includes(klass));assert.ok(html.includes('data-lens-inspect'));assert.ok(html.includes('Not a full-database aggregate'));
 }
 assert.ok(render('RivetFlow',r).includes('scene-rail'));
 assert.ok(render('SignalBench',r).includes('scene-plot'));
 assert.ok(render('ProofAtlas',r).includes('scene-network'));
 assert.ok(render('KestrelMesh',r).includes('scene-network'));
 assert.ok(render('GradientFoundry',r).includes('scene-chronicle'));
});
test('network relationships are only explicit local record references',()=>{
 const r=[{id:'a',name:'A',provider_id:'external'},{id:'b',name:'B',parent_id:'a',target_ids:['a','not-loaded']},{id:'c',name:'C',random_text:'a',status:'running'}];
 assert.deepEqual(explicitLinks(r),[{from:1,to:0,field:'parent_id'},{from:1,to:0,field:'target_ids'}]);
 assert.equal(sceneSummary(r).linked,2);assert.equal(explicitLinks(r.slice(0,1)).length,0);
});
test('metrics use numeric fields only, and evidence is rendered escaped',()=>{
 const r=[{id:'evil',name:'<img src=x onerror=alert(1)>',score:0.8},{id:'safe',name:'safe',score:0.7}];
 assert.deepEqual(numericFields(r),['score']);
 const html=render('SignalBench',r,'score');
 assert.ok(html.includes('scene-datapoint'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
 assert.ok(render('SignalBench',[{id:'a',name:'No metric',count:'8'}]).includes('no shared numeric evaluation metric'));
});
test('query and sorting are stable, numeric and nonmutating',()=>{
 const r=[{name:'Zed',score:2,status:'open'},{name:'Alpha',score:10,status:'open'},{name:'Beta',score:3,status:'closed'}];
 assert.deepEqual(queryAndOrderRecords(r,{query:'OPEN',sort:'-score'}).map(x=>x.name),['Alpha','Zed']);
 assert.deepEqual(queryAndOrderRecords(r,{sort:'+score'}).map(x=>x.score),[2,3,10]);
 assert.equal(r[0].name,'Zed');
 assert.deepEqual(queryAndOrderRecords(r,{query:'missing'}),[]);
});
test('all layout actions route to the real record inspector and deployed CSS is mobile accessible',()=>{
 const app=readFileSync(new URL('../public/lens.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/command-surface.css',import.meta.url),'utf8');
 for(const marker of ['data-lens-query','data-lens-sort','data-scene-metric','data-lens-inspect','map:',"mode==='map'"])assert.ok(app.includes(marker),marker);
 assert.ok(html.includes('command-surface.css'));
 assert.ok(css.includes('prefers-reduced-motion')&&css.includes('@media(max-width:560px)'));
});

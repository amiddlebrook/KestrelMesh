import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import app from '../public/config.js';
import { renderShell, renderRecords } from '../public/workspace.js';
const esc=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
test('distinct full application shell has required controls and every route',()=>{
 const html=renderShell(app,{label:'TEST'},esc);
 for(const id of ['navigation','page-title','page-subtitle','message','content','auth','refresh'])assert.match(html,new RegExp(`id="${id}"`));
 for(const section of app.sections)assert.ok(html.includes(`data-page="${section.id}"`),section.id);
 assert.ok(html.includes('data-page="overview"'));assert.ok(html.includes('data-page="access"'));
});
test('records escape unsafe text and preserve inspect and action bindings',()=>{
 const html=renderRecords({spec:{action:{title:'Go'}},rows:[{id:'one',name:'<img src=x onerror=alert(1)>',status:'ready'}],esc});
 assert.ok(!html.includes('<img'));
 assert.match(html,/data-inspect="0"/);
 assert.match(html,/data-action="0"/);
});
test('empty collections are informative',()=>assert.match(renderRecords({spec:{},rows:[],esc}),/No persisted records/));

test('product workspace is deployed as an independent stylesheet and module',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../public/workspace.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.ok(css.length>2500);assert.match(html,/workspace\.css/);
 assert.match(js,/renderShell\(app,identity,esc\)/);
 assert.match(js,/renderRecords\(\{spec,rows:dataRows,esc\}\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeRecords,csvOf} from '../public/lens.js';
test('workbench states aggregate only loaded rows',()=>{
 assert.deepEqual(summarizeRecords([{status:'running'},{status:'failed'},{status:'running'},{state:'Approved'}]),[{name:'running',count:2},{name:'approved',count:1},{name:'failed',count:1}]);
 assert.deepEqual(summarizeRecords([]),[]);
 assert.deepEqual(summarizeRecords([{id:'unclassified'}]),[{name:'unclassified',count:1}]);
});
test('CSV export escapes quotes, newlines, and spreadsheet formulas',()=>{
 const c=csvOf([{title:'=IMPORTDATA("https://unsafe.test")',notes:'line\n"quoted"',empty:null},{title:'-2+3',notes:'@SUM(1,2)',empty:42}],['title','notes','empty']);
 assert.ok(c.startsWith('\ufeff"title","notes","empty"\r\n'));
 assert.ok(c.includes('"\'=IMPORTDATA(""https://unsafe.test"")"'));
 assert.ok(c.includes('"line\n""quoted"""'));
 assert.ok(c.includes('"\'-2+3"'));
 assert.ok(c.includes('"\'@SUM(1,2)"'));
});
test('record workbench offers usable layouts, selection, CSV and comparison',()=>{
 const script=readFileSync(new URL('../public/lens.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 for(const feature of ['data-lens-mode','data-lens-facet','data-lens-inspect','data-lens-action','data-lens-select','data-lens-csv','data-lens-compare','data-lens-prev','data-lens-next'])assert.ok(script.includes(feature),feature);
 assert.ok(app.includes('createRecordWorkbench'));
 assert.ok(app.includes('showModal()'));
 assert.ok(html.includes('/lens.css'));
 assert.ok(!script.includes('Math.random()'));
});

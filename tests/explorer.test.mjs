import test from 'node:test';
import assert from 'node:assert/strict';
import {presets,refineRecords,filtersMarkup} from '../public/explorer.js';
test('explorer preserves original rows and returns correctly sorted results',()=>{
 const items=[{id:'x',name:'Zulu',created_at:'2026-01-01T00:00:00Z'},{id:'y',name:'Alpha',created_at:'2026-03-01T00:00:00Z'}];
 assert.deepEqual(refineRecords(items,{order:'az'}).map(x=>x.name),['Alpha','Zulu']);
 assert.deepEqual(refineRecords(items,{query:'ALPHA'}).map(x=>x.name),['Alpha']);
 assert.deepEqual(items.map(x=>x.name),['Zulu','Alpha']);
});
test('explorer includes search, scoped presets, count and export controls',()=>{
 const html=filtersMarkup(12);
 for(const id of ['id="filter"','id="enterprise-preset"','id="enterprise-record-count"','id="enterprise-export"'])assert.ok(html.includes(id));
 assert.ok(presets.length>=4);
});

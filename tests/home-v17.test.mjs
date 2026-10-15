import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEMO_DATA,renderHome} from '../public/home.js';
const source=readFileSync(new URL('../public/home.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../public/home.css',import.meta.url),'utf8');
test('real operational screen replaces marketing hero on the main route',()=>{
 assert.equal(typeof renderHome,'function');
 assert.ok(source.includes('km17-cli'));
 assert.ok(source.includes('km16-wave'));
 assert.ok(!source.includes('<header class="km16-hero">'));
});
test('guest workspace clearly identifies fixture data and does not impersonate live traffic',()=>{
 assert.ok(source.includes('INTERACTIVE DEMO'));
 assert.ok(source.includes('NOT LIVE CUSTOMER DATA'));
 assert.ok(source.includes('Connect private data'));
 assert.ok(Object.keys(DEMO_DATA).length>=3);
 assert.ok(Object.values(DEMO_DATA).every(x=>Array.isArray(x.items)));
});
test('independent responsive styles and accessible controls are present',()=>{
 assert.ok(style.includes('km17-cli'));
 assert.ok(style.includes('@media'));
 assert.ok(style.includes('focus-visible'));
});

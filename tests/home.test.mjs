import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderHome} from '../public/home.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('home renderer exported independently',()=>{assert.equal(typeof renderHome,'function')});
test('homepage is default, mission still reachable',()=>{assert.match(app,/return validPages.has\(id\)\?id:'overview'/);assert.match(app,/else if\(page==='overview'\)await overview\(\)/);assert.match(app,/if\(page==='mission'\)await renderMission/)});
test('home module and CSS are wired',()=>{assert.match(html,/home.css/);assert.match(app,/from '.\/home.js'/)});

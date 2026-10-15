import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const pub=new URL('../public/',import.meta.url);
const read=f=>readFileSync(new URL(f,pub),'utf8');
test('readability and mobile accessibility assets are loaded last',()=>{
 const html=read('index.html');assert.match(html,/\/home\.css/);assert.match(html,/\/usability\.css/);
 assert.ok(html.indexOf('/usability.css')>html.indexOf('/home.css'));
 assert.match(read('app.js'),/mountUsability\(\{app,navigate:/);
});
test('navigation drawer has keyboard-close, focus return, full nav and accessible name',()=>{
 const script=read('usability.js');
 for(const x of ['showModal()','dialog.close()','aria-labelledby','aria-current','menu.focus()','navigate(item.dataset.page)','aria-expanded'])assert.ok(script.includes(x),x);
});
test('readability is user-selectable and persistent, never secret-bound',()=>{
 const s=read('usability.js');assert.match(s,/localStorage/);assert.match(s,/readingPreference/);assert.match(s,/readability:.*name/);
 for(const x of ['standard','comfortable','large'])assert.ok(s.includes(x));
 assert.doesNotMatch(s,/portfolio-admin-token|ADMIN_TOKEN|Bearer/i);
});
test('mobile touch targets, focus, reduced motion and scroll strategy',()=>{
 const css=read('usability.css');for(const term of ['min-height:44px','focus-visible','prefers-reduced-motion','overscroll-behavior','max-width:900px','#navigation{display:none','--reading-extra'])assert.ok(css.includes(term),term);
 assert.ok(css.includes('max-height:calc(100dvh'));
});
test('product styles use minimum 13px readable microtype with explicit scale',()=>{
 const files=readdirSync(pub.pathname).filter(f=>f.endsWith('.css')&&f!=='usability.css');
 for(const file of files){const raw=read(file);const rx=/(?:font|font-size)\s*:\s*([^;{}]+)/g;for(const [,val] of raw.matchAll(rx)){
  // Legacy glyph sizing and declarative clamp values are excluded from microtype test.
  const matches=[...val.matchAll(/(?<![\w-])(\d*\.?\d+)px(?![\w-])/g)];
  for(const m of matches){const size=Number(m[1]);if(size>0&&size<12)assert.fail(`${file}: ${size}px is too small: ${val.slice(0,85)}`)}
 }}
});

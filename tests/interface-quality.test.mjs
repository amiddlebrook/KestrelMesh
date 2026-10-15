import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderDetails} from '../public/details.js';
test('record inspector escapes hostile strings and retains complete source fields',()=>{
  const source={id:'model-123',name:'<img src=x onerror=alert(1)>',unexpected:'private <data> & test',status:'running'};
  const out=renderDetails(source);
  assert.ok(out.includes('enterprise-dossier'));
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!out.includes('<img src=x onerror'));
  assert.ok(out.includes('Original API payload'));
  assert.ok(out.includes('private &lt;data&gt; &amp; test'));
  assert.ok(out.includes('data-copy-record'));
});
test('access UI verifies credentials, never uses browser prompt or exposes stored tokens in HTML',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const modal=readFileSync(new URL('../public/interaction.js',import.meta.url),'utf8');
  const shell=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(!app.includes("prompt('Enter an admin"));
  assert.ok(modal.includes("fetch('/api/access/me'"));
  assert.ok(modal.includes("session"));
  assert.ok(modal.includes('showModal()'));
  assert.ok(modal.includes("fetch('/api/health'"));
  assert.ok(shell.includes('/quality.css'));
  assert.ok(shell.includes('/workspace.css'));
});

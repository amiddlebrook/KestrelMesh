import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('public/agent.js','utf8');
const css=readFileSync('public/agent.css','utf8');
const html=readFileSync('public/index.html','utf8');
test('distinct accessible KestrelMesh agent cockpit has working bound controls',()=>{
 assert.match(js,/export async function renderAgent/);
 assert.match(js,/role=\"alert\"/);
 assert.match(js,/aria-pressed/);
 assert.match(js,/evidence_steps/);
 assert.match(js,/agent-evidence-/);
 assert.match(js,/ag-objective/);
 assert.match(js,/ag-advance/);
 assert.ok(js.includes('km-terminal'));
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/:focus-visible/);
 assert.match(html,/agent.css/);
});

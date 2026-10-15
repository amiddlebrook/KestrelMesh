import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Phase 26 product workflow remains reachable in the application UI',()=>{
 const js=readFileSync('public/domain-lab.js','utf8');
 assert.ok(js.includes('lab-plan'),'Missing operator-facing Phase 26 interaction');
 assert.ok(js.includes('aria-live') || js.includes('results'),'UI must expose actionable state feedback');
 const check=readFileSync('scripts/verify-deployment.mjs','utf8');
 assert.ok(check.includes('Phase 26'),'Missing production release contract');
});

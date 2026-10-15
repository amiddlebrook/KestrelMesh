import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const runner=readFileSync('scripts/verify-browser.mjs','utf8');
const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
const packageInfo=JSON.parse(readFileSync('package.json','utf8'));
test('Phase 27 authenticated browser acceptance is a real deployment gate',()=>{
 assert.match(workflow,/Verify actual browser UX on deployed Cloudflare Worker/);
 assert.match(workflow,/APP_PRIMARY_SECTION: routinglab/);
 assert.match(workflow,/APP_ADMIN_TOKEN: \${{ secrets.APP_ADMIN_TOKEN }}/);
 assert.match(workflow,/npm run verify:browser/);
 assert.equal(packageInfo.scripts['verify:browser'],'node scripts/verify-browser.mjs');
 assert.match(runner,/Runtime.exceptionThrown/);
 assert.match(runner,/Page.captureScreenshot/);
 assert.match(runner,/Emulation.setDeviceMetricsOverride/);
 assert.match(runner,/\/api\/overview/);
 assert.match(runner,/document.documentElement.scrollWidth/);
 assert.match(runner,/sessionStorage.setItem/);
 assert.doesNotMatch(workflow,/playwright install|billing|npm install -g/);
});

test('mobile density preserves navigation and reachable 44px controls',()=>{
 const css=readFileSync('public/palette-balance.css','utf8');
 assert.match(css,/Phase 27 mobile acceptance/);
 assert.match(css,/readability-menu/);
 assert.match(css,/grid-template-columns/);
 assert.match(css,/minmax\(104px,1fr\)/);
 assert.match(css,/enterprise-mode-button/);
});

test('palette neutralizes the product shell without removing semantic accents',()=>{
 const css=readFileSync('public/palette-balance.css','utf8');
 assert.match(css,/Phase 27 visual evidence review/);
 assert.match(css,/background:\#1[0-9a-f]{5}/i);
 assert.match(css,/color:\#e[0-9a-f]{5}/i);
});

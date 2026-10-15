import assert from 'node:assert/strict';
const origin = process.env.DEPLOY_URL ?? process.argv[2];
if (!origin || !/^https:\/\//.test(origin)) throw new Error('DEPLOY_URL must be HTTPS');
async function check(route, expectedStatus, token) {
 const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(10000), redirect: 'error', headers: token ? { Authorization: 'Bearer '+token } : {} });
 assert.equal(response.status, expectedStatus, `${route}: expected ${expectedStatus}, got ${response.status}`);
 return response;
}
let previous;
for(let attempt=1;attempt<=7;attempt++){
 try {
  const response=await check('/api/health',200);
  const health=await response.json();assert.equal(health.ok,true);
  await check('/api/overview',401);
  const token=process.env.APP_ADMIN_TOKEN;
  if(!token)throw new Error('Missing APP_ADMIN_TOKEN: authenticated smoke testing is required');
  const overview=await (await check('/api/overview',200,token)).json();
  assert.ok(Array.isArray(overview.metrics),'Authenticated D1 overview contract missing');
  const domain=await (await check('/api/circuits',200,token)).json();
  assert.ok(Array.isArray(domain.items),'Domain-specific D1 API contract missing');
  const phase3=await (await check('/api/circuit-leases',200,token)).json();
  assert.ok(Array.isArray(phase3.items),'New domain module or migration missing on deployed Cloudflare Worker');
  const accessMe=await (await check('/api/access/me',200,token)).json();
  assert.equal(accessMe.kind,'root','Production root access was not accepted');
  const inventory=await (await check('/api/access/keys',200,token)).json();
  assert.ok(Array.isArray(inventory.items),'Credential migration not present in production');
  await check('/api/access/keys',401);
  const identityStyle=await (await check('/identity.css',200)).text();
  assert.ok(identityStyle.length>3000,'Domain-specific visual design missing from live Worker');
  const identityApp=await (await check('/experience.js',200)).text();
  assert.ok(identityApp.includes('renderExperience'),'Domain-specific interactive experience missing');
  const workspaceStyle=await (await check('/workspace.css',200)).text();
  assert.ok(workspaceStyle.length>2500,'Application-specific workspace styles missing');
  const workspaceModule=await (await check('/workspace.js',200)).text();
  assert.ok(workspaceModule.includes('renderShell'),'Independent application shell missing');
  assert.ok(workspaceModule.includes('k5-shell'),'Wrong product interface deployed');
  const quality=await (await check('/quality.css',200)).text();
  assert.ok(quality.includes('enterprise-dossier') && quality.includes('enterprise-dialog'),'UI quality controls not deployed');
  const inspector=await (await check('/details.js',200)).text();
  assert.ok(inspector.includes('renderDetails'),'Record inspector not deployed');
  const browser=await (await check('/explorer.js',200)).text();
  assert.ok(browser.includes('refineRecords'),'Domain-specific data explorer not deployed');
  const keyboard=await (await check('/interaction.js',200)).text();
  assert.ok(keyboard.includes('createInterface') && keyboard.includes('showModal()'),'Keyboard navigation or access dialog not deployed');
  const page=await check('/',200);
  const html=await page.text(); assert.ok(html.includes('<html')||html.includes('<!doctype html>'),'HTML shell missing');
  console.log(`Live deployment verified: ${origin} (health, D1 domain API, protected API, static site)`);
  process.exit(0);
 }catch(error){previous=error; if(attempt<7)await new Promise(r=>setTimeout(r,1200*attempt));}
}
throw previous;

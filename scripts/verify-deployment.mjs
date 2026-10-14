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
  const identityStyle=await (await check('/identity.css',200)).text();
  assert.ok(identityStyle.length>3000,'Domain-specific visual design missing from live Worker');
  const identityApp=await (await check('/experience.js',200)).text();
  assert.ok(identityApp.includes('renderExperience'),'Domain-specific interactive experience missing');
  const page=await check('/',200);
  const html=await page.text(); assert.ok(html.includes('<html')||html.includes('<!doctype html>'),'HTML shell missing');
  console.log(`Live deployment verified: ${origin} (health, D1 domain API, protected API, static site)`);
  process.exit(0);
 }catch(error){previous=error; if(attempt<7)await new Promise(r=>setTimeout(r,1200*attempt));}
}
throw previous;

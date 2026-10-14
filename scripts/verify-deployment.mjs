import assert from 'node:assert/strict';
const origin = process.env.DEPLOY_URL ?? process.argv[2];
if (!origin || !/^https:\/\//.test(origin)) throw new Error('DEPLOY_URL must be HTTPS');
async function check(route, expectedStatus) {
 const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(10000), redirect: 'error' });
 assert.equal(response.status, expectedStatus, `${route}: expected ${expectedStatus}, got ${response.status}`);
 return response;
}
let previous;
for(let attempt=1;attempt<=7;attempt++){
 try {
  const response=await check('/api/health',200);
  const health=await response.json();assert.equal(health.ok,true);
  await check('/api/overview',401);
  const page=await check('/',200);
  const html=await page.text(); assert.ok(html.includes('<html')||html.includes('<!doctype html>'),'HTML shell missing');
  console.log(`Live deployment verified: ${origin} (health, protected API, static site)`);
  process.exit(0);
 }catch(error){previous=error; if(attempt<7)await new Promise(r=>setTimeout(r,1200*attempt));}
}
throw previous;

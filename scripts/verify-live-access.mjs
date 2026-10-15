/** Bounded, production-only acceptance of the scoped credential lifecycle.
 * A single one-day credential is always revoked in finally. Its plaintext is
 * never logged, written to an artifact, or exposed to the browser runner.
 */
import assert from 'node:assert/strict';

const origin = process.env.DEPLOY_URL;
const adminToken = process.env.APP_ADMIN_TOKEN;
if (!origin || !/^https:\/\/[^/]+$/.test(origin)) throw Error('DEPLOY_URL must be a HTTPS origin');
if (!adminToken || adminToken.length < 12) throw Error('APP_ADMIN_TOKEN is required');
const label = 'ci-scope-check-' + (process.env.GITHUB_RUN_ID || Date.now().toString(36));
const request = async (path, token, method = 'GET', data) => {
  const response = await fetch(new URL(path, origin), {
    method, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(12000),
    headers: {
      Authorization: 'Bearer ' + token,
      ...(data === undefined ? {} : {'Content-Type':'application/json'})
    },
    body:data === undefined ? undefined : JSON.stringify(data)
  });
  return response;
};
let keyId = null, viewerToken = null, revoked = false;
try {
  const issued = await request('/api/access/keys',adminToken,'POST',{
    label,role:'viewer',route_prefix:'/api/overview/',expires_in_days:1
  });
  assert.equal(issued.status,201,'Administrator must be able to issue bounded viewer key');
  const data = await issued.json();
  keyId = data.id;
  viewerToken = data.token;
  assert.match(keyId,/^[0-9a-f-]{36}$/i);
  assert.match(viewerToken,/^efk_[0-9a-f-]{36}_[A-Za-z0-9_-]{40,100}$/);
  assert.equal((await request('/api/overview',viewerToken)).status,200,'Viewer must read allowed overview');
  assert.equal((await request('/api/access/keys',viewerToken)).status,403,'Viewer must be denied administration');
  assert.equal((await request('/api/overview',viewerToken,'POST',{})).status,403,'Viewer must be denied writes');
  assert.equal((await request('/api/overview-extra',viewerToken)).status,403,'Prefix must reject adjacent paths');
  const response = await request(`/api/access/keys/${keyId}/revoke`,adminToken,'POST',{});
  assert.equal(response.status,200,'Administrator must revoke viewer key');
  revoked=true;
  assert.equal((await request('/api/overview',viewerToken)).status,401,'Revoked credential must be rejected');
  console.log('Live scoped credential lifecycle verified (issue, scope, read-only, revoke, post-revoke denial).');
} finally {
  if (keyId && !revoked) {
    try {
      await request(`/api/access/keys/${keyId}/revoke`,adminToken,'POST',{});
      console.log('Temporary scoped credential cleanup completed.');
    } catch {
      // Credential automatically expires within 24h; do not print secret or body.
      console.error('Temporary scoped credential cleanup was not confirmed; investigate access audit.');
    }
  }
}

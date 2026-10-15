/** Phase 14: real root-key governance. Never caches issued plaintext credentials. */
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const utc=x=>x?new Date(x).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Never';
const nowMs=()=>Date.now();
export function classifyKey(k,time=nowMs()){
 if(k.revoked_at)return 'revoked';
 const expires=Date.parse(k.expires_at);
 if(!Number.isFinite(expires)||expires<=time)return 'expired';
 if(expires-time<=7*86400000)return 'expiring';
 return 'active';
}
export function filterKeys(keys,{query='',view='all'}={},time=nowMs()){
 const q=query.trim().toLowerCase();
 return keys.filter(k=>{
  const state=classifyKey(k,time);
  if(view!=='all'&&state!==view)return false;
  return !q||[k.label,k.role,k.route_prefix,k.id].some(x=>String(x??'').toLowerCase().includes(q));
 });
}
export function expiryPct(k,time=nowMs()){
 const start=Date.parse(k.created_at),end=Date.parse(k.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
 return Math.max(0,Math.min(100,Math.round(100*(end-time)/(end-start))));
}
export function scopeClass(prefix){return prefix==='/api/'?'Wide access':'Route-limited';}
export function policyPreset(choice){
 return ({readonly:{role:'viewer',route_prefix:'/api/',expires_in_days:7},operator:{role:'operator',route_prefix:'/api/',expires_in_days:1},custom:{role:'viewer',route_prefix:'/api/',expires_in_days:30}})[choice]||null;
}
function downloadJson(items){
 const blob=new Blob([JSON.stringify(items,null,2)],{type:'application/json'});
 const ref=URL.createObjectURL(blob),a=document.createElement('a');a.href=ref;a.download='credential-audit-metadata.json';a.click();setTimeout(()=>URL.revokeObjectURL(ref),500);
}
function secretDialog(created,{success}){
 const d=document.createElement('dialog');d.className='ac-secret';d.setAttribute('aria-label','One-time credential');
 d.innerHTML='<div class="ac-secret-head"><span class="ac-label">SECURE HANDOFF · ONE-TIME VIEW</span><h3>Store this key now.</h3><p>Closing this window permanently removes the displayed token from this page. The server does not return its plaintext again.</p></div><div class="ac-secret-slot"></div><div class="ac-secret-actions"><button type="button" class="btn secondary" data-copy>Copy to clipboard</button><button type="button" class="btn" data-close>I have stored it</button></div>';
 const slot=d.querySelector('.ac-secret-slot');const area=document.createElement('textarea');area.readOnly=true;area.rows=3;area.value=created.token;area.setAttribute('aria-label','New API credential, displayed once');slot.append(area);
 d.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(area.value);success('Copied. Store it in a password manager.')}catch{area.select();success('Select the token and copy manually.')}};
 const finish=()=>{area.value='';d.remove()};
 d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',finish,{once:true});document.body.append(d);d.showModal();
}
function empty(message){return `<div class="ac-empty">${esc(message)}</div>`}
export async function renderAccessConsole({root,api,success,error,product}){
 root.innerHTML='<div class="ac-load" role="status">Reading credential inventory and access telemetry…</div>';
 let me;
 try{me=await api('/api/access/me')}
 catch(e){root.innerHTML=empty('Authentication required. Use the Access key control and provide the Cloudflare ADMIN_TOKEN to administer credentials.');error(e);return}
 if(me.kind!=='root'){
  root.innerHTML=`<section class="ac-gate"><div class="ac-label">DELEGATED WORKSPACE</div><h3>${esc(me.label||'Scoped credential')}</h3><p>Your role is <strong>${esc(me.role)}</strong>. This credential is limited to <code>${esc(me.route_prefix)}</code>. Only the root administrator can issue or revoke keys, review audit metadata, or inspect organizational security posture.</p><p>Organization-level tenant isolation is not yet implemented.</p></section>`;return;
 }
 let records;
 try{records=await Promise.all([api('/api/access/keys'),api('/api/access/audit'),api('/api/access/insights'),api('/api/access/write-quota'),api('/api/access/maintenance')])}
 catch(e){root.innerHTML=empty('Cannot load access governance data. The D1 migrations or root access may be unavailable.');error(e);return}
 const [inventory,audit,insights,quota,maintenance]=records,keys=inventory.items||[],events=audit.items||[];
 let state={query:'',view:'all',tab:'keys'};
 const c=insights.credentials;
 const counts=[['ACTIVE',c.active,'✓'],['EXPIRING ≤7D',c.expiring,'◷'],['REVOKED',c.revoked,'⊘'],['UNUSED',c.never_used,'○']];
 root.innerHTML=`<div class="ac-app" data-product="${esc(product)}"><header class="ac-mast"><div><span class="ac-label">IDENTITY PLANE / PHASE 14</span><h3>Access intelligence<span class="ac-mark"> / ${esc(product)}</span></h3><p>Live credential inventory, scoped authorization, and operational access diagnostics.</p><div class="ac-hints"><span><i></i> ROOT SESSION</span><span>D1 BACKED</span><span>7-DAY WATCH</span></div></div><div class="ac-mast-action"><span>POLICY SNAPSHOT</span><strong>${c.active} / ${c.total}</strong><small>active / total issued keys</small><button type="button" class="btn secondary" data-refresh>↻ Sync policy</button></div></header>
 <div class="ac-kpis">${counts.map(([name,v,glyph])=>`<article class="ac-kpi"><div>${esc(name)} <b>${glyph}</b></div><strong>${v}</strong><small>${name==='UNUSED'?'Active keys never presented':'Based on stored key lifecycle'}</small></article>`).join('')}</div>
 <div class="ac-layout"><section class="ac-main"><nav class="ac-tabs" aria-label="Access control views"><button type="button" data-tab="keys" aria-current="page">Credential register</button><button type="button" data-tab="issue">Issue permission</button><button type="button" data-tab="audit">Lifecycle audit</button></nav>
 <section data-panel="keys"><div class="ac-section-head"><div><span class="ac-label">01 / ISSUED IDENTITIES</span><h4>Credential register</h4></div><div class="ac-tools"><label>Search keys<input data-query placeholder="Label, role, scope, ID" autocomplete="off" /></label><label>Lifecycle<select data-view><option value="all">All statuses</option><option value="active">Active</option><option value="expiring">Expiring</option><option value="expired">Expired</option><option value="revoked">Revoked</option></select></label></div></div><p class="ac-hint" role="status" data-counter></p><div class="ac-keylist" data-keylist></div></section>
 <section data-panel="issue" hidden><div class="ac-section-head"><div><span class="ac-label">02 / CONTROLLED DELEGATION</span><h4>Issue temporary access</h4></div></div><p>Keys are generated server-side. The plaintext is displayed once, never returned again, and is not stored by this interface.</p><div class="ac-presets"><button data-preset="readonly" type="button">7-day viewer</button><button data-preset="operator" type="button">1-day operator</button><button data-preset="custom" type="button">Custom policy</button></div><form data-create class="ac-create"><label>Purpose / accountable owner<input name="label" maxlength="100" required placeholder="Read-only QA reviewer" autocomplete="off"></label><div class="ac-form-pair"><label>Permission role<select name="role"><option value="viewer">Viewer — GET/HEAD</option><option value="operator">Operator — read/write, no DELETE</option></select></label><label>Expiry in days<input name="expires_in_days" type="number" min="1" max="90" value="7" required></label></div><label>Canonical API scope<input name="route_prefix" value="/api/" required maxlength="128" pattern="/api/.*" aria-describedby="ac-scope-note"></label><p id="ac-scope-note" class="ac-hint">Broad <code>/api/</code> grants the selected role across application APIs; use a narrower prefix when possible. This does not restrict records to an organization.</p><div class="ac-policy-preview" role="status" data-preview></div><button class="btn" type="submit">Generate one-time key ↗</button></form></section>
 <section data-panel="audit" hidden><div class="ac-section-head"><div><span class="ac-label">03 / CREDENTIAL CHANGES</span><h4>Lifecycle audit</h4></div><button data-export type="button" class="btn secondary">Export metadata JSON ↗</button></div><p class="ac-hint">Most recent ${events.length} issuance/revocation entries. This audit is mutable database metadata, not tamper-evident forensic evidence.</p><div class="ac-eventlist">${events.map(e=>`<div class="ac-event"><span class="ac-event-glyph">${e.action==='issued'?'↗':'⊘'}</span><div><strong>${esc(e.action==='issued'?'Credential issued':'Credential revoked')}</strong><span>${esc(e.subject_id?.slice(0,13)||'unknown')} · ${esc(e.actor_id||'root')}</span></div><time>${esc(utc(e.created_at))}</time></div>`).join('')||empty('No key lifecycle changes recorded.')}</div></section>
 </section><aside class="ac-side"><section class="ac-side-panel"><span class="ac-label">ACTIVE PERMISSION SURFACE</span><h4>Scope distribution</h4><div class="ac-scope-list">${(insights.active_scopes||[]).map(x=>`<div class="ac-scope"><div><b>${esc(x.role)}</b><code>${esc(x.route_prefix)}</code></div><span>${Number(x.total)||0}</span></div>`).join('')||empty('No active keys. Root credential remains configured as a Worker secret.')}</div></section><section class="ac-side-panel"><span class="ac-label">7-DAY ACTIVITY SAMPLE</span><h4>${insights.activity_7d.mutations} mutations</h4><p>${insights.activity_7d.errors} HTTP failures among authenticated write requests. Reads and failed authentications are not counted.</p></section><section class="ac-side-panel"><span class="ac-label">LIVE WRITE QUOTA / 60 SEC</span><h4>${quota.writes} mutation attempts</h4><p>${quota.active_identities} active credentials · root ${quota.root_writes}/${quota.root_limit} · operators ${quota.operator_limit} per key/minute.</p><p>Read APIs remain available when a key reaches its write quota. API responds 429 with Retry-After.</p></section><section class="ac-side-panel"><span class="ac-label">SCHEDULED D1 MAINTENANCE</span><h4>${maintenance.last_run?esc(utc(maintenance.last_run)):'Awaiting first scheduled run'}</h4><p>Daily at 04:00 UTC · 24-hour write-quota retention · last run pruned ${Number(maintenance.rows_pruned)||0} expired counters.</p></section><section class="ac-side-panel ac-warn"><span class="ac-label">BOUNDARY / NOT YET IMPLEMENTED</span><h4>No tenant isolation</h4><p>Credentials control role and API route, not organization membership. Do not use this app to host mutually untrusted customer tenants until row-level boundaries and tests exist.</p></section></aside></div></div>`;
 const $=s=>root.querySelector(s);
 const select=tab=>{state.tab=tab;root.querySelectorAll('[data-tab]').forEach(x=>{const active=x.dataset.tab===tab;x.setAttribute('aria-current',active?'page':'false');x.classList.toggle('selected',active)});root.querySelectorAll('[data-panel]').forEach(x=>x.hidden=x.dataset.panel!==tab);if(tab==='keys')$('[data-query]').focus();if(tab==='issue')$('[name="label"]').focus()};
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>select(b.dataset.tab));
 const draw=()=>{
  const filtered=filterKeys(keys,state);$('[data-counter]').textContent=`Showing ${filtered.length} of ${keys.length} keys · metadata only`;
  $('[data-keylist]').innerHTML=filtered.map(k=>{const status=classifyKey(k);const pct=expiryPct(k);return `<article class="ac-key"><div class="ac-key-header"><div><span class="ac-state ac-${status}">${esc(status.toUpperCase())}</span><strong>${esc(k.label)}</strong></div><span class="ac-role">${esc(k.role)}</span></div><div class="ac-key-body"><code>${esc(k.route_prefix)}</code><span>${esc(scopeClass(k.route_prefix))}</span><span>Last used: ${esc(utc(k.last_used_at))}</span></div><div class="ac-life" aria-label="Key lifetime remaining ${pct} percent"><i style="width:${pct}%"></i></div><div class="ac-key-foot"><small>Expires ${esc(utc(k.expires_at))} · <code>${esc(k.id.slice(0,8))}</code></small>${status==='active'||status==='expiring'?`<button type="button" class="ac-revoke" data-revoke="${esc(k.id)}" aria-label="Revoke ${esc(k.label)}">Revoke access ↗</button>`:''}</div></article>`}).join('')||empty('No credentials match the current filters.');
  root.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{const key=keys.find(x=>x.id===b.dataset.revoke);if(!key)return;const typed=window.prompt(`To revoke “${key.label}”, enter REVOKE. All calls using that key will be blocked immediately.`);if(typed!=='REVOKE')return;b.disabled=true;try{await api(`/api/access/keys/${encodeURIComponent(key.id)}/revoke`,'POST',{});success(`Revoked ${key.label}`);await renderAccessConsole({root,api,success,error,product});}catch(e){b.disabled=false;error(e)}});
 };
 $('[data-query]').oninput=e=>{state.query=e.target.value;draw()};$('[data-view]').onchange=e=>{state.view=e.target.value;draw()};
 const form=$('[data-create]');
 const preview=()=>{const role=form.elements.role.value,prefix=form.elements.route_prefix.value,days=Number(form.elements.expires_in_days.value);$('[data-preview]').textContent=`${role.toUpperCase()} / ${prefix||'No scope'} / ${days} day${days===1?'':'s'} · ${role==='viewer'?'Read only':'Writes permitted except DELETE'}.`;};
 ['input','change'].forEach(evt=>form.addEventListener(evt,preview));
 root.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const policy=policyPreset(b.dataset.preset);if(!policy)return;form.elements.role.value=policy.role;form.elements.route_prefix.value=policy.route_prefix;form.elements.expires_in_days.value=policy.expires_in_days;preview()});
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type="submit"]');b.disabled=true;try{
  const data={label:form.elements.label.value,role:form.elements.role.value,route_prefix:form.elements.route_prefix.value,expires_in_days:Number(form.elements.expires_in_days.value)};
  const issued=await api('/api/access/keys','POST',data);
  secretDialog(issued,{success});success('Key generated. Copy it before closing the one-time window.');
 }catch(ex){error(ex)}finally{b.disabled=false}};
 $('[data-export]').onclick=()=>downloadJson(events.map(({id,action,subject_id,actor_id,detail,created_at})=>({id,action,subject_id,actor_id,detail,created_at})));
 $('[data-refresh]').onclick=()=>renderAccessConsole({root,api,success,error,product});
 preview();draw();select('keys');
}

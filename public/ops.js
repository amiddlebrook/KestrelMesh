/** Root-only operational diagnostics. Never display secret values or request bodies. */
export function filterActivity(items,{query='',outcome='all'}={}){
 const q=query.trim().toLowerCase();return items.filter(x=>{
  if(outcome==='failed'&&Number(x.status)<400)return false;
  if(outcome==='succeeded'&&Number(x.status)>=400)return false;
  return !q||[x.method,x.path,x.actor_role,x.actor_id,x.id].some(v=>String(v??'').toLowerCase().includes(q));
 });
}
export async function renderOperations({root,api,esc,success,error}){
 root.innerHTML='<p role="status">Retrieving protected activity journal…</p>';
 try{
  const [summary,history]=await Promise.all([api('/api/ops/summary'),api('/api/ops/activity?limit=100')]);
  const events=history.items||[];
  root.innerHTML=`<div class="ops-shell"><header class="ops-title"><div><div class="ops-kicker">Administrative control / bounded diagnostics</div><h3>API activity journal</h3><p>Who changed what route, when, and how the service responded.</p></div><button type="button" class="btn secondary" id="ops-export">Export loaded rows ↗</button></header><div class="ops-metrics"><article class="ops-tile"><span>7-DAY MUTATING REQUESTS</span><strong>${summary.mutations}</strong></article><article class="ops-tile"><span>4XX / 5XX OUTCOMES</span><strong>${summary.failed}</strong></article><article class="ops-tile"><span>MEAN WRITE RESPONSE</span><strong>${summary.average_duration_ms} ms</strong></article></div><section class="ops-register"><h4>Recent mutation events</h4><div class="ops-toolbar"><label>Filter by actor or route<input id="ops-search" placeholder="e.g. /api/models" autocomplete="off" /></label><label>Result<select id="ops-result"><option value="all">All outcomes</option><option value="failed">Failed requests</option><option value="succeeded">Successful requests</option></select></label><button class="btn secondary" id="ops-refresh" type="button">Refresh</button></div><p id="ops-count" role="status"></p><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Recorded UTC</th><th>Actor</th><th>Operation</th><th>HTTP</th><th>Duration</th><th>Correlation ID</th></tr></thead><tbody id="ops-rows"></tbody></table></div><p class="ops-note">Root administrator only. Stores no tokens, headers, query parameters or request payloads. Mutations only; missing events, external side effects, and unauthenticated attempts are not covered. Do not use this journal as legal/forensic evidence.</p></section></div>`;
  let visible=events;
  const apply=()=>{visible=filterActivity(events,{query:root.querySelector('#ops-search').value,outcome:root.querySelector('#ops-result').value});root.querySelector('#ops-count').textContent=`${visible.length} of ${events.length} most recent mutations`;root.querySelector('#ops-rows').innerHTML=visible.map(e=>`<tr><td>${esc(e.created_at)}</td><td>${esc(e.actor_role)} <span class="ops-code">${esc(e.actor_id?.slice(0,8)||'root')}</span></td><td><span class="ops-code">${esc(e.method)} ${esc(e.path)}</span></td><td class="${e.status>=400?'ops-fail':''}">${e.status}</td><td>${e.duration_ms}ms</td><td class="ops-code" title="${esc(e.id)}">${esc(e.id.slice(0,12))}</td></tr>`).join('')||'<tr><td colspan="6">No events matching these filters.</td></tr>'};
  root.querySelector('#ops-search').addEventListener('input',apply);root.querySelector('#ops-result').addEventListener('change',apply);
  root.querySelector('#ops-refresh').onclick=()=>renderOperations({root,api,esc,success,error});
  root.querySelector('#ops-export').onclick=()=>{if(!visible.length){error('No activity rows to export');return;}const blob=new Blob([JSON.stringify(visible,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='api-activity-recent.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);success(`Exported ${visible.length} loaded activity rows`)};
  apply();
 }catch(e){root.innerHTML='<div class="empty">Operational journal unavailable. Authenticate using the root administrator credential.</div>';error(e)}
}

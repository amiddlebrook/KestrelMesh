// KestrelMesh: domain-specific record exploration over the authenticated page of records.
export const presets=[{"id": "all", "label": "ALL"}, {"id": "open", "label": "OPEN / FAILED"}, {"id": "recovering", "label": "HALF-OPEN"}, {"id": "healthy", "label": "CLOSED / READY"}];
export function filtersMarkup(total){
 return `<section class="enterprise-explorer km-explorer" aria-label="Endpoint register"><div class="enterprise-explorer-copy"><span class="enterprise-explorer-overline">CONTROL PLANE / ACTIVE FILTERS</span><strong class="enterprise-explorer-label">Endpoint register</strong><small id="enterprise-record-count" aria-live="polite">${total} loaded records</small></div><div class="enterprise-explorer-controls"><label>Search records<input id="filter" class="search" type="search" placeholder="grep model, provider, route, circuit…" autocomplete="off" /></label><label>View<select id="enterprise-preset">${presets.map(p=>`<option value="${p.id}">${p.label}</option>`).join('')}</select></label><label>Order<select id="enterprise-order"><option value="newest">Most recent</option><option value="oldest">Oldest first</option><option value="az">Title A → Z</option></select></label><button id="enterprise-export" type="button" class="btn secondary">Export visible JSON</button></div></section>`;
}
export function refineRecords(rows,{query='',preset='all',order='newest'}={}){
 const q=String(query).trim().toLocaleLowerCase();
 const matched=rows.filter(r=>{if(q&&!JSON.stringify(r).toLocaleLowerCase().includes(q))return false;
 const s=String(r.status||r.state||r.circuit_state||'').toLowerCase();return preset==='open'?/open|fail|error|trip/.test(s)&&!/half.?open/.test(s):preset==='recovering'?/half.?open|recover|probe/.test(s):preset==='healthy'?/clos|healthy|ready|active|enabled/.test(s):true;
 });
 const title=r=>String(r.name||r.title||r.workflow||r.model||r.experiment||r.id||'');
 const date=r=>Date.parse(r.created_at||r.updated_at||'')||0;
 return matched.sort((a,b)=>order==='az'?title(a).localeCompare(title(b)):order==='oldest'?date(a)-date(b):date(b)-date(a));
}

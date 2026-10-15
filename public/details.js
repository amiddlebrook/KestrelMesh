// KestrelMesh — domain-specific record investigation, preserving the complete API payload.
const fields=["id", "name", "provider", "model", "status", "latency_ms", "success_rate", "error_rate", "created_at"];
const label="Inference endpoint diagnostic";
const category="NETWORK / PROVIDER PROFILE";
const context="Inference latency and circuit state are observational. Sample sizes and request conditions must be reviewed before operational decisions.";
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readable=x=>typeof x==='object'&&x!==null?JSON.stringify(x,null,2):String(x??'—');
export function renderDetails(record){
 if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Expected a record object');
 const keys=Object.keys(record);
 const featured=fields.filter(key=>record[key]!==null&&record[key]!==undefined&&record[key]!=='');
 const other=keys.filter(key=>!featured.includes(key));
 const pairs=featured.map((key,i)=>`<div class="enterprise-detail-field"><dt>${safe(key.replace(/_/g,' '))}</dt><dd>${safe(readable(record[key]))}</dd></div>`).join('');
 const rest=other.length?`<div class="enterprise-detail-remaining"><h5>Additional fields <span>${other.length}</span></h5><dl>${other.map(key=>`<div><dt>${safe(key.replace(/_/g,' '))}</dt><dd>${safe(readable(record[key]))}</dd></div>`).join('')}</dl></div>`:'';
 return `<section class="enterprise-dossier" aria-label="${safe(label)}"><div class="enterprise-dossier-heading"><div><span class="enterprise-dossier-tag">${safe(category)}</span><h3>${safe(label)}</h3><p>${safe(context)}</p></div><button type="button" class="btn secondary" data-close-details>Close inspection ×</button></div><dl class="enterprise-detail-grid">${pairs||'<p class="muted">No standard fields in this record.</p>'}</dl>${rest}<details class="enterprise-detail-raw"><summary>Original API payload · ${keys.length} fields</summary><pre>${safe(JSON.stringify(record,null,2))}</pre></details><div class="enterprise-dossier-footer"><span>Read-only investigation · Original data preserved</span><button type="button" class="btn secondary" data-copy-record>Copy JSON</button></div></section>`;
}

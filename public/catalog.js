const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=x=>typeof x==='object'&&x!==null?JSON.stringify(x):String(x??'');
const label=x=>String(x).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const asCSV=x=>{const val=text(x).replace(/^[\s\u0000-\u001f]*([=+@-])/,'\'$&');return '"'+val.replace(/"/g,'""')+'"'};
export function catalogCsv(rows){const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return '\ufeff'+[keys.map(asCSV).join(','),...rows.map(r=>keys.map(k=>asCSV(r[k])).join(','))].join('\r\n')+'\r\n'}
export function catalogQuery(collection,options={}){const s=new URLSearchParams();s.set('size',String(options.size??20));if(options.q)s.set('q',options.q);if(options.facet)s.set('facet',options.facet);if(options.cursor)s.set('cursor',options.cursor);return '/api/catalog/'+encodeURIComponent(collection)+'?'+s.toString()}
export const escapeCatalogText=html;
const themes={
 RivetFlow:{mark:'◈',head:'Execution Ledger',slug:'PROCESS GOVERNANCE',sub:'Traverse operational evidence without losing the audit trail.',detail:'WORKSTREAMS / APPROVALS / EXECUTIONS'},
 SignalBench:{mark:'✺',head:'Evaluation Spectrum',slug:'MODEL QUALITY INTELLIGENCE',sub:'Surface the signals behind release readiness.',detail:'TEST SUITES / GATE VERDICTS / RUNS'},
 ProofAtlas:{mark:'⌑',head:'Evidence Reading Room',slug:'SOURCE-GROUNDED INTELLIGENCE',sub:'Navigate provenance and assertions without fabricated conclusions.',detail:'DOCUMENTS / CLAIMS / INVESTIGATIONS'},
 KestrelMesh:{mark:'⟡',head:'Fleet Telemetry Deck',slug:'EDGE INFERENCE OPERATIONS',sub:'Explore model routing, trace outcomes, and breaker transitions.',detail:'MODELS / REQUESTS / CIRCUIT STATES'},
 GradientFoundry:{mark:'✳',head:'Research Registry',slug:'EXPERIMENT INTELLIGENCE',sub:'Follow every measured result back to its dataset.',detail:'DATASETS / EXPERIMENTS / REGISTRATIONS'}
};
function download(content,name,mime){const blob=new Blob([content],{type:mime}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)}
export async function renderCatalog({root,api,esc=html,product,report=()=>{}}){
 const theme=themes[product]||themes.RivetFlow;
 let sets=[],collection='',query='',facet='',size=20,stack=[],cursor='',response=null,serial=0,loadError='',pending=false,lastLoaded=null;
 root.innerHTML=`<section class="cat-explorer cat-${html(product.toLowerCase())}" aria-label="Server-backed records explorer"><header class="cat-hero"><div class="cat-orbit" aria-hidden="true"><i></i><i></i><i></i><span>${theme.mark}</span></div><div class="cat-hero-copy"><span class="cat-overline">${html(theme.slug)} / 2026.10</span><h2>${html(theme.head)}</h2><p>${html(theme.sub)}</p><span class="cat-subline">${html(theme.detail)}</span></div><aside class="cat-live"><span class="cat-online-dot"></span> QUERYING REAL D1 <small>Authenticated · read only</small></aside></header><div class="cat-main"><div class="cat-controls"><div class="cat-group"><label for="cat-collection">01 / Data collection</label><select id="cat-collection"></select></div><div class="cat-group cat-search"><label for="cat-search">02 / Search server-side</label><input id="cat-search" type="search" maxlength="100" autocomplete="off" placeholder="Search exact source values…"/></div><div class="cat-group"><label for="cat-facet">03 / State filter</label><select id="cat-facet"><option value="">All statuses</option></select></div><div class="cat-group cat-size"><label for="cat-size">Page size</label><select id="cat-size"><option>10</option><option selected>20</option><option>50</option></select></div></div><div class="cat-metrics" id="cat-metrics" aria-live="polite"><div class="cat-metric"><b>—</b><span>Matching database records</span></div></div><div class="cat-bar"><div><span class="cat-pulse"></span><b id="cat-bar-title">Records</b><small id="cat-bar-note">Waiting for query</small></div><div class="cat-actions"><button type="button" id="cat-reload">↻ Refresh</button><button type="button" id="cat-export">↓ Export visible page</button></div></div><div id="cat-table" class="cat-stage" aria-live="polite"></div><nav id="cat-pager" class="cat-pager" aria-label="Cursor-based pagination"></nav></div><footer class="cat-foot">Live source records only · Query is enforced by Cloudflare D1 · Exports contain only the visible page · No synthetic metrics</footer></section>`;
 const scope=root.querySelector('.cat-explorer'),choice=scope.querySelector('#cat-collection'),search=scope.querySelector('#cat-search'),filter=scope.querySelector('#cat-facet'),per=scope.querySelector('#cat-size'),out=scope.querySelector('#cat-table'),stats=scope.querySelector('#cat-metrics'),pager=scope.querySelector('#cat-pager');
 function busy(){pending=true;out.innerHTML='<div class="cat-empty"><span class="cat-spinner" aria-hidden="true"></span><b>Querying authorized records…</b><p>Fetching the next window directly from D1.</p></div>'}
 function reset(){stack=[];cursor=''}
 function show(){
  if(!response)return;
  const rows=response.items||[],total=Number(response.total||0);
  scope.querySelector('#cat-bar-title').textContent=response.label||label(collection);
  scope.querySelector('#cat-bar-note').textContent=`Updated ${new Date(response.counted_at).toLocaleTimeString()} · sorted newest first`;
  stats.innerHTML=`<div class="cat-metric"><strong>${total.toLocaleString()}</strong><span>Database matches</span></div><div class="cat-metric"><strong>${rows.length}</strong><span>Records in this page</span></div><div class="cat-metric"><strong>${stack.length+1}</strong><span>Cursor window</span></div><div class="cat-metric cat-metric-verified"><strong>● Live</strong><span>D1 query · no local slice</span></div>`;
  const prior=filter.value;filter.innerHTML='<option value="">All statuses</option>'+(response.facets||[]).map(i=>`<option value="${html(i.state)}">${html(label(i.state))} (${Number(i.n).toLocaleString()})</option>`).join('');filter.value=prior;
  const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  if(!rows.length){out.innerHTML=`<div class="cat-empty"><b>No matching records</b><p>${html(total?'This window is empty. Try a previous window.':'Clear the search or choose another collection.')}</p></div>`}
  else out.innerHTML=`<div class="cat-scroller" tabindex="0" aria-label="Scrollable source table"><table class="cat-table"><thead><tr><th scope="col">#</th>${columns.map(c=>`<th scope="col">${html(label(c))}</th>`).join('')}<th scope="col">Inspect</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="cat-index">${String(i+1).padStart(2,'0')}</td>${columns.map(c=>`<td title="${html(text(r[c]).slice(0,250))}">${typeof r[c]==='number'?`<span class="cat-number">${html(r[c])}</span>`:c==='status'||c==='stage'||c==='enabled'||c==='outcome'?`<span class="cat-state">${html(text(r[c]))}</span>`:`<span>${html(text(r[c]).slice(0,160))}</span>`}</td>`).join('')}<td><button class="cat-inspect" type="button" data-cat-inspect="${i}" aria-label="Inspect row ${i+1}">Inspect ↗</button></td></tr>`).join('')}</tbody></table></div>`;
  const next=!!response.next_cursor;
  pager.innerHTML=`<p>Showing ${rows.length} records on window ${stack.length+1}. <b>${total.toLocaleString()}</b> match the active filters.</p><div><button type="button" data-cat-prev ${!stack.length||pending?'disabled':''}>← Previous</button><button type="button" data-cat-next ${!next||pending?'disabled':''}>Next window →</button></div>`;
  scope.querySelector('#cat-export').disabled=!rows.length;
 }
 async function load(){const current=++serial;busy();loadError='';try{
  const data=await api(catalogQuery(collection,{q:query,facet,size,cursor}));if(current!==serial||!scope.isConnected)return;
  response=data;pending=false;lastLoaded=new Date();show();
 }catch(e){if(current!==serial||!scope.isConnected)return;pending=false;loadError=String(e?.message||e);out.innerHTML=`<div class="cat-empty cat-error"><b>Query unavailable</b><p>${html(loadError)}</p><button type="button" data-cat-retry>Retry query</button></div>`;pager.replaceChildren();}}
 let debounce;
 function trigger(){reset();clearTimeout(debounce);debounce=setTimeout(load,280)}
 try{const info=await api('/api/catalog');if(!scope.isConnected)return;sets=info.collections||[];if(!sets.length)throw Error('No allowlisted collections are available');choice.innerHTML=sets.map(s=>`<option value="${html(s.id)}">${html(s.label)}</option>`).join('');collection=sets[0].id;await load()}
 catch(e){out.innerHTML=`<div class="cat-empty cat-error"><b>Unable to initialize</b><p>${html(e?.message||e)}</p></div>`;return;}
 choice.addEventListener('change',()=>{collection=choice.value;search.value='';filter.value='';query='';facet='';reset();load()});
 search.addEventListener('input',()=>{query=search.value.trim();trigger()});
 filter.addEventListener('change',()=>{facet=filter.value;reset();load()});
 per.addEventListener('change',()=>{size=Number(per.value);reset();load()});
 scope.addEventListener('click',async e=>{
  const btn=e.target.closest('button');if(!btn||!scope.contains(btn))return;
  if(btn.id==='cat-reload'||btn.hasAttribute('data-cat-retry')){await load();return}
  if(btn.hasAttribute('data-cat-prev')&&stack.length&&!pending){cursor=stack.pop();await load();return}
  if(btn.hasAttribute('data-cat-next')&&response?.next_cursor&&!pending){stack.push(cursor);cursor=response.next_cursor;await load();return}
  if(btn.id==='cat-export'&&response?.items?.length){download(catalogCsv(response.items),`${product.toLowerCase()}-${collection}-page-${stack.length+1}.csv`,'text/csv;charset=utf-8');report(`Exported ${response.items.length} current-page records. Treat CSV as private data.`);return}
  if(btn.hasAttribute('data-cat-inspect')){
   const row=response?.items?.[Number(btn.dataset.catInspect)];if(!row)return;
   const d=document.createElement('dialog');d.className='cat-dialog';d.setAttribute('aria-label','Catalog record inspector');d.innerHTML=`<div class="cat-dialog-head"><span>RECORD EVIDENCE / ${html(product.toUpperCase())}</span><button type="button" data-cat-close>Close ×</button></div><h2>${html(row.name||row.title||row.id||'Record')}</h2><p>Values returned by the authorized server query. No enrichment or inference.</p><dl>${Object.entries(row).map(([k,v])=>`<div><dt>${html(label(k))}</dt><dd>${html(text(v))}</dd></div>`).join('')}</dl><button type="button" data-cat-copy>Copy record JSON</button>`;
   document.body.append(d);d.querySelector('[data-cat-close]').onclick=()=>d.close();d.querySelector('[data-cat-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(row,null,2));report('Record copied to clipboard')}catch{report('Clipboard access unavailable')}};d.addEventListener('close',()=>{d.remove();btn.focus()},{once:true});d.showModal();
  }
 });
}

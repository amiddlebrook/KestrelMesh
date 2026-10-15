/** Phase 11 — authenticated record workbench, using only loaded real API data. */
const profiles={
 RivetFlow:{title:'Process radar',sub:'Live workflow state / loaded register',variant:'assembly',record:'Execution',graph:'PROCESS STATE'},
 SignalBench:{title:'Evaluation spectrum',sub:'Run quality / model evaluation register',variant:'spectrum',record:'Evaluation',graph:'EVALUATION STATES'},
 ProofAtlas:{title:'Evidence index',sub:'Source and claim trace / loaded register',variant:'archive',record:'Source',graph:'EVIDENCE REGISTER'},
 KestrelMesh:{title:'Mesh observatory',sub:'Gateway and model control / loaded register',variant:'mesh',record:'Node',graph:'ROUTING STATES'},
 GradientFoundry:{title:'Experiment journal',sub:'Lineage and release history / loaded register',variant:'lineage',record:'Artifact',graph:'LIFECYCLE STATES'}
};
const clean = value => String(value ?? '');
const statusOf = row => clean(row.status ?? row.state ?? row.severity ?? row.verdict ?? row.result?.status ?? 'unclassified').trim().toLowerCase() || 'unclassified';
const label = v => clean(v).replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
const rowTitle = (row,i) => clean(row.name ?? row.title ?? row.workflow ?? row.model ?? row.experiment ?? row.message ?? row.document ?? row.id ?? `Record ${i+1}`);
const safeKey = (row,i) => row?.id!==null && row?.id!==undefined ? `id:${clean(row.id)}` : `position:${i}`;
const stringify = val => val===undefined||val===null?'—':typeof val==='object'?JSON.stringify(val):String(val);
const safeCell = (val,esc) => esc(stringify(val).slice(0,240));
const validMode = mode => ['cards','table','timeline'].includes(mode);
const size=12;

export function summarizeRecords(rows){
 const groups=new Map();
 for(const row of rows){const s=statusOf(row);groups.set(s,(groups.get(s)||0)+1)}
 return [...groups.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>({name,count}));
}
export function csvOf(rows,columns){
 const protect=v=>{let s=stringify(v);if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 return '\ufeff'+[columns.map(protect).join(','),...rows.map(row=>columns.map(k=>protect(row[k])).join(','))].join('\r\n');
}
export function createRecordWorkbench({host,app,spec,esc,onInspect,onAction,report}){
 const profile=profiles[app.name]||profiles.RivetFlow;
 let mode='cards',page=0,facet='all',rows=[],display=[],shown=[],selected=new Map(),loadedCount=0;
 try{const persisted=localStorage.getItem(`portfolio-lens:${app.name}:${spec.id}`);if(validMode(persisted))mode=persisted}catch{}
 const columns=spec.columns||[];
 const exportData=(data,name,type)=>{
  const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${app.name.toLowerCase()}-${spec.id}-${name}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 const keyOf=row=>safeKey(row,rows.indexOf(row));
 const maybeSelected=(row,index)=>selected.has(keyOf(row));
 const subFields=(row)=>columns.slice(0,3).map(k=>`<span><b>${esc(label(k))}</b>${safeCell(row[k],esc)}</span>`).join('');
 const card=(row,index)=>{
  const s=statusOf(row),key=keyOf(row),sel=selected.has(key);
  return `<article class="lens-item lens-card" data-tone="${esc(s)}"><div class="lens-item-top"><span class="lens-id">${esc(profile.record)} / ${String(index+1).padStart(3,'0')}</span><label class="lens-select-label"><input type="checkbox" data-lens-select="${index}" ${sel?'checked':''} aria-label="Select ${esc(rowTitle(row,index))}"/> Select</label></div><span class="lens-status">${esc(label(s))}</span><h4>${esc(rowTitle(row,index))}</h4><div class="lens-card-fields">${subFields(row)}</div><div class="lens-card-actions"><button type="button" data-lens-inspect="${index}" class="lens-link">Inspect ↗</button>${spec.action?`<button type="button" class="btn small" data-lens-action="${index}">${esc(spec.action.title||'Run action')}</button>`:''}</div></article>`;
 };
 const table=(viewRows)=>`<div class="lens-table-scroll"><table class="lens-table"><thead><tr><th><span class="lens-sr">Select</span></th>${columns.map(k=>`<th scope="col">${esc(label(k))}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${viewRows.map(({row,index})=>`<tr><td><input type="checkbox" data-lens-select="${index}" ${maybeSelected(row,index)?'checked':''} aria-label="Select ${esc(rowTitle(row,index))}"/></td>${columns.map(c=>`<td>${safeCell(row[c],esc)}</td>`).join('')}<td class="lens-table-actions"><button type="button" data-lens-inspect="${index}" class="lens-link">Inspect</button>${spec.action?`<button type="button" data-lens-action="${index}" class="lens-link">Act</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
 const timeline=(viewRows)=>`<ol class="lens-timeline">${viewRows.map(({row,index})=>`<li class="lens-timeline-item"><span class="lens-timeline-pin" aria-hidden="true"></span><div class="lens-timeline-time">${esc(clean(row.created_at??row.updated_at??'No timestamp'))}</div><div class="lens-timeline-data"><div class="lens-timeline-head"><strong>${esc(rowTitle(row,index))}</strong><span class="lens-status">${esc(label(statusOf(row)))}</span></div><p>${esc(columns.slice(0,2).map(k=>`${label(k)}: ${stringify(row[k]).slice(0,100)}`).join('  ·  '))}</p><div class="lens-timeline-controls"><label><input type="checkbox" data-lens-select="${index}" ${maybeSelected(row,index)?'checked':''}/> Select</label><button type="button" data-lens-inspect="${index}" class="lens-link">Inspect ↗</button>${spec.action?`<button type="button" data-lens-action="${index}" class="lens-link">${esc(spec.action.title||'Act')}</button>`:''}</div></div></li>`).join('')}</ol>`;
 const stageGraph=(base,facets)=>{
  const total=base.length;
  const bands=facets.slice(0,8);
  return `<div class="lens-graph" aria-label="${esc(profile.graph)}"><div class="lens-graph-heading"><span>${esc(profile.graph)}</span><small>${total} loaded matching records · not aggregate historical telemetry</small></div><div class="lens-bars">${bands.length?bands.map((item,i)=>`<button type="button" data-lens-facet="${esc(item.name)}" aria-pressed="${facet===item.name}" class="lens-band${facet===item.name?' is-active':''}" style="--band:${Math.max(5,Math.round(100*item.count/Math.max(1,total)))}%;--index:${i}"><span class="lens-band-bar"></span><span class="lens-band-label">${esc(label(item.name))}</span><b>${item.count}</b></button>`).join(''):'<span class="lens-zero">No state information in this result set.</span>'}</div></div>`;
 };
 const render=(nextRows,loaded)=>{
  rows=nextRows;if(Number.isFinite(loaded))loadedCount=loaded;
  const existing=new Set(rows.map((r,i)=>safeKey(r,i)));for(const k of selected.keys())if(!existing.has(k))selected.delete(k);
  const facets=summarizeRecords(rows);
  if(facet!=='all'&&!facets.some(x=>x.name===facet))facet='all';
  display=facet==='all'?rows:rows.filter(r=>statusOf(r)===facet);
  const totalPages=Math.max(1,Math.ceil(display.length/size));page=Math.min(page,totalPages-1);
  const start=page*size;
  shown=display.slice(start,start+size).map((row,i)=>({row,index:start+i}));
  const views=['cards','table','timeline'].map(id=>`<button type="button" data-lens-mode="${id}" aria-pressed="${mode===id}" class="lens-mode${mode===id?' active':''}">${{cards:'◫ Cards',table:'☷ Data grid',timeline:'◇ Timeline'}[id]}</button>`).join('');
  host.innerHTML=`<section class="lens-workbench lens-${profile.variant}" aria-label="${esc(profile.title)}"><div class="lens-mast"><div><span class="lens-kicker">${esc(app.name.toUpperCase())} / INTELLIGENCE SURFACE</span><h3>${esc(profile.title)}</h3><p>${esc(profile.sub)}. Real data from the current authorized API response.</p></div><div class="lens-counter"><strong>${display.length}</strong><span>VISIBLE / ${loadedCount} LOADED</span></div></div>${stageGraph(rows,facets)}<div class="lens-controlbar"><div class="lens-modes" role="group" aria-label="Record layout">${views}</div><div class="lens-controls"><button class="lens-tool" type="button" data-lens-reset ${facet==='all'?'disabled':''}>Clear status</button><button class="lens-tool" type="button" data-lens-csv ${display.length?'':'disabled'}>↓ Export CSV</button><button class="lens-tool lens-compare" type="button" data-lens-compare ${selected.size>=2?'':'disabled'}>Compare ${selected.size?selected.size+' selected':''}</button></div></div><div class="lens-result" aria-live="polite">${display.length?mode==='table'?table(shown):mode==='timeline'?timeline(shown):`<div class="lens-cards">${shown.map(x=>card(x.row,x.index)).join('')}</div>`:'<div class="lens-no-matches">No loaded records match this view. Clear the status filter or adjust the search above.</div>'}</div><footer class="lens-pagination"><span>${display.length?`${start+1}–${Math.min(start+size,display.length)} of ${display.length}`:'0 records'} · Showing only records returned by this API call</span><div><button class="lens-tool" type="button" data-lens-prev ${page===0?'disabled':''}>← Previous</button><span>Page ${page+1} / ${totalPages}</span><button class="lens-tool" type="button" data-lens-next ${page>=totalPages-1?'disabled':''}>Next →</button></div></footer></section>`;
  return display.length;
 };
 const compare=()=>{
  const all=[...selected.values()].slice(0,3);if(all.length<2){report('Select at least two records to compare');return}
  const cols=[...new Set([...columns,...all.flatMap(row=>Object.keys(row))])].slice(0,24);
  const d=document.createElement('dialog');d.className='lens-dialog';d.setAttribute('aria-label','Compare selected records');
  d.innerHTML=`<div class="lens-dialog-shell"><div class="lens-dialog-head"><div><small>RECORD DIFF / ${esc(app.name.toUpperCase())}</small><h2>Side-by-side comparison</h2><p>Actual values for up to three selected records. No inferred changes.</p></div><button type="button" class="lens-tool" data-lens-close>Close ×</button></div><div class="lens-table-scroll"><table class="lens-table"><thead><tr><th>Property</th>${all.map((row,i)=>`<th>${esc(rowTitle(row,i))}</th>`).join('')}</tr></thead><tbody>${cols.map(col=>`<tr><th scope="row">${esc(label(col))}</th>${all.map(r=>`<td>${safeCell(r[col],esc)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  d.querySelector('[data-lens-close]').addEventListener('click',()=>d.close());d.addEventListener('close',()=>d.remove(),{once:true});document.body.appendChild(d);d.showModal();
 };
 host.addEventListener('click',event=>{
  const btn=event.target.closest('button[data-lens-mode],button[data-lens-facet],button[data-lens-reset],button[data-lens-csv],button[data-lens-compare],button[data-lens-prev],button[data-lens-next],button[data-lens-inspect],button[data-lens-action]');if(!btn||!host.contains(btn))return;
  if(btn.dataset.lensMode){mode=btn.dataset.lensMode;try{localStorage.setItem(`portfolio-lens:${app.name}:${spec.id}`,mode)}catch{}render(rows);host.querySelector(`[data-lens-mode=\"${mode}\"]`)?.focus();return}
  if(btn.hasAttribute('data-lens-facet')){const clicked=btn.dataset.lensFacet;facet=facet===clicked?'all':clicked;page=0;render(rows);[...host.querySelectorAll('[data-lens-facet]')].find(b=>b.dataset.lensFacet===clicked)?.focus();return}
  if(btn.hasAttribute('data-lens-reset')){facet='all';page=0;render(rows);host.querySelector('[data-lens-reset]')?.focus();return}
  if(btn.hasAttribute('data-lens-csv')){exportData(csvOf(display,columns.length?columns:Object.keys(display[0]||{})),`${mode}-visible.csv`,'text/csv;charset=utf-8');report(`Exported ${display.length} currently loaded records; handle this file as private data.`);return}
  if(btn.hasAttribute('data-lens-compare')){compare();return}
  if(btn.hasAttribute('data-lens-prev')){page=Math.max(0,page-1);render(rows);host.querySelector('[data-lens-prev]')?.focus();return}
  if(btn.hasAttribute('data-lens-next')){page++;render(rows);host.querySelector('[data-lens-next]')?.focus();return}
  if(btn.hasAttribute('data-lens-inspect')){const row=display[Number(btn.dataset.lensInspect)];if(row)onInspect(row,btn);return}
  if(btn.hasAttribute('data-lens-action')){const row=display[Number(btn.dataset.lensAction)];if(row)onAction(row,btn)}
 });
 host.addEventListener('change',event=>{
  const field=event.target.closest('input[data-lens-select]');if(!field||!host.contains(field))return;
  const index=Number(field.dataset.lensSelect),row=display[index];if(!row)return;const key=keyOf(row);
  if(field.checked)selected.set(key,row);else selected.delete(key);render(rows);host.querySelector(`[data-lens-select=\"${index}\"]`)?.focus();
 });
 return {render, getDisplayedRows:()=>display.slice()};
}

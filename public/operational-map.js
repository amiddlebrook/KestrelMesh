/** Phase 12: deterministic, source-grounded spatial views. No inferred telemetry or synthetic links. */
const text=v=>String(v??'');
const statusOf=r=>text(r.status??r.state??r.severity??r.verdict??r.result?.status??'unclassified').toLowerCase();
const titleOf=(r,i)=>text(r.name??r.title??r.workflow??r.model??r.experiment??r.document??r.id??`Record ${i+1}`).slice(0,110);
const idOf=r=>r.id==null?'':text(r.id);
const present=v=>v!==null&&v!==undefined&&v!=='';
const safeNumber=v=>typeof v==='number'&&Number.isFinite(v);
const label=s=>text(s).replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
const LIMIT=32;
export function numericFields(rows){
 const counts=new Map();for(const r of rows){for(const [k,v] of Object.entries(r||{})){if(k==='id'||k.endsWith('_id')||/(^|_)(year|index|cursor|timestamp)$/.test(k))continue;if(safeNumber(v))counts.set(k,(counts.get(k)||0)+1)}}
 return [...counts].filter(([k,c])=>c>=Math.min(2,rows.length)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([k])=>k).slice(0,12);
}
export function explicitLinks(rows){
 const lookup=new Map(rows.map((r,i)=>[idOf(r),i]).filter(([id])=>id));const edges=[];
 rows.forEach((r,i)=>{for(const [k,v] of Object.entries(r||{})){
  if(k==='id'||!/(?:_id|_ids|^parent|^dependency|^depends_on|^references$|^source_ids$|^target_ids$)/i.test(k))continue;
  const candidates=Array.isArray(v)?v:[v];for(const candidate of candidates){
   if(!present(candidate)||typeof candidate==='object')continue;
   const j=lookup.get(text(candidate));if(j!==undefined&&j!==i)edges.push({from:i,to:j,field:k});
  }
 }});
 return edges.filter((e,i,a)=>a.findIndex(f=>f.from===e.from&&f.to===e.to&&f.field===e.field)===i);
}
export function sceneSummary(rows){
 const states={};for(const r of rows)states[statusOf(r)]=(states[statusOf(r)]||0)+1;
 const timestamps=rows.map(r=>Date.parse(r.created_at??r.updated_at??'')).filter(Number.isFinite);
 return {count:rows.length,states,linked:explicitLinks(rows).length,dated:timestamps.length,metrics:numericFields(rows)};
}
function button(row,index,esc,extra=''){
 return `<button type="button" class="scene-node" data-lens-inspect="${index}" ${extra} aria-label="Inspect ${esc(titleOf(row,index))}"><span class="scene-node-index">${String(index+1).padStart(2,'0')}</span><strong>${esc(titleOf(row,index))}</strong><small>${esc(label(statusOf(row)))}</small></button>`;
}
function head(esc,kicker,title,body,metric){return `<div class="scene-head"><div><div class="scene-eyebrow">${esc(kicker)}</div><h4>${esc(title)}</h4><p>${esc(body)}</p></div><div class="scene-head-metric">${metric}</div></div>`}
function rivet(rows,esc){
 const states=[...new Set(rows.map(statusOf))];const lanes=states.slice(0,6);let count=0;
 return head(esc,'OPERATIONS / FLOW','Process lanes','Execution stages are grouped from the returned records. This is not an editable workflow designer.',`<b>${rows.length}</b><span>records in view</span>`)+`<div class="scene-rail" role="group" aria-label="Workflow states">${lanes.map((state,li)=>{
 const items=rows.map((r,i)=>({r,i})).filter(x=>statusOf(x.r)===state);count+=items.length;
 return `<section class="scene-lane"><header><span class="scene-lane-index">STATE ${String(li+1).padStart(2,'0')}</span><strong>${esc(label(state))}</strong><b>${items.length}</b></header><div class="scene-lane-body">${items.slice(0,8).map(x=>button(x.r,x.i,esc)).join('')}${items.length>8?`<span class="scene-more">+${items.length-8} more in ${esc(label(state))}</span>`:''}</div></section>`;
 }).join('')}</div>${states.length>6?`<p class="scene-qualifier">${states.length-6} additional states are available in the other record layouts.</p>`:''}`;
}
function signal(rows,esc,metric){
 const keys=numericFields(rows);const field=keys.includes(metric)?metric:keys[0];
 const choose=keys.length?`<label class="scene-metric-choice">Measure <select data-scene-metric aria-label="Choose actual numeric metric">${keys.map(k=>`<option value="${esc(k)}" ${k===field?'selected':''}>${esc(label(k))}</option>`).join('')}</select></label>`:'';
 if(!field)return head(esc,'EVALUATION / SPECTRUM','Evaluation field','Visual plots require numeric values returned by the API.',`<b>0</b><span>numeric metrics</span>`)+`<div class="scene-empty">These records have no shared numeric evaluation metric. Use the table or inspect individual runs to see the data that exists.</div>`;
 const points=rows.map((r,i)=>({r,i,val:r[field]})).filter(x=>safeNumber(x.val));
 const min=Math.min(...points.map(x=>x.val)),max=Math.max(...points.map(x=>x.val)),range=max-min||1;
 return head(esc,'EVALUATION / SPECTRUM','Performance field','Each point represents an actual numeric field. Horizontal position follows record order, not time.',`<b>${points.length}</b><span>measured records</span>`)+`<div class="scene-signal-settings">${choose}<span>Observed range ${esc(min)} – ${esc(max)} · ${esc(label(field))}</span></div><div class="scene-plot" role="group" aria-label="${esc(label(field))} metric plot"><div class="scene-gridlines"><span>${esc(max)}</span><span>${esc((min+max)/2)}</span><span>${esc(min)}</span></div>${points.slice(0,LIMIT).map((x,j)=>{const xcoord=5+(j/Math.max(1,Math.min(points.length,LIMIT)-1))*90,ycoord=6+(1-(x.val-min)/range)*87;return `<button type="button" class="scene-datapoint" style="--px:${xcoord.toFixed(3)}%;--py:${ycoord.toFixed(3)}%" data-lens-inspect="${x.i}" aria-label="Inspect ${esc(titleOf(x.r,x.i))}, ${esc(label(field))}: ${esc(x.val)}" title="${esc(titleOf(x.r,x.i))}: ${esc(x.val)}"><span class="scene-point-core"></span></button>`}).join('')}</div><div class="scene-plot-footer"><span>EARLIER IN RETURNED DATA</span><span>LATER IN RETURNED DATA</span></div>`;
}
function geometry(rows){return rows.map((r,i)=>{const theta=(i*137.507764)*Math.PI/180;const rad=Math.min(.42,.12+Math.sqrt((i+1)/Math.max(1,rows.length))*.31);return {x:50+Math.cos(theta)*rad*100,y:50+Math.sin(theta)*rad*100}})}
function nodesNetwork(rows,esc,kind){
 const items=rows.slice(0,LIMIT),links=explicitLinks(items),places=geometry(items);
 const sig=kind==='proof';const noun=sig?'Evidence network':'Routing topology';const sub=sig?'Only explicit identifier references within returned records are connected. Unlinked sources remain visible.':'Links appear only where returned records explicitly reference another returned record ID; position does not imply network health.';
 return head(esc,sig?'EVIDENCE / RELATIONSHIPS':'MESH / TOPOLOGY',noun,sub,`<b>${links.length}</b><span>explicit links</span>`)+`<div class="scene-network" role="group" aria-label="${esc(noun)}"><svg class="scene-edges" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">${links.map(e=>`<line x1="${(places[e.from].x*10).toFixed(1)}" y1="${(places[e.from].y*6.4).toFixed(1)}" x2="${(places[e.to].x*10).toFixed(1)}" y2="${(places[e.to].y*6.4).toFixed(1)}"/>`).join('')}</svg>${items.map((row,i)=>`<button type="button" class="scene-orbit-node" style="--nx:${places[i].x.toFixed(2)}%;--ny:${places[i].y.toFixed(2)}%" data-lens-inspect="${i}" title="${esc(titleOf(row,i))}" aria-label="Inspect ${esc(titleOf(row,i))}"><span>${esc(titleOf(row,i).slice(0,24))}</span><i>${esc(label(statusOf(row)))}</i></button>`).join('')}</div><div class="scene-network-note"><span>● ${items.length} visible nodes</span><span>↗ ${links.length} verified record references</span><span>↳ Select nodes to inspect their source data</span>${rows.length>LIMIT?`<span>Only the first ${LIMIT} records shown</span>`:''}</div>`;
}
function gradient(rows,esc){
 const dated=rows.map((r,i)=>({r,i,ms:Date.parse(r.created_at??r.updated_at??'')})).filter(x=>Number.isFinite(x.ms)).sort((a,b)=>a.ms-b.ms);
 return head(esc,'MODEL / LINEAGE','Experiment chronology','Chronological placement reflects returned timestamps. It does not imply a parent-child relationship.',`<b>${dated.length}</b><span>dated records</span>`)+(dated.length?`<div class="scene-chronology">${dated.slice(0,LIMIT).map((x,j)=>`<div class="scene-chronicle"><div class="scene-chronicle-marker"><span>${String(j+1).padStart(2,'0')}</span></div><div class="scene-chronicle-data"><time datetime="${new Date(x.ms).toISOString()}">${esc(new Date(x.ms).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}))} UTC</time>${button(x.r,x.i,esc)}</div></div>`).join('')}</div>`:'<div class="scene-empty">No parseable creation or update timestamps in the loaded data; chronology cannot be plotted. Inspect records for available fields.</div>');
}
export function renderOperationalMap({appName,rows,escape:esc,metric}){
 const data=Array.isArray(rows)?rows:[];
 const profile={RivetFlow:'flow',SignalBench:'spectrum',ProofAtlas:'evidence',KestrelMesh:'routing',GradientFoundry:'chronology'}[appName]||'flow';
 const content=!data.length?'<div class="scene-empty">No returned records match the current filters. Adjust the workbench query to build this view.</div>':profile==='flow'?rivet(data,esc):profile==='spectrum'?signal(data,esc,metric):profile==='evidence'?nodesNetwork(data,esc,'proof'):profile==='routing'?nodesNetwork(data,esc,'mesh'):gradient(data,esc);
 return `<div class="scene-surface scene-${profile}">${content}<footer class="scene-source-note">SOURCE: currently authorized and filtered API response · Not a full-database aggregate · No synthetic data</footer></div>`;
}

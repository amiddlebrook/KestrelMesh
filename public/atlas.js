/** Phase 12 — record-derived, cross-entity live topology. No invented records or links. */
import profile from './atlas-profile.js';

const kinds=profile.layers.map(([key,endpoint,title],i)=>({key,endpoint,title,index:i}));
const asText=v=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
const normalize=v=>asText(v).trim().toLowerCase();
const titleOf=(row,kind,i)=>asText(row.name??row.title??row.assertion??row.workflow??row.model??row.experiment??row.message??row.value??row.id??`${kind.title} ${i+1}`);
const statusOf=row=>asText(row.status??row.effective_state??row.stage??row.severity??row.verdict??(row.enabled===false?'disabled':null)??'recorded');
const normalizeRefs=value=>{
 if(value===null||value===undefined)return [];
 if(Array.isArray(value))return value.flatMap(normalizeRefs);
 if(typeof value==='object')return [value.id,value.name,value.title,value.value].filter(x=>x!==undefined).flatMap(normalizeRefs);
 if(typeof value==='string'&&value.startsWith('[')){
  try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return normalizeRefs(parsed)}catch{}
 }
 return [normalize(value)].filter(Boolean);
};
const stampOf=row=>asText(row.created_at??row.updated_at??row.timestamp??row.started_at??'');
export const escapeGraphText=value=>asText(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Resolve only relationships actually encoded in API payloads. */
export function buildAtlasGraph(payloads,productProfile=profile,{cap=20}={}){
 const layers=productProfile.layers||[],nodes=[],links=[],truncated=[];
 for(let layer=0;layer<layers.length;layer++){
  const [kind,endpoint,title]=layers[layer];
  const rows=Array.isArray(payloads?.[kind])?payloads[kind]:[];
  const slice=rows.slice(0,Math.max(0,Math.min(40,cap)));
  if(rows.length>slice.length)truncated.push(`${title}: ${rows.length-slice.length} not drawn`);
  slice.forEach((row,i)=>{
   if(!row||typeof row!=='object'||Array.isArray(row))return;
   const key=`${kind}:${asText(row.id??i)}`;
   nodes.push({key,kind,layer,section:kind,title:titleOf(row,{title},i),status:statusOf(row),timestamp:stampOf(row),record:row});
  });
 }
 const byKind=new Map(layers.map(([name])=>[name,nodes.filter(n=>n.kind===name)]));
 const seen=new Set();
 for(const [fromKind,toKind,fields,identifiers] of productProfile.links||[]){
  for(const source of byKind.get(fromKind)||[]){
   const references=[...new Set(fields.flatMap(field=>normalizeRefs(source.record[field])))];
   if(!references.length)continue;
   for(const ref of references){
    const matches=(byKind.get(toKind)||[]).filter(target=>{
     const aliases=new Set(identifiers.flatMap(field=>normalizeRefs(target.record[field])));
     if(identifiers.includes('id'))aliases.add(normalize(target.record.id));
     return aliases.has(ref);
    });
    // Ambiguous name-only matches are not defensible links; leave them unconnected.
    if(matches.length!==1)continue;
    const target=matches[0];const id=[source.key,target.key].sort().join('|');
    if(seen.has(id))continue;
    seen.add(id);links.push({from:source.key,to:target.key});
   }
  }
 }
 return {nodes,links,layers:layers.map(([key,,title])=>({key,title,count:nodes.filter(n=>n.kind===key).length})),truncated};
}

/** Five distinct deterministic layouts. No randomized simulation or graph force dependencies. */
export function positionAtlas(graph,layout=profile.layout){
 const {nodes}=graph;
 const grouped=[0,1,2,3].map(i=>nodes.filter(n=>n.layer===i));
 const positions=new Map();
 let width=1010,height=680;
 if(layout==='lanes'||layout==='lineage'){
  const most=Math.max(1,...grouped.map(g=>g.length));
  height=Math.max(660,most*64+145);
  grouped.forEach((set,j)=>set.forEach((node,i)=>positions.set(node.key,{x:130+j*245,y:115+i*64})));
 }else if(layout==='clusters'){
  const rows=Math.max(1,...grouped.map(g=>Math.ceil(g.length/2)));
  height=Math.max(730,rows*65+255);
  grouped.forEach((set,j)=>set.forEach((node,i)=>positions.set(node.key,{x:165+(j%2)*530+(i%2)*178,y:120+Math.floor(j/2)*(Math.max(280,Math.ceil(rows/2)*63+155))+Math.floor(i/2)*63})));
  const last=[...positions.values()].reduce((a,p)=>Math.max(a,p.y),0);height=Math.max(height,last+115);
 }else if(layout==='radial'){
  width=1090;
  const rings=[150,265,365,465];height=1040;
  grouped.forEach((set,j)=>set.forEach((node,i)=>{
   const angle=(i/Math.max(1,set.length))*Math.PI*2-(Math.PI/2)+(j%2?0.2:0);
   positions.set(node.key,{x:width/2+Math.cos(angle)*rings[j],y:height/2+Math.sin(angle)*rings[j]});
  }));
 }else if(layout==='mesh'){
  width=1120;height=1080;
  const radii=[130,260,365,467];
  grouped.forEach((set,j)=>set.forEach((node,i)=>{
   const angle=(i/Math.max(1,set.length))*Math.PI*2-Math.PI/2+(j%2?0.24:0);
   positions.set(node.key,{x:width/2+Math.cos(angle)*radii[j],y:height/2+Math.sin(angle)*radii[j]});
  }));
 }
 return {positions,width,height};
}

let activeCleanup=()=>{};
export function disposeAtlas(){activeCleanup();activeCleanup=()=>{}};

export async function renderAtlas({root,app,api,esc=escapeGraphText,go,report=()=>{}}){
 disposeAtlas();
 if(!root)return;
 let selectedKey=null,query='',zoom=window.matchMedia('(max-width: 640px)').matches?2.35:1,panX=0,panY=0,visibleKinds=new Set(kinds.map(k=>k.key)),auto=false,timer=null,graph=buildAtlasGraph({},profile),updated='',errors=[],revision='';
 let drawCounter=0;
 const safe=escapeGraphText;
 const title=profile.title;
 const frame=document.createElement('section');frame.className=`at-app at-${profile.layout}`;frame.dataset.atlas='true';
 root.replaceChildren(frame);
 frame.innerHTML=`<div class="at-mast"><div><div class="at-kicker"><span class="at-pulse" aria-hidden="true"></span> ${safe(app.name.toUpperCase())} / ${safe(title)} <span class="at-separator">·</span> AUTHENTICATED DATA SPACE</div><h2>${safe(profile.headline)}</h2><p>${safe(profile.tag)}</p></div><div class="at-mast-actions"><button type="button" class="at-primary" data-at-refresh>↻ Sync now</button><button type="button" data-at-export>↗ Export topology</button></div></div><div class="at-status" role="status" aria-live="polite">Connecting to authorized data feeds…</div><div class="at-metrics" aria-label="Topology counters"></div><div class="at-deck"><aside class="at-rail"><div class="at-rail-head"><small>01 / SIGNAL SOURCES</small><h3>Entity layers</h3></div><div class="at-layer-list"></div><div class="at-search"><label for="at-lookup">Find a record</label><input id="at-lookup" autocomplete="off" type="search" placeholder="Search visible nodes  /" spellcheck="false"/><span>Search loaded record labels. Not a server-wide search.</span></div><div class="at-rail-note"><b>TRUE RELATIONSHIPS ONLY</b><p>Lines are drawn only where linked identifiers or names are present in returned records.</p></div></aside><div class="at-viewport-frame"><div class="at-charthead"><div><b>02 / INTERACTIVE DATA SPACE</b><span class="at-count"></span></div><div class="at-chart-actions"><button type="button" data-at-zoom="out" aria-label="Zoom out">−</button><button type="button" data-at-zoom="fit">Fit</button><button type="button" data-at-zoom="in" aria-label="Zoom in">+</button></div></div><div class="at-viewport" tabindex="0" aria-label="Interactive relationship graph. Tab into the nodes; Enter inspects a node. Drag empty space to pan. Use zoom buttons to scale."><svg class="at-svg" viewBox="0 0 1010 680" role="group" aria-label="Record relationship network" xmlns="http://www.w3.org/2000/svg"><g class="at-scene"></g></svg><div class="at-overlay"><span>DRAG TO PAN</span><span>CLICK / ENTER TO INSPECT</span></div></div><div class="at-chartfoot"><span class="at-view-meta">Source limited to currently loaded records</span><label class="at-switch"><input type="checkbox" data-at-auto/> Auto-sync every 60s</label></div></div><aside class="at-inspector"><div class="at-rail-head"><small>03 / CONTEXT PANEL</small><h3>Node inspector</h3></div><div class="at-inspect-content" aria-live="polite"></div><div class="at-activity-head">RECENT DATED RECORDS</div><div class="at-activity"></div></aside></div><div class="at-footnote">Live read-only visualization. No simulated nodes, fabricated links, or automatic production actions. Full counts may exceed the current API result window. Export may contain private metadata.</div>`;
 const $=s=>frame.querySelector(s), $$=s=>[...frame.querySelectorAll(s)];
 const svg=$('.at-svg'),scene=$('.at-scene');
 let position=positionAtlas(graph), eligible=new Set(), matchKeys=new Set();
 const countLabels=()=>{
  const src=graph.layers.map(l=>`<div class="at-metric"><strong>${l.count}</strong><span>${safe(l.title)}</span></div>`).join('');
  $('.at-metrics').innerHTML=src+`<div class="at-metric at-metric-links"><strong>${graph.links.length}</strong><span>Verified links</span></div>`;
  $('.at-layer-list').innerHTML=graph.layers.map((l,i)=>`<label class="at-layer at-layer-${i}"><input type="checkbox" data-at-kind="${safe(l.key)}" ${visibleKinds.has(l.key)?'checked':''}/><span class="at-layer-icon">${String(i+1).padStart(2,'0')}</span><span><b>${safe(l.title)}</b><small>${l.count} loaded</small></span><span class="at-layer-check" aria-hidden="true">◆</span></label>`).join('');
 };
 const inspect=()=>{
  const node=graph.nodes.find(n=>n.key===selectedKey);
  const target=$('.at-inspect-content');
  if(!node){target.innerHTML=`<div class="at-empty-inspect"><div class="at-empty-icon">⌘</div><strong>Select a real record</strong><p>Explore a node to inspect its source attributes, status and verified relationships without leaving this workspace.</p><span>TIP · Tab through graph nodes</span></div>`;return}
  const adjacent=graph.links.filter(e=>e.from===node.key||e.to===node.key).map(e=>graph.nodes.find(n=>n.key===(e.from===node.key?e.to:e.from))).filter(Boolean);
  target.innerHTML=`<div class="at-selection"><small>${safe(node.kind.toUpperCase())} / ACTIVE RECORD</small><h4>${safe(node.title)}</h4><div class="at-select-status">${safe(node.status)}</div><div class="at-record-meta"><span>Linked neighbors</span><strong>${adjacent.length}</strong></div><div class="at-record-meta"><span>Last recorded timestamp</span><strong>${safe(node.timestamp||'Unavailable')}</strong></div><div class="at-select-actions"><button type="button" class="at-primary" data-at-go="${safe(node.section)}">Open ${safe(graph.layers[node.layer].title)} ↗</button><button type="button" data-at-copy>Copy JSON</button><button type="button" data-at-clear>Clear</button></div><div class="at-neighbors"><b>CONNECTED RECORDS / ${adjacent.length}</b>${adjacent.length?adjacent.slice(0,12).map(n=>`<button type="button" data-at-neighbor="${safe(n.key)}"><span>${safe(n.kind)}</span>${safe(n.title.slice(0,45))} ↗</button>`).join(''):'<p>No verified relationships in the loaded data. Unlinked does not imply orphaned in the full database.</p>'}</div><details class="at-payload"><summary>Raw source attributes</summary><pre class="at-record-json"></pre></details></div>`;
  target.querySelector('.at-record-json').textContent=JSON.stringify(node.record,null,2);
 };
 const activities=()=>{
  const dated=graph.nodes.map(n=>({...n,date:Date.parse(n.timestamp)})).filter(n=>Number.isFinite(n.date)).sort((a,b)=>b.date-a.date).slice(0,6);
  $('.at-activity').innerHTML=dated.length?dated.map(n=>`<button type="button" data-at-activity="${safe(n.key)}"><span class="at-activity-dot at-color-${n.layer}"></span><span><b>${safe(n.title.slice(0,33))}</b><small>${safe(n.kind)} · ${safe(n.timestamp.slice(0,16))}</small></span></button>`).join(''):'<p class="at-no-activity">No dated records in the loaded data.</p>';
 };
 const applyTransform=()=>{scene.setAttribute('transform',`translate(${panX.toFixed(2)} ${panY.toFixed(2)}) translate(${(position.width/2).toFixed(2)} ${(position.height/2).toFixed(2)}) scale(${zoom.toFixed(3)}) translate(${(-position.width/2).toFixed(2)} ${(-position.height/2).toFixed(2)})`)};
 const makeNode=node=>{
  const p=position.positions.get(node.key);if(!p)return '';
  const selected=selectedKey===node.key,matching=matchKeys.has(node.key),inFocus=selectedKey&&graph.links.some(e=>(e.from===selectedKey&&e.to===node.key)||(e.to===selectedKey&&e.from===node.key));
  const muted=query&&!matching||selectedKey&&!selected&&!inFocus;
  const text=node.title.length>21?node.title.slice(0,20)+'…':node.title;
  const color=node.layer;
  return `<g tabindex="0" role="button" aria-pressed="${selected?'true':'false'}" aria-label="${safe(node.kind+' '+node.title+', '+node.status)}" class="at-node at-color-${color}${selected?' is-current':''}${muted?' is-muted':''}${matching&&query?' is-match':''}" data-at-node="${safe(node.key)}" transform="translate(${p.x} ${p.y})"><rect x="-88" y="-23" width="176" height="46" rx="8"/><circle cx="-76" cy="-11" r="3"/><text x="-65" y="-6" class="at-node-type">${safe(node.kind.toUpperCase().slice(0,13))}</text><text x="-74" y="13" class="at-node-title">${safe(text)}</text><title>${safe(node.title)} — ${safe(node.status)}</title></g>`;
 };
 const draw=()=>{
  const active=graph.nodes.filter(n=>visibleKinds.has(n.kind));
  eligible=new Set(active.map(n=>n.key));
  matchKeys=new Set(active.filter(n=>!query||normalize(n.title+' '+n.status+' '+n.kind).includes(normalize(query))).map(n=>n.key));
  const focused=new Set(matchKeys);
  const visibleEdges=graph.links.filter(e=>eligible.has(e.from)&&eligible.has(e.to));
  svg.setAttribute('viewBox',`0 0 ${position.width} ${position.height}`);
  const edges=visibleEdges.map(e=>{
   const a=position.positions.get(e.from),b=position.positions.get(e.to);if(!a||!b)return '';
   const hot=selectedKey&&(e.from===selectedKey||e.to===selectedKey);
   const faint=query&&(!focused.has(e.from)||!focused.has(e.to))||selectedKey&&!hot;
   const curve=profile.layout==='lanes'||profile.layout==='lineage' ? `M${a.x},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x},${b.y}` : `M${a.x},${a.y} Q${position.width/2},${position.height/2} ${b.x},${b.y}`;
   return `<path d="${curve}" class="at-edge${hot?' is-related':''}${faint?' is-faded':''}"/>`;
  }).join('');
  scene.innerHTML=`<g class="at-links">${edges}</g><g class="at-points">${active.map(makeNode).join('')}</g>`;
  applyTransform();
  $('.at-count').textContent=`${active.length} drawn · ${matchKeys.size} matching · ${visibleEdges.length} mapped links`;
  $('.at-view-meta').textContent=graph.truncated.length?`Sampling cap: ${graph.truncated.join(' · ')}`:'View includes all currently fetched records (subject to upstream API limits)';
  inspect();
 };
 const signature=()=>JSON.stringify([...graph.nodes.map(n=>[n.key,n.status]),...graph.links.map(e=>[e.from,e.to])].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
 const load=async()=>{
  const turn=++drawCounter;$('.at-status').textContent='Reading authorized D1 endpoints…';
  const results=await Promise.allSettled(kinds.map(async kind=>{
   const response=await api('/api/'+kind.endpoint);
   if(!response||!Array.isArray(response.items))throw Error(`Invalid ${kind.title} response`);
   return response.items;
  }));
  if(turn!==drawCounter||!frame.isConnected)return;
  errors=results.flatMap((r,i)=>r.status==='rejected'?[kinds[i].title]:[]);
  const incoming={};for(let i=0;i<kinds.length;i++)incoming[kinds[i].key]=results[i].status==='fulfilled'?results[i].value:[];
  const old=revision;graph=buildAtlasGraph(incoming,profile);position=positionAtlas(graph);
  if(!graph.nodes.some(n=>n.key===selectedKey))selectedKey=null;
  revision=signature();updated=new Date().toLocaleTimeString();
  countLabels();activities();draw();
  const healthy=kinds.length-errors.length;
  $('.at-status').textContent=`${healthy}/${kinds.length} data feeds connected · ${graph.nodes.length} real records · Updated ${updated}${old&&old!==revision?' · Changes detected since last sync':''}${errors.length?' · Unavailable: '+errors.join(', '):''}`;
  if(healthy===0){const unlock=document.createElement('button');unlock.type='button';unlock.className='at-inline-unlock';unlock.textContent='Review access credentials →';unlock.dataset.atGo='access';$('.at-status').append('  ',unlock)}
 };
 const resetZoom=()=>{zoom=1;panX=0;panY=0;applyTransform()};
 const handleClick=async event=>{
  const btn=event.target.closest('button');
  const node=event.target.closest('[data-at-node]');
  if(node&&frame.contains(node)){selectedKey=node.dataset.atNode;draw();return}
  if(!btn||!frame.contains(btn))return;
  if(btn.hasAttribute('data-at-refresh')){await load();return}
  if(btn.hasAttribute('data-at-zoom')){const command=btn.dataset.atZoom;if(command==='fit')resetZoom();else{zoom=Math.max(.6,Math.min(2.6,zoom*(command==='in'?1.2:1/1.2)));applyTransform()}return}
  if(btn.hasAttribute('data-at-clear')){selectedKey=null;draw();return}
  if(btn.hasAttribute('data-at-neighbor')||btn.hasAttribute('data-at-activity')){selectedKey=btn.dataset.atNeighbor??btn.dataset.atActivity;draw();return}
  if(btn.hasAttribute('data-at-go')){go(btn.dataset.atGo);return}
  if(btn.hasAttribute('data-at-copy')){const n=graph.nodes.find(n=>n.key===selectedKey);if(n){try{await navigator.clipboard.writeText(JSON.stringify(n.record,null,2));report('Selected record copied')}catch{report('Clipboard is unavailable')}}return}
  if(btn.hasAttribute('data-at-export')){
   if(!window.confirm('This file includes private record metadata. Export the currently loaded topology?'))return;
   const payload={format:'portfolio-atlas/v1',product:app.name,record_source:'authorized API responses; capped at 20 rows/layer for the diagram',generated_at:new Date().toISOString(),nodes:graph.nodes.map(n=>({kind:n.kind,key:n.key,title:n.title,status:n.status,record:n.record})),links:graph.links};
   const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download=`${app.name.toLowerCase()}-atlas-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
   report('Exported private topology metadata. Handle the file as confidential workspace data.');
  }
 };
 frame.addEventListener('click',handleClick);
 frame.addEventListener('change',event=>{
  const box=event.target;if(box.matches('[data-at-kind]')){if(box.checked)visibleKinds.add(box.dataset.atKind);else visibleKinds.delete(box.dataset.atKind);draw()}
  if(box.matches('[data-at-auto]')){auto=box.checked;if(timer)clearInterval(timer);timer=auto?setInterval(()=>{if(!frame.isConnected){disposeAtlas();return}if(document.visibilityState!=='hidden')load()},60000):null}
 });
 $('#at-lookup').addEventListener('input',e=>{query=e.target.value;draw()});
 const handleKeys=event=>{
  const inField=event.target.matches('input,textarea,select');
  if(event.key==='/'&&!inField){event.preventDefault();$('#at-lookup').focus();return}
  if(event.key==='Escape'&&!inField&&selectedKey){selectedKey=null;draw();return}
  const node=event.target.closest('[data-at-node]');
  if(node&&['Enter',' '].includes(event.key)){event.preventDefault();selectedKey=node.dataset.atNode;draw();return}
  if(node&&['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key)){
   event.preventDefault();const available=$$('[data-at-node]');const index=available.findIndex(n=>n.dataset.atNode===node.dataset.atNode);const next=(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+available.length)%available.length;available[next]?.focus();return
  }
  if(!inField&&(event.key==='+'||event.key==='='||event.key==='-')){event.preventDefault();zoom=Math.max(.6,Math.min(2.6,zoom*(event.key==='-'?1/1.2:1.2)));applyTransform()}
  if(!inField&&event.key==='0'){resetZoom()}
 };document.addEventListener('keydown',handleKeys);
 let pointer=null;
 svg.addEventListener('pointerdown',event=>{if(event.target.closest('[data-at-node]')||event.button!==0)return;pointer={x:event.clientX,y:event.clientY};svg.setPointerCapture(event.pointerId);svg.classList.add('is-dragging')});
 svg.addEventListener('pointermove',event=>{if(!pointer)return;const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;panX+=(event.clientX-pointer.x)*(position.width/rect.width);panY+=(event.clientY-pointer.y)*(position.height/rect.height);pointer={x:event.clientX,y:event.clientY};applyTransform()});
 const stop=()=>{pointer=null;svg.classList.remove('is-dragging')};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);
 activeCleanup=()=>{drawCounter++;if(timer)clearInterval(timer);timer=null;auto=false;document.removeEventListener('keydown',handleKeys)};
 await load();
}

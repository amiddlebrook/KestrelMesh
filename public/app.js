import {mountSavedViews} from './saved-views.js';
import {renderAgent} from './agent.js';
import {renderDecision} from './decision.js';
import { renderStudio } from './studio.js';
import { renderOperations } from './ops.js';
import { renderShell, renderRecords } from './workspace.js';
import { renderDetails } from './details.js';
import { refineRecords, filtersMarkup } from './explorer.js';
import { createInterface } from './interaction.js';
import { renderExperience, enrichSection, identity } from './experience.js';
import app from './config.js';
const root=document.getElementById('app');
document.body.dataset.product=app.name.toLowerCase();
const validPages=new Set(['overview','access',...app.sections.map(section=>section.id)]);
const routeFromHash=()=>{try{const id=decodeURIComponent(location.hash.slice(1));return validPages.has(id)?id:'overview'}catch{return 'overview'}};
let page=routeFromHash(),lastResult=null,notice='',noticeType='success';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=x=>JSON.stringify(x,null,2);
const col=x=>x.replace(/_/g,' ');
const success=m=>{notice=m;noticeType='success';paintNotice()};
const error=e=>{notice=String(e?.message||e);noticeType='error';paintNotice()};
const token=()=>sessionStorage.getItem('portfolio-admin-token')||'';
const ui=createInterface({app,token,saveToken:value=>{if(value)sessionStorage.setItem('portfolio-admin-token',value);else sessionStorage.removeItem('portfolio-admin-token')},refresh:()=>render(),navigate:id=>{if(!validPages.has(id))return;page=id;location.hash=id;notice='';render();document.getElementById('page-title')?.focus()}});
async function api(path,method='GET',data){
 const headers={}; if(token())headers.Authorization='Bearer '+token();if(data!==undefined)headers['Content-Type']='application/json';
 const res=await fetch(path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
 const text=await res.text();let out;try{out=JSON.parse(text)}catch{throw new Error('Non-JSON API response: '+text.slice(0,250))}
 if(!res.ok)throw new Error(out.error||`HTTP ${res.status}`);return out;
}
function cell(value){if(value===null||value===undefined)return '—';if(typeof value==='object')return `<span class="muted">${esc(pretty(value).slice(0,100))}</span>`;
 const s=String(value);if(['completed','approved','production','enabled','success'].includes(s))return `<span class="pill">${esc(s)}</span>`;
 if(['failed','rejected','disabled'].includes(s))return `<span class="pill bad">${esc(s)}</span>`;
 if(['pending','running','waiting_approval','processing'].includes(s))return `<span class="pill warn">${esc(s)}</span>`;
 return esc(s.length>155?s.slice(0,155)+'…':s);}
function table(items,columns,includeActions=false){if(!items.length)return '<div class="empty">No records yet. Create one above, or load the sample dataset.</div>';
 return `<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th>${esc(col(c))}</th>`).join('')}<th>Details</th>${includeActions?'<th>Action</th>':''}</tr></thead><tbody>${items.map((item,i)=>`<tr>${columns.map(c=>`<td>${cell(item[c])}</td>`).join('')}<td><button class="viewlink" data-inspect="${i}">Inspect</button></td>${includeActions?`<td><button class="btn secondary small" data-action="${i}">Run action</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function panel(title,inside,detail=''){return `<div class="panel"><div class="panel-head"><h3>${esc(title)}</h3>${detail}</div>${inside}</div>`}
function metrics(items){return `<div class="grid">${(items||[]).map(item=>`<div class="stat"><strong>${cell(item.value)}</strong><span>${esc(item.label)}</span></div>`).join('')}</div>`}
function paintNotice(){const el=document.getElementById('message');if(!el)return;el.className=notice?'notice '+noticeType:'hidden';el.textContent=notice;}
function skeleton(){
 root.innerHTML=renderShell(app,identity,esc);
 document.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{page=btn.dataset.page;location.hash=page;notice='';render();document.getElementById('page-title')?.focus()}));
 document.getElementById('refresh').onclick=()=>render();
 ui.hydrate();
}
function title(){document.querySelectorAll('[data-page]').forEach(b=>{const active=b.dataset.page===page;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});const s=app.sections.find(s=>s.id===page);document.getElementById('page-title').textContent=s?.label||(page==='access'?'Access control':'Overview');document.getElementById('page-subtitle').textContent=page==='overview'?app.tagline:'Live data from your own Cloudflare D1 database';paintNotice()}
async function fieldsHtml(fields){return (await Promise.all(fields.map(async f=>{
 const id='field-'+f.name;let field='';let def=f.default??'';
 if(f.type==='json'){field=`<textarea id="${id}" name="${f.name}" class="large" spellcheck="false">${esc(pretty(def||{}))}</textarea>`}
 else if(f.type==='textarea')field=`<textarea id="${id}" name="${f.name}">${esc(def)}</textarea>`;
 else if(f.type==='select')field=`<select id="${id}" name="${f.name}">${(f.options||[]).map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
 else if(f.type==='reference'){
  let rows=[];try{rows=(await api(f.source)).items||[]}catch(e){rows=[]}
  field=`<select id="${id}" name="${f.name}">${rows.length?rows.map(r=>`<option value="${esc(r.id)}">${esc(r.name||r.title||r.experiment||r.id)}</option>`).join(''):'<option value="">Create the referenced record first</option>'}</select>`;
 } else field=`<input id="${id}" name="${f.name}" type="${f.type==='number'?'number':'text'}" value="${esc(def)}" />`;
 return `<div class="field"><label for="${id}">${esc(col(f.name))}</label>${field}</div>`;
 }))).join('')}
function readForm(form,fields){const out={};for(const f of fields){const val=form.elements[f.name]?.value||'';if(f.type==='json'){try{out[f.name]=JSON.parse(val)}catch{throw new Error(`${col(f.name)} must contain valid JSON`)}}else if(f.type==='number')out[f.name]=Number(val);else out[f.name]=val;}return out}
function resultCard(item,label='API response'){return panel(label,`<div class="mono">${esc(pretty(item))}</div>`)}
async function createForm(spec){if(!spec.fields)return '';return panel('Create '+spec.label.toLowerCase(),`<form id="create-form">${await fieldsHtml(spec.fields)}<button class="btn" type="submit">Create record →</button></form>`)}
async function actionForm(spec,id){const settings=spec.action,fields=settings?.input||[];
 const content=await fieldsHtml(fields);
 return panel(settings.title,`<form id="action-form">${content}<button class="btn" type="submit">${settings.download?'Export JSON':'Execute action'} →</button></form><p class="muted">Selected record: <code>${esc(id)}</code></p>`)}
async function renderList(spec){const content=document.getElementById('content');content.innerHTML=panel('Loading','<p class="muted">Fetching records...</p>');
 try{const data=await api(spec.endpoint);const rows=data.items||[];
  content.innerHTML=(spec.fields?await createForm(spec):'')+panel(spec.label+' · '+rows.length+' records',`${filtersMarkup(rows.length)}<div id="data-table">${table(rows,spec.columns||Object.keys(rows[0]||{}),!!spec.action)}</div>`)+`<div id="details"></div>`;
  const listing=document.getElementById('data-table');function bindTable(dataRows){
   listing.innerHTML=renderRecords({spec,rows:dataRows,esc});
   listing.querySelectorAll('[data-inspect]').forEach(btn=>btn.onclick=()=>{const row=dataRows[Number(btn.dataset.inspect)];const detail=document.getElementById('details');detail.innerHTML=renderDetails(row);detail.querySelector('[data-close-details]').onclick=()=>{detail.replaceChildren();btn.focus()};detail.querySelector('[data-copy-record]').onclick=async()=>{try{await navigator.clipboard.writeText(pretty(row));success('Record JSON copied')}catch{error('Clipboard not available in this browser')}};detail.scrollIntoView({behavior:'smooth',block:'nearest'});detail.querySelector('[data-close-details]').focus()});
   listing.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=async()=>{const row=dataRows[Number(btn.dataset.action)];const where=document.getElementById('details');where.innerHTML=await actionForm(spec,row.id);
    const form=document.getElementById('action-form');form.onsubmit=async event=>{event.preventDefault();try{const args=readForm(form,spec.action.input||[]);const url=spec.action.endpoint.replace('{id}',encodeURIComponent(row.id));const output=await api(url,spec.action.method||'POST',(spec.action.method==='GET')?undefined:args);
      if(spec.action.download){const blob=new Blob([pretty(output)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${app.name}-${row.id}.json`;a.click();URL.revokeObjectURL(a.href)}else success('Action completed');where.innerHTML=resultCard(output,'Action response');
    }catch(e){error(e)}};where.scrollIntoView({behavior:'smooth',block:'nearest'})});
  }
   let visible=[];
   const search=document.getElementById('filter'),preset=document.getElementById('enterprise-preset'),order=document.getElementById('enterprise-order');
   const updateView=()=>{visible=refineRecords(rows,{query:search.value,preset:preset.value,order:order.value});bindTable(visible);document.getElementById('enterprise-record-count').textContent=`${visible.length} of ${rows.length} loaded records`};
   search.addEventListener('input',updateView);
   preset.addEventListener('change',updateView);
   order.addEventListener('change',updateView);
   document.getElementById('enterprise-export').addEventListener('click',()=>{
     if(!visible.length){error('No records match your current filter.');return;}
     const blob=new Blob([pretty(visible)],{type:'application/json'});
     const href=URL.createObjectURL(blob);
     const a=document.createElement('a');a.href=href;a.download=`${app.name.toLowerCase()}-${spec.id}-filtered.json`;a.click();
     setTimeout(()=>URL.revokeObjectURL(href),2000);
     success(`Exported ${visible.length} currently loaded records. Treat the download as private workspace data.`);
   });
   updateView();
   await mountSavedViews({product:app.name,section:spec.id,api,search,preset,order,apply:updateView,report:message=>{notice=message;noticeType='success';paintNotice()}});
  const form=document.getElementById('create-form');if(form)form.onsubmit=async ev=>{ev.preventDefault();try{const args=readForm(form,spec.fields);const out=await api(spec.endpoint,'POST',args);success('Created '+(out.id||'record'));render()}catch(e){error(e)}};
 }catch(e){content.innerHTML=panel('Unable to load data',`<p>${esc(e.message)}</p><p class="muted">Run local D1 migrations first. For deployment, configure the ADMIN_TOKEN Worker secret.</p>`)}
}
async function overview(){
 const content=document.getElementById('content');
 try{await renderExperience({root:content,api,esc,go:id=>{if(!validPages.has(id))return;page=id;location.hash=id;render()},success,error});}
 catch(e){content.innerHTML=panel('Unable to load workspace',`<p>${esc(e.message)}</p><p class="muted">Enter the Access key to view protected D1 data.</p>`);error(e)}
}
async function custom(spec){const el=document.getElementById('content');
 if(spec.custom==='ask'){el.innerHTML=panel('Ask a grounded question',`<form id="ask"><div class="field"><label>Question</label><textarea name="question">Which documents mention renewal dates or payment amounts?</textarea></div><button class="btn">Answer with citations →</button></form>`)+panel('Keyword evidence search',`<form id="search"><div class="field"><label>Search phrase</label><input name="query" value="renewal contract"/></div><button class="btn secondary">Search passages</button></form>`)+`<div id="results"></div>`;
  for(const action of ['ask','search'])document.getElementById(action).onsubmit=async ev=>{ev.preventDefault();const form=ev.target;try{const result=await api('/api/'+action,'POST',{[action==='ask'?'question':'query']:form.elements[action==='ask'?'question':'query'].value});document.getElementById('results').innerHTML=resultCard(result,action==='ask'?'Grounded answer':'Matching passages')}catch(e){error(e)}};
 }
 if(spec.custom==='infer'){el.innerHTML=panel('Send an inference request',`<form id="infer"><div class="field"><label>Task / prompt</label><textarea name="task">Explain the difference between throughput and latency in a distributed inference gateway.</textarea></div><button class="btn">Route & infer →</button></form><p class="muted">The fixture backend returns explicitly labeled deterministic text. Workers AI uses Cloudflare's daily free allocation.</p>`)+`<div id="results"></div>`;
 document.getElementById('infer').onsubmit=async e=>{e.preventDefault();try{const result=await api('/api/infer','POST',{task:e.target.elements.task.value});document.getElementById('results').innerHTML=resultCard(result,'Inference result')}catch(ex){error(ex)}};
 const seed=document.createElement('button');seed.className='btn secondary';seed.textContent='Seed a fixture + Workers AI model';el.prepend(seed);seed.onclick=async()=>{try{await api('/api/seed','POST',{});success('Registered starter models')}catch(e){error(e)}};
 }
 if(spec.custom==='metrics'){try{const result=await api('/api/metrics');el.innerHTML=metrics(Object.entries(result).map(([key,value])=>({label:col(key),value:value??'—'})))+panel('Performance calculation',`<p>Statistics are computed from the 200 most recent inference traces. p50/p95/p99 exclude failed requests. This is an observational dashboard, not a synthetic performance claim.</p>`)}catch(e){error(e)}}
 if(spec.custom==='evaluate'){
 const [s,t]=await Promise.all([api('/api/suites'),api('/api/targets')]);const select=(name,items)=>`<div class="field"><label>${name}</label><select name="${name}">${items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></div>`;
 el.innerHTML=panel('Create an evaluation run',`<form id="evaluate">${select('suite',s.items)}${select('target',t.items)}<button class="btn">Create evaluation →</button></form><p class="muted">Run cases incrementally in the Results tab. Fixture mode is deterministic and clearly marked; Workers AI mode makes actual model calls.</p>`)+`<div id="results"></div>`;
 document.getElementById('evaluate').onsubmit=async e=>{e.preventDefault();try{const result=await api('/api/suites/'+e.target.elements.suite.value+'/evaluate','POST',{target_id:e.target.elements.target.value});document.getElementById('results').innerHTML=resultCard(result,'New run');success('Evaluation created; open Results to advance cases')}catch(ex){error(ex)}};
 }
 if(spec.custom==='record'){
 const experiments=(await api('/api/experiments')).items;
 el.innerHTML=panel('Import a locally trained model result',`<p class="muted">Train with <code>python apps/gradientfoundry/trainer/train.py --input experiment.json</code>, then paste the JSON result below. The trainer runs on your own machine without paid compute.</p><form id="record"><div class="field"><label>Experiment</label><select name="experiment">${experiments.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select></div><div class="field"><label>Training result (JSON)</label><textarea class="large" name="result">{"seed":42,"accuracy":0.8,"precision":0.8,"recall":0.8,"history":[],"weights":{},"notes":"Replace with real output from local training"}</textarea></div><button class="btn">Import metrics →</button></form><p class="muted">Replace placeholder values with measured training results before publishing benchmarks.</p>`)+`<div id="results"></div>`;
 document.getElementById('record').onsubmit=async e=>{e.preventDefault();try{const data=JSON.parse(e.target.elements.result.value);const r=await api('/api/experiments/'+e.target.elements.experiment.value+'/runs','POST',data);document.getElementById('results').innerHTML=resultCard(r,'Registered run');success('Run imported')}catch(ex){error(ex)}};
 const seed=document.createElement('button');seed.className='btn secondary';seed.textContent='Create sample dataset + experiment';el.prepend(seed);seed.onclick=async()=>{try{await api('/api/seed','POST',{});success('Example created')}catch(e){error(e)}};
 }
}
async function renderAccess(){
 const where=document.getElementById('content');
 where.innerHTML=panel('Access control',`<p class="muted">Loading credential policy and key inventory…</p>`);
 try {
  const me=await api('/api/access/me');
  const root=me.kind==='root';
  if(!root){where.innerHTML=panel('Your credential',`<p>Authenticated as <b>${esc(me.label)}</b> · ${esc(me.role)}. Only the root administrator can issue and revoke keys.</p><p class="muted">Scope: <code>${esc(me.route_prefix)}</code></p>`);return;}
  const [keys,audit]=await Promise.all([api('/api/access/keys'),api('/api/access/audit')]);
  where.innerHTML=panel('Issue a scoped API key',`<form id="credential-form"><div class="field"><label for="key-label">Purpose / label</label><input name="label" id="key-label" maxlength="100" placeholder="Analyst read-only" required /></div><div class="field"><label for="key-role">Role</label><select name="role" id="key-role"><option value="viewer">Viewer · read-only</option><option value="operator">Operator · read/write, no DELETE</option></select></div><div class="field"><label for="key-prefix">API route prefix</label><input name="route_prefix" id="key-prefix" value="/api/" required pattern="/api/.*" /></div><div class="field"><label for="key-days">Expires after days (1–90)</label><input name="expires_in_days" id="key-days" type="number" min="1" max="90" value="30" required /></div><button class="btn" type="submit">Issue one-time credential</button></form><div id="credential-created" aria-live="polite"></div>`,`<small>Root token required</small>`)+
   panel('Active and revoked credentials',table(keys.items||[],['label','role','route_prefix','created_at','expires_at','revoked_at','last_used_at'],false)+`<div id="credential-actions"></div>`)+
   panel('Credential audit',table((audit.items||[]).slice(0,35),['action','subject_id','actor_id','created_at']));
  const form=document.getElementById('credential-form');
  form.onsubmit=async e=>{e.preventDefault();try{
   const payload={label:form.elements.label.value,role:form.elements.role.value,route_prefix:form.elements.route_prefix.value,expires_in_days:Number(form.elements.expires_in_days.value)};
   const created=await api('/api/access/keys','POST',payload);
   const slot=document.getElementById('credential-created');
   slot.replaceChildren();
   const heading=document.createElement('p');heading.textContent='New credential — save now. This is the only time it will be shown.';
   const secret=document.createElement('textarea');secret.readOnly=true;secret.rows=3;secret.value=created.token;secret.setAttribute('aria-label','One-time API key');
   const copy=document.createElement('button');copy.type='button';copy.className='btn secondary';copy.textContent='Copy credential';copy.onclick=async()=>{try{await navigator.clipboard.writeText(created.token);success('Credential copied to clipboard. Store it securely.')}catch{secret.select();success('Select and copy the credential manually.')}};
   slot.append(heading,secret,copy);success('Scoped credential issued. Reload this panel after saving the token to see the updated inventory.');
  }catch(ex){error(ex)}};
  const section=document.getElementById('credential-actions');
  const active=(keys.items||[]).filter(k=>!k.revoked_at);
  for(const key of active){const row=document.createElement('div');row.className='field';
   const label=document.createElement('span');label.textContent=`${key.label} · ${key.role} · ${key.id.slice(0,8)}`;
   const revoke=document.createElement('button');revoke.className='btn secondary small';revoke.textContent='Revoke';revoke.onclick=async()=>{if(!confirm(`Revoke credential "${key.label}" immediately?`))return;try{await api(`/api/access/keys/${encodeURIComponent(key.id)}/revoke`,'POST',{});success('Credential revoked');await renderAccess()}catch(ex){error(ex)}};
   row.append(label,revoke);section.appendChild(row);
  }
 }catch(ex){where.innerHTML=panel('Access control unavailable',`<p>${esc(ex.message)}</p><p class="muted">Sign in with your root ADMIN_TOKEN. Delegated credentials may be restricted to other API routes.</p>`)}
}

async function render(){skeleton();title();const spec=app.sections.find(s=>s.id===page);try{if(page==='overview')await overview();else if(page==='studio')await renderStudio({root:document.getElementById('content'),api,esc,go:id=>{if(!validPages.has(id))return;page=id;location.hash=id;render()},success,error});else if(page==='access')await renderAccess();else if(page==='agent')await renderAgent({root:document.getElementById('content'),api,esc,success,error});else if(page==='decisions')await renderDecision({root:document.getElementById('content'),api,esc,success,error});else if(page==='ops')await renderOperations({root:document.getElementById('content'),api,esc,success,error});else if(spec?.custom)await custom(spec);else if(spec){await renderList(spec);try{await enrichSection({root:document.getElementById('content'),page,api,esc,success,error})}catch(e){console.warn('Workspace enhancement unavailable',e)}};}catch(e){error(e)}}
addEventListener('hashchange',()=>{const target=routeFromHash();if(target!==page){page=target;render()}});
render();

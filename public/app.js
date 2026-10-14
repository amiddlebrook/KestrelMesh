import app from './config.js';
const root=document.getElementById('app');
let page='overview',lastResult=null,notice='',noticeType='success';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=x=>JSON.stringify(x,null,2);
const col=x=>x.replace(/_/g,' ');
const success=m=>{notice=m;noticeType='success';paintNotice()};
const error=e=>{notice=String(e?.message||e);noticeType='error';paintNotice()};
const token=()=>sessionStorage.getItem('portfolio-admin-token')||'';
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
function skeleton(){root.innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-icon">${esc(app.icon)}</div><div><h1>${esc(app.name)}</h1><small>AI Systems Lab</small></div></div><div><div class="nav-label">Workspace</div><nav class="nav" id="navigation"><button data-page="overview">◫ &nbsp; Overview</button>${app.sections.map(s=>`<button data-page="${esc(s.id)}">◫ &nbsp; ${esc(s.label)}</button>`).join('')}</nav></div><div class="footnote"><b>FREE TIER</b><br/>Cloudflare Workers + D1 + Workers AI<br/>GitHub Actions CI/CD<br/>No payment services configured</div></aside><main><header class="topbar"><div><div class="eyebrow">Cloudflare-native / Portfolio Edition</div><h2 id="page-title"></h2><p id="page-subtitle" class="muted"></p></div><div class="actions"><button class="btn secondary" id="auth">API token</button><button class="btn secondary" id="refresh">↻ Refresh</button></div></header><div id="message" class="hidden"></div><div id="content"></div></main></div>`;
 document.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{page=btn.dataset.page;notice='';render()}));
 document.getElementById('refresh').onclick=()=>render();
 document.getElementById('auth').onclick=()=>{const value=prompt('Enter the ADMIN_TOKEN secret configured in the deployed Cloudflare Worker. Leave blank to clear it. This is stored only in this browser tab.');if(value!==null){if(value)sessionStorage.setItem('portfolio-admin-token',value);else sessionStorage.removeItem('portfolio-admin-token');render()}};
}
function title(){document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const s=app.sections.find(s=>s.id===page);document.getElementById('page-title').textContent=s?.label||'Overview';document.getElementById('page-subtitle').textContent=page==='overview'?app.tagline:'Live data from your own Cloudflare D1 database';paintNotice()}
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
  content.innerHTML=(spec.fields?await createForm(spec):'')+panel(spec.label+' · '+rows.length+' records',`<div class="filters"><p class="muted">Records are ordered by the backend. Select Inspect to view complete fields.</p><input class="search" id="filter" placeholder="Filter displayed records..."/></div><div id="data-table">${table(rows,spec.columns||Object.keys(rows[0]||{}),!!spec.action)}</div>`)+`<div id="details"></div>`;
  const listing=document.getElementById('data-table');function bindTable(dataRows){
   listing.innerHTML=table(dataRows,spec.columns||Object.keys(dataRows[0]||{}),!!spec.action);
   listing.querySelectorAll('[data-inspect]').forEach(btn=>btn.onclick=()=>{const row=dataRows[Number(btn.dataset.inspect)];document.getElementById('details').innerHTML=resultCard(row,'Record details');document.getElementById('details').scrollIntoView({behavior:'smooth',block:'nearest'})});
   listing.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=async()=>{const row=dataRows[Number(btn.dataset.action)];const where=document.getElementById('details');where.innerHTML=await actionForm(spec,row.id);
    const form=document.getElementById('action-form');form.onsubmit=async event=>{event.preventDefault();try{const args=readForm(form,spec.action.input||[]);const url=spec.action.endpoint.replace('{id}',encodeURIComponent(row.id));const output=await api(url,spec.action.method||'POST',(spec.action.method==='GET')?undefined:args);
      if(spec.action.download){const blob=new Blob([pretty(output)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${app.name}-${row.id}.json`;a.click();URL.revokeObjectURL(a.href)}else success('Action completed');where.innerHTML=resultCard(output,'Action response');
    }catch(e){error(e)}};where.scrollIntoView({behavior:'smooth',block:'nearest'})});
  }
  bindTable(rows);
  document.getElementById('filter').oninput=e=>{const q=e.target.value.toLowerCase();bindTable(rows.filter(row=>JSON.stringify(row).toLowerCase().includes(q)))};
  const form=document.getElementById('create-form');if(form)form.onsubmit=async ev=>{ev.preventDefault();try{const args=readForm(form,spec.fields);const out=await api(spec.endpoint,'POST',args);success('Created '+(out.id||'record'));render()}catch(e){error(e)}};
 }catch(e){content.innerHTML=panel('Unable to load data',`<p>${esc(e.message)}</p><p class="muted">Run local D1 migrations first. For deployment, configure the ADMIN_TOKEN Worker secret.</p>`)}
}
async function overview(){const content=document.getElementById('content');try{const out=await api('/api/overview');content.innerHTML=`<section class="hero"><div class="eyebrow">Operations command center</div><h3>Production-style engineering portfolio</h3><p>${esc(app.tagline)}. Manage real data, inspect API records and run small, repeatable experiments. Demo fixtures are clearly labeled; no simulated operations are presented as real-world execution.</p><button class="btn" id="open-first">Open ${esc(app.sections[0].label)} →</button></section>`+metrics(out.metrics)+panel('Recent activity',table(out.recent||[],Object.keys((out.recent||[])[0]||{event:'event'})))+`<div class="cardset"><div class="feature"><h4>◈ Cloudflare Workers</h4><p>Edge API, input validation, stable JSON contracts, configured AI binding.</p></div><div class="feature"><h4>▦ Cloudflare D1</h4><p>SQLite schema, migrations, indexed queries and persistent audit records.</p></div><div class="feature"><h4>⟐ GitHub Actions</h4><p>Type checking, tests, configuration checks, gated deployments.</p></div></div>`;
 document.getElementById('open-first').onclick=()=>{page=app.sections[0].id;render()};
 if(['rivetflow','proofatlas','signalbench','kestrelmesh','gradientfoundry'].includes(app.name.toLowerCase())){const seed=document.createElement('button');seed.className='btn secondary';seed.textContent='Load sample data';seed.style.margin='0 0 22px';seed.onclick=async()=>{try{const out=await api('/api/seed','POST',{});notice=out.seeded?'Synthetic sample created':'Sample data already exists';noticeType='success';render()}catch(e){error(e)}};content.insertBefore(seed,content.children[1])}
 }catch(e){content.innerHTML=panel('Setup required',`<p>${esc(e.message)}</p><p>Apply the D1 migration for this app, then reload. If deployed, set the ADMIN_TOKEN secret and enter it above.</p>`)}}
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
async function render(){skeleton();title();const spec=app.sections.find(s=>s.id===page);try{if(page==='overview')await overview();else if(spec?.custom)await custom(spec);else if(spec)await renderList(spec);}catch(e){error(e)}}
render();

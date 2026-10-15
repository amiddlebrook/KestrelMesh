const conf={"cls": "km-terminal", "title": "INFERENCE DIAGNOSTICS", "eyebrow": "KESTRELMESH::EDGE::OPS", "tagline": "Read-only root-cause analysis for model routing", "prompt": "Diagnostic command", "placeholder": "Diagnose degraded providers, rising latency, or inference fault patterns…", "tools": "Authorized probes", "noRecords": "No previous diagnostics", "mode": "READ ONLY / EDGE", "status": "COMMAND HISTORY", "button": "Create diagnostic"};
const escSafe = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formatDate = (value) => { const d=new Date(value); return Number.isFinite(d.valueOf())?d.toLocaleString():String(value??''); };
const encode = x => JSON.stringify(x,null,2);
function displayEvent(ev){
 const p=ev.payload || {};
 const obs=p.observation || {};
 const rows=Array.isArray(obs.rows)?obs.rows:[];
 const properties=rows.slice(0,8).map((row,i)=>{
    const vals=Object.entries(row).slice(0,7).map(([k,v])=>`<dt>${escSafe(k)}</dt><dd>${escSafe(typeof v==='object'?JSON.stringify(v):v)}</dd>`).join('');
    return `<div class="ag-record"><span class="ag-record-number">${String(i+1).padStart(2,'0')}</span><dl>${vals}</dl></div>`;
 }).join('');
 const label=ev.kind==='final'?'SYNTHESIS':ev.tool||'SOURCE READ';
 const head=`<header><small>STEP ${String(ev.ordinal).padStart(2,'0')} / ${escSafe(label)}</small><time>${escSafe(formatDate(ev.created_at))}</time></header>`;
 if(ev.kind==='final')return `<article class="ag-event ag-event-final">${head}<blockquote>${escSafe(p.answer||'No answer recorded')}</blockquote><p class="ag-evidence">References observed steps: ${escSafe((p.evidence_steps||[]).join(', ')||'none')} · Model-generated analysis</p></article>`;
 return `<article class="ag-event">${head}<div class="ag-evidence">D1 observation · ${Number(obs.row_count??rows.length)} rows sampled · ${escSafe(p.tool||ev.tool)}</div>${properties||'<p class="ag-muted">No matching records observed.</p>'}${p.truncated?'<p class="ag-caution">Sample limited to first 20 rows.</p>':''}</article>`;
}
export async function renderAgent({root,api,esc,success,error}){
 root.className=conf.cls+' agent-workspace';
 root.innerHTML=`<div class="ag-console-top"><span class="ag-code">${esc(conf.eyebrow)}</span><span class="ag-led">●<b> TELEMETRY ACCESS</b></span></div><div class="ag-console-title"><h2>${esc(conf.title)}</h2><p>${esc(conf.tagline)}</p><div id="ag-total" class="ag-console-count">— RUNS</div></div><div class="ag-console-grid"><aside class="ag-console-history"><h3>&gt; ${esc(conf.status)}</h3><input id="ag-filter" aria-label="Find diagnostics" placeholder="grep runs…"/><div id="ag-sessions" class="ag-sessions">reading…</div><h3>&gt; ${esc(conf.tools)}</h3><div id="ag-tool-list"></div></aside><main class="ag-terminal-body"><div class="ag-terminal-prompt">root@kestrel:<span>~/diagnostics</span>$ <i>agent --readonly</i></div><form id="ag-form" class="ag-composer"><label for="ag-objective">${esc(conf.prompt)}</label><textarea id="ag-objective" maxlength="600" required spellcheck="false" placeholder="${esc(conf.placeholder)}"></textarea><div class="ag-form-actions"><label for="ag-budget">--budget <select id="ag-budget"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></label><button type="submit">${esc(conf.button)}</button></div></form><div id="ag-inspect" class="ag-inspect"><p>[idle] Select an analysis or create a new diagnostic session.</p></div><p class="ag-warning">[secure] Read-only tools. No automatic rerouting, credential disclosure or circuit reset.</p></main></div>`;
 const listRoot=root.querySelector('#ag-sessions');const inspect=root.querySelector('#ag-inspect');
 const filter=root.querySelector('#ag-filter');const counter=root.querySelector('#ag-total');
 const form=root.querySelector('#ag-form');
 const toolsEl=root.querySelector('#ag-tool-list');
 let records=[],selected=null;
 const notifyError=(err)=>{ if(typeof error==='function')error(err); };
 async function refresh(){
   try{
    const [data,settings,metrics]=await Promise.all([api('/api/agents'),api('/api/agents/config'),api('/api/agents/metrics')]);
    records=data.items||[];
    const count=Number(metrics.total??records.length);
    counter.textContent=`${count} RUNS`;
    toolsEl.replaceChildren();
    (settings.tools||[]).forEach((name,i)=>{const item=document.createElement('div');item.className='ag-tool';item.textContent=`${String(i+1).padStart(2,'0')} / ${name.replaceAll('_',' ')}`;toolsEl.append(item)});
    paintList();
   }catch(e){notifyError(e);listRoot.textContent='Access required to view agent runs.';}
 }
 function paintList(){
   const q=filter.value.trim().toLowerCase();
   const subset=records.filter(s=>String(s.objective||'').toLowerCase().includes(q)||String(s.status||'').includes(q));
   listRoot.replaceChildren();
   subset.forEach((s,i)=>{
    const item=document.createElement('button');item.type='button';item.className='ag-run'+(s.id===selected?' is-selected':'');
    item.setAttribute('aria-pressed',String(s.id===selected));
    const title=document.createElement('strong');title.textContent=s.objective.slice(0,110);
    const meta=document.createElement('small');meta.textContent=`${String(i+1).padStart(2,'0')} · ${s.status} · ${s.step_count}/${s.max_steps}`;
    item.append(meta,title);item.addEventListener('click',()=>open(s.id));listRoot.append(item);
   });
   if(!subset.length){const p=document.createElement('p');p.textContent=filter.value?'No matching entries.':"No previous diagnostics";listRoot.append(p)}
 }
 async function open(id){
    selected=id;paintList();
    try{
      const {session:s,events=[]}=await api('/api/agents/'+encodeURIComponent(id));
      const safeObjective=escSafe(s.objective);
      const progress=`<progress max="${Math.max(1,Math.min(4,Number(s.max_steps)||3))}" value="${Math.max(0,Math.min(4,Number(s.step_count)||0))}"></progress>`;
      const eventMarkup=events.map(displayEvent).join('');
      inspect.innerHTML=`<div class="ag-report-header"><div><small>RUN ${escSafe(s.id.slice(0,8))} · ${escSafe(s.status)}</small><h3>${safeObjective}</h3></div><div class="ag-progress">${progress}<span>${Number(s.step_count)||0} / ${Number(s.max_steps)||3} decisions</span></div></div>${eventMarkup||'<div class="ag-empty">No observations yet. Operator advancement runs one AI decision.</div>'}${s.error?`<p class="ag-error" role="alert">${escSafe(s.error)}</p>`:''}<div class="ag-toolbar">${s.status==='ready'?'<button id="ag-advance" class="ag-primary">Run next reasoning step</button>':''}${['ready','needs_review','failed'].includes(s.status)?'<button id="ag-abandon" class="ag-secondary">Archive</button>':''}<button id="ag-export" class="ag-secondary">Export evidence trace</button>${s.status==='running'?'<span>Running; an interrupted run can be marked failed after five minutes.</span>':''}</div><p class="ag-warning">Every action is operator-initiated. Conclusions may be wrong; consult underlying records. No write tools or external actions.</p>`;
      inspect.querySelector('#ag-advance')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;button.textContent='Executing model decision…';try{await api('/api/agents/'+id+'/advance','POST',{});await refresh();await open(id);}catch(err){notifyError(err);await open(id);}});
      inspect.querySelector('#ag-abandon')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await api('/api/agents/'+id+'/abandon','POST',{});await refresh();await open(id);success?.('Session archived');}catch(err){notifyError(err);await open(id);}});
      inspect.querySelector('#ag-export')?.addEventListener('click',()=>{
        const text=JSON.stringify({product:conf.title,session:s,events,disclaimer:'Sensitive operational records; not an attested audit record'},null,2);
        const blob=new Blob([text],{type:'application/json'});
        const objectURL=URL.createObjectURL(blob);const a=document.createElement('a');a.href=objectURL;a.download=`agent-evidence-${s.id.slice(0,8)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
      });
    }catch(e){notifyError(e);inspect.textContent='Unable to load recorded analysis.';}
 }
 form.addEventListener('submit',async e=>{
   e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
   try{const result=await api('/api/agents','POST',{objective:form.querySelector('#ag-objective').value,max_steps:Number(form.querySelector('#ag-budget').value)});form.reset();await refresh();await open(result.id);success?.('Analysis created. Run steps explicitly to invoke Workers AI.');}
   catch(err){notifyError(err)}finally{button.disabled=false}
 });
 filter.addEventListener('input',paintList);
 await refresh();
}

/* Keyboard-first product navigation and session-scoped access dialog. */
export function createInterface({app, navigate, refresh, token, saveToken}) {
  const all=[{id:'overview',label:'Overview'}, ...app.sections.map(({id,label})=>({id,label})),{id:'access',label:'Access control'}, {id:'cmd-focus',label:'Focus mode · expand workspace',action:'focus'}, {id:'cmd-density',label:'Density · compact / comfortable',action:'density'}, {id:'cmd-refresh',label:'Refresh current data',action:'refresh'}, {id:'cmd-access',label:'Manage API credential',action:'access'}];
  const access=document.createElement('dialog');
  access.className='enterprise-dialog enterprise-access';
  access.setAttribute('aria-labelledby','enterprise-access-title');
  access.innerHTML=`<form method="dialog" class="enterprise-dialog-panel" id="enterprise-credential-form">
    <div class="enterprise-modal-strap">SECURE SESSION / ${app.name.toUpperCase()}</div>
    <div class="enterprise-dialog-title"><div><h2 id="enterprise-access-title">Workspace access</h2><p>Credentials stay in this browser tab. They are not included in URLs or public previews.</p></div><button class="enterprise-icon-button" value="cancel" aria-label="Close access dialog" formnovalidate>×</button></div>
    <label class="enterprise-input-label" for="enterprise-secret">API credential</label>
    <input id="enterprise-secret" type="password" autocomplete="off" spellcheck="false" placeholder="Paste administrator or scoped access token" />
    <div class="enterprise-secret-row"><label><input type="checkbox" id="enterprise-reveal" /> Show credential</label><span>SESSION STORAGE ONLY</span></div>
    <p id="enterprise-auth-feedback" class="enterprise-feedback" aria-live="polite"></p>
    <div class="enterprise-dialog-actions"><button type="button" id="enterprise-disconnect" class="btn secondary">Disconnect</button><button type="button" id="enterprise-connect" class="btn">Verify and connect</button></div>
  </form>`;
  const commands=document.createElement('dialog');
  commands.className='enterprise-dialog enterprise-commands';
  commands.setAttribute('aria-labelledby','enterprise-command-title');
  commands.innerHTML=`<div class="enterprise-dialog-panel"><div class="enterprise-modal-strap">${app.name.toUpperCase()} / NAVIGATOR</div><div class="enterprise-dialog-title"><h2 id="enterprise-command-title">Go to workspace</h2><button type="button" class="enterprise-icon-button" id="enterprise-command-close" aria-label="Close command menu">×</button></div><label for="enterprise-command-search" class="enterprise-input-label">Find a tool or view</label><input id="enterprise-command-search" autocomplete="off" placeholder="Type a section name…" /><div class="enterprise-command-results" id="enterprise-command-results" role="listbox" aria-label="Workspace destinations"></div><div class="enterprise-command-help">↑ ↓ choose · Enter act · Esc close · Alt+Shift+F focus · Alt+Shift+D density</div></div>`;
  document.body.append(access,commands);
  const secret=access.querySelector('#enterprise-secret');
  const feedback=access.querySelector('#enterprise-auth-feedback');
  const connect=access.querySelector('#enterprise-connect');
  access.querySelector('#enterprise-reveal').addEventListener('change',e=>{secret.type=e.target.checked?'text':'password'});
  access.querySelector('#enterprise-disconnect').addEventListener('click',()=>{saveToken('');access.close();refresh()});
  access.addEventListener('close',()=>{secret.value='';feedback.textContent='';connect.disabled=false;connect.textContent='Verify and connect'});
  async function verifyAndConnect(){
    const value=secret.value.trim();
    if(!value){feedback.textContent='Enter a credential, or choose Disconnect.';secret.focus();return;}
    connect.disabled=true;connect.textContent='Checking…';feedback.textContent='Verifying against this application…';
    try{
      const response=await fetch('/api/access/me',{headers:{Authorization:'Bearer '+value},cache:'no-store'});
      if(response.status===401){feedback.textContent='Rejected: the credential is invalid or revoked.';return;}
      if(response.status===403){saveToken(value);access.close();refresh();return;} // Valid scope cannot necessarily access /api/access/me.
      if(!response.ok){feedback.textContent=`Verification unavailable (HTTP ${response.status}). Nothing was saved.`;return;}
      const details=await response.json();
      if(!details?.role){feedback.textContent='Unexpected verification response. Nothing was saved.';return;}
      saveToken(value);access.close();refresh();
    }catch{feedback.textContent='Network unavailable. Nothing was saved.';}
    finally{connect.disabled=false;connect.textContent='Verify and connect'}
  }
  connect.addEventListener('click',verifyAndConnect);
  secret.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();verifyAndConnect()}});
  const search=commands.querySelector('#enterprise-command-search');
  const results=commands.querySelector('#enterprise-command-results');
  let matches=[],selected=0;
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    matches=all.filter(x=>(x.label+' '+x.id).toLowerCase().includes(q));
    selected=Math.min(selected,Math.max(matches.length-1,0));
    results.innerHTML=matches.length?matches.map((x,i)=>`<button type="button" role="option" aria-selected="${i===selected}" data-command-index="${i}" class="enterprise-command-row${i===selected?' selected':''}"><span class="enterprise-command-index">${String(i+1).padStart(2,'0')}</span><span>${escapeHtml(x.label)}</span><span aria-hidden="true">↗</span></button>`).join(''):'<p class="enterprise-no-results">No matching workspaces.</p>';
    results.querySelectorAll('[data-command-index]').forEach(b=>b.addEventListener('click',()=>openMatch(Number(b.dataset.commandIndex))));
  };
  function openMatch(i){const dest=matches[i];if(!dest)return;commands.close();if(dest.action==='focus')toggleMode('focus');else if(dest.action==='density')toggleMode('compact');else if(dest.action==='refresh')refresh();else if(dest.action==='access')openAccess();else navigate(dest.id)}
  search.addEventListener('input',()=>{selected=0;draw()});
  search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(selected+1,matches.length-1);draw()}else if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,selected-1);draw()}else if(e.key==='Enter'){e.preventDefault();openMatch(selected)}});
  commands.querySelector('#enterprise-command-close').addEventListener('click',()=>commands.close());
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented)return;
    if(e.altKey&&e.shiftKey&&!e.metaKey&&!e.ctrlKey){if(e.key.toLowerCase()==='f'){e.preventDefault();toggleMode('focus');return}if(e.key.toLowerCase()==='d'){e.preventDefault();toggleMode('compact');return}}
    if(e.altKey)return;
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommands();return}
    if(e.key==='/'&&!typing&&!access.open&&!commands.open){e.preventDefault();openCommands()}
  });
  function openCommands(){if(access.open)return;selected=0;search.value='';draw();if(!commands.open)commands.showModal();search.focus()}
  function openAccess(){if(commands.open)commands.close();feedback.textContent='';secret.value='';if(!access.open)access.showModal();secret.focus()}
  const modeKey=name=>`enterprise-${app.name.toLowerCase()}-${name}-mode`;
  const modeValue=name=>sessionStorage.getItem(modeKey(name))==='on';
  function syncMode(name){
    const enabled=modeValue(name);document.body.classList.toggle('workspace-'+name,enabled);
    const b=document.getElementById('enterprise-mode-'+name);
    if(b){b.setAttribute('aria-pressed',String(enabled));b.textContent=(name==='focus'?'◫ Focus':'▦ Compact')+(enabled?' · On':'');b.title=name==='focus'?'Alt+Shift+F':'Alt+Shift+D'}
  }
  function toggleMode(name){sessionStorage.setItem(modeKey(name),modeValue(name)?'off':'on');syncMode(name)}
  let checkIndex=0;
  async function hydrate(){
    const authBtn=document.getElementById('auth');if(authBtn){authBtn.textContent=token()?'Credential · stored':'Connect workspace';authBtn.addEventListener('click',openAccess)}
    const actions=document.querySelector('.topbar .actions');
    if(actions){const quick=document.createElement('button');quick.type='button';quick.className='btn secondary enterprise-quick';quick.textContent='⌘ K  Navigate';quick.setAttribute('aria-keyshortcuts','Control+K Meta+K');quick.addEventListener('click',openCommands);actions.prepend(quick);
      for(const [name,shortcut] of [['focus','Alt+Shift+F'],['compact','Alt+Shift+D']]){const b=document.createElement('button');b.type='button';b.className='btn secondary enterprise-mode-button';b.id='enterprise-mode-'+name;b.setAttribute('aria-keyshortcuts',shortcut);b.addEventListener('click',()=>toggleMode(name));actions.prepend(b)}
    }
    syncMode('focus');syncMode('compact');
    document.querySelectorAll('[data-page]').forEach(b=>{const active=b.classList.contains('active');if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
    const title=document.getElementById('page-title');if(title)title.setAttribute('tabindex','-1');
    const topline=document.querySelector('.topbar');
    if(!topline)return;
    const status=document.createElement('div');status.className='enterprise-system-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.innerHTML='<span class="enterprise-health-dot"></span><span class="enterprise-health-text">Checking application service…</span>';
    topline.insertAdjacentElement('afterend',status);
    const request=++checkIndex;
    try{const r=await fetch('/api/health',{cache:'no-store'});const body=await r.json();if(request!==checkIndex||!status.isConnected)return;status.classList.toggle('online',r.ok&&body.ok===true);status.querySelector('.enterprise-health-text').textContent=r.ok&&body.ok===true?'Worker API reachable · D1 requires authorization':'Service health endpoint unavailable';}
    catch{if(request===checkIndex&&status.isConnected)status.querySelector('.enterprise-health-text').textContent='Unable to reach API';}
  }
  return {hydrate,openAccess,openCommands};
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

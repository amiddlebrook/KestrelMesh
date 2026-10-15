/* D1-backed personal views. Scoped links require the same authorized credential. */
export async function mountSavedViews({product,section,api,search,preset,order,apply,report}){
 const root=document.createElement('section');
 root.className=`enterprise-savedviews ${String(product).toLowerCase()}-savedviews`;
 root.setAttribute('aria-label','Personal workspace views');
 root.innerHTML=`<div class="enterprise-savedviews-heading"><div><span class="enterprise-savedviews-eyebrow">WORKSPACE MEMORY / ${product.toUpperCase()}</span><strong>Saved perspectives</strong><p>Persist search, status and ordering in D1 · private to this API credential.</p></div><span class="enterprise-savedviews-meta" role="status" aria-live="polite">Loading</span></div><div class="enterprise-view-actions"><label>Active perspective<select data-view-select aria-label="Saved perspective"><option value="">Live filters · unsaved</option></select></label><button class="btn secondary" type="button" data-view-save>Save view</button><button class="btn secondary" type="button" data-view-link disabled>Copy scoped link</button><button class="btn secondary" type="button" data-view-remove disabled>Delete</button></div>`;
 const explorer=document.querySelector('.enterprise-explorer');if(!explorer)return;
 explorer.insertAdjacentElement('afterend',root);
 const select=root.querySelector('[data-view-select]'),save=root.querySelector('[data-view-save]'),link=root.querySelector('[data-view-link]'),remove=root.querySelector('[data-view-remove]'),status=root.querySelector('.enterprise-savedviews-meta');
 let items=[];
 const setStatus=s=>{status.textContent=s};
 const selected=()=>items.find(x=>x.id===select.value);
 const state=()=>({section,name:'',query:search.value.slice(0,200),preset:preset.value,order:order.value});
 const showChoices=()=>{const prior=select.value;select.replaceChildren(new Option('Live filters · unsaved',''));for(const item of items)select.add(new Option(item.name,item.id));select.value=items.some(x=>x.id===prior)?prior:'';link.disabled=remove.disabled=!select.value;setStatus(`${items.length} stored`)};
 const markModified=()=>{if(selected())setStatus('Unsaved adjustments · saved version unchanged')};
 for(const control of [search,preset,order])control.addEventListener(control===search?'input':'change',markModified);
 const load=async()=>{const data=await api('/api/views?section='+encodeURIComponent(section));items=data.items||[];showChoices();};
 const choose=item=>{if(!item)return;search.value=item.query;preset.value=[...preset.options].some(o=>o.value===item.preset)?item.preset:'all';order.value=item.order;apply();setStatus(`Applied · ${item.name}`)};
 select.addEventListener('change',()=>{const item=selected();link.disabled=remove.disabled=!item;choose(item)});
 save.addEventListener('click',async()=>{
  const name=await askViewName(section);
  if(name===null)return;
  if(!name.trim()){report('Enter a name for the saved view');return}
  save.disabled=true;try{const data=await api('/api/views','POST',{...state(),name:name.trim()});await load();select.value=data.id;link.disabled=remove.disabled=false;setStatus('Saved to Cloudflare D1');report('Saved personal perspective');}
  catch(e){report(e.message||String(e))}finally{save.disabled=false}
 });
 remove.addEventListener('click',async()=>{
  const item=selected();if(!item||!await confirmDelete(item.name))return;
  remove.disabled=true;try{await api('/api/views/'+encodeURIComponent(item.id),'DELETE');select.value='';await load();report('Saved perspective deleted');}catch(e){report(e.message||String(e))}finally{remove.disabled=!selected()}
 });
 link.addEventListener('click',async()=>{
  const item=selected();if(!item)return;
  const dest=new URL(location.href);dest.searchParams.set('view',item.id);dest.searchParams.set('section',section);dest.hash=section;
  try{await navigator.clipboard.writeText(dest.toString());report('Scoped view link copied · requires this view’s credential');}catch{report('Clipboard unavailable · copy the browser URL manually')}
 });
 try{await load();const params=new URLSearchParams(location.search);if(params.get('section')===section){const desired=items.find(x=>x.id===params.get('view'));if(desired){select.value=desired.id;link.disabled=remove.disabled=false;choose(desired)}else if(params.has('view'))setStatus('Link not accessible with this credential');}}
 catch(e){setStatus('Unavailable');report(`Saved views unavailable: ${e.message||e}`)}
 return ()=>root.remove();
}

function askViewName(section){
 return new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='enterprise-dialog enterprise-view-dialog';
  d.innerHTML=`<form method="dialog" class="enterprise-dialog-panel"><div class="enterprise-modal-strap">WORKSPACE / SAVE PERSPECTIVE</div><h2>Name your view</h2><p>Search, status, and sort settings will be saved to D1, not the underlying records.</p><label class="enterprise-input-label" for="enterprise-view-name">Perspective name</label><input id="enterprise-view-name" type="text" maxlength="70" required autocomplete="off"/><div class="enterprise-dialog-actions"><button class="btn secondary" type="button" data-cancel>Cancel</button><button class="btn" type="submit">Save perspective</button></div></form>`;
  document.body.appendChild(d);const form=d.querySelector('form'),field=d.querySelector('input');field.value=`My ${section} view`;
  let answered=false;const done=value=>{if(answered)return;answered=true;d.close();d.remove();resolve(value)};
  form.addEventListener('submit',e=>{e.preventDefault();done(field.value.trim())});
  d.querySelector('[data-cancel]').addEventListener('click',()=>done(null));d.addEventListener('close',()=>done(null),{once:true});
  d.showModal();field.select();
 });
}

function confirmDelete(name){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='enterprise-dialog enterprise-view-dialog';
  dialog.innerHTML=`<div class="enterprise-dialog-panel"><div class="enterprise-modal-strap">WORKSPACE / CONFIRM REMOVAL</div><h2>Delete perspective?</h2><p data-view-description></p><div class="enterprise-dialog-actions"><button class="btn secondary" type="button" data-cancel>Keep view</button><button class="btn" type="button" data-delete>Delete saved view</button></div></div>`;
  dialog.querySelector('[data-view-description]').textContent=`The saved view “${name}” will be removed. Your underlying records will not change.`;
  document.body.append(dialog);let answered=false;
  const done=result=>{if(answered)return;answered=true;dialog.close();dialog.remove();resolve(result)};
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>done(false));
  dialog.querySelector('[data-delete]').addEventListener('click',()=>done(true));
  dialog.addEventListener('close',()=>done(false),{once:true});dialog.showModal();
 });
}

// Persistent, accessible controls shared in behavior but themed entirely by each product.
const sizes=['standard','comfortable','large'];
const safeStorage={get(key){try{return localStorage.getItem(key)}catch{return null}},set(key,value){try{localStorage.setItem(key,value)}catch{}}};
export function readingPreference(name){const v=safeStorage.get(`readability:${name}`);return sizes.includes(v)?v:'standard'}
export function applyReadingPreference(name,size){const selected=sizes.includes(size)?size:'standard';document.documentElement.dataset.readingSize=selected;safeStorage.set(`readability:${name}`,selected);return selected}
export function mountUsability({app,navigate}){
  const name=app.name;
  applyReadingPreference(name,readingPreference(name));
  document.querySelectorAll('.readability-controls,.mobile-navigation-dialog').forEach(el=>el.remove());
  const bar=document.querySelector('.topbar .actions');
  const controls=document.createElement('div');controls.className='readability-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Reading and navigation settings');
  const menu=document.createElement('button');menu.type='button';menu.className='readability-menu btn secondary';menu.textContent='☰ Sections';menu.setAttribute('aria-label','Open application navigation');menu.setAttribute('aria-expanded','false');
  menu.setAttribute('aria-haspopup','dialog');controls.append(menu);
  const label=document.createElement('label');label.className='readability-label';label.textContent='Text size ';
  const select=document.createElement('select');select.className='readability-select';select.id='reading-size-select';select.setAttribute('aria-label','Application text size');
  [['standard','Standard'],['comfortable','Comfortable'],['large','Large']].forEach(([value,name])=>{const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option)});
  select.value=readingPreference(name);
  select.addEventListener('change',()=>{applyReadingPreference(name,select.value);document.getElementById('readability-announcer').textContent=`Text size ${select.selectedOptions[0]?.textContent}`});
  label.append(select);controls.append(label);
  const announce=document.createElement('span');announce.id='readability-announcer';announce.className='visually-hidden';announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');controls.append(announce);
  bar?.append(controls);
  const dialog=document.createElement('dialog');dialog.className='mobile-navigation-dialog';dialog.setAttribute('aria-label',`${name} navigation`);
  const heading=document.createElement('h2');heading.textContent=`${name} · Sections`;heading.id='mobile-nav-heading';dialog.setAttribute('aria-labelledby',heading.id);
  const close=document.createElement('button');close.className='mobile-close';close.type='button';close.textContent='Close ×';close.setAttribute('aria-label','Close navigation');
  const header=document.createElement('header');header.append(heading,close);dialog.append(header);
  const nav=document.createElement('nav');nav.className='mobile-nav-items';nav.setAttribute('aria-label','All workspaces');
  const original=document.getElementById('navigation');
  original?.querySelectorAll('[data-page]').forEach(btn=>{
    const item=document.createElement('button');item.type='button';item.dataset.page=btn.dataset.page;item.textContent=btn.textContent?.trim()||btn.dataset.page;
    if(btn.classList.contains('active')||btn.getAttribute('aria-current')==='page')item.setAttribute('aria-current','page');
    item.addEventListener('click',()=>{dialog.close();navigate(item.dataset.page);});nav.append(item)
  });
  dialog.append(nav);document.body.append(dialog);
  function open(){if(!dialog.open){dialog.showModal();menu.setAttribute('aria-expanded','true');nav.querySelector('[aria-current="page"]')?.focus()||nav.querySelector('button')?.focus()}}
  function hide(){if(dialog.open)dialog.close()}
  menu.addEventListener('click',open);close.addEventListener('click',hide);
  dialog.addEventListener('close',()=>{menu.setAttribute('aria-expanded','false');if(menu.isConnected)menu.focus()});
  dialog.addEventListener('click',e=>{if(e.target===dialog)hide()});
  return {openNavigation:open,closeNavigation:hide};
}

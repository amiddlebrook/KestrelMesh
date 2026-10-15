// Browser-level deployment gate. Node 22+, browser CDP; no paid services or npm browser dependencies.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const origin=process.env.DEPLOY_URL;
const product=process.env.APP_NAME;
const token=process.env.APP_ADMIN_TOKEN;
const section=process.env.APP_PRIMARY_SECTION;
const browser=process.env.CHROME_BIN||'google-chrome';
if(!origin||!/^https:\/\//.test(origin)||!product||!section||!token)throw Error('DEPLOY_URL, APP_NAME, APP_PRIMARY_SECTION, and APP_ADMIN_TOKEN are required');
const output=process.env.BROWSER_ARTIFACT_DIR||'artifacts/browser';
const tick=ms=>new Promise(r=>setTimeout(r,ms));
let profile=await mkdtemp(join(tmpdir(),'acceptance-chrome-'));
let proc;
const errors=[];
class CDP {
 constructor(ws){this.ws=ws;this.seq=0;this.pending=new Map();this.errors=[];
  ws.addEventListener('message',ev=>{let e;try{e=JSON.parse(ev.data)}catch{return}
   if(e.id){const pending=this.pending.get(e.id);if(!pending)return;this.pending.delete(e.id);e.error?pending.reject(Error(JSON.stringify(e.error))):pending.resolve(e.result||{});return}
   if(e.method==='Runtime.exceptionThrown')this.errors.push(e.params?.exceptionDetails?.text||'Uncaught page exception');
   if(e.method==='Runtime.consoleAPICalled'&&e.params?.type==='error')this.errors.push('Browser console error: '+(e.params.args||[]).map(a=>String(a.value??a.description??'')).join(' ').slice(0,400));
  });
 }
 send(method,params={}){const id=++this.seq;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text||'Browser evaluate failed');return r.result?.value;}
 async close(){this.ws.close();}
}
async function waitPort(){for(let i=0;i<75;i++){if(proc.exitCode!==null||proc.signalCode)throw Error(`Chromium exited ${proc.exitCode??proc.signalCode}`);try{const raw=await readFile(join(profile,'DevToolsActivePort'),'utf8');return Number(raw.split('\n')[0]);}catch{}await tick(200);}throw Error('Chromium DevTools never started');}
async function startChromium(){
 const failures=[];
 for(let attempt=1;attempt<=3;attempt++){
  if(attempt>1){await rm(profile,{recursive:true,force:true});profile=await mkdtemp(join(tmpdir(),'acceptance-chrome-'));await tick(400);}
  const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'];
  if(attempt>1)args.splice(1,0,'--no-zygote');
  let stderr='';
  proc=spawn(browser,args,{stdio:['ignore','ignore','pipe']});
  proc.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-3000)});
  try{return await waitPort();}catch(error){
   failures.push(`attempt ${attempt}: ${String(error.message)}; chrome=${stderr.replace(/\s+/g,' ').slice(-500)}`);
   if(proc.exitCode===null&&!proc.signalCode){proc.kill('SIGTERM');await tick(500);if(proc.exitCode===null&&!proc.signalCode)proc.kill('SIGKILL');}
  }
 }
 throw Error(`Chromium startup failed after 3 isolated profile attempts: ${failures.join(' | ')}`);
}
async function openPage(port){const response=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});assert.equal(response.status,200,'Could not open CDP tab');const info=await response.json();const ws=new WebSocket(info.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});const c=new CDP(ws);await c.send('Page.enable');await c.send('Runtime.enable');return c;}
async function navigate(c,url){await c.send('Page.navigate',{url});for(let i=0;i<80;i++){await tick(150);try{if(await c.eval('document.readyState === "complete" && !!document.querySelector("#app")'))break;}catch{}if(i===79)throw Error(`Browser did not render ${url}`);}await tick(1500);}
async function snapshot(c,file){const r=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});assert.ok(r.data,'Screenshot missing');await writeFile(join(output,file),Buffer.from(r.data,'base64'));}
async function inspect(c,mode){const report=await c.eval(`(()=>({title:document.title,product:document.body?.dataset.product,textLength:document.querySelector('#app')?.innerText.length||0,pageHeading:document.getElementById('page-title')?.innerText||'',viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,navLinks:document.querySelectorAll('a,button').length,empty:document.querySelector('#app')?.children.length===0}))()`);
 assert.equal(report.product,product.toLowerCase(),`${mode} wrong product identity`);
 assert.ok(report.textLength>100,`${mode} interface did not render`);
 assert.ok(report.navLinks>=3,`${mode} missing navigation`);
 assert.ok(!report.empty,`${mode} empty app`);
 // Report widths for manual design review. Some data canvases intentionally scroll internally.
 if(report.documentWidth>report.viewport+32)errors.push(`${mode}: horizontal overflow ${report.documentWidth}px at viewport ${report.viewport}px`);
 return report;
}
try {
 const port=await startChromium();await mkdir(output,{recursive:true});
 for(const mode of ['desktop','mobile']){
  const c=await openPage(port);
  const mobile=mode==='mobile';await c.send('Emulation.setDeviceMetricsOverride',{width:mobile?390:1440,height:mobile?844:900,deviceScaleFactor:1,mobile});
  await navigate(c,`${origin}/#overview`);const home=await inspect(c,`${mode} home`);
  if(mobile){
   const toolbar=await c.eval(`(()=>{const bar=document.querySelector('.topbar .actions');const menu=document.querySelector('.readability-menu');const dialog=document.querySelector('.mobile-navigation-dialog');const height=bar?.getBoundingClientRect().height||999;if(!menu||!dialog)return {height,opened:false};menu.click();const opened=dialog.open;dialog.close();return {height,opened};})()`);
   assert.ok(toolbar.opened,'Mobile sections navigation did not open');
   assert.ok(toolbar.height<=180,`Mobile utility toolbar too tall: ${toolbar.height}px`);
  }
  await snapshot(c,`${product}-${mode}-guest.png`);
  await navigate(c,`${origin}/#${encodeURIComponent(section)}`);const sectionReport=await inspect(c,`${mode} section`);
  if(c.errors.length)errors.push(...c.errors.map(e=>`${mode} browser error: ${e}`));
  await c.close();console.log(`${product} ${mode}: home=${home.textLength} chars, section=${sectionReport.pageHeading||section} (${sectionReport.textLength} chars), viewport=${sectionReport.viewport}px`);
 }
 const authed=await openPage(port);
 // The injected secret remains in an ephemeral Chrome profile. Never log/serialize it to artifacts.
 await authed.send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin===${JSON.stringify(origin)}) sessionStorage.setItem('portfolio-admin-token',${JSON.stringify(token)});`});
 await navigate(authed,`${origin}/#${encodeURIComponent(section)}`);
 const secured=await inspect(authed,'authenticated section');
 const apiResult=await authed.eval(`(async()=>{const t=sessionStorage.getItem('portfolio-admin-token');const r=await fetch('/api/overview',{headers:{Authorization:'Bearer '+t},cache:'no-store'});return {status:r.status,type:r.headers.get('content-type')||''};})()`);
 assert.equal(apiResult.status,200,'Authenticated production API unavailable in browser');
 assert.match(apiResult.type,/application\/json/);
 if(authed.errors.length)errors.push(...authed.errors.map(e=>`authenticated browser error: ${e}`));
 await authed.close();
 if(errors.length)throw Error(`Browser acceptance warnings:\n${errors.join('\n')}`);
 console.log(`${product} browser acceptance PASS (desktop/mobile guest and authenticated ${secured.pageHeading||section})`);
} finally {if(proc&&proc.exitCode===null){proc.kill('SIGTERM');await tick(250);if(proc.exitCode===null)proc.kill('SIGKILL');}await rm(profile,{recursive:true,force:true});}

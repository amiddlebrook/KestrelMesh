import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderExperience, identity} from '../public/experience.js';
const name="KestrelMesh",marker="km-topology",criticalRoute="/api/metrics";
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fixtures={
 '/api/overview':{metrics:[],recent:[]},
 '/api/workflows':{items:[]},'/api/runs':{items:[]},'/api/approvals':{items:[]},
 '/api/documents':{items:[{id:'one',title:'<script>unsafe</script>',source:'manual',excerpt:'extracted',characters:9,classification:'internal'}]},
 '/api/claims':{items:[]},'/api/entities':{items:[]},
 '/api/suites':{items:[]},'/api/gates':{items:[]},'/api/targets':{items:[]},
 '/api/models':{items:[]},'/api/rules':{items:[]},'/api/circuits':{items:[]},
 '/api/requests':{items:[]},'/api/metrics':{p95_ms:null,p99_ms:null},
 '/api/datasets':{items:[]},'/api/experiments':{items:[]},'/api/dataset-profiles':{items:[]}
};
function fakeRoot(){return {innerHTML:'',querySelectorAll:()=>[],querySelector:()=>({onclick:null,onsubmit:null})};}
test(`${name} has an independent HTML and CSS identity`,()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/identity.css',import.meta.url),'utf8');
 const shell=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(html,/identity\.css/);assert.match(shell,/renderExperience/);
 assert.ok(css.length>3000,'UI styling must not be superficial');
 assert.ok(identity.sidebar&&identity.footer&&identity.icons.length>4);
 assert.doesNotMatch(shell,/Production-style engineering portfolio/);
});
test(`${name} renders real-backed operational panels with no unsanitized source names`,async()=>{
 const root=fakeRoot(),calls=[];
 await renderExperience({root,api:async path=>{calls.push(path);return fixtures[path]??{items:[]}},esc,go:()=>{},success:()=>{},error:()=>{}});
 assert.ok(root.innerHTML.includes(marker),`Expected distinctive UI marker ${marker}`);
 assert.ok(calls.includes(criticalRoute),`Did not load ${criticalRoute}`);
 assert.doesNotMatch(root.innerHTML,/<script>unsafe<\/script>/);
 assert.ok(root.innerHTML.length>1200);
});

test(`${name} presents branded read-only mode without exposing protected data`,async()=>{
 const root=fakeRoot();
 await renderExperience({root,api:async()=>{throw Error('Unauthorized (HTTP 401)')},esc,go:()=>{},success:()=>{},error:()=>{}});
 assert.match(root.innerHTML,/PRIVATE WORKSPACE/);
 assert.match(root.innerHTML,/Enter access key/);
 assert.ok(root.innerHTML.includes(marker));
});

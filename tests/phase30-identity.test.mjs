import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const script=join(root,'scripts/verify-deployment-identity.mjs');
const run=(file,env={})=>spawnSync(process.execPath,[file],{encoding:'utf8',env:{...process.env,...env}});
function isolated(){
 const dir=mkdtempSync(join(tmpdir(),'deployment-guard-'));
 mkdirSync(join(dir,'scripts'));mkdirSync(join(dir,'.github/workflows'),{recursive:true});
 for(const file of ['scripts/verify-deployment-identity.mjs','scripts/bootstrap-d1.sh','wrangler.jsonc','.github/workflows/deploy.yml'])copyFileSync(join(root,file),join(dir,file));
 return dir;
}
test('valid configuration and GitHub repository are accepted',()=>{
 const r=run(script,{GITHUB_REPOSITORY:'amiddlebrook/'+"KestrelMesh"});
 assert.equal(r.status,0,r.stderr);
});
test('GitHub repo mismatch rejects deployment',()=>{
 const r=run(script,{GITHUB_REPOSITORY:'amiddlebrook/another-app'});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/GitHub owner\/repository mismatch/);
});
test('misbound D1 rejects deployment before migrations',()=>{
 const dir=isolated();try{
  const file=join(dir,'wrangler.jsonc'),cfg=JSON.parse(readFileSync(file,'utf8'));
  cfg.d1_databases[0].database_name='portfolio-another-app-db';writeFileSync(file,JSON.stringify(cfg));
  const r=run(join(dir,'scripts/verify-deployment-identity.mjs'));
  assert.notEqual(r.status,0);assert.match(r.stderr,/wrong D1 database name/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('misnamed Worker script rejects deployment',()=>{
 const dir=isolated();try{
  const file=join(dir,'wrangler.jsonc'),cfg=JSON.parse(readFileSync(file,'utf8'));
  cfg.name='portfolio-another-app';writeFileSync(file,JSON.stringify(cfg));
  const r=run(join(dir,'scripts/verify-deployment-identity.mjs'));
  assert.notEqual(r.status,0);assert.match(r.stderr,/wrong Cloudflare Worker script/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('remote AI enabled by default rejects deployment',()=>{
 const dir=isolated();try{
  const file=join(dir,'wrangler.jsonc'),cfg=JSON.parse(readFileSync(file,'utf8'));
  cfg.vars.FREE_AI_ENABLED='true';writeFileSync(file,JSON.stringify(cfg));
  const r=run(join(dir,'scripts/verify-deployment-identity.mjs'));
  assert.notEqual(r.status,0);assert.match(r.stderr,/Remote AI must default to disabled/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});

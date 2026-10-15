/** Zero-dependency static asset verification for Worker Assets deployment. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=join(project,'public');
const name=JSON.parse(readFileSync(join(project,'package.json'),'utf8')).name.replace('portfolio-','');
const expected={rivetflow:['preflight','Runbook preflight','/api/lab/preflight'],signalbench:['regressionlab','Regression matrix','/api/lab/regressions'],proofatlas:['citationlab','Citation integrity ledger','/api/lab/citations'],kestrelmesh:['routinglab','Traffic routing simulator','/api/lab/routing/replay'],gradientfoundry:['datasetlab','Dataset quality lab','/api/lab/dataset-quality']};
assert.ok(expected[name],`Unexpected project ${name}`);
const read=(file)=>readFileSync(join(publicDir,file),'utf8');
const html=read('index.html');
for(const [,path] of html.matchAll(/(?:href|src)="\/(.*?)"/g))assert.ok(existsSync(join(publicDir,path)),`Missing asset ${path}`);
const config=read('config.js'),app=read('app.js'),lab=read('domain-lab.js');
assert.ok(config.includes('"id":"'+expected[name][0]+'"'),'Dedicated navigation route missing');
assert.ok(app.includes('renderDomainLab')&&app.includes("spec?.custom==='domainlab'"),'Lab route not mounted');
assert.ok(lab.includes(expected[name][1])&&lab.includes(expected[name][2]),'Dedicated product analysis missing');
for(const file of readdirSync(publicDir).filter(f=>f.endsWith('.js'))){
 for(const [,path] of read(file).matchAll(/\bfrom\s+["'](\.\/[^"']+)["']/g))
  assert.ok(existsSync(resolve(publicDir,path)),`Broken JS import ${file} -> ${path}`);
}
for(const [filename,asset] of [['domain-lab.css',read('domain-lab.css')],['domain-lab.js',lab]]){
 assert.ok(asset.length>500,`Missing meaningful implementation: ${filename}`);
}
console.log(`Asset preflight passed: ${name}, standalone UI and domain analysis linked`);

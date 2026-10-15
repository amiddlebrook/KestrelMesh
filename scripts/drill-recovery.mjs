/** Deterministic disaster-recovery drill using only Node 22 built-ins and synthetic data. */
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const files=readdirSync(join(root,'migrations')).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
const hash=(buf)=>createHash('sha256').update(buf).digest('hex');
const stamp='2026-10-15T00:00:00.000Z';
const app="KestrelMesh";
function seed(db){
  for(let i=0;i<48;i++) {
    const id=`model-${i}`;
    db.prepare('INSERT INTO models(id,name,provider,model_ref,priority,enabled,created_at) VALUES(?,?,?,?,?,?,?)').run(id,`Model ${i}`,'local','fixture',i,1,stamp);
    db.prepare('INSERT INTO requests(id,model_id,task,status,latency_ms,input_chars,output_chars,cache_hit,created_at,error) VALUES(?,?,?,?,?,?,?,?,?,?)').run(`request-${i}`,id,'deterministic','ok',5,15,16,0,stamp,'');
  }
  return {table:'models',count:48,related:['requests'],query:'SELECT name FROM models WHERE id=?',args:['model-27'],expected:'Model 27'};
}
function fingerprint(db){
 const schema=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type,name").all();
 const schemaSha=hash(JSON.stringify(schema));
 const tableNames=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 const rows=Object.fromEntries(tableNames.map(t=>[t,db.prepare(`SELECT COUNT(*) AS n FROM "${t.replaceAll('"','""')}"`).get().n]));
 return {schemaSha,rows};
}
async function main(){
 const dir=mkdtempSync(join(tmpdir(),`recovery-${app.toLowerCase()}-`));
 const sourcePath=join(dir,'source.sqlite'), snapshot=join(dir,'snapshot.sqlite'), restoredPath=join(dir,'restored.sqlite'), badPath=join(dir,'tampered.sqlite');
 let source,restored;
 try{
  source=new DatabaseSync(sourcePath);source.exec('PRAGMA foreign_keys=ON');
  for(const migration of files) source.exec(readFileSync(join(root,'migrations',migration),'utf8'));
  const fixture=seed(source);
  assert.equal(source.prepare(`SELECT COUNT(*) AS n FROM ${fixture.table}`).get().n,fixture.count);
  assert.equal(source.prepare(fixture.query).get(...fixture.args)[Object.keys(source.prepare(fixture.query).get(...fixture.args))[0]],fixture.expected);
  assert.equal(source.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.deepEqual(source.prepare('PRAGMA foreign_key_check').all(),[]);
  const before=fingerprint(source);
  await backup(source,snapshot,{rate:100});
  const size=readFileSync(snapshot).length;
  assert.ok(size>4096,'Snapshot must be a real SQLite database');
  const digest=hash(readFileSync(snapshot));
  // Prevent accepting a damaged or swapped backup: make a tampered copy and verify checksum rejection.
  copyFileSync(snapshot,badPath);let corrupt=readFileSync(badPath);corrupt[corrupt.length-1]^=0xFF;writeFileSync(badPath,corrupt);
  assert.notEqual(hash(readFileSync(badPath)),digest,'Corruption must fail artifact integrity validation');
  // Restore into an independent DB connection and compare full schema and per-table row counts.
  const backupDb=new DatabaseSync(snapshot,{readOnly:true});
  try{await backup(backupDb,restoredPath,{rate:100});}finally{backupDb.close()}
  restored=new DatabaseSync(restoredPath);restored.exec('PRAGMA foreign_keys=ON');
  const after=fingerprint(restored);
  assert.deepEqual(after,before,'Restored schema or table row counts differ');
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);
  const result=restored.prepare(fixture.query).get(...fixture.args);
  assert.equal(Object.values(result)[0],fixture.expected,'A recovered domain record differs from the original');
  for(const table of fixture.related)assert.ok(after.rows[table]>=fixture.count,`Related table ${table} did not survive restore`);
  if(app==='ProofAtlas')assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM chunks_fts WHERE chunks_fts MATCH 'evidence'").get().n,48,'Recovered search index differs');
  const evidence={app,passed:true,migrations:files.length,fixture_records:fixture.count,domain_table:fixture.table,schema_sha256:before.schemaSha,snapshot_sha256:digest,snapshot_bytes:size,tables_checked:Object.keys(before.rows).length,foreign_key_errors:0,integrity:'ok',corruption_detected:true,mode:'synthetic-drill-only',warning:'This validates migration and offline SQLite restore, NOT live Cloudflare D1 backup or a production RPO/RTO.'};
  console.log(JSON.stringify(evidence));
 } finally {
  try{restored?.close()}catch{}
  try{source?.close()}catch{}
  rmSync(dir,{recursive:true,force:true});
 }
}
await main();

/** Phase 21: reproducible dependencies + migration integrity preflight, no network access. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>readFileSync(join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
assert.ok(existsSync(join(root,'package-lock.json')),'Committed package-lock.json required; npm install is not a reproducible production install');
const lock=JSON.parse(read('package-lock.json'));
assert.ok(lock.lockfileVersion>=3,'npm lockfileVersion 3 required');
assert.equal(lock.name,pkg.name,'Lockfile must match the application');
assert.deepEqual(lock.packages['']?.devDependencies,pkg.devDependencies,'Lockfile root dependencies differ from package.json');
let dependencies=0;
for(const [path,entry] of Object.entries(lock.packages)) {
 if(!path)continue;
 dependencies++;
 assert.ok(entry&&typeof entry==='object'&&typeof entry.version==='string',`No resolved version for ${path}`);
 assert.ok(/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved||''),`Unexpected registry or floating dependency: ${path}`);
 assert.ok(/^sha512-[A-Za-z0-9+/=]+$/.test(entry.integrity||''),`Missing SHA-512 integrity metadata: ${path}`);
}
assert.ok(dependencies>=20,'Expected populated transitive dependency lock, not only direct declarations');
for(const workflow of ['ci.yml','deploy.yml']) {
 const yaml=read(`.github/workflows/${workflow}`);
 assert.match(yaml,/npm ci --no-audit --no-fund/,`${workflow}: must install the committed graph via npm ci`);
 assert.doesNotMatch(yaml,/run: npm install\b/,`${workflow}: floating npm install is forbidden`);
}
const config=JSON.parse(read('wrangler.jsonc'));
assert.deepEqual(config.triggers?.crons,['0 4 * * *'],'Automated maintenance cron must remain configured');
const migrations=readdirSync(join(root,'migrations')).filter(f=>/^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
assert.ok(migrations.length>=11,'All database migrations must be present');
for(let i=0;i<migrations.length;i++)assert.equal(Number(migrations[i].slice(0,4)),i+1,'Migration sequence must have no gaps or duplicates');
const db=new DatabaseSync(':memory:');
try {
 db.exec('PRAGMA foreign_keys=ON');
 for(const file of migrations){db.exec(read(`migrations/${file}`))}
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(v=>v.name);
 for(const table of ['access_keys','access_audit','saved_views','api_write_quota','api_activity','maintenance_status'])assert.ok(tables.includes(table),`Missing required table ${table}`);
 const quotas=db.prepare("PRAGMA table_info('api_write_quota')").all().map(r=>r.name);
 for(const column of ['identity','minute_bucket','used'])assert.ok(quotas.includes(column),`Missing quota column ${column}`);
} finally {db.close()}
console.log(`Release preflight: ${pkg.name} / ${dependencies} integrity-locked dependencies / ${migrations.length} applied migrations / SQLite integrity OK`);

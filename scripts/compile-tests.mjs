import { execFileSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
execFileSync('tsc',['-p','tsconfig.test.json'],{stdio:'inherit'});
mkdirSync('tests/.compiled',{recursive:true});
writeFileSync('tests/.compiled/package.json',JSON.stringify({type:'commonjs'}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
function luminance(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('palette supplies distinct semantic hues and legible reading surfaces',()=>{
 const html=readFileSync('public/index.html','utf8');assert.match(html,/href="\/palette-balance\.css"/);
 const css=readFileSync('public/palette-balance.css','utf8');
 const tokens={};for(const [,key,value] of css.matchAll(/--(bg|surface|text|muted|accent|info|success|warning):(#(?:[0-9a-fA-F]{6}))/g))tokens[key]=value;
 for(const name of ['bg','surface','text','muted','accent','info','success','warning'])assert.ok(tokens[name],`Missing ${name} color token`);
 assert.ok(contrast(tokens.text,tokens.bg)>=7,'Primary text must pass AAA contrast on app background');
 assert.ok(contrast(tokens.text,tokens.surface)>=7,'Primary text must pass AAA contrast on cards');
 assert.ok(contrast(tokens.muted,tokens.surface)>=4.5,'Supporting text must pass AA contrast');
 assert.equal(new Set([tokens.accent,tokens.info,tokens.success,tokens.warning]).size,4,'Semantic colors must be distinct');
 assert.match(css,/:focus-visible/,'Visible keyboard focus required');
});
import {compareReplays} from '../public/domain-lab.js';
test('replay comparison identifies changed routing, outages and recovered routes',()=>{
 const before={routes:[{ordinal:1,model_id:'a'},{ordinal:2,model_id:'b'},{ordinal:3,model_id:null}]};
 const after={routes:[{ordinal:1,model_id:'c'},{ordinal:2,model_id:null},{ordinal:3,model_id:'a'}]};
 assert.deepEqual(compareReplays(before,after),{compared:true,changed:3,newly_unroutable:1,recovered:1});
 assert.equal(compareReplays(null,after).compared,false);
});

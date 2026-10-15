import test from 'node:test';
import assert from 'node:assert/strict';
import profile from '../public/atlas-profile.js';
import {buildAtlasGraph,positionAtlas,escapeGraphText} from '../public/atlas.js';

test('graph uses only real input records and zero inferred relationships',()=>{
 const empty=buildAtlasGraph({},profile);
 assert.equal(empty.nodes.length,0);assert.equal(empty.links.length,0);assert.equal(empty.layers.length,4);
 const input=Object.fromEntries(profile.layers.map(([type],i)=>[type,[{id:`record-${i}`,name:`Real ${i}`}]]));
 const g=buildAtlasGraph(input,profile);
 assert.equal(g.nodes.length,4);assert.equal(g.links.length,0);
 assert.deepEqual(g.layers.map(l=>l.count),[1,1,1,1]);
});

test('graph links only explicit matching references, with duplicate links removed',()=>{
 const profileA={...profile,links:[[profile.layers[1][0],profile.layers[0][0],['parent_id','parent_name'],['id','name']]]};
 const [one,two]=profile.layers.map(l=>l[0]);
 const g=buildAtlasGraph({[one]:[{id:'root',name:'Anchor'},{id:'another',name:'Other'}],[two]:[{id:'child',parent_id:'root',parent_name:'Anchor'},{id:'lost',parent_id:'missing'}]},profileA);
 assert.equal(g.links.length,1);
 assert.ok(g.links[0].from.startsWith(two+':'));
 assert.ok(g.links[0].to.startsWith(one+':'));
});

test('relationship fields do not create cross-tenant or guessed connections',()=>{
 const [one,two]=profile.layers.map(l=>l[0]);
 const p={...profile,links:[[two,one,['foreign_id'],['id']]]};
 const g=buildAtlasGraph({[one]:[{id:'private-alpha'}],[two]:[{id:'public',foreign_id:'private-beta'}]},p);
 assert.equal(g.links.length,0);
});

test('cap communicates diagram sampling rather than pretending full cardinality',()=>{
 const [one]=profile.layers.map(l=>l[0]);
 const g=buildAtlasGraph({[one]:Array.from({length:36},(_,i)=>({id:`r${i}`}))},profile,{cap:20});
 assert.equal(g.nodes.length,20);
 assert.ok(g.truncated.join(' ').includes('16 not drawn'));
});

test('each layout produces finite inspectable node coordinates',()=>{
 const input=Object.fromEntries(profile.layers.map(([type])=>[type,Array.from({length:7},(_,i)=>({id:`${type}-${i}`}))]));
 const g=buildAtlasGraph(input,profile);
 for(const mode of ['lanes','lineage','clusters','radial','mesh']){
  const pos=positionAtlas(g,mode);
  assert.equal(pos.positions.size,g.nodes.length);
  assert.ok(pos.width>0&&pos.height>0);
  for(const p of pos.positions.values())assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
});

test('unsafe source strings are escaped for HTML and SVG markup',()=>{
 assert.equal(escapeGraphText(`<svg onload="alert('x')">&`),'&lt;svg onload=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
 const [one]=profile.layers.map(l=>l[0]);
 const g=buildAtlasGraph({[one]:[{id:'<tag>',name:'<img src=x onerror=evil()>'}]},profile);
 assert.equal(g.nodes[0].title,'<img src=x onerror=evil()>');
 assert.ok(escapeGraphText(g.nodes[0].title).includes('&lt;img'));
});

test('ambiguous duplicate label references are not displayed as verified links',()=>{
 const [one,two]=profile.layers.map(l=>l[0]);
 const p={...profile,links:[[two,one,['parent_name'],['name']]]};
 const g=buildAtlasGraph({[one]:[{name:'Duplicated'},{name:'Duplicated'}],[two]:[{name:'Child',parent_name:'Duplicated'}]},p);
 assert.equal(g.links.length,0);
});

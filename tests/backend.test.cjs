const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {scanSkills} = require('../lib/catalog.cjs');
const {createStore} = require('../lib/store.cjs');

async function sandbox(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'folio-')); t.after(()=>fs.rm(dir,{recursive:true,force:true})); return dir; }
async function skill(root, name, text) {const dir=path.join(root,name); await fs.mkdir(dir,{recursive:true}); await fs.writeFile(path.join(dir,'SKILL.md'),text); return dir;}
test('catalog follows symlinks without cycles, merges identical files, and retains name conflicts', async t=>{
 const dir=await sandbox(t), root=path.join(dir,'.agents/skills');
 const a=await skill(root,'one','---\nname: writer\ndescription: >-\n  Write polished\n  articles and prose.\n---\n# Instructions\nWrite clearly.');
 await skill(root,'copy','---\nname: writer\ndescription: >-\n  Write polished\n  articles and prose.\n---\n# Instructions\nWrite clearly.');
 await skill(root,'conflict','---\nname: writer\ndescription: Different writing method\n---\nSomething else');
 await skill(root,'node_modules/ignored','---\nname: ignored\n---\nNo');
 await fs.symlink(root,path.join(root,'cycle')); await fs.symlink(a,path.join(root,'alias'));
 const out=await scanSkills([root]); assert.equal(out.skills.length,2);
 const merged=out.skills.find(s=>s.body.includes('Write clearly.'));
 assert.equal(merged.name,'writer'); assert.equal(merged.description,'Write polished articles and prose.');
 assert.equal(merged.category,'Writing'); assert.equal(merged.source,'Personal'); assert.equal(merged.locations.length,2);
 assert.match(merged.id,/^[a-f0-9]{16}$/); assert.equal((await scanSkills([root])).skills.find(s=>s.body===merged.body).id,merged.id);
});
test('catalog reports inaccessible roots and reads quoted colons and literal descriptions', async t=>{
 const dir=await sandbox(t); await skill(dir,'video','---\nname: "Video: editor"\ndescription: |\n  Edit a video.\n  Add audio.\n---\nBody');
 const out=await scanSkills([dir,path.join(dir,'missing')]); assert.equal(out.skills[0].name,'Video: editor'); assert.equal(out.skills[0].category,'Video & Audio'); assert.ok(out.warnings.length);
});
test('catalog parses multiline quoted YAML with nested metadata and reports malformed frontmatter', async t=>{
 const dir=await sandbox(t), root=path.join(dir,'.claude/skills');
 await skill(root,'quoted',`---\nname: quoted-writer\ndescription: "Write polished articles\n  with thoughtful examples and\n  useful conclusions."\nmetadata:\n  name: nested-name\n  tags:\n    - writing\n---\n# Body`);
 await skill(root,'broken',`---\nname: [unfinished\ndescription: bad\n---\nBody`);
 const out=await scanSkills([root]);
 const parsed=out.skills.find(s=>s.name==='quoted-writer');
 assert.equal(parsed.description,'Write polished articles with thoughtful examples and useful conclusions.');
 assert.equal(parsed.source,'Personal');
 assert.ok(out.skills.some(s=>s.name==='broken'));
 assert.ok(out.warnings.some(s=>/frontmatter/i.test(s)));
});
test('clear skill names take category priority over incidental description words', async t=>{
 const dir=await sandbox(t);
 const expected={
  'job-description-analyzer':'Career','offer-comparison-analyzer':'Career','reference-list-builder':'Career',
  'executing-plans':'Productivity','writing-plans':'Productivity','ai-sdk':'Development',
  'agent-browser-verify':'Development','analytical-dashboard':'Design'
 };
 for(const name of Object.keys(expected))await skill(dir,name,`---\nname: ${name}\ndescription: Write useful research notes and video examples.\n---\nBody ${name}`);
 const {skills}=await scanSkills([dir]);
 for(const item of skills)assert.equal(item.category,expected[item.name],item.name);
});
test('store persists allowed metadata and rejects unsafe or excessive data', async t=>{
 const dir=await sandbox(t), file=path.join(dir,'nested/state.json'), store=createStore(file);
 assert.deepEqual(await store.read(),{skills:{}});
 await store.updateSkill('abc',{favorite:true,notes:'Helpful'});
 await store.updateSkill('abc',{category:'Writing',reviews:[{id:'r1',date:'2026-09-14',title:'Draft',goal:'Write',iterations:'Two',lesson:'Be specific',output:'Local output'}]});
 assert.equal((await createStore(file).read()).skills.abc.notes,'Helpful');
 await assert.rejects(store.updateSkill('abc',{favorite:'yes'}));
 await assert.rejects(store.updateSkill('__proto__',{favorite:true}));
 await assert.rejects(store.updateSkill('abc',{notes:'x'.repeat(30000)}));
 await assert.rejects(store.updateSkill('abc',{path:'/tmp/overwrite'}));
 assert.equal((await store.read()).skills.abc.favorite,true);
});
test('store never replaces malformed existing data', async t=>{
 const dir=await sandbox(t), file=path.join(dir,'state.json'); await fs.writeFile(file,'{broken');
 const store=createStore(file); await assert.rejects(store.read()); await assert.rejects(store.updateSkill('abc',{favorite:true}));
 assert.equal(await fs.readFile(file,'utf8'),'{broken');
});
test('store serializes concurrent updates without losing metadata', async t=>{
 const dir=await sandbox(t), store=createStore(path.join(dir,'state.json'));
 await Promise.all([store.updateSkill('abc',{favorite:true}),store.updateSkill('def',{notes:'Keep'})]);
 assert.equal(Object.keys((await store.read()).skills).length,2);
});
test('relationship labels are explicit, validated and preserve existing library metadata', async t=>{
 const dir=await sandbox(t), file=path.join(dir,'state.json'), store=createStore(file);
 await store.updateSkill('existing',{notes:'Keep my notes',favorite:true});
 assert.equal((await store.read()).skills.existing.relationship,undefined);
 for(const relationship of ['auto','created','adapted','installed','unclassified']) {
  await store.updateSkill('existing',{relationship});
  const saved=(await createStore(file).read()).skills.existing;
  assert.equal(saved.relationship,relationship);
  assert.equal(saved.notes,'Keep my notes'); assert.equal(saved.favorite,true);
 }
 for(const relationship of ['github','',null,{},true]) await assert.rejects(store.updateSkill('existing',{relationship}));
 assert.equal((await store.read()).skills.existing.relationship,'unclassified');
});

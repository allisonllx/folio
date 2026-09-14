const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {fingerprintFolder}=require('../lib/fingerprint.cjs');
const {scanSkills}=require('../lib/catalog.cjs');
const {effective}=require('../renderer/relationships.js');
async function setup(t){const home=await fs.mkdtemp(path.join(os.tmpdir(),'folio-origin-'));t.after(()=>fs.rm(home,{recursive:true,force:true}));return home;}
async function write(p,text){await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,text);}
async function makeSkill(folder){await write(path.join(folder,'SKILL.md'),'---\nname: writer\ndescription: Write an article.\n---\nUse references.');await write(path.join(folder,'references/voice.md'),'Original voice');}
async function lock(home,folder,hash){await write(path.join(home,'.agents/.skill-lock.json'),JSON.stringify({version:3,skills:{writer:{source:'example/skills',sourceType:'github',sourceUrl:'https://github.com/example/skills.git',skillPath:'skills/writer/SKILL.md',skillFolderHash:hash,updatedAt:'2026-09-14'}}}));}
test('folder fingerprint equals Git tree including nested files, executable modes and symlinks',async t=>{
 const home=await setup(t);await makeSkill(home);await write(path.join(home,'run.sh'),'echo hello\n');await fs.chmod(path.join(home,'run.sh'),0o755);await fs.symlink('SKILL.md',path.join(home,'alias'));
 execFileSync('git',['init','-q',home]);execFileSync('git',['-C',home,'add','.']);const expected=execFileSync('git',['-C',home,'write-tree'],{encoding:'utf8'}).trim();
 assert.equal((await fingerprintFolder(home)).gitTree,expected);
 const before=await fingerprintFolder(home);await write(path.join(home,'references/voice.md'),'Changed voice');assert.notEqual((await fingerprintFolder(home)).gitTree,before.gitTree);
});
test('lockfile verifies whole folder; changes suggest adaptation; refreshed upstream hash restores unchanged',async t=>{
 const home=await setup(t),root=path.join(home,'.agents/skills'),folder=path.join(root,'writer');await makeSkill(folder);
 await lock(home,folder,(await fingerprintFolder(folder)).gitTree);
 const scan=()=>scanSkills([root],{home});
 let skill=(await scan()).skills[0];assert.equal(skill.provenance.autoRelationship,'installed');assert.equal(skill.provenance.status,'verified');
 await write(path.join(folder,'references/voice.md'),'Local revision');skill=(await scan()).skills[0];assert.equal(skill.provenance.autoRelationship,'unclassified');assert.equal(skill.provenance.suggestion,'adapted');
 await lock(home,folder,(await fingerprintFolder(folder)).gitTree);assert.equal((await scan()).skills[0].provenance.status,'verified');
});
test('untracked and name-only lookalikes are not inferred as installed',async t=>{
 const home=await setup(t),folder=path.join(home,'project/writer');await makeSkill(folder);await lock(home,folder,(await fingerprintFolder(folder)).gitTree);
 const skill=(await scanSkills([path.dirname(folder)],{home})).skills[0];assert.equal(skill.provenance.autoRelationship,'unclassified');
});
test('identical instructions with different references stay separate',async t=>{
 const home=await setup(t),a=path.join(home,'skills/a'),b=path.join(home,'skills/b');await makeSkill(a);await makeSkill(b);await write(path.join(b,'references/voice.md'),'Other voice');
 assert.equal((await scanSkills([path.join(home,'skills')],{home})).skills.length,2);
});
test('plugin config and matching versioned bundled source verify contents; stale caches and disabled plugins stay distinct',async t=>{
 const home=await setup(t),market=path.join(home,'market'),plugin=path.join(market,'plugins/writer'),cache=path.join(home,'.codex/plugins/cache/local/writer/1.0.0');
 await makeSkill(path.join(plugin,'skills/writer'));await write(path.join(plugin,'.codex-plugin/plugin.json'),JSON.stringify({name:'writer',version:'1.0.0'}));await fs.mkdir(path.dirname(cache),{recursive:true});await fs.cp(plugin,cache,{recursive:true});
 await write(path.join(market,'.agents/plugins/marketplace.json'),JSON.stringify({name:'local',plugins:[{name:'writer',source:{source:'local',path:'./plugins/writer'}}]}));
 const config=enabled=>`[plugins."writer@local"]\nenabled = ${enabled}\n[marketplaces.local]\nsource_type = "local"\nsource = ${JSON.stringify(market)}\n`;
 await write(path.join(home,'.codex/config.toml'),config(true));
 const scan=()=>scanSkills([path.join(home,'.codex/plugins/cache')],{home});
 let skill=(await scan()).skills[0];assert.equal(skill.provenance.autoRelationship,'installed',JSON.stringify(skill.provenance));assert.equal(skill.provenance.activation,'enabled');
 await write(path.join(home,'.codex/config.toml'),config(false));assert.equal((await scan()).skills[0].provenance.activation,'disabled');
 await write(path.join(plugin,'.codex-plugin/plugin.json'),JSON.stringify({name:'writer',version:'2.0.0'}));skill=(await scan()).skills[0];assert.equal(skill.provenance.autoRelationship,'unclassified');assert.equal(skill.provenance.status,'unverified');
});
test('malformed evidence never turns a local skill into a verified installation',async t=>{
 const home=await setup(t),folder=path.join(home,'.agents/skills/writer');await makeSkill(folder);await write(path.join(home,'.agents/.skill-lock.json'),'{broken');
 const out=await scanSkills([path.dirname(folder)],{home});assert.equal(out.skills[0].provenance.autoRelationship,'unclassified');assert.ok(out.warnings.some(w=>w.includes('lock')));
});
test('manual labels including unclassified survive changed evidence until automatic mode is selected',()=>{
 const verified={provenance:{autoRelationship:'installed'}},changed={provenance:{autoRelationship:'unclassified'}};
 assert.equal(effective(verified),'installed');
 for(const relationship of ['created','adapted','installed','unclassified']) {
  assert.equal(effective(verified,{relationship}),relationship);
  assert.equal(effective(changed,{relationship}),relationship);
 }
 assert.equal(effective(verified,{relationship:'auto'}),'installed');
 assert.equal(effective(changed,{relationship:'auto'}),'unclassified');
});

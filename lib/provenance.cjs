const fs=require('node:fs/promises');
const path=require('node:path');
const TOML=require('smol-toml');
const {fingerprintFolder}=require('./fingerprint.cjs');
const isRecord=v=>v&&typeof v==='object'&&!Array.isArray(v);
const inside=(root,file)=>{const rel=path.relative(root,file);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
async function json(file,warnings,label){
 try{const stat=await fs.stat(file);if(stat.size>8*1024*1024)throw new Error('Metadata file is too large.');return JSON.parse(await fs.readFile(file,'utf8'));}
 catch(error){if(error.code!=='ENOENT')warnings.push(`Could not read ${label}: ${error.message}`);return null;}
}
function unknown(extra={}){return {status:'unverified',autoRelationship:'unclassified',kind:'unknown',activation:'unknown',reason:'No installation evidence for this location. Choose a label if you know its history.',...extra};}
function compare(actual,expected,extra){
 if(!actual.gitTree)return unknown({...extra,reason:actual.error||'Could not fingerprint the entire skill folder.'});
 if(!/^[a-f0-9]{40}$/i.test(expected||''))return unknown({...extra,reason:'An installation record exists, but no supported original folder fingerprint is available.'});
 if(actual.gitTree===expected.toLowerCase())return {...unknown(),...extra,status:'verified',autoRelationship:'installed',reason:'The whole skill folder matches the recorded original, including scripts and references.',expectedHash:expected,actualHash:actual.gitTree};
 return {...unknown(),...extra,status:'changed',suggestion:'adapted',reason:'This folder differs from its recorded original. It may be your adaptation, a generated file, or an update not reflected in the record. Review before labeling.',expectedHash:expected,actualHash:actual.gitTree};
}
async function createProvenanceResolver({home,xdgStateHome}={},warnings=[]){
 if(!home)return async()=>unknown();
 try{home=await fs.realpath(home);}catch{/* Missing home has no reliable metadata. */}
 const lockPath=xdgStateHome?path.join(xdgStateHome,'skills/.skill-lock.json'):path.join(home,'.agents/.skill-lock.json');
 const lock=await json(lockPath,warnings,'Skills CLI lockfile');
 const records=lock?.version===3&&isRecord(lock.skills)?lock.skills:{};
 if(lock&&lock.version!==3)warnings.push('Unsupported Skills CLI lockfile version; automatic classification skipped.');
 let config={};
 try{const file=path.join(home,'.codex/config.toml');if((await fs.stat(file)).size>8*1024*1024)throw new Error('Config is too large.');config=TOML.parse(await fs.readFile(file,'utf8'));}
 catch(error){if(error.code!=='ENOENT')warnings.push(`Could not read Codex plugin settings: ${error.message}`);}
 const installRoots=await Promise.all(['.agents/skills','.claude/skills','.codex/skills'].map(async p=>{const dir=path.join(home,p);try{return await fs.realpath(dir);}catch{return dir;}}));
 const pluginCache=path.join(home,'.codex/plugins/cache'),marketCache=new Map(),hashCache=new Map();
 async function bundledPlugin(market,name){
  const key=market+'@'+name;if(marketCache.has(key))return marketCache.get(key);
  const setting=config.marketplaces?.[market];let result=null;
  if(setting?.source_type==='local'&&typeof setting.source==='string'){
   const root=path.resolve(setting.source.replace(/^~(?=\/|$)/,home));
   const manifest=await json(path.join(root,'.agents/plugins/marketplace.json'),warnings,'local marketplace manifest');
   const entry=Array.isArray(manifest?.plugins)?manifest.plugins.find(p=>p.name===name):null;
   if(entry?.source?.source==='local'&&typeof entry.source.path==='string'){
    const folder=path.resolve(root,entry.source.path);
    if(inside(root,folder)){
     const plugin=await json(path.join(folder,'.codex-plugin/plugin.json'),warnings,'bundled plugin manifest');
     if(plugin?.name===name&&typeof plugin.version==='string')result={folder,version:plugin.version};
    }
   }
  }
  marketCache.set(key,result);return result;
 }
 return async function resolve(skill,fingerprint){
  const folder=path.dirname(skill.path);
  if(inside(pluginCache,folder)){
   const [market,name,version,...relative]=path.relative(pluginCache,folder).split(path.sep);
   if(!market||!name||!version)return unknown({kind:'plugin'});
   const setting=config.plugins?.[`${name}@${market}`];
   const activation=setting?.enabled===false?'disabled':setting?.enabled===true?'enabled':'unknown';
   const extra={kind:'plugin',source:`${name}@${market}`,version,activation,recordPath:path.join(home,'.codex/config.toml')};
   const baseline=await bundledPlugin(market,name);
   if(!baseline||baseline.version!==version)return unknown({...extra,reason:baseline?'Cached version does not match the currently bundled source version.':'Plugin cache found, but no matching original bundle is available locally. Activation is only reported when explicit in local config.'});
   const original=path.join(baseline.folder,...relative);
   if(!hashCache.has(original))hashCache.set(original,await fingerprintFolder(original));
   const baselineHash=hashCache.get(original);
   if(!baselineHash.gitTree)return unknown({...extra,reason:'Bundled original could not be fully verified.'});
   return compare(fingerprint,baselineHash.gitTree,{...extra,baselinePath:original});
  }
  // A matching name elsewhere is not evidence that this file was installed.
  const root=installRoots.find(root=>path.dirname(folder)===root);
  const entry=root&&Object.hasOwn(records,path.basename(folder))?records[path.basename(folder)]:null;
  if(!isRecord(entry)||entry.sourceType!=='github'||typeof entry.source!=='string')return unknown();
  return compare(fingerprint,entry.skillFolderHash,{kind:'github',source:entry.source,sourceUrl:typeof entry.sourceUrl==='string'?entry.sourceUrl:'',version:entry.ref||'',updatedAt:entry.updatedAt||'',recordPath:lockPath,activation:'unknown'});
 };
}
module.exports={createProvenanceResolver};

const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const YAML = require('yaml');
const {fingerprintFolder}=require('./fingerprint.cjs');
const {createProvenanceResolver}=require('./provenance.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');

function metadata(text,file,warnings) {
 const match=text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!match){
  if(/^\uFEFF?---\r?\n/.test(text))warnings.push(`Malformed frontmatter in ${file}: missing closing delimiter.`);
  return {};
 }
 try {
  const doc=YAML.parseDocument(match[1],{schema:'core'});
  if(doc.errors.length)throw doc.errors[0];
  for(const warning of doc.warnings)warnings.push(`Frontmatter warning in ${file}: ${warning.message}`);
  const data=doc.toJS({maxAliasCount:100});
  if(!data || typeof data!=='object' || Array.isArray(data))throw new Error('Expected a YAML mapping.');
  const fields={};
  for(const key of ['name','description']) {
   if(data[key]===undefined)continue;
   if(typeof data[key]==='string')fields[key]=data[key].trim();
   else warnings.push(`Invalid frontmatter ${key} in ${file}: expected text.`);
  }
  return fields;
 }catch(error){warnings.push(`Malformed frontmatter in ${file}: ${error.message}`);return {};}
}
function categoryFor(name,description) {
 const normalizedName=name.toLowerCase().split(':').pop().replace(/[_\s]+/g,'-');
 const nameRules=[
  ['Career',/(?:^|-)(?:resume|career|interview|salary|linkedin|cover-letter|job-description|offer-comparison|reference-list|academic-cv)(?:-|$)/],
  ['Productivity',/^(?:executing|writing)-plans$/],
  ['Development',/^(?:ai-sdk|agent-browser(?:-verify)?)$/],
  ['Design',/^analytical-dashboard$/]
 ];
 const namedCategory=nameRules.find(([,re])=>re.test(normalizedName));
 if(namedCategory)return namedCategory[0];
 const text=`${name} ${description}`.toLowerCase();
 const rules=[
 ['Career',/resume|career|interview|job application|cover.letter|salary|linkedin|academic.cv/],
 ['Video & Audio',/video|audio|hyperframes|narrat|slideshow|motion.graphic|music|talking.head|captions/],
 ['Design',/\bdesign\b|figma|image|poster|visualiz|interface|portfolio/],
 ['Research',/research|scientific|literature|citation/],
 ['Writing',/writ|article|prose|edit.article|newsletter|copywriting|document/],
 ['Development',/code|codex|develop|debug|test|git|vercel|react|api|deploy|refactor|program|skill|software|migrat|architect|websit|next.js/],
 ['Productivity',/workflow|productiv|task|plan|meeting|note|calendar|organize|spreadsheet|notion|obsidian/]
 ];
 return rules.find(([,re])=>re.test(text))?.[0] || 'Other';
}
function sourceFor(root) {
 if(/[/\\]plugins[/\\]cache[/\\]/.test(root+path.sep))return 'Plugin';
 if(/[/\\]\.(?:agents|codex|claude)[/\\]skills(?:[/\\]|$)/.test(root))return 'Personal';
 return 'Project';
}
async function scanSkills(roots,options={}) {
 if(!Array.isArray(roots))throw new TypeError('Skill roots must be an array.');
 const warnings=[], entries=[], visited=new Set();
 const resolveProvenance=await createProvenanceResolver(options,warnings);
 async function visit(folder,root,depth) {
  if(depth>12){warnings.push(`Skipped deeply nested folder: ${folder}`);return;}
  let real,list;
  try {
   real=await fs.realpath(folder); if(visited.has(real))return; visited.add(real);
   list=await fs.readdir(real,{withFileTypes:true});
  }catch(error){warnings.push(`Could not read ${folder}: ${error.code || error.message}`);return;}
  list.sort((a,b)=>a.name.localeCompare(b.name,'en'));
  for(const item of list) {
   if(item.name==='node_modules'||item.name==='.git')continue;
   const file=path.join(real,item.name);
   try {
    const stat=item.isSymbolicLink()?await fs.stat(file):null;
    if(item.isDirectory()||stat?.isDirectory()){await visit(file,root,depth+1);continue;}
    if(item.name!=='SKILL.md'||(!item.isFile()&&!stat?.isFile()))continue;
    const realFile=await fs.realpath(file);
    if((await fs.stat(realFile)).size>2*1024*1024){warnings.push(`Skipped oversized skill: ${realFile}`);continue;}
    const body=await fs.readFile(realFile,'utf8'), meta=metadata(body,realFile,warnings);
    const name=meta.name||path.basename(path.dirname(realFile));
    const description=meta.description||'';
    entries.push({id:hash(realFile).slice(0,16),name,description,body,path:realFile,source:sourceFor(root),category:categoryFor(name,description),locations:[realFile]});
   }catch(error){warnings.push(`Could not read ${file}: ${error.code || error.message}`);}
  }
 }
 for(const root of roots) {
  const location=typeof root==='string'?root:root?.path;
  if(typeof location!=='string'){warnings.push('Skipped invalid skill root.');continue;}
  await visit(path.resolve(location),path.resolve(location),0);
 }
 entries.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 for(const entry of entries){
  entry.fingerprint=await fingerprintFolder(path.dirname(entry.path));
  entry.provenance=await resolveProvenance(entry,entry.fingerprint);
 }
 const grouped=new Map();
 for(const entry of entries){const key=entry.fingerprint.gitTree?entry.fingerprint.gitTree+JSON.stringify(entry.provenance):entry.path; if(grouped.has(key))grouped.get(key).locations.push(entry.path);else grouped.set(key,entry);}
 const skills=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'en')||a.path.localeCompare(b.path,'en'));
 return {skills,warnings};
}
module.exports={scanSkills};

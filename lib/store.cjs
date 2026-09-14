const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const forbidden=new Set(['__proto__','constructor','prototype']);
function record(value){return value!==null && typeof value==='object' && !Array.isArray(value);}
function validId(id){if(typeof id!=='string'||!id.length||id.length>128||forbidden.has(id)||!/^[a-zA-Z0-9_-]+$/.test(id))throw new TypeError('Invalid skill ID.');}
function string(value,name,max){if(typeof value!=='string'||value.length>max)throw new TypeError(`${name} must be text no longer than ${max} characters.`);}
function validatePatch(patch){
 if(!record(patch))throw new TypeError('Skill metadata must be an object.');
 for(const [key,value] of Object.entries(patch)) {
  if(key==='favorite'){if(typeof value!=='boolean')throw new TypeError('Favorite must be a boolean.');}
  else if(key==='category')string(value,'Category',100);
  else if(key==='notes')string(value,'Notes',20000);
  else if(key==='reviews'){
   if(!Array.isArray(value)||value.length>200)throw new TypeError('Reviews must be an array of up to 200 records.');
   for(const review of value){
    if(!record(review))throw new TypeError('Invalid review.');
    const limits={id:128,date:64,title:300,goal:10000,iterations:20000,lesson:20000,output:4000};
    for(const key of Object.keys(review))if(!Object.hasOwn(limits,key))throw new TypeError(`Unknown review field: ${key}`);
    for(const [field,max] of Object.entries(limits))string(review[field],`Review ${field}`,max);
   }
  } else throw new TypeError(`Unknown metadata field: ${key}`);
 }
}
function createStore(filePath){
 let queue=Promise.resolve();
 async function read(){
  let raw;try{raw=await fs.readFile(filePath,'utf8');}catch(error){if(error.code==='ENOENT')return {skills:{}};throw error;}
  let data;try{data=JSON.parse(raw);}catch{throw new Error('Saved library data is malformed. Existing file was preserved.');}
  if(!record(data)||!record(data.skills)||Object.keys(data).some(key=>key!=='skills'))throw new Error('Saved library data has an invalid structure. Existing file was preserved.');
  for(const [id,patch]of Object.entries(data.skills)){validId(id);validatePatch(patch);}
  return data;
 }
 function updateSkill(id,patch){
  const task=queue.then(async()=>{
   validId(id);validatePatch(patch);
   const data=await read();data.skills[id]={...(data.skills[id]||{}),...JSON.parse(JSON.stringify(patch))};
   await fs.mkdir(path.dirname(filePath),{recursive:true});
   const temp=`${filePath}.${randomUUID()}.tmp`;
   try{await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await fs.rename(temp,filePath);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
   return data.skills[id];
  });
  queue=task.catch(()=>{});return task;
 }
 return {read,updateSkill};
}
module.exports={createStore};

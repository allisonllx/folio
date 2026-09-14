const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');

// Git tree IDs allow comparison with Skills CLI v3's recorded GitHub tree SHA.
// Git metadata is excluded; scripts and references are read, never executed.
function objectHash(type,bytes){return createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest();}
async function fingerprintFolder(folder,{maxBytes=128*1024*1024,maxFiles=10000}={}){
 let bytes=0,files=0;
 async function tree(directory,depth){
  if(depth>24)throw new Error('Folder is too deeply nested to verify.');
  const entries=[];
  for(const item of await fs.readdir(directory,{withFileTypes:true})){
   if(item.name==='.git')continue;
   const file=path.join(directory,item.name),stat=await fs.lstat(file);
   let mode,digest;
   if(stat.isDirectory()){
    const child=await tree(file,depth+1);if(!child.count)continue;
    mode='40000';digest=child.digest;
   }else{
    if(++files>maxFiles || (bytes+=stat.size)>maxBytes)throw new Error('Folder exceeds verification size limits.');
    if(stat.isSymbolicLink()) {mode='120000';digest=objectHash('blob',Buffer.from(await fs.readlink(file)));}
    else if(stat.isFile()){
     mode=stat.mode&0o111?'100755':'100644';
     const content=await fs.readFile(file),after=await fs.lstat(file);
     if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error('Folder changed while it was being verified. Refresh to retry.');
     digest=objectHash('blob',content);
    }else throw new Error('Folder contains an unsupported file type.');
   }
   entries.push({name:item.name,mode,digest});
  }
  entries.sort((a,b)=>Buffer.compare(Buffer.from(a.name+(a.mode==='40000'?'/':'')),Buffer.from(b.name+(b.mode==='40000'?'/':''))));
  const data=Buffer.concat(entries.flatMap(e=>[Buffer.from(`${e.mode} ${e.name}\0`),e.digest]));
  return {digest:objectHash('tree',data),count:entries.length};
 }
 try{return {gitTree:(await tree(folder,0)).digest.toString('hex'),files,bytes};}
 catch(error){return {gitTree:null,files,bytes,error:error.message};}
}
module.exports={fingerprintFolder};

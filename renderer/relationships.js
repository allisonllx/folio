(function(root){
 const labels={unclassified:'Unclassified',created:'Created by me',adapted:'Adapted by me',installed:'Installed · unchanged'};
 function effective(skill,saved={}){
  return saved.relationship&&saved.relationship!=='auto'?saved.relationship:skill.provenance?.autoRelationship||'unclassified';
 }
 const api={labels,effective};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.folioRelationships=api;
})(globalThis);

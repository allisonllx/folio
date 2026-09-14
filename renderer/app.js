const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = { Writing:['#8d9575','#a1a789','#717f62'], Career:['#b88d70','#a57a63','#bc9c84'], Development:['#758d8b','#617d7a','#93a5a0'], Design:['#c4a165','#b59a70','#a78d64'], Research:['#8889a0','#797d91','#9b9caf'], 'Video & Audio':['#b77c69','#a36f60','#c3907c'], Productivity:['#8e9c80','#778e73','#a2ac8e'], Other:['#a79e8e','#928c7c','#b5aa99'] };
const shelfNotes = { Writing:'find the right words', Career:'your next chapter', Development:'make something work', Design:'give ideas a shape', Research:'follow your curiosity', 'Video & Audio':'stories in motion', Productivity:'a little more flow', Other:'room for discovery' };
let data = {skills:[],saved:{skills:{}}}, view = 'all', query = '', selected = null, tab = 'overview', reviewForm = false, toastTimer;
const meta = skill => data.saved.skills[skill.id] || {};
const category = skill => meta(skill).category || skill.category || 'Other';
const title = skill => skill.name.replace(/^[^:]+:/,'').replace(/^artifact-template-/, '').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const color = (skill, n=0) => (colors[category(skill)] || colors.Other)[n%3];
const prompt = skill => `Use the ${skill.name} skill from this local file:\n${skill.path}\n\nMy task: [describe what you want to make or accomplish]\n\nRead the skill instructions first. Ask me for any required inputs that are missing.`;
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4200); }
async function load(refresh=false) {
  $('#refresh-button').disabled=true;
  try {
    data=await window.folio.catalog(refresh);
    data.saved ||= {skills:{}}; data.saved.skills ||= {};
    $('#shortcut-label').textContent=data.shortcutReady?'⌃ ⌥ K to open':'Menu bar to open';
    $('#shortcut-details').textContent=data.shortcutReady?'Press Control + Option + K from any app to show or hide Folio. Use ⌘ K inside Folio to search.':'Use the Folio menu-bar icon to open the library. The global shortcut is unavailable (it may be in use). Use ⌘ K inside Folio to search.';
    $('#roots-list').innerHTML=data.roots.map(p=>`<div>${esc(p)}</div>`).join('');
    $('#data-path').textContent=data.dataPath;
    $('#warnings').hidden=!data.warnings?.length;
    $('#warnings').textContent=(data.warnings||[]).map(w=>typeof w==='string'?w:JSON.stringify(w)).join(' · ');
    render();
    if(refresh) toast('Your shelves are up to date.');
  } catch(error) {
    $('#shelves').innerHTML=`<div class="empty"><h2>We couldn’t open the library.</h2><p>${esc(error.message)}</p><p>Your skill files have not been changed. Try Refresh.</p></div>`;
    $('#result-count').textContent='Library unavailable';
  } finally { $('#refresh-button').disabled=false; }
}
function matching() {
  return data.skills.filter(skill => (view==='all'||view==='favorites'&&meta(skill).favorite||view==='reviews'&&meta(skill).reviews?.length||category(skill)===view) && (!query||`${skill.name} ${skill.description} ${category(skill)} ${meta(skill).notes||''}`.toLowerCase().includes(query)));
}
function render() {
  const cats=[...new Set(data.skills.map(category))].sort((a,b)=>Object.keys(colors).indexOf(a)-Object.keys(colors).indexOf(b));
  $('#all-count').textContent=data.skills.length;
  $('#fav-count').textContent=data.skills.filter(s=>meta(s).favorite).length;
  $('#review-count').textContent=data.skills.filter(s=>meta(s).reviews?.length).length;
  $('#categories').innerHTML=cats.map(cat=>`<button class="nav-item ${view===cat?'active':''}" data-view="${esc(cat)}"><span class="category-dot" style="--book-color:${(colors[cat]||colors.Other)[0]}"></span>${esc(cat)}<small>${data.skills.filter(s=>category(s)===cat).length}</small></button>`).join('');
  document.querySelectorAll('button[data-view]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.view===view);btn.onclick=()=>{view=btn.dataset.view;query='';$('#search').value='';render();window.scrollTo(0,0);};});
  const label=view==='all'?'All skills':view==='favorites'?'Favorites':view==='reviews'?'With run reviews':view;
  $('#breadcrumb').innerHTML=`Your library <span>/</span> ${esc(label)}`;
  $('#page-title').innerHTML=view==='all'?'A little library.<br>A lot of possibilities.':view==='favorites'?'The ones you<br>come back to.':view==='reviews'?'Good work leaves<br>a little wisdom.':`${esc(view)}.<br>A shelf of possibilities.`;
  $('#page-description').textContent=view==='reviews'?'Your experiences, iterations and lessons — kept with the skill.':view==='favorites'?'Your bookmarked skills, ready for another chapter.':'Rediscover what your agent can do. Pick a book and begin.';
  const list=matching();
  $('#result-count').textContent=`${list.length} ${list.length===1?'skill':'skills'}${query?' matching your search':view==='all'?` · ${cats.length} shelves`:''}`;
  $('#surprise-button').disabled=!list.length;
  if(!list.length) { $('#shelves').innerHTML=`<div class="empty"><span>▤</span><h2>No books on this shelf yet.</h2><p>${query?'Try another word, or clear your search.':view==='favorites'?'Open a skill and tap the heart to bookmark it.':view==='reviews'?'Open a skill and add your first run review.':'Install a skill in one of the folders listed in Library details, then refresh.'}</p></div>`;return; }
  const capacity=Math.max(3,Math.floor(($('#shelves').clientWidth-24)/158));
  $('#shelves').innerHTML=cats.filter(cat=>list.some(s=>category(s)===cat)).map(cat=>{
    const all=list.filter(s=>category(s)===cat).sort((a,b)=>(a.source==='Personal'?0:1)-(b.source==='Personal'?0:1)||a.name.localeCompare(b.name)); const books=view==='all'&&!query?all.slice(0,capacity):all;
    return `<section class="shelf-section"><div class="shelf-heading"><h2>${esc(cat)}</h2><span>${all.length}</span><small>${esc(shelfNotes[cat]||'room for discovery')}</small>${books.length<all.length?`<button class="see-shelf" data-shelf="${esc(cat)}">View all ${all.length} ↗</button>`:''}</div><div class="book-row">${books.map((s,i)=>`<button class="book" data-id="${s.id}" style="--book-color:${color(s,i)}" aria-label="${esc(title(s))}">${meta(s).favorite?'<span class="book-mark"></span>':''}<span class="book-top">${esc(s.source||'Local')}<span class="book-star">${['✧','⁕','⌁','✳'][i%4]}</span></span><span class="book-title">${esc(title(s))}</span><span class="book-desc">${esc(s.description||'Open to explore this skill’s instructions.')}</span><span class="book-bottom"><span>${meta(s).reviews?.length?`${meta(s).reviews.length} review${meta(s).reviews.length===1?'':'s'}`:'OPEN A POSSIBILITY'}</span><span>↗</span></span></button>`).join('')}</div></section>`;
  }).join('');
  document.querySelectorAll('.book').forEach(b=>b.onclick=()=>openSkill(b.dataset.id));
  document.querySelectorAll('.see-shelf').forEach(b=>b.onclick=()=>{view=b.dataset.shelf;render();window.scrollTo(0,0);});
}
function openSkill(id) {selected=data.skills.find(s=>s.id===id);tab='overview';reviewForm=false;renderDetail();$('#book-dialog').showModal();}
async function save(patch, message) {
  try {
    await window.folio.save(selected.id,patch);
    data.saved.skills[selected.id]={...meta(selected),...patch};
    render(); if(message) toast(message); return true;
  } catch(error) {toast(`Couldn’t save: ${error.message}`);return false;}
}
function renderDetail() {
  const s=selected,m=meta(s),reviews=m.reviews||[];
  $('#detail-content').innerHTML=`<div class="detail-header"><button class="close-dialog" id="close-book" aria-label="Close skill">×</button><div class="detail-mini" style="--book-color:${color(s)}"><span>✧</span><small>${esc(category(s))}</small></div><div class="detail-heading"><div class="eyebrow">${esc(s.source||'LOCAL')} SKILL · ${esc(category(s))}</div><h2 id="detail-title">${esc(title(s))}</h2><p>${esc(s.description||'Read the instructions to explore this skill.')}</p></div></div><div class="detail-actions"><button class="primary" id="copy-prompt">Copy starter prompt ↗</button><button class="secondary" id="reveal-file">Show in Finder</button><button class="favorite-btn" id="favorite" aria-label="${m.favorite?'Remove from favorites':'Favorite this skill'}">${m.favorite?'♥':'♡'}</button></div><div class="tabs">${[['overview','Overview'],['reviews','Run reviews'],['source','Instructions']].map(([key,label])=>`<button class="tab ${tab===key?'active':''}" data-tab="${key}" aria-label="${label}">${label}${key==='reviews'&&reviews.length?` (${reviews.length})`:''}</button>`).join('')}</div><div class="detail-body">${tab==='overview'?overview(s,m):tab==='source'?source(s):reviewContent(reviews)}</div>`;
  $('#close-book').onclick=()=>$('#book-dialog').close();
  $('#copy-prompt').onclick=async()=>{try{await window.folio.copy(prompt(s));toast('Starter prompt copied. Paste it into your agent and add your task.');}catch(e){toast(e.message);}};
  $('#reveal-file').onclick=()=>window.folio.reveal(s.id).catch(e=>toast(e.message));
  $('#favorite').onclick=async()=>{if(await save({favorite:!meta(s).favorite}))renderDetail();};
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;reviewForm=false;renderDetail();});
  if(tab==='overview'){
    $('#skill-category').onchange=async e=>{if(await save({category:e.target.value},'Moved to its new shelf.'))renderDetail();};
    $('#save-notes').onclick=()=>save({notes:$('#notes').value},'Your notes are saved on this Mac.');
  }
  if(tab==='reviews'){
    $('#add-review').onclick=()=>{reviewForm=true;renderDetail();$('#review-title').focus();};
    if(reviewForm){$('#cancel-review').onclick=()=>{reviewForm=false;renderDetail();};$('#review-form').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);const review={id:crypto.randomUUID(),date:new Date().toISOString(),title:String(form.get('title')).trim(),goal:String(form.get('goal')),iterations:String(form.get('iterations')),lesson:String(form.get('lesson')),output:String(form.get('output'))};if(!review.title){toast('Add a title for this review.');return;}if(await save({reviews:[review,...reviews]},'Review saved with this skill.')){reviewForm=false;renderDetail();}};}
    document.querySelectorAll('[data-delete-review]').forEach(btn=>btn.onclick=async()=>{const old=btn.textContent;if(old!=='Confirm delete'){btn.textContent='Confirm delete';return;}if(await save({reviews:reviews.filter(r=>r.id!==btn.dataset.deleteReview)},'Review deleted.'))renderDetail();});
  }
}
function overview(s,m) {return `<div class="detail-columns"><section><h3>A place on your shelf</h3><label for="skill-category">Shelf</label><select id="skill-category">${Object.keys(colors).map(c=>`<option ${category(s)===c?'selected':''}>${esc(c)}</option>`).join('')}</select><p class="hint">Suggested from the skill’s name and description. Move it wherever it makes sense to you.</p><label>Start with a clear task</label><div class="prompt-preview">${esc(`Use ${s.name} to help me…\n\n[Your task, inputs and desired result]`)}</div><p class="hint">The copied prompt includes the exact local skill path. It works on this Mac.</p></section><section><h3>Your margin notes</h3><label for="notes">Personal notes</label><textarea id="notes" rows="8" maxlength="20000" placeholder="What is this useful for? Anything you want to remember before using it?">${esc(m.notes||'')}</textarea><div class="form-footer"><span>Private to this library</span><button class="primary" id="save-notes">Save notes</button></div><p class="hint">Notes stay separate from the original skill instructions.</p></section></div>`;}
function source(s) {return `<h3>The original instructions</h3><p>Read directly from your installed skill. Folio never runs or edits these instructions.</p><pre class="source-pre">${esc(s.body)}</pre><label>Installed ${s.locations?.length>1?'locations':'location'}</label><div class="source-path">${(s.locations?.length?s.locations:[s.path]).map(esc).join('<br>')}</div>${s.locations?.length>1?'<p class="hint">Identical copies share this book. Different contents remain separate books.</p>':''}`;}
function reviewContent(reviews) {return `<div class="review-top"><h3>What you learned along the way</h3><button class="secondary" id="add-review">Add a review</button></div><p class="hint">Your own record of a run. Conversations aren’t captured automatically.</p>${reviewForm?`<form id="review-form" class="review-form"><label for="review-title">Review title</label><input id="review-title" name="title" type="text" required maxlength="200" placeholder="e.g. My first newsletter draft"><label for="review-goal">What were you trying to make?</label><textarea id="review-goal" name="goal" maxlength="10000" placeholder="The outcome you originally wanted…"></textarea><div class="form-grid"><div><label for="review-iterations">What did you change?</label><textarea id="review-iterations" name="iterations" maxlength="10000" placeholder="Corrections, iterations, missing context…"></textarea></div><div><label for="review-lesson">Lesson for next time</label><textarea id="review-lesson" name="lesson" maxlength="10000" placeholder="A reusable improvement, or just a preference for this task?"></textarea></div></div><label for="review-output">Output or session reference (optional)</label><input id="review-output" name="output" type="text" maxlength="2000" placeholder="Paste a link or local file path for your records"><div class="form-footer"><button type="button" class="secondary" id="cancel-review">Cancel</button><button type="submit" class="primary">Save review</button></div></form>`:''}${!reviews.length&&!reviewForm?'<div class="empty"><span>✎</span><h2>A little wiser with every try.</h2><p>Keep a useful result, a correction, or a lesson.<br>You don’t need to review every run.</p></div>':''}${reviews.map(r=>`<article class="review-card"><div class="review-title-row"><h4>${esc(r.title)}</h4><button data-delete-review="${esc(r.id)}">Delete</button></div><time>${esc(new Date(r.date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}))}</time>${[['goal','The intention'],['iterations','What changed'],['lesson','For next time'],['output','Output / session reference']].filter(([key])=>r[key]).map(([key,label])=>`<p><strong>${label}</strong>${esc(r[key])}</p>`).join('')}</article>`).join('')}`;}
$('#search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
$('#refresh-button').onclick=()=>load(true);
$('#surprise-button').onclick=()=>{const list=matching();if(list.length)openSkill(list[Math.floor(Math.random()*list.length)].id);};
$('.brand').onclick=e=>{e.preventDefault();view='all';query='';$('#search').value='';render();window.scrollTo(0,0);};
$('#about-button').onclick=()=>$('#about-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#search').focus();$('#search').select();}});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const rect=d.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)d.close();}}));
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
load();

/* Onglet « Musique » de l'admin : bibliothèque de morceaux Pixabay (fiches, import en lot, classement, licences, extraits).
   Utilise les globaux de admin.html : SB, KEY, TOKEN, api, get, esc, toast, $, render, TAB. */
(function(){
var TAX={ 'Mariage':['Oriental princier','Bohème chic','Méditerranéen','Kabyle','Romantique','Champêtre','Moderne','Princier','Cinématographique','Féerique','Classique'],
 'Anniversaire':['Enfant','Adulte','Girly chic','Pirate','Princesse','Jungle','Anniversaire surprise','Familial'],
 'Bébé':['Gender reveal','Baby shower','Annonce de grossesse','Naissance','Baptême','Premier anniversaire','Fête de bienvenue'],
 'Réceptions':['Noël','Nouvel An','Soirée jeux','Soirée casino','Halloween','Garden-party','Soirée chic','Soirée à thème'] };
var PX=/pixabay\.com\/(?:[a-z]{2}\/)?music\/([a-z0-9][a-z0-9\-]*?)-(\d+)\/?/i;
var M=null, MERR='', OPEN=null, F={cat:'',sub:'',st:'',q:'',fav:false}, REPORT=[], PEND=[], BUSY='';
var pub=function(path){ return SB+'/storage/v1/object/public/music/'+path.split('/').map(encodeURIComponent).join('/'); };
var label=function(t){ return t.title||('« '+t.slug.replace(/-/g,' ')+' »'); };
var tstr=function(t){ return (t.themes||[]).map(function(x){ return x.c+(x.s?' · '+x.s:''); }); };
var save=function(id,patch){ patch.updated_at=new Date().toISOString(); return api('/rest/v1/music_library?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)}); };

async function loadM(){ MERR=''; try{ M=await get('music_library?select=*&order=created_at.desc&limit=2000'); }catch(e){ M=null; MERR=String(e).slice(0,200); } if(TAB==='music') render(); }
window.musicCount=function(){ return M?M.filter(function(t){ return t.status!=='downloaded'; }).length:0; };

function parseThemes(spec){ var out=[],warn=[]; String(spec||'').split(/[;|]/).forEach(function(p){ p=p.trim(); if(!p) return; var a=p.split('/'),c=a[0].trim(),s=(a[1]||'').trim();
  var cat=Object.keys(TAX).find(function(k){ return k.toLowerCase()===c.toLowerCase(); }); if(!cat){ warn.push('catégorie inconnue « '+c+' »'); return; }
  if(!s){ out.push({c:cat,s:''}); return; } var sub=TAX[cat].find(function(x){ return x.toLowerCase()===s.toLowerCase(); }); if(!sub){ warn.push('sous-thème inconnu « '+s+' » dans '+cat); return; } out.push({c:cat,s:sub}); }); return {out:out,warn:warn}; }
function parseCSV(text){ var rows=[],row=[],cur='',q=false; for(var i=0;i<text.length;i++){ var ch=text[i]; if(q){ if(ch==='"'&&text[i+1]==='"'){cur+='"';i++;} else if(ch==='"') q=false; else cur+=ch; } else if(ch==='"') q=true; else if(ch===','||ch===';'&&false){ row.push(cur);cur=''; } else if(ch==='\n'){ row.push(cur);rows.push(row);row=[];cur=''; } else if(ch!=='\r') cur+=ch; } if(cur||row.length){ row.push(cur); rows.push(row); } return rows; }
function parseList(text, defThemes){
  text=text.trim(); var items=[];
  if(/^[\[{]/.test(text)){ var j=JSON.parse(text); j=Array.isArray(j)?j:(j.tracks||[j]); j.forEach(function(d){ items.push(typeof d==='string'?{url:d}:d); }); }
  else if(/^url\s*,/i.test(text.split('\n')[0])){ var r=parseCSV(text), h=r[0].map(function(x){ return x.trim().toLowerCase(); }); r.slice(1).forEach(function(c){ var o={}; h.forEach(function(k,i){ o[k]=(c[i]||'').trim(); }); items.push(o); }); }
  else text.split('\n').forEach(function(l){ l=l.trim(); if(!l||l[0]==='#') return; var p=l.split(/\s*;\s*/); items.push({url:p[0],themes:p.slice(1).join(';')}); });
  var good=[],problems=[];
  items.forEach(function(it){ var url=String(it.url||it.lien||''), m=PX.exec(url); if(!m){ problems.push('Lien non reconnu (attendu : pixabay.com/music/…-numéro/) : '+url.slice(0,70)); return; }
    var spec=it.themes||it.theme||''; if(!spec&&defThemes) spec=defThemes; var th=parseThemes(spec); th.warn.forEach(function(w){ problems.push(m[2]+' : '+w); });
    good.push({ pixabay_id:m[2], slug:m[1].toLowerCase(), url:'https://pixabay.com/music/'+m[1].toLowerCase()+'-'+m[2]+'/', title:it.title||it.titre||null, author:it.author||it.auteur||null, mood:it.mood||it.ambiance||null, themes:th.out }); });
  return {good:good,problems:problems}; }

async function doImport(){
  var txt=$('mimp').value; if(!txt.trim()) return toast('Collez d’abord vos liens');
  var dc=$('mdcat').value, ds=$('mdsub').value; var def=dc?(dc+(ds?'/'+ds:'')):'';
  try{ var r=parseList(txt,def); var have={}; (M||[]).forEach(function(t){ have[t.pixabay_id]=t; }); var add=[],upd=0, seen={};
    for(var i=0;i<r.good.length;i++){ var g=r.good[i]; if(seen[g.pixabay_id]) continue; seen[g.pixabay_id]=1; var e=have[g.pixabay_id];
      if(!e){ add.push(g); } else { var patch={}; ['title','author','mood'].forEach(function(k){ if(g[k]) patch[k]=g[k]; });
        if(g.themes.length){ var cur=e.themes||[]; g.themes.forEach(function(x){ if(!cur.some(function(y){ return y.c===x.c&&y.s===x.s; })) cur=cur.concat([x]); }); patch.themes=cur; }
        if(Object.keys(patch).length){ await save(e.id,patch); upd++; } } }
    for(var k=0;k<add.length;k+=100) await api('/rest/v1/music_library',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(add.slice(k,k+100))});
    REPORT=[{ok:1,t:add.length+' fiche(s) créée(s), '+upd+' mise(s) à jour.'}].concat(r.problems.map(function(p){ return {ok:0,t:p}; }));
    $('mimp').value=''; await loadM(); }catch(e){ REPORT=[{ok:0,t:'Import impossible : '+String(e.message||e).slice(0,200)}]; render(); } }

async function sha256(buf){ var h=await crypto.subtle.digest('SHA-256',buf); return Array.from(new Uint8Array(h)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join(''); }
async function decode(buf){ var AC=window.AudioContext||window.webkitAudioContext; var ac=new AC(); try{ return await ac.decodeAudioData(buf.slice(0)); } finally { try{ ac.close(); }catch(_){} } }
async function upload(bucket,path,blob,type){ var r=await fetch(SB+'/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+TOKEN,'Content-Type':type,'x-upsert':'true'},body:blob}); if(!r.ok) throw new Error((await r.text()).slice(0,160)); }
function norm(s){ return s.toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/\(\d+\)$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

async function filed(file,t){ // classe un MP3 sur la fiche t
  var buf=await file.arrayBuffer(); var dur=null; var head=new Uint8Array(buf.slice(0,3));
  if(file.size<4096||!((head[0]===0x49&&head[1]===0x44&&head[2]===0x33)||(head[0]===0xFF&&(head[1]&0xE0)===0xE0))) throw new Error('ce n’est pas un MP3 valide');
  try{ dur=(await decode(buf)).duration; }catch(_){ throw new Error('fichier corrompu (lecture impossible)'); }
  var h=await sha256(buf); var dup=(M||[]).find(function(x){ return x.sha256===h&&x.id!==t.id; }); if(dup) throw new Error('doublon : identique à « '+label(dup)+' »');
  var path='originals/'+t.slug+'-'+t.pixabay_id+'.mp3'; await upload('music',path,file,'audio/mpeg');
  await save(t.id,{status:'downloaded',storage_path:path,sha256:h,duration:Math.round(dur*10)/10,size_bytes:file.size}); t.status='downloaded'; t.sha256=h; return dur; }

async function doFiles(files){
  BUSY='Traitement de '+files.length+' fichier(s)…'; render(); REPORT=[]; PEND=[];
  var byId={}; (M||[]).forEach(function(t){ byId[t.pixabay_id]=t; });
  for(var i=0;i<files.length;i++){ var f=files[i], st=norm(f.name), m=/(\d{4,})$/.exec(st), t=m&&byId[m[1]];
    if(!/\.mp3$/i.test(f.name)){ REPORT.push({ok:0,t:f.name+' : ignoré (pas un MP3)'}); continue; }
    if(!t){ PEND.push(f); REPORT.push({ok:2,t:f.name+' : à associer à la main (numéro non reconnu)'}); continue; }
    if(t.status==='downloaded'&&t.sha256){ try{ var hh=await sha256(await f.arrayBuffer()); if(hh===t.sha256){ REPORT.push({ok:2,t:f.name+' : déjà dans la bibliothèque'}); continue; } }catch(_){} }
    try{ var d=await filed(f,t); REPORT.push({ok:1,t:f.name+' → classé ('+Math.round(d)+' s)'}); }catch(e){ REPORT.push({ok:0,t:f.name+' : '+e.message}); } }
  BUSY=''; await loadM(); }

async function doAssign(i){ var f=PEND[i], id=document.querySelector('[data-pe="'+i+'"]').value, t=(M||[]).find(function(x){ return x.id===id; });
  try{ await filed(f,t); PEND.splice(i,1); REPORT.push({ok:1,t:f.name+' → associé à '+label(t)}); await loadM(); }catch(e){ toast(e.message); } }

function filteredM(){ return (M||[]).filter(function(t){ var th=t.themes||[]; return (!F.cat||th.some(function(x){ return x.c===F.cat&&(!F.sub||x.s===F.sub); }))&&(!F.fav||t.favorite)&&
  (!F.q||(label(t)+' '+(t.author||'')+' '+t.pixabay_id+' '+(t.mood||'')).toLowerCase().indexOf(F.q.toLowerCase())>-1)&&
  (!F.st||(F.st==='todo'&&t.status!=='downloaded')||(F.st==='dl'&&t.status==='downloaded')||(F.st==='ok'&&t.legal_status==='validated')||(F.st==='nok'&&t.legal_status!=='validated')||(F.st==='blk'&&t.legal_status==='blocked')); }); }

function pill(txt,c){ return '<span class="pill" style="display:inline-block;border:1px solid '+({ok:'#2d7a4f',warn:'#b7791f',bad:'#b3261e'}[c]||'#ccc')+';color:'+({ok:'#2d7a4f',warn:'#b7791f',bad:'#b3261e'}[c]||'#777')+';border-radius:10px;padding:0 8px;font-size:12px;margin:1px">'+txt+'</span>'; }
function detail(t){
  var dl=t.status==='downloaded', has=(t.themes||[]).map(function(x){ return x.c+'/'+x.s; });
  var th=Object.keys(TAX).map(function(c){ return '<div style="font-weight:600;margin-top:6px">'+c+'</div>'+TAX[c].map(function(s){ return '<label style="display:inline-block;margin:2px 10px 2px 0;font-size:13px"><input type="checkbox" data-mth="'+esc(c)+'|'+esc(s)+'" '+(has.indexOf(c+'/'+s)>-1?'checked':'')+'> '+esc(s)+'</label>'; }).join(''); }).join('');
  return '<div style="padding:10px 0" data-box="'+t.id+'"><div style="margin-bottom:8px"><a href="'+esc(t.url)+'" target="_blank" rel="noopener">Ouvrir la page Pixabay ↗</a> <span class="m">n° '+t.pixabay_id+'</span></div>'+
  (dl?'<audio controls preload="none" style="width:100%" id="maud" src="'+pub(t.storage_path)+'"></audio>':'<p class="m">Pas encore téléchargé : ouvrez la page Pixabay, téléchargez le MP3, puis utilisez « Récupérer mes téléchargements » en haut.</p>')+
  '<h4 style="margin:12px 0 4px">Fiche</h4><input id="mt-title" placeholder="Titre" value="'+esc(t.title)+'" style="width:49%"> <input id="mt-author" placeholder="Auteur" value="'+esc(t.author)+'" style="width:49%"><br><input id="mt-mood" placeholder="Ambiance (doux, festif…)" value="'+esc(t.mood)+'" style="width:100%;margin-top:6px">'+
  '<h4 style="margin:12px 0 4px">Catégories (plusieurs possibles)</h4><div>'+th+'</div>'+
  '<h4 style="margin:12px 0 4px">Licence & Content ID</h4><input id="mt-lic" placeholder="Licence (ex. Pixabay Content License)" value="'+esc(t.license_name)+'" style="width:49%"> <input id="mt-licu" placeholder="URL de la licence" value="'+esc(t.license_url)+'" style="width:49%">'+
  '<div style="margin-top:6px">Content ID <select id="mt-cid"><option value="unknown">non vérifié</option><option value="clear">libre</option><option value="flagged">signalé</option></select> &nbsp; Statut <select id="mt-leg"><option value="to_verify">à vérifier</option><option value="validated">validé</option><option value="blocked">bloqué</option></select></div>'+
  '<textarea id="mt-notes" placeholder="Notes, restrictions…" style="width:100%;min-height:50px;margin-top:6px">'+esc(t.license_notes)+'</textarea>'+
  '<div style="margin:6px 0"><button class="btn" data-ma="save" data-i="'+t.id+'">Enregistrer la fiche</button> <label class="btn ghost" style="cursor:pointer">Ajouter un justificatif<input type="file" id="mt-proof" accept="image/*,.pdf" hidden></label> <button class="btn ghost" data-ma="del" data-i="'+t.id+'">Supprimer la fiche</button></div>'+
  ((t.proofs||[]).length?'<p class="m">Justificatifs : '+t.proofs.map(esc).join(', ')+'</p>':'')+
  (dl?'<h4 style="margin:12px 0 4px">Extrait (8 à 10 s)</h4>Début (s) <input id="mc-s" type="number" min="0" step="0.5" value="'+(t.clip_start==null?0:t.clip_start)+'" style="width:70px"> Durée <input id="mc-d" type="number" min="8" max="10" step="0.5" value="'+(t.clip_dur||10)+'" style="width:60px"> Fondu entrée <input id="mc-fi" type="number" min="0" max="5" step="0.5" value="'+(t.fade_in==null?1:t.fade_in)+'" style="width:55px"> sortie <input id="mc-fo" type="number" min="0" max="5" step="0.5" value="'+(t.fade_out==null?1:t.fade_out)+'" style="width:55px"><div style="margin:6px 0"><button class="btn ghost" data-ma="here" data-i="'+t.id+'">Début = position du lecteur</button> <button class="btn ghost" data-ma="prev" data-i="'+t.id+'">Prévisualiser</button> <button class="btn" data-ma="clip" data-i="'+t.id+'">Créer l’extrait</button></div><audio id="mc-aud" controls style="width:100%;display:none"></audio>'+(t.clip_path?'<p class="m">Extrait enregistré :</p><audio controls preload="none" style="width:100%" src="'+pub(t.clip_path)+'"></audio>':''):'')+
  '</div>'; }

window.rMusic=function(){
  if(!M){ if(MERR) return '<p class="m" style="color:var(--err)">Données indisponibles : '+esc(MERR)+'</p>'; loadM(); return '<p class="m">Chargement…</p>'; }
  var L=filteredM(), todo=M.filter(function(t){ return t.status!=='downloaded'; });
  var catOpts='<option value="">Toutes catégories</option>'+Object.keys(TAX).map(function(c){ return '<option'+(F.cat===c?' selected':'')+'>'+c+'</option>'; }).join('');
  var subOpts='<option value="">Tous sous-thèmes</option>'+(TAX[F.cat]||[]).map(function(s){ return '<option'+(F.sub===s?' selected':'')+'>'+s+'</option>'; }).join('');
  var dcat='<option value="">(aucun)</option>'+Object.keys(TAX).map(function(c){ return '<option>'+c+'</option>'; }).join('');
  var h='<div class="card" style="padding:12px;margin-bottom:12px"><b>1 · Importer ma liste de liens Pixabay</b><p class="m">Un lien par ligne, ou un CSV (colonnes : url, title, author, themes, mood) ou un JSON. Thèmes : <code>Mariage/Romantique;Bébé/Naissance</code>. Les champs absents restent vides.</p>'+
   '<textarea id="mimp" placeholder="https://pixabay.com/music/…-123456/" style="width:100%;min-height:110px"></textarea><div style="margin:6px 0"><input type="file" id="mimpf" accept=".csv,.json,.txt"> Thème par défaut : <select id="mdcat">'+dcat+'</select> <select id="mdsub"><option value="">(général)</option></select> <button class="btn" data-ma="import">Créer les fiches</button></div></div>'+
   '<div class="card" style="padding:12px;margin-bottom:12px"><b>2 · Télécharger puis tout récupérer d’un coup</b><p class="m">Ouvrez chaque page Pixabay et touchez « Télécharger » vous-même. Ensuite, sélectionnez <b>tous</b> les MP3 téléchargés en une fois : chacun est reconnu par son numéro, vérifié, dédoublonné et rangé automatiquement.</p>'+
   '<button class="btn ghost" data-ma="next"'+(todo.length?'':' disabled')+'>Ouvrir la page suivante à télécharger ('+todo.length+')</button> <label class="btn" style="cursor:pointer">Récupérer mes téléchargements<input type="file" id="mfiles" accept="audio/mpeg,.mp3" multiple hidden></label>'+(BUSY?' <b>'+esc(BUSY)+'</b>':'')+
   REPORT.map(function(r){ return '<div class="m" style="color:'+(r.ok===1?'#2d7a4f':r.ok===2?'#b7791f':'#b3261e')+'">'+esc(r.t)+'</div>'; }).join('')+
   PEND.map(function(f,i){ return '<div style="margin-top:6px"><b>'+esc(f.name)+'</b> → <select data-pe="'+i+'">'+todo.map(function(t){ return '<option value="'+t.id+'">'+esc(label(t))+' ('+t.pixabay_id+')</option>'; }).join('')+'</select> <button class="btn" data-ma="assign" data-i="'+i+'">C’est ce morceau</button></div>'; }).join('')+'</div>'+
   '<div class="card" style="padding:12px;margin-bottom:12px"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select id="mfcat">'+catOpts+'</select><select id="mfsub">'+subOpts+'</select><input id="mfq" placeholder="Rechercher…" value="'+esc(F.q)+'"><select id="mfst"><option value="">Tous statuts</option><option value="dl"'+(F.st==='dl'?' selected':'')+'>Téléchargés</option><option value="todo"'+(F.st==='todo'?' selected':'')+'>À télécharger</option><option value="ok"'+(F.st==='ok'?' selected':'')+'>Validés</option><option value="nok"'+(F.st==='nok'?' selected':'')+'>Non validés</option><option value="blk"'+(F.st==='blk'?' selected':'')+'>Bloqués</option></select><label><input type="checkbox" id="mffav"'+(F.fav?' checked':'')+'> ★ Favoris</label><span class="m">'+L.length+' / '+M.length+' morceaux</span> <button class="btn ghost" data-ma="export">Exporter (JSON + CSV)</button></div></div>';
  var cov='<details style="margin-bottom:12px"><summary style="cursor:pointer"><b>Couverture des sous-thèmes</b> <span class="m">(objectif : 10 morceaux par sous-thème)</span></summary><div style="padding:8px 0">'+Object.keys(TAX).map(function(c){ return '<div style="margin:6px 0"><b>'+c+'</b><br>'+TAX[c].map(function(sb){ var n=M.filter(function(t){ return (t.themes||[]).some(function(x){ return x.c===c&&x.s===sb; }); }).length; return pill(esc(sb)+' · '+n,n>=10?'ok':n===0?'bad':'warn'); }).join(' ')+'</div>'; }).join('')+'</div></details>';
  h+=cov;
  if(!M.length) h+='<p class="m">Aucun morceau. Collez vos liens ci-dessus.</p>';
  h+=L.map(function(t){ var open=OPEN===t.id; return '<div class="card" style="padding:10px 12px;margin-bottom:8px"><div style="display:flex;gap:10px;align-items:center;cursor:pointer" data-ma="open" data-i="'+t.id+'"><span data-ma="fav" data-i="'+t.id+'" style="font-size:20px;color:'+(t.favorite?'#6e1b2f':'#c9b27a')+'">'+(t.favorite?'★':'☆')+'</span><div style="flex:1"><b>'+esc(label(t))+'</b><br><span class="m">'+(tstr(t).map(esc).join(' · ')||'non classé')+(t.mood?' · '+esc(t.mood):'')+(t.duration?' · '+Math.round(t.duration)+' s':'')+'</span></div><div>'+pill(t.status==='downloaded'?'téléchargé':'à télécharger',t.status==='downloaded'?'ok':'warn')+pill(t.legal_status==='validated'?'validé':t.legal_status==='blocked'?'bloqué':'à vérifier',t.legal_status==='validated'?'ok':t.legal_status==='blocked'?'bad':'warn')+(t.clip_path?pill('extrait','ok'):'')+'</div></div>'+(open?detail(t):'')+'</div>'; }).join('');
  return h; };

/* ---- extrait : découpe + fondus dans le navigateur, export WAV 16 bits ---- */
async function renderClip(t){ var s=+$('mc-s').value||0, d=Math.max(8,Math.min(10,+$('mc-d').value||10)), fi=Math.max(0,Math.min(+$('mc-fi').value||0,d/2)), fo=Math.max(0,Math.min(+$('mc-fo').value||0,d/2));
  var r=await fetch(pub(t.storage_path)); var buf=await decode(await r.arrayBuffer()); if(s+d>buf.duration) s=Math.max(0,buf.duration-d);
  var sr=44100, ch=Math.min(2,buf.numberOfChannels), n=Math.round(d*sr), off=new OfflineAudioContext(ch,n,sr), src=off.createBufferSource(); src.buffer=buf; var g=off.createGain();
  g.gain.setValueAtTime(fi?0:1,0); if(fi) g.gain.linearRampToValueAtTime(1,fi); g.gain.setValueAtTime(1,Math.max(fi,d-fo)); if(fo) g.gain.linearRampToValueAtTime(0,d);
  src.connect(g); g.connect(off.destination); src.start(0,s,d); var out=await off.startRendering();
  var len=out.length, bytes=44+len*ch*2, ab=new ArrayBuffer(bytes), v=new DataView(ab), w=function(o,str){ for(var i=0;i<str.length;i++) v.setUint8(o+i,str.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,bytes-8,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true); v.setUint32(24,sr,true); v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,len*ch*2,true);
  var o=44, chs=[]; for(var c=0;c<ch;c++) chs.push(out.getChannelData(c)); for(var i=0;i<len;i++) for(c=0;c<ch;c++){ var x=Math.max(-1,Math.min(1,chs[c][i])); v.setInt16(o,x<0?x*0x8000:x*0x7FFF,true); o+=2; }
  return {blob:new Blob([ab],{type:'audio/wav'}),s:s,d:d,fi:fi,fo:fo}; }

async function exportCat(){ var rows=M.filter(function(t){ return t.status==='downloaded'&&t.legal_status==='validated'&&t.content_id==='clear'; });
  var js=rows.map(function(t){ return {id:t.pixabay_id,title:t.title,slug:t.slug,author:t.author,pixabay_url:t.url,mood:t.mood,themes:t.themes,duration_s:t.duration,favorite:t.favorite,audio_url:pub(t.storage_path),clip_url:t.clip_path?pub(t.clip_path):null,license:{name:t.license_name,url:t.license_url,content_id:t.content_id,legal_status:t.legal_status,checked_at:t.license_checked_at,proofs:t.proofs}}; });
  var dl=function(name,txt,type){ var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:type})); a.download=name; a.click(); };
  dl('catalogue-musique.json',JSON.stringify({generated_at:new Date().toISOString(),count:js.length,tracks:js},null,2),'application/json');
  var q=function(x){ return '"'+String(x==null?'':x).replace(/"/g,'""')+'"'; };
  dl('catalogue-musique.csv','﻿'+['id','titre','auteur','url_pixabay','themes','ambiance','duree_s','audio_url','extrait_url','licence','content_id','statut'].join(';')+'\n'+js.map(function(t){ return [t.id,t.title,t.author,t.pixabay_url,(t.themes||[]).map(function(x){ return x.c+(x.s?'/'+x.s:''); }).join(' | '),t.mood,t.duration_s,t.audio_url,t.clip_url,t.license.name,t.license.content_id,t.license.legal_status].map(q).join(';'); }).join('\n'),'text/csv');
  toast(js.length+' morceau(x) validé(s) exporté(s)'); }

window.musicBind=function(){
  var root=$('list'); if(TAB!=='music'||!M) return;
  var sync=function(){ F.cat=$('mfcat').value; F.sub=$('mfsub').value; F.q=$('mfq').value; F.st=$('mfst').value; F.fav=$('mffav').checked; };
  ['mfcat','mfsub','mfst','mffav'].forEach(function(i){ $(i).onchange=function(){ if(i==='mfcat') F.sub=''; sync(); if(i==='mfcat') F.sub=''; render(); }; });
  $('mfq').onkeydown=function(e){ if(e.key==='Enter'){ sync(); render(); } }; $('mfq').onchange=function(){ sync(); render(); };
  $('mdcat').onchange=function(){ $('mdsub').innerHTML='<option value="">(général)</option>'+(TAX[$('mdcat').value]||[]).map(function(s){ return '<option>'+s+'</option>'; }).join(''); };
  $('mimpf').onchange=async function(e){ var f=e.target.files[0]; if(f) $('mimp').value=await f.text(); };
  $('mfiles').onchange=function(e){ if(e.target.files.length) doFiles(Array.prototype.slice.call(e.target.files)); };
  var pr=$('mt-proof'); if(pr) pr.onchange=async function(e){ var f=e.target.files[0]; if(!f) return; var t=M.find(function(x){ return x.id===OPEN; }); var nm=f.name.replace(/[^\w.\-]+/g,'_'); try{ await upload('music-proofs',t.pixabay_id+'/'+nm,f,f.type||'application/octet-stream'); await save(t.id,{proofs:(t.proofs||[]).concat([nm])}); toast('Justificatif enregistré'); await loadM(); }catch(er){ toast(er.message); } };
  root.querySelectorAll('[data-ma]').forEach(function(b){ b.onclick=async function(ev){ var a=b.dataset.ma, id=b.dataset.i, t=M.find(function(x){ return x.id===id; });
    if(a==='open'){ if(ev.target.dataset.ma==='fav') return; OPEN=(OPEN===id)?null:id; render(); return; }
    ev.stopPropagation();
    try{
    if(a==='fav'){ await save(id,{favorite:!t.favorite}); await loadM(); }
    else if(a==='import') doImport();
    else if(a==='next'){ var n=M.find(function(x){ return x.status!=='downloaded'; }); if(n) window.open(n.url,'_blank','noopener'); }
    else if(a==='assign') doAssign(+id);
    else if(a==='export') exportCat();
    else if(a==='del'){ if(!confirm('Supprimer cette fiche (et son fichier audio) ?')) return; if(t.storage_path) await api('/storage/v1/object/music/'+t.storage_path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE'}).catch(function(){}); if(t.clip_path) await api('/storage/v1/object/music/'+t.clip_path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE'}).catch(function(){}); await api('/rest/v1/music_library?id=eq.'+id,{method:'DELETE'}); OPEN=null; await loadM(); }
    else if(a==='save'){ var th=Array.prototype.map.call(document.querySelectorAll('[data-mth]:checked'),function(i){ var p=i.dataset.mth.split('|'); return {c:p[0],s:p[1]}; });
      var p={title:$('mt-title').value||null,author:$('mt-author').value||null,mood:$('mt-mood').value||null,themes:th,license_name:$('mt-lic').value||null,license_url:$('mt-licu').value||null,license_notes:$('mt-notes').value||null,content_id:$('mt-cid').value,legal_status:$('mt-leg').value,license_checked_at:new Date().toISOString()};
      if(p.legal_status==='validated'&&(!(p.license_name||'').trim()||p.content_id!=='clear')) return toast('Pour valider : indiquez la licence et mettez Content ID sur « libre ».');
      await save(id,p); toast('Fiche enregistrée'); await loadM(); }
    else if(a==='here'){ var au=$('maud'); if(au) $('mc-s').value=au.currentTime.toFixed(1); }
    else if(a==='prev'||a==='clip'){ b.disabled=true; var o=b.textContent; b.textContent='…'; try{ var r=await renderClip(t); $('mc-s').value=r.s;
        if(a==='prev'){ var ca=$('mc-aud'); ca.style.display=''; ca.src=URL.createObjectURL(r.blob); ca.play(); }
        else { var path='clips/'+t.slug+'-'+t.pixabay_id+'.wav'; await upload('music',path,r.blob,'audio/wav'); await save(id,{clip_path:path,clip_start:r.s,clip_dur:r.d,fade_in:r.fi,fade_out:r.fo}); toast('Extrait créé'); await loadM(); } } finally { b.disabled=false; b.textContent=o; } }
    }catch(er){ toast(String(er.message||er).slice(0,160)); } }; });
  var t=M.find(function(x){ return x.id===OPEN; }); if(t){ var c=$('mt-cid'),l=$('mt-leg'); if(c) c.value=t.content_id; if(l) l.value=t.legal_status; }
};
window.musicLoad=loadM;
})();

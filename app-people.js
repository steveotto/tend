"use strict";
/* ============ people override: clean cards, meta chips, category themes, Add person, filters ============
   Loads LAST. Only overrides the People CARD GRID; person profiles are untouched
   (profiles still show nextDateLine with planned chips). */
(function(){
/* ---------- styles ---------- */
var css=document.createElement("style");css.textContent=[
".pc-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}",
".pc-toggles{display:flex;gap:8px;flex-wrap:wrap}",
".pc-toggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 14px;font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-faint);cursor:pointer;transition:all .15s}",
".pc-toggle .pc-dot{width:8px;height:8px;border-radius:50%;background:#C8CEC9;flex:none;transition:background .15s}",
".pc-toggle.on{color:var(--ink);border-color:var(--forest);background:rgba(31,156,104,.06)}",
".pc-toggle.on .pc-dot{background:var(--pc-c,#1F9C68)}",
".pc-toggle[data-pfilter='marriage']{--pc-c:#B8912F}.pc-toggle[data-pfilter='parenting']{--pc-c:#4C7CA8}.pc-toggle[data-pfilter='friendships']{--pc-c:#C1663E}",
".person-card{position:relative;overflow:hidden}",
".person-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--pc-accent,transparent)}",
".person-card.pc-marriage{--pc-accent:#B8912F}.person-card.pc-parenting{--pc-accent:#4C7CA8}.person-card.pc-friendships{--pc-accent:#C1663E}",
".pc-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:9px 0 3px}",
".pc-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;letter-spacing:.01em;padding:3px 11px;border-radius:999px;background:#F2F4F1;color:var(--ink-soft);white-space:nowrap}",
".pc-chip.rel-marriage{background:rgba(184,145,47,.13);color:#8A6D1F}",
".pc-chip.rel-parenting{background:rgba(76,124,168,.13);color:#38648C}",
".pc-chip.rel-friendships{background:rgba(193,102,62,.13);color:#9C4F2C}",
".pc-chip.conn{background:#F2F4F1;font-weight:500}",
".pc-chip.pray{background:rgba(31,156,104,.1);color:#1F5C40}",
".pc-flabel{display:block;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-faint);margin:10px 0 4px}",
".pc-flabel span{text-transform:none;letter-spacing:0;font-weight:400}",
"#apPhoto+label{display:inline-flex;align-items:center}"
].join("");document.head.appendChild(css);

/* ---------- categories ---------- */
var CAT_LABEL={marriage:"Marriage",parenting:"Parenting",friendships:"Friendships"};
var CAT_AREA={marriage:"marriage",parenting:"parenting",friendships:"friendships"};
var MARRIAGE_WORDS=["spouse","wife","husband","partner"];
var FAMILY_WORDS=["son","daughter","father","dad","mother","mom","brother","sister","in-law","in law","grandchild","grandson","granddaughter","nephew","niece","bonus","family"];
function relCategory(rel){
 var r=(rel||"").toLowerCase();
 for(var i=0;i<MARRIAGE_WORDS.length;i++){if(r.indexOf(MARRIAGE_WORDS[i])>=0)return "marriage";}
 for(var j=0;j<FAMILY_WORDS.length;j++){if(r.indexOf(FAMILY_WORDS[j])>=0)return "parenting";}
 return "friendships";
}
function personCategory(p){return relCategory(p.relation)||"friendships";}
function relOptionsHTML(){
 var fam=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Father","Mother","Brother","Sister","Son-in-law","Daughter-in-law","Grandchild","Nephew","Niece","In-law"];
 var fr=["Friend","Close friend","Mentor","Mentee","Coworker","Neighbor","Small group friend","Accountability partner","Pastor","Other"];
 return '<optgroup label="Family">'+fam.map(function(r){return '<option value="'+r+'">'+r+'</option>';}).join("")+'</optgroup>'+
 '<optgroup label="Friends & others">'+fr.map(function(r){return '<option value="'+r+'">'+r+'</option>';}).join("")+'</optgroup>';
}

/* ---------- filter toggles (per device) ---------- */
function pfilters(){try{return JSON.parse(localStorage.getItem("tend:pfilters"))||{marriage:true,parenting:true,friendships:true};}catch(e){return {marriage:true,parenting:true,friendships:true};}}
function setPF(f){try{localStorage.setItem("tend:pfilters",JSON.stringify(f));}catch(e){}}

/* ---------- card date lines: birthday + anniversary ONLY ---------- */
function cardDateLines(p){
 var lines=[];
 (S.keyDates||[]).forEach(function(k){
  if(k.personId!==p.id||!/birth|anniv/i.test(k.label||""))return;
  var d=daysUntil(k);if(d<0)return;
  lines.push({d:d,html:'<div class="pf-next">'+esc(k.label)+' \u00B7 '+(d===0?"TODAY":"in "+d+" days")+'</div>'});
 });
 lines.sort(function(a,b){return a.d-b.d;});
 return lines.map(function(l){return l.html;}).join("")+personDateLines(p);
}

/* ---------- add-person modal ---------- */
function addPersonModalHTML(){
 return '<div class="modal" id="addPersonModal"><div class="box">'+
 '<h3>Add a person</h3>'+
 '<div class="pc-flabel">Name <span>- required</span></div><input id="apName" placeholder="Their name" style="width:100%;box-sizing:border-box">'+
 '<div class="pc-flabel">Photo <span>- optional</span></div>'+
 '<div style="display:flex;align-items:center;gap:12px">'+
 '<img id="apPhotoPreview" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:none">'+
 '<label class="btn ghost" for="apPhoto" style="cursor:pointer;margin:0">Choose photo</label>'+
 '<input id="apPhoto" type="file" accept="image/*" style="display:none">'+
 '<button class="del" id="apPhotoClear" type="button" title="remove photo" style="display:none">\u00D7</button></div>'+
 '<div class="pc-flabel">Relationship</div><select id="apRelation" style="width:100%;box-sizing:border-box">'+relOptionsHTML()+'</select>'+ 
 '<div class="pc-flabel">Birthday <span>- optional</span></div><input id="apBirthday" type="date" style="width:100%;box-sizing:border-box">'+ 
 '<div class="pc-flabel">Anniversary <span>- optional</span></div><input id="apAnniversary" type="date" style="width:100%;box-sizing:border-box">'+ 
 '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">'+ 
 '<button class="btn ghost" data-apclose type="button">Cancel</button>'+
 '<button class="btn" id="apCreate" type="button">Create person</button></div>'+
 '</div></div>';
}
function apOpen(){
 var m=el("addPersonModal");if(!m)return;
 el("apName").value="";el("apBirthday").value="";el("apAnniversary").value="";
 el("apRelation").selectedIndex=0;window._apPhoto=null;
 el("apPhotoPreview").style.display="none";el("apPhotoPreview").removeAttribute("src");
 el("apPhotoClear").style.display="none";el("apPhoto").value="";
 m.classList.add("open");
 setTimeout(function(){el("apName").focus();},50);
}
function apPickPhoto(file){
 var rd=new FileReader();
 rd.onload=function(){var im=new Image();im.onload=function(){
  try{
   var sz=Math.min(im.width,im.height),cv=document.createElement("canvas");cv.width=144;cv.height=144;
   var cx=cv.getContext("2d");cx.drawImage(im,(im.width-sz)/2,(im.height-sz)/2,sz,sz,0,0,144,144);
   window._apPhoto=cv.toDataURL("image/jpeg",.82);
   var pv=el("apPhotoPreview");pv.src=window._apPhoto;pv.style.display="block";
   el("apPhotoClear").style.display="inline-flex";
  }catch(err){window._apPhoto=rd.result;var pv2=el("apPhotoPreview");pv2.src=rd.result;pv2.style.display="block";el("apPhotoClear").style.display="inline-flex";}
 };im.src=rd.result;};
 rd.readAsDataURL(file);
}
function apCreate(){
 var name=el("apName").value.trim();
 if(!name){flash("Give them a name first");return;}
 var rel=el("apRelation").value;
 var cat=relCategory(rel);
 var p={id:uid(),name:name,relation:rel,area:CAT_AREA[cat],rhythms:[],sparks:[]};
 var b=el("apBirthday").value;if(b)p.birthday=b;
 var a=el("apAnniversary").value;if(a)p.anniversary=a;
 if(window._apPhoto)p.photo=window._apPhoto;
 S.people.push(p);save();
 flash("Added "+name);
 el("addPersonModal").classList.remove("open");
 openPersonTab(p.id);
}

/* ---------- renderPeople override (card grid only) ---------- */
var _renderPeople=renderPeople;
window.renderPeople=renderPeople=function(){
 var HINT='rhythms, sparks, prayers - tending the people you love';
 if(currentPerson)return _renderPeople();
 var f=pfilters();
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div>';
 out+='<div class="pc-toolbar"><div class="pc-toggles">'+["marriage","parenting","friendships"].map(function(k){
  return '<button type="button" class="pc-toggle'+(f[k]?" on":"")+'" data-pfilter="'+k+'" aria-pressed="'+(!!f[k])+'"><span class="pc-dot"></span>'+CAT_LABEL[k]+'</button>';
 }).join("")+'</div><button type="button" class="btn" data-addperson>+ Add person</button></div>';
 var shown=0;
 out+='<div class="grid">';
 S.people.forEach(function(p){
  var cat=personCategory(p);
  if(!f[cat])return;shown++;
  var sc=personScore(p),c=scoreClass(sc);
  var ci=personConnInfo(p);
  var prayers=S.prayers.filter(function(x){return x.personId===p.id&&!x.answered&&!x.archived;}).length;
  out+='<div class="card person-card pc-'+cat+'" data-openperson="'+p.id+'" style="cursor:pointer">'+
  '<div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px;min-width:0">'+personAvatar(p,42)+'<h3 style="margin:0">'+esc(p.name)+'</h3></div><span class="person-card-score">'+sc+'</span></div>'+ 
  personHealthMeter(sc,p.name,true)+
  '<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div>'+ 
  '<div class="pc-meta">'+ 
  '<span class="pc-chip rel-'+cat+'">'+esc(p.relation||CAT_LABEL[cat])+'</span>'+ 
  (ci.last?'<span class="pc-chip conn">connected '+when(ci.last.ts)+'</span>':'<span class="pc-chip conn" style="opacity:.7">no connections yet</span>')+
  (prayers?'<span class="pc-chip pray">\u2022 '+prayers+' prayer'+(prayers>1?"s":"")+'</span>':'')+
  '</div>'+cardDateLines(p)+'</div>';
 });
 out+='</div>';
 if(!shown)out+='<div class="empty">No people shown - toggle a category back on, or add someone new.</div>';
 out+=addPersonModalHTML();
 return out;
};

/* ---------- handlers ---------- */
document.addEventListener("click",function(e){
 var t=e.target;if(!t||!t.closest)return;var b;
 if(b=t.closest("[data-addperson]")){apOpen();return;}
 if(b=t.closest("[data-apclose]")){el("addPersonModal").classList.remove("open");return;}
 if(b=t.closest("#apCreate")){apCreate();return;}
 if(b=t.closest("#apPhotoClear")){window._apPhoto=null;el("apPhotoPreview").style.display="none";el("apPhotoPreview").removeAttribute("src");el("apPhotoClear").style.display="none";el("apPhoto").value="";return;}
 if(b=t.closest("[data-pfilter]")){var k=b.getAttribute("data-pfilter");var f2=pfilters();f2[k]=!f2[k];setPF(f2);render();return;}
 var sm=t.closest(".submeter[data-person]");
 if(sm){var pid=sm.getAttribute("data-person");
  if(S.people.some(function(x){return x.id===pid;})){openPersonTab(pid);}return;}
});
document.addEventListener("change",function(e){
 var t=e.target;if(t&&t.id==="apPhoto"&&t.files&&t.files[0])apPickPhoto(t.files[0]);
});
})();

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
".person-card{position:relative;display:flex;flex-direction:column;min-height:264px;transition:box-shadow .15s,transform .15s}",
".person-card:hover{box-shadow:0 10px 28px rgba(32,39,35,.09);transform:translateY(-2px)}",
".pc-identity{display:flex;justify-content:space-between;align-items:center;gap:12px}",
".pc-person{display:flex;align-items:center;gap:10px;min-width:0}",
".pc-person h3{margin:0;line-height:1.25}",
".pc-relation{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:400;color:var(--ink-faint)}",
".pc-relation-dot{width:7px;height:7px;border-radius:50%;background:var(--pc-accent,var(--forest));flex:none}",
".pc-status{font-size:12px;font-weight:600;margin-top:2px}",
".pc-meta{display:grid;gap:4px;border-top:1px solid var(--line);padding-top:12px;margin-top:14px;font-size:12.5px;color:var(--ink-soft)}",
".pc-birthday-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:auto;padding-top:16px;font-size:12px;color:var(--ink-soft)}",
".pc-birthday-row .pc-age{white-space:nowrap;font-weight:600;color:var(--ink)}",
".pc-birthday-row .pc-date-value{display:inline-flex;align-items:center;gap:5px;font-weight:600;color:var(--ink);white-space:nowrap}",
".pc-birthday-row .pc-countdown{font-weight:400;color:var(--ink-soft)}",
".pc-birthday-row svg{width:14px;height:14px;flex:none;color:var(--ink-faint)}",
".pc-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;letter-spacing:.01em;padding:3px 11px;border-radius:999px;background:#F2F4F1;color:var(--ink-soft);white-space:nowrap}",
".pc-chip.rel-marriage{background:rgba(184,145,47,.13);color:#8A6D1F}",
".pc-chip.rel-parenting{background:rgba(76,124,168,.13);color:#38648C}",
".pc-chip.rel-friendships{background:rgba(193,102,62,.13);color:#9C4F2C}",
".pc-chip.conn{background:#F2F4F1;font-weight:500}",
".pc-chip.pray{background:rgba(31,156,104,.1);color:#1F5C40}",
".pc-flabel{display:block;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-faint);margin:10px 0 4px}",
".pc-flabel span{text-transform:none;letter-spacing:0;font-weight:400}",
".metercard .people-row{gap:10px}",
".submeter{padding:8px 14px 8px 9px;cursor:pointer;transition:background .15s}",
".submeter[data-person]:hover{background:rgba(32,39,35,.05)}",
".sm-ava{width:30px;height:30px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 1px 3px rgba(32,39,35,.15)}",
".sm-ava-txt{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#DFE9E2,#C9DAD0);font-size:13px;font-weight:700;color:var(--ink-soft)}",
".submeter .sm-num{font-size:13px}.submeter .sm-num.green{color:#0F9A55}.submeter .sm-num.yellow{color:#C98F0E}.submeter .sm-num.red{color:#E8442E}",
".pc-chip.conn{background:#FFFFFF;border:1px solid var(--line);box-shadow:0 1px 2px rgba(32,39,35,.05);font-weight:500;font-size:11px;padding:3px 10px;color:var(--ink-soft)}",
".pc-chip.pray{background:rgba(31,156,104,.09);border:1px solid rgba(31,156,104,.18);font-weight:600;font-size:11px;padding:3px 10px}",
".pc-bday{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;color:var(--ink-soft);background:#F6F4EC;border:1px solid rgba(184,145,47,.22);border-radius:999px;padding:3px 11px;margin:7px 0 3px;white-space:nowrap}",
".pc-bday b{font-weight:600;color:var(--ink)}",
"#apPhoto+label{display:inline-flex;align-items:center}",".cat-color-row{display:flex;align-items:center;gap:10px;margin:12px 0;font-size:13.5px;font-weight:500;color:var(--ink)}",".cat-color-row input[type=color]{width:28px;height:28px;border-radius:50%;border:none;padding:0;background:none;cursor:pointer;box-shadow:0 0 0 1px rgba(32,39,35,.12),0 1px 3px rgba(32,39,35,.15)}",".cat-color-row input[type=color]::-webkit-color-swatch-wrapper{padding:0}",".cat-color-row input[type=color]::-webkit-color-swatch{border:none;border-radius:50%}",
".pp-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start;padding:16px 0}",
".pp-row .ptext{min-width:0}",
".pp-btns{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}",
".pp-btns .btn.mini{min-height:44px}",
".pp-answered{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}",
".pp-answered svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
".pp-icon{display:inline-grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ink-faint);font-size:17px;opacity:1}",
".pp-icon:hover{background:var(--mist);color:var(--forest)}",
".pp-opts{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-top:11px}",
".pp-option{display:grid;gap:3px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-faint)}",
".pp-option select{min-width:138px;min-height:36px;padding:6px 30px 6px 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:12.5px;font-weight:500;letter-spacing:0;text-transform:none}",
".pp-history{color:var(--forest)}.pp-history svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
"@media(max-width:700px){.pp-row{grid-template-columns:1fr}.pp-btns{justify-content:flex-start}.pp-option select{min-width:130px}}",
".pg-bars{display:flex;align-items:flex-end;gap:5px;height:60px;margin-top:8px}",
".pg-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0}",
".pg-track{width:100%;height:44px;display:flex;align-items:flex-end;background:rgba(32,39,35,.05);border-radius:4px;overflow:hidden}",
".pg-bar{width:100%;background:var(--forest,#1F9C68);border-radius:3px 3px 0 0}",
".pg-lab{font-size:9.5px;color:var(--ink-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}",
".pg-empty{font-size:12.5px;color:var(--ink-faint);margin-top:6px}"
].join("");document.head.appendChild(css);

/* ---------- categories ---------- */
var CAT_LABEL={marriage:"Marriage",parenting:"Parenting",friendships:"Friendships"};
var CAT_AREA={marriage:"marriage",parenting:"parenting",friendships:"friendships"};
var MARRIAGE_WORDS=["spouse","wife","husband","partner"];
var FAMILY_WORDS=["son","daughter","father","dad","mother","mom","brother","sister","in-law","in law","grandchild","grandson","granddaughter","nephew","niece","bonus","family"];
function relCategory(rel){
 var r=(rel||"").toLowerCase();
 if(r==="family")return "friendships"; /* exact "Family" = extended family -> Friendships */
 for(var i=0;i<MARRIAGE_WORDS.length;i++){if(r.indexOf(MARRIAGE_WORDS[i])>=0)return "marriage";}
 for(var j=0;j<FAMILY_WORDS.length;j++){if(r.indexOf(FAMILY_WORDS[j])>=0)return "parenting";}
 return "friendships";
}
function personCategory(p){return relCategory(p.relation)||"friendships";}
var REL_FAM=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Father","Mother","Brother","Sister","Son-in-law","Daughter-in-law","Grandchild","Nephew","Niece","In-law"];
var REL_FR=["Family","Friend","Close friend","Mentor","Mentee","Coworker","Neighbor","Small group friend","Accountability partner","Pastor","Other"];
function relOptionsHTML(sel){
 var fam=REL_FAM,fr=REL_FR;
 function opt(r){return '<option value="'+r+'"'+(r===sel?" selected":"")+'>'+r+'</option>';}
 return '<optgroup label="Family">'+fam.map(opt).join("")+'</optgroup>'+
 '<optgroup label="Friends & others">'+fr.map(opt).join("")+'</optgroup>';
}

/* ---------- filter toggles (per device) ---------- */
function pfilters(){try{return JSON.parse(localStorage.getItem("tend:pfilters"))||{marriage:true,parenting:true,friendships:true};}catch(e){return {marriage:true,parenting:true,friendships:true};}}
function setPF(f){try{localStorage.setItem("tend:pfilters",JSON.stringify(f));}catch(e){}}

/* ---------- card birthday: current age and next occurrence ---------- */
function cardDateLines(p){
 var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];
 var kd=null;(S.keyDates||[]).forEach(function(k){if(k.personId===p.id&&/birth/i.test(k.label||""))kd=k;});
 var label=null,days=null,currentAge=null;
 var b=p.birthday?bdayInfo(p.birthday):null;
 if(b){label=b.label;days=b.days;
  var parts=String(p.birthday).split("-"),y=+parts[0],mm=+parts[1],dd=+parts[2];
  if(y&&y>1900&&mm&&dd){var n=new Date();currentAge=n.getFullYear()-y;
   if(n.getMonth()+1<mm||(n.getMonth()+1===mm&&n.getDate()<dd))currentAge--;}}
 else if(kd&&kd.month&&kd.day){var t=new Date();
  var today=new Date(t.getFullYear(),t.getMonth(),t.getDate());
  var next=new Date(t.getFullYear(),kd.month-1,kd.day);
  if(next<today)next=new Date(t.getFullYear()+1,kd.month-1,kd.day);
  days=Math.round((next-today)/86400000);label=mos[kd.month-1]+" "+kd.day;}
 if(label===null||days===null||days<0)return "";
 var cake='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11h14v9H5zM3 20h18M5 15c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 2-1M8 7v4m4-4v4m4-4v4M8 4v1m4-1v1m4-1v1"/></svg>';
 return '<div class="pc-birthday-row">'+(currentAge!==null?'<span class="pc-age">Age '+currentAge+'</span>':'<span></span>')+'<span class="pc-date-value" aria-label="Next birthday '+esc(label)+(days===0?', today':', in '+days+' days')+'">'+cake+esc(label)+'<span class="pc-countdown">'+(days===0?' · today':' · in '+days+'d')+'</span></span></div>';
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
  '<div class="pc-identity"><div class="pc-person">'+personAvatar(p,42)+'<div><h3>'+esc(p.name)+'</h3><div class="pc-relation"><span class="pc-relation-dot" aria-hidden="true"></span>'+esc(p.relation||CAT_LABEL[cat])+'</div></div></div><span class="person-card-score">'+sc+'</span></div>'+
  personHealthMeter(sc,p.name,true)+
  '<div class="pc-status statusword '+c+'">'+scoreLabel(sc)+'</div>'+
  '<div class="pc-meta">'+
  (ci.last?'<div>Connected '+when(ci.last.ts)+'</div>':'<div>No connections yet</div>')+
  (prayers?'<div>'+prayers+' prayer'+(prayers>1?"s":"")+' to revisit</div>':'')+
  '</div>'+cardDateLines(p)+'</div>';
 });
 out+='</div>';
 if(!shown)out+='<div class="empty">No people shown - toggle a category back on, or add someone new.</div>';
 out+=addPersonModalHTML();
 return out;
};

/* ---------- health-meter person badges: avatar + name + color-coded score ---------- */
window.personChip=function(k){
 var ps=personScore(k),c=scoreClass(ps);
 var ava=k.photo?'<img class="sm-ava" src="'+k.photo+'" alt="">':'<span class="sm-ava sm-ava-txt">'+esc((k.name||"?").charAt(0).toUpperCase())+'</span>';
 return '<button type="button" class="submeter" data-person="'+k.id+'" data-openperson="'+k.id+'" aria-label="Open '+esc(k.name)+' profile" title="'+scoreLabel(ps)+'">'+ava+
 '<span class="sm-name">'+esc(k.name)+'</span><span class="sm-num '+c+'">'+ps+'</span></button>';
};

/* ---------- category colors (Settings > People) ---------- */
function hexToRgb(h){h=String(h||"").replace("#","");if(h.length===3)h=h.split("").map(function(c){return c+c;}).join("");var n=parseInt(h,16);if(isNaN(n))n=0x4C9AFF;return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
function catTint(hex,a){var r=hexToRgb(hex);return "rgba("+r.r+","+r.g+","+r.b+","+a+")";}
function catShade(hex,f){var r=hexToRgb(hex);return "rgb("+Math.round(r.r*(1-f))+","+Math.round(r.g*(1-f))+","+Math.round(r.b*(1-f))+")";}
var CAT_DEFAULTS={marriage:"#B8912F",parenting:"#4C7CA8",friendships:"#C1663E"};
function catColors(){var s=(S.settings&&S.settings.peopleCat)||{};var out={};["marriage","parenting","friendships"].forEach(function(k){out[k]=s[k]||CAT_DEFAULTS[k];});return out;}
function applyCatColors(){
 var c=catColors(),st="";
 ["marriage","parenting","friendships"].forEach(function(k){
  st+=".person-card.pc-"+k+"{--pc-accent:"+c[k]+"}.pc-toggle[data-pfilter='"+k+"']{--pc-c:"+c[k]+"}";
  st+=".pc-chip.rel-"+k+"{background:"+catTint(c[k],.13)+";color:"+catShade(c[k],.35)+"}";
 });
 var elc=document.getElementById("catColorsStyle");if(!elc){elc=document.createElement("style");elc.id="catColorsStyle";document.head.appendChild(elc);}
 elc.textContent=st;
}
applyCatColors();

/* ---------- settings: People colors tab ---------- */
var _renderSettings=renderSettings;
window.renderSettings=renderSettings=function(){
 var html=_renderSettings.apply(this,arguments);
 var c=catColors();
 var btn='<button role="tab" id="settings-tab-peoplecolors" aria-controls="settings-panel-peoplecolors" aria-selected="'+((typeof settingsTab!=="undefined"&&settingsTab==="peoplecolors"))+'" data-settingstab="peoplecolors">People</button>';
 html=html.replace(/(<button role="tab" id="settings-tab-sync")/,btn+"$1");
 var panel='<section class="settings-panel" id="settings-panel-peoplecolors" role="tabpanel" aria-labelledby="settings-tab-peoplecolors"'+((typeof settingsTab!=="undefined"&&settingsTab==="peoplecolors")?"":" hidden")+'>'+
 '<div class="card" style="margin-bottom:14px"><div class="subhead">People category colors</div>'+
 '<p class="settings-help">Colors the relationship dots on People cards, the filter dots, and the avatar rings on health-meter badges.</p>'+
 [["marriage","Marriage"],["parenting","Parenting"],["friendships","Friendships"]].map(function(x){
  return '<label class="cat-color-row"><input type="color" data-catcolor="'+x[0]+'" value="'+c[x[0]]+'" title="'+x[1]+' color"><span>'+x[1]+'</span></label>';
 }).join("")+
 '<button class="btn ghost" id="catColorReset" type="button">Reset to defaults</button></div></section>';
 return html+panel;
};

/* ---------- prayer list (person profile) - was lost in the profile-tabs refactor ---------- */
function prayerRowHTML(pr,pid){
 if(window._ppEditId===pr.id){
  return '<div class="preq pp-row"><div class="ptext" style="flex:1">'+
  '<input data-ppfield="'+pr.id+'|text" value="'+esc(pr.text)+'" style="width:100%;margin-bottom:6px">'+
  '<textarea data-ppfield="'+pr.id+'|details" placeholder="Details (optional)" style="width:100%;min-height:50px">'+esc(pr.details||"")+'</textarea>'+
  '<div class="pp-opts"><label class="pp-option">Frequency<select data-ppfield="'+pr.id+'|freq" aria-label="Prayer frequency">'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'"'+(pr.freq===k?' selected':'')+'>'+FREQS[k].label+'</option>';}).join("")+'<option value="none"'+(pr.freq?'':' selected')+'>No schedule</option></select></label><label class="pp-option">Time<select data-ppfield="'+pr.id+'|tod" aria-label="Prayer time of day">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((pr.tod||'anytime')===k?' selected':'')+'>'+esc(TODS[k])+'</option>';}).join("")+'</select></label><label class="pp-option" data-schedule-day'+(scheduleHasWeekday(pr.freq)?'':' hidden')+'>Day of week<select data-ppfield="'+pr.id+'|scheduleDow">'+scheduleDayOptions(pr.scheduleDow)+'</select></label></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn mini" data-ppsave="'+pr.id+'">Save</button><button class="btn mini ghost" data-ppcancel="1">Cancel</button><button class="btn mini danger" data-prayerdel="'+pr.id+'">Delete</button></div>'+
  '</div></div>';
 }
 var times=pr.prayed||0;
 return '<div class="preq pp-row"><div class="ptext" style="flex:1">'+
 '<b class="tend-type-title">'+esc(pr.text)+'</b> <span class="pc-chip pray">Prayed '+(times===1?"once":times+" times")+'</span>'+
 (pr.details?'<div class="tend-type-description" style="margin-top:3px">'+esc(pr.details)+'</div>':'')+
 '<div class="prayer-schedule-summary tend-type-description">'+esc(pr.freq&&FREQS[pr.freq]?FREQS[pr.freq].label:'No schedule')+(scheduleDayLabel(pr)?' · '+esc(scheduleDayLabel(pr)):'')+' · '+esc(TODS[pr.tod]||TODS.anytime||'Anytime')+'</div></div>'+
 '<div class="pp-btns">'+
 '<button class="btn mini" data-prayquick="'+pid+'" data-prayref="'+pr.id+'">Pray</button>'+
 '<button class="btn mini ghost pp-answered" data-prayerans="'+pr.id+'" title="Mark prayer answered"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></svg>Answered</button>'+
 '<button class="pp-icon pp-history" data-prayerhistory="'+pr.id+'" title="View prayer history" aria-label="View history for '+esc(pr.text)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button>'+
 '<button class="pp-icon" data-ppedit="'+pr.id+'" title="Edit prayer" aria-label="Edit prayer">\u270E</button></div></div>';
}
function prayerList(prayers){
 prayers=prayers||[];
 if(!prayers.length)return '<div class="empty" style="margin-top:10px">No prayers yet - add one above.</div>';
 var act=prayers.filter(function(x){return !x.answered&&!x.archived;});
 var done=prayers.filter(function(x){return x.answered||x.archived;});
 var pid=(prayers[0]&&prayers[0].personId)||"";
 var out=act.map(function(pr){return prayerRowHTML(pr,pid);}).join("");
 if(done.length){
  out+='<div class="subhead" style="margin-top:14px;color:var(--forest)">Answered \u2713</div>';
  done.forEach(function(pr){
   out+='<div class="preq answered"><div class="ptext"><span class="tend-type-title">'+esc(pr.text)+'</span>'+(pr.answered&&pr.answeredDate?'<div class="tend-type-description">answered '+esc(pr.answeredDate)+'</div>':'')+'</div><button class="pp-icon pp-history" data-prayerhistory="'+pr.id+'" title="View prayer history" aria-label="View history for '+esc(pr.text)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button><button class="del" data-prayerunans="'+pr.id+'" title="restore">\u21BA</button></div>';
  });
 }
 return out;
}
window.prayerList=prayerList; /* views1 personProfile calls this bare */

/* ---------- history for one prayer ---------- */
function prayerHistoryData(pr,now){
 now=now||new Date();var latest=now.getTime();
 var dates=(pr.prayerLogs||[]).filter(function(ts){return Number.isFinite(ts)&&ts<=latest;}).slice();
 // Older profile prayers were logged as events before per-prayer dates were stored.
 S.events.forEach(function(e){
  if(e.personId!==pr.personId||!(e.kind==="prayer"||e.type==="prayer")||e.title!==pr.text||!Number.isFinite(e.ts)||e.ts>latest)return;
  if(!dates.some(function(ts){return Math.abs(ts-e.ts)<60000;}))dates.push(e.ts);
 });
 if(!dates.length&&pr.lastPrayed){var last=new Date(pr.lastPrayed+'T12:00:00').getTime();if(Number.isFinite(last)&&last<=latest)dates.push(last);}
 dates.sort(function(a,b){return a-b;});
 var total=Math.max(pr.prayed||0,dates.length),unknown=Math.max(0,total-dates.length);
 function weekStart(d){var start=new Date(d.getFullYear(),d.getMonth(),d.getDate());start.setDate(start.getDate()-(start.getDay()+6)%7);return start;}
 var end=weekStart(now),start=new Date(end);start.setDate(start.getDate()-9*7);
 if(dates.length){var first=weekStart(new Date(dates[0]));if(first<start)start=first;}
 var bins=[];for(var day=new Date(start);day<=end;day.setDate(day.getDate()+7)){
  var next=new Date(day);next.setDate(next.getDate()+7);
  var count=dates.filter(function(ts){return ts>=day.getTime()&&ts<next.getTime();}).length;
  bins.push({label:'Week of '+day.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),count:count,current:day.getTime()===end.getTime()});
 }
 return {bins:bins,total:total,unknown:unknown};
}
function openPrayerHistory(id){
 var pr=S.prayers.find(function(x){return x.id===id;});if(!pr)return;
 var old=document.getElementById('prayerHistoryDialog');if(old)old.remove();
 var data=prayerHistoryData(pr),max=Math.max.apply(null,[1].concat(data.bins.map(function(b){return b.count;})));
 var dialog=document.createElement('dialog');dialog.id='prayerHistoryDialog';dialog.className='rhythm-history-dialog';dialog.setAttribute('aria-labelledby','prayerHistoryTitle');
 dialog.innerHTML='<div class="history-heading"><div><span class="history-eyebrow">Prayer history</span><h2 id="prayerHistoryTitle">'+esc(pr.text)+'</h2></div><button class="iconbtn" data-prayerhistoryclose="1" aria-label="Close history">✕</button></div><div class="history-stat"><strong>'+data.total+'</strong> time'+(data.total===1?'':'s')+' prayed <span>across '+data.bins.length+' weeks</span></div><p class="settings-help">Each bar shows prayers logged for this request during that week. The current week is still in progress.'+(data.unknown?' '+data.unknown+' earlier prayer'+(data.unknown===1?' has':'s have')+' no saved date and cannot be placed on the chart.':'')+'</p>'+(data.total?'':'<div class="history-empty">Your history starts when you tap Pray.</div>')+'<div class="history-scroll" tabindex="0" aria-label="Prayer history chart, scroll horizontally"><div class="history-bars">'+data.bins.map(function(bin,i){return '<button class="history-column" data-prayerhistorybin="'+i+'" title="'+esc(bin.label)+': '+bin.count+' prayer'+(bin.count===1?'':'s')+'" aria-label="'+esc(bin.label)+': '+bin.count+' prayer'+(bin.count===1?'':'s')+(bin.current?', in progress':'')+'"><span class="history-count">'+bin.count+'</span><span class="history-track"><span class="history-fill" style="height:'+(bin.count?Math.max(4,100*bin.count/max):2)+'%;background:'+(bin.count?'#1E9C68':'var(--line)')+'"></span></span><span class="history-label">'+esc(bin.label)+(bin.current?' •':'')+'</span></button>';}).join('')+'</div></div><p class="history-selection" aria-live="polite">Select a bar to see the date and count.</p>';
 dialog.addEventListener('click',function(e){if(e.target.closest('[data-prayerhistoryclose]'))dialog.close();var button=e.target.closest('[data-prayerhistorybin]');if(button){var bin=data.bins[+button.getAttribute('data-prayerhistorybin')];dialog.querySelector('.history-selection').textContent=bin.label+' — '+bin.count+' prayer'+(bin.count===1?'':'s')+(bin.current?' (in progress)':'');}});
 dialog.addEventListener('close',function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();var scroll=dialog.querySelector('.history-scroll');scroll.scrollLeft=scroll.scrollWidth;
}

/* ---------- tending a prayer rhythm counts as PRAYER, never a connection ---------- */
var _logEvent=logEvent;
window.logEvent=function(areaId,personId,type,title,note,whenTs,goalId,rhythmId,extra){
 if(rhythmId&&type!=="prayer"){
  var pr=null;
  S.people.forEach(function(pp){(pp.rhythms||[]).forEach(function(r){if(r.id===rhythmId)pr=r;});});
  if(pr&&(pr.category==="prayer"||/^pray/i.test(pr.text||"")))type="prayer";
 }
 return _logEvent(areaId,personId,type,title,note,whenTs,goalId,rhythmId,extra);
};

/* ---------- handlers ---------- */
document.addEventListener("click",function(e){
 var t=e.target;if(!t||!t.closest)return;var b;
 if(b=t.closest("[data-prayerhistory]")){openPrayerHistory(b.getAttribute("data-prayerhistory"));return;}
 if(b=t.closest("[data-addperson]")){apOpen();return;}
 if(b=t.closest("[data-apclose]")){el("addPersonModal").classList.remove("open");return;}
 if(b=t.closest("#apCreate")){apCreate();return;}
 if(b=t.closest("#apPhotoClear")){window._apPhoto=null;el("apPhotoPreview").style.display="none";el("apPhotoPreview").removeAttribute("src");el("apPhotoClear").style.display="none";el("apPhoto").value="";return;}
 if(b=t.closest("[data-pfilter]")){var k=b.getAttribute("data-pfilter");var f2=pfilters();f2[k]=!f2[k];setPF(f2);render();return;}
 if(b=t.closest("[data-ppedit]")){window._ppEditId=b.getAttribute("data-ppedit");render();return;}
 if(b=t.closest("[data-ppcancel]")){window._ppEditId=null;render();return;}
 if(b=t.closest("[data-ppsave]")){var ppid=b.getAttribute("data-ppsave");var pp=S.prayers.find(function(x){return x.id===ppid;});if(pp){var t1=document.querySelector('[data-ppfield="'+ppid+'|text"]'),t2=document.querySelector('[data-ppfield="'+ppid+'|details"]'),freq=document.querySelector('[data-ppfield="'+ppid+'|freq"]'),tod=document.querySelector('[data-ppfield="'+ppid+'|tod"]');if(t1&&t1.value.trim()){pp.text=t1.value.trim();pp.details=t2?t2.value.trim():"";pp.freq=freq&&freq.value!=="none"?freq.value:null;pp.tod=tod?tod.value:"anytime";var dow=document.querySelector('[data-ppfield="'+ppid+'|scheduleDow"]');pp.scheduleDow=scheduleHasWeekday(pp.freq)&&dow&&dow.value!==""?+dow.value:null;window._ppEditId=null;save();render();flash("Prayer updated");}else flash("Keep a title on it");}return;}
 if(b=t.closest("#catColorReset")){if(S.settings)S.settings.peopleCat=JSON.parse(JSON.stringify(CAT_DEFAULTS));save();applyCatColors();render();flash("Colors reset");return;}
 var sm=t.closest(".submeter[data-person]");
 if(sm&&!t.closest('[data-openperson]')){var pid=sm.getAttribute("data-person");
  if(S.people.some(function(x){return x.id===pid;})){openPersonTab(pid);}return;}
});
document.addEventListener("change",function(e){
 var t=e.target;if(!t||!t.getAttribute)return;
 if(t.id==="apPhoto"&&t.files&&t.files[0]){apPickPhoto(t.files[0]);return;}
 var v;
 if(v=t.getAttribute("data-catcolor")){if(!S.settings)S.settings={};S.settings.peopleCat=S.settings.peopleCat||{};S.settings.peopleCat[v]=t.value;save();applyCatColors();return;}
});
/* ---- shared grouped dropdown builder (add-person AND person settings use this) ---- */
window.relOptionsHTML=relOptionsHTML;
window.REL_GROUPS={"Family":REL_FAM,"Friends & others":REL_FR};
/* ---- keep stored p.area in sync with the live relation category ---- */
window.syncPersonAreas=function(){
 var n=0;
 S.people.forEach(function(p){
  var want=CAT_AREA[personCategory(p)];
  if(p.area!==want){p.area=want;n++;}
 });
 return n;
};
window.syncPersonAreas();
var _tendSave=save;
window.save=function(){window.syncPersonAreas();return _tendSave.apply(this,arguments);};
})();

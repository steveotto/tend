"use strict";
/* ============ views: today + people ============ */
function renderTabs(){var btns=document.querySelectorAll("#tabs button");btns.forEach(function(b){b.classList.toggle("active",b.getAttribute("data-tab")===tab);});}
function renderNav(){
 var an=el("areaNav");if(an)an.innerHTML=AREA_IDS.map(function(id){return '<button data-areanav="'+id+'" class="'+(navKind()==="area"&&currentArea===id?"active":"")+'">'+S.areas[id].name+'</button>';}).join("");
 var un=el("utilNav");if(un)un.innerHTML=[["today","Today"],["people","People"],["prayer","Prayer"],["echo","Echo"],["offload","Offload"],["settings","Settings"],["sync","Sync"]].map(function(p){return '<button data-utilnav="'+p[0]+'" class="'+(tab===p[0]&&navKind()!=="area"?"active":"")+'">'+p[1]+'</button>';}).join("");
}
function navKind(){return currentArea?"area":"tab";}
function render(){renderNav();var v=el("view");
 if(navKind()==="area"&&currentArea)v.innerHTML=renderArea(currentArea);
 else if(tab==="today")v.innerHTML=renderToday();
 else if(tab==="people")v.innerHTML=renderPeople();
 else if(tab==="prayer")v.innerHTML=renderPrayer();
 else if(tab==="echo")v.innerHTML=renderEcho();
 else if(tab==="offload")v.innerHTML=renderOffload();
 else if(tab==="settings")v.innerHTML=renderSettings();
 else if(tab==="sync")v.innerHTML=renderSync();
 if(typeof bind==="function")bind();}
function introHTML(){try{if(localStorage.getItem("tend:introSeen"))return "";}catch(e){}return '<div class="card" id="introCard" style="margin-bottom:16px"><div class="serif" style="font-size:26px;line-height:1.35">Structure beats good intention.</div><div style="color:var(--ink-soft);margin-top:8px">Tend turns your commitments into a gentle rhythm. Meters start at 50 and move with your goals - a nudge, not a grade.</div><button class="btn" id="introOk" style="margin-top:12px">Begin</button></div>';}
function upcomingHTML(){
 var up=S.keyDates.map(function(kd){return {kd:kd,d:daysUntil(kd)};}).filter(function(x){return x.d<=60;}).sort(function(a,b){return a.d-b.d;});
 if(!up.length)return "";
 var out='<div class="sectiontitle"><h2>Coming up</h2><span class="hint">next 60 days</span></div><div class="uprow">';
 up.forEach(function(x){
  var cls=x.d<=7?"soon":(x.d<=21?"mid":"far");
  var link=S.checklists.find(function(c){return c.linkId===x.kd.id;});
  out+='<div class="upitem" data-upitem="'+x.kd.id+'"'+(link?' data-hascl="1"':'')+'><span class="updays '+cls+'">'+(x.d===0?"today":"in "+x.d+"d")+'</span><span class="uplabel">'+esc(x.kd.label)+'</span>'+(link?'<span class="upcl">checklist \u2192</span>':'')+'</div>';
 });
 return out+'</div>';}
function goalRow(g){
 var d=goalLastDone(g),sc=goalScore(g),c=scoreClass(sc);
 var iv=goalInterval(g);
 var statusTxt=d===null?"never logged":(d===0?"done today":(d+"d ago \u00B7 every "+iv+"d"));
 return '<div class="goalrow"><span class="sm-dot '+c+'"></span><div class="gr-main"><b>'+esc(g.text)+'</b>'+(g.personId?' <span class="gr-person">'+esc(personName(g.personId))+'</span>':'')+'<div class="gr-meta">'+statusTxt+'</div></div><button class="btn mini" data-goaldone="'+g.id+'">Done</button></div>';}
function renderToday(){
 var d=new Date();var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];
 var out=introHTML()+'<div class="sectiontitle" style="margin-top:6px"><h2>'+days[d.getDay()]+", "+mos[d.getMonth()]+" "+d.getDate()+'</h2><span class="hint">a nudge, not a grade</span></div>';
 out+=upcomingHTML();
 out+='<div class="grid">';
 AREA_IDS.forEach(function(id){
  var v=areaScore(id),t=trend(id),c=scoreClass(v);
  var kids=S.people.filter(function(p){return p.area===id;});
  var chips="";
  if(kids.length){chips='<div class="people-row">'+kids.map(personChip).join("")+'</div>';}
  var goals=areaGoals(id);
  var meta=goals.length?goals.length+" goal"+(goals.length>1?"s":""):"no goals yet - set them in Settings";
  out+='<div class="card metercard" data-area="'+id+'"><div class="top"><h3>'+S.areas[id].name+'</h3><div><span class="score '+c+'">'+v+'</span><span class="trend '+t.cls+'">'+t.arrow+'</span></div></div>'+meterBar(v,c)+'<div class="meta"><span class="statusword '+c+'">'+scoreLabel(v)+'</span> \u00B7 '+meta+'</div>'+chips+'</div>';
 });
 out+='</div>';return out;}
function nextDateLine(pid){var kds=S.keyDates.filter(function(k){return k.personId===pid;});if(!kds.length)return "";var best=null;kds.forEach(function(k){var d=daysUntil(k);if(best===null||d<best.d)best={k:k,d:d};});if(!best)return "";return '<div class="pf-next">'+esc(best.k.label)+' \u00B7 '+(best.d===0?"TODAY":"in "+best.d+" days")+'</div>';}
function renderPeople(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">key dates, prayers, connections, encouragement</span></div><div class="grid">';
 S.people.forEach(function(p){
  var sc=personScore(p),c=scoreClass(sc);
  var lastConn=S.events.filter(function(e){return e.personId===p.id;}).sort(function(a,b){return b.ts-a.ts;})[0];
  var prayers=S.prayers.filter(function(x){return x.personId===p.id&&!x.answered;}).length;
  out+='<div class="card person-card" data-openperson="'+p.id+'" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3>'+esc(p.name)+'</h3><span class="score '+c+'">'+sc+'</span></div>'+meterBar(sc,c)+'<div class="meta">'+esc(p.relation||"")+' \u00B7 '+(lastConn?"last connection "+when(lastConn.ts):"no connections yet")+(prayers?" \u00B7 "+prayers+" prayer"+(prayers>1?"s":""):"")+'</div>'+nextDateLine(p.id)+'</div>';
 });
 out+='</div>';
 if(currentPerson){out+=personProfile(currentPerson);}
 return out;}
function personProfile(pid){
 var p=S.people.find(function(x){return x.id===pid;});if(!p)return "";
 var sc=personScore(p),c=scoreClass(sc);
 var evs=S.events.filter(function(e){return e.personId===pid;}).sort(function(a,b){return b.ts-a.ts;}).slice(0,8);
 var prayers=S.prayers.filter(function(x){return x.personId===pid;});
 var goals=personGoals(pid);
 var kds=S.keyDates.filter(function(k){return k.personId===pid;});
 var enc=p.encouragements||[];
 var out='<div class="card detail open" id="personPanel"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3>'+esc(p.name)+' <span style="font-size:13px;color:var(--ink-faint)">'+esc(p.relation||"")+'</span></h3><div><span class="score '+c+'">'+sc+'</span><button class="btn mini ghost" style="margin-left:10px" data-closeperson="1">Close</button></div></div>'+meterBar(sc,c);
 out+='<div class="cols"><div>';
 out+='<div class="subhead">Goals</div>';
 if(goals.length){goals.forEach(function(g){out+=goalRow(g);});}else out+='<div class="empty">No goals for '+esc(p.name)+' yet.</div>';
 out+='<div class="subhead" style="margin-top:14px">Log a moment</div><div class="quicklog">'+["coffee","meal","call","text","quality","prayer"].map(function(k){return '<button data-plog="'+k+'">'+KINDS[k].label.split(" /")[0].split(" ")[0]+'</button>';}).join("")+'</div>';
 out+='<div class="subhead" style="margin-top:14px">Key dates</div>';
 if(kds.length){kds.forEach(function(k){out+='<div class="logline"><span class="kind">'+esc(k.label)+'</span><span class="txt">'+(daysUntil(k)===0?"today":"in "+daysUntil(k)+" days")+'</span></div>';});}else out+='<div class="empty">None yet.</div>';
 out+='<div class="addrow"><input placeholder="Add key date (label)" data-kdlabel="'+pid+'"><button class="btn mini" data-kdadd="'+pid+'">Add</button></div>';
 out+='</div><div>';
 out+='<div class="subhead">Prayers for '+esc(p.name)+'</div>';
 if(prayers.length){prayers.forEach(function(x){out+='<div class="preq'+(x.answered?" answered":"")+'"><div class="ptext">'+esc(x.text)+(x.answered?'<div style="font-size:11px;color:var(--forest)">answered '+x.answeredDate+'</div>':"")+'</div></div>';});}else out+='<div class="empty">None yet - add one in Prayer with their name.</div>';
 out+='<div class="subhead" style="margin-top:14px">Potential encouragement</div><div class="notewrap"><textarea data-encnote="'+pid+'" placeholder="Ideas: a verse that fits their season, a gift idea, a specific word...">'+esc((p.encouragementNote||""))+'</textarea><span class="savehint" data-enchint="'+pid+'">saved</span></div>';
 if(enc.length){enc.forEach(function(t){out+='<div class="logline"><span class="txt">'+esc(t)+'</span></div>';});}
 out+='<div class="subhead" style="margin-top:14px">Connection history</div>';
 if(evs.length){evs.forEach(function(e){out+='<div class="logline"><span class="when">'+when(e.ts)+'</span><span class="kind">'+(KINDS[e.kind]?KINDS[e.kind].label:e.kind)+'</span><span class="txt">'+esc(e.note||"")+'</span></div>';});}else out+='<div class="empty">No history yet.</div>';
 out+='<div class="subhead" style="margin-top:14px">Follow up on</div><ul class="tasks">';
 S.followups.filter(function(f){return f.personId===pid&&!f.done;}).forEach(function(f){out+='<li><input type="checkbox" class="cb" data-fudone="'+f.id+'"><span class="txt">'+esc(f.text)+'</span></li>';});
 out+='</ul><div class="addrow"><input id="personFUNew" placeholder="Follow up on..."><button class="btn mini" data-fuadd="'+pid+'">Add</button></div>';
 out+='</div></div></div>';
 return out;}

/* ============ area subpages ============ */
function renderArea(id){
 var v=areaScore(id),c=scoreClass(v);
 var goals=areaGoals(id);
 var kids=S.people.filter(function(p){return p.area===id;});
 var out='<div class="sectiontitle" style="margin-top:2px"><h2>'+S.areas[id].name+'</h2><span class="hint">'+scoreLabel(v)+'</span></div>';
 out+='<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:17px;font-weight:500">Health meter</h3><span class="score '+c+'">'+v+'</span></div>'+meterBar(v,c);
 if(kids.length)out+='<div class="people-row">'+kids.map(personChip).join("")+'</div>';
 out+='</div>';
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Goals</div>';
 if(goals.length){goals.forEach(function(g){out+=goalRow(g);});}else out+='<div class="empty">No goals yet - add them in Settings.</div>';
 out+='</div>';
 out+='<div class="card" style="margin-bottom:14px" id="logformcard"><div class="subhead">'+(editingId?"Edit entry":"Log an activity")+'</div>'+
 '<div class="addrow" style="margin-top:0"><input type="date" id="logDate" value="'+(editingEvent?fmtDate(editingEvent.ts):fmtDate(Date.now()))+'"><select id="logPersonSel"><option value="">- person (optional) -</option>'+S.people.filter(function(p){return p.area===id;}).map(function(p){return '<option value="'+p.id+'"'+((editingEvent&&editingEvent.personId===p.id)?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select><select id="logTypeSel">'+Object.keys(ETYPES).map(function(t){return '<option value="'+t+'"'+((editingEvent?editingEvent.type:"inperson")===t?" selected":"")+'>'+ETYPES[t].label+'</option>';}).join("")+'</select></div>'+
 '<div class="addrow"><input id="logTitle" placeholder="What did you do?" value="'+(editingEvent?esc(editingEvent.title||""):"")+'"></div>'+
 '<div class="addrow"><textarea id="logTalk" placeholder="What did you talk about?">'+(editingEvent?esc(editingEvent.note||""):"")+'</textarea></div>'+
 '<div style="display:flex;gap:8px"><button class="btn" id="logSubmit">'+(editingId?"Update":"Log it")+'</button>'+(editingId?'<button class="btn ghost" id="logCancel">Cancel</button>':'')+'</div></div>';
 out+='<div class="card"><div class="subhead">History</div>';
 var evs=eventsFor(id,true).sort(function(a,b){return b.ts-a.ts;});
 if(evs.length){evs.slice(0,30).forEach(function(e){
  out+='<div class="entry"><div class="entry-main"><div class="entry-head"><span class="entry-date">'+new Date(e.ts).toLocaleDateString()+'</span><span class="badge">'+typeLabel(e)+'</span>'+(e.personId?'<span class="gr-person">'+esc(personName(e.personId))+'</span>':'')+'</div>'+(e.title?'<div class="entry-title">'+esc(e.title)+'</div>':'')+(e.note?'<div class="entry-note">'+esc(e.note)+'</div>':'')+'</div><div class="entry-actions"><button class="iconbtn" data-eedit="'+e.id+'" title="edit">\u270E</button><button class="iconbtn" data-edel="'+e.id+'" title="delete">\uD83D\uDDD1</button></div></div>';
 });}else out+='<div class="empty">Nothing logged yet.</div>';
 out+='</div>';
 return out;}
function fmtDate(ts){var d=new Date(ts);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
var editingId=null,editingEvent=null;
/* nav state + render (hoisted) */
var tab="today",currentArea=null,currentPerson=null;
function navKind(){return currentArea?"area":"tab";}
function render(){renderNav();var v=el("view");
 if(navKind()==="area"&&currentArea)v.innerHTML=renderArea(currentArea);
 else if(tab==="today")v.innerHTML=renderToday();
 else if(tab==="people")v.innerHTML=renderPeople();
 else if(tab==="prayer")v.innerHTML=renderPrayer();
 else if(tab==="echo")v.innerHTML=renderEcho();
 else if(tab==="offload")v.innerHTML=renderOffload();
 else if(tab==="settings")v.innerHTML=renderSettings();
 else if(tab==="sync")v.innerHTML=renderSync();
 if(typeof bind==="function")bind();}

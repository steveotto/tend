"use strict";
/* ============ views: dashboard, area pages, people ============ */
function renderNav(){
 var an=el("areaNav");if(an)an.innerHTML=AREA_IDS.map(function(id){return '<button data-areanav="'+id+'" class="'+(navKind()==="area"&&currentArea===id?"active":"")+'"><span class="nav-ic">'+(AREA_ICONS[id]||"")+'</span><span>'+S.areas[id].name+'</span></button>';}).join("");
 var un=el("utilNav");if(un)un.innerHTML=[["today","Dashboard"],["people","People"],["prayer","Prayer"],["echo","Echo"],["offload","Offload"],["settings","Settings"]].map(function(p){return '<button data-utilnav="'+p[0]+'" class="'+(tab===p[0]&&navKind()!=="area"?"active":"")+'">'+p[1]+'</button>';}).join("");
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
 if(typeof bind==="function")bind();}
/* ============ overall meter ============ */
function overallScore(){return avg(AREA_IDS.map(areaScore))||50;}
function areaMenuHTML(){
 return '<div class="menu-grid">'+AREA_IDS.map(function(id){
  var v=areaScore(id),c=scoreClass(v);
  return '<button class="menu-area" data-areago="'+id+'"><span class="sm-dot '+c+'"></span><span class="ma-name">'+S.areas[id].name+'</span><span class="ma-score '+c+'">'+v+'</span></button>';
 }).join("")+'</div>';}
function renderToday(){
 var d=new Date(),h=d.getHours();
 var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];
 var greet=h<12?"Good morning":(h<17?"Good afternoon":"Good evening");
 var ov=overallScore(),oc=scoreClass(ov);
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>'+greet+', Steve</h2><span class="hint">'+days[d.getDay()]+", "+mos[d.getMonth()]+" "+d.getDate()+'</span></div>';
 out+='<div class="card overall-card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:18px;font-weight:500">Overall health</h3><span class="ov-score '+oc+'">'+ov+'</span></div><div class="bar-ov"><i class="ov-marker" style="left:'+ov+'%"></i></div>'+'<div class="meta" style="margin-top:6px"><span class="statusword '+oc+'">'+scoreLabel(ov)+'</span> \u00B7 averaged across 6 areas</div>'+areaMenuHTML()+'</div>';
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Today on your calendar</div><div id="calStrip"><div class="empty">'+(S.calendars.length?"Loading calendars...":"No calendars connected - add one in Settings.")+'</div></div></div>';
 out+=planHTML();
 out+=upcomingHTML();
 out+=renderChecklists();
 return out;}
/* ============ time-aware routine plan ============ */
function planBlocksDef(){var h=new Date().getHours();
 return [
  {id:"early",name:"Early morning",range:"5:30 - 9:00am",cur:(h>=5&&h<9)},
  {id:"morning",name:"Midday focus",range:"9:00 - 11:30am",cur:(h>=9&&h<11)},
  {id:"lunch",name:"Lunch",range:"11:30am - 1:30pm",cur:(h>=11&&h<13)},
  {id:"afternoon",name:"Afternoon",range:"1:30 - 4:30pm",cur:(h>=13&&h<16)},
  {id:"commute",name:"Way home",range:"4:30 - 6:00pm",cur:(h>=16&&h<18)},
  {id:"evening",name:"Evening",range:"6:00 - 9:30pm",cur:(h>=18&&h<21)},
  {id:"bedtime",name:"Bedtime",range:"9:30pm - 5:30am",cur:(h>=21||h<5)}
 ];}
function goalType(g){return {scripture:"note",prayer:"note",workout:"inperson",outdoors:"inperson",date:"inperson",quality:"inperson"}[g.kind]||"inperson";}
function goalItem(g){var iv=goalInterval(g),d=goalLastDone(g);
 return {label:g.text,sub:(d===null?"not yet logged":(d===0?"done today":d+"d ago \u00B7 every "+iv+"d")),log:{area:g.area,type:goalType(g),title:g.text,goalId:g.id}};}
function genItem(label,sub,area,type,title){return {label:label,sub:sub,log:{area:area,type:type,title:title||label}};}
function taskItem(t){return {label:t.text,sub:"task \u00B7 "+(S.areas[t.areaId]?S.areas[t.areaId].name:""),log:{area:t.areaId,type:"note",title:"Task: "+t.text},taskId:t.id};}
function planCandidates(bid){
 var out=[],seen={};
 function push(it){if(it&&it.label&&!seen[it.label]){seen[it.label]=1;out.push(it);}}
 function pg(g){if(g&&goalLastDone(g)!==0)push(goalItem(g));}
 function gid(id){return S.goals.find(function(g){return g.id===id;});}
 function tasks(areas){S.tasks.filter(function(t){return !t.done&&(!areas||!areas.length||areas.indexOf(t.areaId)>=0);}).slice(0,4).forEach(function(t){push(taskItem(t));});}
 function lowestGoals(n,exceptKinds){S.goals.filter(function(g){return exceptKinds.indexOf(g.kind)<0&&goalLastDone(g)!==0;}).sort(function(a,b){return goalScore(a)-goalScore(b);}).slice(0,n).forEach(pg);}
 if(bid==="early"){pg(gid("g-bible"));push(genItem("Devotional prayer time","slow start, before the day begins","faith","note","Devotional prayer"));pg(gid("g-core"));pg(gid("g-strength"));}
 else if(bid==="morning"){tasks([]);lowestGoals(2,["scripture","prayer","workout"]);}
 else if(bid==="lunch"){tasks(["finances","health"]);tasks([]);}
 else if(bid==="afternoon"){lowestGoals(3,["scripture","prayer"]);tasks([]);}
 else if(bid==="commute"){
  if(!S.events.some(function(e){return e.areaId==="friendships"&&daysSince(e.ts)===0;}))push(genItem("Text or call one friend","keep friendships green","friendships","text","Reached out to a friend"));
  var fp=S.people.filter(function(p){return p.area==="parenting";}).sort(function(a,b){return personScore(a)-personScore(b);})[0];
  if(fp&&personScore(fp)<80)push({label:"Connect with "+fp.name,sub:"lowest family meter \u00B7 reach out",log:{area:fp.area,type:"text",title:"Connected with "+fp.name}});
 }
 else if(bid==="evening"){pg(gid("g-walk"));pg(gid("g-date-amy"));pg(gid("g-wedding"));tasks(["marriage","parenting"]);tasks([]);}
 else if(bid==="bedtime"){pg(gid("g-pray-amy"));push(genItem("Plan tomorrow - pick your top 3","two minutes, huge payoff","faith","note","Planned tomorrow"));}
 return out.slice(0,5);}
function planHTML(){
 var blocks=planBlocksDef();
 var out='<div class="sectiontitle"><h2>Today</h2><span class="hint">the right thing at the right time</span></div>';
 blocks.forEach(function(b){
  var items=planCandidates(b.id);
  var cur=b.cur;
  var body=items.length?items.map(function(it){
   var payload=encodeURIComponent(JSON.stringify(it.log));
   return '<div class="planitem"><div class="pi-main"><div class="pi-label">'+esc(it.label)+'</div><div class="pi-sub">'+esc(it.sub)+'</div></div><button class="btn mini" data-plandone="'+payload+'" data-taskid="'+(it.taskId||"")+'">Done</button></div>';
  }).join(""):'<div class="empty">Nothing queued - all tended.</div>';
  if(cur){out+='<div class="card planblock current"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:17px;font-weight:600">'+b.name+'</h3><span class="hint">'+b.range+'</span></div>'+body+'</div>';}
  else{out+='<details class="card planblock"><summary style="cursor:pointer;font-weight:600;font-size:15px">'+b.name+' <span style="font-weight:400;color:var(--ink-faint);font-size:12.5px">'+b.range+' \u00B7 '+items.length+' item'+(items.length===1?"":"s")+'</span></summary><div style="margin-top:8px">'+body+'</div></details>';}
 });
 return out;}
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
function renderChecklists(){
 if(!S.checklists||!S.checklists.length)return "";
 var out="";
 S.checklists.forEach(function(cl){
  var done=cl.items.filter(function(i){return i.done;}).length;
  out+='<details class="card cl-card" style="margin-bottom:12px;padding:16px 20px" id="cl-'+cl.id+'"><summary style="cursor:pointer;font-weight:600;font-size:15px">'+esc(cl.title)+' <span style="font-weight:400;color:var(--ink-faint);font-size:12.5px">'+done+'/'+cl.items.length+'</span></summary><ul class="tasks" style="margin-top:10px">';
  cl.items.forEach(function(it){out+='<li class="'+(it.done?"done":"")+'"><input type="checkbox" class="cb" data-clitem="'+cl.id+'|'+it.id+'"'+(it.done?" checked":"")+'><span class="txt">'+esc(it.text)+'</span><button class="del" data-cldel="'+cl.id+'|'+it.id+'">\u00D7</button></li>';});
  out+='</ul><div class="addrow"><input placeholder="Add item..." data-clnew="'+cl.id+'"><button class="btn mini" data-cladd="'+cl.id+'">Add</button></div></details>';
 });
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
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Tasks</div><ul class="tasks">';
 S.tasks.filter(function(t){return t.areaId===id;}).forEach(function(t){out+='<li class="'+(t.done?"done":"")+'"><input type="checkbox" class="cb" data-task="'+t.id+'"'+(t.done?" checked":"")+'><span class="txt">'+esc(t.text)+'</span><button class="del" data-taskdel="'+t.id+'">\u00D7</button></li>';});
 out+='</ul><div class="addrow"><input placeholder="Add a task..." data-tasknew="'+id+'"><button class="btn mini" data-taskadd="'+id+'">Add</button></div></div>';
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
/* nav state */
var tab="today",openDetail=null,currentArea=null,currentPerson=null;

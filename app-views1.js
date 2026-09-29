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
 if(typeof bind==="function")bind();
 if(tab==="today"&&!currentArea&&el("calStrip")&&typeof loadCalendars==="function")loadCalendars();}
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
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Today on your calendar</div><div id="calStrip"><div class="empty">'+((S.calendars||[]).length?"Loading calendars...":"No calendars connected - add one in Settings.")+'</div></div></div>';
 out+=planHTML();
 out+=freeMomentHTML();
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
function planCandidates(bid,curBid){
 var out=[],seen={};
 function push(it){if(it&&it.label&&!seen[it.label]){seen[it.label]=1;out.push(it);}}
 function pg(g){if(g&&goalLastDone(g)!==0)push(goalItem(g));}
 function gid(id){return S.goals.find(function(g){return g.id===id;});}
 function tasks(areas){S.tasks.filter(function(t){return !t.done&&(!areas||!areas.length||areas.indexOf(t.areaId)>=0);}).slice(0,4).forEach(function(t){push(taskItem(t));});}
 function lowestGoals(n,exceptKinds){S.goals.filter(function(g){return exceptKinds.indexOf(g.kind)<0&&goalLastDone(g)!==0;}).sort(function(a,b){return goalScore(a)-goalScore(b);}).slice(0,n).forEach(pg);}
 S.goals.filter(function(g){return (g.tod||"anytime")===bid&&g.tod!=="anytime"&&goalLastDone(g)!==0;}).forEach(pg);
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
 S.people.forEach(function(pp){(pp.rhythms||[]).forEach(function(r){
  if((r.tod||"anytime")!==bid)return;
  if(rhythmDaysSince(r)===0)return;
  push({rhythm:pp.id+"|"+r.id,label:r.text+" - "+pp.name,sub:rhythmFreqLabel(r)+" rhythm \u00B7 "+rhythmDueTxt(r)});
 });});
 S.people.forEach(function(pp){openSparks(pp).forEach(function(s){
  if(!sparkLive(s))return;
  if(!s.by)return;
  var sblk=sparkBlock(s);
  if(sblk){if(sblk!==bid)return;}
  else{if(!curBid||bid!==curBid)return;}
  push({spark:pp.id+"|"+s.id,label:s.text+" - "+pp.name,sub:"spark \u00B7 "+(s.time?fmtHM12(s.time)+" \u00B7 " :"")+sparkDueTxt(s)});
 });});
 return out.slice(0,5);}
function planHTML(){
 var blocks=planBlocksDef();
 var out='<div class="sectiontitle"><h2>Today</h2><span class="hint">the right thing at the right time</span></div>';
 var curId=(blocks.filter(function(x){return x.cur;})[0]||{}).id;
 blocks.forEach(function(b){
  var items=planCandidates(b.id,b.id===curId);
  var cur=b.cur;
  var body=items.length?items.map(function(it){
   var btn=it.rhythm?rhyDoneBtn(it.rhythm):(it.spark?'<button class="btn mini sparkbtn" data-sparkdo="'+it.spark+'">Do it</button>':'<button class="btn mini" data-plandone="'+encodeURIComponent(JSON.stringify(it.log))+'" data-taskid="'+(it.taskId||"")+'">Done</button>');
   return '<div class="planitem"><div class="pi-main"><div class="pi-label">'+(it.spark?'<span style="color:#B8912F">\u2726 </span>':'')+esc(it.label)+'</div><div class="pi-sub">'+esc(it.sub)+'</div></div>'+btn+'</div>';
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
 var HINT='rhythms, sparks, prayers - tending the people you love';
 if(currentPerson)return '<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div>'+personProfile(currentPerson);
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div><div class="grid">';
 S.people.forEach(function(p){
  var sc=personScore(p),c=scoreClass(sc);
  var ci=personConnInfo(p);
  var prayers=S.prayers.filter(function(x){return x.personId===p.id&&!x.answered;}).length;
  out+='<div class="card person-card" data-openperson="'+p.id+'" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px;min-width:0">'+personAvatar(p,42)+'<h3 style="margin:0">'+esc(p.name)+'</h3></div><span class="score '+c+'">'+sc+'</span></div>'+meterBar(sc,c)+'<div class="meta">'+esc(p.relation||"")+" \u00B7 "+(ci.last?("connected "+when(ci.last.ts)):"no connections yet")+(prayers?" \u00B7 "+prayers+" prayer"+(prayers>1?"s":""):"")+'</div>'+nextDateLine(p.id)+personDateLines(p)+'</div>';
 });
 out+='</div>';
 return out;}
/* ============ person profile: rhythms + touch points ============ */
function rhythmRow(p,r){
 var sc=rhythmScore(r),c=scoreClass(sc);
 if(editRhythmId===r.id){
  var idf=p.id+"|"+r.id;
  var out='<div class="rhyedit">';
  out+='<div class="addrow" style="margin-top:2px"><input data-rfield="'+idf+'|text" value="'+esc(r.text)+'" placeholder="What is the rhythm?"></div>';
  out+='<div class="addrow"><select data-rfield="'+idf+'|category"><option value="connection"'+((r.category||"connection")==="connection"?" selected":"")+'>Connection</option><option value="prayer"'+(r.category==="prayer"?" selected":"")+'>Prayer</option></select>';
  out+='<select data-rfield="'+idf+'|freq">'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'"'+(r.freq===k?" selected":"")+'>'+FREQS[k].label+'</option>';}).join("")+'<option value="custom"'+(r.freq==="custom"?" selected":"")+'>Custom...</option></select></div>';
  if(r.freq==="custom"){
   out+='<div class="addrow"><select data-rfield="'+idf+'|customType"><option value="weekly"'+((r.customType||"weekly")==="weekly"?" selected":"")+'>Every week on</option><option value="monthly"'+(r.customType==="monthly"?" selected":"")+'>Monthly on the</option></select>';
   if(r.customType==="monthly")out+='<select data-rfield="'+idf+'|customOrd">'+ORDINALS.map(function(o,i){return '<option value="'+(i+1)+'"'+((r.customOrd||1)===(i+1)?" selected":"")+'>'+o+'</option>';}).join("")+'</select>';
   out+='<select data-rfield="'+idf+'|customDow">'+DOW.map(function(d,i){return '<option value="'+i+'"'+((r.customDow||0)===i?" selected":"")+'>'+d+'</option>';}).join("")+'</select></div>';
  }
  out+='<div class="addrow"><select data-rfield="'+idf+'|tod">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((r.tod||"anytime")===k?" selected":"")+'>'+TODS[k]+'</option>';}).join("")+'</select>';
  var du=durUnitOf(r),dv=durValOf(r);
  out+='<select data-rfield="'+idf+'|durUnit">'+Object.keys(DUR_UNITS).map(function(u){return '<option value="'+u+'"'+(du===u?" selected":"")+'>'+DUR_UNITS[u].label+'</option>';}).join("")+'</select>';
  out+='<select data-rfield="'+idf+'|durVal"><option value="0">- # -</option>'+Array.apply(null,{length:DUR_UNITS[du].max}).map(function(_,i){var n=i+1;return '<option value="'+n+'"'+(dv===n?" selected":"")+'>'+n+'</option>';}).join("")+'</select>';
  out+='<button class="btn mini danger" data-rhydel="'+idf+'">Delete</button></div>';
  out+='<div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 8px">Saves as you change it. Click the pencil again to collapse.</div></div>';
  return out;
 }
 var rl=rhythmLast(r),lastTxt=rl?("last "+when(rl.ts)):"never logged";
 if(rhyDoneDraft&&rhyDoneDraft.key===p.id+"|"+r.id){return '<div class="rhyrow"><span class="sm-dot '+c+'"></span><div class="gr-main"><b>'+esc(r.text||"(unnamed rhythm)")+'</b><div class="gr-meta">'+esc(rhythmFreqLabel(r))+" \u00B7 "+esc(lastTxt)+" \u00B7 "+esc(rhythmDueTxt(r))+'</div></div>'+rhyDoneBtn(p.id+"|"+r.id)+'</div><div class="hint" style="font-size:11px;color:var(--ink-faint);margin:0 0 8px 26px">When did it actually happen? That date drives the meter.</div>';}
 return '<div class="rhyrow"><span class="sm-dot '+c+'"></span><div class="gr-main"><b>'+esc(r.text||"(unnamed rhythm)")+'</b>'+(r.category==="prayer"?' <span class="gr-person">prayer</span>':'')+'<div class="gr-meta">'+esc(rhythmFreqLabel(r))+(r.tod&&r.tod!=="anytime"?" \u00B7 "+TODS[r.tod]:"")+(rhythmDurLabel(r)?" \u00B7 "+esc(rhythmDurLabel(r)):"")+" \u00B7 "+esc(lastTxt)+" \u00B7 "+esc(rhythmDueTxt(r))+'</div></div><button class="btn mini" data-rhydone="'+p.id+'|'+r.id+'">Done</button><button class="iconbtn" data-rhyedit="'+r.id+'" title="edit">\u270E</button></div>';
}
function draftRow(p){
 var r=rhythmDraft,idf=p.id+"|draft";
 var out='<div class="rhyedit">';
 out+='<div class="addrow" style="margin-top:2px"><input data-rfield="'+idf+'|text" value="'+esc(r.text||"")+'" placeholder="What is the rhythm?"></div>';
 out+='<div class="addrow"><select data-rfield="'+idf+'|category"><option value="connection"'+((r.category||"connection")==="connection"?" selected":"")+'>Connection</option><option value="prayer"'+(r.category==="prayer"?" selected":"")+'>Prayer</option></select>';
 out+='<select data-rfield="'+idf+'|freq">'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'"'+(r.freq===k?" selected":"")+'>'+FREQS[k].label+'</option>';}).join("")+'<option value="custom"'+(r.freq==="custom"?" selected":"")+'>Custom...</option></select></div>';
 if(r.freq==="custom"){
  out+='<div class="addrow"><select data-rfield="'+idf+'|customType"><option value="weekly"'+((r.customType||"weekly")==="weekly"?" selected":"")+'>Every week on</option><option value="monthly"'+(r.customType==="monthly"?" selected":"")+'>Monthly on the</option></select>';
  if(r.customType==="monthly")out+='<select data-rfield="'+idf+'|customOrd">'+ORDINALS.map(function(o,i){return '<option value="'+(i+1)+'"'+((r.customOrd||1)===(i+1)?" selected":"")+'>'+o+'</option>';}).join("")+'</select>';
  out+='<select data-rfield="'+idf+'|customDow">'+DOW.map(function(d,i){return '<option value="'+i+'"'+((r.customDow||0)===i?" selected":"")+'>'+d+'</option>';}).join("")+'</select></div>';
 }
 out+='<div class="addrow"><select data-rfield="'+idf+'|tod">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((r.tod||"anytime")===k?" selected":"")+'>'+TODS[k]+'</option>';}).join("")+'</select>';
 var du=durUnitOf(r),dv=durValOf(r);
 out+='<select data-rfield="'+idf+'|durUnit">'+Object.keys(DUR_UNITS).map(function(u){return '<option value="'+u+'"'+(du===u?" selected":"")+'>'+DUR_UNITS[u].label+'</option>';}).join("")+'</select>';
 out+='<select data-rfield="'+idf+'|durVal"><option value="0">- # -</option>'+Array.apply(null,{length:DUR_UNITS[du].max}).map(function(_,i){var n=i+1;return '<option value="'+n+'"'+(dv===n?" selected":"")+'>'+n+'</option>';}).join("")+'</select></div>';
 out+='<div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 2px">Name it, then hit Save Rhythm below.</div></div>';
 return out;}
function personProfile(pid){
 var p=S.people.find(function(x){return x.id===pid;});if(!p)return "";
 var sc=personScore(p),c=scoreClass(sc);
 var crs=personRhythms(p,"connection"),prs=personRhythms(p,"prayer");
 var pTouch=personTouchInfo(p),tScore=touchScoreFromDays(pTouch.days),tCls=scoreClass(tScore);
 var cInfo=personConnInfo(p),pInfo=personPrayerInfo(p);
 var cScore=connScoreFromDays(cInfo.days,personCadenceDays(p)),cCls=scoreClass(cScore);
 var pScore=prs.length?avg(prs.map(rhythmScore)):prayerScoreFromDays(pInfo.days),pCls=scoreClass(pScore);
 var evs=S.events.filter(function(e){return e.personId===pid;}).sort(function(a,b){return b.ts-a.ts;}).slice(0,12);
 var prayers=S.prayers.filter(function(x){return x.personId===pid;});
 var kds=S.keyDates.filter(function(k){return k.personId===pid;});
 var ll=p.loveLanguage||"";
 var first=esc(p.name.split(" ")[0]);
 var bd=bdayInfo(p.birthday);
 var out='<div class="card detail open" id="personPanel"><div class="head"><div style="display:flex;align-items:center;gap:12px">'+personAvatar(p,52)+'<div><h3>'+esc(p.name)+' <span class="rel">'+esc(p.relation||"")+'</span></h3></div></div><div style="display:flex;align-items:center;gap:10px"><span class="score '+c+'">'+sc+'</span><button class="btn mini ghost" data-closeperson="1">Close</button></div></div>';
 out+=meterBar(sc,c);out+='<div class="chips">';
 out+=ll?'<span class="chip">\u2665 '+esc(LL_LANGUAGES[ll])+'</span>':'<span class="chip info">no love language set</span>';
 out+=bd?'<span class="chip'+(bd.days<=14?" warn":" info")+'">\uD83C\uDF82 Birthday: '+esc(bd.label)+'</span>':'<span class="chip info">no birthday set</span>';
 if(p.anniversary){var an2=annivInfo(p.anniversary);if(an2)out+='<span class="chip info">\u2665 Anniversary: '+esc(an2.label)+'</span>';}
 out+='</div>';
 if(crs.length||prs.length){
  var rm=crs.length?avg(crs.map(rhythmScore)):null,rmCls=rm===null?"":scoreClass(rm);
  out+='<div class="pmeters three"><div class="pmeter"><div class="pm-lab"><span>Rhythms</span><span class="pm-val '+rmCls+'">'+(rm===null?"-":rm)+'</span></div><div class="bar"><i class="'+rmCls+'" style="width:'+(rm||0)+'%"></i></div><div class="pm-note">'+(crs.length?crs.length+" connection rhythms":"none yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Ripples</span><span class="pm-val '+tCls+'">'+tScore+'</span></div><div class="bar"><i class="'+tCls+'" style="width:'+tScore+'%"></i></div><div class="pm-note">'+(pTouch.last?("last: "+when(pTouch.last.ts)):"no ripples yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }else{
  out+='<div class="pmeters"><div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+cCls+'">'+cScore+'</span></div><div class="bar"><i class="'+cCls+'" style="width:'+cScore+'%"></i></div><div class="pm-note">'+(cInfo.last?("last: "+when(cInfo.last.ts)):"no connections yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }
 var nud=[];
 if(bd&&bd.days<=14)nud.push('<b>Birthday '+esc(bd.label)+' is in '+bd.days+' day'+(bd.days===1?"":"s")+' - plan something.</b>');
 if(pTouch.days>=1)nud.push('<b>Daily ripple:</b> '+esc(touchSuggestion(p)));
 (p.rhythms||[]).forEach(function(r){var d=rhythmDaysSince(r);if(d!==999&&d>=rhythmPeriod(r))nud.push('<b>'+esc(r.text)+'</b> - '+esc(rhythmDueTxt(r)));});
 if(ll)nud.push('<b>'+esc(LL_LANGUAGES[ll])+' is '+first+"&#39;s love language:</b> "+LL_NUDGES[ll]);
 out+='<div class="nudge"><span>\uD83D\uDCA1</span><span>'+nud.join(" ")+'</span></div>';
 out+='</div>';
 /* rhythms */
 out+='<div class="card" style="margin-bottom:22px"><div class="subhead">Rhythms with '+first+'<span class="hint" style="margin-left:8px;text-transform:none;letter-spacing:0;font-weight:400">recurring commitments - they surface on your dashboard</span></div>';
 if((p.rhythms||[]).length){p.rhythms.forEach(function(r){out+=rhythmRow(p,r);});}
 else out+='<div class="empty">No rhythms yet - add the recurring things that keep this relationship tended.</div>';
 var dO=rhythmDraft&&rhythmDraft.pid===pid;
 if(dO)out+=draftRow(p);
 out+='<div style="margin-top:10px"><button class="btn mini ghost" data-rhyadd="'+pid+'">'+(dO&&rhythmDraft.text&&rhythmDraft.text.trim()?"Save Rhythm":"+ Add rhythm")+'</button>'+(dO?'<button class="btn mini ghost" data-rhycancel="1" style="margin-left:8px">Cancel</button>':"")+'</div>';
 out+='</div>';
 /* sparks: no-pressure ideas */
 var sps=openSparks(p);
 out+='<div class="card" style="margin-bottom:22px"><div class="subhead">Sparks with '+first+'<span class="hint" style="margin-left:8px;text-transform:none;letter-spacing:0;font-weight:400">no-pressure ideas - doing one logs a ripple</span></div>';
 if(sps.length){sps.forEach(function(s){
  out+='<div class="rhyrow"><span class="sm-dot" style="background:none;color:#B8912F;font-size:15px">\u2726</span><div class="gr-main"><b>'+esc(s.text)+'</b><div class="gr-meta">'+esc(sparkDueTxt(s))+(s.time?" \u00B7 "+esc(fmtHM12(s.time)):"")+(s.by?" \u00B7 "+esc(s.by):"")+'</div></div><button class="btn mini" data-sparkdo="'+pid+'|'+s.id+'">Do it</button><button class="iconbtn" data-sedit="'+s.id+'" title="edit">\u270E</button><button class="iconbtn" data-spdel="'+pid+'|'+s.id+'" title="remove">\u00D7</button></div>';
  if(editSparkId===s.id){out+='<div class="rhyedit"><div class="addrow" style="margin-top:2px"><input data-sfield="text" value="'+esc(s.text)+'" placeholder="Spark text"></div><div class="addrow"><input type="date" data-sfield="by" value="'+esc(s.by||"")+'" style="max-width:150px"><input type="time" data-sfield="time" value="'+esc(s.time||"")+'" style="max-width:110px"><button class="btn mini ghost" data-scleardate="1">No date</button></div><div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 2px">With a date it lands on the dashboard; without one it waits in Free moment. Edits save as you go - click the pencil again to collapse.</div></div>';}
 });}
 else out+='<div class="empty">No sparks yet - the fun, no-pressure "we should do this sometime" list.</div>';
 out+='<div class="addrow"><input placeholder="Idea - a movie, a talk, a trip..." data-spnewtext="'+pid+'"><input type="date" data-spnewdate="'+pid+'" style="max-width:150px"><input type="time" data-spnewtime="'+pid+'" style="max-width:110px"><button class="btn mini" data-spadd="'+pid+'">Add</button></div>';
 out+='</div>';
 /* ripples */
 var edEv=editingConn?(S.events.find(function(z){return z.id===editingConn;})||{}):null;
 out+='<div class="card" style="margin-bottom:22px"><div class="subhead">Ripples with '+first+(pTouch.days===0?" \u00B7 one today \u2713":"")+'<span class="hint" style="margin-left:8px;text-transform:none;letter-spacing:0;font-weight:400">small moments of care - they add up</span></div>';
 if(pTouch.days!==0)out+='<div class="touchsugg">\uD83D\uDCAC Suggestion: '+esc(touchSuggestion(p))+'</div>';
 out+='<div class="qlog"><select id="plogType" style="border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:14px;background:var(--canvas)">'+["coffee","meal","call","text","quality","prayer"].map(function(k){return '<option value="'+k+'">'+KINDS[k].label+'</option>';}).join("")+'<option value="other">Other...</option></select><input type="date" id="momentDate" value="'+(editingConn?fmtDate(edEv.ts||Date.now()):fmtDate(Date.now()))+'"><input type="time" id="momentTime" '+(edEv&&edEv.allDay?"disabled":"")+' value="'+(editingConn?fmtHM(edEv.ts||Date.now()):nowHM())+'"><label style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:var(--ink-soft)"><input type="checkbox" id="momentAllDay" class="cb" '+(edEv&&edEv.allDay?"checked":"")+'> All Day</label></div>';
 out+='<div class="qlog" id="plogOtherRow" style="display:none"><input id="plogOther" placeholder="What kind of moment? (e.g. Golf, Movie)" style="flex:1;border:1px solid var(--line);border-radius:10px;padding:10px 12px"></div>';
 out+='<div class="addrow" style="margin-top:8px"><input id="momentTitle" value="'+esc(edEv&&edEv.title&&edEv.title.indexOf("Time with")!==0?edEv.title:"")+'" placeholder="Title - e.g. Encouraging Message"></div>';
 out+='<div class="addrow" style="align-items:flex-start"><textarea id="momentNote" placeholder="Notes - what you want to remember..." style="min-height:70px;flex:1;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--canvas);font-size:15px">'+esc(edEv?(edEv.note||""):"")+'</textarea></div>';
 out+='<div style="display:flex;gap:8px;margin-top:2px"><button class="btn" data-psubmit="'+pid+'">'+(editingConn?"Update":"Log it")+'</button>'+(editingConn?'<button class="btn ghost" data-peditcancel="1">Cancel</button>':'')+'</div>';
 out+='<div class="subhead" style="margin-top:18px">History</div>';
 if(evs.length){evs.slice(0,8).forEach(function(e){out+=rippleLine(e);});
  if(evs.length>8)out+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;color:var(--ink-faint)">Show older ('+(evs.length-8)+' more)</summary><div style="margin-top:6px">'+evs.slice(8).map(rippleLine).join("")+'</div></details>';
 }else out+='<div class="empty">No history yet.</div>';
 out+='</div>';
 /* prayer profile */
 out+='<div class="card" style="margin-bottom:22px"><div class="subhead">'+first+"&#39;s prayer profile"+'<span class="savehint" id="prayerSaveHint" style="margin-left:8px;position:static">saved</span></div>';
 out+='<div class="field"><label>"How can I be praying for you?" (their words)</label><textarea data-phpray="1" data-pid="'+pid+'" placeholder="Ask them this - log their answer here">'+esc(p.howToPray||"")+'</textarea></div>';
 out+='<div class="field"><label>My prayer focus for '+first+'</label><textarea data-pfocus="1" data-pid="'+pid+'" placeholder="Your private prayer for them">'+esc(p.prayerFocus||"")+'</textarea></div>';
 out+='</div>';
 /* prayers + encouragement + key dates + followups */
 out+='<div class="card"><div class="subhead">Prayers for '+first+'</div>';
 if(prayers.length){prayers.forEach(function(x){out+='<div class="preq'+(x.answered?" answered":"")+'"><div class="ptext">'+esc(x.text)+(x.answered?'<div style="font-size:11px;color:var(--forest)">answered '+x.answeredDate+'</div>':"")+'</div></div>';});}else out+='<div class="empty">None yet - add one in Prayer with their name.</div>';
 out+='<div class="subhead" style="margin-top:18px">Potential encouragement</div><div class="notewrap"><textarea data-encnote="'+pid+'" placeholder="Ideas: a verse that fits their season, a gift idea, a specific word...">'+esc((p.encouragementNote||""))+'</textarea><span class="savehint" data-enchint="'+pid+'">saved</span></div>';
 out+='<div class="subhead" style="margin-top:18px">Key dates</div>';
 if(kds.length){kds.forEach(function(k){out+='<div class="logline"><span class="kind">'+esc(k.label)+'</span><span class="txt">'+(daysUntil(k)===0?"today":"in "+daysUntil(k)+" days")+'</span><span class="entry-actions"><button class="iconbtn" data-kddel="'+k.id+'" title="delete">\uD83D\uDDD1</button></span></div>';});}else out+='<div class="empty">None yet.</div>';
 out+='<div class="addrow"><input placeholder="Add key date (label)" data-kdlabel="'+pid+'"><button class="btn mini" data-kdadd="'+pid+'">Add</button></div>';
 out+='<div class="subhead" style="margin-top:18px">Follow up on</div><ul class="tasks">';
 S.followups.filter(function(f){return f.personId===pid&&!f.done;}).forEach(function(f){out+='<li><input type="checkbox" class="cb" data-fudone="'+f.id+'"><span class="txt">'+esc(f.text)+'</span></li>';});
 out+='</ul><div class="addrow"><input id="personFUNew" placeholder="Follow up on..."><button class="btn mini" data-fuadd="'+pid+'">Add</button></div>';
 out+='</div>';
 /* person settings: one-time fields, collapsed */
 var relIn=REL_OPTIONS.indexOf(p.relation);
 out+='<details class="card" style="margin-bottom:22px" id="psettings"'+(window._psOpen?" open":"")+'><summary style="cursor:pointer;font-weight:600;font-size:15px">Person settings <span style="font-weight:400;color:var(--ink-faint);font-size:12.5px">relationship \u00B7 birthday \u00B7 cadence \u00B7 love language</span></summary><div style="margin-top:14px">';
 out+='<div class="field"><label>Relationship</label><select data-pfield="relation" data-pid="'+pid+'"><option value="">- not set -</option>';
 if(p.relation&&relIn<0)out+='<option value="'+esc(p.relation)+'" selected>'+esc(p.relation)+' (custom)</option>';
 out+=REL_OPTIONS.map(function(o){return '<option value="'+o+'"'+(relIn>=0&&REL_OPTIONS[relIn]===o?" selected":"")+'>'+o+'</option>';}).join("");
 out+='<option value="__custom"'+(p.relation&&relIn<0?" selected":"")+'>Custom...</option></select>';
 if(p.relation&&relIn<0)out+='<div class="addrow"><input data-pfield="relation" data-pid="'+pid+'" value="'+esc(p.relation)+'" placeholder="Type the custom relationship"></div>';
 out+='</div>';
 out+='<div class="grid2"><div class="field"><label>Birthday</label><input type="date" data-pfield="birthday" data-pid="'+pid+'" value="'+esc(p.birthday||"")+'"></div><div class="field"><label>Anniversary</label><input type="date" data-pfield="anniversary" data-pid="'+pid+'" value="'+esc(p.anniversary||"")+'"></div></div>';
 out+='<div class="field"><label>Connection cadence</label><select data-pfield="connectCadence" data-pid="'+pid+'">'+[["daily","daily"],["weekly","weekly"],["biweekly","every 2 weeks"],["monthly","monthly"]].map(function(o){return '<option value="'+o[0]+'"'+((p.connectCadence||"weekly")===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select></div>';
 out+='<div class="field"><label>Love language</label><select data-pfield="loveLanguage" data-pid="'+pid+'"><option value="">- not set -</option>'+Object.keys(LL_LANGUAGES).map(function(k){return '<option value="'+k+'"'+(ll===k?" selected":"")+'>'+LL_LANGUAGES[k]+'</option>';}).join("")+'</select></div>';
 out+='<div class="field"><label>Photo</label><div style="display:flex;align-items:center;gap:12px">'+personAvatar(p,56)+'<input type="file" accept="image/*" data-pphoto="'+pid+'" style="flex:1;font-size:13px">'+(p.photo?'<button class="btn mini danger" data-pphorm="'+pid+'">Remove</button>':'')+'</div><div class="hint" style="font-size:11px;color:var(--ink-faint)">Crops to a circle for their card.</div></div>';
 out+='</div></details>';
 out+='</div></div>';
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
/* ============ rhythm done prompt + ripples ============ */
function rhyDoneBtn(key){if(rhyDoneDraft&&rhyDoneDraft.key===key){return '<span style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><input type="date" data-rhydate="'+key+'" value="'+rhyDoneDraft.date+'" style="max-width:145px"><input type="time" data-rhytime="'+key+'" value="'+rhyDoneDraft.time+'" style="max-width:105px"><button class="btn mini" data-rhyconfirm="'+key+'">Log it</button><button class="btn mini ghost" data-rhycancel2="1">Cancel</button></span>';}return '<button class="btn mini" data-rhydone="'+key+'">Done</button>';}
function rippleLine(e){var t=(e.title&&e.title.indexOf("Time with")!==0)?e.title:"";var pill=e.rhythmId?' <span class="pill rhy">\u21BB Rhythm</span>':((e.origin==="spark"||e.note==="Spark landed")?' <span class="pill spk">\u2726 Spark</span>':'');return '<div class="logline"><span class="when">'+when(e.ts)+(daysSince(e.ts)===0&&!e.allDay?" "+fmtHM(e.ts):"")+'</span><div class="gr-main" style="flex:1"><span class="kind">'+esc(typeLabel(e))+'</span>'+pill+(t?' <span class="txt">'+esc(t)+'</span>':'')+(e.note&&e.note!=="Spark landed"?'<div class="gr-meta">'+esc(e.note)+'</div>':'')+'</div><span class="entry-actions"><button class="iconbtn" data-evedit="'+e.id+'" title="edit">\u270E</button><button class="iconbtn" data-evdel="'+e.id+'" title="delete">\uD83D\uDDD1</button></span></div>';}
/* ============ free moment + spark chip ============ */
function sparkChip(p){var s=openSparks(p)[0];if(!s)return "";return '<div class="pf-next" style="color:#8A6D1F">\u2726 '+esc(s.text)+' \u00B7 '+esc(sparkDueTxt(s))+'</div>';}
function freeMomentHTML(){
 var cands=[];
 S.people.forEach(function(p){(p.rhythms||[]).forEach(function(r){var d=rhythmDaysSince(r);if(d!==999&&d>=rhythmPeriod(r))cands.push({pri:10+d,rkey:p.id+"|"+r.id,label:r.text+" - "+p.name,sub:"rhythm \u00B7 "+rhythmDueTxt(r)});});});
 S.people.forEach(function(p){openSparks(p).forEach(function(s){if(sparkLive(s)&&!s.by)cands.push({pri:15,sparky:1,label:"Work on spark: "+s.text,sub:"for "+p.name+" \u00B7 no deadline yet",act:' data-openperson="'+p.id+'"',btn:"Open"});});});
 S.goals.forEach(function(g){var d=goalLastDone(g);if(d!==0)cands.push({pri:(100-goalScore(g))/12,label:g.text,sub:"goal \u00B7 "+(d===null?"never logged":d+"d ago"),act:' data-goaldone="'+g.id+'"',btn:"Done"});});
 var lo=S.people.map(function(p){return {p:p,s:personScore(p)};}).sort(function(a,b){return a.s-b.s;})[0];
 if(lo&&lo.s<80)cands.push({pri:(100-lo.s)/10,label:"Reach out to "+lo.p.name,sub:(lo.p.relation||"")+" \u00B7 meter "+lo.s+" - lowest",act:' data-openperson="'+lo.p.id+'"',btn:"Open"});
 cands.sort(function(a,b){return b.pri-a.pri;});
 if(!cands.length)return "";
 var out='<div class="sectiontitle"><h2>Free moment?</h2><span class="hint">the top of the stack, right now</span></div><div class="card">';
 cands.slice(0,4).forEach(function(c){var bb=c.rkey?rhyDoneBtn(c.rkey):'<button class="btn mini'+(c.sparky?" sparkbtn":"")+'"'+c.act+'>'+c.btn+'</button>';out+='<div class="planitem"><div class="pi-main"><div class="pi-label">'+(c.sparky?'<span style="color:#B8912F">\u2726 </span>':'')+esc(c.label)+'</div><div class="pi-sub">'+esc(c.sub)+'</div></div>'+bb+'</div>';});
 return out+'</div>';}
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
var TODS={anytime:"Anytime",early:"Early morning",morning:"Midday",lunch:"Lunch",afternoon:"Afternoon",commute:"Way home",evening:"Evening",bedtime:"Bedtime"};
var LL_LANGUAGES={qt:"Quality Time",wa:"Words of Affirmation",as:"Acts of Service",gf:"Gifts",pt:"Physical Touch"};
var REL_OPTIONS=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Son-in-law","Daughter-in-law","Father","Mother","Brother","Sister","Friend","Mentor","Coworker"];
var LL_NUDGES={qt:"time together - a walk, an errand, a shared meal - speaks louder than a text.",wa:"a specific, spoken affirmation lands deeper than any gift. Send the text. Make the call.",as:"doing a chore or errand for them preaches louder than words.",gf:"small, thoughtful gifts say 'I was thinking of you' - keep a running list.",pt:"presence in person - a hug, a hand on the shoulder - matters most."};
function bdayInfo(b){if(!b)return null;var parts=String(b).split("-");if(parts.length<3)return null;var m=+parts[1],d=+parts[2];if(!m||!d)return null;var t=new Date();var today=new Date(t.getFullYear(),t.getMonth(),t.getDate());var next=new Date(t.getFullYear(),m-1,d);if(next<today)next=new Date(t.getFullYear()+1,m-1,d);var du=Math.round((next-today)/86400000);var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];return {label:mos[m-1]+" "+d,days:du};}
var editingConn=null;
var editSparkId=null;
var editRhythmId=null;
var rhythmDraft=null;
var rhyDoneDraft=null;
var tab="today",openDetail=null,currentArea=null,currentPerson=null;



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
function dayBlockAt(date){var m=date.getHours()*60+date.getMinutes();return m<330||m>=1290?"bedtime":m<540?"early":m<690?"morning":m<810?"lunch":m<990?"afternoon":m<1080?"commute":"evening";}
function planBlocksDef(){var current=dayBlockAt(new Date());return [
 {id:"early",name:"Early morning",range:"5:30 - 9:00am"},
 {id:"morning",name:"Midday focus",range:"9:00 - 11:30am"},
 {id:"lunch",name:"Lunch",range:"11:30am - 1:30pm"},
 {id:"afternoon",name:"Afternoon",range:"1:30 - 4:30pm"},
 {id:"commute",name:"Way home",range:"4:30 - 6:00pm"},
 {id:"evening",name:"Evening",range:"6:00 - 9:30pm"},
 {id:"bedtime",name:"Bedtime",range:"9:30pm - 5:30am"}
 ].map(function(b){b.cur=b.id===current;return b;});}
function rhythmScheduledToday(r,date){
 date=date||new Date();if(r.freq==="quarterly"||r.freq==="yearly")return false;
 if(rhythmDaysSince(r)===0)return false;
 if(r.freq==="custom")return date.getDay()===(r.customDow||0)&&(r.customType!=="monthly"||Math.ceil(date.getDate()/7)===(r.customOrd||1));
 return r.freq==="daily"||rhythmDaysSince(r)>=rhythmPeriod(r);
}
function goalHasRhythm(g){
 var person=S.people.find(function(p){return p.id===g.personId;});
 if(!person&&g.id==="g-walk")person=S.people.find(function(p){return p.id==="amy";});
 if(!person)return false;
 function normalized(text){return String(text||"").toLowerCase().replace(person.name.toLowerCase(),"").replace(/\bwith\b/g,"").replace(/[^a-z0-9]/g,"");}
 return (person.rhythms||[]).some(function(r){return normalized(g.text)===normalized(r.text)||(g.id==="g-date-amy"&&/date night/i.test(r.text))||(g.id==="g-pray-amy"&&/pray together/i.test(r.text))||(g.id==="g-walk"&&/walk/i.test(r.text));});
}
function planPills(it){var person=S.people.find(function(p){return p.id===it.personId;});var label=it.rhythm||it.rkey?"Rhythm":it.spark||it.sparky?"Spark":it.taskId?"Task":it.goalId?"Goal":"Suggestion";var area=it.area||(it.log&&it.log.area);return (person?'<span class="prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>':'')+'<span class="plan-kind">'+label+'</span>'+(!person&&area&&S.areas[area]?'<span class="plan-kind">'+esc(S.areas[area].name)+'</span>':'');}
function goalType(g){return {scripture:"note",prayer:"note",workout:"inperson",outdoors:"inperson",date:"inperson",quality:"inperson"}[g.kind]||"inperson";}
function goalItem(g){var iv=goalInterval(g),d=goalLastDone(g);
 return {label:g.text,sub:(d===null?"not yet logged":(d===0?"done today":d+"d ago \u00B7 every "+iv+"d")),log:{area:g.area,type:goalType(g),title:g.text,goalId:g.id}};}
function genItem(label,sub,area,type,title){return {label:label,sub:sub,log:{area:area,type:type,title:title||label}};}
function taskItem(t){return {label:t.text,sub:"task \u00B7 "+(S.areas[t.areaId]?S.areas[t.areaId].name:""),log:{area:t.areaId,type:"note",title:"Task: "+t.text},taskId:t.id};}
function planCandidates(bid,curBid){
 var out=[];
 S.goals.forEach(function(g){
  if(goalHasRhythm(g)||goalLastDone(g)===0)return;
  var elapsed=goalLastDone(g);if(elapsed!==null&&elapsed<goalInterval(g))return;
  var defaults={"g-bible":"early","g-core":"early","g-strength":"early","g-walk":"evening","g-date-amy":"evening","g-wedding":"evening","g-pray-amy":"bedtime"};
  var block=g.tod&&g.tod!=="anytime"?g.tod:defaults[g.id];
  if(block!==bid)return;
  var item=goalItem(g);item.personId=g.personId;item.goalId=g.id;item.area=g.area;item.log.personId=g.personId;out.push(item);
 });
 S.tasks.forEach(function(t){if(!t.done&&((t.tod&&t.tod!=="anytime")?t.tod===bid:bid===curBid))out.push(taskItem(t));});
 S.people.forEach(function(person){
  (person.rhythms||[]).forEach(function(r){if((r.tod||"anytime")===bid&&rhythmScheduledToday(r))out.push({rhythm:person.id+"|"+r.id,personId:person.id,label:r.text,sub:rhythmFreqLabel(r)+" \u00b7 "+rhythmDueTxt(r)});});
  openSparks(person).forEach(function(spark){if(!spark.by||!sparkLive(spark))return;if((sparkBlock(spark)||curBid)!==bid)return;out.push({spark:person.id+"|"+spark.id,personId:person.id,label:spark.text,sub:(spark.time?fmtHM12(spark.time)+" \u00b7 ":"")+sparkDueTxt(spark)});});
 });
 return out;
}
var planOpenState={};
function planHTML(){
 var blocks=planBlocksDef();
 var out='<div class="sectiontitle"><h2>Today</h2><span class="hint">the right thing at the right time</span></div>';
 var curId=(blocks.filter(function(x){return x.cur;})[0]||{}).id;
 out+='<nav class="day-jumps" aria-label="Time of day">'+blocks.map(function(b){return '<button class="btn mini ghost'+(b.cur?' active':'')+'" data-plan-jump="'+b.id+'">'+b.name+(b.cur?' \u00b7 Now':'')+'</button>';}).join('')+'</nav>';
 blocks.forEach(function(b){
  var items=planCandidates(b.id,curId);
  var cur=b.cur;
  var body=items.length?items.map(function(it){
   var btn=it.rhythm?rhyDoneBtn(it.rhythm):(it.spark?'<button class="btn mini sparkbtn" data-sparkdo="'+it.spark+'">Do it</button>':'<button class="btn mini" data-plandone="'+encodeURIComponent(JSON.stringify(it.log))+'" data-taskid="'+(it.taskId||"")+'">Done</button>');
   return '<div class="planitem"><div class="pi-main"><div class="pi-label">'+(it.spark?'<span style="color:#B8912F">\u2726 </span>':'')+esc(it.label)+'<span class="plan-pills">'+planPills(it)+'</span></div><div class="pi-sub">'+esc(it.sub)+'</div></div>'+btn+'</div>';
  }).join(""):'<div class="empty">Nothing queued - all tended.</div>';
  var open=cur||planOpenState[b.id]!==false;
  out+='<details id="plan-'+b.id+'" data-plan-block="'+b.id+'" class="card planblock'+(cur?' current':'')+'"'+(open?' open':'')+'><summary><span>'+b.name+(cur?' <span class="plan-now">Now</span>':'')+'</span><span class="plan-range">'+b.range+' \u00b7 '+items.length+' item'+(items.length===1?'':'s')+'</span></summary><div style="margin-top:8px">'+body+'</div></details>';

 });
 return out;}
function upcomingHTML(){
 var up=S.keyDates.map(function(kd){return {kd:kd,d:daysUntil(kd)};}).filter(function(x){return x.d<=60;}).sort(function(a,b){return a.d-b.d;});
 var longRhythms=[];S.people.forEach(function(p){(p.rhythms||[]).forEach(function(r){if(r.freq!=="quarterly"&&r.freq!=="yearly")return;var days=rhythmDaysSince(r),left=rhythmPeriod(r)-days;if(days===999||left<=60)longRhythms.push({person:p,rhythm:r,left:days===999?null:left});});});
 if(!up.length&&!longRhythms.length)return "";
 var out='<div class="sectiontitle"><h2>Coming up</h2><span class="hint">next 60 days</span></div><div class="uprow">';
 up.forEach(function(x){
  var cls=x.d<=7?"soon":(x.d<=21?"mid":"far");
  var link=S.checklists.find(function(c){return c.linkId===x.kd.id;});
  out+='<div class="upitem" data-upitem="'+x.kd.id+'"'+(link?' data-hascl="1"':'')+'><span class="updays '+cls+'">'+(x.d===0?"today":"in "+x.d+"d")+'</span><span class="uplabel">'+esc(x.kd.label)+'</span>'+(link?'<span class="upcl">checklist \u2192</span>':'')+'</div>';
 });
 out+='</div>';
 if(longRhythms.length)out+='<div class="card upcoming-rhythms">'+longRhythms.sort(function(a,b){return (a.left===null?0:a.left)-(b.left===null?0:b.left);}).map(function(x){return '<div class="planitem"><div class="pi-main"><div class="pi-label">'+esc(x.rhythm.text)+'<span class="plan-pills">'+planPills({rhythm:true,personId:x.person.id})+'</span></div><div class="pi-sub">'+esc(rhythmFreqLabel(x.rhythm))+' \u00b7 '+(x.left===null?'Choose a date to plan this':x.left<0?'Ready to tend \u00b7 last tended '+rhythmDaysSince(x.rhythm)+' days ago':x.left===0?'Due today':'Due in '+Math.ceil(x.left)+' days')+'</div></div><button class="btn mini ghost" data-openperson="'+x.person.id+'">Open</button></div>';}).join('')+'</div>';
 return out;}
function goalRow(g){
 var d=goalLastDone(g),sc=goalScore(g),c=scoreClass(sc);
 var iv=goalInterval(g);
 var statusTxt=d===null?"never logged":(d===0?"done today":(d+"d ago \u00B7 every "+iv+"d"));
 return '<div class="goalrow"><span class="sm-dot '+c+'"></span><div class="gr-main"><b>'+esc(g.text)+'</b>'+(g.personId?' <span class="gr-person">'+esc(personName(g.personId))+'</span>':'')+'<div class="gr-meta">'+statusTxt+'</div></div><button class="btn mini" data-goaldone="'+g.id+'">Done</button></div>';}
function nextDateLine(pid){var kds=S.keyDates.filter(function(k){return k.personId===pid;});if(!kds.length)return "";var best=null;kds.forEach(function(k){var d=daysUntil(k);if(best===null||d<best.d)best={k:k,d:d};});if(!best)return "";return '<div class="pf-next">'+esc(best.k.label)+' \u00b7 '+(best.d===0?"TODAY":"in "+best.d+" days")+'</div>';}
function personHealthColor(score){
 // Match the dashboard gradient stops: coral at 0, amber at 48, green at 100.
 var value=Math.max(0,Math.min(100,score));
 var start=value<=48?[255,90,69]:[255,193,51];
 var end=value<=48?[255,193,51]:[18,183,106];
 var fraction=value<=48?value/48:(value-48)/52;
 return "rgb("+start.map(function(channel,i){return Math.round(channel+(end[i]-channel)*fraction);}).join(",")+")";
}
function personHealthMeter(score,name,solid){
 return '<div class="bar-ov person-health-bar"'+(solid?' style="background:'+personHealthColor(score)+'"':'')+' role="meter" aria-label="'+esc(name)+' tending health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+score+'" aria-valuetext="'+score+' out of 100: '+esc(scoreLabel(score))+'">'+(solid?'':'<i class="ov-marker" style="left:clamp(10px, '+score+'%, calc(100% - 10px))" aria-hidden="true"></i>')+'</div>';
}
function renderPeople(){
 var HINT='rhythms, sparks, prayers - tending the people you love';
 if(currentPerson)return '<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div>'+personProfile(currentPerson);
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div><div class="grid">';
 S.people.forEach(function(p){
  var sc=personScore(p),c=scoreClass(sc);
  var ci=personConnInfo(p);
  var prayers=S.prayers.filter(function(x){return x.personId===p.id&&!x.answered&&!x.archived;}).length;
  out+='<div class="card person-card" data-openperson="'+p.id+'" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px;min-width:0">'+personAvatar(p,42)+'<h3 style="margin:0">'+esc(p.name)+'</h3></div><span class="person-card-score">'+sc+'</span></div>'+personHealthMeter(sc,p.name,true)+'<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div><div class="meta">'+esc(p.relation||"")+' \u00b7 '+(ci.last?("connected "+when(ci.last.ts)):"no connections yet")+(prayers?" \u00b7 "+prayers+" prayer"+(prayers>1?"s":""):"")+'</div>'+nextDateLine(p.id)+personDateLines(p)+'</div>';
 });
 out+='</div>';
 return out;}
/* ============ person profile: rhythms + touch points ============ */
function rhythmRow(p,r){
 var sc=rhythmScore(r),c=scoreClass(sc);
 if(editRhythmId===r.id){
  if(!rhythmEditDraft||rhythmEditDraft.id!==r.id)rhythmEditDraft=JSON.parse(JSON.stringify(r));
  r=rhythmEditDraft;
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
  out+='</div><div class="addrow"><button class="btn mini" data-rhyeditsave="'+idf+'">Save</button><button class="btn mini ghost" data-rhyeditcancel="1">Cancel</button><button class="btn mini danger" style="margin-left:auto" data-rhydel="'+idf+'">Delete</button></div>';
  out+='<div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 8px">Changes are saved when you select Save.</div></div>';
  return out;
 }
 var rl=rhythmLast(r),lastTxt=rl?("last tended "+when(rl.ts)):"not yet tended";
 var timingTxt=lastTxt+(rl&&rhythmDaysSince(r)!==0?" \u00B7 "+rhythmDueTxt(r):"");
 if(rhyDoneDraft&&rhyDoneDraft.key===p.id+"|"+r.id){return '<div class="rhyrow"><span class="rhythm-health" title="Rhythm health"><span class="sm-dot '+c+'" aria-hidden="true"></span><span>'+sc+'%</span></span><div class="gr-main"><b>'+esc(r.text||"(unnamed rhythm)")+'</b><div class="gr-meta">'+esc(rhythmFreqLabel(r))+" \u00B7 "+esc(timingTxt)+'</div></div>'+rhyDoneBtn(p.id+"|"+r.id)+'</div><div class="hint" style="font-size:11px;color:var(--ink-faint);margin:0 0 8px 26px">When did it actually happen? That date drives the meter.</div>';}
 return '<div class="rhyrow"><span class="rhythm-health" title="Rhythm health"><span class="sm-dot '+c+'" aria-hidden="true"></span><span>'+sc+'%</span></span><div class="gr-main"><b>'+esc(r.text||"(unnamed rhythm)")+'</b>'+(r.category==="prayer"?' <span class="gr-person">prayer</span>':'')+'<div class="gr-meta">'+esc(rhythmFreqLabel(r))+(r.tod&&r.tod!=="anytime"?" \u00B7 "+TODS[r.tod]:"")+(rhythmDurLabel(r)?" \u00B7 "+esc(rhythmDurLabel(r)):"")+" \u00B7 "+esc(timingTxt)+'</div></div><button class="btn mini" data-rhydone="'+p.id+'|'+r.id+'" title="Record a moment of care">Tend</button><button class="iconbtn" data-rhyedit="'+r.id+'" title="edit">\u270E</button></div>';
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
/* ---- action queue (Today with {name}) ---- */
function actDoneAdd(pid,id){window._actDone[pid]=window._actDone[pid]||[];if(window._actDone[pid].indexOf(id)<0)window._actDone[pid].push(id);}
function prayedThisWeek(pid){var d=new Date(),sod=new Date(d.getFullYear(),d.getMonth(),d.getDate()-d.getDay()),n=0;S.events.forEach(function(e){if(e.personId===pid&&(e.kind==="prayer"||e.type==="prayer")&&e.ts>=sod.getTime())n++;});return n;}
var profileTabs={},rippleIdeaOffsets={};
function todayRhythmEligible(r){var days=rhythmDaysSince(r);if(days===0)return false;var period=rhythmPeriod(r);if(period>7)return false;if(r.freq==="custom")return new Date().getDay()===(r.customDow||0);return period===1||days>=period-1;}
function rippleIdea(p){
 var common=["Send a thoughtful text","Make a quick call","Write a handwritten note","Ask how their day really went","Share a happy memory","Follow up on something they mentioned","Offer encouragement before a big day","Send a photo that made you think of them","Ask what would help this week","Thank them for something specific"];
 var byLanguage={qt:["Take a phone-free walk","Share coffee and conversation","Cook a meal together","Ask about the best part of their week","Listen to a favorite song together","Run an errand side by side","Plan a quiet lunch","Spend ten minutes catching up","Look through old photos together","Try something new together"],wa:["Text a specific encouragement","Write a short thank-you note","Say what you admire about them","Celebrate a recent effort","Leave an encouraging voice message","Recall something they handled well","Tell them why you value them","Write a note for a difficult day","Thank them for a small kindness","Ask about a win and celebrate it"],as:["Take a chore off their list","Offer to run an errand","Bring them a meal","Help prepare for tomorrow","Tidy a shared space","Offer a ride","Fix a small annoyance","Help with a task they have postponed","Bring their favorite drink","Ask what practical help they need"],gf:["Bring their favorite snack","Pick a small flower bouquet","Share a book they might love","Print a favorite photo","Bring a little treat from your day","Give a handwritten card","Make a small homemade gift","Replace something they have worn out","Choose something for their hobby","Leave a thoughtful surprise"],pt:["Offer a warm hug","Hold hands on a walk","Sit close while talking","Offer a shoulder rub","Greet them with affection","Share a quiet moment together","Offer a reassuring hand","Ask what kind of affection feels good","Pause for a goodbye hug","Cuddle while watching something together"]};
 var ideas=(byLanguage[p.loveLanguage]||common).slice();
 var last=S.events.filter(function(e){return e.personId===p.id&&e.kind!=="prayer";}).sort(function(a,b){return b.ts-a.ts;})[0];
 if(last&&last.title&&last.title.indexOf("Time with")!==0)ideas[9]='Follow up on “'+last.title+'”';
 return ideas[(Math.floor(Date.now()/864e5)+(rippleIdeaOffsets[p.id]||0))%ideas.length];
}
function collectionIcon(key){var paths={rhythms:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5 M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',sparks:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',prayer:'<path d="M12 20S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z"/>',notes:'<path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6"/>'};return '<svg class="collection-icon" viewBox="0 0 24 24" aria-hidden="true">'+paths[key]+'</svg>';}
function notesChecklist(p,kind,title){
 var items=S.followups.filter(function(f){return f.personId===p.id&&(f.kind||"followup")===kind;});
 function row(f){if(editingFollowupId===f.id)return '<li><input id="followupEditText" aria-label="Edit item" value="'+esc(f.text)+'"><button class="btn mini" data-fusave="'+f.id+'">Save</button><button class="btn mini ghost" data-fucancel="1">Cancel</button><button class="btn mini danger" data-fudel="'+f.id+'">Delete</button></li>';return '<li><input type="checkbox" class="cb" aria-label="'+esc((f.done?'Reopen: ':'Complete: ')+f.text)+'" data-fudone="'+f.id+'"'+(f.done?' checked':'')+'><span class="txt">'+esc(f.text)+'</span><button class="btn mini ghost" data-fuedit="'+f.id+'">Edit</button></li>';}
 var done=items.filter(function(f){return f.done;});
 return '<div class="notes-checklist"><div class="subhead">'+title+'</div><ul class="tasks">'+items.filter(function(f){return !f.done;}).map(row).join('')+'</ul><div class="addrow"><input id="noteNew-'+kind+'" aria-label="'+title+'" placeholder="'+(kind==='encouragement'?'A verse, kind word, or thoughtful idea…':(kind==='prayernote'?'&quot;How can I be praying for you?&quot; - their words':'Follow up on…'))+'"><button class="btn mini" data-noteadd="'+p.id+'" data-notekind="'+kind+'">Add</button></div><details class="notes-history"'+(done.some(function(f){return f.id===editingFollowupId;})?' open':'')+'><summary>Show history ('+done.length+')</summary>'+(done.length?'<ul class="tasks">'+done.map(row).join('')+'</ul>':'<div class="empty">No completed items yet.</div>')+'</details></div>';
}
function profilePanelStart(key){return '<section class="card profile-tab-panel" id="profile-panel-'+key+'" role="tabpanel" aria-labelledby="profile-tab-'+key+'"'+(activeProfileTab===key?'':' hidden')+'>';}
var activeProfileTab="rhythms";
function actQueueHTML(p){
 var first=esc(p.name.split(" ")[0]);
 var doneSess=window._actDone[p.id]||[];
 /* rhythm queue: most overdue first, max 2 visible; session-tended rhythms pad the empty slots */
 var allR=(p.rhythms||[]).filter(function(r){return (r.category||"connection")!=="prayer";});
 var waitR=allR.filter(function(r){return todayRhythmEligible(r);}).sort(function(a,b){return rhythmPeriod(a)-rhythmPeriod(b)||rhythmScore(a)-rhythmScore(b);});
 var visR=waitR.slice(0,2);
 var padR=[];
 /* spark queue: max 2 visible */
 var allS=openSparks(p);
 var waitS=allS.filter(function(s){return (!s.by||sparkLive(s))&&doneSess.indexOf(s.id)<0;});
 var visS=waitS.slice(0,1);
 var padS=[];
 if(visS.length<2)doneSess.slice().reverse().forEach(function(id){if(padS.length<2-visS.length){var ss2=allS.find(function(s){return s.id===id;});if(ss2)padS.push(ss2);}});
 /* prayer queue: active prayers first, then the static prayer focus; one visible */
 var allP=S.prayers.filter(function(x){return x.personId===p.id&&!x.answered&&!x.archived;});
 var waitP=allP.filter(function(x){return x.lastPrayed!==todayStr();}).sort(function(a,b){return (a.lastPrayed||"").localeCompare(b.lastPrayed||"")||(a.added||"").localeCompare(b.added||"");});
 var visP=waitP.slice(0,2);
 var hasFocus=p.prayerFocus&&p.prayerFocus.trim();
 var focusOpen=hasFocus&&!allP.length&&doneSess.indexOf("focus")<0&&!S.events.some(function(e){return e.personId===p.id&&e.title==="Prayer focus"&&daysSince(e.ts)===0;});
 if(!visP.length&&focusOpen)visP=[{id:"focus",focus:true,text:p.prayerFocus}];
 var padP=[];
 var waiting=waitR.length+waitS.length+waitP.length+(visP.some(function(x){return x.focus;})?1:0);
 var rows=[];
 function rhyRowQ(r,dim){
  var rl=rhythmLast(r);
  var sub=esc(rhythmFreqLabel(r))+(rhythmDueTxt(r)?" \u00B7 "+esc(rhythmDueTxt(r)):"")+(rl&&rhythmDaysSince(r)!==0?" \u00B7 last tended "+when(rl.ts):"");
  return '<div class="actrow'+(dim?" done":"")+'"><span class="act-ic" style="background:'+personHealthColor(rhythmScore(r))+'"></span><div class="pi-main"><div class="pi-label">'+esc(r.text||"(unnamed rhythm)")+' <span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span></div><div class="pi-sub">'+sub+'</div></div>'+(dim?'<span class="praycount">Tended \u2713</span>':rhyDoneBtn(p.id+"|"+r.id))+'</div>';
 }
 visR.forEach(function(r){rows.push(rhyRowQ(r,false));});
 padR.forEach(function(r){rows.push(rhyRowQ(r,true));});
 visS.forEach(function(s){rows.push('<div class="actrow"><span class="act-ic" style="background:#B8912F"></span><div class="pi-main"><div class="pi-label">'+esc(s.text)+' <span class="pill spk">'+collectionIcon("sparks")+' Spark</span></div><div class="pi-sub">'+esc(sparkDueTxt(s))+(s.time?" \u00B7 "+esc(fmtHM12(s.time)):"")+'</div></div><button class="btn mini sparkbtn" data-sparkdo="'+p.id+'|'+s.id+'">Do it</button></div>');});
 padS.forEach(function(s){rows.push('<div class="actrow done"><span class="act-ic" style="background:#B8912F"></span><div class="pi-main"><div class="pi-label"><span style="color:#B8912F">\u2726 </span>'+esc(s.text)+'</div><div class="pi-sub">'+esc(sparkDueTxt(s))+'</div></div><span class="praycount">Done \u2713</span></div>');});
 visP.forEach(function(x){rows.push('<div class="actrow"><span class="act-ic" style="background:#5B7BA6"></span><div class="pi-main"><div class="pi-label">'+(x.focus?'Prayer focus: ':'')+esc(x.text)+' <span class="pill pry">'+collectionIcon("prayer")+' Prayer</span></div><div class="pi-sub">'+(x.focus?"from your prayer profile":"active prayer")+'</div></div><span class="praycount">prayed '+(x.prayed||0)+'&times; total</span><button class="btn mini ghost" data-prayquick="'+p.id+'" data-prayref="'+(x.focus?"focus":x.id)+'">Pray</button></div>');});
 padP.forEach(function(x){rows.push('<div class="actrow done"><span class="act-ic" style="background:#5B7BA6"></span><div class="pi-main"><div class="pi-label">'+(x.focus?'Prayer focus: ':'')+esc(x.text)+'</div><div class="pi-sub">prayed today</div></div><span class="praycount">Prayed \u2713</span></div>');});
 var out='<div class="card act" style="margin-bottom:14px"><div class="qhead"><div class="subhead" style="margin:0">Today with '+first+'</div><span><span class="qpill'+(waiting?"":" clear")+'">'+(waiting?waiting+" in queue":"all tended \u2713")+'</span> <span class="hint">tend one, the next steps up</span></span></div>';
 if(rows.length)out+=rows.join("");
 else out+='<div class="empty" style="margin-top:8px">Nothing waiting - maybe log a connection below.</div>';
 out+='<div class="today-ripple"><button class="btn mini" data-rippleopen="1">Log a connection</button><div class="nudge ripple-nudge"><span aria-hidden="true">&#128161;</span><span><b>'+esc(LL_LANGUAGES[p.loveLanguage]||"A moment of care")+':</b> <span id="rippleIdea">'+esc(rippleIdea(p))+'</span></span><button class="iconbtn" data-rippleidea="'+p.id+'" aria-label="Show another ripple idea" title="Another idea">&#8635;</button></div></div></div>';
 /* one coaching nudge, at the bottom of the queue */
 var llq=p.loveLanguage||"",bdq=bdayInfo(p.birthday),nudq=[];
 if(bdq&&bdq.days<=14)nudq.push('<b>Birthday '+esc(bdq.label)+' is in '+bdq.days+' day'+(bdq.days===1?"":"s")+' - plan something.</b>');

 if(nudq.length)out+='<div class="nudge"><span aria-hidden="true">\uD83D\uDCA1</span><ul class="nudge-list">'+nudq.map(function(item){return "<li>"+item+"</li>";}).join("")+'</ul></div>';
 return out;}
function personProfile(pid){
 var p=S.people.find(function(x){return x.id===pid;});if(!p)return "";
 var sc=personScore(p),c=scoreClass(sc);
 var crs=personRhythms(p,"connection"),prs=personRhythms(p,"prayer");
 var pTouch=personTouchInfo(p),tScore=touchScoreFromDays(pTouch.days),tCls=scoreClass(tScore);
 var cInfo=personConnInfo(p),pInfo=personPrayerInfo(p);
 var cScore=connScoreFromDays(cInfo.days,personCadenceDays(p)),cCls=scoreClass(cScore);
 var pScore=prs.length?avg(prs.map(rhythmScore)):prayerScoreFromDays(pInfo.days),pCls=scoreClass(pScore);
 var evs=S.events.filter(function(e){return e.personId===pid;}).sort(function(a,b){return b.ts-a.ts;});
 var prayers=S.prayers.filter(function(x){return x.personId===pid;});
 var kds=S.keyDates.filter(function(k){return k.personId===pid;});
 var ll=p.loveLanguage||"";
 var first=esc(p.name.split(" ")[0]);
 var bd=bdayInfo(p.birthday);
 /* head card: identity + health dashboard */
 var out='<div class="card detail open person-profile" id="personPanel"><div class="person-profile-head"><div class="person-identity">'+personAvatar(p,52)+'<div><h3>'+esc(p.name)+'</h3><div class="rel">'+esc(p.relation||"")+'</div></div></div><div class="profile-head-actions"><button class="pbtn" data-psettings="1" title="Person settings">\u2699</button><button class="pbtn" data-closeperson="1" title="Close">\u2715</button></div></div>';
 out+='<div class="person-health-heading"><div><h4>Tending health</h4><p>The rhythms and moments that keep you connected.</p></div><span class="person-profile-score">'+sc+'<small>/ 100</small></span></div>'+personHealthMeter(sc,p.name)+'<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div><div class="chips">';
 out+=ll?'<span class="chip">\u2665 '+esc(LL_LANGUAGES[ll])+'</span>':'<span class="chip info">no love language set</span>';
 out+=bd?'<span class="chip'+(bd.days<=14?" warn":" info")+'">\uD83C\uDF82 Birthday: '+esc(bd.label)+'</span>':'<span class="chip info">no birthday set</span>';
 if(p.anniversary){var an2=annivInfo(p.anniversary);if(an2)out+='<span class="chip info">\u2665 Anniversary: '+esc(an2.label)+'</span>';}
 out+='</div>';
 if(crs.length||prs.length){
  var rm=crs.length?avg(crs.map(rhythmScore)):null,rmCls=rm===null?"":scoreClass(rm);
  out+='<div class="pmeters three"><div class="pmeter"><div class="pm-lab"><span>Rhythms</span><span class="pm-val '+rmCls+'">'+(rm===null?"-":rm)+'</span></div><div class="bar"><i class="'+rmCls+'" style="width:'+(rm||0)+'%"></i></div><div class="pm-note">'+(crs.length?crs.length+" connection rhythms":"none yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+tCls+'">'+tScore+'</span></div><div class="bar"><i class="'+tCls+'" style="width:'+tScore+'%"></i></div><div class="pm-note">'+(pTouch.last?("last: "+when(pTouch.last.ts)):"no connections yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }else{
  out+='<div class="pmeters"><div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+cCls+'">'+cScore+'</span></div><div class="bar"><i class="'+cCls+'" style="width:'+cScore+'%"></i></div><div class="pm-note">'+(cInfo.last?("last: "+when(cInfo.last.ts)):"no connections yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }
 out+='</div>';
 /* today: the action queue */
 out+=actQueueHTML(p);
 /* ripples: modal */
 if(window._rippleModalOpen||editingConn){
 var edEv=editingConn?(S.events.find(function(z){return z.id===editingConn;})||{}):null;
 out+='<dialog open class="ripple-dialog" id="rippleDialog" aria-label="Log a connection"><div class="box"><div class="subhead">Log a connection with '+first+'<span class="hint" style="margin-left:8px;text-transform:none;letter-spacing:0;font-weight:400">small moments of care - they add up</span></div>';
 var rippleKind=edEv?(edEv.kind||edEv.type):"text";
 if(edEv&&!RIPPLE_TYPES[rippleKind])rippleKind="other";
 var rippleTime=edEv?new Date(edEv.ts||Date.now()):new Date();
 var rippleTimeValue=String(rippleTime.getHours()).padStart(2,"0")+":"+String(rippleTime.getMinutes()).padStart(2,"0");
 out+='<div class="ripple-fields"><label class="ripple-field">Type<select id="plogType">'+Object.keys(RIPPLE_TYPES).map(function(k){return '<option value="'+k+'"'+(rippleKind===k?' selected':'')+'>'+RIPPLE_TYPES[k]+'</option>';}).join("")+'</select></label><label class="ripple-field">Date<input type="date" id="momentDate" value="'+(edEv?fmtDate(edEv.ts||Date.now()):fmtDate(Date.now()))+'"></label><label class="ripple-field">Time<input type="time" id="momentTime" '+(edEv&&edEv.allDay?"disabled":"")+' value="'+rippleTimeValue+'"></label><label class="ripple-all-day"><input type="checkbox" id="momentAllDay" class="cb" '+(edEv&&edEv.allDay?"checked":"")+'> All Day</label></div>';
 out+='<div class="qlog" id="plogOtherRow" style="display:'+(rippleKind==="other"?'flex':'none')+'"><input id="plogOther" aria-label="Other ripple type" value="'+esc(rippleKind==="other"&&edEv?(edEv.rippleLabel||edEv.kind||""):"")+'" placeholder="What kind of moment?" class="ripple-other"></div>';
 out+='<div class="addrow" style="margin-top:8px"><input id="momentTitle" value="'+esc(edEv&&edEv.title&&edEv.title.indexOf("Time with")!==0?edEv.title:"")+'" placeholder="Title - e.g. Encouraging Message"></div>';
 out+='<div class="addrow" style="align-items:flex-start"><textarea id="momentNote" placeholder="Notes - what you want to remember..." style="min-height:70px;flex:1;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--canvas);font-size:15px">'+esc(edEv?(edEv.note||""):"")+'</textarea></div>';
 out+='<div style="display:flex;gap:8px;margin-top:2px"><button class="btn" data-psubmit="'+pid+'">'+(editingConn?"Update":"Log it")+'</button>'+'<button class="btn ghost" data-peditcancel="1">Cancel</button>'+'</div>';
 out+='</div></dialog>';
 }
 /* recent moments: shared history for rhythms, ripples, and sparks */
 out+='<div class="card" style="margin-bottom:22px"><div class="subhead">Recent moments<span class="hint" style="margin-left:8px;text-transform:none;letter-spacing:0;font-weight:400">the care you have shared</span></div>';
 if(evs.length){
  out+=evs.slice(0,5).map(rippleLine).join("");
  if(evs.length>5)out+='<details class="recent-moments-more"><summary>Show all ('+evs.length+' moments)</summary><div>'+evs.slice(5).map(rippleLine).join("")+'</div></details>';
 }else out+='<div class="empty">No moments logged yet.</div>';
 out+='</div>';
 activeProfileTab=profileTabs[pid]||"rhythms";
 var counts={rhythms:(p.rhythms||[]).length,sparks:openSparks(p).length,prayer:prayers.filter(function(x){return !x.answered&&!x.archived;}).length,notes:S.followups.filter(function(f){return f.personId===pid&&!f.done;}).length};
 out+='<div class="profile-tabs" role="tablist" aria-label="Person collections">'+[["rhythms","Rhythms"],["sparks","Sparks"],["prayer","Prayer"],["notes","Notes"]].map(function(item){return '<button role="tab" id="profile-tab-'+item[0]+'" aria-controls="profile-panel-'+item[0]+'" aria-selected="'+(activeProfileTab===item[0])+'" data-profiletab="'+item[0]+'">'+collectionIcon(item[0])+item[1]+' <span class="tab-count">'+counts[item[0]]+'</span></button>';}).join('')+'</div>';
 out+=profilePanelStart("rhythms");
 if((p.rhythms||[]).length){p.rhythms.forEach(function(r){out+=rhythmRow(p,r);});}
 else out+='<div class="empty">No rhythms yet - add the recurring things that keep this relationship tended.</div>';
 var dO=rhythmDraft&&rhythmDraft.pid===pid;
 if(dO)out+=draftRow(p);
 out+='<div style="margin-top:10px"><button class="btn mini ghost" data-rhyadd="'+pid+'">'+(dO&&rhythmDraft.text&&rhythmDraft.text.trim()?"Save Rhythm":"+ Add rhythm")+'</button>'+(dO?'<button class="btn mini ghost" data-rhycancel="1" style="margin-left:8px">Cancel</button>':"")+'</div>';
 out+='</section>';
 out+=profilePanelStart("sparks");
 var sps=openSparks(p);
 if(sps.length){sps.forEach(function(s){
  out+='<div class="rhyrow"><span class="sm-dot" style="background:none;color:#B8912F;font-size:15px">\u2726</span><div class="gr-main"><b>'+esc(s.text)+'</b><div class="gr-meta">'+esc(sparkDueTxt(s))+(s.time?" \u00B7 "+esc(fmtHM12(s.time)):"")+(s.by?" \u00B7 "+esc(s.by):"")+'</div></div><button class="btn mini" data-sparkdo="'+pid+'|'+s.id+'">Do it</button><button class="iconbtn" data-sedit="'+s.id+'" title="edit">\u270E</button><button class="iconbtn" data-spdel="'+pid+'|'+s.id+'" title="remove">\u00D7</button></div>';
  if(editSparkId===s.id){out+='<div class="rhyedit"><div class="addrow" style="margin-top:2px"><input data-sfield="text" value="'+esc(s.text)+'" placeholder="Spark text"></div><div class="addrow"><input type="date" data-sfield="by" value="'+esc(s.by||"")+'" style="max-width:150px"><input type="time" data-sfield="time" value="'+esc(s.time||"")+'" style="max-width:110px"><button class="btn mini ghost" data-scleardate="1">No date</button></div><div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 2px">With a date it lands on the dashboard; without one it waits in Free moment. Edits save as you go - click the pencil again to collapse.</div></div>';}
 });}
 else out+='<div class="empty">No sparks yet - the fun, no-pressure "we should do this sometime" list.</div>';
 out+='<div class="addrow"><input placeholder="Idea - a movie, a talk, a trip..." data-spnewtext="'+pid+'"><input type="date" data-spnewdate="'+pid+'" style="max-width:150px"><input type="time" data-spnewtime="'+pid+'" style="max-width:110px"><button class="btn mini" data-spadd="'+pid+'">Add</button></div>';
 out+='</section>';
 out+=profilePanelStart("prayer")+'<div class="person-prayer-add"><label class="field">Title<input id="personPrayerTitle" placeholder="Prayer title"></label><label class="field">Details<textarea id="personPrayerDetails" placeholder="Details (optional)"></textarea></label><button class="btn" data-personprayeradd="'+pid+'">Add prayer</button></div>'+prayerList(prayers);
 out+='<details class="prayer-notes"><summary>Prayer notes</summary>';
 out+=notesChecklist(p,"prayernote",first+"&#39;s prayer context - what they asked me to pray for");
 out+='</details></section>';
 out+=profilePanelStart("notes");
 out+=notesChecklist(p,"encouragement","Potential encouragement")+notesChecklist(p,"followup","Follow up on");
 out+='</section>';
 /* person settings: gear in the header opens this modal */
 var relIn=REL_OPTIONS.indexOf(p.relation);
 var m='<div class="modal'+(window._psModalOpen?" open":"")+'" id="personSettingsModal"><div class="box person-settings-box"><div class="settings-head"><h3>Person settings - '+esc(p.name)+'</h3><button class="iconbtn" data-psettingsclose="1" title="Done">\u2715</button></div>';
 m+='<div class="field"><label>Relationship</label><select data-pfield="relation" data-pid="'+pid+'"><option value="">- not set -</option>';
 if(p.relation&&relIn<0)m+='<option value="'+esc(p.relation)+'" selected>'+esc(p.relation)+' (custom)</option>';
 m+=REL_OPTIONS.map(function(o){return '<option value="'+o+'"'+(relIn>=0&&REL_OPTIONS[relIn]===o?" selected":"")+'>'+o+'</option>';}).join("");
 m+='<option value="__custom"'+(p.relation&&relIn<0?" selected":"")+'>Custom...</option></select>';
 if(p.relation&&relIn<0)m+='<div class="addrow"><input data-pfield="relation" data-pid="'+pid+'" value="'+esc(p.relation)+'" placeholder="Type the custom relationship"></div>';
 m+='</div>';
 m+='<div class="grid2"><div class="field"><label>Birthday</label><input type="date" data-pfield="birthday" data-pid="'+pid+'" value="'+esc(p.birthday||"")+'"></div><div class="field"><label>Anniversary</label><input type="date" data-pfield="anniversary" data-pid="'+pid+'" value="'+esc(p.anniversary||"")+'"></div></div>';
 m+='<div class="subhead" style="margin-top:6px">Key dates</div>';
 if(kds.length){kds.forEach(function(k){m+='<div class="logline"><span class="kind">'+esc(k.label)+'</span><span class="txt">'+(daysUntil(k)===0?"today":"in "+daysUntil(k)+" days")+'</span><span class="entry-actions"><button class="iconbtn" data-kddel="'+k.id+'" title="delete">\uD83D\uDDD1</button></span></div>';});}else m+='<div class="empty">None yet.</div>';
 m+='<div class="addrow"><input placeholder="Add key date (label)" data-kdlabel="'+pid+'"><button class="btn mini" data-kdadd="'+pid+'">Add</button></div>';
 m+='<div class="field connection-cadence-field" style="margin-top:14px"><label for="personConnectionCadence">Default connection cadence</label><select id="personConnectionCadence" aria-describedby="connectionCadenceHelp" data-pfield="connectCadence" data-pid="'+pid+'">'+[["daily","daily"],["weekly","weekly"],["biweekly","every 2 weeks"],["monthly","monthly"]].map(function(o){return '<option value="'+o[0]+'"'+((p.connectCadence||"weekly")===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select><p id="connectionCadenceHelp" class="settings-help">Used for the health meter when no connection rhythms are set up. Each connection rhythm follows its own frequency.</p></div>';
 m+='<div class="field"><label>Love language</label><select data-pfield="loveLanguage" data-pid="'+pid+'"><option value="">- not set -</option>'+Object.keys(LL_LANGUAGES).map(function(k){return '<option value="'+k+'"'+(ll===k?" selected":"")+'>'+LL_LANGUAGES[k]+'</option>';}).join("")+'</select></div>';
 m+='<div class="field"><label>Photo</label><div style="display:flex;align-items:center;gap:12px">'+personAvatar(p,56)+'<input type="file" accept="image/*" data-pphoto="'+pid+'" style="flex:1;font-size:13px">'+(p.photo?'<button class="btn mini danger" data-pphorm="'+pid+'">Remove</button>':'')+'</div><div class="hint" style="font-size:11px;color:var(--ink-faint)">Crops to a circle for their card.</div></div>';
 m+='</div></div>';
 out+=m;
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
function rhyDoneBtn(key){if(rhyDoneDraft&&rhyDoneDraft.key===key){return '<span style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><input type="date" data-rhydate="'+key+'" value="'+rhyDoneDraft.date+'" style="max-width:145px"><input type="time" data-rhytime="'+key+'" value="'+rhyDoneDraft.time+'" style="max-width:105px"><button class="btn mini" data-rhyconfirm="'+key+'">Save</button><button class="btn mini ghost" data-rhycancel2="1">Cancel</button></span>';}return '<button class="btn mini" data-rhydone="'+key+'" title="Record a moment of care">Tend</button>';}
function rippleLine(e){var t=(e.title&&e.title.indexOf("Time with")!==0)?e.title:"";var pill=e.rhythmId?' <span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>':((e.origin==="spark"||e.note==="Spark landed")?' <span class="pill spk">'+collectionIcon("sparks")+' Spark</span>':((e.kind==="prayer"||e.type==="prayer")?' <span class="pill pry">'+collectionIcon("prayer")+' Prayer</span>':((e.kind==="note"||e.type==="note")?' <span class="pill nte">'+collectionIcon("notes")+' Note</span>':'')));return '<div class="logline moment-row"><span class="when">'+when(e.ts)+(daysSince(e.ts)===0&&!e.allDay?" "+fmtHM(e.ts):"")+'</span><span class="kind">'+esc(typeLabel(e))+'</span><div class="gr-main">'+pill+(t?' <span class="txt">'+esc(t)+'</span>':'')+(e.note&&e.note!=="Spark landed"?'<div class="gr-meta">'+esc(e.note)+'</div>':'')+'</div><span class="entry-actions"><button class="iconbtn" data-evedit="'+e.id+'" title="edit">\u270E</button><button class="iconbtn" data-evdel="'+e.id+'" title="delete">\uD83D\uDDD1</button></span></div>';}
/* ============ free moment + spark chip ============ */
function sparkChip(p){var s=openSparks(p)[0];if(!s)return "";return '<div class="pf-next" style="color:#8A6D1F">\u2726 '+esc(s.text)+' \u00b7 '+esc(sparkDueTxt(s))+'</div>';}
function freeMomentHTML(){
 var cands=[];
 S.people.forEach(function(p){(p.rhythms||[]).forEach(function(r){var d=rhythmDaysSince(r);if((r.tod||"anytime")==="anytime"&&rhythmScheduledToday(r))cands.push({pri:10+(d===999?0:d),rkey:p.id+"|"+r.id,personId:p.id,label:r.text,sub:"rhythm \u00B7 "+rhythmDueTxt(r)});});});
 S.people.forEach(function(p){openSparks(p).forEach(function(s){if(sparkLive(s)&&!s.by)cands.push({pri:15,sparky:1,personId:p.id,label:s.text,sub:"No deadline yet",act:' data-openperson="'+p.id+'"',btn:"Open"});});});
 S.goals.forEach(function(g){var d=goalLastDone(g);if(!goalHasRhythm(g)&&(g.tod||"anytime")==="anytime"&&d!==0&&(d===null||d>=goalInterval(g)))cands.push({pri:(100-goalScore(g))/12,personId:g.personId,goalId:g.id,area:g.area,label:g.text,sub:"goal \u00B7 "+(d===null?"never logged":d+"d ago"),act:' data-goaldone="'+g.id+'"',btn:"Done"});});
 var lo=S.people.map(function(p){return {p:p,s:personScore(p)};}).sort(function(a,b){return a.s-b.s;})[0];
 if(lo&&lo.s<80)cands.push({pri:(100-lo.s)/10,label:"Reach out to "+lo.p.name,sub:(lo.p.relation||"")+" \u00b7 meter "+lo.s+" - lowest",act:' data-openperson="'+lo.p.id+'"',btn:"Open"});
 cands.sort(function(a,b){return b.pri-a.pri;});
 if(!cands.length)return "";
 var out='<div class="sectiontitle"><h2>Free moment?</h2><span class="hint">the top of the stack, right now</span></div><div class="card">';
 cands.slice(0,4).forEach(function(c){var bb=c.rkey?rhyDoneBtn(c.rkey):'<button class="btn mini'+(c.sparky?" sparkbtn":"")+'"'+c.act+'>'+c.btn+'</button>';out+='<div class="planitem"><div class="pi-main"><div class="pi-label">'+(c.sparky?'<span style="color:#B8912F">\u2726 </span>':'')+esc(c.label)+'<span class="plan-pills">'+planPills(c)+'</span></div><div class="pi-sub">'+esc(c.sub)+'</div></div>'+bb+'</div>';});
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
var editingConn=null,editingFollowupId=null;
var editSparkId=null;
var editRhythmId=null, rhythmEditDraft=null;
var rhythmDraft=null;
var rhyDoneDraft=null;
var tab="today",openDetail=null,currentArea=null,currentPerson=null;
window._actDone={};window._psModalOpen=false;



"use strict";
/* ============ Tend core: state, goals, meter engine v2 ============ */
var LS_STATE="tend:state",LS_SYNC="tend:sync";
var KINDS={coffee:{label:"Coffee / one-on-one",w:8},meal:{label:"Meal together",w:7},date:{label:"Date / night out",w:9},call:{label:"Call / FaceTime",w:4},text:{label:"Text / note",w:2},quality:{label:"Quality time",w:7},workout:{label:"Workout",w:5},outdoors:{label:"Walk / outdoors",w:4},prayer:{label:"Prayer",w:4},scripture:{label:"Scripture",w:3},rest:{label:"Rest / sabbath",w:5},actservice:{label:"Act of service",w:6},note:{label:"Note / journal",w:2}};
var ETYPES={inperson:{label:"In person",w:8},video:{label:"Video call",w:6},call:{label:"Phone call",w:5},text:{label:"Text / message",w:2},note:{label:"Note",w:2}};
var KIND2TYPE={coffee:"inperson",meal:"inperson",date:"inperson",quality:"inperson",call:"call",text:"text",workout:"inperson",outdoors:"inperson",prayer:"note",scripture:"note",rest:"note",actservice:"inperson",note:"note"};
function typeLabel(e){return e.type&&ETYPES[e.type]?ETYPES[e.type].label:(KINDS[e.kind]?KINDS[e.kind].label:e.kind);}
function typeWeight(e){return e.type&&ETYPES[e.type]?ETYPES[e.type].w:(KINDS[e.kind]?KINDS[e.kind].w:3);}
var CADENCES={daily:{label:"Daily",days:1},weekly:{label:"Weekly",days:7},monthly:{label:"Monthly",days:30},annual:{label:"Annually",days:365},custom:{label:"Custom",days:2}};
var DEFAULT_SETTINGS={greenAt:80,yellowAt:50,baseline:50};
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function defaultGoals(){return[
 {id:"g-bible",area:"faith",text:"Read the Bible",cadence:"daily",personId:null,kind:"scripture"},
 {id:"g-pray-amy",area:"marriage",text:"Pray with Amy",cadence:"daily",personId:"amy",kind:"prayer"},
 {id:"g-date-amy",area:"marriage",text:"Date night with Amy",cadence:"weekly",personId:"amy",kind:"date"},
 {id:"g-d-hannah",area:"parenting",text:"One-on-one date with Hannah",cadence:"monthly",personId:"hannah",kind:"date"},
 {id:"g-d-jake",area:"parenting",text:"One-on-one date with Jake",cadence:"monthly",personId:"jacob",kind:"date"},
 {id:"g-d-leah",area:"parenting",text:"One-on-one date with Leah",cadence:"monthly",personId:"leah",kind:"date"},
 {id:"g-d-lucas",area:"parenting",text:"Connect with Lucas",cadence:"monthly",personId:"lucas",kind:"quality"},
 {id:"g-d-addi",area:"parenting",text:"Connect with Addi",cadence:"monthly",personId:"addi",kind:"quality"},
 {id:"g-walk",area:"health",text:"Evening walk with Amy",cadence:"daily",personId:"amy",kind:"outdoors"},
 {id:"g-strength",area:"health",text:"30 min strength training",cadence:"custom",days:2,kind:"workout"},
 {id:"g-core",area:"health",text:"Daily core: plank 3 min, ab wheel, decline sit-ups",cadence:"daily",kind:"workout"},
 {id:"g-wedding",area:"parenting",text:"Wedding prep with Jake",cadence:"weekly",personId:"jacob",kind:"quality"}
];}
function defaultKeyDates(){return[
 {id:"kd-leah",personId:"leah",label:"Leah's birthday",month:9,day:28},
 {id:"kd-hannah",personId:"hannah",label:"Hannah's birthday",month:2,day:13},
 {id:"kd-jake",personId:"jacob",label:"Jake's birthday",month:6,day:23},
 {id:"kd-wedding",personId:"jacob",label:"Jake & Addi's wedding",month:3,day:13},
 {id:"kd-thanks",label:"Thanksgiving",month:11,day:26},
 {id:"kd-shepherds",label:"Shepherd's Table (Christmas Eve)",month:12,day:24},
 {id:"kd-christmas",label:"Christmas",month:12,day:25}
];}
function defaultChecklists(){return[
 {id:"cl-wedding",linkId:"kd-wedding",title:"Jake & Addi's wedding - father of the groom",items:[
  {id:uid(),text:"Set a recurring monthly one-on-one with Jake through March",done:false},
  {id:uid(),text:"Have the contribution conversation with Amy (what we're giving)",done:false},
  {id:uid(),text:"Talk with Addi's parents - coordinate the weekend",done:false},
  {id:uid(),text:"Offer Jake premarital conversations: money, faith practices, conflict, in-laws",done:false},
  {id:uid(),text:"Plan a father-son overnight before March",done:false},
  {id:uid(),text:"Help Jake shortlist photographers - track outreach in Echoblocks",done:false},
  {id:uid(),text:"Suit fitting scheduled (by mid-February)",done:false},
  {id:uid(),text:"Draft father-of-the-groom toast by Feb 1; rehearse by Mar 1",done:false},
  {id:uid(),text:"Choose a scripture or blessing for the toast",done:false},
  {id:uid(),text:"Confirm rehearsal dinner role and any toast",done:false},
  {id:uid(),text:"Week of: gift ready, suit pickup, write a letter to Jake",done:false},
  {id:uid(),text:"Day of: pray over Jake before the ceremony",done:false}
 ]},
 {id:"cl-christmas",linkId:"kd-christmas",title:"Christmas",items:[
  {id:uid(),text:"Brainstorm gifts with Amy: Amy, Hannah, Jake, Leah, Lucas, Addi",done:false},
  {id:uid(),text:"Set per-person gift budget",done:false},
  {id:uid(),text:"All gifts bought/ordered by Dec 15",done:false},
  {id:uid(),text:"Plan Shepherd's Table menu and invitations (Dec 24)",done:false}
 ]},
 {id:"cl-thanks",linkId:"kd-thanks",title:"Thanksgiving",items:[
  {id:uid(),text:"Decide hosting plan and menu",done:false},
  {id:uid(),text:"Coordinate who brings what",done:false}
 ]}
];}
function defaultRhythms(){return[{id:uid(),text:"Pray together",category:"prayer",freq:"daily",tod:"early",dur:"15 min"},{id:uid(),text:"Afternoon walk around the block",category:"connection",freq:"daily",tod:"afternoon",dur:"30 min"},{id:uid(),text:"Date night",category:"connection",freq:"custom",customType:"weekly",customDow:5,tod:"evening",dur:"2 hrs"},{id:uid(),text:"Overnight getaway",category:"connection",freq:"quarterly",tod:"anytime",dur:"Weekend"}];}
function defaultState(){return{version:2,
 people:[{id:"amy",name:"Amy",relation:"wife",area:"marriage",rhythms:defaultRhythms()},{id:"hannah",name:"Hannah",relation:"daughter",area:"parenting"},{id:"jacob",name:"Jake",relation:"son",area:"parenting"},{id:"leah",name:"Leah",relation:"daughter",area:"parenting"},{id:"lucas",name:"Lucas",relation:"son-in-law",area:"parenting"},{id:"addi",name:"Addi",relation:"future daughter-in-law",area:"parenting"}],
 events:[],tasks:[],goals:defaultGoals(),followups:[],prayers:[],ideas:[],echoes:[{id:uid(),title:"Photographers - Jake & Addi's wedding",note:"Contacts to reach out to. Status: to contact / contacted / met / booked / passed.",items:[]}],keyDates:defaultKeyDates(),checklists:defaultChecklists(),settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
 calendars:[{id:"cal-home",name:"Home",url:"https://p106-caldav.icloud.com/published/2/MjcyMTgwNTc5MjcyMTgwNfAweM4Mnge_B7jsSIKiQGrhnfAemrtl8LYeoKtz2A0MTFihcXWvdiyB4fotJ9jrIRWeawSqJWitMgtfFaZ1XRxvE-3phMRdiHY_izguI0iXG6szeG4SjHgOO6Uvy8Rgbw",color:"#4C9AFF"}],
 areas:{faith:{name:"Faith"},marriage:{name:"Marriage"},parenting:{name:"Parenting"},health:{name:"Health & Fitness"},finances:{name:"Finances"},friendships:{name:"Friendships"}}};}
function load(){try{var s=localStorage.getItem(LS_STATE);if(!s)return defaultState();var st=ensureShape(JSON.parse(s));st.version=2;
if(st.areas&&st.areas.fitness){st.areas.health={name:"Health & Fitness"};delete st.areas.fitness;(st.events||[]).forEach(function(x){if(x.areaId==="fitness")x.areaId="health";});(st.tasks||[]).forEach(function(x){if(x.areaId==="fitness")x.areaId="health";});(st.goals||[]).forEach(function(g){if(g.area==="fitness")g.area="health";});}
 if(!st.areas.finances)st.areas.finances={name:"Finances"};
 var wantPeople=[{id:"amy",name:"Amy",relation:"wife"},{id:"hannah",name:"Hannah",relation:"daughter"},{id:"jacob",name:"Jake",relation:"son"},{id:"leah",name:"Leah",relation:"daughter"},{id:"lucas",name:"Lucas",relation:"son-in-law"},{id:"addi",name:"Addi",relation:"future daughter-in-law"}];
 wantPeople.forEach(function(p){var ex=st.people&&st.people.find(function(x){return x.id===p.id;});if(ex){if(p.id==="jacob")ex.name="Jake";ex.area=ex.area||"parenting";}else{st.people.push({id:p.id,name:p.name,relation:p.relation,area:p.id==="amy"?"marriage":"parenting"});}});
 var _am=st.people.find(function(x){return x.id==="amy";});if(_am&&!_am.rhythms)_am.rhythms=defaultRhythms();
 st.goals=st.goals&&st.goals.length?st.goals:defaultGoals();
 st.keyDates=st.keyDates&&st.keyDates.length?st.keyDates:defaultKeyDates();
 st.checklists=st.checklists&&st.checklists.length?st.checklists:defaultChecklists();
 st.ideas=st.ideas||[];st.echoes=st.echoes&&st.echoes.length?st.echoes:defaultState().echoes;
 return st;}catch(e){return defaultState();}}
function ensureShape(st){st=st||{};["events","tasks","goals","followups","prayers","ideas","echoes","keyDates","checklists"].forEach(function(k){if(!Array.isArray(st[k]))st[k]=[];});if(!Array.isArray(st.calendars)||!st.calendars.length)st.calendars=defaultState().calendars;if(!st.people||!st.people.length)st.people=defaultState().people;if(!st.areas)st.areas=defaultState().areas;if(!st.settings)st.settings=JSON.parse(JSON.stringify(DEFAULT_SETTINGS));return st;}
var S=load();
var saveTimer=null,pushTimer=null;
function save(){localStorage.setItem(LS_STATE,JSON.stringify(S));clearTimeout(saveTimer);saveTimer=setTimeout(function(){flash("Saved");},150);if(window.SYNCcfg&&SYNCcfg.auto&&SYNCcfg.token&&typeof schedulePush==="function")schedulePush();}
function flash(msg){var f=document.getElementById("flash");f.textContent=msg||"Saved";f.classList.add("show");clearTimeout(flash._t);flash._t=setTimeout(function(){f.classList.remove("show");},1200);}
/* ============ meters ============ */
function daysSince(ts){return Math.floor((Date.now()-ts)/86400000);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function settings(){return S.settings||DEFAULT_SETTINGS;}
function scoreClass(v){var s=settings();return v>=s.greenAt?"green":(v>=s.yellowAt?"yellow":"red");}
function scoreLabel(v){var s=settings();if(v>=s.greenAt)return "Healthy";if(v>=s.yellowAt)return "Slipping - tend it soon";return "Needs attention now";}
function goalInterval(g){return g.cadence==="custom"?(g.days||2):(CADENCES[g.cadence]?CADENCES[g.cadence].days:7);}
function lastGoalEvent(g){var best=null;S.events.forEach(function(e){if(e.goalId===g.id&&(!best||e.ts>best.ts))best=e;});return best;}
function goalLastDone(g){var e=lastGoalEvent(g);if(e)return Math.floor((Date.now()-e.ts)/86400000);return null;}
function goalScore(g){
 var d=goalLastDone(g);if(d===null)return 45;
 var iv=goalInterval(g);
 if(d<iv)return Math.round(100-20*(d/iv));
 if(d<3*iv)return Math.round(80-30*((d-iv)/(2*iv)));
 return Math.round(Math.max(20,50-30*((d-3*iv)/iv)));
}
function rawScore(evs,base){base=(base===undefined)?settings().baseline:base;if(!evs.length)return base;var bonus=0,last=0;evs.forEach(function(e){var d=daysSince(e.ts);if(d>90)return;bonus+=(e.weight||typeWeight(e))*clamp(1-d/45,0,1);if(d>last)last=d;});return clamp(Math.round(settings().baseline-1.4*clamp(last,0,30)+bonus),0,100);}
function migrateEvents(){S.events.forEach(function(e){if(!e.type)e.type=KIND2TYPE[e.kind]||"note";if(!e.title&&e.kind&&KINDS[e.kind])e.title=KINDS[e.kind].label;});}
migrateEvents();
function eventsFor(areaId,personId){return S.events.filter(function(e){return e.areaId===areaId&&(personId?e.personId===personId:!e.personId);});}
function areaGoals(id){return S.goals.filter(function(g){return g.area===id;});}
function personGoals(pid){return S.goals.filter(function(g){return g.personId===pid;});}
function avg(arr){if(!arr.length)return null;return Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length);}
function areaScore(id){var g=areaGoals(id).map(goalScore);return avg(g)!==null?avg(g):rawScore(eventsFor(id));}
/* ============ person score: connection-first ============ */
function personCadenceDays(p){var cc=p.connectCadence||"weekly";if(cc==="daily")return 1;if(cc==="weekly")return 7;if(cc==="biweekly")return 14;if(cc==="monthly")return 30;return p.cadenceDays||30;}
function personCadenceLabel(p){var cc=p.connectCadence||"weekly";return {daily:"daily",weekly:"weekly",biweekly:"every 2 weeks",monthly:"monthly"}[cc]||("every "+(p.cadenceDays||30)+" days");}
function personConnInfo(p){var last=null;S.events.forEach(function(e){if(e.personId===p.id&&e.kind!=="prayer"&&e.type!=="prayer"&&(!last||e.ts>last.ts))last=e;});return {last:last,days:last?daysSince(last.ts):999};}
function personPrayerInfo(p){var last=null;S.events.forEach(function(e){if(e.personId===p.id&&(e.kind==="prayer"||e.type==="prayer")&&(!last||e.ts>last.ts))last=e;});return {last:last,days:last?daysSince(last.ts):999};}
function connScoreFromDays(d,cad){var r=d/cad,v;if(r<=0.33)v=100;else if(r<=1)v=100-30*(r-0.33)/0.67;else if(r<=2)v=70-30*(r-1);else if(r<3)v=40-30*(r-2);else v=10;return Math.round(clamp(v,10,100));}
function prayerScoreFromDays(d){return Math.round(clamp(100-10*d,30,100));}
/* ============ rhythms: recurring care commitments ============ */
var FREQS={daily:{label:"Daily",days:1},twicewk:{label:"2x a week",days:3.5},weekly:{label:"Weekly",days:7},biweekly:{label:"Every 2 weeks",days:14},monthly:{label:"Monthly",days:30},quarterly:{label:"Quarterly",days:91},yearly:{label:"Yearly",days:365}};
var DURATIONS=["15 min","30 min","1 hr","2 hrs","Half day","Full day","Overnight","Weekend","2 days"];
var DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var ORDINALS=["1st","2nd","3rd","4th"];
function rhythmPeriod(r){if(r.freq==="custom")return r.customType==="monthly"?30:7;return FREQS[r.freq]?FREQS[r.freq].days:7;}
function rhythmFreqLabel(r){if(r.freq==="custom"){if(r.customType==="monthly")return ORDINALS[(r.customOrd||1)-1]+" "+DOW[r.customDow||0]+" of the month";return DOW[r.customDow||0]+"s";}return FREQS[r.freq]?FREQS[r.freq].label:"Weekly";}
function personRhythms(p,cat){return ((p&&p.rhythms)||[]).filter(function(r){return !cat||(r.category||"connection")===cat;});}
function rhythmLast(r){var best=null;S.events.forEach(function(e){if(e.rhythmId===r.id&&(!best||e.ts>best.ts))best=e;});return best;}
function rhythmDaysSince(r){var l=rhythmLast(r);return l?daysSince(l.ts):999;}
function rhythmScore(r){var d=rhythmDaysSince(r);if(d===999)return 45;var missed=Math.floor(d/rhythmPeriod(r));return Math.max(10,100-10*missed);}
function rhythmDueTxt(r){var d=rhythmDaysSince(r);if(d===999)return "not started yet";var per=rhythmPeriod(r);if(d===0)return "done today";var miss=Math.floor(d/per);if(miss<1)return "due in "+Math.ceil(per-d)+"d";if(miss===1)return "due now";return "overdue - "+miss+" periods";}
function personTouchInfo(p){var last=null;S.events.forEach(function(e){if(e.personId===p.id&&e.kind!=="prayer"&&e.type!=="prayer"&&(!last||e.ts>last.ts))last=e;});return {last:last,days:last?daysSince(last.ts):999};}
function touchScoreFromDays(d){return Math.max(10,100-10*d);}
function touchSuggestion(p){var ideas={qt:["Plan a 30-minute walk together","Coffee and conversation, phones down","Do an errand side by side"],wa:["Text one specific encouragement","Speak an affirmation out loud","Write a short note of thanks"],as:["Do one of their chores, unasked","Bring their favorite drink home","Fix something on their list"],gf:["Pick up a small favorite treat","Order the book they mentioned","Send flowers for no reason"],pt:["A long, unhurried hug","Sit close this evening","Take a walk hand in hand"]};var arr=(p&&p.loveLanguage&&ideas[p.loveLanguage])||["Send a thoughtful text","A quick call on the commute","A handwritten note"];return arr[Math.floor(Date.now()/864e5)%arr.length];}
function personScore(p){
 var crs=personRhythms(p,"connection"),prs=personRhythms(p,"prayer");
 var ti=personTouchInfo(p),ts=touchScoreFromDays(ti.days);
 var conn=crs.length?avg(crs.map(rhythmScore)):connScoreFromDays(ti.days,personCadenceDays(p));
 var ps=prs.length?avg(prs.map(rhythmScore)):prayerScoreFromDays(personPrayerInfo(p).days);
 if(!crs.length&&!prs.length)return Math.round(0.7*conn+0.3*ps);
 return Math.round(clamp(0.4*conn+0.3*ts+0.3*ps,0,100));
}
function nextOccurrence(kd){var t=new Date();var d=new Date(t.getFullYear(),kd.month-1,kd.day);if(d<t)d=new Date(t.getFullYear()+1,kd.month-1,kd.day);return d;}
function daysUntil(kd){return Math.ceil((nextOccurrence(kd)-new Date())/86400000);}
function trend(id){var g=areaGoals(id);var any=g.some(function(gg){var e=lastGoalEvent(gg);return e&&(Date.now()-e.ts)<7*86400000;});return any?{cls:"up",arrow:"\u25B2"}:{cls:"flat",arrow:"\u25AC"};}
/* ============ helpers ============ */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
function personName(id){var p=S.people.find(function(x){return x.id===id;});return p?p.name:"";}
function when(ts){var d=daysSince(ts);if(d===0)return "today";if(d===1)return "yesterday";if(d<7)return d+" days ago";if(d<30)return Math.floor(d/7)+" wk ago";return Math.floor(d/30)+" mo ago";}
var AREA_IDS=["faith","marriage","parenting","health","finances","friendships"];
var AREA_ICONS={
 faith:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7 9h10"/></svg>',
 marriage:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/></svg>',
 parenting:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9h-6v-6h-4v6H4z"/></svg>',
 health:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
 finances:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M14.8 9.6c-.6-.8-1.6-1.1-2.8-1.1-1.6 0-2.7.7-2.7 1.9 0 2.5 5.6 1.3 5.6 3.8 0 1.2-1.2 1.9-2.9 1.9-1.3 0-2.4-.4-3-1.2"/></svg>',
 friendships:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.2 15.6a4.6 4.6 0 0 1 4.3 3.9"/></svg>'};
var tab="today",openDetail=null,currentPerson=null;
function el(id){return document.getElementById(id);}
function meterBar(v,cls){return '<div class="bar"><i class="'+cls+'" style="width:'+v+'%"></i></div>';}
function personChip(k){var ps=personScore(k);var c=scoreClass(ps);return '<span class="submeter" data-person="'+k.id+'" title="'+scoreLabel(ps)+'"><span class="sm-dot '+c+'"></span><span class="sm-name">'+esc(k.name)+'</span><span class="sm-bar"><i class="'+c+'" style="width:'+ps+'%"></i></span><span class="sm-num">'+ps+'</span></span>';}

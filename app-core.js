"use strict";
/* ============ Tend core: state, goals, meter engine v2 ============ */
var LS_STATE="tend:state",LS_SYNC="tend:sync";
var KINDS={coffee:{label:"Coffee / one-on-one",w:8},meal:{label:"Meal together",w:7},date:{label:"Date / night out",w:9},call:{label:"Call / FaceTime",w:4},text:{label:"Text / note",w:2},quality:{label:"Quality time",w:7},workout:{label:"Workout",w:5},outdoors:{label:"Walk / outdoors",w:4},prayer:{label:"Prayer",w:4},scripture:{label:"Scripture",w:3},rest:{label:"Rest / sabbath",w:5},actservice:{label:"Act of service",w:6},note:{label:"Note / journal",w:2}};
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
 {id:"g-walk",area:"fitness",text:"Evening walk with Amy",cadence:"daily",personId:"amy",kind:"outdoors"},
 {id:"g-strength",area:"fitness",text:"30 min strength training",cadence:"custom",days:2,kind:"workout"},
 {id:"g-core",area:"fitness",text:"Daily core: plank 3 min, ab wheel, decline sit-ups",cadence:"daily",kind:"workout"},
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
function defaultState(){return{version:2,
 people:[{id:"amy",name:"Amy",relation:"wife",area:"marriage"},{id:"hannah",name:"Hannah",relation:"daughter",area:"parenting"},{id:"jacob",name:"Jake",relation:"son",area:"parenting"},{id:"leah",name:"Leah",relation:"daughter",area:"parenting"},{id:"lucas",name:"Lucas",relation:"son-in-law",area:"parenting"},{id:"addi",name:"Addi",relation:"future daughter-in-law",area:"parenting"}],
 events:[],tasks:[],goals:defaultGoals(),followups:[],prayers:[],ideas:[],echoes:[{id:uid(),title:"Photographers - Jake & Addi's wedding",note:"Contacts to reach out to. Tap a status badge to cycle: to contact / contacted / met / booked / passed.",items:[]}],keyDates:defaultKeyDates(),checklists:defaultChecklists(),settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
 areas:{faith:{name:"Faith"},marriage:{name:"Marriage"},parenting:{name:"Parenting"},health:{name:"Health"},fitness:{name:"Fitness"},finances:{name:"Finances"},friendships:{name:"Friendships"}}};}
function load(){try{var s=localStorage.getItem(LS_STATE);if(!s)return defaultState();var st=JSON.parse(s);st.version=2;
 if(!st.areas.finances)st.areas.finances={name:"Finances"};
 var wantPeople=[{id:"amy",name:"Amy",relation:"wife"},{id:"hannah",name:"Hannah",relation:"daughter"},{id:"jacob",name:"Jake",relation:"son"},{id:"leah",name:"Leah",relation:"daughter"},{id:"lucas",name:"Lucas",relation:"son-in-law"},{id:"addi",name:"Addi",relation:"future daughter-in-law"}];
 wantPeople.forEach(function(p){var ex=st.people&&st.people.find(function(x){return x.id===p.id;});if(ex){if(p.id==="jacob")ex.name="Jake";ex.area=ex.area||"parenting";}else{st.people=st.people||[];st.people.push({id:p.id,name:p.name,relation:p.relation,area:p.id==="amy"?"marriage":"parenting"});}});
 st.goals=st.goals&&st.goals.length?st.goals:defaultGoals();
 st.keyDates=st.keyDates&&st.keyDates.length?st.keyDates:defaultKeyDates();
 st.checklists=st.checklists&&st.checklists.length?st.checklists:defaultChecklists();
 st.settings=st.settings||JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
 st.ideas=st.ideas||[];
 st.echoes=st.echoes&&st.echoes.length?st.echoes:defaultState().echoes;
 ["events","tasks","followups","prayers","teachings"].forEach(function(k){st[k]=st[k]||[];});
 if(st.teachings&&st.teachings.length&&!st.ideas.length){st.teachings.forEach(function(t){st.ideas.push({id:uid(),text:t.topic+(t.notes?" - "+t.notes:""),ts:Date.now(),done:false,converted:null});});}
 return st;}catch(e){return defaultState();}}
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
function rawScore(evs,base){base=(base===undefined)?settings().baseline:base;if(!evs.length)return base;var bonus=0,last=0;evs.forEach(function(e){var d=daysSince(e.ts);if(d>90)return;bonus+=(e.weight||3)*clamp(1-d/45,0,1);if(d>last)last=d;});return clamp(Math.round(settings().baseline-1.4*clamp(last,0,30)+bonus),0,100);}
function eventsFor(areaId,personId){return S.events.filter(function(e){return e.areaId===areaId&&(personId?e.personId===personId:!e.personId);});}
function areaGoals(id){return S.goals.filter(function(g){return g.area===id;});}
function personGoals(pid){return S.goals.filter(function(g){return g.personId===pid;});}
function avg(arr){if(!arr.length)return null;return Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length);}
function areaScore(id){var g=areaGoals(id).map(goalScore);return avg(g)!==null?avg(g):rawScore(eventsFor(id));}
function personScore(p){var g=personGoals(p.id).map(goalScore);if(g.length)return avg(g);return rawScore(eventsFor(p.area,p.id));}
function nextOccurrence(kd){var t=new Date();var d=new Date(t.getFullYear(),kd.month-1,kd.day);if(d<t)d=new Date(t.getFullYear()+1,kd.month-1,kd.day);return d;}
function daysUntil(kd){return Math.ceil((nextOccurrence(kd)-new Date())/86400000);}
function trend(id){var g=areaGoals(id);var any=g.some(function(gg){var e=lastGoalEvent(gg);return e&&(Date.now()-e.ts)<7*86400000;});return any?{cls:"up",arrow:"\u25B2"}:{cls:"flat",arrow:"\u25AC"};}
/* ============ helpers ============ */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function personName(id){var p=S.people.find(function(x){return x.id===id;});return p?p.name:"";}
function when(ts){var d=daysSince(ts);if(d===0)return "today";if(d===1)return "yesterday";if(d<7)return d+" days ago";if(d<30)return Math.floor(d/7)+" wk ago";return Math.floor(d/30)+" mo ago";}
var AREA_IDS=["faith","marriage","parenting","health","fitness","finances","friendships"];
var tab="today",openDetail=null,currentPerson=null;
function el(id){return document.getElementById(id);}
function meterBar(v,cls){return '<div class="bar"><i class="'+cls+'" style="width:'+v+'%"></i></div>';}
function personChip(k){var ps=personScore(k);var c=scoreClass(ps);return '<span class="submeter" data-person="'+k.id+'" title="'+scoreLabel(ps)+'"><span class="sm-dot '+c+'"></span><span class="sm-name">'+esc(k.name)+'</span><span class="sm-bar"><i class="'+c+'" style="width:'+ps+'%"></i></span><span class="sm-num">'+ps+'</span></span>';}

"use strict";
/* ============ Tend core: state and meter engine v2 ============ */
var LS_STATE="tend:state",LS_SYNC="tend:sync";
var KINDS={coffee:{label:"Coffee / one-on-one",w:8},meal:{label:"Meal together",w:7},date:{label:"Date / night out",w:9},call:{label:"Call / FaceTime",w:4},text:{label:"Text / note",w:2},quality:{label:"Quality time",w:7},workout:{label:"Workout",w:5},outdoors:{label:"Walk / outdoors",w:4},prayer:{label:"Prayer",w:4},scripture:{label:"Scripture",w:3},rest:{label:"Rest / sabbath",w:5},actservice:{label:"Act of service",w:6},note:{label:"Note / journal",w:2}};
var ETYPES={inperson:{label:"In Person",w:8},text:{label:"Text",w:2},call:{label:"Call",w:5},video:{label:"Facetime",w:6},prayer:{label:"Prayer",w:3},quality:{label:"In Person",w:8},note:{label:"Handwritten Note",w:2},gift:{label:"Gift",w:5},other:{label:"Other",w:3}};
var KIND2TYPE={coffee:"inperson",meal:"inperson",date:"inperson",quality:"inperson",call:"call",text:"text",workout:"inperson",outdoors:"inperson",prayer:"note",scripture:"note",rest:"note",actservice:"inperson",note:"note"};
var RIPPLE_TYPES={text:"Text",call:"Call",video:"Facetime",prayer:"Prayer",quality:"In Person",note:"Handwritten Note",gift:"Gift",other:"Other"};
function typeLabel(e){if(e.rippleLabel)return e.rippleLabel==="One-on-One"?"In Person":e.rippleLabel;return e.type&&ETYPES[e.type]?ETYPES[e.type].label:(KINDS[e.kind]?KINDS[e.kind].label:e.kind);}
function typeWeight(e){return e.type&&ETYPES[e.type]?ETYPES[e.type].w:(KINDS[e.kind]?KINDS[e.kind].w:3);}
var DEFAULT_SETTINGS={greenAt:80,yellowAt:50,baseline:50};
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
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
function defaultSparks(){return[{id:uid(),text:"Watch the movie Jake mentioned",by:todayStr(),tod:"evening",done:false}];}
function defaultFaithRhythms(){return[
 {id:uid(),text:"Scripture reading",category:"faith",group:"Scripture",freq:"daily",tod:"early",takeNotes:true,description:"Immersing yourself in the Bible to know and love God more.",disabled:false},
 {id:uid(),text:"Solitude & silence",category:"faith",group:"Solitude",freq:"weekly",tod:"anytime",takeNotes:true,description:"Withdrawing from noise and people to be alone with God.",disabled:false},
 {id:uid(),text:"Sabbath",category:"faith",group:"Sabbath",freq:"weekly",tod:"anytime",scheduleDow:0,description:"A full day of rest, delight, and presence with God and others.",disabled:false},
 {id:uid(),text:"Community gathering",category:"faith",group:"Community",freq:"weekly",tod:"anytime",description:"Meeting with the people of God for worship, teaching, and life together.",disabled:false},
 {id:uid(),text:"Fasting",category:"faith",group:"Fasting",freq:"weekly",tod:"anytime",description:"Voluntarily abstaining from food to create space for God.",disabled:false},
 {id:uid(),text:"Generosity practice",category:"faith",group:"Generosity",freq:"monthly",tod:"anytime",description:"Giving away money, time, or resources as an act of worship.",disabled:false},
 {id:uid(),text:"Serve someone",category:"faith",group:"Service",freq:"weekly",tod:"anytime",description:"Using your gifts and time to serve others in love.",disabled:false},
 {id:uid(),text:"Share your story",category:"faith",group:"Witness",freq:"monthly",tod:"anytime",description:"Telling others about Jesus through word and deed.",disabled:false}
];}
function defaultCategories(){return{
 connection:{label:"People",icon:"👤"},
 faith:{label:"Faith",icon:"+"},
 health:{label:"Health",icon:"♥"},
 fitness:{label:"Fitness",icon:"⚡"}
};}
function defaultFaithConfig(){return{
 disabledGroups:[],
 groupDescriptions:{
  Scripture:"Build a steady practice of reading and reflecting on Scripture.",
  Prayer:"A place to hold your active requests and make room for focused prayer.",
  Solitude:"Make room for quiet, reflection, and listening.",
  Sabbath:"A weekly invitation to pause, delight, and reconnect with God.",
  Community:"Strengthen belonging through shared worship and life together.",
  Fasting:"Explore intentional practices of simplicity and attentiveness.",
  Generosity:"Practice open-handed living with what you have.",
  Service:"Turn care for others into regular acts of service.",
  Witness:"Live and share your faith with the people around you.",
  Other:"A home for spiritual practices that do not fit another section."
 }
};}
function todayStr(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function rhythmEnded(r){return !!(r&&r.until&&todayStr()>r.until);}
function nowHM(){var d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function fmtHM(ts){var d=new Date(ts);var h=d.getHours(),m=String(d.getMinutes()).padStart(2,"0");var ap=h>=12?"pm":"am";h=h%12||12;return h+":"+m+ap;}
function defaultState(){return{version:2,
 people:[{id:"amy",name:"Amy",relation:"Spouse",area:"marriage",rhythms:defaultRhythms()},{id:"hannah",name:"Hannah",relation:"Daughter",area:"parenting"},{id:"jacob",name:"Jake",relation:"Son",area:"parenting",sparks:defaultSparks()},{id:"leah",name:"Leah",relation:"Daughter",area:"parenting"},{id:"lucas",name:"Lucas",relation:"Bonus son",area:"parenting"},{id:"addi",name:"Addi",relation:"Bonus daughter",area:"parenting"}],
 events:[],tasks:[],followups:[],prayers:[],ideas:[],echoes:[{id:uid(),title:"Photographers - Jake & Addi's wedding",note:"Contacts to reach out to. Status: to contact / contacted / met / booked / passed.",items:[]}],keyDates:defaultKeyDates(),checklists:defaultChecklists(),settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),rhythms:defaultFaithRhythms(),categories:defaultCategories(),faithConfig:defaultFaithConfig(),
 calendars:[{id:"cal-home",name:"Home",url:"https://p106-caldav.icloud.com/published/2/MjcyMTgwNTc5MjcyMTgwNfAweM4Mnge_B7jsSIKiQGrhnfAemrtl8LYeoKtz2A0MTFihcXWvdiyB4fotJ9jrIRWeawSqJWitMgtfFaZ1XRxvE-3phMRdiHY_izguI0iXG6szeG4SjHgOO6Uvy8Rgbw",color:"#4C9AFF"}],
 areas:{faith:{name:"Faith"},marriage:{name:"Marriage"},parenting:{name:"Parenting"},health:{name:"Health & Fitness"},finances:{name:"Finances"},friendships:{name:"Friendships"}}};}
function load(){try{var s=localStorage.getItem(LS_STATE);if(!s)return defaultState();var original=JSON.parse(s),needsGoalCleanup=!!original&&(Object.prototype.hasOwnProperty.call(original,"goals")||(Array.isArray(original.events)&&original.events.some(function(event){return !!event.goalId;}))),st=ensureShape(original);st.version=2;
if(st.areas&&st.areas.fitness){st.areas.health={name:"Health & Fitness"};delete st.areas.fitness;(st.events||[]).forEach(function(x){if(x.areaId==="fitness")x.areaId="health";});(st.tasks||[]).forEach(function(x){if(x.areaId==="fitness")x.areaId="health";});}
 if(!st.areas.finances)st.areas.finances={name:"Finances"};
 var wantPeople=[{id:"amy",name:"Amy",relation:"wife"},{id:"hannah",name:"Hannah",relation:"daughter"},{id:"jacob",name:"Jake",relation:"son"},{id:"leah",name:"Leah",relation:"daughter"},{id:"lucas",name:"Lucas",relation:"son-in-law"},{id:"addi",name:"Addi",relation:"future daughter-in-law"}];
 wantPeople.forEach(function(p){var ex=st.people&&st.people.find(function(x){return x.id===p.id;});if(ex){if(p.id==="jacob")ex.name="Jake";ex.area=ex.area||"parenting";}else{st.people.push({id:p.id,name:p.name,relation:p.relation,area:p.id==="amy"?"marriage":"parenting"});}});
 var _am=st.people.find(function(x){return x.id==="amy";});if(_am&&!_am.rhythms)_am.rhythms=defaultRhythms();
var _jk=st.people.find(function(x){return x.id==="jacob";});if(_jk&&!(_jk.sparks&&_jk.sparks.length))_jk.sparks=defaultSparks();
 st.keyDates=st.keyDates&&st.keyDates.length?st.keyDates:defaultKeyDates();
 st.checklists=st.checklists&&st.checklists.length?st.checklists:defaultChecklists();
 st.ideas=st.ideas||[];st.echoes=st.echoes&&st.echoes.length?st.echoes:defaultState().echoes;
 if(needsGoalCleanup)localStorage.setItem(LS_STATE,JSON.stringify(st));return st;}catch(e){return defaultState();}}
function ensureShape(st){st=st||{};["events","tasks","followups","prayers","ideas","echoes","keyDates","checklists"].forEach(function(k){if(!Array.isArray(st[k]))st[k]=[];});var hadGoals=!!(Array.isArray(st.goals)&&st.goals.length)||(Array.isArray(st.events)&&st.events.some(function(event){return !!event.goalId;}));if(hadGoals&&typeof window!=="undefined")window._goalDataPurged=true;delete st.goals;st.events=st.events.filter(function(event){return !event.goalId;});if(!Array.isArray(st.calendars)||!st.calendars.length)st.calendars=defaultState().calendars;if(!st.people||!st.people.length)st.people=defaultState().people;if(!st.areas)st.areas=defaultState().areas;if(!st.settings)st.settings=JSON.parse(JSON.stringify(DEFAULT_SETTINGS));if(!Array.isArray(st.rhythms))st.rhythms=defaultFaithRhythms();if(!st.categories)st.categories=defaultCategories();var faithDefaults=defaultFaithConfig();if(!st.faithConfig)st.faithConfig=faithDefaults;else{if(!Array.isArray(st.faithConfig.disabledGroups))st.faithConfig.disabledGroups=[];st.faithConfig.groupDescriptions=Object.assign({},faithDefaults.groupDescriptions,st.faithConfig.groupDescriptions||{});}st.people.forEach(function(p){if(p.encouragementNote&&p.encouragementNote.trim()&&!p.encouragementChecklistMigrated){var id="enc-legacy-"+p.id;if(!st.followups.some(function(f){return f.id===id;}))st.followups.push({id:id,personId:p.id,kind:"encouragement",text:p.encouragementNote,done:false});p.encouragementChecklistMigrated=true;}if(!p.prayerNotesChecklistMigrated){[["howToPray","prayer-request-note"],["prayerFocus","prayer-focus-note"]].forEach(function(pair){var text=p[pair[0]],id="prayer-note-"+pair[0]+"-"+p.id;if(text&&text.trim()&&!st.followups.some(function(f){return f.id===id;}))st.followups.push({id:id,personId:p.id,kind:pair[1],text:text,done:false});});p.prayerNotesChecklistMigrated=true;}});return st;}
var S=load();
var saveTimer=null,pushTimer=null;
function save(){localStorage.setItem(LS_STATE,JSON.stringify(S));window._tendDirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(function(){flash("Saved");},150);if(window.SYNCcfg&&SYNCcfg.auto&&SYNCcfg.token&&typeof schedulePush==="function")schedulePush();}
function flash(msg){var f=document.getElementById("flash");f.textContent=msg||"Saved";f.classList.add("show");clearTimeout(flash._t);flash._t=setTimeout(function(){f.classList.remove("show");},1200);}
/* ============ meters ============ */
function daysSince(ts){
 var logged=new Date(ts),today=new Date();
 if(isNaN(logged.getTime()))return 999;
 var loggedDay=Date.UTC(logged.getFullYear(),logged.getMonth(),logged.getDate());
 var todayDay=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
 return Math.max(0,Math.round((todayDay-loggedDay)/86400000));
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function settings(){return S.settings||DEFAULT_SETTINGS;}
function scoreBaseline(){var saved=settings().baseline;if(saved===null||saved===undefined||saved==="")return DEFAULT_SETTINGS.baseline;var value=Number(saved);return Number.isFinite(value)?clamp(value,0,100):DEFAULT_SETTINGS.baseline;}
function scoreClass(v){if(v===null||v===undefined)return "neutral";var s=settings();return v>=s.greenAt?"green":(v>=s.yellowAt?"yellow":"red");}
function scoreLabel(v){var s=settings();if(v>=s.greenAt)return "Healthy";if(v>=s.yellowAt)return "Slipping - tend it soon";return "Needs attention now";}
function rawScore(evs,base){base=(base===undefined)?scoreBaseline():base;if(!Number.isFinite(base))base=scoreBaseline();if(!evs.length)return base;var bonus=0,last=0;evs.forEach(function(e){var d=daysSince(e.ts);if(d>90)return;bonus+=(e.weight||typeWeight(e))*clamp(1-d/45,0,1);if(d>last)last=d;});return clamp(Math.round(base-1.4*clamp(last,0,30)+bonus),0,100);}
function migrateEvents(){S.events.forEach(function(e){if(!e.type)e.type=KIND2TYPE[e.kind]||"note";if(!e.title&&e.kind&&KINDS[e.kind])e.title=KINDS[e.kind].label;});}
migrateEvents();
function eventHasPerson(e,pid){return e.personId===pid||(Array.isArray(e.personIds)&&e.personIds.indexOf(pid)!==-1);}
function eventsFor(areaId,personId){return S.events.filter(function(e){return e.areaId===areaId&&(personId?eventHasPerson(e,personId):!e.personId&&!e.personIds);});}
function avg(arr){arr=arr.filter(function(v){return Number.isFinite(v);});if(!arr.length)return null;return Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length);}
function areaScore(id){
 if(id==="faith"&&typeof faithScores==="function"){var faith=faithScores().overall;return faith===null?0:faith;}
 var rhythms=S.rhythms.filter(function(r){return r.category===id&&!r.disabled;});
 var rhythmAverage=avg(rhythms.map(rhythmScore));
 if(rhythmAverage!==null)return rhythmAverage;
 return rawScore(eventsFor(id));
}
/* ============ person score: connection-first ============ */
function personCadenceDays(p){var cc=p.connectCadence||"weekly";if(cc==="daily")return 1;if(cc==="twicewk")return 3.5;if(cc==="weekly")return 7;if(cc==="biweekly")return 14;if(cc==="monthly")return 30;return p.cadenceDays||30;}
function personCadenceLabel(p){var cc=p.connectCadence||"weekly";return {daily:"daily",twicewk:"twice weekly",weekly:"weekly",biweekly:"every 2 weeks",monthly:"monthly"}[cc]||("every "+(p.cadenceDays||30)+" days");}
function personCadenceTargetLabel(p){return {daily:"daily interaction",twicewk:"2 interactions a week",weekly:"weekly interaction",biweekly:"interaction every 2 weeks",monthly:"monthly interaction"}[p.connectCadence||"weekly"]||("interaction every "+personCadenceDays(p)+" days");}
function connectionEvent(e){return !!e.ts&&e.type!=="prayer"&&e.kind!=="prayer"&&(!!e.rhythmId||e.origin==="spark"||["quality","inperson","call","video","text","note","gift","other"].indexOf(e.type)>=0);}
function personConnInfo(p){var last=null;S.events.forEach(function(e){if(eventHasPerson(e,p.id)&&connectionEvent(e)&&(!last||e.ts>last.ts))last=e;});return {last:last,days:last?daysSince(last.ts):999};}
function personPrayerInfo(p){var last=null;S.events.forEach(function(e){if(e.personId===p.id&&(e.kind==="prayer"||e.type==="prayer")&&(!last||e.ts>last.ts))last=e;});return {last:last,days:last?daysSince(last.ts):999};}
function connScoreFromDays(d,cad){var r=d/cad,v;if(r<=0.33)v=100;else if(r<=1)v=100-30*(r-0.33)/0.67;else if(r<=2)v=70-30*(r-1);else if(r<3)v=40-30*(r-2);else v=10;return Math.round(clamp(v,10,100));}
function prayerScoreFromDays(d){return Math.round(clamp(100-10*d,30,100));}
/* ============ rhythms: recurring care commitments ============ */
var FREQS={daily:{label:"Daily",days:1},twicewk:{label:"2x a week",days:3.5},weekly:{label:"Weekly",days:7},biweekly:{label:"Every 2 weeks",days:14},monthly:{label:"Monthly",days:30},quarterly:{label:"Quarterly",days:91},yearly:{label:"Yearly",days:365}};
var DUR_UNITS={min:{label:"Minutes",max:120},hrs:{label:"Hours",max:24},days:{label:"Days",max:14}};
var DUR_LEGACY={"15 min":[15,"min"],"30 min":[30,"min"],"1 hr":[1,"hrs"],"2 hrs":[2,"hrs"],"Half day":[4,"hrs"],"Full day":[1,"days"],"Overnight":[1,"days"],"Weekend":[2,"days"],"2 days":[2,"days"]};
function durUnitOf(r){if(r.durUnit&&DUR_UNITS[r.durUnit])return r.durUnit;var m=DUR_LEGACY[r.dur];return m?m[1]:"min";}
function durValOf(r){if(r.durVal)return r.durVal;var m=DUR_LEGACY[r.dur];return m?m[0]:0;}
function rhythmDurLabel(r){if(!r)return"";var v=+r.durVal||0,u=r.durUnit;if(!v){var m=DUR_LEGACY[r.dur];if(m){v=m[0];u=m[1];}else return r.dur||"";}if(u==="min")return v+" min";if(u==="hrs")return v+(v===1?" hr":" hrs");return v+(v===1?" day":" days");}
var DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var DOW_SHORT=["S","M","T","W","T","F","S"];
function scheduleOptions(options,current){return options.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(current)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');}
function scheduleWeekdayPills(selected,attr,allowMultiple){var days=Array.isArray(selected)?selected.map(Number):[];return '<span class="dow-pills" data-schedule-days="'+(allowMultiple?'multiple':'single')+'">'+DOW.map(function(day,i){return '<label class="dow-pill"><input type="checkbox" '+attr+' value="'+i+'" aria-label="'+day+'"'+(days.indexOf(i)>=0?' checked':'')+'><span aria-hidden="true">'+day.charAt(0)+'</span></label>';}).join('')+'</span>';}
function scheduleMonthPattern(item,attr,group){var mode=item.monthlyMode==="onThe"?"onThe":"onDay",day=+item.dayOfMonth||1,ord=+item.ord||1,dow=+item.ordWeekday||0;return '<div class="addrow"><label class="rmode"><input type="radio" name="'+group+'" '+attr('monthlyMode')+' value="onDay"'+(mode==='onDay'?' checked':'')+'> On day</label><select '+attr('dayOfMonth')+(mode==='onThe'?' disabled':'')+'>'+scheduleOptions(Array.from({length:28},function(_,i){return [i+1,String(i+1)];}),day)+'</select></div><div class="addrow"><label class="rmode"><input type="radio" name="'+group+'" '+attr('monthlyMode')+' value="onThe"'+(mode==='onThe'?' checked':'')+'> On the</label><select '+attr('ord')+(mode==='onDay'?' disabled':'')+'>'+scheduleOptions([[1,'1st'],[2,'2nd'],[3,'3rd'],[4,'4th'],[5,'last']],ord)+'</select><select '+attr('ordWeekday')+(mode==='onDay'?' disabled':'')+'>'+scheduleOptions(DOW.map(function(d,i){return [i,d];}),dow)+'</select></div>';}
function scheduleEndDate(item,attr,fieldAttr){var on=!!(item.until||item.endDateEnabled);return '<div class="rhy-end-date"><label class="rhy-end-toggle"><input type="checkbox" '+attr('endDateEnabled')+(on?' checked':'')+'> End date</label><label class="rhy-end-field" '+fieldAttr+(on?'':' hidden')+'>Ends on<input type="date" '+attr('until')+' value="'+esc(item.until||'')+'"'+(on?' required':' disabled')+'></label></div>';}
function scheduleHasWeekday(freq){return ["weekly","biweekly","monthly","quarterly","yearly","annual"].indexOf(freq)!==-1;}
function scheduleDayLabel(item){var freq=item.freq||item.cadence;if(!scheduleHasWeekday(freq))return "";if(Array.isArray(item.scheduleDows)&&item.scheduleDows.length)return item.scheduleDows.map(function(d){return DOW_SHORT[d];}).join(",");return item.scheduleDow!==null&&item.scheduleDow!==undefined&&DOW[+item.scheduleDow]?DOW[+item.scheduleDow]:"";}
function scheduleDayMatches(item,date){var dow=(date||new Date()).getDay();if(Array.isArray(item.scheduleDows)&&item.scheduleDows.length)return item.scheduleDows.indexOf(dow)>=0;if(Array.isArray(item.weekdays)&&item.weekdays.length)return item.weekdays.map(Number).indexOf(dow)>=0;var day=scheduleDayLabel(item);return !day||day===DOW[dow];}
function scheduleDayOptions(selected){return '<option value="">Any day</option>'+DOW.map(function(day,i){return '<option value="'+i+'"'+(selected!==null&&selected!==undefined&&String(selected)===String(i)?' selected':'')+'>'+day+'</option>';}).join('');}
function dayCirclesHTML(selected,prefix){var out="<span class=\"day-circles\" data-circles=\""+prefix+"\">";DOW_SHORT.forEach(function(d,i){var sel=Array.isArray(selected)?selected.indexOf(i)>=0:selected===i;out+="<span class=\"day-circle\""+(sel?" on":"")+" data-circle=\""+i+"\">"+d+"</span>";});return out+"</span>";}
var ORDINALS=["1st","2nd","3rd","4th"];
function rhythmPeriod(r){if(r.freq==="custom")return r.customType==="monthly"?30:7;return FREQS[r.freq]?FREQS[r.freq].days:7;}
function rhythmFreqLabel(r){if(r.freq==="custom"){if(r.customType==="monthly")return ORDINALS[(r.customOrd||1)-1]+" "+DOW[r.customDow||0]+" of the month";return DOW[r.customDow||0]+"s";}return FREQS[r.freq]?FREQS[r.freq].label:"Weekly";}
function personRhythms(p,cat){return ((p&&p.rhythms)||[]).filter(function(r){return !cat||(r.category||"connection")===cat;});}
function rhythmLast(r){var best=null;S.events.forEach(function(e){if(e.rhythmId===r.id&&(!best||e.ts>best.ts))best=e;});return best;}
function rhythmDaysSince(r){var l=rhythmLast(r);return l?daysSince(l.ts):999;}
function rhythmScore(r){var d=rhythmDaysSince(r);if(d===999)return 0;var per=rhythmPeriod(r);if(d<per)return 100;return Math.max(0,100-10*(d-per+1));}
function rhythmDueTxt(r){var d=rhythmDaysSince(r);if(d===999)return "not yet tended";var per=rhythmPeriod(r);if(d===0)return "tended today";if(d<per){var remaining=Math.ceil(per-d);return remaining===1?"due tomorrow":"due in "+remaining+" days";}if(d===per)return "due today";return "ready to tend again";}
function sparkDays(s){if(!s.by)return 999;var t=new Date();t.setHours(12,0,0,0);return Math.round((new Date(s.by+"T12:00:00")-t)/86400000);}
function sparkDueTxt(s){if(!s.by)return "someday";var d=sparkDays(s);if(d<0)return (-d)+"d overdue";if(d===0)return "today";if(d===1)return "tomorrow";return "in "+d+"d";}
function sparkLive(s){if(s.done)return false;if(!s.by)return true;return sparkDays(s)<=0;}
function openSparks(p){return ((p&&p.sparks)||[]).filter(function(s){return !s.done;}).sort(function(a,b){return (a.by||"9999")<(b.by||"9999")?-1:1;});}
function personTouchInfo(p){return personConnInfo(p);}
function connectionScore(p){var info=personConnInfo(p);return info.last?Math.max(0,100-10*Math.max(0,Math.floor(info.days-personCadenceDays(p))+1)):0;}
function touchScoreFromDays(d,p){return p?connectionScore(p):Math.max(0,100-10*d);}
function touchSuggestion(p){var ideas={qt:["Plan a 30-minute walk together","Coffee and conversation, phones down","Do an errand side by side"],wa:["Text one specific encouragement","Speak an affirmation out loud","Write a short note of thanks"],as:["Do one of their chores, unasked","Bring their favorite drink home","Fix something on their list"],gf:["Pick up a small favorite treat","Order the book they mentioned","Send flowers for no reason"],pt:["A long, unhurried hug","Sit close this evening","Take a walk hand in hand"]};var arr=(p&&p.loveLanguage&&ideas[p.loveLanguage])||["Send a thoughtful text","A quick call on the commute","A handwritten note"];return arr[Math.floor(Date.now()/864e5)%arr.length];}
function personScore(p){var rhythms=avg(personRhythms(p).map(rhythmScore)),connection=connectionScore(p),prayer=typeof prayerMeterScore==="function"?prayerMeterScore(p):null,total=0,weight=0;
 if(rhythms!==null){total+=0.4*rhythms;weight+=0.4;}
 if(connection!==null){total+=0.3*connection;weight+=0.3;}
 if(prayer!==null){total+=0.3*prayer;weight+=0.3;}
 return weight?Math.round(clamp(total/weight,0,100)):0;
}
function nextOccurrence(kd){var t=new Date();var d=new Date(t.getFullYear(),kd.month-1,kd.day);if(d<t)d=new Date(t.getFullYear()+1,kd.month-1,kd.day);return d;}
function daysUntil(kd){return Math.ceil((nextOccurrence(kd)-new Date())/86400000);}
/* ============ helpers ============ */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function personName(id){var p=S.people.find(function(x){return x.id===id;});return p?p.name:"";}
function when(ts){var d=daysSince(ts);if(d===0)return "today";if(d===1)return "yesterday";if(d<7)return d+" days ago";if(d<30)return Math.floor(d/7)+" wk ago";return Math.floor(d/30)+" mo ago";}
var AREA_IDS=["faith","marriage","parenting","health","finances","friendships"];
var AREA_ICONS={faith:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7 9h10"/></svg>',marriage:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/></svg>',parenting:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9h-6v-6h-4v6H4z"/></svg>',health:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',finances:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M14.8 9.6c-.6-.8-1.6-1.1-2.8-1.1-1.6 0-2.7.7-2.7 1.9 0 2.5 5.6 1.3 5.6 3.8 0 1.2-1.2 1.9-2.9 1.9-1.3 0-2.4-.4-3-1.2"/></svg>',friendships:'<svg viewBox="0 0 24 24" fill="none" stroke="#3FC68F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.2 15.6a4.6 4.6 0 0 1 4.3 3.9"/></svg>'};
var tab="today",openDetail=null,currentPerson=null;
function el(id){return document.getElementById(id);}
function meterBar(v,cls){return '<div class="bar"><i class="'+cls+'" style="width:'+v+'%"></i></div>';}
function personChip(k){var ps=personScore(k);var c=scoreClass(ps);return '<span class="submeter" data-person="'+k.id+'" title="'+scoreLabel(ps)+'"><span class="sm-dot '+c+'"></span><span class="sm-name">'+esc(k.name)+'</span><span class="sm-bar"><i class="'+c+'" style="width:'+ps+'%"></i></span><span class="sm-num">'+ps+'</span></span>';}


function personAvatar(p,sz){if(p&&p.photo)return '<img class="avatar" src="'+p.photo+'" style="width:'+sz+'px;height:'+sz+'px" alt="">';var ini=((p&&p.name)||"?").split(" ").map(function(w){return w.charAt(0);}).join("").slice(0,2).toUpperCase();return '<span class="avatar init" style="width:'+sz+'px;height:'+sz+'px;font-size:'+Math.round(sz*.38)+'px">'+esc(ini)+'</span>';}
function fmtHM12(hm){var parts=String(hm||"").split(":");if(parts.length<2)return "";var h=+parts[0],m=+parts[1];if(isNaN(h)||isNaN(m))return "";var ap=h>=12?"pm":"am";h=h%12||12;return h+":"+String(m).padStart(2,"0")+ap;}
function sparkBlock(s){if(s.tod&&s.tod!=="anytime")return s.tod;if(s.time){var parts=s.time.split(":");var date=new Date();date.setHours(+parts[0],+parts[1],0,0);if(!isNaN(date.getTime()))return dayBlockAt(date);}return null;}
function findSparkById(sid){var f=null;S.people.forEach(function(x){((x.sparks)||[]).forEach(function(s2){if(s2.id===sid)f=s2;});});return f;}
function annivInfo(b){if(!b)return null;var parts=String(b).split("-");if(parts.length<3)return null;var m=+parts[1],d=+parts[2];if(!m||!d)return null;var t=new Date();var today=new Date(t.getFullYear(),t.getMonth(),t.getDate());var next=new Date(t.getFullYear(),m-1,d);if(next<today)next=new Date(t.getFullYear()+1,m-1,d);var du=Math.round((next-today)/86400000);var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];return {label:mos[m-1]+" "+d,days:du};}
function personDateLines(p){var out="";if(!p)return out;var kds=S.keyDates||[];var hasBd=kds.some(function(k){return k.personId===p.id&&/birth/i.test(k.label||"");});var hasAn=kds.some(function(k){return k.personId===p.id&&/anniv/i.test(k.label||"");});if(p.birthday&&!hasBd){var b2=bdayInfo(p.birthday);if(b2)out+='<div class="pf-next">🎂 Birthday · '+esc(b2.label)+' · in '+b2.days+'d</div>';}if(p.anniversary&&!hasAn){var a2=annivInfo(p.anniversary);if(a2)out+='<div class="pf-next">♥ Anniversary · '+esc(a2.label)+' · in '+a2.days+'d</div>';}return out;}

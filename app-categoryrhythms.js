"use strict";
/* Category links for person rhythms and rhythms owned by an area. */
(function(){
 var CATEGORY_AREAS=["faith","marriage","parenting","health","finances","friendships"];
 var CATEGORY_AREA_LABELS={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var FAITH_SUBCATEGORIES=typeof FAITH_GROUPS!=="undefined"?FAITH_GROUPS.slice():["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
 var CATEGORY_AREA_SET=CATEGORY_AREAS.reduce(function(out,id){out[id]=true;return out;},{});
 var MARRIAGE_FOUNDATIONS=[
  {id:"connection",name:"Connection",description:"Feeling known, loved, and emotionally close.",why:"Small moments of attention help you keep learning each other and feel close through ordinary days.",suggestions:["Set aside a few minutes to listen without distractions.","Name one thing you appreciated about your partner today."]},
  {id:"communication",name:"Communication",description:"Listening, understanding, and navigating life together.",why:"Clear, generous conversations help you understand each other and face decisions as a team.",suggestions:["Ask what has been taking up the most space in your partner’s mind.","Reflect back what you heard before offering a solution."]},
  {id:"fun-adventure",name:"Fun & Adventure",description:"Enjoying life together, laughter, and shared experiences.",why:"Shared enjoyment makes room for play, discovery, and memories beyond the day-to-day.",suggestions:["Plan one simple activity you would both enjoy.","Make room for a new experience, even a small one."]},
  {id:"spiritual-growth",name:"Spiritual Growth",description:"Shared faith, prayer, and spiritual growth.",why:"Shared spiritual practices create space to express gratitude, hopes, and care together.",suggestions:["Share one thing you are grateful for.","Pray together in a way that feels natural for both of you."]},
  {id:"partnership",name:"Partnership",description:"Teamwork, support, and shared responsibilities.",why:"Noticing what needs doing and supporting each other helps everyday life feel more shared.",suggestions:["Ask what would make this week feel lighter.","Choose one practical thing to take off each other’s plate."]},
  {id:"intimacy",name:"Intimacy",description:"Affection, romance, and physical closeness.",why:"Thoughtful affection and protected time help closeness grow at a pace that works for both of you.",suggestions:["Ask what helps your partner feel cared for today.","Make a little unhurried space for closeness."]}
 ];
 var MARRIAGE_FOUNDATION_BY_ID=MARRIAGE_FOUNDATIONS.reduce(function(out,item){out[item.id]=item;return out;},{});
 var MARRIAGE_RHYTHM_GROUPS=[
  {id:"daily",title:"Daily Connection",subtitle:"The little things that matter most."},
  {id:"weekly",title:"Weekly Investment",subtitle:"Protect time for your relationship."},
  {id:"seasonal",title:"Seasonal & Annual",subtitle:"Make room for deeper connection."}
 ];
 var MARRIAGE_RHYTHM_TEMPLATES=[
  {id:"marriage.daily-connection",title:"Daily Connection",freq:"custom",every:1,unit:"weeks",weeklyTarget:5,tod:"anytime",group:"daily",description:"Make a little room each day to connect in a way that fits your life.",primaryFoundation:"connection",secondaryFoundations:["communication","intimacy"],iconId:"daily-connection"},
  {id:"marriage.pray-together",title:"Pray Together",freq:"daily",tod:"evening",group:"daily",description:"Bring gratitude and needs before God together.",primaryFoundation:"spiritual-growth",secondaryFoundations:["connection"],iconId:"pray-together"},
  {id:"marriage.date-night",title:"Date Night",freq:"weekly",tod:"evening",group:"weekly",description:"Enjoy intentional time together beyond responsibilities and logistics.",primaryFoundation:"fun-adventure",secondaryFoundations:["connection"],iconId:"date-night"},
  {id:"marriage.marriage-check-in",title:"Marriage Check-In",freq:"weekly",tod:"anytime",group:"weekly",description:"Share appreciation, listen to concerns, and choose one supportive next step.",primaryFoundation:"communication",secondaryFoundations:["partnership"],iconId:"marriage-check-in"},
  {id:"marriage.thoughtful-act-of-love",title:"Thoughtful Act of Love",freq:"weekly",tod:"anytime",group:"weekly",description:"Choose a thoughtful action that helps your partner feel cared for.",primaryFoundation:"partnership",secondaryFoundations:["connection"],iconId:"thoughtful-act-of-love"},
  {id:"marriage.dream-together",title:"Dream Together",freq:"quarterly",tod:"anytime",group:"seasonal",description:"Talk about hopes, plans, and the next season of life.",primaryFoundation:"partnership",secondaryFoundations:["fun-adventure"],iconId:"dream-together"},
  {id:"marriage.overnight-away",title:"Overnight Away",freq:"quarterly",tod:"anytime",group:"seasonal",description:"Protect time away from the normal routine to reconnect.",primaryFoundation:"fun-adventure",secondaryFoundations:["intimacy"],iconId:"overnight-away"},
  {id:"marriage.marriage-enrichment",title:"Marriage Enrichment",freq:"yearly",tod:"anytime",group:"seasonal",description:"Make time to learn, reflect, and grow together.",primaryFoundation:"communication",secondaryFoundations:["partnership"],iconId:"marriage-enrichment"},
  {id:"marriage.week-away-together",title:"Week Away Together",freq:"yearly",tod:"anytime",group:"seasonal",description:"Protect extended time together for rest, enjoyment, and connection.",primaryFoundation:"fun-adventure",secondaryFoundations:["connection"],iconId:"week-away-together"}
 ];
 var MARRIAGE_PROMPT_CATEGORIES=[
  {id:"unhurried-conversation",label:"Unhurried Conversation",description:"Put distractions aside and listen.",prompts:["What has been taking up the most space in your mind lately?","What is something you have been enjoying that we have not talked about yet?","What are you looking forward to in the next few weeks?"]},
  {id:"intentional-affection",label:"Intentional Affection",description:"Explore the small ways care and closeness feel meaningful.",prompts:["What helps you feel cared for in an ordinary day?","What is one small way we could make more room for closeness this week?","When have you felt especially connected to me recently?"]},
  {id:"express-appreciation",label:"Express Appreciation",description:"Notice what you value and name it aloud.",prompts:["What is something you appreciated about each other today?","What is one small thing your partner did recently that stayed with you?","What is something you admire about the way you are facing this season?"]}
 ];
 var MARRIAGE_WEEKLY_FOCUSES=[
  {id:"be-curious",label:"Be Curious",description:"Make room to listen and learn something new.",promptCategory:"unhurried-conversation"},
  {id:"show-affection",label:"Show Affection",description:"Explore the small ways care and closeness feel meaningful.",promptCategory:"intentional-affection"},
  {id:"notice-the-good",label:"Notice the Good",description:"Notice what you value and name it aloud.",promptCategory:"express-appreciation"},
  {id:"love-intentionally",label:"Love Intentionally",description:"Find a practical way to make this season lighter together.",promptCategory:"express-appreciation"}
 ];
 var marriageSuggestionsOpen=false,marriageLinkTemplateId=null,marriageLinkCandidateId=null,marriageActiveTab="today",marriageFoundationDetailId=null,marriageRhythmDetailId=null,marriageDailySettingsDraft=null,marriageSuggestionsTrigger="rhythm-list",marriageSuggestionReturnFocusId=null;
 var baseEnsureShape=window.ensureShape;
 window.ensureShape=function(state){
  var shaped=baseEnsureShape(state);
  if(!Array.isArray(shaped.areaRhythms))shaped.areaRhythms=[];
  if(!shaped.marriageRhythmTemplateLinks||typeof shaped.marriageRhythmTemplateLinks!=="object"||Array.isArray(shaped.marriageRhythmTemplateLinks))shaped.marriageRhythmTemplateLinks={};
  if(!shaped.settings||typeof shaped.settings!=="object"||Array.isArray(shaped.settings))shaped.settings={};
  var legacyLinks={"marriage.counseling-check-in":"marriage.marriage-enrichment"};
  Object.keys(legacyLinks).forEach(function(oldId){
   var nextId=legacyLinks[oldId],oldRhythmId=shaped.marriageRhythmTemplateLinks[oldId];
   if(oldRhythmId&&!shaped.marriageRhythmTemplateLinks[nextId])shaped.marriageRhythmTemplateLinks[nextId]=oldRhythmId;
   if(oldRhythmId)delete shaped.marriageRhythmTemplateLinks[oldId];
  });
  MARRIAGE_RHYTHM_TEMPLATES.forEach(function(template){
   if(shaped.marriageRhythmTemplateLinks[template.id])return;
   var linked=null;
   (shaped.areaRhythms||[]).some(function(record){if(record.sourceTemplateId===template.id){linked=record.id;return true;}return false;});
   if(!linked)(shaped.people||[]).some(function(person){return(person.rhythms||[]).some(function(record){if(record.sourceTemplateId===template.id){linked=record.id;return true;}return false;});});
   if(linked)shaped.marriageRhythmTemplateLinks[template.id]=linked;
  });
  marriageReconcileHistoricalDateNight(shaped,state===S);
  var fitness=shaped.fitness&&shaped.fitness.rhythms;
  if(Array.isArray(fitness)&&fitness.length){
   fitness.forEach(function(legacy){
    var kind=legacy.fitnessType||legacy.type;
    if(["workout","cardio","weighin"].indexOf(kind)<0)return;
    var existing=shaped.areaRhythms.find(function(item){return item.id===legacy.id;});
    var record=Object.assign({},legacy,existing||{});
    record.fitnessType=kind;
    record.areas=Array.from(new Set((Array.isArray(existing&&existing.areas)?existing.areas:[]).concat(Array.isArray(legacy.areas)?legacy.areas:[],["health"])));
    delete record.type;
    if(!Array.isArray(record.sharedWith))record.sharedWith=[];
    if(existing)Object.assign(existing,record);else shaped.areaRhythms.push(record);
   });
   shaped.fitness.rhythms=fitness.filter(function(legacy){return ["workout","cardio","weighin"].indexOf(legacy.fitnessType||legacy.type)<0;});
  }
  return shaped;
 };
 var hadLegacyFitnessRhythms=!!(S.fitness&&Array.isArray(S.fitness.rhythms)&&S.fitness.rhythms.some(function(record){return ["workout","cardio","weighin"].indexOf(record&& (record.fitnessType||record.type))>=0;}));
 S=window.ensureShape(S);
 if(hadLegacyFitnessRhythms)save();
 var areaRhythmDraft=null,areaRhythmEditId=null;
 var faithPickerPrevious=null;

 function areaIds(r){var ids=Array.isArray(r.areas)?r.areas.filter(function(id){return CATEGORY_AREA_SET[id];}):[];if((r.category==="faith"||FAITH_SUBCATEGORIES.indexOf(r.faithGroup)>=0)&&ids.indexOf("faith")<0)ids.unshift("faith");return ids;}
 function areaChecks(r,idf){
  return '<fieldset class="rhythm-area-checks"><legend>Show in categories</legend>'+CATEGORY_AREAS.map(function(id){
   var name=CATEGORY_AREA_LABELS[id]||(S.areas[id]&&S.areas[id].name)||id;
   var checked=areaIds(r).indexOf(id)!==-1;
   var label=id==="faith"?(checked&&r.faithGroup?"Faith - "+esc(r.faithGroup):"Faith"):esc(name);
   var option='<div class="rhythm-area-option'+(id==="faith"?" rhythm-faith-option":"")+'"><label><input type="checkbox" data-rfield="'+esc(idf)+'|areas" value="'+id+'"'+(checked?' checked':'')+'><span class="rhythm-area-icon" aria-hidden="true">'+(AREA_ICONS[id]||"")+'</span><span'+(id==="faith"?' data-faith-category-label':'')+'>'+label+'</span></label>';
   if(id==="faith"){
    var selected=FAITH_SUBCATEGORIES.indexOf(r.faithGroup)>=0?r.faithGroup:"Prayer";
    option+='<dialog class="rhythm-faith-flyout" aria-labelledby="faith-picker-title-'+esc(idf).replace(/[^a-z0-9_-]/gi,"-")+'"><h3 id="faith-picker-title-'+esc(idf).replace(/[^a-z0-9_-]/gi,"-")+'">Faith</h3><div class="rhythm-faith-options" role="radiogroup" aria-label="Faith subcategory">'+FAITH_SUBCATEGORIES.map(function(group){return '<label><input type="radio" name="faith-subcategory-'+esc(idf).replace(/[^a-z0-9_-]/gi,"-")+'" data-rhythm-faith-group data-rhythm-faith-owner="'+esc(idf)+'" value="'+esc(group)+'"'+(checked&&group===selected?' checked':'')+'><span>'+esc(group)+'</span></label>';}).join("")+'</div><button type="button" class="btn mini ghost" data-faith-cancel>Cancel</button></dialog>';
   }
   return option+'</div>';
  }).join("")+'</fieldset>';
 }
 function categoryLabel(id,record){if(id==="faith")return "Faith - "+(record&&record.faithGroup||"Prayer");if(id==="health"&&record&&record.healthSubcategory){var labels={strength:"Strength",cardio:"Cardio",weight:"Weight"};return "Health & Fitness · "+(labels[record.healthSubcategory]||record.healthSubcategory);}return CATEGORY_AREA_LABELS[id]||(S.areas[id]&&S.areas[id].name)||id;}
 window.tendRhythmCategoryIds=areaIds;
 function areaBadges(r){
  var ids=areaIds(r);
  if(!ids.length)return "";
  return '<span class="rhythm-area-badges" aria-label="Categories: '+esc(ids.map(function(id){return categoryLabel(id,r);}).join(", "))+'">'+ids.map(function(id){
   var name=categoryLabel(id,r);
   return '<button type="button" class="rhythm-area-badge" data-rhythm-area-badge="'+esc(id)+'" data-category-tooltip="'+esc(name)+'"'+(id==="faith"?' data-rhythm-faith-subcategory="'+esc(r.faithGroup||"Prayer")+'"':'')+(id==="health"&&r.healthSubcategory?' data-rhythm-health-subcategory="'+esc(r.healthSubcategory)+'"':'')+' title="'+esc(name)+'" aria-label="Open '+esc(name)+'">'+(AREA_ICONS[id]||"")+'</button>';
  }).join("")+'</span>';
 }
 window.tendCategoryBadges=areaBadges;
 var baseScheduleHTML=window.personRhythmScheduleHTML;
 window.personRhythmScheduleHTML=function(r,idf){
  if(String(idf).indexOf("faith|")===0)return baseScheduleHTML(r,idf);
  return baseScheduleHTML(r,idf);
 };
 var baseFaithRhythmRow=window.faithRhythmRowHTML;
 window.faithRhythmRowHTML=function(record){
  return baseFaithRhythmRow(record);
 };
 var basePersonRhythmRow=window.rhythmRow;
 window.rhythmRow=function(person,record,options){
  options=Object.assign({},options||{});
  if(arguments.length>2)options.additionalPeopleBadgesHTML=(options.additionalPeopleBadgesHTML||"")+'<button type="button" class="rhythm-person-badge" data-openperson="'+esc(person.id)+'" aria-label="Open '+esc(person.name)+'">'+personAvatar(person,22)+'<span>'+esc(person.name.trim().split(/\s+/)[0])+'</span></button>';
  return basePersonRhythmRow(person,record,options);
 };

 var baseAreaScore=window.areaScore;
 window.areaScore=function(id){
  if(id==="marriage")return marriageOverallScore();
  if(id==="faith"||id==="health"||!CATEGORY_AREA_SET[id])return baseAreaScore(id);
  var rhythms=categoryRhythms(id),rhythmAverage=avg(rhythms.map(function(item){return rhythmScore(item.record);}));
  if(rhythmAverage!==null)return rhythmAverage;
  return rawScore(eventsFor(id));
 };
 var baseAreaHasActivity=typeof window.areaHasActivity==="function"?window.areaHasActivity:(typeof areaHasActivity==="function"?areaHasActivity:null);
 window.areaHasActivity=function(id){
  if(id==="marriage"&&categoryRhythms("marriage").length)return true;
  return baseAreaHasActivity?baseAreaHasActivity(id):false;
 };
 if(typeof areaHasActivity==="function")areaHasActivity=window.areaHasActivity;
 var baseDisplayAreaScore=typeof window.displayAreaScore==="function"?window.displayAreaScore:(typeof displayAreaScore==="function"?displayAreaScore:null);
 window.displayAreaScore=function(id){
  if(id==="marriage")return marriageOverallScore();
  return baseDisplayAreaScore?baseDisplayAreaScore(id):null;
 };
 if(typeof displayAreaScore==="function")displayAreaScore=window.displayAreaScore;
 var baseRhythmScore=typeof window.rhythmScore==="function"?window.rhythmScore:(typeof rhythmScore==="function"?rhythmScore:null);
 function marriageDateObject(value){
  if(value instanceof Date)return new Date(value.getFullYear(),value.getMonth(),value.getDate());
  var text=String(value==null?todayStr():value);
  if(/^\d{4}-\d{2}-\d{2}$/.test(text)){var parts=text.split("-").map(Number);return new Date(parts[0],parts[1]-1,parts[2]);}
  var date=new Date(value);
  return Number.isFinite(date.getTime())?new Date(date.getFullYear(),date.getMonth(),date.getDate()):new Date();
 }
 function marriageDateKey(value){
  var date=marriageDateObject(value);
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
 }
 function marriageDateNumber(value){
  var parts=marriageDateKey(value).split("-").map(Number);
  return Math.floor(Date.UTC(parts[0],parts[1]-1,parts[2])/86400000);
 }
 function marriageWeekStart(value){
  var date=marriageDateObject(value);
  date.setDate(date.getDate()-date.getDay());
  return marriageDateKey(date);
 }
 function marriageNextWeekStart(){
  var date=marriageDateObject(todayStr());
  date.setDate(date.getDate()+(7-date.getDay()));
  return marriageDateKey(date);
 }
 function marriageValidGoal(value){var goal=Number(value);return Number.isInteger(goal)&&goal>=1&&goal<=7?goal:null;}
 function marriageGoalForDate(value){
  var config=S.settings.marriageDailyConnectionGoal||{},active=marriageValidGoal(config.active)||5,pending=marriageValidGoal(config.pending),effective=String(config.effectiveDate||"");
  return pending&&/^\d{4}-\d{2}-\d{2}$/.test(effective)&&marriageDateKey(value)>=effective?pending:active;
 }
 function marriageDailyProgress(record,value){
  var today=marriageDateKey(value),start=marriageWeekStart(today),startNumber=marriageDateNumber(start),todayNumber=marriageDateNumber(today),dayKeys=[];
  (S.events||[]).forEach(function(event){
   if(!event||event.rhythmId!==record.id)return;
   var timestamp=Number(event.ts);
   if(!Number.isFinite(timestamp))return;
   var key=marriageDateKey(new Date(timestamp)),number=marriageDateNumber(key);
   if(number>=startNumber&&number<=todayNumber&&number<startNumber+7&&dayKeys.indexOf(key)<0)dayKeys.push(key);
  });
  dayKeys.sort();
  var goal=marriageGoalForDate(today),count=dayKeys.length;
  return {goal:goal,count:count,credited:Math.min(count,goal),score:Math.round(Math.min(count,goal)*100/goal),dayKeys:dayKeys,weekStart:start,today:today};
 }
 function marriageRhythmScore(record){
  if(record&&record.marriageDailyConnection)return marriageDailyProgress(record,todayStr()).score;
  return baseRhythmScore?baseRhythmScore(record):0;
 }
 window.rhythmScore=marriageRhythmScore;
 if(typeof rhythmScore==="function")rhythmScore=marriageRhythmScore;
 function marriageDateOffset(value,days){
  var date=marriageDateObject(value);date.setDate(date.getDate()+days);return marriageDateKey(date);
 }
 function marriageDateOffsetMonths(value,months){
  var date=marriageDateObject(value),day=date.getDate();
  date.setDate(1);date.setMonth(date.getMonth()+months);
  date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
  return marriageDateKey(date);
 }
 function marriageRhythmWindow(record,value){
  var rule=typeof recNormRule==="function"?recNormRule(record):{freq:record.freq||"weekly",unit:record.unit||"weeks"};
  var frequency=rule.freq,unit=rule.unit||record.unit||"";
  var days=Array.isArray(rule.days)?rule.days:Array.isArray(record.weekdays)?record.weekdays:[];
  if(record.marriageDailyConnection||record.weeklyTarget||frequency==="daily"||frequency==="selectdays"||frequency==="custom"&&(unit==="days"||unit==="weeks"&&(Number(rule.every||record.every)||1)===1&&days.length>1)){frequency="daily";unit="";}
  var start=marriageDateKey(value||todayStr()),range,windowLabel;
  if(frequency==="daily"||frequency==="custom"&&(unit==="days"||unit==="weeks"&&(Number(rule.every||record.every)||1)===1&&days.length>1)){range=30;windowLabel="Last 30 days";}
  else if(frequency==="weekly"||frequency==="custom"&&unit==="weeks"){range=84;windowLabel="Last 12 weeks";}
  else if(frequency==="monthly"||frequency==="custom"&&unit==="months"){start=marriageDateOffsetMonths(start,-6);windowLabel="Last 6 months";}
  else if(frequency==="quarterly"){start=marriageDateOffsetMonths(start,-12);windowLabel="Last 12 months";}
  else if(frequency==="yearly"||frequency==="custom"&&unit==="years"){start=marriageDateOffsetMonths(start,-24);windowLabel="Last 24 months";}
  else{range=84;windowLabel="Last 12 weeks";}
  if(range)start=marriageDateOffset(start,1-range);
  return {start:start,end:marriageDateKey(value||todayStr()),label:windowLabel,rule:rule};
 }
 function marriageRhythmFrequencyWeight(record){
  var rule=typeof recNormRule==="function"?recNormRule(record):{freq:record.freq||"weekly",unit:record.unit||"weeks"},frequency=rule.freq,unit=rule.unit||record.unit||"",days=Array.isArray(rule.days)?rule.days:Array.isArray(record.weekdays)?record.weekdays:[];
  if(record.marriageDailyConnection||record.weeklyTarget||frequency==="daily"||frequency==="weekly"&&days.length>1||frequency==="selectdays"||frequency==="custom"&&(unit==="days"||unit==="weeks"&&(Number(rule.every||record.every)||1)===1&&days.length>1))return 5;
  if(frequency==="quarterly"||frequency==="yearly"||frequency==="custom"&&(unit==="months"&&(Number(rule.every||record.every)||1)>=3||unit==="years"))return 1;
  return 3;
 }
 function marriageDaysBetween(first,last){return marriageDateNumber(last)-marriageDateNumber(first);}
 function marriageOverduePenalty(record,dueDate,today){
  var rule=marriageRhythmWindow(record,today).rule,freq=rule.freq,unit=rule.unit||record.unit||"",every=Math.max(1,Number(rule.every||record.every)||1),elapsed=marriageDaysBetween(dueDate,today),due=marriageDateObject(dueDate),now=marriageDateObject(today),months=(now.getFullYear()-due.getFullYear())*12+now.getMonth()-due.getMonth();
  if(now.getDate()<due.getDate())months--;
  var intervals;
  if(freq==="daily"||freq==="custom"&&unit==="days")intervals=Math.floor(Math.max(0,elapsed)/every);
  else if(freq==="weekly"||freq==="custom"&&unit==="weeks")intervals=Math.floor(Math.max(0,elapsed)/(7*every));
  else if(freq==="quarterly")intervals=Math.floor(Math.max(0,months)/3);
  else if(freq==="monthly"||freq==="custom"&&unit==="months")intervals=Math.floor(Math.max(0,months)/every);
  else if(freq==="yearly"||freq==="custom"&&unit==="years")intervals=Math.floor(Math.max(0,months)/(12*every));
  else intervals=Math.floor(Math.max(0,elapsed)/7);
  return Math.min(30,intervals*10);
 }
 function marriageMomentumOccurrences(expectedDates,completedByDate,rule,today){
  var rows=(expectedDates||[]).map(function(date){return {date:date,status:completedByDate[date]?"completed":"missed"};}),nextDate=null;
  for(var offset=0;offset<=740;offset++){
   var date=marriageDateOffset(today,offset);
   if(typeof recOccursOn==="function"&&recOccursOn(rule,date)){nextDate=date;break;}
  }
  if(nextDate&&!rows.some(function(row){return row.date===nextDate;}))rows.push({date:nextDate,status:"upcoming"});
  return rows.sort(function(a,b){return a.date.localeCompare(b.date);});
 }
 function marriageRhythmActiveFrom(record,rule){
  var dates=[rule&&rule.start,record.start,record.added,record.activeSince].filter(function(date){return /^\d{4}-\d{2}-\d{2}$/.test(String(date||""));}).sort();
  return dates.length?dates[dates.length-1]:null;
 }
 function marriageRhythmPausedOn(record,date){
  var periods=Array.isArray(record.marriagePausePeriods)?record.marriagePausePeriods:[];
  if(periods.some(function(period){return period&&String(period.start||"")<=date&&(!period.end||String(period.end)>=date);}))return true;
  return !!(record.paused&&record.pausedAt&&String(record.pausedAt)<=date);
 }
 function marriageRhythmConsistency(record,value){
  if(!record||record.disabled||record.paused||record.inactive||rhythmEnded(record))return {score:null,consistency:null,completed:0,expected:0,missed:0,overdueAdjustment:0,overdueDate:null,occurrences:[],window:null,eligible:false};
  var today=marriageDateKey(value||todayStr()),window=marriageRhythmWindow(record,today),rule=window.rule,start=window.start,end=window.end,activeFrom=marriageRhythmActiveFrom(record,rule),completedByDate=Object.create(null);
  if(activeFrom&&activeFrom>end)return {score:null,consistency:null,completed:0,expected:0,missed:0,overdueAdjustment:0,overdueDate:null,occurrences:marriageMomentumOccurrences([],Object.create(null),rule,today),window:window,eligible:false};
  var earliest=activeFrom&&activeFrom>start?activeFrom:start,closedEnd=marriageDateOffset(today,-1),lastCompletedDate=null,historicalRule=Object.assign({},rule,{start:null}),events=(S.events||[]).filter(function(event){
   return event&&event.rhythmId===record.id&&Number.isFinite(Number(event.ts));
  });
  events.forEach(function(event){
   var date=marriageDateKey(new Date(Number(event.ts)));
   if(date>today||marriageRhythmPausedOn(record,date))return;
   var occurrenceDate=typeof recOccursOn==="function"&&recOccursOn(historicalRule,date)?date:null;
   if(!occurrenceDate&&activeFrom&&date<activeFrom){
    var followingDate=marriageDateOffset(date,1);
    if(followingDate<=today&&recOccursOn(historicalRule,followingDate))occurrenceDate=followingDate;
   }
   if(occurrenceDate&&occurrenceDate>=start){
    completedByDate[occurrenceDate]=true;
    if(!lastCompletedDate||occurrenceDate>lastCompletedDate)lastCompletedDate=occurrenceDate;
   }
  });
  if(record.marriageDailyConnection||record.weeklyTarget){
   var goal=marriageValidGoal(record.marriageWeeklyTarget||record.weeklyTarget)||marriageGoalForDate(today),expectedTarget=0,completedTarget=0,lastEligibleDay=completedByDate[today]?today:closedEnd,weekStart=marriageDateObject(earliest);
   weekStart.setDate(weekStart.getDate()-weekStart.getDay());
   while(marriageDateKey(weekStart)<=closedEnd){
    var weekKey=marriageDateKey(weekStart),weekEnd=marriageDateObject(weekKey);weekEnd.setDate(weekEnd.getDate()+6);
    var first=marriageDateKey(weekStart)>earliest?marriageDateKey(weekStart):earliest,last=marriageDateKey(weekEnd)<lastEligibleDay?marriageDateKey(weekEnd):lastEligibleDay,eligibleDays=0,done=0;
    for(var day=marriageDateObject(first);marriageDateKey(day)<=last;day.setDate(day.getDate()+1)){
     var dayKey=marriageDateKey(day);
     if(!marriageRhythmPausedOn(record,dayKey)){eligibleDays++;if(completedByDate[dayKey])done++;}
    }
    var weekExpected=goal*eligibleDays/7;
    expectedTarget+=weekExpected;completedTarget+=Math.min(done,weekExpected);
    weekStart.setDate(weekStart.getDate()+7);
   }
   if(!expectedTarget)return {score:null,consistency:null,completed:0,expected:0,missed:0,overdueAdjustment:0,overdueDate:null,occurrences:[],window:window,eligible:false};
   var dailyConsistency=Math.min(100,completedTarget*100/expectedTarget);
   return {score:dailyConsistency,consistency:dailyConsistency,completed:completedTarget,expected:expectedTarget,missed:Math.max(0,expectedTarget-completedTarget),overdueAdjustment:0,overdueDate:null,occurrences:marriageMomentumOccurrences(Object.keys(completedByDate).sort(),completedByDate,rule,today),window:window,eligible:true};
  }
  var expectedDates=[];
  for(var date=marriageDateObject(earliest);marriageDateKey(date)<=closedEnd;date.setDate(date.getDate()+1)){
   var key=marriageDateKey(date);
   if(!marriageRhythmPausedOn(record,key)&&typeof recOccursOn==="function"&&recOccursOn(rule,key))expectedDates.push(key);
  }
  Object.keys(completedByDate).forEach(function(key){
   if(key<earliest&&key<=closedEnd)expectedDates.push(key);
  });
  expectedDates.sort();
  if(completedByDate[today]&&!marriageRhythmPausedOn(record,today)&&typeof recOccursOn==="function"&&recOccursOn(rule,today))expectedDates.push(today);
  var overdueDate=null,overdueAdjustment=0;
  for(var expectedIndex=0;expectedIndex<expectedDates.length;expectedIndex++){
   var expectedDate=expectedDates[expectedIndex];
   if(!completedByDate[expectedDate]&&(!lastCompletedDate||expectedDate>lastCompletedDate)){overdueDate=expectedDate;break;}
  }
  if(overdueDate){
   overdueAdjustment=marriageOverduePenalty(record,overdueDate,today);
  }
  if(!expectedDates.length)return {score:null,consistency:null,completed:0,expected:0,missed:0,overdueAdjustment:0,overdueDate:null,occurrences:marriageMomentumOccurrences([],completedByDate,rule,today),window:window,eligible:false};
  var completedCount=expectedDates.reduce(function(count,key){return count+(completedByDate[key]?1:0);},0),consistency=Math.min(100,completedCount*100/expectedDates.length),score=Math.max(0,consistency-overdueAdjustment),expectedTotal=expectedDates.length;
  return {score:score,consistency:consistency,completed:completedCount,expected:expectedTotal,missed:expectedTotal-completedCount,overdueAdjustment:overdueAdjustment,overdueDate:overdueDate,occurrences:marriageMomentumOccurrences(expectedDates,completedByDate,rule,today),window:window,eligible:true};
 }
 function marriagePrimaryFoundation(record){
  if(!record)return null;
  var selected=record.marriagePrimaryFoundation||record.primaryFoundation;
  if(MARRIAGE_FOUNDATION_BY_ID[selected])return selected;
  var templateId=record.sourceTemplateId,legacy={"marriage.unhurried-conversation":"marriage.daily-connection","marriage.counseling-check-in":"marriage.marriage-enrichment"};
  if(legacy[templateId])templateId=legacy[templateId];
  var template=marriageTemplateById(templateId);
  return template&&MARRIAGE_FOUNDATION_BY_ID[template.primaryFoundation]?template.primaryFoundation:null;
 }
 function marriageSecondaryFoundations(record){
  if(!record)return [];
  var selected=Array.isArray(record.marriageSecondaryFoundations)?record.marriageSecondaryFoundations:null;
  if(selected)return selected.filter(function(id,index){return MARRIAGE_FOUNDATION_BY_ID[id]&&id!==marriagePrimaryFoundation(record)&&selected.indexOf(id)===index;});
  var templateId=record.sourceTemplateId,legacy={"marriage.unhurried-conversation":"marriage.daily-connection","marriage.counseling-check-in":"marriage.marriage-enrichment"};
  if(legacy[templateId])templateId=legacy[templateId];
  var template=marriageTemplateById(templateId);
  return template?(template.secondaryFoundations||[]).slice():[];
 }
 function marriageActiveRhythms(rows){
  return (rows||categoryRhythms("marriage")).filter(function(item){var record=item.record;return record&&!record.marriageDuplicateOf&&!record.disabled&&!record.paused&&!record.inactive&&!record.legacyPrayerSeed&&!rhythmEnded(record);});
 }
 function marriageFoundationScores(rows,value){
  var active=marriageActiveRhythms(rows),foundationValues=MARRIAGE_FOUNDATIONS.map(function(foundation){
   var rhythms=active.filter(function(item){return (marriagePrimaryFoundation(item.record)===foundation.id||marriageSecondaryFoundations(item.record).indexOf(foundation.id)!==-1);}).map(function(item){
    return {item:item,consistency:marriageRhythmConsistency(item.record,value),weight:marriageRhythmFrequencyWeight(item.record)};
   });
   var eligible=rhythms.filter(function(item){return Number.isFinite(item.consistency.score);}),weightTotal=eligible.reduce(function(total,item){return total+item.weight;},0),weighted=weightTotal?eligible.reduce(function(total,item){return total+item.consistency.score*item.weight;},0)/weightTotal:null,score=weighted===null?null:weighted*(eligible.length===1?.9:1);
   return {id:foundation.id,foundation:foundation,score:score,weightedConsistency:weighted,breadthFactor:eligible.length===1?.9:eligible.length?1:null,rhythms:rhythms,eligibleRhythms:eligible};
  });
  var scored=foundationValues.filter(function(item){return Number.isFinite(item.score);}),overall=scored.length?scored.reduce(function(total,item){return total+item.score;},0)/scored.length:null;
  return {foundations:foundationValues,overall:overall,scoredCount:scored.length,totalFoundations:MARRIAGE_FOUNDATIONS.length,activeRhythms:active};
 }
 function marriageOverallScore(){return marriageFoundationScores().overall;}
 function marriageRhythmSummary(rows,value){
  var active=marriageActiveRhythms(rows),seen=Object.create(null),rhythmScores=[],completed=0,expected=0;
  active.forEach(function(item){if(seen[item.record.id])return;seen[item.record.id]=true;var result=marriageRhythmConsistency(item.record,value);if(Number.isFinite(result.score)){rhythmScores.push(result.score);completed+=result.completed;expected+=result.expected;}});
  return {activeCount:Object.keys(seen).length,scoredCount:rhythmScores.length,completed:completed,expected:expected,score:rhythmScores.length?rhythmScores.reduce(function(total,score){return total+score;},0)/rhythmScores.length:null};
 }
 window.tendMarriageRhythmConsistency=marriageRhythmConsistency;
 window.tendMarriageFoundationScores=marriageFoundationScores;
 window.tendMarriageRhythmSummary=marriageRhythmSummary;
 window.tendMarriageFoundations=function(){return MARRIAGE_FOUNDATIONS.map(function(item){return Object.assign({},item,{suggestions:item.suggestions.slice()});});};
 function marriagePersonIsSpouseCandidate(person){
  if(typeof window.tendPersonRelationshipGroup==="function")return window.tendPersonRelationshipGroup(person)==="marriage";
  return /^(spouse|wife|husband|partner)$/i.test(String(person&&person.relation||"").trim());
 }
 function marriageSpouseCandidates(){
  return (S.people||[]).filter(marriagePersonIsSpouseCandidate);
 }
 function marriageSpouseForDailyRhythm(){
  var daily=categoryRhythms("marriage").find(function(item){return item.record.marriageDailyConnection&&item.person;});
  return daily?daily.person:null;
 }
 function marriageSelectedSpouse(){
  var candidates=marriageSpouseCandidates(),dailySpouse=marriageSpouseForDailyRhythm();
  if(dailySpouse&&candidates.indexOf(dailySpouse)!==-1)return dailySpouse;
  var selectedId=String(S.settings.marriageSpouseId||"");
  if(selectedId){var selected=candidates.find(function(person){return person.id===selectedId;});if(selected)return selected;}
  return candidates.length===1?candidates[0]:null;
 }
 function marriageDailyConnectionRhythm(){
  var linkedId=S.marriageRhythmTemplateLinks["marriage.daily-connection"],linked=linkedId&&marriageRhythmById(linkedId);
  if(linked&&linked.record.marriageDailyConnection&&areaIds(linked.record).indexOf("marriage")!==-1)return linked;
  return categoryRhythms("marriage").find(function(item){return item.record.marriageDailyConnection&&areaIds(item.record).indexOf("marriage")!==-1;})||null;
 }
 function marriagePromptCategory(id){
  var legacy={curiosity:"unhurried-conversation",affection:"intentional-affection",appreciation:"express-appreciation","shared-life":"express-appreciation"};
  id=legacy[id]||id;
  return MARRIAGE_PROMPT_CATEGORIES.find(function(category){return category.id===id;})||null;
 }
 function marriageHash(value){
  var text=String(value),hash=2166136261;
  for(var i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return hash>>>0;
 }
 function marriageWeeklyFocus(){
  var focus=S.settings.marriageWeeklyFocus||{};
  return {enabled:focus.enabled===true,startsOn:/^\d{4}-\d{2}-\d{2}$/.test(String(focus.startsOn||""))?String(focus.startsOn):null};
 }
 function marriageFocusForDate(value){
  var focus=marriageWeeklyFocus(),weekStart=marriageWeekStart(value);
  if(!focus.enabled||!focus.startsOn||weekStart<focus.startsOn)return null;
  var weeks=Math.floor((marriageDateNumber(weekStart)-marriageDateNumber(focus.startsOn))/7);
  return MARRIAGE_WEEKLY_FOCUSES[weeks%MARRIAGE_WEEKLY_FOCUSES.length];
 }
 function marriagePromptSelection(value,spouseId){
  var date=marriageDateKey(value),saved=S.settings.marriageDailyConnectionPrompt||{},savedCategory=marriagePromptCategory(saved.categoryId);
  if(saved.date===date&&savedCategory&&Number.isInteger(+saved.promptIndex)&&+saved.promptIndex>=0&&+saved.promptIndex<savedCategory.prompts.length)return {date:date,categoryId:savedCategory.id,promptIndex:+saved.promptIndex};
  var focus=marriageFocusForDate(date),category=focus?marriagePromptCategory(focus.promptCategory):MARRIAGE_PROMPT_CATEGORIES[marriageHash(date+"|"+String(spouseId||""))%MARRIAGE_PROMPT_CATEGORIES.length];
  var index=marriageHash("prompt|"+date+"|"+String(spouseId||""))%category.prompts.length,previousDate=marriageDateObject(date);
  previousDate.setDate(previousDate.getDate()-1);
  if(saved.date===marriageDateKey(previousDate)&&savedCategory&&Number.isInteger(+saved.promptIndex)&&savedCategory.prompts[+saved.promptIndex]===category.prompts[index]&&savedCategory.id===category.id)index=(index+1)%category.prompts.length;
  return {date:date,categoryId:category.id,promptIndex:index};
 }
 window.tendMarriageDailyConnectionProgress=function(value){
  var daily=marriageDailyConnectionRhythm();
  return daily?marriageDailyProgress(daily.record,value||todayStr()):null;
 };
 window.tendMarriageDailyConnectionSelection=function(value,spouseId){
  var selection=marriagePromptSelection(value||todayStr(),spouseId||"");
  return Object.assign({},selection,{category:marriagePromptCategory(selection.categoryId),prompt:marriagePromptCategory(selection.categoryId).prompts[selection.promptIndex]});
 };
 window.tendMarriageWeeklyFocus=function(value){var category=marriageFocusForDate(value||todayStr());return category?category.id:null;};
 window.tendMarriageSelectedSpouse=function(){return marriageSelectedSpouse();};
 function categoryRhythms(id){
  var rows=[];
  S.people.forEach(function(person){
   (person.rhythms||[]).forEach(function(record){
    if(areaIds(record).indexOf(id)!==-1)rows.push({record:record,person:person,owner:"person"});
   });
  });
  (S.areaRhythms||[]).forEach(function(record){
   if(areaIds(record).indexOf(id)!==-1)rows.push({record:record,person:null,owner:"area"});
  });
  return rows;
 }
 function marriageTemplateById(templateId){return MARRIAGE_RHYTHM_TEMPLATES.find(function(template){return template.id===templateId;})||null;}
 function marriageRhythmById(rhythmId){
  var found=null;
  (S.areaRhythms||[]).some(function(record){if(record.id===rhythmId){found={record:record,person:null,owner:"area"};return true;}return false;});
  if(found)return found;
  (S.people||[]).some(function(person){return(person.rhythms||[]).some(function(record){if(record.id===rhythmId){found={record:record,person:person,owner:"person"};return true;}return false;});});
  return found;
 }
 function marriageTemplateStatus(templateId){
  var template=marriageTemplateById(templateId);
  if(!template)return null;
  var rhythmId=S.marriageRhythmTemplateLinks[templateId];
  if(!rhythmId)return {status:"available",template:template,record:null,owner:null,inMarriage:false};
  var linked=marriageRhythmById(rhythmId);
  if(!linked)return {status:"deleted",template:template,record:null,owner:null,inMarriage:false,rhythmId:rhythmId};
  var inactive=!!(linked.record.disabled||linked.record.paused||rhythmEnded(linked.record));
  return {status:inactive?"inactive":"linked",template:template,record:linked.record,owner:linked.person,rhythmOwner:linked.owner,inMarriage:areaIds(linked.record).indexOf("marriage")!==-1,rhythmId:rhythmId};
 }
 function marriageTemplateDraft(templateId){
  var template=marriageTemplateById(templateId);
  var status=template&&marriageTemplateStatus(templateId).status;
  if(!template||(status!=="available"&&status!=="deleted"))return null;
  var spouse=marriageSelectedSpouse(),dailyConnection=template.id==="marriage.daily-connection";
  return {id:"draft",text:template.title,description:template.description,sourceTemplateId:template.id,marriageDailyConnection:dailyConnection,marriageWeeklyTarget:template.weeklyTarget||null,marriagePrimaryFoundation:template.primaryFoundation,marriageSecondaryFoundations:(template.secondaryFoundations||[]).slice(),areas:["marriage"],freq:template.freq,every:template.every||1,unit:template.unit||"weeks",tod:template.tod,weekdays:[],monthlyMode:"onDay",dayOfMonth:null,month:null,monthDay:null,qmonth:null,added:null,start:dailyConnection?todayStr():null,personId:spouse?spouse.id:"",sharedWith:[]};
 }
 function marriageApplyTemplateFoundations(record,template){
  if(!record||!template)return;
  if(!MARRIAGE_FOUNDATION_BY_ID[record.marriagePrimaryFoundation])record.marriagePrimaryFoundation=template.primaryFoundation;
  if(!Array.isArray(record.marriageSecondaryFoundations))record.marriageSecondaryFoundations=(template.secondaryFoundations||[]).slice();
 }
 function marriageReconcileHistoricalDateNight(state,persist){
  state=state||S;
  var template=marriageTemplateById("marriage.date-night"),links=state.marriageRhythmTemplateLinks||{},linkedId=template&&links[template.id],linked=null;
  (state.areaRhythms||[]).some(function(record){if(record.id===linkedId){linked={record:record,person:null};return true;}return false;});
  if(!linked)(state.people||[]).some(function(person){return(person.rhythms||[]).some(function(record){if(record.id===linkedId){linked={record:record,person:person};return true;}return false;});});
  if(!linked||!linked.person||!marriagePersonIsSpouseCandidate(linked.person)||String(linked.record.text||"").trim().toLowerCase()!=="date night"||!linked.record.sourceTemplateId)return false;
  var linkedEvents=(state.events||[]).filter(function(event){return event&&event.rhythmId===linked.record.id;});
  if(linkedEvents.length)return false;
  var candidates=[];
  (linked.person.rhythms||[]).forEach(function(record){
   if(record.id===linked.record.id||record.marriageDuplicateOf||record.sourceTemplateId||String(record.text||"").trim().toLowerCase()!=="date night"||!Array.isArray(record.areas)||record.areas.indexOf("marriage")===-1)return;
   if((state.events||[]).some(function(event){return event&&event.rhythmId===record.id;}))candidates.push(record);
  });
  if(candidates.length!==1)return false;
  var original=candidates[0],originalFields={sourceTemplateId:original.sourceTemplateId,marriagePrimaryFoundation:original.marriagePrimaryFoundation,marriageSecondaryFoundations:original.marriageSecondaryFoundations,areas:original.areas},duplicateFields={sourceTemplateId:linked.record.sourceTemplateId,marriageDuplicateOf:linked.record.marriageDuplicateOf},previousLink=linkedId;
  marriageApplyTemplateFoundations(original,template);
  original.sourceTemplateId=template.id;
  if(areaIds(original).indexOf("marriage")===-1)original.areas=(Array.isArray(original.areas)?original.areas:[]).concat("marriage");
  delete linked.record.sourceTemplateId;
  linked.record.marriageDuplicateOf=original.id;
  links[template.id]=original.id;
  var cloudReady=!window.TEND_CLOUD_MODE||(window.TendCloudPersistence&&window.TendCloudPersistence.isReady());
  if(!persist||!cloudReady){state.__tendMarriageDateNightLinkPending=true;return true;}
  try{save();}
  catch(error){
   Object.keys(originalFields).forEach(function(key){if(originalFields[key]===undefined)delete original[key];else original[key]=originalFields[key];});
   Object.keys(duplicateFields).forEach(function(key){if(duplicateFields[key]===undefined)delete linked.record[key];else linked.record[key]=duplicateFields[key];});
   links[template.id]=previousLink;
   if(typeof flash==="function")flash("Date Night could not be linked; its history is unchanged.");
   return false;
  }
  return true;
 }
 window.addEventListener("tend-cloud-status",function(event){
  if(!S||!S.__tendMarriageDateNightLinkPending||!window.TendCloudPersistence||!window.TendCloudPersistence.isReady())return;
  Promise.resolve().then(function(){
   if(!S||!S.__tendMarriageDateNightLinkPending||!window.TendCloudPersistence||!window.TendCloudPersistence.isReady())return;
   var status=window.TendCloudPersistence.getStatus?window.TendCloudPersistence.getStatus():event&&event.detail&&event.detail.status;
   delete S.__tendMarriageDateNightLinkPending;
   if(status!=="Needs attention")save();
  });
 },true);
 function marriageLinkExistingRhythm(templateId,rhythmId,showInMarriage){
  var template=marriageTemplateById(templateId),linked=marriageRhythmById(rhythmId);
  if(!template||template.id==="marriage.daily-connection"||!linked||linked.record.fitnessType||linked.record.type==="workout"||linked.record.type==="cardio"||linked.record.type==="weighin")return false;
  if(linked.person&&(!marriageSelectedSpouse()||linked.person.id!==marriageSelectedSpouse().id))return false;
  var currentStatus=marriageTemplateStatus(templateId);
  if(currentStatus&&currentStatus.record)return false;
  var otherTemplate=MARRIAGE_RHYTHM_TEMPLATES.find(function(item){return item.id!==templateId&&S.marriageRhythmTemplateLinks[item.id]===rhythmId;});
  if(otherTemplate||(linked.record.sourceTemplateId&&linked.record.sourceTemplateId!==templateId))return false;
  marriageApplyTemplateFoundations(linked.record,template);
  linked.record.sourceTemplateId=templateId;
  if(showInMarriage&&areaIds(linked.record).indexOf("marriage")===-1){var areas=Array.isArray(linked.record.areas)?linked.record.areas.slice():[];if(areas.indexOf("marriage")===-1)areas.push("marriage");linked.record.areas=areas;}
  S.marriageRhythmTemplateLinks[templateId]=rhythmId;
  save();
  return true;
 }
 function marriageIncludeExistingRhythm(templateId){
  var template=marriageTemplateById(templateId),status=template&&marriageTemplateStatus(templateId),linked=status&&status.record&&marriageRhythmById(status.record.id);
  if(!template||!linked||status.status==="inactive")return false;
  if(linked.person&&(!marriageSelectedSpouse()||linked.person.id!==marriageSelectedSpouse().id))return false;
  marriageApplyTemplateFoundations(linked.record,template);
  if(areaIds(linked.record).indexOf("marriage")===-1){
   var areas=Array.isArray(linked.record.areas)?linked.record.areas.slice():[];
   if(areas.indexOf("marriage")===-1)areas.push("marriage");
   linked.record.areas=areas;
  }
  save();
  return true;
 }
 function marriageUnlinkTemplate(templateId){
  if(!marriageTemplateById(templateId)||!S.marriageRhythmTemplateLinks[templateId])return false;
  var rhythm=marriageRhythmById(S.marriageRhythmTemplateLinks[templateId]);
  if(rhythm&&rhythm.record.sourceTemplateId===templateId)delete rhythm.record.sourceTemplateId;
  delete S.marriageRhythmTemplateLinks[templateId];
  save();
  return true;
 }
 window.tendMarriageSuggestionCatalog=function(){return MARRIAGE_RHYTHM_TEMPLATES.map(function(template){return Object.assign({},template);});};
 window.tendMarriageTemplateStatus=marriageTemplateStatus;
 window.tendMarriageTemplateDraft=marriageTemplateDraft;
 window.tendMarriageLinkExistingRhythm=marriageLinkExistingRhythm;
 window.tendMarriageUnlinkTemplate=marriageUnlinkTemplate;
 function marriageLinkCandidates(){
  var candidates=[],used={};
  var spouse=marriageSelectedSpouse();
  function add(record,person){
   if(!record||!record.id||record.fitnessType||["workout","cardio","weighin"].indexOf(record.type)!==-1||record.sourceTemplateId||used[record.id]||person&&(!spouse||person.id!==spouse.id))return;
   if(Object.keys(S.marriageRhythmTemplateLinks).some(function(id){return S.marriageRhythmTemplateLinks[id]===record.id;}))return;
   used[record.id]=true;candidates.push({record:record,person:person||null});
  }
  if(spouse)(spouse.rhythms||[]).forEach(function(record){add(record,spouse);});
  return candidates.sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));});
 }
 function marriageRhythmAssociationSummary(record){
  var labels=areaIds(record).map(function(id){return categoryLabel(id,record);});
  var details=record.marriageDailyConnection?marriageGoalForDate(todayStr())+"x weekly · Flexible":typeof window.rhythmFreqLabel==="function"?window.rhythmFreqLabel(record):record.freq||"Frequency not set";
  return [details,record.tod&&record.tod!=="anytime"&&TODS&&TODS[record.tod]?TODS[record.tod]:null,labels.length?labels.join(", "):"No category"].filter(Boolean).join(" · ");
 }
 function marriageCandidateMatchScore(template,record){
  if(!template||!record)return 0;
  var ignored={marriage:true,rhythm:true,together:true,our:true,we:true,daily:true,weekly:true,every:true,the:true,with:true,and:true,for:true,to:true,in:true};
  var title=String(template.title||"").toLowerCase().match(/[a-z0-9]+/g)||[],recordTitle=String(record.text||"").toLowerCase().match(/[a-z0-9]+/g)||[];
  return title.filter(function(word){return !ignored[word]&&recordTitle.indexOf(word)!==-1;}).length;
 }
 function marriageSuggestionsDialog(){
  if(!marriageSuggestionsOpen||currentArea!=="marriage")return "";
  var candidates=marriageLinkCandidates(),candidate=marriageLinkCandidateId&&candidates.find(function(item){return item.record.id===marriageLinkCandidateId;}),candidateTemplate=marriageLinkTemplateId&&marriageTemplateById(marriageLinkTemplateId),out='<dialog class="profile-editor-dialog marriage-rhythm-suggestions-dialog" data-editor-modal aria-labelledby="marriage-rhythm-suggestions-title"><div class="profile-editor-body"><header class="marriage-suggestions-header"><div><h2 id="marriage-rhythm-suggestions-title" tabindex="-1">Marriage rhythm suggestions</h2><p>Use an existing rhythm, or create a separate rhythm with your own timing and details.</p></div><button type="button" class="iconbtn" data-marriage-suggestions-close data-editor-cancel aria-label="Close suggestions">×</button></header><div class="marriage-suggestion-list">';
  if(candidateTemplate)candidates.sort(function(a,b){var difference=marriageCandidateMatchScore(candidateTemplate,b.record)-marriageCandidateMatchScore(candidateTemplate,a.record);return difference||String(a.record.text||"").localeCompare(String(b.record.text||""));});
  MARRIAGE_RHYTHM_TEMPLATES.forEach(function(template){
   var info=marriageTemplateStatus(template.id),statusLabel=info.status==="linked"?"Linked":info.status==="inactive"?"Inactive":info.status==="deleted"?"Previously linked rhythm deleted":"Available";
   if(info.record){
    statusLabel=info.status==="inactive"?"Inactive":"Linked";
    if(!info.inMarriage)statusLabel+=" · not shown in Marriage";
   }
   out+='<section class="marriage-suggestion-row"><div class="marriage-suggestion-copy"><h3>'+marriageIconHTML("rhythms",template.iconId)+esc(template.title)+'</h3><p>'+esc(template.description)+'</p><div class="marriage-suggestion-meta">'+esc(marriageTemplateFrequencyLabel(template))+' · <span>'+esc(statusLabel)+'</span></div>'+marriageTemplateAssociationHTML(template);
   if(info.record)out+='<p class="marriage-suggestion-linked">Using “'+esc(info.record.text||"Untitled rhythm")+'” · '+esc(marriageRhythmAssociationSummary(info.record))+'</p>';
   if(info.status==="deleted")out+='<p class="marriage-suggestion-linked">The linked rhythm is no longer present; its history was not changed.</p>';
   out+='</div><div class="marriage-suggestion-actions">';
   if(info.status==="available")out+='<button type="button" class="btn mini" data-marriage-suggestion-add="'+esc(template.id)+'" aria-label="Create a new '+esc(template.title)+' rhythm">＋ Create a new '+esc(template.title)+' rhythm</button>'+(template.id==="marriage.daily-connection"?'':'<button type="button" class="btn mini ghost" data-marriage-link-select="'+esc(template.id)+'" aria-label="Use an existing rhythm for '+esc(template.title)+'">Use an existing rhythm</button>');
   else if(info.status==="deleted")out+='<button type="button" class="btn mini" data-marriage-suggestion-add="'+esc(template.id)+'" aria-label="Create a replacement for '+esc(template.title)+'">＋ Create a new '+esc(template.title)+' rhythm</button>'+(template.id==="marriage.daily-connection"?'':'<button type="button" class="btn mini ghost" data-marriage-link-select="'+esc(template.id)+'" aria-label="Use another existing rhythm for '+esc(template.title)+'">Use another existing rhythm</button>')+'<button type="button" class="btn mini ghost" data-marriage-template-unlink="'+esc(template.id)+'">Clear deleted link</button>';
   else out+='<button type="button" class="btn mini ghost" data-marriage-template-unlink="'+esc(template.id)+'">Unlink suggestion</button>';
   out+='</div>';
   if(marriageLinkTemplateId===template.id&&candidateTemplate){
    var selectedSpouse=marriageSelectedSpouse();
    out+='<div class="marriage-link-panel"><div class="marriage-link-panel-heading"><h4 tabindex="-1" id="marriage-link-panel-title">'+(selectedSpouse?"Choose one of "+esc(selectedSpouse.name||"your spouse")+"’s rhythms":"Choose a spouse first")+'</h4><button type="button" class="btn mini ghost" data-marriage-link-back="'+esc(template.id)+'">Back to suggestions</button></div>';
    if(!selectedSpouse)out+='<p>Select a spouse in the Marriage card to find matching rhythms.</p>';
    else if(!candidates.length)out+='<p>No unlinked rhythms are available to link.</p>';
    else out+='<ul>'+candidates.map(function(item){var likely=marriageCandidateMatchScore(template,item.record)>0;return '<li><span><strong>'+esc(item.record.text||"Untitled rhythm")+'</strong><small>'+(likely?'<span class="marriage-likely-match">Likely match · </span>':"")+esc(marriageRhythmAssociationSummary(item.record))+'</small></span><button type="button" class="btn mini ghost" data-marriage-link-candidate="'+esc(template.id)+'|'+esc(item.record.id)+'"'+(marriageLinkCandidateId===item.record.id?' aria-pressed="true"':'')+'>'+(marriageLinkCandidateId===item.record.id?"Selected":"Select")+'</button></li>';}).join("")+'</ul>';
    if(candidate&&candidateTemplate&&marriageLinkTemplateId===candidateTemplate.id){
     var candidateAreas=areaIds(candidate.record).map(function(id){return categoryLabel(id,candidate.record);});
     out+='<div class="marriage-link-review"><strong>Review before using</strong><p>'+esc(candidate.record.text||"Untitled rhythm")+' will keep its title, schedule, person and history. Current categories: '+esc(candidateAreas.join(", ")||"none")+'.</p><label><input type="checkbox" data-marriage-link-show checked> Also show it in Marriage'+(candidateAreas.indexOf("Marriage")===-1?' (adds the Marriage category)':'')+'</label><button type="button" class="btn mini" data-marriage-link-confirm="'+esc(candidateTemplate.id)+'|'+esc(candidate.record.id)+'">Use this rhythm</button></div>';
    }
    out+='</div>';
   }
   out+='</section>';
  });
  return out+'</div></div></dialog>';
 }
 function categoryRhythmOrderId(item){
  return item.owner==="person"?"person:"+item.person.id+":"+item.record.id:item.record.fitnessType?"fitness:"+item.record.id:"area:"+item.record.id;
 }
 function categoryRhythmDue(item){return !rhythmEnded(item.record)&&todayRhythmEligible(item.record);}
 function categoryRhythmRow(item,id,cardOptions){
  var record=item.record;
  cardOptions=cardOptions||{};
  if(record.fitnessType&&typeof fitnessSharedRhythmCardHTML==="function")return fitnessSharedRhythmCardHTML(record,{categoryId:id});
  if(item.person){
   return window.rhythmRow(item.person,record,Object.assign({tendAttributes:{"data-rhythm-area":id}},cardOptions));
  }
  if(areaRhythmEditId===record.id){var editRecord=areaRhythmDraft&&areaRhythmDraft.areaId===id&&areaRhythmDraft.record.id===record.id?areaRhythmDraft.record:record;return categoryRhythmFormHTML(id,editRecord,record.id);}
  var score=rhythmScore(record),metadata=window.tendRhythmCardMetadata(record);
  var cardScore=Object.prototype.hasOwnProperty.call(cardOptions,"score")?cardOptions.score:Number.isFinite(score)?score:null;
  return tendRhythmCardHTML(record,Object.assign({title:record.text||"(unnamed rhythm)",description:record.description,score:cardScore,scoreClass:scoreClass(cardScore),categoryBadgesHTML:areaBadges(record),
   frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
   tendAttributes:{"data-tend-open":"area-rhythm","data-area-id":id,"data-rhythm-id":record.id},
   editAttributes:{"data-area-rhythm-edit":id+"|"+record.id},
   historyAttributes:{"data-rhyhistory":"area-rhythm|"+id+"|"+record.id},
   removeAttributes:{"data-area-rhythm-delete":id+"|"+record.id},removeLabel:"Delete "+(record.text||"rhythm"),removeTitle:"Delete rhythm"
  },cardOptions));
 }
 window.faithLinkedRhythmCount=function(group){return categoryRhythms("faith").filter(function(item){return (item.record.faithGroup||"Prayer")===group&&!item.record.disabled&&!rhythmEnded(item.record);}).length;};
 window.faithLinkedRhythmItems=function(group){return categoryRhythms("faith").filter(function(item){return (item.record.faithGroup||"Prayer")===group&&!item.record.disabled&&!rhythmEnded(item.record);}).map(function(item){return {item:item,id:categoryRhythmOrderId(item)};});};
 window.faithLinkedRhythmHTML=function(item){return categoryRhythmRow(item,"faith");};
 window.faithLinkedRhythmRows=function(group){return window.faithLinkedRhythmItems(group).sort(function(a,b){return String(a.item.record.text||"").localeCompare(String(b.item.record.text||""));}).map(function(entry){return categoryRhythmRow(entry.item,"faith");}).join("");};
 function categoryRhythmFormHTML(id,record,rid,forMe){
  var idf="area-"+id+"|"+rid,sourceTemplate=record.sourceTemplateId&&rid==="draft"?marriageTemplateById(record.sourceTemplateId):null,suggestionEditor=!!sourceTemplate,marriageEditor=id==="marriage"&&currentArea==="marriage";
  var templateStart=record.sourceTemplateId&&rid==="draft"?'<label class="careplan-field marriage-template-start">Start date<input type="date" data-rfield="'+esc(idf)+'|start" value="'+esc(record.start||"")+'" required></label>':'';
  var editableCategories=!marriageEditor&&(forMe||!!(record.sourceTemplateId&&rid==="draft"));
  var title=suggestionEditor?"Create Rhythm":rid==="draft"?"Add Rhythm":"Edit Rhythm";
  var heading=marriageEditor?'<header class="marriage-rhythm-editor-heading"><h3 id="area-rhythm-editor-title">'+title+'</h3><button type="button" class="iconbtn" data-area-rhythm-cancel="1" data-editor-cancel aria-label="Close Rhythm editor">×</button></header>':suggestionEditor?'<header class="marriage-rhythm-editor-heading"><h3 id="area-rhythm-editor-title">'+title+'</h3><button type="button" class="iconbtn" data-area-rhythm-cancel="1" data-editor-cancel aria-label="Close Rhythm editor">×</button></header>':'<h3 id="area-rhythm-editor-title">'+title+'</h3>';
  return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="area-rhythm-editor-title"><div class="profile-editor-body rhyedit area-rhythm-edit" data-area-rhythm-form="'+esc(id)+'|'+esc(rid)+'">'+heading+(suggestionEditor?'<p class="marriage-rhythm-editor-note">Create a separate rhythm with your own timing and details.</p>':'')+'<label class="careplan-field">Rhythm<input data-crf="text" value="'+esc(record.text||"")+'" placeholder="What is the rhythm?"></label><label class="careplan-field rhythm-description-field">Description (optional)<textarea data-crf="description" placeholder="Add context or details">'+esc(record.description||"")+'</textarea></label>'+(editableCategories?areaChecks(record,idf)+'<p class="me-rhythm-category-note">'+(forMe?"Choose at least one category for this rhythm.":"Choose where this rhythm appears.")+'</p>':'')+window.personRhythmScheduleHTML(record,idf)+templateStart+'<label class="careplan-field">Person (optional)<select data-crf="personId"><option value="">No person</option>'+S.people.map(function(person){return '<option value="'+esc(person.id)+'"'+(record.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join("")+'</select></label><label class="me-personal-toggle"><input type="checkbox" data-crf="personal"'+(record.personal?' checked':'')+'> <span>Personal rhythm</span></label><div class="profile-editor-actions"><button type="button" class="btn mini" data-area-rhythm-save="'+esc(id)+'|'+esc(rid)+'">Save Rhythm</button><button type="button" class="btn mini ghost" data-area-rhythm-cancel="1" data-editor-cancel>'+(marriageEditor?"Back to Rhythms":suggestionEditor?"Back to suggestions":"Cancel")+'</button>'+(rid==="draft"?"":'<button type="button" class="btn mini danger" data-area-rhythm-delete="'+esc(id)+'|'+esc(rid)+'">Delete Rhythm</button>')+'</div></div></dialog>';
 }
 window.tendMeRhythmEditorHTML=function(){
  if(!areaRhythmDraft)return "";
  return categoryRhythmFormHTML(areaRhythmDraft.areaId,areaRhythmDraft.record,areaRhythmDraft.record.id==="draft"?"draft":areaRhythmDraft.record.id,areaRhythmDraft.areaId==="me");
 };
 window.tendStartMeRhythmEditor=function(){
  areaRhythmDraft={areaId:"me",record:{id:"draft",text:"",description:"",areas:[],personal:true,freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks",added:todayStr(),sharedWith:[]}};
  areaRhythmEditId=null;
 };
 function newAreaRhythm(id){
  return {id:"draft",text:"",description:"",areas:[id],faithGroup:id==="faith"?"Prayer":null,freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks",added:todayStr()};
 }
 function categoryRhythmFormForArea(id){
  if(areaRhythmDraft&&areaRhythmDraft.areaId===id)return categoryRhythmFormHTML(id,areaRhythmDraft.record,"draft");
  var record=newAreaRhythm(id);
  return categoryRhythmFormHTML(id,record,"draft");
 }
 function marriageIconHTML(group,id){
  var key=String(id||"").replace(/^marriage\./,""),valid=group==="foundations"?!!MARRIAGE_FOUNDATION_BY_ID[key]:MARRIAGE_RHYTHM_TEMPLATES.some(function(template){return template.iconId===key;});
  if(!valid)return "";
  var path="assets/tend-marriage-icons/"+(group==="foundations"?"foundations":"rhythms")+"/"+key+".svg?v=0.11.7";
  return '<span class="marriage-icon-disc marriage-icon-disc--'+group+'" aria-hidden="true"><span class="marriage-icon" style="--marriage-icon-mask:url(&quot;'+esc(path)+'&quot;)"></span></span>';
 }
 function marriageTemplateFrequencyLabel(template){
  var frequency=template.weeklyTarget?template.weeklyTarget+"x weekly · Flexible":typeof window.rhythmFreqLabel==="function"?window.rhythmFreqLabel(template):template.freq||"Frequency not set";
  var time=template.tod&&template.tod!=="anytime"&&TODS&&TODS[template.tod]?TODS[template.tod]:"Flexible";
  return frequency+" · "+time;
 }
 function marriageFoundationName(id){return MARRIAGE_FOUNDATION_BY_ID[id]?MARRIAGE_FOUNDATION_BY_ID[id].name:"Unassigned";}
 function marriageFoundationAssignmentHTML(record){
  var primary=marriagePrimaryFoundation(record)||"",secondary=marriageSecondaryFoundations(record);
  return '<details class="marriage-rhythm-foundation-editor"><summary>Foundation associations</summary><label>Primary Foundation<select data-marriage-rhythm-primary="'+esc(record.id)+'" aria-label="Primary Foundation for '+esc(record.text||"Rhythm")+'"><option value="">Not assigned</option>'+MARRIAGE_FOUNDATIONS.map(function(item){return '<option value="'+item.id+'"'+(primary===item.id?" selected":"")+'>'+esc(item.name)+'</option>';}).join("")+'</select></label><fieldset><legend>Secondary support</legend>'+MARRIAGE_FOUNDATIONS.filter(function(item){return item.id!==primary;}).map(function(item){return '<label><input type="checkbox" data-marriage-rhythm-secondary="'+esc(record.id)+'" value="'+item.id+'"'+(secondary.indexOf(item.id)!==-1?" checked":"")+'> '+esc(item.name)+'</label>';}).join("")+'</fieldset><small>Primary and secondary Foundations both contribute to their scores.</small></details>';
 }
 function marriageHealthSummaryHTML(rows){
  var scores=marriageFoundationScores(rows),score=scores.overall,summary=marriageRhythmSummary(rows),spouse=marriageSelectedSpouse(),status=score===null?"No scored foundations yet":scores.scoredCount<scores.totalFoundations?"Provisional · "+scores.scoredCount+" of "+scores.totalFoundations+" foundations scored":scoreLabel(score);
  function summaryItem(key,label,value,detail,aria){
   return {label:label,score:Number.isFinite(value)?value:null,actionAttributes:{"data-marriage-health-nav":key},ariaLabel:aria,detailHTML:'<span>'+esc(detail)+'</span>'};
  }
  var breakdown=tendScoreBreakdownHTML([
   summaryItem("rhythms","Rhythms",summary.score,summary.scoredCount+" scored of "+summary.activeCount+" active · "+(Number.isFinite(summary.score)?Math.round(summary.score)+"% momentum":"not scored"),summary.scoredCount+" scored of "+summary.activeCount+" active Marriage rhythms, "+(Number.isFinite(summary.score)?Math.round(summary.score)+"% average momentum":"no eligible occurrences")),
   summaryItem("foundations","Foundations",score,scores.scoredCount+" of "+scores.totalFoundations+" scored",scores.scoredCount+" of "+scores.totalFoundations+" Marriage foundations scored")
  ],{columns:2,label:"Marriage health summaries"});
  var spouseShortcut=spouse?'<button type="button" class="marriage-spouse-shortcut" data-openperson="'+esc(spouse.id)+'" aria-label="'+esc("View "+(spouse.name||"Spouse")+"'s profile")+'">'+personAvatar(spouse,30)+'<span>'+esc(spouse.name||"Spouse")+'</span><span class="marriage-spouse-shortcut-chevron" aria-hidden="true">›</span></button>':"";
  var header=tendSectionHeaderHTML({title:"Marriage",subtitle:"Structure beats good intentions.",className:"category-page-heading marriage-page-heading",tagName:"header",trailingHTML:spouseShortcut});
  var scoreDefinitions='<details class="marriage-score-definitions"><summary>How Marriage scores work</summary><dl><div><dt>Rhythm Score</dt><dd>How consistently am I maintaining this commitment, accounting for how overdue I am and how I have followed through?</dd></div><div><dt>Foundation Score</dt><dd>A frequency-weighted score for the active Rhythms associated with this Foundation, including primary and secondary associations. One scored Rhythm applies a 0.90 breadth factor.</dd></div><div><dt>Marriage Health</dt><dd>The average of the scored Foundation scores. Foundations without eligible Rhythm data remain unscored and are excluded from the average.</dd></div></dl></details>';
  return header+tendCategoryHealthSummaryHTML({title:"Overall Marriage health",titleId:"marriage-health-heading",score:score,status:status,breakdownHTML:breakdown})+scoreDefinitions;
 }
 function marriageDateLabel(value){var parts=marriageDateKey(value).split("-").map(Number);return new Date(parts[0],parts[1]-1,parts[2]).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});}
 function marriageGoalSelection(){
  var config=S.settings.marriageDailyConnectionGoal||{},pending=marriageValidGoal(config.pending),effective=String(config.effectiveDate||"");
  if(pending&&/^\d{4}-\d{2}-\d{2}$/.test(effective)&&effective>marriageDateKey(todayStr()))return pending;
  return marriageGoalForDate(todayStr());
 }
 function marriageDailySettingsHTML(){
  if(!marriageDailySettingsDraft)return "";
  var draft=marriageDailySettingsDraft,focus=marriageWeeklyFocus();
  return '<dialog class="profile-editor-dialog marriage-daily-settings-dialog" data-editor-modal aria-labelledby="marriage-daily-settings-title"><div class="profile-editor-body"><h3 id="marriage-daily-settings-title" tabindex="-1">Daily Connection settings</h3><label class="careplan-field">Weekly goal<select data-marriage-daily-goal>'+Array.from({length:7},function(_,index){var days=index+1;return '<option value="'+days+'"'+(draft.goal===days?' selected':'')+'>'+days+' day'+(days===1?'':'s')+' a week</option>';}).join("")+'</select></label><p class="marriage-daily-settings-note">A changed goal starts '+esc(marriageDateLabel(marriageNextWeekStart()))+'.</p><label class="marriage-focus-toggle"><input type="checkbox" data-marriage-weekly-focus'+(draft.focus?' checked':'')+'> <span><strong>Weekly focus</strong><small>A prompt category rotates each week. It does not add tasks or affect scores.</small></span></label>'+(focus.enabled&&focus.startsOn?'<p class="marriage-daily-settings-note">This focus cycle began '+esc(marriageDateLabel(focus.startsOn))+'.</p>':'')+'<div class="profile-editor-actions"><button type="button" class="btn mini" data-marriage-daily-settings-save>Save</button><button type="button" class="btn mini ghost" data-marriage-daily-settings-cancel data-editor-cancel>Cancel</button></div></div></dialog>';
 }
 function marriageDailyConnectionHTML(spouse){
  var daily=marriageDailyConnectionRhythm();
  if(!daily)return "";
  var record=daily.record,owner=daily.person||spouse,progress=marriageDailyProgress(record,todayStr()),selection=marriagePromptSelection(todayStr(),spouse&&spouse.id),category=marriagePromptCategory(selection.categoryId),focus=marriageFocusForDate(todayStr()),todayComplete=progress.dayKeys.indexOf(progress.today)!==-1;
  var dayLabels=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],weekDays=dayLabels.map(function(label,index){var date=new Date(marriageDateObject(progress.weekStart));date.setDate(date.getDate()+index);var key=marriageDateKey(date),done=progress.dayKeys.indexOf(key)!==-1;return '<span class="marriage-weekday'+(done?' is-complete':key===progress.today?' is-today':'')+'" aria-label="'+["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][index]+(done?', completed':key===progress.today?', today':', not completed')+'"><span aria-hidden="true">'+label+'</span></span>';}).join("");
  var tend=owner?(daily.person?'<button type="button" class="btn mini" data-tend-open="person-rhythm" data-person-id="'+esc(owner.id)+'" data-rhythm-id="'+esc(record.id)+'" data-rhythm-area="marriage"'+(todayComplete?' disabled':'')+'>'+(todayComplete?"Connected today":"I connected today")+'</button>':'<button type="button" class="btn mini" data-tend-open="area-rhythm" data-area-id="marriage" data-rhythm-id="'+esc(record.id)+'"'+(todayComplete?' disabled':'')+'>'+(todayComplete?"Connected today":"I connected today")+'</button>'):'<span class="marriage-daily-goal-note">Choose a spouse contact to record this rhythm.</span>';
  var connectionUndo=todayComplete&&progress.dayKeys.indexOf(progress.today)!==-1?'<button type="button" class="btn mini ghost" data-marriage-daily-undo="'+esc(record.id)+'">Undo today</button>':"";
  var dailyCard='<section class="marriage-daily-card" aria-labelledby="marriage-daily-title"><div class="marriage-daily-heading"><div><span class="marriage-daily-eyebrow">A small invitation</span><h3 id="marriage-daily-title">Daily Connection</h3></div><button type="button" class="btn mini ghost" data-marriage-daily-settings-open>Settings</button></div><div class="marriage-daily-topic"><span class="marriage-topic-icon">'+marriageIconHTML("rhythms","daily-connection")+'</span><span><span class="marriage-daily-prompt-label">Today’s topic</span><strong>'+esc(category.label)+'</strong></span></div><div class="marriage-daily-prompt-inset"><p class="marriage-daily-prompt" aria-live="polite">'+esc(category.prompts[selection.promptIndex])+'</p></div><div class="marriage-daily-prompt-controls"><label class="sr-only" for="marriage-prompt-category">Prompt topic</label><select id="marriage-prompt-category" data-marriage-prompt-category aria-label="Prompt topic">'+MARRIAGE_PROMPT_CATEGORIES.map(function(item){return '<option value="'+item.id+'"'+(item.id===category.id?' selected':'')+'>'+esc(item.label)+'</option>';}).join("")+'</select><button type="button" class="btn mini ghost" data-marriage-prompt-next>Another idea</button></div><div class="marriage-daily-actions">'+tend+connectionUndo+(todayComplete?'<span class="marriage-daily-goal-note">Today is already counted toward your weekly goal.</span>':'')+'</div></section>';
  var weekly='<section class="marriage-weekly-goal" aria-labelledby="marriage-weekly-goal-title"><div class="marriage-weekly-heading"><h3 id="marriage-weekly-goal-title">Weekly goal</h3><strong>'+progress.count+' of '+progress.goal+' days connected</strong></div><div class="marriage-weekdays" role="group" aria-label="Daily Connection this week">'+weekDays+'</div><div class="marriage-daily-progress-track" role="meter" aria-label="Daily Connection weekly goal" aria-valuemin="0" aria-valuemax="'+progress.goal+'" aria-valuenow="'+progress.credited+'"><span style="width:'+progress.score+'%"></span></div></section>';
  var focusSection=focus?'<section class="marriage-weekly-focus-card" aria-labelledby="marriage-weekly-focus-title"><h3 id="marriage-weekly-focus-title">This week’s focus</h3><div><span class="marriage-topic-icon">'+marriageIconHTML("foundations","connection")+'</span><p><strong>'+esc(focus.label)+'</strong><span>'+esc(focus.description)+'</span></p></div></section>':"";
  return dailyCard+weekly+focusSection+marriageDailySettingsHTML();
 }
 var MARRIAGE_PAGE_TABS=[["today","Today"],["rhythms","Rhythms"],["foundations","Foundations"]];
 function marriageTemplateAssociationHTML(template){
  var primary=MARRIAGE_FOUNDATION_BY_ID[template.primaryFoundation]?template.primaryFoundation:null,secondary=(template.secondaryFoundations||[]).filter(function(id,index){return MARRIAGE_FOUNDATION_BY_ID[id]&&id!==primary&&template.secondaryFoundations.indexOf(id)===index;});
  function badge(id){return '<button type="button" class="marriage-foundation-badge" data-marriage-foundation="'+esc(id)+'" aria-label="View '+esc(marriageFoundationName(id))+' Foundation">'+marriageIconHTML("foundations",id)+'<span>'+esc(marriageFoundationName(id))+'</span></button>';}
  return '<section class="marriage-detail-foundations" aria-label="Foundation associations">'+(primary?'<div class="marriage-detail-foundation-row"><span>Primary</span>'+badge(primary)+'</div>':'')+(secondary.length?'<div class="marriage-detail-foundation-row"><span>Secondary</span>'+secondary.map(badge).join("")+'</div>':'')+'</section>';
 }
 function marriageTemplateRowHTML(template){
  var info=marriageTemplateStatus(template.id),add=info.status==="available"||info.status==="deleted",action=add?'<button type="button" class="btn mini ghost marriage-template-add" data-marriage-suggestion-add="'+esc(template.id)+'">'+(info.status==="deleted"?"Replace":"Add")+'</button>':'<button type="button" class="btn mini ghost marriage-template-add" data-marriage-rhythm-details="'+esc(template.id)+'">Details</button>';
  return '<article class="marriage-template-row"><button type="button" class="marriage-template-main" data-marriage-rhythm-details="'+esc(template.id)+'">'+marriageIconHTML("rhythms",template.iconId)+'<span class="marriage-template-copy"><strong>'+esc(template.title)+'</strong><span>'+esc(marriageTemplateFrequencyLabel(template))+'</span></span><span class="marriage-template-chevron" aria-hidden="true">›</span></button>'+action+'</article>';
 }
 function marriageTemplateDetailsHTML(template){
  if(!template)return "";
  var info=marriageTemplateStatus(template.id),out='<section class="marriage-detail-card" aria-labelledby="marriage-rhythm-detail-title"><button type="button" class="marriage-back-link" data-marriage-rhythm-back>‹ All Rhythms</button><h3 class="sr-only" id="marriage-rhythm-detail-title" tabindex="-1">'+esc(template.title)+' details</h3>';
  if(info.record){
   var linked=marriageRhythmById(info.record.id),history=linked&&linked.person?linked.person.id+"|"+linked.record.id:"area-rhythm|marriage|"+info.record.id,consistency=marriageRhythmConsistency(info.record,todayStr()),icon=marriageIconHTML("rhythms",template.iconId);
   out+='<div class="marriage-linked-rhythm">'+categoryRhythmRow(linked,"marriage",{score:consistency.score,leadingHTML:'<span class="marriage-detail-rhythm-icon">'+icon+'</span>',historyAttributes:{"data-rhyhistory":history,"data-marriage-history":history}})+'<button type="button" class="btn mini ghost" data-rhyhistory="'+esc(history)+'" data-marriage-history="'+esc(history)+'">History &amp; Consistency</button></div>';
   if(!info.inMarriage)out+='<button type="button" class="btn mini" data-marriage-include="'+esc(template.id)+'">Include in Marriage</button>';
  }else{
   var recommendation={id:"suggested-"+template.id,text:template.title,description:template.description,freq:template.freq,every:template.every||1,unit:template.unit||"weeks",tod:template.tod,weekdays:[],added:null},metadata=window.tendRhythmCardMetadata(recommendation);
   out+=tendRhythmCardHTML(recommendation,{title:template.title,description:template.description,leadingHTML:'<span class="marriage-detail-rhythm-icon">'+marriageIconHTML("rhythms",template.iconId)+'</span>',showScore:false,actionLabel:"Add",actionTitle:"Add this recommended Rhythm",tendAttributes:{"data-marriage-suggestion-add":template.id},frequency:metadata.frequency,time:metadata.time,lastTended:{full:"",label:""},frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML});
  }
  var primary=info.record?marriagePrimaryFoundation(info.record):template.primaryFoundation,secondary=info.record?marriageSecondaryFoundations(info.record):template.secondaryFoundations||[];
  out+=marriageTemplateAssociationHTML({primaryFoundation:primary,secondaryFoundations:secondary})+'</section>';
  return out;
 }
 function marriageCustomRhythmDetailsHTML(item){
  if(!item||!item.record)return "";
  var record=item.record,history=item.person?item.person.id+"|"+record.id:"area-rhythm|marriage|"+record.id,consistency=marriageRhythmConsistency(record,todayStr());
  var out='<section class="marriage-detail-card" aria-labelledby="marriage-custom-rhythm-title"><button type="button" class="marriage-back-link" data-marriage-rhythm-back>‹ All Rhythms</button><h3 class="sr-only" id="marriage-custom-rhythm-title" tabindex="-1">'+esc(record.text||"Rhythm")+' details</h3><div class="marriage-linked-rhythm">'+categoryRhythmRow(item,"marriage",{score:consistency.score,historyAttributes:{"data-rhyhistory":history,"data-marriage-history":history}})+'<button type="button" class="btn mini ghost" data-rhyhistory="'+esc(history)+'" data-marriage-history="'+esc(history)+'">History &amp; Consistency</button></div>';
  var primary=marriagePrimaryFoundation(record),secondary=marriageSecondaryFoundations(record);
  if(primary||secondary.length)out+=marriageTemplateAssociationHTML({primaryFoundation:primary,secondaryFoundations:secondary});
  return out+'</section>';
 }
 function marriageRhythmPanel(rows){
  var out='<section class="marriage-rhythm-section" aria-labelledby="marriage-rhythms-heading">';
  if(marriageRhythmDetailId){
   var selectedTemplate=marriageTemplateById(marriageRhythmDetailId);
   if(selectedTemplate)return out+marriageTemplateDetailsHTML(selectedTemplate)+"</section>";
   if(marriageRhythmDetailId.indexOf("custom:")===0){var selectedRhythm=marriageRhythmById(marriageRhythmDetailId.slice(7));if(selectedRhythm)return out+marriageCustomRhythmDetailsHTML(selectedRhythm)+"</section>";}
   marriageRhythmDetailId=null;
  }
  var ordering=typeof window.tendRhythmOrderMode==="function"&&window.tendRhythmOrderMode("category:marriage");
  out+='<header class="marriage-section-heading"><div><h3 id="marriage-rhythms-heading" tabindex="-1">Explore marriage rhythms</h3><p>Small, intentional investments that strengthen your marriage over time.</p></div><div class="category-rhythm-header-actions">'+(ordering?tendRhythmOrderToolbar("category:marriage",rows.length,"category-rhythm-order-toolbar"):"")+'<button type="button" class="btn mini ghost" data-area-rhythm-new="marriage">+ Add rhythm</button></div></header>';
  if(areaRhythmDraft&&areaRhythmDraft.areaId==="marriage")out+=categoryRhythmFormForArea("marriage");
  MARRIAGE_RHYTHM_GROUPS.forEach(function(group){
   var templates=MARRIAGE_RHYTHM_TEMPLATES.filter(function(template){return template.group===group.id;});
   out+='<section class="marriage-recommendation-group" aria-labelledby="marriage-group-'+group.id+'"><header><div><h4 id="marriage-group-'+group.id+'">'+esc(group.title)+'</h4><p>'+esc(group.subtitle)+'</p></div><span>'+templates.length+' suggested</span></header><div class="marriage-template-list">'+templates.map(marriageTemplateRowHTML).join("")+'</div></section>';
  });
  var linkedIds=MARRIAGE_RHYTHM_TEMPLATES.map(function(template){return marriageTemplateStatus(template.id).rhythmId;}).filter(Boolean);
  var customRows=rows.filter(function(item){return linkedIds.indexOf(item.record.id)===-1&&!item.record.marriageDuplicateOf;});
  if(customRows.length){
   var orderContext="category:marriage",defaultRows=customRows.slice().sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));}),orderedRows=tendRhythmOrderSort(orderContext,defaultRows,categoryRhythmOrderId),allIds=defaultRows.map(categoryRhythmOrderId);
   out+='<section class="marriage-custom-rhythms"><h4>Your other Marriage Rhythms</h4><div class="category-rhythm-order-list"'+tendRhythmOrderListAttributes(orderContext,allIds)+'>';
   orderedRows.forEach(function(item,index){var row=categoryRhythmRow(item,"marriage",{detailsAttributes:{"data-marriage-custom-rhythm":item.record.id}}),stableId=categoryRhythmOrderId(item);out+=ordering&&orderedRows.length>=2?tendRhythmOrderItemHTML(orderContext,orderContext,stableId,item.record.text,index,orderedRows.length,row):row;out+=marriageFoundationAssignmentHTML(item.record);});
   out+='</div></section>';
  }
  return out+"</section>";
 }
 function marriageTodaySection(rows){
  var due=rows.filter(function(item){return !item.record.marriageDailyConnection&&categoryRhythmDue(item);});
  if(!due.length)return "";
  return '<section class="marriage-today-section" aria-labelledby="marriage-today-heading"><h3 id="marriage-today-heading">Today together</h3><div class="marriage-today-list">'+due.map(function(item){
   var record=item.record,source=item.person?{rhythm:item.person.id+"|"+record.id}:{areaRhythm:record.id,areaId:"marriage"};
   return typeof planRhythmCardHTML==="function"?planRhythmCardHTML(source):categoryRhythmRow(item,"marriage");
  }).join("")+'</div></section>';
 }
 function marriageFoundationCardHTML(item){
  var score=item.score===null?null:Math.round(item.score),count=item.eligibleRhythms.length,bar=Number.isFinite(item.score)?'<span class="marriage-foundation-progress"><span style="width:'+Math.max(0,Math.min(100,item.score))+'%"></span></span>':'<span class="marriage-foundation-progress is-empty"></span>';
  return '<button type="button" class="marriage-foundation-card" data-marriage-foundation="'+esc(item.id)+'">'+marriageIconHTML("foundations",item.id)+'<span class="marriage-foundation-card-copy"><strong>'+esc(item.foundation.name)+'</strong><span>'+esc(item.foundation.description)+'</span><span class="marriage-foundation-card-meta">'+count+' scored supporting Rhythm'+(count===1?"":"s")+(Number.isFinite(item.score)?" · "+Math.round(item.score)+"% momentum":"")+'</span>'+bar+'</span><span class="marriage-foundation-score '+(score===null?"neutral":scoreClass(score))+'">'+(score===null?"—":score)+'</span><span class="marriage-template-chevron" aria-hidden="true">›</span></button>';
 }
 function marriageFoundationDetailHTML(id,rows){
  var foundation=MARRIAGE_FOUNDATION_BY_ID[id];
  if(!foundation)return "";
  var scores=marriageFoundationScores(rows),item=scores.foundations.find(function(entry){return entry.id===id;}),score=item&&Number.isFinite(item.score)?Math.round(item.score):null;
  var breadthText=item.breadthFactor===null?"No breadth adjustment":item.breadthFactor<1?"One scored Rhythm · 0.90 breadth factor":"Two or more scored Rhythms · no breadth reduction";
  var out='<section class="marriage-foundation-detail" aria-labelledby="marriage-foundation-detail-title"><button type="button" class="marriage-back-link" data-marriage-foundation-back>‹ All Foundations</button><header class="marriage-detail-heading">'+marriageIconHTML("foundations",id)+'<div><h3 id="marriage-foundation-detail-title" tabindex="-1">'+esc(foundation.name)+'</h3><p>'+esc(foundation.description)+'</p></div></header><div class="marriage-foundation-detail-score"><strong class="'+(score===null?"neutral":scoreClass(score))+'">'+(score===null?"—":score)+'</strong><span>'+item.eligibleRhythms.length+' scored supporting Rhythm'+(item.eligibleRhythms.length===1?"":"s")+'</span><span class="marriage-foundation-progress'+(score===null?" is-empty":"")+'"><span style="width:'+(score===null?0:score)+'%"></span></span><small>Weighted consistency: '+(Number.isFinite(item.weightedConsistency)?Math.round(item.weightedConsistency)+"%":"Not scored")+' · '+breadthText+'. Primary and secondary associations contribute.</small></div>';
  if(item.rhythms.length)out+='<section class="marriage-foundation-rhythm-list"><h4>Supporting Rhythms</h4>'+item.rhythms.map(function(entry){var record=entry.item.record,consistency=entry.consistency,scoreText=Number.isFinite(consistency.score)?Math.round(consistency.score)+"%":"Not scored",association=marriagePrimaryFoundation(record)===id?"Primary":"Secondary",frequency=typeof rhythmFreqLabel==="function"?rhythmFreqLabel(record):record.freq||"Schedule";return '<article class="marriage-foundation-rhythm"><div><strong>'+esc(record.text||"Untitled Rhythm")+'</strong><span>'+esc(association)+' · '+esc(frequency)+' · influence weight '+entry.weight+(consistency.eligible?" · "+consistency.completed+" of "+Number(consistency.expected.toFixed(1))+" expected":" · No eligible expected occurrences")+'</span></div><strong>'+scoreText+'</strong></article>';}).join("")+'</section>';
  else out+='<section class="marriage-foundation-empty"><h4>A foundation to grow into</h4><p>No active supporting Rhythms are assigned yet. You can start with one of these ideas when the time feels right.</p></section>';
  var recommendations=MARRIAGE_RHYTHM_TEMPLATES.filter(function(template){return template.primaryFoundation===id&&["available","deleted"].indexOf(marriageTemplateStatus(template.id).status)!==-1;});
  if(recommendations.length)out+='<section class="marriage-foundation-recommendations"><h4>Recommended Rhythms</h4>'+recommendations.map(function(template){return '<article>'+marriageIconHTML("rhythms",template.iconId)+'<span><strong>'+esc(template.title)+'</strong><small>'+esc(marriageTemplateFrequencyLabel(template))+'</small></span><button type="button" class="btn mini ghost" data-marriage-suggestion-add="'+esc(template.id)+'">Add</button></article>';}).join("")+'</section>';
  out+='<section class="marriage-foundation-why"><h4>Why it matters</h4><p>'+esc(foundation.why)+'</p><ul>'+foundation.suggestions.map(function(suggestion){return '<li>'+esc(suggestion)+'</li>';}).join("")+'</ul></section>';
  if(id==="spiritual-growth")out+='<details class="marriage-preserved-content"><summary>Prayer requests connected to Marriage</summary>'+marriagePrayerPanel()+'</details>';
  return out+'</section>';
 }
 function marriageFoundationsPanel(rows){
  if(marriageFoundationDetailId)return marriageFoundationDetailHTML(marriageFoundationDetailId,rows);
  var scores=marriageFoundationScores(rows);
  return '<section class="marriage-foundations-section" aria-labelledby="marriage-foundations-heading"><header class="marriage-section-heading"><div><h3 id="marriage-foundations-heading" tabindex="-1">Marriage foundations</h3><p>These key areas help guide your Rhythms and focus.</p></div></header><div class="marriage-foundation-grid">'+scores.foundations.map(marriageFoundationCardHTML).join("")+'</div><p class="marriage-scoring-note">These scores reflect consistency in planned Rhythms, not relationship quality or a clinical assessment.</p></section>';
 }
 function marriageTodayPanel(rows,spouse,sections){
  var due=marriageTodaySection(rows),daily=marriageDailyConnectionHTML(spouse),empty=marriageActiveRhythms(rows).length?'':'<section class="marriage-empty-rhythms" aria-labelledby="marriage-empty-rhythms-title"><div><h3 id="marriage-empty-rhythms-title">Start with a shared practice</h3><p>Explore recommended Rhythms or create one that fits your relationship.</p></div><button type="button" class="btn mini" data-marriage-explore-empty>Explore suggested rhythms</button></section>';
  return daily+due+empty+'<details class="marriage-preserved-content"><summary>Activity, tasks, and history</summary>'+sections.tasks+sections.activity+sections.history+'</details><details class="marriage-preserved-content"><summary>Prayer requests and Sparks</summary>'+marriagePrayerPanel()+marriageSparksPanel()+'</details>';
 }
 function marriageSavePromptSelection(categoryId,advance){
  var category=marriagePromptCategory(categoryId),spouse=marriageSelectedSpouse();
  if(!category)return false;
  var selection=marriagePromptSelection(todayStr(),spouse&&spouse.id),index=selection.categoryId===category.id?selection.promptIndex:marriageHash("prompt|"+selection.date+"|"+String(spouse&&spouse.id||""))%category.prompts.length;
  if(advance)index=(index+1)%category.prompts.length;
  S.settings.marriageDailyConnectionPrompt={date:selection.date,categoryId:category.id,promptIndex:index};
  save();render();
  requestAnimationFrame(function(){var control=document.querySelector(advance?"[data-marriage-prompt-next]":"[data-marriage-prompt-category]");if(control)control.focus({preventScroll:true});});
  return true;
 }
 function marriageSaveDailySettings(button){
  var dialog=button.closest("dialog"),goalInput=dialog&&dialog.querySelector("[data-marriage-daily-goal]"),focusInput=dialog&&dialog.querySelector("[data-marriage-weekly-focus]");
  var goal=goalInput&&marriageValidGoal(goalInput.value);
  if(!goal||!focusInput){flash("Choose a valid weekly goal");return;}
  var current=marriageGoalForDate(todayStr()),oldGoal=S.settings.marriageDailyConnectionGoal||{},pending=marriageValidGoal(oldGoal.pending),effective=String(oldGoal.effectiveDate||"");
  if(goal===current)S.settings.marriageDailyConnectionGoal={active:current,pending:null,effectiveDate:null};
  else if(goal===pending&&/^\d{4}-\d{2}-\d{2}$/.test(effective)&&effective>marriageDateKey(todayStr()))S.settings.marriageDailyConnectionGoal={active:current,pending:goal,effectiveDate:effective};
  else S.settings.marriageDailyConnectionGoal={active:current,pending:goal,effectiveDate:marriageNextWeekStart()};
  var oldFocus=marriageWeeklyFocus(),startsOn=oldFocus.startsOn;
  if(focusInput.checked&&!oldFocus.enabled)startsOn=marriageNextWeekStart();
  if(focusInput.checked&&!startsOn)startsOn=marriageNextWeekStart();
  S.settings.marriageWeeklyFocus={enabled:!!focusInput.checked,startsOn:startsOn};
  marriageDailySettingsDraft=null;save();render();flash("Daily Connection settings saved");
  requestAnimationFrame(function(){var trigger=document.querySelector("[data-marriage-daily-settings-open]");if(trigger)trigger.focus({preventScroll:true});});
 }
 function marriageSparkRows(){
  var rows=[],seen=Object.create(null);
  (S.people||[]).forEach(function(person){
   (person.sparks||[]).forEach(function(spark){
    if(!spark||!spark.id||!Array.isArray(spark.areas)||spark.areas.indexOf("marriage")===-1)return;
    var key=person.id+"|"+spark.id;if(seen[key])return;seen[key]=true;
    rows.push({spark:spark,person:person});
   });
  });
  return rows.sort(function(a,b){
   if(!!a.spark.done!==!!b.spark.done)return a.spark.done?1:-1;
   return String(a.spark.by||"9999").localeCompare(String(b.spark.by||"9999"));
  });
 }
 function marriageSparksPanel(){
  var rows=marriageSparkRows(),active=rows.filter(function(item){return !item.spark.done;}),completed=rows.filter(function(item){return item.spark.done;}),out='<section class="marriage-content-section" aria-labelledby="marriage-sparks-heading"><header class="marriage-section-heading"><div><h3 id="marriage-sparks-heading">Sparks</h3><p>Low-pressure ideas categorized for Marriage.</p></div></header>';
  if(active.length){
   out+='<div class="marriage-spark-list">'+active.map(function(item){
    var spark=item.spark,ownerId=item.person.id,people=typeof tendAssociationPeopleBadges==="function"?tendAssociationPeopleBadges(spark,ownerId,null,"spark"):"",categories=typeof tendAssociationCategoryBadges==="function"?tendAssociationCategoryBadges(spark):"",edit='<button type="button" class="iconbtn" data-sedit="'+esc(ownerId+"|"+spark.id)+'" aria-label="Edit '+esc(spark.text||"Spark")+'" title="Edit">✎</button>',action='<button type="button" class="btn mini sparkbtn" data-sparkdo="'+esc(ownerId+"|"+spark.id+"|"+ownerId)+'">Do it</button>',topMeta='<div class="plan-item-top-meta">'+(people?'<div class="plan-item-meta-people plan-people"><span class="plan-people-visible">'+people+'</span></div>':'')+(categories?'<div class="plan-item-category-row"><span class="rhythm-area-badges plan-category-visible">'+categories.replace(/^<span class="rhythm-area-badges"[^>]*>|<\/span>$/g,"")+'</span></div>':'')+'</div>',date=spark.by?spark.by:"Someday";
    var card=tendSparkCardHTML(spark,{title:spark.text||"(unnamed spark)",description:String(spark.details||"").trim(),actionHTML:action,headingEditHTML:edit,topMetaHTML:topMeta,footerHTML:'<span class="spark-card__meta-item"><span>'+esc(date)+'</span></span>',className:"marriage-spark-card",cardAttributes:{"data-spark-row":ownerId+"|"+spark.id}});
    if(typeof tendSparkEditModalHTML==="function"&&typeof sparkEditDraft!=="undefined"&&sparkEditDraft&&sparkEditDraft.id===spark.id&&sparkEditOwnerId===ownerId)card+=tendSparkEditModalHTML(ownerId,ownerId);
    return card;
   }).join("")+'</div>';
  }else out+='<div class="empty">No active Sparks categorized for Marriage.</div>';
  if(completed.length)out+='<details class="marriage-spark-history"><summary>Completed Sparks ('+completed.length+')</summary><ul>'+completed.map(function(item){var completedAt=Number(item.spark.doneTs||item.spark.completedTs),date=Number.isFinite(completedAt)&&completedAt>0?new Date(completedAt).toLocaleDateString():"Completed";return '<li><span>'+esc(item.spark.text||"Untitled Spark")+'</span><time>'+esc(date)+'</time></li>';}).join("")+'</ul></details>';
  return out+"</section>";
 }
 function marriagePrayerRecords(spouse){
  return (S.prayers||[]).filter(function(prayer){
   return prayer.category==="Marriage"||Array.isArray(prayer.areas)&&prayer.areas.indexOf("marriage")!==-1||!!(spouse&&(prayer.personId===spouse.id||Array.isArray(prayer.sharedWith)&&prayer.sharedWith.indexOf(spouse.id)!==-1));
  });
 }
 function marriagePrayerPanel(){
  var spouse=marriageSelectedSpouse(),prayers=marriagePrayerRecords(spouse),scope="Marriage"+(spouse&&spouse.name?" or "+spouse.name:"");
  return '<section class="marriage-content-section" aria-labelledby="marriage-prayer-heading"><header class="marriage-section-heading"><div><h3 id="marriage-prayer-heading" tabindex="-1">Prayer</h3><p>Prayer requests connected to '+esc(scope)+'.</p></div></header>'+((typeof window.prayerList==="function")?window.prayerList(prayers,false):prayers.map(function(prayer){return typeof window.prayerRow==="function"?window.prayerRow(prayer):"";}).join("")||'<div class="empty">No prayers connected to '+esc(scope)+'.</div>')+'</section>';
 }
 function marriageConnectionsPanel(sections){
  return '<div class="marriage-connections-content">'+sections.tasks+sections.activity+sections.history+'</div>';
 }
 function marriagePageHTML(){
  var rows=categoryRhythms("marriage"),sections=window.tendRenderAreaSections("marriage"),spouse=marriageSelectedSpouse(),out='<main class="category-page marriage-page">'+marriageHealthSummaryHTML(rows);
  out+='<div class="faith-view-nav marriage-view-nav" role="tablist" aria-label="Marriage content">'+MARRIAGE_PAGE_TABS.map(function(item){
   var selected=marriageActiveTab===item[0];
   return '<button type="button" role="tab" id="marriage-tab-'+item[0]+'" aria-controls="marriage-panel-'+item[0]+'" aria-selected="'+selected+'" tabindex="'+(selected?"0":"-1")+'" data-marriage-tab="'+item[0]+'">'+item[1]+'</button>';
  }).join("")+'</div>';
  out+='<section class="marriage-view-panel" role="tabpanel" id="marriage-panel-today" aria-labelledby="marriage-tab-today"'+(marriageActiveTab==="today"?'':' hidden')+'>'+marriageTodayPanel(rows,spouse,sections)+'</section>';
  out+='<section class="marriage-view-panel" role="tabpanel" id="marriage-panel-rhythms" aria-labelledby="marriage-tab-rhythms"'+(marriageActiveTab==="rhythms"?'':' hidden')+'>'+marriageRhythmPanel(rows)+'</section>';
  out+='<section class="marriage-view-panel" role="tabpanel" id="marriage-panel-foundations" aria-labelledby="marriage-tab-foundations"'+(marriageActiveTab==="foundations"?'':' hidden')+'>'+marriageFoundationsPanel(rows)+'</section>';
  return out+marriageSuggestionsDialog()+'</main>';
 }
 function categoryRhythmSections(id){
  if(!CATEGORY_AREA_SET[id])return "";
  var rows=categoryRhythms(id),out="",orderContext="category:"+id;
  if(id!=="faith"){
   var due=rows.filter(categoryRhythmDue);
   out+='<section class="card category-today-rhythms"><div class="subhead">Today</div>';
   if(due.length){
    due.forEach(function(item){var r=item.record,p=item.person,score=rhythmScore(r),tag=p?'<button type="button" class="rhythm-person-badge" data-openperson="'+esc(p.id)+'">'+personAvatar(p,22)+'<span>'+esc(p.name.trim().split(/\s+/)[0])+'</span></button>':'<span class="rhythm-owner-badge">Personal</span>';
     var tend=p?'<button type="button" class="btn mini" data-tend-open="person-rhythm" data-person-id="'+esc(p.id)+'" data-rhythm-id="'+esc(r.id)+'" data-rhythm-area="'+esc(id)+'">Tend</button>':'<button type="button" class="btn mini" data-tend-open="area-rhythm" data-area-id="'+esc(id)+'" data-rhythm-id="'+esc(r.id)+'">Tend</button>';
     var meta=tendRhythmMetaLabel(r,null,true);
     if(p){
      var badges=typeof window.planPills==="function"?window.planPills({personId:p.id,rhythm:p.id+"|"+r.id,hideTypeBadge:true}):rhythmPeopleBadges(r,p.id)+(typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(r):"");
      out+='<div class="actrow"><span class="act-ic" style="background:'+(typeof tendHealthScoreColor==="function"?tendHealthScoreColor(score):personHealthColor(score))+'"></span><div class="pi-main">'+tendRhythmCardContentHTML(r,{title:r.text||"(unnamed rhythm)",description:String(r.description||"").trim(),meta:meta,badges:badges})+'</div>'+(typeof window.planPills==="function"?"":tag)+tend+'</div>';
     }else out+='<div class="actrow"><span class="act-ic" style="background:'+(typeof tendHealthScoreColor==="function"?tendHealthScoreColor(score):personHealthColor(score))+'"></span><div class="pi-main"><div class="pi-label">'+esc(r.text||"(unnamed rhythm)")+'</div><div class="pi-sub">'+esc(meta)+'</div></div>'+tag+tend+'</div>';
    });
   }else out+='<div class="empty">No rhythms due today.</div>';
   out+='</section>';
  }
  out+='<section class="card category-rhythms"><div class="category-rhythms-heading"><div><div class="subhead">Rhythms</div><div class="profile-tab-intro">Recurring practices connected to this category.</div></div><div class="category-rhythm-header-actions">'+tendRhythmOrderToolbar(orderContext,rows.length,"category-rhythm-order-toolbar")+'<button type="button" class="btn mini ghost" data-area-rhythm-new="'+esc(id)+'">+ Add rhythm</button></div></div>';
  if(areaRhythmDraft&&areaRhythmDraft.areaId===id)out+=categoryRhythmFormForArea(id);
  if(rows.length){
   var defaultRows=rows.slice().sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));}),orderedRows=tendRhythmOrderSort(orderContext,defaultRows,categoryRhythmOrderId),allIds=defaultRows.map(categoryRhythmOrderId);
   out+='<div class="category-rhythm-order-list"'+tendRhythmOrderListAttributes(orderContext,allIds)+'>';
   orderedRows.forEach(function(item,index){
    var row=categoryRhythmRow(item,id),stableId=categoryRhythmOrderId(item);
    out+=orderedRows.length>=2?tendRhythmOrderItemHTML(orderContext,orderContext,stableId,item.record.text,index,orderedRows.length,row):row;
   });
   out+='</div>';
  }else if(!(areaRhythmDraft&&areaRhythmDraft.areaId===id))out+='<div class="empty">No rhythms yet.</div>';
  return out+'</section>';
 }
 var baseRenderArea=window.renderArea;
 window.renderArea=function(id){
  if(id==="health"&&typeof renderFitnessPage==="function")return renderFitnessPage();
  if(id==="marriage")return marriagePageHTML();
  var html=baseRenderArea(id);
  if(!CATEGORY_AREA_SET[id])return html;
  var marker='<div class="card" style="margin-bottom:14px"><div class="subhead">Tasks</div>';
  return html.replace(marker,categoryRhythmSections(id)+marker);
 };
 function applyRhythmField(record,field,target,form){
  if(field==="text"||field==="description"){record[field]=target.value;return false;}
  if(field==="areas"){record.areas=Array.prototype.slice.call(form.querySelectorAll('[data-rfield$="|areas"]:checked')).map(function(input){return input.value;});return false;}
  if(field==="weekdays"){
   record.weekdays=Array.prototype.slice.call(form.querySelectorAll('[data-rfield$="|weekdays"]:checked')).map(function(input){return +input.value;});
   if(record.freq!=="selectdays"&&record.weekdays.length>1)record.weekdays=[record.weekdays[0]];
   if(!record.weekdays.length&&!record.sourceTemplateId)record.weekdays=[+target.value];
   return true;
  }
  if(field==="monthlyMode"){record.monthlyMode=target.value;return true;}
  if(field==="freq"){
   record.freq=target.value;
   if(target.value==="monthly"||target.value==="quarterly"){record.monthlyMode=record.monthlyMode||"onDay";record.dayOfMonth=record.dayOfMonth||(record.sourceTemplateId?null:new Date().getDate());if(target.value==="quarterly"&&!record.qmonth&&!record.sourceTemplateId)record.qmonth=(new Date().getMonth()%3)+1;}
   if(target.value==="yearly"){record.monthlyMode=record.monthlyMode||"onDay";record.month=record.month||(record.sourceTemplateId?null:new Date().getMonth()+1);record.monthDay=record.monthDay||(record.sourceTemplateId?null:new Date().getDate());}
   if(target.value==="custom"){record.every=record.every||1;record.unit=record.unit||"weeks";if(!record.start&&!record.sourceTemplateId)record.start=todayStr();}
   if(target.value==="weekly"&&(!Array.isArray(record.weekdays)||record.weekdays.length!==1))record.weekdays=record.sourceTemplateId?[]:[new Date().getDay()];
   if(target.value==="selectdays"&&(!Array.isArray(record.weekdays)||!record.weekdays.length))record.weekdays=record.sourceTemplateId?[]:[new Date().getDay()];
   return true;
  }
  if(field==="unit"){record.unit=target.value;return true;}
  if(["every","dayOfMonth","ord","ordWeekday","month","monthThe","monthDay","qmonth"].indexOf(field)!==-1){record[field==="monthThe"?"month":field]=+target.value||1;return true;}
  if(field==="until"){record.until=target.value||null;record.endDateEnabled=!!record.until;return false;}
  if(field==="endDateEnabled"){record.endDateEnabled=target.checked;if(!target.checked)record.until=null;return true;}
  record[field]=target.value;
  return false;
 }
 function categoryRhythmRecord(id,rid){
  return S.areaRhythms.find(function(record){return record.id===rid&&areaIds(record).indexOf(id)!==-1;});
 }
 function saveAreaRhythm(id,rid,form){
  var original=rid==="draft"?null:categoryRhythmRecord(id,rid),record=areaRhythmDraft&&areaRhythmDraft.areaId===id&&areaRhythmDraft.record.id===rid?areaRhythmDraft.record:original;
  if(!record)return;
  var marriageEditor=id==="marriage"&&currentArea==="marriage",areaRhythmsBefore=S.areaRhythms.slice(),peopleRhythmsBefore=S.people.map(function(person){return {person:person,rhythms:Array.isArray(person.rhythms)?person.rhythms.slice():null};}),originalBefore=original?JSON.parse(JSON.stringify(original)):null,eventPeopleBefore=S.events.map(function(event){return {event:event,personId:event.personId};}),spouseSettingBefore=S.settings.marriageSpouseId,templateIdBefore=record.sourceTemplateId&&S.marriageRhythmTemplateLinks[record.sourceTemplateId],recordIdBefore=record.id,recordAddedBefore=record.added;
  function rollbackSave(){
   S.areaRhythms=areaRhythmsBefore;
   peopleRhythmsBefore.forEach(function(entry){if(entry.rhythms)entry.person.rhythms=entry.rhythms;else delete entry.person.rhythms;});
   if(original&&originalBefore){Object.keys(original).forEach(function(key){delete original[key];});Object.assign(original,originalBefore);}
   eventPeopleBefore.forEach(function(entry){if(entry.personId===undefined)delete entry.event.personId;else entry.event.personId=entry.personId;});
   if(spouseSettingBefore===undefined)delete S.settings.marriageSpouseId;else S.settings.marriageSpouseId=spouseSettingBefore;
   if(suggestionTemplateId){if(templateIdBefore===undefined)delete S.marriageRhythmTemplateLinks[suggestionTemplateId];else S.marriageRhythmTemplateLinks[suggestionTemplateId]=templateIdBefore;}
   record.id=recordIdBefore;record.added=recordAddedBefore;
   if(marriageEditor&&window.TEND_CLOUD_MODE&&window.TendCloudPersistence&&window.TendCloudPersistence.isReady())window.TendCloudPersistence.queue(S);
   flash("Rhythm could not be saved. Your changes are still in the form; please try again.");
  }
  function finishSave(){
   areaRhythmDraft=null;areaRhythmEditId=null;marriageSuggestionsOpen=false;
   if(marriageEditor)marriageActiveTab="rhythms";
   if(!window.tendFinishRhythmEdit||!window.tendFinishRhythmEdit())render();
   if(suggestionTemplateId)requestAnimationFrame(function(){var trigger=document.querySelector('[data-marriage-rhythm-details="'+suggestionTemplateId+'"]');if(trigger)trigger.focus({preventScroll:true});});
   flash("Rhythm saved");
  }
  var text=form.querySelector('[data-crf="text"]').value.trim();
  if(!text){flash("Give this rhythm a name");form.querySelector('[data-crf="text"]').focus();return;}
  if(record.sourceTemplateId&&rid==="draft"){
   var start=form.querySelector('[data-rfield$="|start"]'),weekdays=form.querySelectorAll('[data-rfield$="|weekdays"]:checked'),mode=form.querySelector('[data-rfield$="|monthlyMode"]:checked'),selectedMode=mode&&mode.value||record.monthlyMode||"onDay";
   if(!start||!start.value){flash("Choose a start date");if(start)start.focus();return;}
   if(record.freq==="weekly"&&!weekdays.length){flash("Choose a weekday");var weekday=form.querySelector('[data-rfield$="|weekdays"]');if(weekday)weekday.focus();return;}
   if(record.freq==="quarterly"&&(!record.qmonth||selectedMode==="onDay"&&!record.dayOfMonth||selectedMode==="onThe"&&(!record.ord||record.ordWeekday===undefined||record.ordWeekday===null))){flash("Choose the quarterly schedule");return;}
   if(record.freq==="yearly"&&(!record.month||selectedMode==="onDay"&&!record.monthDay||selectedMode==="onThe"&&(!record.ord||record.ordWeekday===undefined||record.ordWeekday===null))){flash("Choose the yearly schedule");return;}
  }
  record.text=text;record.description=form.querySelector('[data-crf="description"]').value.trim();
  record.personal=!!form.querySelector('[data-crf="personal"]').checked;
  if(marriageEditor){
   var preservedAreas=rid==="draft"?[]:Array.isArray(record.areas)?record.areas.slice():areaIds(record);
   record.areas=preservedAreas.filter(function(area,index){return preservedAreas.indexOf(area)===index;});
   if(record.areas.indexOf("marriage")===-1)record.areas.push("marriage");
  }else record.areas=areaIds(record);
  if(id==="me"&&!record.areas.length){flash("Choose at least one category");var firstArea=form.querySelector('[data-rfield$="|areas"]');if(firstArea)firstArea.focus();return;}
  if(record.sourceTemplateId&&!record.areas.length){flash("Choose at least one category");var templateArea=form.querySelector('[data-rfield$="|areas"]');if(templateArea)templateArea.focus();return;}
  if(id!=="me"&&!record.areas.length)record.areas=[id];
  var suggestionTemplateId=rid==="draft"?record.sourceTemplateId:null;
  var assigned=S.people.find(function(person){return person.id===form.querySelector('[data-crf="personId"]').value;});
  if(record.marriageDailyConnection){
   var spouse=marriageSelectedSpouse();
   if(areaIds(record).indexOf("marriage")===-1){flash("Keep Daily Connection in the Marriage category");return;}
   var existingDaily=!!(original&&original.marriageDailyConnection),allowedOwner=assigned&&marriagePersonIsSpouseCandidate(assigned)&&((existingDaily)||(spouse&&assigned.id===spouse.id));
   if(!allowedOwner){flash("Choose a spouse in the featured card for Daily Connection");return;}
   record.freq="custom";record.every=1;record.unit="weeks";record.weekdays=[];record.marriageWeeklyTarget=marriageValidGoal(record.marriageWeeklyTarget)||5;record.start=record.start||todayStr();S.settings.marriageSpouseId=assigned.id;
  }
  if(rid==="draft"){record.id=uid();record.added=record.added||todayStr();}
  if(assigned){
   record.added=record.added||todayStr();
   S.events.forEach(function(event){if(event.rhythmId===record.id)event.personId=assigned.id;});
   assigned.rhythms=assigned.rhythms||[];assigned.rhythms.push(record);
   S.areaRhythms=S.areaRhythms.filter(function(item){return item!==original&&item!==record;});
  }else if(rid==="draft")S.areaRhythms.push(record);
  else if(original)Object.assign(original,record);
  if(suggestionTemplateId)S.marriageRhythmTemplateLinks[suggestionTemplateId]=record.id;
  try{save();}
  catch(error){rollbackSave();return;}
  if(marriageEditor&&window.TEND_CLOUD_MODE&&window.TendCloudPersistence&&window.TendCloudPersistence.isReady()){
   flash("Saving Rhythm…");
   window.TendCloudPersistence.flush().then(function(){
    if(window.TendCloudPersistence.getStatus()==="Needs attention"){rollbackSave();return;}
    finishSave();
   }).catch(rollbackSave);
   return;
  }
  finishSave();
 }
 function findRhythmOwner(rid){var result=null;S.people.some(function(person){var record=(person.rhythms||[]).find(function(item){return item.id===rid;});if(record){result={person:person,record:record};return true;}return false;});return result;}
 function syncFaithFlyout(fieldset,open){
  if(!fieldset)return;
  var faithOption=fieldset.querySelector('.rhythm-area-option input[data-rfield$="|areas"][value="faith"]');
  var flyout=fieldset.querySelector(".rhythm-faith-flyout");
  if(flyout&&faithOption){if(faithOption.checked&&open&&!flyout.open)tendShowModal(flyout);else if((!faithOption.checked||!open)&&flyout.open)flyout.close();}
 }
 function faithRecord(owner){
  var parts=owner.split("|"),id=parts[0],rid=parts[1];
  if(id.indexOf("area-")===0){var area=id.slice(5);return areaRhythmDraft&&areaRhythmDraft.areaId===area&&areaRhythmDraft.record.id===rid?areaRhythmDraft.record:rid==="draft"?(areaRhythmDraft&&areaRhythmDraft.areaId===area?areaRhythmDraft.record:null):categoryRhythmRecord(area,rid);}
  if(id==="faith")return faithRhythmDraft;
  if(rid==="draft")return rhythmDraft&&rhythmDraft.pid===id?rhythmDraft:null;
  return rhythmEditDraft&&rhythmEditDraft.id===rid?rhythmEditDraft:null;
 }
 function cancelFaithPicker(dialog){
  if(faithPickerPrevious){
   var previous=faithPickerPrevious,record=faithRecord(previous.owner),fieldset=dialog.closest(".rhythm-area-checks"),checkbox=fieldset&&fieldset.querySelector('.rhythm-area-option input[data-rfield$="|areas"][value="faith"]');
   if(record){record.faithGroup=previous.faithGroup;record.areas=previous.areas.slice();}
   if(checkbox)checkbox.checked=previous.checked;
   var label=fieldset&&fieldset.querySelector("[data-faith-category-label]");
   if(label)label.textContent=previous.checked&&previous.faithGroup?"Faith - "+previous.faithGroup:"Faith";
   faithPickerPrevious=null;
  }
 }
 window.addEventListener("change",function(event){
  var target=event.target;if(!target||!target.matches)return;
  if(target.matches("[data-rhythm-faith-group]")){
   var owner=target.getAttribute("data-rhythm-faith-owner"),record=faithRecord(owner),ownerForm=target.closest(".rhythm-area-checks"),label=ownerForm&&ownerForm.querySelector("[data-faith-category-label]"),checkbox=ownerForm&&ownerForm.querySelector('.rhythm-area-option input[data-rfield$="|areas"][value="faith"]'),flyout=ownerForm&&ownerForm.querySelector(".rhythm-faith-flyout");
   if(record){record.faithGroup=target.value;if(!Array.isArray(record.areas))record.areas=[];if(record.areas.indexOf("faith")<0)record.areas.push("faith");}
   if(checkbox)checkbox.checked=true;
   if(label)label.textContent="Faith - "+target.value;
   faithPickerPrevious=null;
   if(flyout&&flyout.open)flyout.close();
   event.stopImmediatePropagation();return;
  }
  var field=target.getAttribute("data-rfield");
  if(!field)return;
  var parts=field.split("|");if(parts.length!==3)return;
  if(parts[2]==="areas"){
   var profileRecord=parts[1]==="draft"?(rhythmDraft&&rhythmDraft.pid===parts[0]?rhythmDraft:null):(rhythmEditDraft&&rhythmEditDraft.id===parts[1]?rhythmEditDraft:null);
   if(profileRecord){profileRecord.areas=Array.prototype.slice.call(target.closest(".rhythm-area-checks").querySelectorAll('input[data-rfield$="|areas"]:checked')).map(function(input){return input.value;});if(target.value==="faith"&&target.checked){var faithForm=target.closest(".rhythm-area-checks");faithPickerPrevious={owner:parts[0]+"|"+parts[1],checked:false,faithGroup:profileRecord.faithGroup||null,areas:profileRecord.areas.filter(function(area){return area!=="faith";})};syncFaithFlyout(faithForm,true);}else if(target.value==="faith"){var faithLabel=target.closest(".rhythm-faith-option").querySelector("[data-faith-category-label]");if(faithLabel)faithLabel.textContent="Faith";}event.stopImmediatePropagation();return;}
   if(parts[0]==="faith"&&faithRhythmDraft){faithRhythmDraft.areas=Array.prototype.slice.call(target.closest(".rhythm-area-checks").querySelectorAll("input:checked")).map(function(input){return input.value;});if(target.value==="faith"&&target.checked){faithPickerPrevious={owner:parts[0]+"|draft",checked:false,faithGroup:faithRhythmDraft.faithGroup||null,areas:faithRhythmDraft.areas.filter(function(area){return area!=="faith";})};syncFaithFlyout(target.closest(".rhythm-area-checks"),true);}event.stopImmediatePropagation();return;}
  }
  if(parts[0].indexOf("area-")!==0)return;
  var areaId=parts[0].slice(5),record=areaRhythmDraft&&areaRhythmDraft.areaId===areaId&&areaRhythmDraft.record.id===parts[1]?areaRhythmDraft.record:parts[1]==="draft"?(areaRhythmDraft&&areaRhythmDraft.areaId===areaId?areaRhythmDraft.record:null):categoryRhythmRecord(areaId,parts[1]);
  if(!record)return;
  var form=target.closest("[data-area-rhythm-form]");
  var rerender=applyRhythmField(record,parts[2],target,form);
  if(parts[2]==="areas"&&target.value==="faith"&&target.checked){faithPickerPrevious={owner:parts[0]+"|"+parts[1],checked:false,faithGroup:record.faithGroup||null,areas:record.areas.filter(function(area){return area!=="faith";})};syncFaithFlyout(target.closest(".rhythm-area-checks"),true);}
  else if(parts[2]==="areas"&&target.value==="faith"){var faithLabel=target.closest(".rhythm-faith-option").querySelector("[data-faith-category-label]");if(faithLabel)faithLabel.textContent="Faith";}
  event.stopImmediatePropagation();
  if(rerender)render();
 },true);
 window.addEventListener("change",function(event){
  var target=event.target;
  if(target&&target.matches&&target.matches("[data-marriage-rhythm-primary],[data-marriage-rhythm-secondary]")){
   var rhythmId=target.getAttribute("data-marriage-rhythm-primary")||target.getAttribute("data-marriage-rhythm-secondary"),entry=marriageRhythmById(rhythmId);
   if(!entry)return;
   if(target.hasAttribute("data-marriage-rhythm-primary"))entry.record.marriagePrimaryFoundation=MARRIAGE_FOUNDATION_BY_ID[target.value]?target.value:null;
   var associationEditor=target.closest(".marriage-rhythm-foundation-editor");
   if(associationEditor)entry.record.marriageSecondaryFoundations=Array.prototype.slice.call(associationEditor.querySelectorAll("[data-marriage-rhythm-secondary]:checked")).map(function(input){return input.value;});
   save();render();return;
  }
  if(target&&target.matches&&target.matches("[data-marriage-spouse-select]")){
   var candidates=marriageSpouseCandidates(),spouse=candidates.find(function(person){return person.id===target.value;});
   if(!spouse)return;
   S.settings.marriageSpouseId=spouse.id;save();render();
   requestAnimationFrame(function(){var select=document.querySelector("[data-marriage-spouse-select]");if(select)select.focus({preventScroll:true});});
   return;
  }
  if(target&&target.matches&&target.matches("[data-marriage-prompt-category]"))marriageSavePromptSelection(target.value,false);
 },true);
 window.addEventListener("input",function(event){
  var target=event.target;if(!target||!target.matches||!target.matches('[data-crf="text"],[data-crf="description"]'))return;
  var form=target.closest("[data-area-rhythm-form]");if(!form)return;
  var ids=form.getAttribute("data-area-rhythm-form").split("|"),record=areaRhythmDraft&&areaRhythmDraft.areaId===ids[0]&&areaRhythmDraft.record.id===ids[1]?areaRhythmDraft.record:ids[1]==="draft"?(areaRhythmDraft&&areaRhythmDraft.record):categoryRhythmRecord(ids[0],ids[1]);
  if(record)record[target.getAttribute("data-crf")]=target.value;
 },true);
 window.addEventListener("click",function(event){
  var faithCategory=event.target&&event.target.closest&&event.target.closest(".rhythm-faith-option label");
  if(faithCategory){var faithCheckbox=faithCategory.querySelector('input[data-rfield$="|areas"][value="faith"]');if(faithCheckbox&&event.target!==faithCheckbox&&faithCheckbox.checked){event.preventDefault();event.stopImmediatePropagation();var faithForm=faithCategory.closest(".rhythm-area-checks"),faithDialog=faithForm&&faithForm.querySelector(".rhythm-faith-flyout");if(faithDialog&&!faithDialog.open){var field=faithCheckbox.getAttribute("data-rfield").split("|"),existing=faithRecord(field[0]+"|"+field[1]);faithPickerPrevious={owner:field[0]+"|"+field[1],checked:true,faithGroup:existing&&existing.faithGroup||null,areas:(existing&&existing.areas||[]).slice()};tendShowModal(faithDialog);}return;}}
  var faithCancel=event.target&&event.target.closest&&event.target.closest("[data-faith-cancel]");
  if(faithCancel){var cancelDialog=faithCancel.closest(".rhythm-faith-flyout");if(cancelDialog&&cancelDialog.open){cancelFaithPicker(cancelDialog);cancelDialog.close();}return;}
  var marriageDailyAction=event.target&&event.target.closest&&event.target.closest("[data-marriage-open-people],[data-marriage-daily-settings-open],[data-marriage-daily-settings-save],[data-marriage-daily-settings-cancel],[data-marriage-prompt-next],[data-marriage-daily-undo]");
  if(marriageDailyAction){
   event.preventDefault();event.stopImmediatePropagation();
   if(marriageDailyAction.hasAttribute("data-marriage-open-people")){tab="people";currentArea=null;currentPerson=null;render();return;}
   if(marriageDailyAction.hasAttribute("data-marriage-daily-undo")){
    var undoRhythmId=marriageDailyAction.getAttribute("data-marriage-daily-undo"),undoToday=marriageDateKey(todayStr()),beforeUndo=S.events.length;
    S.events=S.events.filter(function(item){return !(item&&item.rhythmId===undoRhythmId&&Number.isFinite(Number(item.ts))&&marriageDateKey(new Date(Number(item.ts)))===undoToday);});
    if(S.events.length===beforeUndo){flash("Today's connection is no longer available to undo");return;}
    save();render();flash("Today's connection undone");return;
   }
   if(marriageDailyAction.hasAttribute("data-marriage-daily-settings-open")){
    marriageDailySettingsDraft={goal:marriageGoalSelection(),focus:marriageWeeklyFocus().enabled};
    render();requestAnimationFrame(function(){var title=document.getElementById("marriage-daily-settings-title");if(title)title.focus({preventScroll:true});});return;
   }
   if(marriageDailyAction.hasAttribute("data-marriage-daily-settings-cancel")){
    marriageDailySettingsDraft=null;render();requestAnimationFrame(function(){var trigger=document.querySelector("[data-marriage-daily-settings-open]");if(trigger)trigger.focus({preventScroll:true});});return;
   }
   if(marriageDailyAction.hasAttribute("data-marriage-daily-settings-save")){marriageSaveDailySettings(marriageDailyAction);return;}
   var spouse=marriageSelectedSpouse(),selection=marriagePromptSelection(todayStr(),spouse&&spouse.id);
   marriageSavePromptSelection(selection.categoryId,true);return;
  }
  var marriageHealthNav=event.target&&event.target.closest&&event.target.closest("[data-marriage-health-nav]");
  if(marriageHealthNav){
   event.preventDefault();event.stopImmediatePropagation();
   var destination=marriageHealthNav.getAttribute("data-marriage-health-nav"),tab=destination==="foundations"?"foundations":destination==="today"?"today":"rhythms";
   if(MARRIAGE_PAGE_TABS.some(function(item){return item[0]===tab;})&&marriageActiveTab!==tab){marriageActiveTab=tab;render();}
   requestAnimationFrame(function(){var heading=document.getElementById(tab==="foundations"?"marriage-foundations-heading":tab==="today"?"marriage-tab-today":"marriage-rhythms-heading");if(heading&&typeof faithScrollToHeading==="function")faithScrollToHeading(heading);});
   return;
  }
  var foundationBack=event.target&&event.target.closest&&event.target.closest("[data-marriage-foundation-back]");
  if(foundationBack){
   event.preventDefault();event.stopImmediatePropagation();marriageFoundationDetailId=null;render();
   requestAnimationFrame(function(){var heading=document.getElementById("marriage-foundations-heading");if(heading)heading.focus({preventScroll:true});});
   return;
  }
  var foundationButton=event.target&&event.target.closest&&event.target.closest("[data-marriage-foundation]");
  if(foundationButton){
   event.preventDefault();event.stopImmediatePropagation();marriageFoundationDetailId=foundationButton.getAttribute("data-marriage-foundation");marriageActiveTab="foundations";render();
   requestAnimationFrame(function(){var heading=document.getElementById("marriage-foundation-detail-title");if(heading)heading.focus({preventScroll:true});});
   return;
  }
  var rhythmBack=event.target&&event.target.closest&&event.target.closest("[data-marriage-rhythm-back]");
  if(rhythmBack){
   event.preventDefault();event.stopImmediatePropagation();marriageRhythmDetailId=null;render();
   requestAnimationFrame(function(){var heading=document.getElementById("marriage-rhythms-heading");if(heading)heading.focus({preventScroll:true});});
   return;
  }
  var rhythmDetails=event.target&&event.target.closest&&event.target.closest("[data-marriage-rhythm-details]");
  if(rhythmDetails){
   event.preventDefault();event.stopImmediatePropagation();marriageRhythmDetailId=rhythmDetails.getAttribute("data-marriage-rhythm-details");marriageActiveTab="rhythms";render();
   requestAnimationFrame(function(){var heading=document.getElementById("marriage-rhythm-detail-title");if(heading)heading.focus({preventScroll:true});});
   return;
  }
  var customRhythmDetails=event.target&&event.target.closest&&event.target.closest("[data-marriage-custom-rhythm]");
  if(customRhythmDetails){
   event.preventDefault();event.stopImmediatePropagation();marriageRhythmDetailId="custom:"+customRhythmDetails.getAttribute("data-marriage-custom-rhythm");marriageActiveTab="rhythms";render();
   requestAnimationFrame(function(){var heading=document.getElementById("marriage-custom-rhythm-title");if(heading)heading.focus({preventScroll:true});});
   return;
  }
  var marriageTab=event.target&&event.target.closest&&event.target.closest('[role="tab"][data-marriage-tab]');
  if(marriageTab){
   event.preventDefault();event.stopImmediatePropagation();
   var nextTab=marriageTab.getAttribute("data-marriage-tab");
   if(MARRIAGE_PAGE_TABS.some(function(item){return item[0]===nextTab;})){marriageActiveTab=nextTab;render();var focusedTab=document.querySelector('[role="tab"][data-marriage-tab="'+nextTab+'"]');if(focusedTab)focusedTab.focus({preventScroll:true});}
   return;
  }
  var emptyExplore=event.target&&event.target.closest&&event.target.closest("[data-marriage-explore-empty]");
  if(emptyExplore){
   event.preventDefault();event.stopImmediatePropagation();marriageActiveTab="rhythms";render();
   requestAnimationFrame(function(){var heading=document.getElementById("marriage-rhythms-heading");if(heading&&typeof faithScrollToHeading==="function")faithScrollToHeading(heading);});
   return;
  }
  var badge=event.target&&event.target.closest&&event.target.closest("[data-rhythm-area-badge]");
  if(badge){
   event.preventDefault();event.stopImmediatePropagation();
   var area=badge.getAttribute("data-rhythm-area-badge");
   currentPerson=null;openDetail=null;editingId=null;editingEvent=null;currentArea=area;tab="today";
   if(area==="health"&&badge.getAttribute("data-rhythm-health-subcategory")&&typeof fitnessShowTab==="function"){var section=badge.getAttribute("data-rhythm-health-subcategory");fitnessCurrentTab=section==="strength"?"strength":section==="cardio"?"cardio":"weight";if(section==="strength")fitnessStrengthSubtab="rhythms";else if(section==="cardio")fitnessCardioSubtab="rhythms";else fitnessWeightSubtab="rhythms";}
   if(area==="faith"){
    var group=badge.getAttribute("data-rhythm-faith-subcategory")||"Prayer";
     faithMainView="practices";faithMainViewInitialized=true;faithShowAllRhythms=false;faithConfig().selectedGroup=group;faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs[group]="rhythms";
   }
   render();if(area==="faith")requestAnimationFrame(function(){requestAnimationFrame(function(){faithScrollToHeading(document.getElementById("faithPracticeTitle"));});});else window.scrollTo(0,0);return;
  }
  var marriageAction=event.target&&event.target.closest&&event.target.closest("[data-marriage-suggestions-open],[data-marriage-suggestions-close],[data-marriage-suggestion-add],[data-marriage-include],[data-marriage-link-select],[data-marriage-link-candidate],[data-marriage-link-confirm],[data-marriage-link-back],[data-marriage-template-unlink]");
  if(marriageAction){
   event.preventDefault();event.stopImmediatePropagation();
   if(marriageAction.hasAttribute("data-marriage-suggestions-open")){marriageSuggestionsTrigger=marriageAction.getAttribute("data-marriage-suggestions-open")||"rhythm-list";marriageSuggestionsOpen=true;marriageLinkTemplateId=null;marriageLinkCandidateId=null;render();requestAnimationFrame(function(){var heading=document.getElementById("marriage-rhythm-suggestions-title");if(heading)heading.focus({preventScroll:true});});return;}
   if(marriageAction.hasAttribute("data-marriage-suggestions-close")){
    var suggestionEditor=areaRhythmDraft&&areaRhythmDraft.record.id==="draft"&&areaRhythmDraft.record.sourceTemplateId;
    if(suggestionEditor){areaRhythmDraft=null;areaRhythmEditId=null;}
    marriageSuggestionsOpen=false;marriageLinkTemplateId=null;marriageLinkCandidateId=null;
    var returned=!!(suggestionEditor&&window.tendFinishRhythmEdit&&window.tendFinishRhythmEdit());
    if(!returned)render();
    requestAnimationFrame(function(){var trigger=document.querySelector('[data-marriage-suggestions-open="'+marriageSuggestionsTrigger+'"]')||document.querySelector("[data-marriage-suggestions-open]");if(trigger)trigger.focus({preventScroll:true});});
    return;
   }
   if(marriageAction.hasAttribute("data-marriage-suggestion-add")){
    var templateId=marriageAction.getAttribute("data-marriage-suggestion-add"),draft=marriageTemplateDraft(templateId);
    if(!draft){flash("This suggestion is already linked");return;}
    if(window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(marriageAction);
    marriageActiveTab="rhythms";marriageRhythmDetailId=null;marriageSuggestionsOpen=false;marriageLinkTemplateId=null;marriageLinkCandidateId=null;areaRhythmDraft={areaId:"marriage",record:draft};areaRhythmEditId=null;render();requestAnimationFrame(function(){var title=document.querySelector('[data-area-rhythm-form="marriage|draft"] [data-crf="text"]');if(title)title.focus({preventScroll:true});});return;
   }
   if(marriageAction.hasAttribute("data-marriage-include")){
    var includeTemplate=marriageAction.getAttribute("data-marriage-include");
    if(!marriageIncludeExistingRhythm(includeTemplate)){flash("This Rhythm can no longer be included in Marriage");return;}
    render();flash("Existing Rhythm included in Marriage");return;
   }
   if(marriageAction.hasAttribute("data-marriage-link-select")){marriageLinkTemplateId=marriageAction.getAttribute("data-marriage-link-select");marriageLinkCandidateId=null;render();requestAnimationFrame(function(){var title=document.getElementById("marriage-link-panel-title");if(title)title.focus({preventScroll:true});});return;}
   if(marriageAction.hasAttribute("data-marriage-link-back")){var backTemplate=marriageAction.getAttribute("data-marriage-link-back");marriageLinkTemplateId=null;marriageLinkCandidateId=null;render();requestAnimationFrame(function(){var trigger=document.querySelector('[data-marriage-link-select="'+backTemplate+'"]');if(trigger)trigger.focus({preventScroll:true});});return;}
   if(marriageAction.hasAttribute("data-marriage-link-candidate")){var candidateKey=marriageAction.getAttribute("data-marriage-link-candidate").split("|");marriageLinkTemplateId=candidateKey[0];marriageLinkCandidateId=candidateKey[1];render();requestAnimationFrame(function(){var confirm=document.querySelector('[data-marriage-link-confirm="'+candidateKey[0]+'|'+candidateKey[1]+'"]');if(confirm)confirm.focus({preventScroll:true});});return;}
   if(marriageAction.hasAttribute("data-marriage-link-confirm")){
    var linkKey=marriageAction.getAttribute("data-marriage-link-confirm").split("|"),review=marriageAction.closest(".marriage-link-review"),show=review&&review.querySelector("[data-marriage-link-show]");
    if(!marriageLinkExistingRhythm(linkKey[0],linkKey[1],!!(show&&show.checked))){flash("This rhythm can no longer be linked");return;}
    marriageLinkTemplateId=null;marriageLinkCandidateId=null;render();flash("Rhythm linked to suggestion");return;
   }
   if(marriageAction.hasAttribute("data-marriage-template-unlink")){
    var unlinkId=marriageAction.getAttribute("data-marriage-template-unlink");
    if(marriageUnlinkTemplate(unlinkId)){marriageLinkTemplateId=null;marriageLinkCandidateId=null;render();flash("Suggestion unlinked; rhythm and history unchanged");}
    return;
   }
  }
  var button=event.target&&event.target.closest&&event.target.closest("[data-area-rhythm-new],[data-area-rhythm-edit],[data-area-rhythm-save],[data-area-rhythm-cancel],[data-area-rhythm-delete]");
  if(button){
   event.preventDefault();event.stopImmediatePropagation();
   if(button.hasAttribute("data-area-rhythm-new")){var area=button.getAttribute("data-area-rhythm-new"),record=newAreaRhythm(area),faithGroup=button.getAttribute("data-faith-group");if(area==="faith"&&FAITH_SUBCATEGORIES.indexOf(faithGroup)>=0)record.faithGroup=faithGroup;if(area==="marriage"&&window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(button);areaRhythmDraft={areaId:area,record:record};areaRhythmEditId=null;render();return;}
   if(button.hasAttribute("data-area-rhythm-edit")){if(window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(button);var edit=button.getAttribute("data-area-rhythm-edit").split("|"),source=categoryRhythmRecord(edit[0],edit[1]);if(source&&tab!=="me"&&currentArea!==edit[0]){tab="areas";currentArea=edit[0];currentPerson=null;}areaRhythmEditId=edit[1];areaRhythmDraft=source?{areaId:edit[0],record:JSON.parse(JSON.stringify(source))}:null;render();return;}
   if(button.hasAttribute("data-area-rhythm-cancel")){var cancelledTemplate=areaRhythmDraft&&areaRhythmDraft.record.sourceTemplateId;areaRhythmDraft=null;areaRhythmEditId=null;marriageSuggestionsOpen=false;if(cancelledTemplate)marriageActiveTab="rhythms";if(!window.tendFinishRhythmEdit||!window.tendFinishRhythmEdit())render();if(cancelledTemplate)requestAnimationFrame(function(){var trigger=document.querySelector('[data-marriage-suggestion-add="'+cancelledTemplate+'"]')||document.querySelector('[data-marriage-rhythm-details="'+cancelledTemplate+'"]');if(trigger)trigger.focus({preventScroll:true});});return;}
   if(button.hasAttribute("data-area-rhythm-save")){var key=button.getAttribute("data-area-rhythm-save").split("|");saveAreaRhythm(key[0],key[1],button.closest("[data-area-rhythm-form]"));return;}
   if(button.hasAttribute("data-area-rhythm-delete")){var remove=button.getAttribute("data-area-rhythm-delete").split("|"),entry=categoryRhythmRecord(remove[0],remove[1]);if(entry){S.areaRhythms=S.areaRhythms.filter(function(record){return record!==entry;});areaRhythmDraft=null;areaRhythmEditId=null;save();render();flash("Rhythm removed");}return;}
  }
  var openEdit=event.target&&event.target.closest&&event.target.closest("[data-rhyedit]");
  if(openEdit&&currentArea&&CATEGORY_AREA_SET[currentArea]){
   if(window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(openEdit);
   var owner=findRhythmOwner(openEdit.getAttribute("data-rhyedit"));
   if(owner){editRhythmId=owner.record.id;rhythmEditDraft=null;profileTabs[owner.person.id]="rhythms";currentPerson=owner.person.id;currentArea=null;tab="people";render();event.preventDefault();event.stopImmediatePropagation();}
  }
 },true);
 window.addEventListener("keydown",function(event){
  var current=event.target&&event.target.closest&&event.target.closest('[role="tab"][data-marriage-tab]');
  if(!current)return;
  var tabs=Array.prototype.slice.call(document.querySelectorAll('[role="tab"][data-marriage-tab]')),index=tabs.indexOf(current),nextIndex;
  if(index<0||!tabs.length)return;
  if(event.key==="ArrowRight")nextIndex=(index+1)%tabs.length;
  else if(event.key==="ArrowLeft")nextIndex=(index+tabs.length-1)%tabs.length;
  else if(event.key==="Home")nextIndex=0;
  else if(event.key==="End")nextIndex=tabs.length-1;
  else return;
  event.preventDefault();tabs[nextIndex].click();
 },true);
 window.addEventListener("cancel",function(event){var dialog=event.target;if(dialog&&dialog.matches&&dialog.matches(".marriage-rhythm-suggestions-dialog")){event.preventDefault();event.stopImmediatePropagation();var close=dialog.querySelector("[data-marriage-suggestions-close]");if(close)close.click();return;}if(dialog&&dialog.matches&&dialog.matches(".rhythm-faith-flyout"))cancelFaithPicker(dialog);},true);
 var baseSearchMatches=window.tendSearchMatches;
 window.tendSearchMatches=function(query){
  var results=baseSearchMatches(query),q=tendSearchText(query);
  (S.areaRhythms||[]).forEach(function(record){
   var areas=areaIds(record),labels=areas.map(function(id){return categoryLabel(id,record);});
   if(tendSearchText([record.text,record.description].concat(labels).join(" ")).indexOf(q)!==-1){
    results.rhythms.push({id:record.id,title:record.text||"Untitled rhythm",subtitle:labels.join(", ")||"Rhythm",tag:labels[0]||"Rhythm",area:areas[0]});
   }
  });
  results.rhythms.forEach(function(result){
   if(result.person){var record=(result.person.rhythms||[]).find(function(item){return item.id===result.id;});if(record){var tags=areaIds(record).map(function(id){return categoryLabel(id,record);});if(tags.length)result.tag=tags.join(", ");}}
  });
  return results;
 };
 window.addEventListener("click",function(event){
  var result=event.target&&event.target.closest&&event.target.closest('[data-search-result="rhythms"][data-search-area]');
  if(!result||result.hasAttribute("data-search-person")||result.hasAttribute("data-search-faith"))return;
  var area=result.getAttribute("data-search-area");if(!CATEGORY_AREA_SET[area])return;
  event.preventDefault();event.stopImmediatePropagation();currentArea=area;tab="today";render();
 },true);
 var styles=document.createElement("style");
 styles.textContent=".rhythm-area-checks{display:flex;gap:7px;flex-wrap:wrap;border:0;padding:6px 0;margin:4px 0}.rhythm-area-checks legend{font-size:12px;color:var(--ink-soft);margin-bottom:4px}.rhythm-area-checks label{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:999px;padding:5px 9px;font-size:12px;cursor:pointer}.rhythm-area-checks input{accent-color:var(--forest)}.rhythm-area-option{position:relative}.rhythm-faith-flyout{position:absolute;z-index:5;top:calc(100% + 5px);left:0;display:grid;gap:3px;min-width:175px;padding:9px;border:1px solid var(--line);border-radius:12px;background:var(--canvas);box-shadow:0 8px 24px rgba(0,0,0,.14)}.rhythm-faith-flyout[hidden]{display:none}.rhythm-faith-flyout-title{padding:2px 6px 5px;color:var(--ink-soft);font-size:11px;font-weight:600}.rhythm-area-checks .rhythm-faith-flyout label{border:0;border-radius:7px;padding:5px 6px;white-space:nowrap}.rhythm-area-icon,.rhythm-area-badge{display:inline-flex;align-items:center;justify-content:center}.rhythm-area-icon svg{width:16px;height:16px}.rhythm-area-badges{display:inline-flex;gap:4px;vertical-align:middle;margin-left:6px}.rhythm-area-badge{position:relative;width:23px;height:23px;padding:3px;border:1px solid var(--line);border-radius:50%;background:var(--canvas);color:var(--ink-soft);cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease}.rhythm-area-badge:hover,.rhythm-area-badge:focus-visible{border-color:var(--forest);background:var(--mist);color:var(--forest);outline:2px solid transparent}.rhythm-area-badge:after{position:absolute;z-index:20;left:50%;bottom:calc(100% + 7px);width:max-content;max-width:220px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--ink);color:#fff;content:attr(data-category-tooltip);font:500 11px/1.3 var(--sans);white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,3px);transition:opacity .12s ease,transform .12s ease}.rhythm-area-badge:hover:after,.rhythm-area-badge:focus-visible:after{opacity:1;transform:translate(-50%,0)}.rhythm-area-badge svg{width:14px;height:14px}.rhythm-person-badge,.rhythm-owner-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:999px;background:var(--canvas);padding:2px 7px;font-size:11px;color:var(--ink-soft);vertical-align:middle}.rhythm-person-badge .avatar{display:inline-flex}.category-rhythms-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.category-rhythm-edit{display:grid;gap:10px}.category-rhythm-edit .careplan-field{display:grid;gap:5px}.category-rhythm-edit .careplan-field>input,.category-rhythm-edit .careplan-field>select,.category-rhythm-edit textarea{font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--canvas)}.category-rhythm-edit textarea{min-height:60px}.category-rhythm-edit .careplan-actions{display:flex;gap:8px}.category-rhythms .rhythm-person-badge{flex:0 0 auto}";
 styles.textContent+=".rhythm-faith-flyout label{width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;transition:background-color .16s ease,border-color .16s ease,color .16s ease,transform .16s ease}.rhythm-faith-flyout label:hover,.rhythm-faith-flyout label:focus-within{background:rgba(28,145,103,.11);border-color:rgba(28,145,103,.16);color:var(--forest);transform:translateX(2px)}.rhythm-faith-flyout label:has(input:checked){background:rgba(28,145,103,.09);color:var(--forest);font-weight:600}.rhythm-faith-flyout input{accent-color:var(--forest)}.rhythm-faith-flyout-title{display:flex;align-items:center;gap:7px}.rhythm-faith-flyout-title:before{content:'';width:18px;height:2px;border-radius:2px;background:var(--forest);opacity:.65}";
 styles.textContent+=".rhythm-faith-option{display:grid;grid-template-columns:max-content auto;align-items:center;gap:6px 10px;flex:0 0 100%;box-sizing:border-box}.rhythm-faith-picker{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border:1px solid var(--line);border-radius:999px;background:var(--canvas);color:var(--forest);font:inherit;font-size:12px;cursor:pointer}.rhythm-faith-picker:hover,.rhythm-faith-picker:focus-visible{border-color:var(--forest);outline:2px solid transparent}.rhythm-faith-picker[hidden]{display:none}.rhythm-faith-option>.rhythm-faith-flyout:not([open]){display:none}.rhythm-faith-option>.rhythm-faith-flyout[open]{position:fixed;inset:0;z-index:1000;display:grid;align-content:start;gap:10px;box-sizing:border-box;width:min(420px,calc(100vw - 32px));max-width:none;max-height:min(80vh,640px);height:max-content;overflow:auto;margin:auto;padding:18px;border:1px solid var(--line);border-radius:20px;background:var(--canvas);color:var(--ink);box-shadow:0 16px 60px #17251e40}.rhythm-faith-option>.rhythm-faith-flyout::backdrop{background:#17251e66}.rhythm-faith-flyout h3{margin:0;font-size:18px;font-weight:600}.rhythm-faith-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.rhythm-area-checks .rhythm-faith-options label{display:flex;align-items:center;justify-content:flex-start;gap:7px;width:100%;min-width:0;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:10px;background:var(--canvas);font-size:12.5px;white-space:nowrap}.rhythm-area-checks .rhythm-faith-options label:hover,.rhythm-area-checks .rhythm-faith-options label:focus-within{background:rgba(28,145,103,.11);border-color:rgba(28,145,103,.3);transform:none}.rhythm-area-checks .rhythm-faith-options label:has(input:checked){background:rgba(28,145,103,.11);border-color:rgba(28,145,103,.3);color:var(--forest);font-weight:600}.rhythm-faith-options input{margin:0;accent-color:var(--forest)}.rhythm-faith-flyout>[data-faith-close]{justify-self:start}@media(max-width:520px){.rhythm-faith-option>.rhythm-faith-flyout[open]{padding:16px}.rhythm-faith-options{grid-template-columns:1fr}.rhythm-area-checks .rhythm-faith-options label{font-size:12px;padding:7px 9px}}";
 styles.textContent+=".rhythm-area-checks .rhythm-faith-option{display:block;flex:0 0 auto}";
 styles.textContent+=".rhythm-area-checks{display:grid;grid-template-columns:repeat(3,max-content);justify-content:center;align-items:center;gap:8px 12px}.rhythm-area-checks legend{grid-column:1/-1}.rhythm-area-checks .rhythm-faith-option{flex:none}@media(max-width:520px){.rhythm-area-checks{grid-template-columns:repeat(2,max-content);gap:8px}}";
 styles.textContent+=".profile-editor-dialog .rhyedit{border:0;background:transparent;padding:0}.profile-editor-dialog .rhythm-area-checks{box-sizing:border-box;width:100%;margin:8px 0 4px;padding:12px;border:1px solid var(--line);border-radius:12px}";
 styles.textContent+=".profile-editor-dialog .rhythm-area-checks{grid-template-columns:repeat(3,minmax(0,1fr));justify-content:stretch;align-items:stretch}.profile-editor-dialog .rhythm-area-option,.profile-editor-dialog .rhythm-area-option>label{box-sizing:border-box;width:100%;min-width:0}.profile-editor-dialog .rhythm-area-option>label{min-height:34px}@media(max-width:520px){.profile-editor-dialog .rhythm-area-checks{grid-template-columns:repeat(2,minmax(0,1fr))}}";
 styles.textContent+=".marriage-rhythm-suggestions-dialog .profile-editor-body{width:min(640px,calc(100vw - 32px));max-height:min(82vh,760px);overflow:auto;box-sizing:border-box;gap:12px}.marriage-suggestions-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.marriage-suggestions-header h2,.marriage-suggestions-header p,.marriage-suggestion-row h3,.marriage-suggestion-row p{margin:0}.marriage-suggestions-header p{margin-top:4px;color:var(--ink-soft);font-size:13px}.marriage-suggestion-list{display:grid;gap:0}.marriage-suggestion-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;padding:13px 0;border-top:1px solid var(--line)}.marriage-suggestion-copy{min-width:0}.marriage-suggestion-row h3{font-size:14px}.marriage-suggestion-row p{margin-top:4px;color:var(--ink-soft);font-size:12.5px;line-height:1.45}.marriage-suggestion-meta{margin-top:6px;color:var(--ink-faint);font-size:11.5px}.marriage-suggestion-actions{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-end;gap:6px}.marriage-suggestion-linked{overflow-wrap:anywhere}.marriage-link-panel{grid-column:1/-1;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--mist)}.marriage-link-panel h4{margin:0 0 8px;font-size:13px}.marriage-link-panel ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}.marriage-link-panel li{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;padding:7px 0;border-top:1px solid var(--line)}.marriage-link-panel li>span{display:grid;min-width:0;overflow-wrap:anywhere}.marriage-link-panel small{color:var(--ink-soft)}.marriage-link-review{display:grid;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.marriage-link-review p{margin:0}.marriage-link-review label{display:flex;align-items:flex-start;gap:7px;font-size:12.5px}.marriage-link-review input{margin-top:3px;accent-color:var(--forest)}.marriage-suggestions-empty{display:grid;justify-items:start;gap:8px;margin-top:12px}.marriage-suggestions-empty p{margin:0;color:var(--ink-soft);font-size:13px}@media(max-width:520px){.marriage-suggestion-row{grid-template-columns:minmax(0,1fr)}.marriage-suggestion-actions{justify-content:flex-start}.marriage-link-panel li{align-items:flex-start;flex-wrap:wrap}.marriage-rhythm-suggestions-dialog .profile-editor-body{padding:16px}}";
 document.head.appendChild(styles);
})();

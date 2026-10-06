"use strict";
/* ============ views: dashboard, area pages, people ============ */
function renderNav(){
 var an=el("areaNav");if(an)an.innerHTML=AREA_IDS.map(function(id){return '<button data-areanav="'+id+'" class="'+(navKind()==="area"&&currentArea===id?"active":"")+'"><span class="nav-ic">'+(AREA_ICONS[id]||"")+'</span><span>'+S.areas[id].name+'</span></button>';}).join("");
 var un=el("utilNav");if(un){var secondary=[["careplan","Plan"],["offload","Offload"],["settings","Settings"]],secondaryActive=secondary.some(function(item){return tab===item[0]&&navKind()!=="area";});un.innerHTML='<div class="utility-primary"><button type="button" data-utilnav="today" class="utility-primary-button'+(tab==="today"&&navKind()!=="area"?" active":"")+'"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg></span><span>Dashboard</span></button>'+(typeof focusNavButtonHTML==="function"?focusNavButtonHTML():'')+'<button type="button" data-utilnav="people" class="utility-primary-button'+(tab==="people"&&navKind()!=="area"?" active":"")+'"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20zM16 5a3.5 3.5 0 0 0 0 6.8M18 14a5.5 5.5 0 0 1 3.5 5.2V20h-3"/></svg></span><span>People</span></button></div><label class="utility-search"><span class="utility-search-icon" aria-hidden="true">⌕</span><input type="search" id="tendSearch" placeholder="Search Tend..." autocomplete="off" aria-label="Search people, rhythms, prayers, and sparks" aria-controls="tendSearchResults" aria-expanded="false"><button type="button" class="utility-search-clear" data-search-clear aria-label="Clear search" hidden>×</button><div class="utility-search-results" id="tendSearchResults" role="region" aria-label="Search results" hidden></div></label><details class="utility-more"><summary'+(secondaryActive?' class="active"':'')+' aria-label="More tools">More <span aria-hidden="true">⌄</span></summary><div class="utility-menu">'+secondary.map(function(p){return '<button type="button" data-utilnav="'+p[0]+'" class="'+(tab===p[0]&&navKind()!=="area"?"active":"")+'">'+p[1]+'</button>';}).join("")+'</div></details>';}
}
function tendSearchText(value){return String(value||"").toLocaleLowerCase();}
function tendSearchMatches(query){var q=tendSearchText(query),people=S.people||[],results={people:[],rhythms:[],prayers:[],sparks:[]};if(!q)return results;
 people.forEach(function(person){if(tendSearchText(person.name).includes(q))results.people.push({id:person.id,title:person.name,subtitle:person.relation||"",tag:"Person",person:person});});
 function rhythmMatch(record,person){if(tendSearchText([record.text,record.description,person&&person.name,record.faithGroup].join(" ")).includes(q))results.rhythms.push({id:record.id,title:record.text||"Untitled rhythm",subtitle:person?person.name:(record.faithGroup||"Faith"),tag:record.category==="faith"||record.faithGroup?(record.faithGroup||"Faith"):(S.areas[person&&person.area]?S.areas[person.area].name:"Rhythm"),person:person,faith:!person});}
 people.forEach(function(person){(person.rhythms||[]).forEach(function(record){rhythmMatch(record,person);});});
 (S.rhythms||[]).forEach(function(record){if(record.category==="faith"||record.faithGroup)rhythmMatch(record,null);});
 (S.prayers||[]).forEach(function(record){var person=people.find(function(candidate){return candidate.id===record.personId;}),category=record.category||"Prayer";if(tendSearchText([record.text,record.details,category,person&&person.name].join(" ")).includes(q))results.prayers.push({id:record.id,title:record.text||"Untitled prayer",subtitle:person?person.name:category,tag:category,person:person,faith:true});});
 people.forEach(function(person){(person.sparks||[]).forEach(function(record){if(tendSearchText([record.text,person.name].join(" ")).includes(q))results.sparks.push({id:record.id,title:record.text||"Untitled spark",subtitle:person.name,tag:"Spark",person:person});});});
 return results;
}
function tendSearchResultsHTML(query){var groups=tendSearchMatches(query),order=[["people","People"],["rhythms","Rhythms"],["prayers","Prayers"],["sparks","Sparks"]],out="",total=0;order.forEach(function(group){var results=groups[group[0]];if(!results.length)return;total+=results.length;out+='<section class="search-result-group"><h3>'+group[1]+' <span>'+results.length+'</span></h3>'+results.slice(0,6).map(function(result){return '<button type="button" class="search-result" data-search-result="'+group[0]+'" data-search-id="'+esc(result.id)+'"'+(result.person?' data-search-person="'+esc(result.person.id)+'"':'')+(result.area?' data-search-area="'+esc(result.area)+'"':'')+(result.faith?' data-search-faith="1"':'')+'><span class="search-result-main"><strong>'+esc(result.title)+'</strong><small>'+esc(result.subtitle)+'</small></span><span class="search-result-tag">'+esc(result.tag)+'</span></button>';}).join("")+(results.length>6?'<div class="search-result-more">+'+(results.length-6)+' more</div>':'')+'</section>';});return total?out:'<div class="search-empty">No matches for “'+esc(query)+'”.</div>';}
function tendSearchUpdate(){var input=el("tendSearch"),results=el("tendSearchResults"),clear=document.querySelector("[data-search-clear]");if(!input||!results)return;var query=input.value.trim(),open=!!query;results.innerHTML=open?tendSearchResultsHTML(query):"";results.hidden=!open;input.setAttribute("aria-expanded",String(open));if(clear)clear.hidden=!query;}
document.addEventListener("input",function(event){if(event.target&&event.target.id==="tendSearch")tendSearchUpdate();});
document.addEventListener("keydown",function(event){if(event.target&&event.target.id==="tendSearch"&&event.key==="Escape"){event.target.value="";tendSearchUpdate();event.target.blur();}});
document.addEventListener("click",function(event){var button=event.target.closest("[data-search-clear],[data-search-result]");if(!button)return;if(button.matches("[data-search-clear]")){var input=el("tendSearch");if(input){input.value="";tendSearchUpdate();input.focus();}return;}var type=button.getAttribute("data-search-result"),personId=button.getAttribute("data-search-person");if(type==="people"&&personId){profileTabs[personId]="rhythms";openPersonTab(personId);}else if(personId){profileTabs[personId]=type==="rhythms"?"rhythms":type==="sparks"?"sparks":"prayer";openPersonTab(personId);}else if(button.hasAttribute("data-search-faith")){currentArea="faith";tab="today";faithConfig().selectedGroup="Sabbath";render();}var input=el("tendSearch");if(input){input.value="";tendSearchUpdate();}event.stopImmediatePropagation();});
function navKind(){return currentArea?"area":"tab";}
function render(){renderNav();var v=el("view");
 if(navKind()==="area"&&currentArea)v.innerHTML=currentArea==="faith"&&typeof renderFaithPage==="function"?renderFaithPage():renderArea(currentArea);
 else if(tab==="today")v.innerHTML=renderToday();
 else if(tab==="people")v.innerHTML=renderPeople();
 else if(tab==="prayer")v.innerHTML=renderPrayer();
 else if(tab==="careplan")v.innerHTML=renderCarePlan();
 else if(tab==="echo")v.innerHTML=renderEcho();
 else if(tab==="offload")v.innerHTML=renderOffload();
 else if(tab==="settings")v.innerHTML=renderSettings();
 if(typeof bind==="function")bind();
 var activePanel=currentPerson&&v.querySelector('.profile-tab-panel:not([hidden])'),editorDialog=activePanel&&activePanel.querySelector('dialog[data-profile-editor],dialog[data-editor-modal]');if(!editorDialog)editorDialog=v.querySelector('dialog[data-editor-modal]');if(editorDialog){if(!editorDialog.open)editorDialog.showModal();editorDialog.addEventListener("cancel",function(event){var cancel=editorDialog.querySelector("[data-editor-cancel]");if(cancel){event.preventDefault();cancel.click();}});}
 if(tab==="today"&&!currentArea&&el("calStrip")&&typeof loadCalendars==="function")loadCalendars();if(tab==="today"&&!currentArea&&typeof loadNowWeather==="function")loadNowWeather();}
/* ============ overall meter ============ */
function overallScore(){return avg(AREA_IDS.map(areaScore))||50;}
function areaMenuHTML(){
 return '<div class="menu-grid">'+AREA_IDS.map(function(id){
  var v=areaScore(id),c=scoreClass(v);
  return '<button class="menu-area" data-areago="'+id+'"><span class="sm-dot '+c+'"></span><span class="menu-area-icon" aria-hidden="true">'+(AREA_ICONS[id]||"")+'</span><span class="ma-name">'+S.areas[id].name+'</span><span class="ma-score '+c+'">'+v+'</span></button>';
 }).join("")+'</div>';}
function renderToday(){
 var d=new Date(),h=d.getHours();
 var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];
 var greet=h<12?"Good morning":(h<18?"Good afternoon":"Good evening");
 var ov=overallScore(),oc=scoreClass(ov);
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>'+greet+', Steve</h2><span class="hint">'+days[d.getDay()]+", "+mos[d.getMonth()]+" "+d.getDate()+'</span></div>';
 out+='<div class="card overall-card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:18px;font-weight:500">Overall health</h3><span class="ov-score '+oc+'">'+ov+'</span></div><div class="bar-ov"><i class="ov-marker" style="left:'+ov+'%"></i></div>'+'<div class="meta" style="margin-top:6px"><span class="statusword '+oc+'">'+scoreLabel(ov)+'</span> · averaged across 6 areas</div>'+areaMenuHTML()+'</div>';
 out+='<div class="sectiontitle calendar-sectiontitle"><h2>Calendar Events</h2></div><div class="card calendar-card"><div id="calStrip"><div class="empty">'+((S.calendars||[]).length?"Loading calendars...":"No calendars connected - add one in Settings.")+'</div></div></div>';
 out+=planHTML();
 out+=freeMomentHTML();
 out+=upcomingHTML();
 out+=renderChecklists();
 return out;}
/* ============ time-aware routine plan ============ */
var DEFAULT_DAY_BLOCKS=[
 {id:"early",name:"Early morning",start:"05:30"},{id:"morning",name:"Midday focus",start:"09:00"},
 {id:"lunch",name:"Lunch",start:"11:30"},{id:"afternoon",name:"Afternoon",start:"13:30"},
 {id:"commute",name:"Way home",start:"16:30"},{id:"evening",name:"Evening",start:"18:00"},
 {id:"bedtime",name:"Bedtime",start:"21:30"}];
function dayTimeMinutes(time){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||""))return NaN;var parts=time.split(":");return +parts[0]*60+(+parts[1]);}
function validateDayBlocks(blocks){
 if(!Array.isArray(blocks)||blocks.length!==7)return "Keep all seven time sections.";
 for(var i=0;i<blocks.length;i++){
  if(blocks[i].id!==DEFAULT_DAY_BLOCKS[i].id||!String(blocks[i].name||"").trim())return "Give every section a name.";
  var minutes=dayTimeMinutes(blocks[i].start);
  if(!Number.isFinite(minutes))return "Enter a valid start time for every section.";
  if(i&&minutes<=dayTimeMinutes(blocks[i-1].start))return "Start times must move forward through the day. The last section continues overnight.";
 }
 return "";
}
function dayBlocks(){var saved=S.settings&&S.settings.dayBlocks;return !validateDayBlocks(saved)?saved:DEFAULT_DAY_BLOCKS;}
function dayBlockAt(date){var minute=date.getHours()*60+date.getMinutes(),blocks=dayBlocks(),id=blocks[blocks.length-1].id;blocks.forEach(function(b){if(minute>=dayTimeMinutes(b.start))id=b.id;});return id;}
function dayTimeLabel(time){var parts=time.split(":"),hour=+parts[0];return (hour%12||12)+":"+parts[1]+(hour<12?"am":"pm");}
function planBlocksDef(){var blocks=dayBlocks(),current=dayBlockAt(new Date());return blocks.map(function(b,i){return {id:b.id,name:b.name,range:dayTimeLabel(b.start)+" – "+dayTimeLabel(blocks[(i+1)%blocks.length].start),cur:b.id===current};});}
function dayBlockSettingsHTML(){return '<div class="card" style="margin-bottom:14px"><div class="subhead">Daily time sections</div><p class="settings-help">Rename your sections and choose when each starts. Each ends when the next begins; the last continues overnight. These settings apply throughout Tend.</p><div class="day-settings-grid"><span>Name</span><span>Starts</span><span>Ends</span>'+dayBlocks().map(function(b,i,blocks){return '<input aria-label="Section '+(i+1)+' name" data-block-name="'+b.id+'" value="'+esc(b.name)+'"><input type="time" aria-label="Section '+(i+1)+' start time" data-block-start="'+b.id+'" value="'+b.start+'"><span data-block-end="'+b.id+'">'+dayTimeLabel(blocks[(i+1)%blocks.length].start)+(i===blocks.length-1?' (next day)':'')+'</span>';}).join('')+'</div><p id="dayBlocksError" role="alert" class="day-settings-error"></p><button class="btn" id="saveDayBlocks">Save time sections</button></div>';}
function rhythmScheduledToday(r,date){
 date=date||new Date();
 if(rhythmDaysSince(r)===0)return false;
 if(r.freq==="custom"&&(r.every||r.unit)&&typeof recOccursOn==="function")return recOccursOn(recNormRule(r),todayStrFromTs(date.getTime()));
 if(r.freq==="custom")return date.getDay()===(r.customDow||0)&&(r.customType!=="monthly"||Math.ceil(date.getDate()/7)===(r.customOrd||1));
 return scheduleDayMatches(r,date)&&(r.freq==="daily"||rhythmDaysSince(r)>=rhythmPeriod(r));
}
function planPills(it){var person=S.people.find(function(p){return p.id===it.personId;});var label=it.rhythm||it.rkey?"Rhythm":it.spark||it.sparky?"Spark":it.taskId?"Task":"Suggestion";var area=it.area||(it.log&&it.log.area);return (person?((it.rhythm||it.rkey)?'<button class="prayer-person person-rhythm-link" data-personrhythms="'+person.id+'" aria-label="Open '+esc(person.name)+' rhythms">'+personAvatar(person,24)+esc(person.name)+'</button>':'<span class="prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>'):'')+'<span class="plan-kind">'+label+'</span>'+(!person&&area&&S.areas[area]?'<span class="plan-kind">'+esc(S.areas[area].name)+'</span>':'');}
function genItem(label,sub,area,type,title){return {label:label,sub:sub,log:{area:area,type:type,title:title||label}};}
function taskItem(t){return {label:t.text,sub:"task · "+(S.areas[t.areaId]?S.areas[t.areaId].name:""),log:{area:t.areaId,type:"note",title:"Task: "+t.text},taskId:t.id};}
function dashboardRhythmEligible(r){
 var days=rhythmDaysSince(r),period=rhythmPeriod(r);if(days===0)return false;
 if(r.freq==="custom"){var date=new Date();return date.getDay()===(r.customDow||0)&&(r.customType!=="monthly"||Math.ceil(date.getDate()/7)===(r.customOrd||1));}
 return days>=Math.max(1,period-(period<=14?1:0))&&(days===999||days>=period||scheduleDayMatches(r));
}
function prioritizePlanItems(items){
 var ranked=items.slice().sort(function(a,b){
  return Number(!!b.scheduled)-Number(!!a.scheduled)||Number(!!b.calendarDay)-Number(!!a.calendarDay)||Number(!!b.rhythm)-Number(!!a.rhythm)||(a.period||Infinity)-(b.period||Infinity)||(b.waitDays||0)-(a.waitDays||0);
 });
 var visible=[],more=[],people={};
 ranked.forEach(function(it){
  if(visible.length<3&&(!it.personId||!people[it.personId])){visible.push(it);if(it.personId)people[it.personId]=true;}
  else more.push(it);
 });
 return {visible:visible,more:more};
}
function planCandidates(bid,curBid){
 var out=[];
 S.tasks.forEach(function(t){if(!t.done&&((t.tod&&t.tod!=="anytime")?t.tod===bid:bid===curBid))out.push(taskItem(t));});
 S.people.forEach(function(person){
  (person.rhythms||[]).forEach(function(r){var blk=(r.tod&&r.tod!=="anytime")?r.tod:curBid;if(blk!==bid||!dashboardRhythmEligible(r))return;out.push({scheduled:!!r.tod&&r.tod!=="anytime",calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),rhythm:person.id+"|"+r.id,personId:person.id,label:r.text,sub:rhythmFreqLabel(r)+" \u00b7 "+rhythmDueTxt(r)});});
  openSparks(person).forEach(function(spark){if(!spark.by||!sparkLive(spark))return;if((sparkBlock(spark)||curBid)!==bid)return;out.push({spark:person.id+"|"+spark.id,personId:person.id,label:spark.text,sub:(spark.time?fmtHM12(spark.time)+" \u00b7 ":"")+sparkDueTxt(spark)});});
 });
 return out;
}
var planOpenState={};var planViewState=null;
function planBlockCard(b,curId,isCur,isAllDay){
 isAllDay=!!isAllDay;
 var items=planCandidates(b.id,curId);
 var queue=prioritizePlanItems(items);
 var block=dayBlocks().find(function(item){return item.id===b.id;}),blockStart=block?block.start:"";
 function itemHTML(it){
  var btn=it.rhythm?rhyDoneBtn(it.rhythm):(it.spark?'<button class="btn mini sparkbtn" data-sparkdo="'+it.spark+'">Do it</button>':'<button class="btn mini" data-plandone="'+encodeURIComponent(JSON.stringify(it.log))+'" data-taskid="'+(it.taskId||"")+'">Done</button>');
  return '<div class="planitem"><div class="pi-main"><div class="pi-label">'+(it.spark?'<span style="color:#B8912F">\u2726 </span>':'')+esc(it.label)+'<span class="plan-pills">'+planPills(it)+'</span></div><div class="pi-sub">'+esc(it.sub)+'</div></div>'+btn+'</div>';
 }
 var body=queue.visible.length?queue.visible.map(itemHTML).join(""):'<div class="empty">Nothing queued - all tended.</div>';
 if(isCur)return '<div id="plan-'+b.id+'" data-plan-block="'+b.id+'" class="card planblock current"><div style="margin-top:8px">'+body+'</div></div>';
 var hasSavedOpen=Object.prototype.hasOwnProperty.call(planOpenState,b.id),isOpen=isAllDay?(hasSavedOpen?planOpenState[b.id]:queue.visible.length>0):true;
 return '<details id="plan-'+b.id+'" data-plan-block="'+b.id+'" class="card planblock"'+(isOpen?' open':'')+'><summary><span class="plan-summary-copy"><span>'+esc(b.name)+'</span><span class="plan-range">'+b.range+' \u00b7 '+queue.visible.length+' item'+(queue.visible.length===1?'':'s')+'</span></span><span class="plan-weather-slot" data-plan-weather="'+esc(blockStart)+'">'+(typeof planWeatherHTML==="function"?planWeatherHTML(blockStart):"")+'</span></summary><div style="margin-top:8px">'+body+'</div></details>';
}
function planHTML(){
 var blocks=planBlocksDef();
 var current=blocks.filter(function(x){return x.cur;})[0]||blocks[0],curId=current.id;
 var currentCount=prioritizePlanItems(planCandidates(curId,curId)).visible.length;
 var out='<div class="sectiontitle current-plan-heading"><div class="current-plan-title"><h2>Now</h2><div class="current-plan-meta"><span class="plan-time-badge">'+esc(current.name)+'</span><span class="current-plan-range">'+current.range+' \u00b7 '+currentCount+' item'+(currentCount===1?'':'s')+'</span></div></div><div id="nowWeather">'+(typeof nowWeatherHTML==="function"?nowWeatherHTML():"")+'</div></div>';
 out+=planBlockCard(current,curId,true);
 out+='<nav class="day-jumps" aria-label="Other time blocks">'+blocks.filter(function(b){return b.id!==curId;}).map(function(b){return '<button class="btn mini ghost'+(planViewState===b.id?' active':'')+'" data-planview="'+b.id+'">'+b.name+(planViewState===b.id?' \u00b7 Hide':'')+'</button>';}).join('')+'<button class="btn mini ghost day-jump-all-day'+(planViewState==="allday"?' active':'')+'" data-planview="allday">All Day</button></nav>';
 var sel=blocks.filter(function(b){return b.id===planViewState&&b.id!==curId;})[0];
 if(planViewState==="allday"||planViewState===null)out+=planBlockCard({id:'allday',name:'All Day',range:'Any time today'},curId,false,true);
 else if(sel)out+=planBlockCard(sel,curId,false,false);
 return out;}
function upcomingDates(now){
 var today=new Date(now||Date.now());today.setHours(0,0,0,0);var rows=[];
 function add(label,month,day,attrs){
  if(!(month>=1&&month<=12&&day>=1&&day<=31))return;
  var date=new Date(today.getFullYear(),month-1,day);if(date<today)date=new Date(today.getFullYear()+1,month-1,day);
  var days=Math.round((date-today)/86400000);if(days<=30)rows.push({label:label,days:days,attrs:attrs||""});
 }
 S.people.forEach(function(p){[['birthday','Birthday'],['anniversary','Anniversary']].forEach(function(pair){var v=String(p[pair[0]]||'').split('-');if(v.length===3)add(p.name+' · '+pair[1],+v[1],+v[2],' data-openperson="'+esc(p.id)+'"');});});
 S.keyDates.forEach(function(k){var person=S.people.find(function(p){return p.id===k.personId;});add((person?person.name+' · ':'')+k.label,+k.month,+k.day,' data-upitem="'+esc(k.id)+'"');});
 majorHolidays.forEach(function(h){if(!holidayEnabled(h.id))return;[today.getFullYear(),today.getFullYear()+1].forEach(function(y){var date=h.date(y),days=Math.round((date-today)/86400000);if(days>=0&&days<=30)rows.push({label:h.name,days:days,attrs:''});});});
 return rows.sort(function(a,b){return a.days-b.days||a.label.localeCompare(b.label);});
}
function upcomingHTML(){
 var rows=upcomingDates();
 return '<div class="sectiontitle"><h2>Coming up</h2><span class="hint">next 30 days</span></div><div class="uprow">'+(rows.length?rows.map(function(x){return '<div class="upitem"'+x.attrs+'><span class="updays '+(x.days<=7?'soon':x.days<=21?'mid':'far')+'">'+(x.days===0?'today':'in '+x.days+'d')+'</span><span class="uplabel">'+esc(x.label)+'</span></div>';}).join(''):'<div class="empty">No personal dates or selected holidays in the next 30 days.</div>')+'</div>';
}
function nextDateLine(pid){var kds=S.keyDates.filter(function(k){return k.personId===pid;});if(!kds.length)return "";var best=null;kds.forEach(function(k){var d=daysUntil(k);if(best===null||d<best.d)best={k:k,d:d};});if(!best)return "";return '<div class="pf-next">'+esc(best.k.label)+' \u00b7 '+(best.d===0?"TODAY":"in "+best.d+" days")+'</div>';}
function personHealthColor(score){
 if(score===null||score===undefined)return '#CBD5D0';
 // Match the dashboard gradient stops: coral at 0, amber at 48, green at 100.
 var value=Math.max(0,Math.min(100,score));
 var start=value<=48?[255,90,69]:[255,193,51];
 var end=value<=48?[255,193,51]:[18,183,106];
 var fraction=value<=48?value/48:(value-48)/52;
 return "rgb("+start.map(function(channel,i){return Math.round(channel+(end[i]-channel)*fraction);}).join(",")+")";
}
function personHealthMeter(score,name,solid){
 var value=Math.max(0,Math.min(100,Number(score)||0));
 return '<div class="bar-ov person-health-bar'+(solid?' solid':'')+'" role="meter" aria-label="'+esc(name)+' tending health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+value+'" aria-valuetext="'+value+' out of 100: '+esc(scoreLabel(value))+'">'+(solid?'<span class="person-health-fill" style="width:'+value+'%;background:'+personHealthColor(value)+'" aria-hidden="true"></span>':'<i class="ov-marker" style="left:clamp(10px, '+value+'%, calc(100% - 10px))" aria-hidden="true"></i>')+'</div>';
}
function renderPeople(){
 var HINT='rhythms, sparks, prayers - tending the people you love';
 if(currentPerson)return '<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div>'+personProfile(currentPerson);
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>People</h2><span class="hint">'+HINT+'</span></div><div class="grid">';
 S.people.forEach(function(p){
  var sc=personScore(p),c=scoreClass(sc);
  var ci=personConnInfo(p);
  var prayers=S.prayers.filter(function(x){return x.personId===p.id&&!x.answered&&!x.archived;}).length;
  out+='<div class="card person-card" data-openperson="'+p.id+'" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px;min-width:0">'+personAvatar(p,42)+'<h3 style="margin:0">'+esc(p.name)+'</h3></div><span class="person-card-score">'+sc+'</span></div>'+personHealthMeter(sc,p.name,true)+'<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div><div class="meta">'+esc(p.relation||"")+' \u00b7 '+(ci.last?("connected "+when(ci.last.ts)):"no connections yet")+(prayers?" \u00b7 "+prayers+" prayer"+(prayers>1?"s":""):"")+'</div>'+nextDateLine(p)+personDateLines(p)+'</div>';
 });
 out+='</div>';
 return out;}
/* ============ person profile: rhythms + touch points ============ */
function sortedPersonRhythms(person){
 var order=dayBlocks().map(function(block){return block.id;});
 function timeRank(r){var index=order.indexOf(r.tod);return index<0?order.length:index;}
 return (person.rhythms||[]).slice().sort(function(a,b){return rhythmPeriod(a)-rhythmPeriod(b)||timeRank(a)-timeRank(b);});
}
function personRhythmScheduleHTML(r,idf){
 return '<div class="rhythm-schedule-grid"><label class="careplan-field">Frequency<select data-rfield="'+idf+'|freq">'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'"'+(r.freq===k?' selected':'')+'>'+FREQS[k].label+'</option>';}).join('')+'<option value="custom"'+(r.freq==='custom'?' selected':'')+'>Custom...</option></select></label><label class="careplan-field">Time of day<select data-rfield="'+idf+'|tod">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((r.tod||'anytime')===k?' selected':'')+'>'+esc(TODS[k])+'</option>';}).join('')+'</select></label><label class="careplan-field" data-schedule-day'+(scheduleHasWeekday(r.freq)?'':' hidden')+'>Day of week<select data-rfield="'+idf+'|scheduleDow">'+scheduleDayOptions(r.scheduleDow)+'</select></label></div>';
}
function rhythmRow(p,r){
 var sc=rhythmScore(r),c=scoreClass(sc);
 if(editRhythmId===r.id){
  if(!rhythmEditDraft||rhythmEditDraft.id!==r.id)rhythmEditDraft=JSON.parse(JSON.stringify(r));
  r=rhythmEditDraft;
  var idf=p.id+"|"+r.id;
  var out='<div class="rhyedit">';
  out+='<div class="addrow" style="margin-top:2px"><input data-rfield="'+idf+'|text" value="'+esc(r.text)+'" placeholder="What is the rhythm?"></div>';
  out+='<div class="addrow"><select data-rfield="'+idf+'|category" aria-label="Rhythm type"><option value="connection"'+((r.category||"connection")==="connection"?" selected":"")+'>Connection</option><option value="prayer"'+(r.category==="prayer"?" selected":"")+'>Prayer</option></select></div>';
  out+=personRhythmScheduleHTML(r,idf);
  if(r.freq==="custom"){
   out+='<div class="addrow"><select data-rfield="'+idf+'|customType"><option value="weekly"'+((r.customType||"weekly")==="weekly"?" selected":"")+'>Every week on</option><option value="monthly"'+(r.customType==="monthly"?" selected":"")+'>Monthly on the</option></select>';
   if(r.customType==="monthly")out+='<select data-rfield="'+idf+'|customOrd">'+ORDINALS.map(function(o,i){return '<option value="'+(i+1)+'"'+((r.customOrd||1)===(i+1)?" selected":"")+'>'+o+'</option>';}).join("")+'</select>';
   out+='<select data-rfield="'+idf+'|customDow">'+DOW.map(function(d,i){return '<option value="'+i+'"'+((r.customDow||0)===i?" selected":"")+'>'+d+'</option>';}).join("")+'</select></div>';
  }
  out+='<div class="addrow">';
  var du=durUnitOf(r),dv=durValOf(r);
  out+='<select data-rfield="'+idf+'|durUnit">'+Object.keys(DUR_UNITS).map(function(u){return '<option value="'+u+'"'+(du===u?" selected":"")+'>'+DUR_UNITS[u].label+'</option>';}).join("")+'</select>';
  out+='<select data-rfield="'+idf+'|durVal"><option value="0">- # -</option>'+Array.apply(null,{length:DUR_UNITS[du].max}).map(function(_,i){var n=i+1;return '<option value="'+n+'"'+(dv===n?" selected":"")+'>'+n+'</option>';}).join("")+'</select>';
  out+='</div><div class="addrow"><button class="btn mini" data-rhyeditsave="'+idf+'">Save</button><button class="btn mini ghost" data-rhyeditcancel="1">Cancel</button><button class="btn mini danger" style="margin-left:auto" data-rhydel="'+idf+'">Delete</button></div>';
  out+='<div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 8px">Changes are saved when you select Save.</div></div>';
  return out;
 }
 var rl=rhythmLast(r),lastTxt=rl?("last tended "+when(rl.ts)):"not yet tended";
 var timingTxt=lastTxt+(rl&&rhythmDaysSince(r)!==0?" \u00B7 "+rhythmDueTxt(r):"");
 return '<div class="rhyrow"><span class="rhythm-health" title="Rhythm health"><span class="sm-dot '+c+'" aria-hidden="true"></span><span>'+sc+'%</span></span><div class="gr-main"><b>'+esc(r.text||"(unnamed rhythm)")+'</b>'+(r.category==="prayer"?' <span class="gr-person">prayer</span>':'')+'<div class="gr-meta">'+esc(rhythmFreqLabel(r))+(scheduleDayLabel(r)?" \u00B7 "+esc(scheduleDayLabel(r)):"")+(r.tod&&r.tod!=="anytime"?" \u00B7 "+esc(TODS[r.tod]):"")+(rhythmDurLabel(r)?" \u00B7 "+esc(rhythmDurLabel(r)):"")+" \u00B7 "+esc(timingTxt)+'</div></div>'+rhyDoneBtn(p.id+"|"+r.id)+'<button class="iconbtn rhythm-history-trigger" data-rhyhistory="'+p.id+'|'+r.id+'" title="View rhythm history" aria-label="View history for '+esc(r.text)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button><button class="iconbtn" data-rhyedit="'+r.id+'" title="edit">\u270E</button></div>';
}
function draftRow(p){
 var r=rhythmDraft,idf=p.id+"|draft";
 var out='<div class="rhyedit">';
 out+='<div class="addrow" style="margin-top:2px"><input data-rfield="'+idf+'|text" value="'+esc(r.text||"")+'" placeholder="What is the rhythm?"></div>';
 out+='<div class="addrow"><select data-rfield="'+idf+'|category" aria-label="Rhythm type"><option value="connection"'+((r.category||"connection")==="connection"?" selected":"")+'>Connection</option><option value="prayer"'+(r.category==="prayer"?" selected":"")+'>Prayer</option></select></div>';
 out+=personRhythmScheduleHTML(r,idf);
 if(r.freq==="custom"){
  out+='<div class="addrow"><select data-rfield="'+idf+'|customType"><option value="weekly"'+((r.customType||"weekly")==="weekly"?" selected":"")+'>Every week on</option><option value="monthly"'+(r.customType==="monthly"?" selected":"")+'>Monthly on the</option></select>';
  if(r.customType==="monthly")out+='<select data-rfield="'+idf+'|customOrd">'+ORDINALS.map(function(o,i){return '<option value="'+(i+1)+'"'+((r.customOrd||1)===(i+1)?" selected":"")+'>'+o+'</option>';}).join("")+'</select>';
  out+='<select data-rfield="'+idf+'|customDow">'+DOW.map(function(d,i){return '<option value="'+i+'"'+((r.customDow||0)===i?" selected":"")+'>'+d+'</option>';}).join("")+'</select></div>';
 }
 out+='<div class="addrow">';
 var du=durUnitOf(r),dv=durValOf(r);
 out+='<select data-rfield="'+idf+'|durUnit">'+Object.keys(DUR_UNITS).map(function(u){return '<option value="'+u+'"'+(du===u?" selected":"")+'>'+DUR_UNITS[u].label+'</option>';}).join("")+'</select>';
 out+='<select data-rfield="'+idf+'|durVal"><option value="0">- # -</option>'+Array.apply(null,{length:DUR_UNITS[du].max}).map(function(_,i){var n=i+1;return '<option value="'+n+'"'+(dv===n?" selected":"")+'>'+n+'</option>';}).join("")+'</select></div>';
 out+='<div class="hint" style="font-size:11px;color:var(--ink-faint);margin:4px 0 2px">Name it, then hit Save Rhythm below.</div></div>';
 return out;}
/* ---- action queue (Today with {name}) ---- */
function actDoneAdd(pid,id){window._actDone[pid]=window._actDone[pid]||[];if(window._actDone[pid].indexOf(id)<0)window._actDone[pid].push(id);}
function prayedThisWeek(pid){var d=new Date(),sod=new Date(d.getFullYear(),d.getMonth(),d.getDate()-d.getDay()),n=0;S.events.forEach(function(e){if(e.personId===pid&&(e.kind==="prayer"||e.type==="prayer")&&e.ts>=sod.getTime())n++;});return n;}
var profileTabs={},rippleIdeaOffsets={};
function todayRhythmEligible(r){var days=rhythmDaysSince(r);if(days===999)return true;if(days===0)return false;var period=rhythmPeriod(r);var window=Math.min(Math.ceil(period/2),7);if(days>=period)return true;if(!scheduleDayMatches(r))return false;return days>=Math.max(1,period-window);}
function rippleIdea(p){
 var common=["Send a thoughtful text","Make a quick call","Write a handwritten note","Ask how their day really went","Share a happy memory","Follow up on something they mentioned","Offer encouragement before a big day","Send a photo that made you think of them","Ask what would help this week","Thank them for something specific"];
 var byLanguage={qt:["Take a phone-free walk","Share coffee and conversation","Cook a meal together","Ask about the best part of their week","Listen to a favorite song together","Run an errand side by side","Plan a quiet lunch","Spend ten minutes catching up","Look through old photos together","Try something new together"],wa:["Text a specific encouragement","Write a short thank-you note","Say what you admire about them","Celebrate a recent effort","Leave an encouraging voice message","Recall something they handled well","Tell them why you value them","Write a note for a difficult day","Thank them for a small kindness","Ask about a win and celebrate it"],as:["Take a chore off their list","Offer to run an errand","Bring them a meal","Help prepare for tomorrow","Tidy a shared space","Offer a ride","Fix a small annoyance","Help with a task they have postponed","Bring their favorite drink","Ask what practical help they need"],gf:["Bring their favorite snack","Pick a small flower bouquet","Share a book they might love","Print a favorite photo","Bring a little treat from your day","Give a handwritten card","Make a small homemade gift","Replace something they have worn out","Choose something for their hobby","Leave a thoughtful surprise"],pt:["Offer a warm hug","Hold hands on a walk","Sit close while talking","Offer a shoulder rub","Greet them with affection","Share a quiet moment together","Offer a reassuring hand","Ask what kind of affection feels good","Pause for a goodbye hug","Cuddle while watching something together"]};
 var ideas=(byLanguage[p.loveLanguage]||common).slice();
 var last=S.events.filter(function(e){return e.personId===p.id&&e.kind!=="prayer";}).sort(function(a,b){return b.ts-a.ts;})[0];
 if(last&&last.title&&last.title.indexOf("Time with")!==0)ideas[9]='Follow up on \u201c'+last.title+'\u201d';
 return ideas[(Math.floor(Date.now()/864e5)+(rippleIdeaOffsets[p.id]||0))%ideas.length];
}
function collectionIcon(key){var paths={rhythms:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5 M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',connection:'<path d="m9.5 14.5-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0 M14.5 9.5l2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0 M8.5 15.5l7-7"/>',sparks:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',prayer:'<circle cx="14" cy="4.5" r="2.2"/><path d="m12 7.5-2.5 5.7a2.3 2.3 0 0 0 .6 2.7l3.2 2.6H6.2a1.8 1.8 0 0 0 0 3.5h7.3a3 3 0 0 0 2.1-5.1l-2.1-2.1 1.8-4.8h2.4a2 2 0 0 0 2-2V5.5 M14.5 7.2l2.5 1.4"/>',notes:'<path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6"/>'};return '<svg class="collection-icon" viewBox="0 0 24 24" aria-hidden="true">'+paths[key]+'</svg>';}
function noteKindLabel(kind){return kind==="encouragement"?"Encouragement":kind==="followup"?"Follow-up":"General";}
function noteKindOptions(selected){return [["general","General"],["encouragement","Encouragement"],["followup","Follow-up"]].map(function(option){return '<option value="'+option[0]+'"'+(option[0]===selected?' selected':'')+'>'+option[1]+'</option>';}).join("");}
function profileNoteTitleText(note){return String(note.title||note.text||"");}
function profileNoteDetails(note){return String(note.details||"");}
function notesChecklist(p,kind,title,addAction){
 var prayerNotes=kind==="prayernote";
 if(prayerNotes){
  var prayerItems=S.followups.filter(function(f){return f.personId===p.id&&f.kind==="prayernote";});
  function prayerRow(f){if(editingFollowupId===f.id)return '<li><dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="prayer-note-edit-title"><div class="profile-editor-body"><h3 id="prayer-note-edit-title">Edit Prayer Note</h3><label class="profile-note-type">Note<input id="followupEditText" aria-label="Edit prayer note" value="'+esc(f.text)+'"></label><div class="profile-editor-actions"><button class="btn mini" data-fusave="'+f.id+'">Save Note</button><button class="btn mini ghost" data-fucancel="1" data-editor-cancel>Cancel</button><button class="btn mini danger" data-fudel="'+f.id+'">Delete Note</button></div></div></dialog></li>';return '<li><input type="checkbox" class="cb" aria-label="'+esc((f.done?'Reopen: ':'Complete: ')+f.text)+'" data-fudone="'+f.id+'"'+(f.done?' checked':'')+'><span class="txt tend-type-title">'+esc(f.text)+'</span><button class="btn mini ghost" data-fuedit="'+f.id+'">Edit</button></li>';}
  var openPrayer=prayerItems.filter(function(f){return !f.done;}),donePrayer=prayerItems.filter(function(f){return f.done;});
  var prayerNoteAction=prayerNoteDraftOpenFor===p.id?'<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="prayer-note-add-title"><div class="profile-editor-body"><h3 id="prayer-note-add-title">Add Prayer Note</h3><label class="profile-note-type">Note<input id="noteNew-prayernote" aria-label="Prayer note" placeholder="What they asked you to pray for\u2026"></label><div class="profile-editor-actions"><button class="btn mini" data-noteadd="'+p.id+'" data-notekind="prayernote">Save Note</button><button class="btn mini ghost" data-prayernotecancel data-editor-cancel>Cancel</button></div></div></dialog>':'<div class="profile-add-action"><button class="btn mini ghost" data-prayernoteopen="'+p.id+'">+ Add prayer note</button></div>';
  return '<div class="notes-checklist"><div class="subhead">'+title+'</div><ul class="tasks">'+openPrayer.map(prayerRow).join('')+'</ul>'+prayerNoteAction+'<details class="notes-history"'+(donePrayer.some(function(f){return f.id===editingFollowupId;})?' open':'')+'><summary class="tend-type-section-heading">Show history ('+donePrayer.length+')</summary>'+(donePrayer.length?'<ul class="tasks">'+donePrayer.map(prayerRow).join('')+'</ul>':'<div class="empty">No completed prayer notes yet.</div>')+'</details></div>';
 }
 var items=S.followups.filter(function(f){return f.personId===p.id&&(f.kind||"followup")!=="prayernote";});
 function row(f){if(editingFollowupId===f.id)return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="note-editor-title"><div class="profile-editor-body"><h3 id="note-editor-title">Edit Note</h3><label class="profile-note-type">Type<select data-fu-kind>'+noteKindOptions(f.kind==="encouragement"?"encouragement":f.kind==="followup"?"followup":"general")+'</select></label><label class="profile-note-type">Title<input id="followupEditTitle" aria-label="Note title" value="'+esc(profileNoteTitleText(f))+'"></label><label class="profile-note-type">Details<textarea id="followupEditDetails" aria-label="Note details" placeholder="Add details (optional)">'+esc(profileNoteDetails(f))+'</textarea></label><div class="profile-editor-actions"><button class="btn mini" data-fusave="'+f.id+'">Save</button><button class="btn mini ghost" data-fucancel="1" data-editor-cancel>Cancel</button><button class="btn mini danger" data-fudel="'+f.id+'">Delete</button></div></div></dialog>';return '<div class="person-note-row'+(f.done?' is-done':'')+'"><div class="person-note-main"><span class="person-note-category">'+esc(noteKindLabel(f.kind))+'</span><strong class="tend-type-title">'+esc(profileNoteTitleText(f))+'</strong>'+(profileNoteDetails(f)?'<span class="person-note-details tend-type-description">'+esc(profileNoteDetails(f))+'</span>':'')+'</div><div class="person-note-actions">'+(f.done?'<button class="btn mini ghost" data-fudone="'+f.id+'" aria-label="Reopen note">Reopen</button>':'<button class="btn mini ghost" data-fudone="'+f.id+'" aria-label="Complete note">Done</button>')+'<button class="iconbtn" data-fuedit="'+f.id+'" aria-label="Edit note" title="Edit">✎</button><button class="iconbtn" data-fudel="'+f.id+'" aria-label="Delete note" title="Delete">×</button></div></div>';}
 var active=items.filter(function(f){return !f.done;}),done=items.filter(function(f){return f.done;});
 return (active.length?active.map(row).join(""):'<div class="empty">No notes yet - add something to remember.</div>')+(addAction||"")+'<details class="notes-history"'+(done.some(function(f){return f.id===editingFollowupId;})?' open':'')+'><summary class="tend-type-section-heading">Show history ('+done.length+')</summary>'+(done.length?done.map(row).join(''):'<div class="empty">No completed notes yet.</div>')+'</details>';
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
 var waitP=allP.filter(function(x){return prayerIsDue(x);}).sort(function(a,b){return (a.lastPrayed||"").localeCompare(b.lastPrayed||"")||(a.added||"").localeCompare(b.added||"");});
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
  return '<div class="actrow'+(dim?" done":"")+'"><span class="act-ic" style="background:'+personHealthColor(rhythmScore(r))+'"></span><div class="pi-main"><div class="pi-label tend-type-title">'+esc(r.text||"(unnamed rhythm)")+' <span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span></div>'+(r.description&&String(r.description).trim()?'<div class="pi-sub tend-type-description">'+esc(String(r.description).trim())+'</div>':'')+'<div class="pi-sub tend-type-meta">'+sub+'</div></div>'+(dim?'<span class="praycount tend-type-metric">Tended \u2713</span>':rhyDoneBtn(p.id+"|"+r.id))+'</div>';
 }
 visR.forEach(function(r){rows.push(rhyRowQ(r,false));});
 padR.forEach(function(r){rows.push(rhyRowQ(r,true));});
 visS.forEach(function(s){rows.push('<div class="actrow"><span class="act-ic" style="background:#B8912F"></span><div class="pi-main"><div class="pi-label tend-type-title">'+esc(s.text)+' <span class="pill spk">'+collectionIcon("sparks")+' Spark</span></div><div class="pi-sub tend-type-description">'+esc(sparkDueTxt(s))+(s.time?" \u00B7 "+esc(fmtHM12(s.time)):"")+'</div></div><button class="btn mini sparkbtn" data-sparkdo="'+p.id+'|'+s.id+'">Do it</button></div>');});
 padS.forEach(function(s){rows.push('<div class="actrow done"><span class="act-ic" style="background:#B8912F"></span><div class="pi-main"><div class="pi-label tend-type-title"><span style="color:#B8912F">\u2726 </span>'+esc(s.text)+'</div><div class="pi-sub tend-type-description">'+esc(sparkDueTxt(s))+'</div></div><span class="praycount tend-type-metric">Done \u2713</span></div>');});
 visP.forEach(function(x){var prayerInfo=x.focus?"from your prayer profile":(x.details?esc(x.details):"active prayer"),lastPrayed=x.focus?"":' · last prayed '+esc(prayerLastPrayedLabel(x));rows.push('<div class="actrow"><span class="act-ic" style="background:#5B7BA6"></span><div class="pi-main"><div class="pi-label tend-type-title">'+(x.focus?'Prayer focus: ':'')+esc(x.text)+' <span class="pill pry">'+collectionIcon("prayer")+' Prayer</span></div><div class="pi-sub tend-type-description">'+prayerInfo+lastPrayed+'</div></div><span class="praycount tend-type-metric">prayed '+(x.prayed||0)+'&times; total</span><button class="btn mini ghost" data-prayquick="'+p.id+'" data-prayref="'+(x.focus?"focus":x.id)+'">Pray</button></div>');});
 padP.forEach(function(x){rows.push('<div class="actrow done"><span class="act-ic" style="background:#5B7BA6"></span><div class="pi-main"><div class="pi-label tend-type-title">'+(x.focus?'Prayer focus: ':'')+esc(x.text)+'</div><div class="pi-sub tend-type-description">prayed today</div></div><span class="praycount tend-type-metric">Prayed \u2713</span></div>');});
 var out='<div class="card act today-with-person" style="margin-bottom:14px"><div class="qhead"><div class="subhead" style="margin:0">Today with '+first+'</div><span><span class="qpill'+(waiting?"":" clear")+'">'+(waiting?waiting+" in queue":"all tended \u2713")+'</span> <span class="hint">tend one, the next steps up</span></span></div>';
 if(rows.length)out+=rows.join("");
 else out+='<div class="empty" style="margin-top:8px">Nothing waiting - these next steps are all tended.</div>';
 out+='</div>';
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
 var evs=S.events.filter(function(e){return eventHasPerson(e,pid);}).sort(function(a,b){return b.ts-a.ts;});
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
 out+='<dialog class="ripple-dialog" id="rippleDialog" data-editor-modal aria-labelledby="rippleDialogTitle"><div class="box"><div class="subhead" id="rippleDialogTitle">'+(editingConn?'Edit Connection':'Add Connection')+'</div><p class="profile-tab-intro">Record a moment you shared with '+first+'.</p>';
 var rippleKind=edEv?(edEv.kind||edEv.type):"text";
 if(edEv&&!RIPPLE_TYPES[rippleKind])rippleKind="other";
 var rippleTime=edEv?new Date(edEv.ts||Date.now()):new Date();
 var rippleTimeValue=String(rippleTime.getHours()).padStart(2,"0")+":"+String(rippleTime.getMinutes()).padStart(2,"0");
 out+='<div class="ripple-fields"><label class="ripple-field">Type<select id="plogType">'+Object.keys(RIPPLE_TYPES).map(function(k){return '<option value="'+k+'"'+(rippleKind===k?' selected':'')+'>'+RIPPLE_TYPES[k]+'</option>';}).join("")+'</select></label><label class="ripple-field">Date<input type="date" id="momentDate" value="'+(edEv?fmtDate(edEv.ts||Date.now()):fmtDate(Date.now()))+'"></label><label class="ripple-field">Time<input type="time" id="momentTime" '+(edEv&&edEv.allDay?"disabled":"")+' value="'+rippleTimeValue+'"></label><label class="ripple-all-day"><input type="checkbox" id="momentAllDay" class="cb" '+(edEv&&edEv.allDay?"checked":"")+'> All Day</label></div>';
 out+='<div class="qlog" id="plogOtherRow" style="display:'+(rippleKind==="other"?'flex':'none')+'"><input id="plogOther" aria-label="Other ripple type" value="'+esc(rippleKind==="other"&&edEv?(edEv.rippleLabel||edEv.kind||""):"")+'" placeholder="What kind of moment?" class="ripple-other"></div>';
 out+='<div class="addrow" style="margin-top:8px"><input id="momentTitle" value="'+esc(edEv&&edEv.title&&edEv.title.indexOf("Time with")!==0?edEv.title:"")+'" placeholder="Title - e.g. Encouraging Message"></div>';
 out+='<div class="addrow" style="align-items:flex-start"><textarea id="momentNote" placeholder="Notes - what you want to remember..." style="min-height:70px;flex:1;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--canvas);font-size:15px">'+esc(edEv?(edEv.note||""):"")+'</textarea></div>';
 out+='<div class="profile-editor-actions"><button class="btn" data-psubmit="'+pid+'">Save</button><button class="btn ghost" data-peditcancel="1" data-editor-cancel>Cancel</button>'+(editingConn?'<button class="btn mini danger" style="margin-left:auto" data-connectiondelete="'+esc(editingConn)+'">Delete</button>':'')+'</div>';
 out+='</div></dialog>';
 }
 activeProfileTab=profileTabs[pid]||"rhythms";
 var connections=evs.filter(connectionEvent);
 var counts={rhythms:(p.rhythms||[]).length,connection:connections.length,sparks:openSparks(p).length,prayer:prayers.filter(function(x){return !x.answered&&!x.archived;}).length,notes:S.followups.filter(function(f){return f.personId===pid&&!f.done&&(f.kind||"followup")!=="prayernote";}).length};
 out+='<div class="profile-tabs" role="tablist" aria-label="Person collections">'+[["rhythms","Rhythms"],["connection","Connection"],["sparks","Sparks"],["prayer","Prayer"],["notes","Notes"]].map(function(item){return '<button role="tab" id="profile-tab-'+item[0]+'" aria-controls="profile-panel-'+item[0]+'" aria-selected="'+(activeProfileTab===item[0])+'" data-profiletab="'+item[0]+'">'+collectionIcon(item[0])+item[1]+' <span class="tab-count">'+counts[item[0]]+'</span></button>';}).join('')+'</div>';
 out+=profilePanelStart("connection")+'<div class="subhead">Recent connections</div><p class="profile-tab-intro">Shared moments add up and keep your connection strong.</p><p class="settings-help">'+esc(personCadenceLabel(p))+' target · 10 points lost each day after it is due.</p>';
 if(connections.length){out+=connections.slice(0,5).map(rippleLine).join("");if(connections.length>5)out+='<details class="recent-moments-more"><summary>Show all ('+connections.length+' connections)</summary><div>'+connections.slice(5).map(rippleLine).join("")+'</div></details>';}else out+='<div class="empty">No connections logged yet.</div>';
 out+='<div class="today-ripple"><button class="btn mini ghost" data-rippleopen="1">Log a connection</button><div class="nudge ripple-nudge"><span aria-hidden="true">&#128161;</span><span><b>'+esc(LL_LANGUAGES[p.loveLanguage]||"A moment of care")+':</b> <span id="rippleIdea">'+esc(rippleIdea(p))+'</span></span><button class="iconbtn" data-rippleidea="'+p.id+'" aria-label="Show another ripple idea" title="Another idea">&#8635;</button></div></div>';
 out+='</section>';
 out+=profilePanelStart("rhythms")+'<p class="profile-tab-intro">Recurring practices that help you stay connected.</p>';
 if((p.rhythms||[]).length){sortedPersonRhythms(p).forEach(function(r){out+=rhythmRow(p,r);});}
 else out+='<div class="empty">No rhythms yet - add the recurring things that keep this relationship tended.</div>';
 var dO=rhythmDraft&&rhythmDraft.pid===pid;
 if(dO)out+='<dialog class="profile-editor-dialog" data-profile-editor="rhythm" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Rhythm</h3>'+draftRow(p)+'<div class="profile-editor-actions"><button class="btn mini" data-rhyadd="'+pid+'">Save Rhythm</button><button class="btn mini ghost" data-rhycancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';
 else out+='<div class="profile-add-action"><button class="btn mini ghost" data-rhyadd="'+pid+'">+ Add rhythm</button></div>';
 out+='</section>';
 out+=profilePanelStart("sparks")+'<p class="profile-tab-intro">Low-pressure ideas to enjoy together.</p>';
 var sps=openSparks(p);
 if(sps.length){sps.forEach(function(s){
  out+='<div class="rhyrow"><span class="sm-dot" style="background:none;color:#B8912F;font-size:15px">\u2726</span><div class="gr-main"><b class="tend-type-title">'+esc(s.text)+'</b><div class="gr-meta tend-type-description">'+esc(sparkDueTxt(s))+(s.time?" \u00B7 "+esc(fmtHM12(s.time)):"")+(s.by?" \u00B7 "+esc(s.by):"")+'</div></div><button class="btn mini" data-sparkdo="'+pid+'|'+s.id+'">Do it</button><button class="iconbtn" data-sedit="'+s.id+'" title="edit">\u270E</button><button class="iconbtn" data-spdel="'+pid+'|'+s.id+'" title="remove">\u00D7</button></div>';
  if(editSparkId===s.id&&sparkEditDraft&&sparkEditDraft.id===s.id){out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="spark-editor-title"><div class="profile-editor-body"><h3 id="spark-editor-title">Edit Spark</h3><div class="addrow spark-draft"><input data-sfield="text" value="'+esc(sparkEditDraft.text)+'" placeholder="Spark text"><input type="date" data-sfield="by" value="'+esc(sparkEditDraft.by||"")+'" aria-label="Spark date" style="max-width:150px"><input type="time" data-sfield="time" value="'+esc(sparkEditDraft.time||"")+'" aria-label="Spark time" style="max-width:110px"><button class="btn mini ghost" data-scleardate="1">No date</button></div><p class="profile-tab-intro">With a date it lands on the dashboard; without one it waits in Free moment.</p><div class="profile-editor-actions"><button class="btn mini" data-sparkeditsave="'+s.id+'">Save Spark</button><button class="btn mini ghost" data-sparkeditcancel data-editor-cancel>Cancel</button><button class="btn mini danger" data-spdel="'+pid+'|'+s.id+'">Delete Spark</button></div></div></dialog>';}
 });}
 else out+='<div class="empty">No sparks yet - the fun, no-pressure "we should do this sometime" list.</div>';
 var addingSpark=sparkDraftOpenFor===pid;
 if(addingSpark)out+='<dialog class="profile-editor-dialog" data-profile-editor="spark" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Spark</h3><div class="addrow spark-draft"><input placeholder="Idea - a movie, a talk, a trip..." data-spnewtext="'+pid+'"><input type="date" data-spnewdate="'+pid+'" aria-label="Spark date" style="max-width:150px"><input type="time" data-spnewtime="'+pid+'" aria-label="Spark time" style="max-width:110px"></div><div class="profile-editor-actions"><button class="btn mini" data-spadd="'+pid+'">Save Spark</button><button class="btn mini ghost" data-sparkaddcancel="'+pid+'" data-editor-cancel>Cancel</button></div></div></dialog>';
 else out+='<div class="profile-add-action"><button class="btn mini ghost" data-sparkaddopen="'+pid+'">+ Add spark</button></div>';
 out+='</section>';
 var addingPrayer=window._personPrayerDraftFor===pid;
 out+=profilePanelStart("prayer")+'<p class="profile-tab-intro">Prayer requests to remember and bring before God.</p>'+prayerList(prayers,true);
 if(addingPrayer)out+='<dialog class="profile-editor-dialog" data-profile-editor="prayer" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Prayer</h3>'+personPrayerAddFields(pid)+'</div></dialog>';
 else out+='<div class="person-prayer-add"><div class="person-prayer-form-actions"><button class="btn mini ghost" data-personprayeropen="'+pid+'">+ Add prayer</button></div></div>';
 out+='<details class="prayer-notes"'+(prayerNoteDraftOpenFor===pid||S.followups.some(function(f){return f.personId===pid&&f.kind==="prayernote"&&f.id===editingFollowupId;})?' open':'')+'><summary class="tend-type-section-heading">Prayer notes</summary>';
 out+=notesChecklist(p,"prayernote",first+"&#39;s prayer context - what they asked me to pray for");
 out+='</details></section>';
 out+=profilePanelStart("notes")+'<p class="profile-tab-intro">Keep useful thoughts, encouragement, and follow-ups together.</p>';
 out+='<div class="person-notes">'+notesChecklist(p,null,null,noteDraftOpenFor===pid?"":'<div class="profile-add-action"><button class="btn mini ghost" data-profilenoteopen="'+pid+'">+ Add note</button></div>')+'</div>';
 if(noteDraftOpenFor===pid)out+='<dialog class="profile-editor-dialog" data-profile-editor="note" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Note</h3><label class="profile-note-type">Type<select id="profileNoteKind">'+noteKindOptions("general")+'</select></label><label class="profile-note-type">Title<input id="profileNoteTitle" placeholder="A short title"></label><label class="profile-note-type">Details<textarea id="profileNoteDetails" placeholder="Add details (optional)"></textarea></label><div class="profile-editor-actions"><button class="btn mini" data-profilenotesave="'+pid+'">Save Note</button><button class="btn mini ghost" data-profilenotecancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';
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
 m+='<button type="button" class="btn mini ghost" data-personkeydateopen="'+pid+'">+ Add key date</button>';
 if(personKeyDateDraftFor===pid)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="person-key-date-title"><div class="profile-editor-body"><h3 id="person-key-date-title">Add Key Date</h3><label class="profile-note-type">Name<input placeholder="Birthday, anniversary, or milestone" data-kdlabel="'+pid+'"></label><div class="profile-editor-actions"><button class="btn mini" data-kdadd="'+pid+'">Save Key Date</button><button type="button" class="btn mini ghost" data-personkeydatecancel data-editor-cancel>Cancel</button></div></div></dialog>';
 m+='<div class="field connection-cadence-field" style="margin-top:14px"><label for="personConnectionCadence">Connection cadence</label><select id="personConnectionCadence" aria-describedby="connectionCadenceHelp" data-pfield="connectCadence" data-pid="'+pid+'">'+[["daily","Daily"],["twicewk","Twice weekly"],["weekly","Weekly"],["biweekly","Every 2 weeks"],["monthly","Monthly"]].map(function(o){return '<option value="'+o[0]+'"'+((p.connectCadence||"weekly")===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select><p id="connectionCadenceHelp" class="settings-help">The Connection meter stays at 100% until this cadence is due, then loses 10 points per day without a new interaction. Tend a rhythm, complete a spark, or log a connection to reset it.</p></div>';
 m+='<div class="field"><label>Love language</label><select data-pfield="loveLanguage" data-pid="'+pid+'"><option value="">- not set -</option>'+Object.keys(LL_LANGUAGES).map(function(k){return '<option value="'+k+'"'+(ll===k?" selected":"")+'>'+LL_LANGUAGES[k]+'</option>';}).join("")+'</select></div>';
 m+='<div class="field"><label>Photo</label><div class="person-photo-controls">'+personAvatar(p,56)+'<input type="file" accept="image/*" data-pphoto="'+pid+'">'+(p.photo?'<button class="btn mini danger" data-pphorm="'+pid+'">Remove</button>':'')+'</div><div class="hint" style="font-size:11px;color:var(--ink-faint)">Crops to a circle for their card.</div></div>';
 m+='</div></div>';
 out+=m;
 return out;}
function renderChecklists(){
 if(!S.checklists||!S.checklists.length)return "";
 var out="";
 S.checklists.forEach(function(cl){
  var done=cl.items.filter(function(i){return i.done;}).length;
  out+='<details class="card cl-card" style="margin-bottom:12px;padding:16px 20px" id="cl-'+cl.id+'"'+(checklistDraftId===cl.id?' open':'')+'><summary style="cursor:pointer;font-weight:600;font-size:15px">'+esc(cl.title)+' <span style="font-weight:400;color:var(--ink-faint);font-size:12.5px">'+done+'/'+cl.items.length+'</span></summary><ul class="tasks" style="margin-top:10px">';
  cl.items.forEach(function(it){out+='<li class="'+(it.done?"done":"")+'"><input type="checkbox" class="cb" data-clitem="'+cl.id+'|'+it.id+'"'+(it.done?" checked":"")+'><span class="txt">'+esc(it.text)+'</span><button class="del" data-cldel="'+cl.id+'|'+it.id+'">\u00D7</button></li>';});
  out+='</ul><button type="button" class="btn mini ghost" data-clopen="'+cl.id+'">+ Add item</button></details>';
  if(checklistDraftId===cl.id)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="checklist-item-title"><div class="profile-editor-body"><h3 id="checklist-item-title">Add Checklist Item</h3><label class="profile-note-type">Item<input placeholder="What needs to be done?" data-clnew="'+cl.id+'"></label><div class="profile-editor-actions"><button class="btn mini" data-cladd="'+cl.id+'">Save Item</button><button class="btn mini ghost" data-clcancel data-editor-cancel>Cancel</button></div></div></dialog>';
 });
 return out;}
/* ============ rhythm done prompt + ripples ============ */
function rhyDoneBtn(key){var ids=String(key).split("|");return '<button type="button" class="btn mini" data-tend-open="person-rhythm" data-person-id="'+esc(ids[0])+'" data-rhythm-id="'+esc(ids[1]||"")+'" title="Record a moment of care">Tend</button>';}
function rippleLine(e){var t=(e.title&&e.title.indexOf("Time with")!==0)?e.title.replace(/^Prayer: /,""):"";var pill=e.rhythmId?' <span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>':((e.origin==="spark"||e.note==="Spark landed")?' <span class="pill spk">'+collectionIcon("sparks")+' Spark</span>':((e.kind==="prayer"||e.type==="prayer")?' <span class="pill pry">'+collectionIcon("prayer")+' Prayer</span>':((e.kind==="note"||e.type==="note")?' <span class="pill nte">'+collectionIcon("notes")+' Note</span>':'')));return '<div class="logline moment-row"><span class="when">'+when(e.ts)+(daysSince(e.ts)===0&&!e.allDay?" "+fmtHM(e.ts):"")+'</span><span class="kind">'+esc(typeLabel(e))+'</span><div class="gr-main">'+pill+(t?' <span class="txt tend-type-title">'+esc(t)+'</span>':'')+(e.note&&e.note!=="Spark landed"?'<div class="gr-meta tend-type-description">'+esc(e.note)+'</div>':'')+'</div><span class="entry-actions"><button class="iconbtn" data-evedit="'+e.id+'" title="edit">\u270E</button><button class="iconbtn" data-evdel="'+e.id+'" title="delete">\uD83D\uDDD1</button></span></div>';}
/* ============ free moment + spark chip ============ */
function sparkChip(p){var s=openSparks(p)[0];if(!s)return "";return '<div class="pf-next" style="color:#8A6D1F">\u2726 '+esc(s.text)+' \u00b7 '+esc(sparkDueTxt(s))+'</div>';}
function freeMomentHTML(){
 var cands=[];
 S.people.forEach(function(p){(p.rhythms||[]).forEach(function(r){var d=rhythmDaysSince(r);if((r.tod||"anytime")==="anytime"&&rhythmScheduledToday(r))cands.push({pri:10+(d===999?0:d),rkey:p.id+"|"+r.id,personId:p.id,label:r.text,sub:"rhythm \u00B7 "+rhythmDueTxt(r)});});});
 S.people.forEach(function(p){openSparks(p).forEach(function(s){if(sparkLive(s)&&!s.by)cands.push({pri:15,sparky:1,personId:p.id,label:s.text,sub:"No deadline yet",act:' data-openperson="'+p.id+'"',btn:"Open"});});});
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
 var kids=S.people.filter(function(p){return p.area===id;});
 var out='<div class="sectiontitle" style="margin-top:2px"><h2>'+S.areas[id].name+'</h2><span class="hint">'+scoreLabel(v)+'</span></div>';
 out+='<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:17px;font-weight:500">Health meter</h3><span class="score '+c+'">'+v+'</span></div>'+meterBar(v,c);
 if(kids.length)out+='<div class="people-row">'+kids.map(personChip).join("")+'</div>';
 out+='</div>';
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Tasks</div><ul class="tasks">';
 S.tasks.filter(function(t){return t.areaId===id;}).forEach(function(t){out+='<li class="'+(t.done?"done":"")+'"><input type="checkbox" class="cb" data-task="'+t.id+'"'+(t.done?" checked":"")+'><span class="txt">'+esc(t.text)+'</span><button class="del" data-taskdel="'+t.id+'">\u00D7</button></li>';});
 out+='</ul><div class="addrow"><input placeholder="Add a task..." data-tasknew="'+id+'"><button class="btn mini" data-taskadd="'+id+'">Add</button></div></div>';
 var areaActivityType=editingEvent?(editingEvent.type||editingEvent.kind||"quality"):"quality";
 if(areaActivityType==="inperson")areaActivityType="quality";
 out+='<div class="card" style="margin-bottom:14px" id="logformcard"><div class="subhead">'+(editingId?"Edit entry":"Log an activity")+'</div>'+
 '<div class="addrow" style="margin-top:0"><input type="date" id="logDate" value="'+(editingEvent?fmtDate(editingEvent.ts):fmtDate(Date.now()))+'"><select id="logPersonSel"><option value="">- person (optional) -</option>'+S.people.filter(function(p){return p.area===id;}).map(function(p){return '<option value="'+p.id+'"'+((editingEvent&&editingEvent.personId===p.id)?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select><select id="logTypeSel">'+Object.keys(RIPPLE_TYPES).map(function(t){return '<option value="'+t+'"'+(areaActivityType===t?" selected":"")+'>'+RIPPLE_TYPES[t]+'</option>';}).join("")+(RIPPLE_TYPES[areaActivityType]?'':'<option value="'+esc(areaActivityType)+'" selected>'+esc(typeLabel(editingEvent))+'</option>')+'</select></div>'+
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
var editingId=null,editingEvent=null,activityComposerOpen=false,taskDraftArea=null,checklistDraftId=null,echoDraftOpen=false,echoItemDraftId=null,ideaDraftOpen=false;
/* nav state */
var TODS={anytime:"Anytime",allday:"All day"};
DEFAULT_DAY_BLOCKS.forEach(function(block){Object.defineProperty(TODS,block.id,{enumerable:true,get:function(){return dayBlocks().find(function(b){return b.id===block.id;}).name;}});});
var LL_LANGUAGES={qt:"Quality Time",wa:"Words of Affirmation",as:"Acts of Service",gf:"Gifts",pt:"Physical Touch"};
var REL_OPTIONS=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Son-in-law","Daughter-in-law","Father","Mother","Brother","Sister","Friend","Mentor","Coworker"];
var LL_NUDGES={qt:"time together - a walk, an errand, a shared meal - speaks louder than a text.",wa:"a specific, spoken affirmation lands deeper than any gift. Send the text. Make the call.",as:"doing a chore or errand for them preaches louder than words.",gf:"small, thoughtful gifts say 'I was thinking of you' - keep a running list.",pt:"presence in person - a hug, a hand on the shoulder - matters most."};
function bdayInfo(b){if(!b)return null;var parts=String(b).split("-");if(parts.length<3)return null;var m=+parts[1],d=+parts[2];if(!m||!d)return null;var t=new Date();var today=new Date(t.getFullYear(),t.getMonth(),t.getDate());var next=new Date(t.getFullYear(),m-1,d);if(next<today)next=new Date(t.getFullYear()+1,m-1,d);var du=Math.round((next-today)/86400000);var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];return {label:mos[m-1]+" "+d,days:du};}
var editingConn=null,editingFollowupId=null;
var editSparkId=null,sparkEditDraft=null,sparkDraftOpenFor=null,noteDraftOpenFor=null,prayerNoteDraftOpenFor=null,personKeyDateDraftFor=null;
var editRhythmId=null, rhythmEditDraft=null;
var rhythmDraft=null;
var tab="today",openDetail=null,currentArea=null,currentPerson=null;
window._actDone={};window._psModalOpen=false;

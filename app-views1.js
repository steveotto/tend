"use strict";
/* ============ views: dashboard, area pages, people ============ */
function renderNav(){
 var an=el("areaNav");if(an)an.innerHTML=AREA_IDS.map(function(id){return '<button data-areanav="'+id+'" class="'+(navKind()==="area"&&currentArea===id?"active":"")+'"><span class="nav-ic">'+(AREA_ICONS[id]||"")+'</span><span>'+S.areas[id].name+'</span></button>';}).join("");
 var un=el("utilNav");if(un){var settingsActive=tab==="settings"||tab==="careplan"||tab==="offload";un.innerHTML='<div class="utility-primary"><button type="button" data-utilnav="today" class="utility-primary-button'+(tab==="today"&&navKind()!=="area"?" active":"")+'"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg></span><span>Today</span></button>'+(typeof focusNavButtonHTML==="function"?focusNavButtonHTML():'')+'<button type="button" data-utilnav="people" class="utility-primary-button'+(tab==="people"&&navKind()!=="area"?" active":"")+'"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20zM16 5a3.5 3.5 0 0 0 0 6.8M18 14a5.5 5.5 0 0 1 3.5 5.2V20h-3"/></svg></span><span>People</span></button><button type="button" data-utilnav="settings" class="utility-primary-button'+(settingsActive&&navKind()!=="area"?" active":"")+'" aria-label="More, settings"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></span><span>More</span></button></div><label class="utility-search"><span class="utility-search-icon" aria-hidden="true">⌕</span><input type="search" id="tendSearch" placeholder="Search Tend..." autocomplete="off" aria-label="Search people, rhythms, prayers, and sparks" aria-controls="tendSearchResults" aria-expanded="false"><button type="button" class="utility-search-clear" data-search-clear aria-label="Clear search" hidden>×</button><div class="utility-search-results" id="tendSearchResults" role="region" aria-label="Search results" hidden></div></label>';}
 var displayToggle=document.querySelector("[data-mobile-display-toggle]"),large=settings().mobileTextSize==="large";if(displayToggle){displayToggle.setAttribute("aria-pressed",String(large));displayToggle.setAttribute("aria-label","Switch to "+(large?"Normal":"Large")+" text");displayToggle.title="Switch to "+(large?"Normal":"Large")+" text";}
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
document.addEventListener("click",function(event){
 var toggle=event.target.closest&&event.target.closest("[data-mobile-search-toggle]");
 if(toggle){var open=!document.body.classList.contains("mobile-search-open");document.body.classList.toggle("mobile-search-open",open);toggle.setAttribute("aria-expanded",String(open));if(open){var input=el("tendSearch");if(input)requestAnimationFrame(function(){input.focus();});}else{var search=el("tendSearch");if(search){search.value="";tendSearchUpdate();}toggle.focus();}return;}
 toggle=event.target.closest&&event.target.closest("[data-mobile-display-toggle]");
 if(toggle){var next=settings().mobileTextSize==="large"?"normal":"large";settings().mobileTextSize=next;document.documentElement.setAttribute("data-mobile-text-size",next);save();toggle.setAttribute("aria-pressed",String(next==="large"));toggle.setAttribute("aria-label","Switch to "+(next==="large"?"Normal":"Large")+" text");toggle.title="Switch to "+(next==="large"?"Normal":"Large")+" text";flash(next==="large"?"Large text enabled":"Normal text enabled");}
});
document.addEventListener("input",function(event){if(event.target&&event.target.id==="tendSearch")tendSearchUpdate();});
document.addEventListener("keydown",function(event){if(event.target&&event.target.id==="tendSearch"&&event.key==="Escape"){event.target.value="";tendSearchUpdate();event.target.blur();document.body.classList.remove("mobile-search-open");var toggle=document.querySelector("[data-mobile-search-toggle]");if(toggle){toggle.setAttribute("aria-expanded","false");toggle.focus();}}});
document.addEventListener("click",function(event){var button=event.target.closest("[data-search-clear],[data-search-result]");if(!button)return;if(button.matches("[data-search-clear]")){var input=el("tendSearch");if(input){input.value="";tendSearchUpdate();input.focus();}return;}var type=button.getAttribute("data-search-result"),personId=button.getAttribute("data-search-person");if(type==="people"&&personId){profileTabs[personId]="rhythms";openPersonTab(personId);}else if(personId){profileTabs[personId]=type==="rhythms"?"rhythms":type==="sparks"?"sparks":"prayer";openPersonTab(personId);}else if(button.hasAttribute("data-search-faith")){currentArea="faith";tab="today";faithConfig().selectedGroup="Sabbath";render();}var input=el("tendSearch");if(input){input.value="";tendSearchUpdate();}document.body.classList.remove("mobile-search-open");var toggle=document.querySelector("[data-mobile-search-toggle]");if(toggle)toggle.setAttribute("aria-expanded","false");event.stopImmediatePropagation();});
function navKind(){return currentArea?"area":"tab";}
function sizeProfileTabPanels(root){
 var panels=Array.prototype.slice.call(root.querySelectorAll(".profile-tab-panel"));if(!panels.length)return;
 panels.forEach(function(panel){panel.style.minHeight="";panel.style.marginBottom="";});
 var active=panels.find(function(panel){return !panel.hidden;})||panels[0],width=active.getBoundingClientRect().width,maxHeight=0;
 panels.forEach(function(panel){
  var wasHidden=panel.hidden,style=panel.style,oldPosition=style.position,oldVisibility=style.visibility,oldDisplay=style.display,oldWidth=style.width,oldLeft=style.left,oldTop=style.top;
  panel.hidden=false;style.position="absolute";style.visibility="hidden";style.display="block";style.width=width+"px";style.left="-10000px";style.top="0";
  maxHeight=Math.max(maxHeight,panel.offsetHeight);
  panel.hidden=wasHidden;style.position=oldPosition;style.visibility=oldVisibility;style.display=oldDisplay;style.width=oldWidth;style.left=oldLeft;style.top=oldTop;
 });
 panels.forEach(function(panel){
  var wasHidden=panel.hidden,style=panel.style,oldPosition=style.position,oldVisibility=style.visibility,oldDisplay=style.display,oldWidth=style.width,oldLeft=style.left,oldTop=style.top;
  panel.hidden=false;style.position="absolute";style.visibility="hidden";style.display="block";style.width=width+"px";style.left="-10000px";style.top="0";
  var spare=Math.max(0,maxHeight-panel.offsetHeight);
  panel.hidden=wasHidden;style.position=oldPosition;style.visibility=oldVisibility;style.display=oldDisplay;style.width=oldWidth;style.left=oldLeft;style.top=oldTop;
  panel.style.marginBottom=spare+"px";
 });
}
window.addEventListener("resize",function(){if(tab==="people"&&currentPerson)sizeProfileTabPanels(el("view"));});
var tendRenderScrollSnapshot=null;
function tendRestorePageScroll(position){requestAnimationFrame(function(){window.scrollTo(position.x,position.y);});}
function tendShowModal(dialog){if(!dialog||dialog.open)return;var snapshot=tendRenderScrollSnapshot,position=snapshot?snapshot.position:{x:window.scrollX,y:window.scrollY};if(!snapshot||snapshot.preserve)dialog.addEventListener("close",function(){tendRestorePageScroll(position);},{once:true});dialog.showModal();if(!snapshot||snapshot.preserve)tendRestorePageScroll(position);}
function tendRenderRouteKey(){var faith=S&&S.faithConfig,group=faith&&faith.selectedGroup;return JSON.stringify([tab,currentArea,currentPerson,currentPerson&&profileTabs[currentPerson],openDetail,group,faith&&faith.prayerView,faith&&faith.practiceTabs&&faith.practiceTabs[group],typeof faithPrayerSession!=="undefined"&&faithPrayerSession?"session":null,typeof settingsTab!=="undefined"?settingsTab:null]);}
var tendLastRenderRouteKey=null;
function render(){var routeKey=tendRenderRouteKey(),preserve=routeKey===tendLastRenderRouteKey,scrollPosition={x:window.scrollX,y:window.scrollY},previousSnapshot=tendRenderScrollSnapshot;tendRenderScrollSnapshot={position:scrollPosition,preserve:preserve};renderNav();var v=el("view");
 if(navKind()==="area"&&currentArea)v.innerHTML=currentArea==="faith"&&typeof renderFaithPage==="function"?renderFaithPage():renderArea(currentArea);
 else if(tab==="today")v.innerHTML=renderToday();
 else if(tab==="people")v.innerHTML=renderPeople();
 else if(tab==="prayer")v.innerHTML=renderPrayer();
 else if(tab==="careplan")v.innerHTML=renderCarePlan();
 else if(tab==="echo")v.innerHTML=renderEcho();
 else if(tab==="offload")v.innerHTML=renderOffload();
 else if(tab==="settings")v.innerHTML=renderSettings();
 sizeProfileTabPanels(v);
 if(typeof bind==="function")bind();
 var activePanel=currentPerson&&v.querySelector('.profile-tab-panel:not([hidden])'),editorDialog=activePanel&&activePanel.querySelector('dialog[data-profile-editor],dialog[data-editor-modal]');if(!editorDialog)editorDialog=v.querySelector('dialog[data-editor-modal]');if(editorDialog){if(!editorDialog.open)tendShowModal(editorDialog);editorDialog.addEventListener("cancel",function(event){var cancel=editorDialog.querySelector("[data-editor-cancel]");if(cancel){event.preventDefault();cancel.click();}});}
 var rhythmPickerDialog=v.querySelector("dialog[data-rhythm-picker-dialog]");if(rhythmPickerDialog&&!rhythmPickerDialog.open){tendShowModal(rhythmPickerDialog);var rhythmPickerTitle=rhythmPickerDialog.querySelector("#rhythm-picker-title");if(rhythmPickerTitle)rhythmPickerTitle.focus({preventScroll:true});}
 if(tab==="today"&&!currentArea&&el("calStrip")&&typeof loadCalendars==="function")loadCalendars();if(tab==="today"&&!currentArea&&typeof loadNowWeather==="function")loadNowWeather();tendRenderScrollSnapshot=previousSnapshot;var renderedRouteKey=tendRenderRouteKey();tendLastRenderRouteKey=renderedRouteKey;if(preserve&&routeKey===renderedRouteKey)tendRestorePageScroll(scrollPosition);}
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
 var out='<main class="home-dashboard"><div class="sectiontitle dashboard-greeting" style="margin-top:6px"><h2>'+greet+', Steve</h2><span class="hint">'+days[d.getDay()]+", "+mos[d.getMonth()]+" "+d.getDate()+'</span></div>';
 out+='<div class="card overall-card"><div class="dashboard-overall-heading" style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:18px;font-weight:500">Overall health</h3><span class="ov-score '+oc+'">'+ov+'</span></div><div class="bar-ov"><i class="ov-marker" style="left:'+ov+'%"></i></div>'+'<div class="meta" style="margin-top:6px"><span class="statusword '+oc+'">'+scoreLabel(ov)+'</span></div>'+areaMenuHTML()+'</div>';
 out+='<div class="sectiontitle calendar-sectiontitle"><h2>On your calendar</h2></div><div class="card calendar-card"><div id="calStrip"><div class="empty">'+((S.calendars||[]).length?"Loading calendars...":"No calendars connected - add one in Settings.")+'</div></div></div><div id="calendarSyncSlot" class="calendar-sync-slot"></div>';
 out+=planHTML();
 out+=freeMomentHTML();
 out+=upcomingHTML();
 out+=renderChecklists();
 return out+'</main>';}
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
function planPills(it){
 var person=S.people.find(function(p){return p.id===it.personId;}),kind=planItemKind(it),typeBadge=kind?'<span class="pill '+(kind==="rhythm"?"rhy":kind==="spark"?"spk":"pry")+'">'+collectionIcon(kind==="rhythm"?"rhythms":kind==="spark"?"sparks":"prayer")+' '+(kind==="rhythm"?"Rhythm":kind==="spark"?"Spark":"Prayer")+'</span>':"";
 var record=null;
 if(it.rhythm){var ids=String(it.rhythm).split("|"),owner=S.people.find(function(p){return p.id===ids[0];});record=owner&&(owner.rhythms||[]).find(function(r){return r.id===ids[1];});}
 else if(it.faithRhythm)record=typeof faithFindRhythm==="function"?faithFindRhythm(it.faithRhythm):null;
 else if(it.prayer){var prayerRecord=(S.prayers||[]).find(function(p){return p.id===it.prayer;});if(prayerRecord&&prayerRecord.category==="Faith")record={areas:["faith"],faithGroup:prayerRecord.faithSection||prayerRecord.faithGroup};}
 var categories=record&&typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(record):"";
 return (person&&person.id!==currentPerson?'<button type="button" class="prayer-person person-badge-clickable'+((it.rhythm||it.rkey)?' person-rhythm-link':'')+'" '+((it.rhythm||it.rkey)?'data-personrhythms="'+esc(person.id)+'" aria-label="Open '+esc(person.name)+' rhythms"':'data-openperson="'+esc(person.id)+'" aria-label="Open '+esc(person.name)+' profile"')+'>'+personAvatar(person,24)+esc(person.name)+'</button>':'')+typeBadge+categories;
}
function planItemCopy(it){
 return '<div class="plan-item-copy"><strong class="tend-type-title">'+esc(it.label||"")+'</strong>'+(it.description?'<div class="tend-type-description">'+esc(it.description)+'</div>':'')+'<span class="plan-pills">'+planPills(it)+'</span></div>';
}
function genItem(label,sub,area,type,title){return {label:label,sub:sub,log:{area:area,type:type,title:title||label}};}
function taskItem(t){return {label:t.text,sub:"task · "+(S.areas[t.areaId]?S.areas[t.areaId].name:""),log:{area:t.areaId,type:"note",title:"Task: "+t.text},taskId:t.id};}
function dashboardRhythmEligible(r){
 var days=rhythmDaysSince(r),period=rhythmPeriod(r);if(days===0)return false;
 if(r.freq==="custom"){var date=new Date();return date.getDay()===(r.customDow||0)&&(r.customType!=="monthly"||Math.ceil(date.getDate()/7)===(r.customOrd||1));}
 return days>=Math.max(1,period-(period<=14?1:0))&&(days===999||days>=period||scheduleDayMatches(r));
}
function prioritizePlanItems(items){
 var ranked=items.slice().sort(function(a,b){
  return Number(!!b.scheduled)-Number(!!a.scheduled)||Number(!!b.prayer)-Number(!!a.prayer)||Number(!!b.calendarDay)-Number(!!a.calendarDay)||Number(!!b.rhythm)-Number(!!a.rhythm)||(a.period||Infinity)-(b.period||Infinity)||(b.waitDays||0)-(a.waitDays||0);
 });
 var visible=[],more=[],people={};
 ranked.forEach(function(it){
  if(it.prayer||(visible.length<4&&(!it.personId||!people[it.personId]))){visible.push(it);if(it.personId&&!it.prayer)people[it.personId]=true;}
  else more.push(it);
 });
 return {visible:visible,more:more};
}
function planCandidates(bid,curBid){
 var out=[],seenSparks=Object.create(null);
 S.tasks.forEach(function(t){if(!t.done&&((t.tod&&t.tod!=="anytime")?t.tod===bid:bid===curBid))out.push(taskItem(t));});
 S.people.forEach(function(person){
  (person.rhythms||[]).forEach(function(r){var blk=(r.tod&&r.tod!=="anytime")?r.tod:curBid;if(blk!==bid||!dashboardRhythmEligible(r))return;out.push({scheduled:!!r.tod&&r.tod!=="anytime",calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),rhythm:person.id+"|"+r.id,personId:person.id,label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
  sortedPersonSparks(person).forEach(function(spark){if(!spark.by||!sparkLive(spark))return;if((sparkBlock(spark)||curBid)!==bid)return;var key=(spark.profileOwnerId||person.id)+"|"+spark.id;if(seenSparks[key])return;seenSparks[key]=true;out.push({spark:key,personId:person.id,label:spark.text,description:spark.details||"",sub:(spark.time?fmtHM12(spark.time)+" \u00b7 ":"")+sparkDueTxt(spark)});});
 });
 if(typeof faithActiveRhythms==="function"&&typeof rhythmScheduledToday==="function"){
  faithActiveRhythms().forEach(function(r){if(r.tod!==bid||!rhythmScheduledToday(r))return;out.push({scheduled:true,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),faithRhythm:r.id,faithGroup:r.faithGroup,area:"faith",label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
 }
 if(typeof prayerIsDue==="function"){
  (S.prayers||[]).forEach(function(p){var block=p.tod&&p.tod!=="anytime"?p.tod:"allday";if(!prayerIsDue(p)||block!==bid)return;var prayerPeople=(p.personId?[p.personId]:[]).concat(Array.isArray(p.sharedWith)?p.sharedWith:[]);if(!prayerPeople.length)prayerPeople=[null];prayerPeople.filter(function(id,index){return prayerPeople.indexOf(id)===index;}).forEach(function(personId){out.push({scheduled:!!p.tod&&p.tod!=="anytime",calendarDay:!p.tod||p.tod==="anytime",prayer:p.id,personId:personId,label:p.text,description:p.details||"",sub:prayerScheduleLabel(p)+" \u00b7 last prayed "+prayerLastPrayedLabel(p)});});});
 }
 return out;
}
var planOpenState={};var planViewState="allday";var planKindVisibility={now:{rhythm:true,spark:true,prayer:true},other:{rhythm:true,spark:true,prayer:true}};
function planKindVisibilityFor(scope){
 if(!planKindVisibility[scope])planKindVisibility[scope]={rhythm:true,spark:true,prayer:true};
 return planKindVisibility[scope];
}
function planItemKind(item){return item.rhythm||item.rkey||item.faithRhythm?"rhythm":item.spark||item.sparky?"spark":item.prayer?"prayer":"";}
function planKindTogglesHTML(scope,label){
 var visibility=planKindVisibilityFor(scope);
 return '<span class="plan-kind-toggles" role="group" aria-label="'+esc(label||"Show or hide item types")+'">'+[["rhythm","Rhythm","rhythms"],["spark","Spark","sparks"],["prayer","Prayer","prayer"]].map(function(type){var active=visibility[type[0]]!==false,buttonLabel=(active?"Hide ":"Show ")+type[1]+" items";return '<button type="button" class="plan-kind-toggle plan-kind-'+type[0]+(active?"":" is-muted")+'" data-plan-kind-toggle="'+esc(scope)+'" data-kind="'+type[0]+'" aria-label="'+buttonLabel+'" title="'+buttonLabel+'" aria-pressed="'+active+'">'+collectionIcon(type[2])+'</button>';}).join("")+'</span>';
}
function planMetaIcon(kind){
 var paths={frequency:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5 M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',occurred:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5 2 2 4-4"/>'};
 return '<svg class="plan-detail-icon" viewBox="0 0 24 24" aria-hidden="true">'+paths[kind]+'</svg>';
}
function planItemMetaBar(meta){
 var parts=String(meta||"").split(" \u00b7 ").filter(Boolean);
 if(!parts.length||!parts.some(function(part){return /last tended|last prayed|not yet tended|not yet prayed/i.test(part);}))return "";
 var isTime=function(part){var normalized=part.toLowerCase();return Object.keys(TODS||{}).some(function(key){return TODS[key]&&TODS[key].toLowerCase()===normalized;});};
 var isOccurred=function(part){return /last tended|last prayed|not yet tended|not yet prayed|^tended |^prayed /i.test(part);};
 var time=parts.filter(isTime),occurred=parts.filter(isOccurred),frequency=parts.filter(function(part){return !isTime(part)&&!isOccurred(part)&&!/^(ends |due )/i.test(part);}).slice(0,1),extra=parts.filter(function(part){return !isTime(part)&&!isOccurred(part)&&frequency.indexOf(part)===-1;});
 function entries(items,kind){return items.map(function(part){
  var iconKind=kind==="schedule"?(isTime(part)?"time":"frequency"):"occurred";
  return '<span class="plan-item-meta-entry">'+planMetaIcon(iconKind)+'<span>'+esc(part)+'</span></span>';
 }).join("");}
 return '<div class="plan-item-meta">'+entries(frequency.concat(time,extra),"schedule")+entries(occurred,"occurred")+'</div>';
}
function planBlockCard(b,curId,isCur,isAllDay){
 isAllDay=!!isAllDay;
 var toggleScope=isCur?"now":"other",visibility=planKindVisibilityFor(toggleScope);
 var allItems=planCandidates(b.id,curId),items=allItems.filter(function(item){var kind=planItemKind(item);return !kind||visibility[kind]!==false;});
 var queue=prioritizePlanItems(items);
 var range='<span class="plan-range">'+b.range+' \u00b7 '+queue.visible.length+' item'+(queue.visible.length===1?'':'s')+'</span>';
 var summaryMeta='<span class="plan-summary-meta">'+range+(isCur?'':planKindTogglesHTML(toggleScope))+'</span>';
 var block=dayBlocks().find(function(item){return item.id===b.id;}),blockStart=block?block.start:"";
 function itemHTML(it){
  var btn=it.rhythm?rhyDoneBtn(it.rhythm):(it.faithRhythm?'<button type="button" class="btn mini" data-tend-open="faith-rhythm" data-rhythm-id="'+esc(it.faithRhythm)+'">Tend</button>':(it.prayer?'<button type="button" class="btn mini" data-pray="'+esc(it.prayer)+'">Pray</button>':(it.spark?'<button class="btn mini sparkbtn" data-sparkdo="'+it.spark+'">Do it</button>':'<button class="btn mini" data-plandone="'+encodeURIComponent(JSON.stringify(it.log))+'" data-taskid="'+(it.taskId||"")+'">Done</button>')));
  var meta=planItemMetaBar(it.sub);
  return '<div class="planitem"><div class="pi-main">'+planItemCopy(it)+(meta?"":(it.sub?'<div class="tend-type-meta">'+esc(it.sub)+'</div>':""))+'</div>'+btn+meta+'</div>';
 }
 var body=queue.visible.length?queue.visible.map(itemHTML).join(""):'<div class="empty">'+(allItems.length?'Items hidden by the type filters.':'Nothing queued - all tended.')+'</div>';
 if(isCur)return '<div id="plan-'+b.id+'" data-plan-block="'+b.id+'" class="card planblock current"><div class="current-plan-summary"><div class="current-plan-topline"><span class="current-plan-now">Now</span><div class="current-plan-weather" id="nowWeather">'+(typeof nowWeatherHTML==="function"?nowWeatherHTML():"")+'</div></div><div class="current-plan-details"><div class="current-plan-period"><span class="plan-block-name">'+esc(b.name)+'</span><span class="current-plan-range">'+esc(b.range)+'</span></div><span class="current-plan-item-count"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3h8M5.5 8h8M5.5 13h8M2.5 3h.01M2.5 8h.01M2.5 13h.01"/></svg>'+queue.visible.length+' item'+(queue.visible.length===1?'':'s')+'</span></div></div><div class="current-plan-items">'+body+'</div><div class="current-plan-filters">'+planKindTogglesHTML(toggleScope,"Now item filters")+'</div></div>';
 var hasSavedOpen=Object.prototype.hasOwnProperty.call(planOpenState,b.id),isOpen=isAllDay?(hasSavedOpen?planOpenState[b.id]:queue.visible.length>0):true;
 return '<details id="plan-'+b.id+'" data-plan-block="'+b.id+'" class="card planblock"'+(isOpen?' open':'')+'><summary><span class="plan-summary-copy"><span class="plan-block-name">'+esc(b.name)+'</span>'+summaryMeta+'</span><span class="plan-weather-slot" data-plan-weather="'+esc(blockStart)+'">'+(typeof planWeatherHTML==="function"?planWeatherHTML(blockStart):"")+'</span></summary><div style="margin-top:8px">'+body+'</div></details>';
}
function planHTML(){
 var blocks=planBlocksDef();
 var current=blocks.filter(function(x){return x.cur;})[0]||blocks[0],curId=current.id;
 var out=planBlockCard(current,curId,true);
 out+='<nav class="day-jumps" aria-label="Other time blocks">'+blocks.filter(function(b){return b.id!==curId;}).map(function(b){var active=planViewState===b.id;return '<button type="button" class="btn mini ghost'+(active?' active':'')+'" data-planview="'+b.id+'" aria-pressed="'+active+'">'+esc(b.name)+'</button>';}).join('')+'<button type="button" class="btn mini ghost day-jump-all-day'+(planViewState==="allday"?' active':'')+'" data-planview="allday" aria-pressed="'+(planViewState==="allday")+'">All Day</button></nav>';
 var sel=blocks.filter(function(b){return b.id===planViewState&&b.id!==curId;})[0];
 if(planViewState==="allday")out+=planBlockCard({id:'allday',name:'All Day',range:'Any time today'},curId,false,true);
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
  var prayers=personPrayerRecords(p).filter(function(x){return !x.answered&&!x.archived;}).length;
  out+='<div class="card person-card" data-openperson="'+p.id+'" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px;min-width:0">'+personAvatar(p,42)+'<h3 style="margin:0">'+esc(p.name)+'</h3></div><span class="person-card-score">'+sc+'</span></div>'+personHealthMeter(sc,p.name,true)+'<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div><div class="meta">'+esc(p.relation||"")+' \u00b7 '+(ci.last?("connected "+when(ci.last.ts)):"no connections yet")+(prayers?" \u00b7 "+prayers+" prayer"+(prayers>1?"s":""):"")+'</div>'+nextDateLine(p)+personDateLines(p)+'</div>';
 });
 out+='</div>';
 return out;}
/* ============ person profile: rhythms + touch points ============ */
function sortedPersonRhythms(person){
 var order=dayBlocks().map(function(block){return block.id;});
 function timeRank(r){var index=order.indexOf(r.tod);return index<0?order.length:index;}
 var rhythms=[];
 S.people.forEach(function(owner){(owner.rhythms||[]).forEach(function(r){if(owner.id===person.id||(Array.isArray(r.sharedWith)&&r.sharedWith.indexOf(person.id)!==-1))rhythms.push(Object.assign({},r,{profileOwnerId:owner.id}));});});
 (S.rhythms||[]).forEach(function(r){if((r.category==="faith"||r.faithGroup)&&Array.isArray(r.sharedWith)&&r.sharedWith.indexOf(person.id)!==-1)rhythms.push(Object.assign({},r,{profileOwnerId:"faith",sharedFaithRhythm:true}));});
 return rhythms.sort(function(a,b){return rhythmPeriod(a)-rhythmPeriod(b)||timeRank(a)-timeRank(b);});
}
function sortedPersonSparks(person){
 var sparks=[];
 S.people.forEach(function(owner){(owner.sparks||[]).forEach(function(spark){if(owner.id===person.id||(Array.isArray(spark.sharedWith)&&spark.sharedWith.indexOf(person.id)!==-1))sparks.push(Object.assign({},spark,{profileOwnerId:owner.id}));});});
 (S.ideas||[]).forEach(function(spark){if((spark.category==="faith"||spark.area==="faith"||spark.faithSection)&&Array.isArray(spark.sharedWith)&&spark.sharedWith.indexOf(person.id)!==-1)sparks.push(Object.assign({},spark,{profileOwnerId:"faith",sharedFaithSpark:true}));});
 var seen={};
 return sparks.filter(function(spark){if(spark.done||seen[spark.id])return false;seen[spark.id]=true;return true;}).sort(function(a,b){return (a.by||"9999")<(b.by||"9999")?-1:1;});
}
function rhythmPeopleBadges(r,excludeId){
 var ids=[r.profileOwnerId||excludeId].concat(Array.isArray(r.sharedWith)?r.sharedWith:[]);
 return ids.filter(function(id,index){return id&&id!==excludeId&&ids.indexOf(id)===index;}).map(function(id){var person=S.people.find(function(x){return x.id===id;});return person?'<button type="button" class="prayer-person person-badge-clickable person-rhythm-link" data-personbadge="'+esc(person.id)+'|rhythm" aria-label="Open '+esc(person.name)+' rhythms">'+personAvatar(person,24)+esc(person.name)+'</button>':"";}).join("");
}
var tendItemAssociationDrafts={},tendItemPickerDraft=null,sparkAddDrafts={},prayerAddDrafts={},noteAddDrafts={};
function tendAssociationKey(type,ownerId,itemId){return type+"|"+ownerId+"|"+itemId;}
function tendAssociationValues(type,ownerId,itemId,record){
 var draft=tendItemAssociationDrafts[tendAssociationKey(type,ownerId,itemId)];
 var sharedWith=draft?draft.sharedWith:record&&record.sharedWith,areas=draft?draft.areas:record&&record.areas;
 var faithGroup=draft&&draft.faithGroup||record&&(record.faithSection||record.faithGroup);
 if(type==="connection"&&!draft){sharedWith=record&&Array.isArray(record.personIds)?record.personIds:record&&record.personId?[record.personId]:[];}
 if((type==="followup"&&record&&record.kind==="faith-note"||type==="spark"&&ownerId==="faith")&&!draft&&(!Array.isArray(areas)||areas.indexOf("faith")===-1))areas=(Array.isArray(areas)?areas:[]).concat("faith");
 return {sharedWith:Array.isArray(sharedWith)?sharedWith:[],areas:Array.isArray(areas)?areas:[],faithGroup:faithGroup};
}
function tendPersonRelationshipGroup(person){
 if(typeof faithPrayerPersonGroup==="function")return faithPrayerPersonGroup(person);
 var relation=String(person&&person.relation||"").toLowerCase();
 if(/spouse|wife|husband|partner/.test(relation))return "marriage";
 if(/son|daughter|father|dad|mother|mom|brother|sister|in-law|in law|grandchild|grandson|granddaughter|nephew|niece|bonus/.test(relation))return "parenting";
 return "friendships";
}
function tendPeopleGroupToggles(selected,ownerId,attribute){
 return [["marriage","Marriage"],["parenting","Parenting"],["friendships","Friends"]].map(function(group){
  var members=S.people.filter(function(person){return person.id!==ownerId&&tendPersonRelationshipGroup(person)===group[0];}),active=members.length>0&&members.every(function(person){return selected.indexOf(person.id)!==-1;});
  return '<button type="button" class="people-picker-group-toggle'+(active?" selected":"")+'" '+attribute+'="'+group[0]+'" aria-pressed="'+active+'"'+(members.length?"":" disabled")+'>'+group[1]+'</button>';
 }).join("");
}
function tendPeopleGroupToggleBar(selected,ownerId,attribute){
 return '<div class="people-picker-groups" aria-label="Quick select people by relationship">'+tendPeopleGroupToggles(selected,ownerId,attribute)+'</div>';
}
function tendApplyPeopleGroupToggle(selected,ownerId,group){
 var members=S.people.filter(function(person){return person.id!==ownerId&&tendPersonRelationshipGroup(person)===group;}),allSelected=members.length>0&&members.every(function(person){return selected.indexOf(person.id)!==-1;});
 members.forEach(function(person){var index=selected.indexOf(person.id);if(allSelected&&index!==-1)selected.splice(index,1);else if(!allSelected&&index===-1)selected.push(person.id);});
 return selected;
}
function tendRefreshPeoplePicker(container,selected,ownerId,groupAttribute,personAttribute){
 if(!container)return;
 Array.prototype.forEach.call(container.querySelectorAll("["+groupAttribute+"]"),function(button){var group=button.getAttribute(groupAttribute),members=S.people.filter(function(person){return person.id!==ownerId&&tendPersonRelationshipGroup(person)===group;}),active=members.length>0&&members.every(function(person){return selected.indexOf(person.id)!==-1;});button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});
 Array.prototype.forEach.call(container.querySelectorAll("["+personAttribute+"]"),function(button){var personId=button.getAttribute(personAttribute).split("|").pop(),active=personId===ownerId||selected.indexOf(personId)!==-1;button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});
}
function tendAssociationPeopleBadges(record,ownerId,excludeId,section){
 var ids=(ownerId&&ownerId!=="global"?[ownerId]:[]).concat(record&&Array.isArray(record.sharedWith)?record.sharedWith:[]);
 return ids.filter(function(id,index){return id&&id!==excludeId&&ids.indexOf(id)===index;}).map(function(id){
  var person=S.people.find(function(x){return x.id===id;});
  return person?'<button type="button" class="prayer-person person-badge-clickable person-rhythm-link" data-personbadge="'+esc(person.id)+'|'+section+'" aria-label="Open '+esc(person.name)+' '+section+'">'+personAvatar(person,24)+esc(person.name)+'</button>':"";
 }).join("");
}
function tendAssociationCategoryBadges(record){
 if(!record||typeof window.tendCategoryBadges!=="function")return "";
 var areas=Array.isArray(record.areas)?record.areas.slice():[];
 if(record.kind==="faith-note"&&areas.indexOf("faith")===-1)areas.push("faith");
 return window.tendCategoryBadges({areas:areas,faithGroup:record.faithSection||record.faithGroup});
}
function tendPrayerCategoryBadges(prayer){
 var area={Marriage:"marriage",Kids:"parenting",Friends:"friendships",Faith:"faith"}[prayer&&prayer.category],areas=(prayer&&prayer.areas||[]).slice();
 if(area&&areas.indexOf(area)===-1)areas.unshift(area);
 return typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges({areas:areas,faithGroup:prayer&& (prayer.faithSection||prayer.faithGroup)}):"";
}
function tendAssociationControlsHTML(type,ownerId,itemId,record){
 var values=tendAssociationValues(type,ownerId,itemId,record),names={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var key=type+"|"+ownerId+"|"+itemId;
 var action=itemId==="new"?"Add":"Edit";
 var faithGroup=values.faithGroup||record&&(record.faithSection||record.faithGroup)||"Prayer";
 var categories=values.areas.map(function(id){var label=id==="faith"?"Faith - "+faithGroup:names[id]||id;return '<span class="rhythm-picker-chip category-selected">'+(AREA_ICONS[id]||"")+esc(label)+'</span>';}).join("");
 var people=values.sharedWith.map(function(id){var person=S.people.find(function(x){return x.id===id;});return person?'<span class="rhythm-picker-person">'+personAvatar(person,22)+esc(person.name)+'</span>':"";}).join("");
 return '<div class="rhythm-picker-controls item-association-controls" data-item-association-controls="'+esc(key)+'"><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-item-picker-open="'+esc(key+'|categories')+'">'+action+' categories</button>'+categories+'</div><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-item-picker-open="'+esc(key+'|people')+'">'+action+' people</button>'+people+'</div></div>';
}
function tendAssociationPickerHTML(picker){
 var people=picker.kind==="people",ownerId=picker.ownerId,type=picker.type,itemId=picker.itemId,target=type+"|"+ownerId+"|"+itemId+"|"+picker.kind;
 var itemName=type==="spark"?"spark":type==="connection"?"connection":type==="followup"?"note":"prayer";
 var names={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 if(!people&&(type==="followup"||type==="spark")&&picker.faithSubcategoryOpen){
  var faithGroups=typeof FAITH_GROUPS!=="undefined"?FAITH_GROUPS:["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
  var selectedGroup=faithGroups.indexOf(picker.faithGroup)>=0?picker.faithGroup:"Prayer";
  var options=faithGroups.map(function(group){return '<button type="button" class="rhythm-picker-option category-option'+(group===selectedGroup?' selected':'')+'" data-item-picker-faith-group="'+esc(group)+'" aria-pressed="'+(group===selectedGroup)+'"><span>'+esc(group)+'</span></button>';}).join("");
  var faithRecord=tendAssociationRecord(type,ownerId,itemId);
  if(picker.selected.indexOf("faith")>=0&&(!faithRecord||faithRecord.kind!=="faith-note")&&!(type==="spark"&&ownerId==="faith"))options+='<button type="button" class="rhythm-picker-option category-option" data-item-picker-faith-remove><span>Remove Faith category</span></button>';
  return '<dialog class="profile-editor-dialog rhythm-picker-dialog" data-item-association-dialog aria-labelledby="item-association-title"><div class="profile-editor-body"><button type="button" class="rhythm-picker-trigger" data-item-picker-faith-back>‹ Categories</button><h3 id="item-association-title" tabindex="-1">Faith subcategory</h3><p class="profile-tab-intro">Choose where this '+itemName+' belongs in Faith.</p><div class="rhythm-picker-options" role="group" aria-label="Faith subcategory">'+options+'</div><div class="profile-editor-actions"><button type="button" class="btn mini ghost" data-item-picker-cancel>Cancel</button></div></div></dialog>';
 }
 var choices=people?S.people.map(function(person){var isOwner=ownerId!=="connection"&&person.id===ownerId,selected=isOwner||picker.selected.indexOf(person.id)!==-1;return '<button type="button" class="prayer-person person-badge-clickable rhythm-picker-option'+(selected?' selected':'')+'" data-item-picker-toggle="'+esc(target+'|'+person.id)+'" aria-pressed="'+selected+'"'+(isOwner?' disabled':'')+'>'+personAvatar(person,28)+esc(person.name)+'</button>';}).join(""):["faith","marriage","parenting","health","finances","friendships"].map(function(id){var selected=picker.selected.indexOf(id)!==-1;if(id==="faith"&&(type==="followup"||type==="spark"))return '<button type="button" class="rhythm-picker-option category-option'+(selected?' selected':'')+'" data-item-picker-faith-open aria-haspopup="dialog" aria-pressed="'+selected+'">'+(AREA_ICONS[id]||"")+'<span>Faith - '+esc(picker.faithGroup||"Prayer")+'</span></button>';return '<button type="button" class="rhythm-picker-option category-option'+(selected?' selected':'')+'" data-item-picker-toggle="'+esc(target+'|'+id)+'" aria-pressed="'+selected+'">'+(AREA_ICONS[id]||"")+'<span>'+names[id]+'</span></button>';}).join("");
 return '<dialog class="profile-editor-dialog rhythm-picker-dialog" data-item-association-dialog aria-labelledby="item-association-title"><div class="profile-editor-body"><h3 id="item-association-title" tabindex="-1">'+(people?"People for this "+itemName:"Categories for this "+itemName)+'</h3><p class="profile-tab-intro">'+(people?"Choose everyone involved in this "+itemName+".":"Choose the categories where this "+itemName+" should appear.")+'</p>'+(people&&ownerId!=="connection"?tendPeopleGroupToggleBar(picker.selected,ownerId,"data-item-picker-group"):"")+'<div class="rhythm-picker-options">'+choices+'</div><div class="profile-editor-actions"><button type="button" class="btn mini" data-item-picker-save>Save</button><button type="button" class="btn mini ghost" data-item-picker-cancel>Cancel</button></div></div></dialog>';
}
function tendAssociationRecord(type,ownerId,itemId){
 if(type==="connection")return S.events.find(function(event){return event.id===itemId;});
 if(type==="followup"){
  if(itemId==="new")return ownerId==="faith"?faithNoteDraft:noteAddDrafts[ownerId]||null;
  return S.followups.find(function(item){return item.id===itemId;});
 }
 if(type==="spark"){
  if(itemId==="new")return ownerId==="faith"?(sparkAddDrafts.faith||faithSparkDraft):(sparkAddDrafts[ownerId]||(sparkAddDrafts[ownerId]={sharedWith:[],areas:[]}));
  if(sparkEditDraft&&sparkEditDraft.id===itemId)return sparkEditDraft;
  if(faithSparkDraft&&faithSparkDraft.id===itemId&&faithSparkOwnerId===ownerId)return faithSparkDraft;
  if(ownerId==="faith")return S.ideas.find(function(item){return item.id===itemId;});
  var owner=S.people.find(function(person){return person.id===ownerId;});return owner&&(owner.sparks||[]).find(function(item){return item.id===itemId;});
 }
 if(itemId==="new")return prayerAddDrafts[ownerId]||(prayerAddDrafts[ownerId]={sharedWith:[],areas:[]});
 return S.prayers.find(function(item){return item.id===itemId;});
}
function tendRefreshAssociationPicker(dialog){
 if(!dialog)return;
 var wrapper=document.createElement("div");wrapper.innerHTML=tendAssociationPickerHTML(tendItemPickerDraft);
 var next=wrapper.firstElementChild;if(!next)return;
 dialog.innerHTML=next.innerHTML;
 var title=dialog.querySelector("#item-association-title");if(title)title.focus({preventScroll:true});
}
function tendAssociationPickerOpen(key){
 var parts=key.split("|"),type=parts[0],ownerId=parts[1],itemId=parts[2],kind=parts[3],record=tendAssociationRecord(type,ownerId,itemId);
 if(!record)return;
 var values=tendAssociationValues(type,ownerId,itemId,record),picker={type:type,ownerId:ownerId,itemId:itemId,kind:kind,selected:(kind==="people"?values.sharedWith:values.areas).slice(),faithGroup:values.faithGroup||record&&(record.faithSection||record.faithGroup)||"Prayer"};
 tendItemPickerDraft=picker;
 var wrapper=document.createElement("div");wrapper.innerHTML=tendAssociationPickerHTML(picker);
 var dialog=wrapper.firstElementChild;document.body.appendChild(dialog);tendShowModal(dialog);
 var title=dialog.querySelector("#item-association-title");if(title)title.focus({preventScroll:true});
 dialog.addEventListener("close",function(){dialog.remove();tendItemPickerDraft=null;});
}
function tendAssociationCommit(type,ownerId,itemId,record){
 var key=tendAssociationKey(type,ownerId,itemId),draft=tendItemAssociationDrafts[key];
 if(draft&&record){
  if(type==="connection"){
   record.personIds=draft.sharedWith.filter(function(id,index,ids){return ids.indexOf(id)===index&&S.people.some(function(person){return person.id===id;});});
   record.personId=record.personIds[0]||null;
   var primaryPerson=S.people.find(function(person){return person.id===record.personId;});if(primaryPerson)record.areaId=primaryPerson.area;
   record.areas=draft.areas.slice();
  }else{
   var recordOwner=record.personId||ownerId;record.sharedWith=draft.sharedWith.filter(function(id){return id!==recordOwner&&S.people.some(function(person){return person.id===id;});});record.areas=draft.areas.slice();
   if(type==="followup"&&record.kind==="faith-note"&&record.areas.indexOf("faith")===-1)record.areas.push("faith");
   if(type==="followup"&&record.areas.indexOf("faith")>=0&&draft.faithGroup)record.faithSection=draft.faithGroup;
   else if(type==="followup"&&record.kind!=="faith-note")delete record.faithSection;
   if(type==="spark"){
    if(ownerId==="faith"&&record.areas.indexOf("faith")===-1)record.areas.push("faith");
    if(record.areas.indexOf("faith")>=0)record.faithSection=draft.faithGroup||record.faithSection||"Prayer";
    else if(ownerId!=="faith")delete record.faithSection;
   }
  }
 }
 delete tendItemAssociationDrafts[key];
}
function rhythmPickerRecord(ownerId,rid){
 if(ownerId==="faith")return faithRhythmDraft&&(rid==="draft"?!faithRhythmDraft.id:faithRhythmDraft.id===rid)?faithRhythmDraft:null;
 return rid==="draft"?(rhythmDraft&&rhythmDraft.pid===ownerId?rhythmDraft:null):(rhythmEditDraft&&rhythmEditDraft.id===rid?rhythmEditDraft:null);
}
function rhythmPickerControlsHTML(ownerId,r,idf,excludeFaith){
 var categories=typeof window.tendRhythmCategoryIds==="function"?window.tendRhythmCategoryIds(r):(r.areas||[]);
 if(excludeFaith)categories=categories.filter(function(id){return id!=="faith";});
 var categoryNames={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var categoryChips=categories.map(function(id){return '<span class="rhythm-picker-chip category-selected">'+(AREA_ICONS[id]||"")+esc(categoryNames[id]||id)+'</span>';}).join("");
 var peopleChips=(r.sharedWith||[]).map(function(id){var person=S.people.find(function(x){return x.id===id;});return person?'<span class="rhythm-picker-person">'+personAvatar(person,22)+esc(person.name)+'</span>':"";}).join("");
 return '<div class="rhythm-picker-controls"><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="categories|'+esc(idf)+'">Add categories</button>'+categoryChips+'</div><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="people|'+esc(idf)+'">Add people</button>'+peopleChips+'</div></div>';
}
function rhythmPickerModalHTML(){
 var picker=rhythmPickerDraft;if(!picker)return "";
 var target=picker.ownerId+"|"+picker.rhythmId,record=rhythmPickerRecord(picker.ownerId,picker.rhythmId);if(!record)return "";
 var people=picker.type==="people";
 var title=people?"People for this rhythm":"Categories for this rhythm";
 var description=people?"Choose everyone who shares this rhythm.":"Choose the categories where this rhythm should appear.";
 var choices=people?S.people.map(function(person){var isOwner=person.id===picker.ownerId,selected=isOwner||picker.selected.indexOf(person.id)!==-1;return '<button type="button" class="prayer-person person-badge-clickable rhythm-picker-option'+(selected?' selected':'')+'" data-rhythm-picker-toggle="people|'+esc(target)+'|'+esc(person.id)+'" aria-pressed="'+selected+'"'+(isOwner?' disabled':'')+'>'+personAvatar(person,28)+esc(person.name)+'</button>';}).join(""):(function(){var names={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"},ids=picker.ownerId==="faith"?["marriage","parenting","health","finances","friendships"]:["faith","marriage","parenting","health","finances","friendships"];return ids.map(function(id){var selected=picker.selected.indexOf(id)!==-1;return '<button type="button" class="rhythm-picker-option category-option'+(selected?' selected':'')+'" data-rhythm-picker-toggle="categories|'+esc(target)+'|'+id+'" aria-pressed="'+selected+'">'+(AREA_ICONS[id]||"")+'<span>'+names[id]+'</span></button>';}).join("");})();
 return '<dialog class="profile-editor-dialog rhythm-picker-dialog" data-rhythm-picker-dialog aria-labelledby="rhythm-picker-title"><div class="profile-editor-body"><h3 id="rhythm-picker-title" tabindex="-1">'+title+'</h3><p class="profile-tab-intro">'+description+'</p>'+(people?tendPeopleGroupToggleBar(picker.selected,picker.ownerId,"data-rhythm-picker-group"):"")+'<div class="rhythm-picker-options">'+choices+'</div><div class="profile-editor-actions"><button type="button" class="btn mini" data-rhythm-picker-save>Save</button><button type="button" class="btn mini ghost" data-rhythm-picker-cancel data-editor-cancel>Cancel</button></div></div></dialog>';
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
function collectionIcon(key){var paths={rhythms:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5 M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',connection:'<path d="m9.5 14.5-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0 M14.5 9.5l2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0 M8.5 15.5l7-7"/>',sparks:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',prayer:'<circle cx="17" cy="4.3" r="2.7"/><path d="M10.2 8.1c.7-.8 1.9-.9 2.7-.2l3.3 2.8 2-2c.8-.8 2.1-.8 2.9 0s.8 2.1 0 2.9l-3.4 3.4c-.8.8-2.1.8-2.9 0l-1.1-1-2.6 3.2 4.5 3.2c.6.4.9 1.1.9 1.8 0 1-.8 1.8-1.8 1.8H5.1c-1.2 0-2.1-.9-2.1-2.1s.9-2.1 2.1-2.1h4.3l-3.1-2.3c-1.3-.9-1.5-2.7-.5-3.9z"/>',faith:'<path d="M12 3v18 M6.5 8h11"/>',notes:'<path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6"/>'};return '<svg class="collection-icon'+(key==="prayer"?" collection-icon-prayer":"")+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[key]||"")+'</svg>';}
function tendRowContent(title,description,meta,badges){
 return '<div class="tend-row-content"><div class="tend-row-heading"><strong class="tend-type-title">'+esc(title||"")+'</strong>'+(badges||"")+'</div>'+(description?'<div class="tend-type-description">'+esc(description)+'</div>':'')+(meta?'<div class="tend-type-meta">'+esc(meta)+'</div>':'')+'</div>';
}
function tendRhythmFrequencyLabel(r){
 if(r.freq==="selectdays"&&Array.isArray(r.weekdays)&&r.weekdays.length)return "Every "+r.weekdays.slice().sort().map(function(day){return DOW_SHORT[+day];}).join(", ");
 var label=rhythmFreqLabel(r),freq=r.freq||(r.rule&&r.rule.freq),day;
 if(freq==="weekly"){
  var days=r.rule&&Array.isArray(r.rule.days)?r.rule.days:Array.isArray(r.weekdays)?r.weekdays:r.scheduleDow!==null&&r.scheduleDow!==undefined&&r.scheduleDow!==""?[+r.scheduleDow]:[];
  days=days.map(Number).filter(function(value,index,all){return value>=0&&value<7&&all.indexOf(value)===index;}).sort(function(a,b){return a-b;});
  return days.length&& !/\bon\b/i.test(label) ? label+" on "+days.map(function(value){return DOW[value];}).join(", "):label;
 }
 if(freq==="monthly"){day=scheduleDayLabel(r);if(day){var match=day.match(/^on the (\d+)$/i);if(match){var date=+match[1],lastTwo=date%100,suffix=lastTwo>=11&&lastTwo<=13?"th":date%10===1?"st":date%10===2?"nd":date%10===3?"rd":"th";day="on the "+date+suffix;}return label+" "+day.replace(/^on\s+/i,"on ");}}
 return label;
}
function tendRhythmMetaLabel(r,eventTs,includeDue){
 var last=Number.isFinite(eventTs)?{ts:eventTs}:rhythmLast(r),parts=[tendRhythmFrequencyLabel(r)];
 if(r.tod&&r.tod!=="anytime"&&TODS[r.tod])parts.push(TODS[r.tod]);
 parts.push(last?(Number.isFinite(eventTs)?"Tended ":"Last tended ")+when(last.ts)+(Number.isFinite(eventTs)&&daysSince(last.ts)===0?" "+fmtHM(last.ts):""):"Not yet tended");
 if(includeDue&&last&&rhythmDaysSince(r)!==0)parts.push(rhythmDueTxt(r));
 return parts.join(" \u00B7 ");
}
function noteKindLabel(kind){return kind==="prayernote"||kind==="prayer"||kind==="faith-note"?"Prayer":kind==="encouragement"?"Encouragement":kind==="followup"?"Follow-up":"General";}
function noteKindOptions(selected){selected=selected==="prayernote"?"prayer":selected;return [["general","General"],["encouragement","Encouragement"],["followup","Follow-up"],["prayer","Prayer"]].map(function(option){return '<option value="'+option[0]+'"'+(option[0]===selected?' selected':'')+'>'+option[1]+'</option>';}).join("");}
function profileNoteTitleText(note){return String(note.title||note.text||"");}
function profileNoteDetails(note){return String(note.details||"");}
function followupAssociationOwner(note){return note&&note.kind==="faith-note"?"faith":note&&(note.personId||"global");}
function personNoteRecords(person){return S.followups.filter(function(note){return note.personId===person.id||(Array.isArray(note.sharedWith)&&note.sharedWith.indexOf(person.id)!==-1);});}
function notesChecklist(p,addAction){
 var items=personNoteRecords(p);
 function row(f){
  if(editingFollowupId===f.id){var associationOwner=followupAssociationOwner(f)||p.id;return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="note-editor-title"><div class="profile-editor-body"><h3 id="note-editor-title">Edit Note</h3>'+(f.kind==="faith-note"?'<div class="profile-note-type"><span>Type</span><strong>Prayer</strong></div>':'<label class="profile-note-type">Type<select data-fu-kind>'+noteKindOptions(f.kind==="encouragement"?"encouragement":f.kind==="followup"?"followup":f.kind==="prayernote"?"prayer":"general")+'</select></label>')+'<label class="profile-note-type">Title<input id="followupEditTitle" aria-label="Note title" value="'+esc(profileNoteTitleText(f))+'"></label><label class="profile-note-type">Details<textarea id="followupEditDetails" aria-label="Note details" placeholder="Add details (optional)">'+esc(profileNoteDetails(f))+'</textarea></label>'+tendAssociationControlsHTML("followup",associationOwner,f.id,f)+'<div class="profile-editor-actions"><button class="btn mini" data-fusave="'+f.id+'">Save Note</button><button class="btn mini ghost" data-fucancel="1" data-editor-cancel>Cancel</button><button class="btn mini danger" data-fudel="'+f.id+'">Delete Note</button></div></div></dialog>';}
  var stamp=f.createdAt||f.ts?"Added "+when(f.createdAt||f.ts):f.due?"Due "+f.due:"";
  var ownerId=f.kind==="faith-note"?"faith":f.personId||p.id,badges=tendAssociationPeopleBadges(f,ownerId,p.id,"notes")+tendAssociationCategoryBadges(f);
  return '<div class="person-note-row'+(f.done?' is-done':'')+'"><span class="person-note-type-column">'+esc(noteKindLabel(f.kind))+'</span>'+tendRowContent(profileNoteTitleText(f),profileNoteDetails(f),stamp,badges)+'<div class="person-note-actions">'+(f.done?'<button class="btn mini ghost" data-fudone="'+f.id+'" aria-label="Reopen note">Reopen</button>':'<button class="btn mini note-done" data-fudone="'+f.id+'" aria-label="Complete note">Done</button>')+'<button class="iconbtn" data-fuedit="'+f.id+'" aria-label="Edit note" title="Edit">✎</button><button class="iconbtn" data-fudel="'+f.id+'" aria-label="Delete note" title="Delete">×</button></div></div>';
 }
 var active=items.filter(function(f){return !f.done;}),done=items.filter(function(f){return f.done;});
 return (active.length?active.map(row).join(""):'<div class="empty">No notes yet - add something to remember.</div>')+(done.length?'<button type="button" class="recent-moments-toggle" data-note-history="'+esc(p.id)+'">Show history ('+done.length+')</button>':'')+(addAction||"");
}
function openPersonNoteHistory(personId){
 var person=S.people.find(function(item){return item.id===personId;});if(!person)return;
 var notes=personNoteRecords(person).filter(function(note){return note.done;}).sort(function(a,b){return (b.completedDate||b.createdAt||b.ts||0)>(a.completedDate||a.createdAt||a.ts||0)?1:-1;});
 function row(note){
  var stamp=note.createdAt||note.ts?"Added "+when(note.createdAt||note.ts):note.due?"Due "+note.due:"";
  if(note.completedDate)stamp+=(stamp?" · ":"")+"Completed "+when(note.completedDate);
  var ownerId=note.kind==="faith-note"?"faith":note.personId||person.id,badges=tendAssociationPeopleBadges(note,ownerId,person.id,"notes")+tendAssociationCategoryBadges(note);
  return '<div class="person-note-row is-done"><span class="person-note-type-column">'+esc(noteKindLabel(note.kind))+'</span>'+tendRowContent(profileNoteTitleText(note),profileNoteDetails(note),stamp,badges)+'<div class="person-note-actions"><button class="btn mini ghost" data-fudone="'+esc(note.id)+'" aria-label="Reopen note">Reopen</button><button class="iconbtn" data-fuedit="'+esc(note.id)+'" aria-label="Edit note" title="Edit">✎</button><button class="iconbtn" data-fudel="'+esc(note.id)+'" aria-label="Delete note" title="Delete">×</button></div></div>';
 }
 var dialog=document.createElement("dialog");dialog.className="rhythm-history-dialog note-history-dialog";dialog.setAttribute("aria-labelledby","noteHistoryTitle");
 dialog.innerHTML='<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="noteHistoryTitle">Completed notes</h2><p class="history-rhythm-details">'+notes.length+' completed note'+(notes.length===1?"":"s")+'</p></div><button class="iconbtn" data-note-history-close aria-label="Close note history">✕</button></div><div class="notes-history-list note-history-modal-list">'+(notes.length?notes.map(row).join(""):'<div class="empty">No completed notes yet.</div>')+'</div>';
 dialog.addEventListener("click",function(event){
  if(event.target.closest("[data-note-history-close]")){dialog.close();return;}
  if(event.target.closest("[data-fudone],[data-fuedit],[data-fudel]"))dialog.close();
 });
 dialog.addEventListener("close",function(){dialog.remove();});document.body.appendChild(dialog);tendShowModal(dialog);
}
function profilePanelStart(key){return '<section class="card profile-tab-panel" id="profile-panel-'+key+'" role="tabpanel" aria-labelledby="profile-tab-'+key+'"'+(activeProfileTab===key?'':' hidden')+'>';}
var activeProfileTab="rhythms";
function actQueueHTML(p){
 var first=esc(p.name.split(" ")[0]);
 var doneSess=window._actDone[p.id]||[],visibility=planKindVisibilityFor("person:"+p.id);
 /* rhythm queue: most overdue first, max 2 visible; session-tended rhythms pad the empty slots */
 var allR=(p.rhythms||[]).filter(function(r){return (r.category||"connection")!=="prayer";});
 var waitR=visibility.rhythm===false?[]:allR.filter(function(r){return todayRhythmEligible(r);}).sort(function(a,b){return rhythmPeriod(a)-rhythmPeriod(b)||rhythmScore(a)-rhythmScore(b);});
 var visR=waitR.slice(0,2);
 var padR=[];
 /* spark queue: max 2 visible */
 var allS=sortedPersonSparks(p);
 var waitS=visibility.spark===false?[]:allS.filter(function(s){return (!s.by||sparkLive(s))&&doneSess.indexOf(s.id)<0;});
 var visS=waitS.slice(0,1);
 var padS=[];
 if(visibility.spark!==false&&visS.length<2)doneSess.slice().reverse().forEach(function(id){if(padS.length<2-visS.length){var ss2=allS.find(function(s){return s.id===id;});if(ss2)padS.push(ss2);}});
 /* prayer queue: active prayers first, then the static prayer focus; one visible */
 var allP=personPrayerRecords(p).filter(function(x){return !x.answered&&!x.archived;});
 var waitP=visibility.prayer===false?[]:allP.filter(function(x){return prayerIsDue(x);}).sort(function(a,b){return (a.lastPrayed||"").localeCompare(b.lastPrayed||"")||(a.added||"").localeCompare(b.added||"");});
 var visP=waitP.slice(0,2);
 var hasFocus=p.prayerFocus&&p.prayerFocus.trim();
 var focusEligible=hasFocus&&!allP.length&&doneSess.indexOf("focus")<0&&!S.events.some(function(e){return e.personId===p.id&&e.title==="Prayer focus"&&daysSince(e.ts)===0;});
 var focusOpen=visibility.prayer!==false&&focusEligible;
 if(!visP.length&&focusOpen)visP=[{id:"focus",focus:true,text:p.prayerFocus}];
 var padP=[];
 var waiting=waitR.length+waitS.length+waitP.length+(visP.some(function(x){return x.focus;})?1:0);
 var dayOrder=dayBlocks().map(function(block){return block.id;}),rows=[],rowOrder=0;
 function queueFrequency(item,type){
  if(type==="rhythm")return rhythmPeriod(item);
  if(type==="prayer"){
   if(item.focus)return Infinity;
   var frequency=prayerFreq(item);
   if(frequency==="selectdays")return 7/Math.max(1,(item.weekdays||[]).length);
   return {daily:1,weekly:7,monthly:30}[frequency]||Infinity;
  }
  return Infinity;
 }
 function queueRow(html,item,type){
  var time=dayOrder.indexOf(item.tod);
  rows.push({html:html,frequency:queueFrequency(item,type),time:time<0?dayOrder.length:time,order:rowOrder++});
 }
 function rhyRowQ(r,dim){
  var sub=tendRhythmMetaLabel(r,null,true);
  return '<div class="actrow'+(dim?" done":"")+'"><span class="act-ic" style="background:'+personHealthColor(rhythmScore(r))+'"></span><div class="pi-main">'+tendRowContent(r.text||"(unnamed rhythm)",String(r.description||"").trim(),sub,planPills({personId:p.id,rhythm:p.id+"|"+r.id}))+'</div>'+(dim?'<span class="praycount tend-type-metric">Tended \u2713</span>':rhyDoneBtn(p.id+"|"+r.id))+'</div>';
 }
 visR.forEach(function(r){queueRow(rhyRowQ(r,false),r,"rhythm");});
 padR.forEach(function(r){queueRow(rhyRowQ(r,true),r,"rhythm");});
 visS.forEach(function(s){var ownerId=s.profileOwnerId||p.id,meta=(s.time?fmtHM12(s.time)+" \u00b7 ":"")+sparkDueTxt(s);queueRow('<div class="actrow"><span class="act-ic" style="background:var(--forest)"></span><div class="pi-main">'+tendRowContent(s.text,s.details||"",meta,planPills({personId:p.id,spark:ownerId+"|"+s.id}))+'</div><button class="btn mini sparkbtn" data-sparkdo="'+ownerId+'|'+s.id+'|'+p.id+'">Do it</button></div>',s,"spark");});
 padS.forEach(function(s){var ownerId=s.profileOwnerId||p.id;queueRow('<div class="actrow done"><span class="act-ic" style="background:var(--forest)"></span><div class="pi-main">'+tendRowContent(s.text,s.details||"",sparkDueTxt(s),planPills({personId:p.id,spark:ownerId+"|"+s.id}))+'</div><span class="praycount tend-type-metric">Done \u2713</span></div>',s,"spark");});
 visP.forEach(function(x){var meta=x.focus?"Prayer focus":prayerScheduleLabel(x)+" \u00b7 Last prayed "+prayerLastPrayedLabel(x)+" \u00b7 Prayed "+(x.prayed||0)+" times";queueRow('<div class="actrow"><span class="act-ic" style="background:#5B7BA6"></span><div class="pi-main">'+tendRowContent(x.focus?'Prayer focus: '+x.text:x.text,x.details||"",meta,planPills({personId:p.id,prayer:x.id}))+'</div><button class="btn mini ghost" data-prayquick="'+p.id+'" data-prayref="'+(x.focus?"focus":x.id)+'">Pray</button></div>',x,"prayer");});
 padP.forEach(function(x){queueRow('<div class="actrow done"><span class="act-ic" style="background:#5B7BA6"></span><div class="pi-main">'+tendRowContent(x.focus?'Prayer focus: '+x.text:x.text,"","Prayed today",planPills({personId:p.id,prayer:x.id}))+'</div><span class="praycount tend-type-metric">Prayed \u2713</span></div>',x,"prayer");});
 var allWaiting=allR.filter(todayRhythmEligible).length+allS.filter(function(s){return (!s.by||sparkLive(s))&&doneSess.indexOf(s.id)<0;}).length+allP.filter(prayerIsDue).length+(focusEligible?1:0);
 var emptyMessage=waiting?"":allWaiting?"Items hidden by the type filters.":"Nothing waiting - these next steps are all tended.";
 var out='<div class="card act today-with-person" style="margin-bottom:14px"><div class="qhead"><div class="subhead" style="margin:0">Today with '+first+'</div><div class="today-queue-tools"><span class="qpill'+(waiting?"":" clear")+'">'+(waiting?waiting+" in queue":allWaiting?"items hidden":"all tended \u2713")+'</span>'+planKindTogglesHTML("person:"+p.id,"Today with "+p.name+" item filters")+'</div></div>';
 rows.sort(function(a,b){return a.frequency<b.frequency?-1:a.frequency>b.frequency?1:a.time-b.time||a.order-b.order;});
 if(rows.length)out+=rows.map(function(row){return row.html;}).join("");
 else out+='<div class="empty" style="margin-top:8px">'+emptyMessage+'</div>';
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
 var prayers=S.prayers.filter(function(x){return x.personId===pid||(Array.isArray(x.sharedWith)&&x.sharedWith.indexOf(pid)!==-1);}).map(function(item){return Object.assign({},item,{profileOwnerId:item.personId,profileViewingId:pid});});
 var kds=S.keyDates.filter(function(k){return k.personId===pid;});
 var ll=p.loveLanguage||"";
 var first=esc(p.name.split(" ")[0]);
 var bd=bdayInfo(p.birthday);
 /* head card: identity + health dashboard */
 var out='<div class="card detail open person-profile" id="personPanel"><div class="person-profile-head"><div class="person-identity">'+personAvatar(p,52)+'<div><h3>'+esc(p.name)+'</h3><div class="rel">'+esc(p.relation||"")+'</div></div></div><div class="profile-head-actions"><button class="pbtn" data-psettings="1" title="Person settings">\u2699</button><button class="pbtn" data-closeperson="1" title="Close">\u2715</button></div></div>';
 out+='<div class="person-health-heading"><div><h4>Tending health</h4><p>The rhythms and moments that keep you connected.</p></div><span class="person-profile-score">'+sc+'</span></div>'+personHealthMeter(sc,p.name)+'<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div><div class="chips">';
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
 var sparkConnection=edEv&&(edEv.origin==="spark"||edEv.note==="Spark landed"),rhythmConnection=edEv&&!!edEv.rhythmId,rhythmOwner=rhythmConnection&&connectionRhythmOwner(edEv),rhythmDraftRecord=rhythmOwner&&rhythmEditDraft&&rhythmEditDraft.id===edEv.rhythmId?rhythmEditDraft:rhythmOwner&&(rhythmOwner.rhythms||[]).find(function(item){return item.id===edEv.rhythmId;});
 var associationKey=edEv&&tendAssociationKey("connection","connection",edEv.id);
 if(edEv&&!tendItemAssociationDrafts[associationKey])tendItemAssociationDrafts[associationKey]={sharedWith:connectionParticipantIds(edEv),areas:connectionCategoryIds(edEv)};
 out+='<dialog class="ripple-dialog" id="rippleDialog" data-editor-modal aria-labelledby="rippleDialogTitle"><div class="box"><div class="subhead" id="rippleDialogTitle">'+(editingConn?'Edit Connection':'Add Connection')+'</div><p class="profile-tab-intro">Record a moment you shared with '+first+'.</p>';
 var rippleKind=edEv?(edEv.kind||edEv.type):"text";
 if(edEv&&!RIPPLE_TYPES[rippleKind])rippleKind="other";
 var rippleTime=edEv?new Date(edEv.ts||Date.now()):new Date();
 var rippleTimeValue=String(rippleTime.getHours()).padStart(2,"0")+":"+String(rippleTime.getMinutes()).padStart(2,"0");
 out+='<div class="ripple-fields">'+(edEv&&(rhythmConnection||sparkConnection)?'<div class="ripple-field"><span>Type</span><div class="ripple-type-value">'+(sparkConnection?"Spark":"Rhythm")+'</div></div>':'<label class="ripple-field">Type<select id="plogType">'+Object.keys(RIPPLE_TYPES).map(function(k){return '<option value="'+k+'"'+(rippleKind===k?' selected':'')+'>'+RIPPLE_TYPES[k]+'</option>';}).join("")+'</select></label>')+'<label class="ripple-field">Date<input type="date" id="momentDate" value="'+(edEv?fmtDate(edEv.ts||Date.now()):fmtDate(Date.now()))+'"></label><label class="ripple-field">Time<input type="time" id="momentTime" '+(edEv&&edEv.allDay?"disabled":"")+' value="'+rippleTimeValue+'"></label><label class="ripple-all-day"><input type="checkbox" id="momentAllDay" class="cb" '+(edEv&&edEv.allDay?"checked":"")+'> All Day</label></div>';
 out+='<div class="qlog" id="plogOtherRow" style="display:'+(rippleKind==="other"&&!(edEv&&(rhythmConnection||sparkConnection))?'flex':'none')+'"><input id="plogOther" aria-label="Other ripple type" value="'+esc(rippleKind==="other"&&edEv?(edEv.rippleLabel||edEv.kind||""):"")+'" placeholder="What kind of moment?" class="ripple-other"></div>';
 if(!rhythmConnection){
  out+='<div class="addrow" style="margin-top:8px"><input id="momentTitle" value="'+esc(edEv&&edEv.title&&edEv.title.indexOf("Time with")!==0?edEv.title:"")+'" placeholder="Title - e.g. Encouraging Message"></div>';
  out+='<div class="addrow" style="align-items:flex-start"><textarea id="momentNote" placeholder="Notes - what you want to remember..." style="min-height:70px;flex:1;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--canvas);font-size:15px">'+esc(edEv?(sparkConnection&&edEv.note==="Spark landed"?"":edEv.note||""):"")+'</textarea></div>';
 }
 if(edEv&&sparkConnection)out+=tendAssociationControlsHTML("connection","connection",edEv.id,edEv);
 if(edEv&&rhythmConnection){
  if(rhythmDraftRecord){
   var rhythmFieldId=rhythmOwner.id+"|"+rhythmDraftRecord.id;
   if(!rhythmEditDraft||rhythmEditDraft.id!==rhythmDraftRecord.id){rhythmEditDraft=JSON.parse(JSON.stringify(rhythmDraftRecord));editRhythmId=rhythmDraftRecord.id;rhythmDraftRecord=rhythmEditDraft;}
   out+='<div class="connection-rhythm-fields"><p class="profile-tab-intro">Rhythm details update the recurring rhythm; people and categories below apply to this logged connection.</p><label class="careplan-field">Rhythm<input data-rfield="'+esc(rhythmFieldId)+'|text" value="'+esc(rhythmDraftRecord.text||"")+'" placeholder="Rhythm name"></label><label class="careplan-field">Description (optional)<textarea data-rfield="'+esc(rhythmFieldId)+'|description" placeholder="Add context or details">'+esc(rhythmDraftRecord.description||"")+'</textarea></label>'+personRhythmScheduleHTML(rhythmDraftRecord,rhythmFieldId)+'</div>';
  }
  out+=tendAssociationControlsHTML("connection","connection",edEv.id,edEv);
 }
 out+='<div class="profile-editor-actions"><button class="btn" data-psubmit="'+pid+'">Save</button><button class="btn ghost" data-peditcancel="1" data-editor-cancel>Cancel</button>'+(editingConn?'<button class="btn mini danger" style="margin-left:auto" data-connectionundo="'+esc(editingConn)+'">'+(sparkConnection?"Restore":"Undo")+'</button>':'')+'</div>';
 out+='</div></dialog>';
 }
 activeProfileTab=profileTabs[pid]||"rhythms";
 var connections=evs.filter(connectionEvent);
 var counts={rhythms:sortedPersonRhythms(p).length,connection:connections.length,sparks:sortedPersonSparks(p).length,prayer:prayers.filter(function(x){return !x.answered&&!x.archived;}).length,notes:personNoteRecords(p).filter(function(f){return !f.done;}).length};
 out+='<div class="profile-tabs-row">'+(profileBadgePerson===pid?'<span class="profile-tabs-person">'+personAvatar(p,44)+'</span>':'')+'<div class="profile-tabs" role="tablist" aria-label="Person collections">'+[["rhythms","Rhythms"],["connection","Connection"],["sparks","Sparks"],["prayer","Prayer"],["notes","Notes"]].map(function(item){return '<button role="tab" id="profile-tab-'+item[0]+'" aria-controls="profile-panel-'+item[0]+'" aria-selected="'+(activeProfileTab===item[0])+'" data-profiletab="'+item[0]+'">'+collectionIcon(item[0])+item[1]+' <span class="tab-count">'+counts[item[0]]+'</span></button>';}).join('')+'</div></div>';
 out+=profilePanelStart("connection")+'<div class="connection-history-toolbar"><p class="profile-tab-intro">Shared moments add up and keep your connection strong.</p><button type="button" class="iconbtn rhythm-history-trigger" data-connection-history="'+esc(pid)+'" title="View connection history" aria-label="View connection history for '+esc(p.name)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button></div>';
 if(connections.length){
  out+='<div class="connection-list">'+connections.slice(0,5).map(rippleLine).join("")+'</div>';
  if(connections.length>5)out+='<button type="button" class="recent-moments-toggle" data-connection-list-view-all="'+esc(pid)+'">View All ('+connections.length+')</button>';
 }else out+='<div class="empty">No connections logged yet.</div>';
 out+='<div class="today-ripple"><button class="btn mini ghost" data-rippleopen="1">+ Log Connection</button></div>';
 out+='</section>';
 out+=profilePanelStart("rhythms")+'<p class="profile-tab-intro">Recurring practices that help you stay connected.</p>';
 var profileRhythms=sortedPersonRhythms(p);
 if(profileRhythms.length){profileRhythms.forEach(function(r){out+=rhythmRow(p,r);});}
 else out+='<div class="empty">No rhythms yet - add the recurring things that keep this relationship tended.</div>';
 var dO=rhythmDraft&&rhythmDraft.pid===pid;
 if(dO)out+='<dialog class="profile-editor-dialog" data-profile-editor="rhythm" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Rhythm</h3>'+draftRow(p)+'<div class="profile-editor-actions"><button class="btn mini" data-rhyadd="'+pid+'">Save Rhythm</button><button class="btn mini ghost" data-rhycancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';
 else out+='<div class="profile-add-action"><button class="btn mini ghost" data-rhyadd="'+pid+'">+ Add rhythm</button></div>';
 out+=rhythmPickerModalHTML();
 out+='</section>';
 out+=profilePanelStart("sparks")+'<p class="profile-tab-intro">Low-pressure ideas to enjoy together.</p>';
 var sps=sortedPersonSparks(p);
 if(sps.length){sps.forEach(function(s){
  var sparkOwnerId=s.profileOwnerId||pid,sparkBadges=tendAssociationPeopleBadges(s,sparkOwnerId,pid,"spark")+tendAssociationCategoryBadges(s);
  var sparkMeta=(s.time?fmtHM12(s.time)+" \u00b7 ":"")+sparkDueTxt(s)+(s.by?" \u00b7 "+s.by:"");
  out+='<div class="rhyrow" data-spark-row="'+esc(sparkOwnerId+"|"+s.id)+'"><span class="sm-dot" style="background:none;color:var(--forest);font-size:15px">\u2726</span><div class="gr-main">'+tendRowContent(s.text,s.details||"",sparkMeta,sparkBadges)+'</div><button class="btn mini" data-sparkdo="'+sparkOwnerId+'|'+s.id+'|'+pid+'">Do it</button><button class="iconbtn" data-sedit="'+sparkOwnerId+'|'+s.id+'" title="edit">\u270E</button><button class="iconbtn" data-spdel="'+sparkOwnerId+'|'+s.id+'|'+pid+'" title="remove">\u00D7</button></div>';
  if(editSparkId===s.id&&sparkEditDraft&&sparkEditDraft.id===s.id){out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="spark-editor-title"><div class="profile-editor-body"><h3 id="spark-editor-title">Edit Spark</h3><div class="addrow spark-draft"><input data-sfield="text" value="'+esc(sparkEditDraft.text)+'" placeholder="Spark text"><textarea data-sfield="details" placeholder="Details (optional)">'+esc(sparkEditDraft.details||"")+'</textarea><input type="date" data-sfield="by" value="'+esc(sparkEditDraft.by||"")+'" aria-label="Spark date" style="max-width:150px"><input type="time" data-sfield="time" value="'+esc(sparkEditDraft.time||"")+'" aria-label="Spark time" style="max-width:110px"><button class="btn mini ghost" data-scleardate="1">No date</button></div>'+tendAssociationControlsHTML("spark",sparkOwnerId,s.id,sparkEditDraft)+'<p class="profile-tab-intro">With a date it lands on the dashboard; without one it waits in Free moment.</p><div class="profile-editor-actions"><button class="btn mini" data-sparkeditsave="'+s.id+'">Save Spark</button><button class="btn mini ghost" data-sparkeditcancel data-editor-cancel>Cancel</button><button class="btn mini danger" data-spdel="'+sparkOwnerId+'|'+s.id+'|'+pid+'">'+(pid!==sparkOwnerId?"Remove Spark":"Delete Spark")+'</button></div></div></dialog>';}
 });}
 else out+='<div class="empty">No sparks yet - the fun, no-pressure "we should do this sometime" list.</div>';
 var addingSpark=sparkDraftOpenFor===pid;
 if(addingSpark)out+='<dialog class="profile-editor-dialog" data-profile-editor="spark" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Spark</h3><div class="addrow spark-draft"><input placeholder="Idea - a movie, a talk, a trip..." data-spnewtext="'+pid+'"><textarea placeholder="Details (optional)" data-spnewdetails="'+pid+'"></textarea><input type="date" data-spnewdate="'+pid+'" aria-label="Spark date" style="max-width:150px"><input type="time" data-spnewtime="'+pid+'" aria-label="Spark time" style="max-width:110px"></div>'+tendAssociationControlsHTML("spark",pid,"new",sparkAddDrafts[pid]||(sparkAddDrafts[pid]={sharedWith:[],areas:[]}))+'<div class="profile-editor-actions"><button class="btn mini" data-spadd="'+pid+'">Save Spark</button><button class="btn mini ghost" data-sparkaddcancel="'+pid+'" data-editor-cancel>Cancel</button></div></div></dialog>';
 else out+='<div class="profile-add-action"><button class="btn mini ghost" data-sparkaddopen="'+pid+'">+ Add spark</button></div>';
 out+='</section>';
 var addingPrayer=window._personPrayerDraftFor===pid;
 out+=profilePanelStart("prayer")+'<p class="profile-tab-intro">Prayer requests to remember and bring before God.</p>'+prayerList(prayers,true);
 if(addingPrayer)out+='<dialog class="profile-editor-dialog" data-profile-editor="prayer" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Prayer</h3>'+personPrayerAddFields(pid)+'</div></dialog>';
 else out+='<div class="person-prayer-add"><div class="person-prayer-form-actions"><button class="btn mini ghost" data-personprayeropen="'+pid+'">+ Add prayer</button></div></div>';
 out+='</section>';
 out+=profilePanelStart("notes")+'<p class="profile-tab-intro">Keep useful thoughts, encouragement, prayer, and follow-ups together.</p>';
 out+='<div class="person-notes">'+notesChecklist(p,noteDraftOpenFor===pid?"":'<div class="profile-add-action"><button class="btn mini ghost" data-profilenoteopen="'+pid+'">+ Add note</button></div>')+'</div>';
 if(noteDraftOpenFor===pid){var noteDraft=noteAddDrafts[pid]||(noteAddDrafts[pid]={personId:pid,sharedWith:[],areas:[]});out+='<dialog class="profile-editor-dialog" data-profile-editor="note" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Note</h3><label class="profile-note-type">Type<select id="profileNoteKind">'+noteKindOptions("general")+'</select></label><label class="profile-note-type">Title<input id="profileNoteTitle" placeholder="A short title"></label><label class="profile-note-type">Details<textarea id="profileNoteDetails" placeholder="Add details (optional)"></textarea></label>'+tendAssociationControlsHTML("followup",pid,"new",noteDraft)+'<div class="profile-editor-actions"><button class="btn mini" data-profilenotesave="'+pid+'">Save Note</button><button class="btn mini ghost" data-profilenotecancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';}
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
function connectionRhythm(e){
 var rhythm=null;
 if(e.personId){var person=S.people.find(function(item){return item.id===e.personId;});rhythm=person&&(person.rhythms||[]).find(function(item){return item.id===e.rhythmId;});}
 if(!rhythm)S.people.some(function(person){rhythm=(person.rhythms||[]).find(function(item){return item.id===e.rhythmId;});return !!rhythm;});
 if(!rhythm&&S.rhythms)rhythm=S.rhythms.find(function(item){return item.id===e.rhythmId;});
 if(!rhythm&&S.areaRhythms)rhythm=S.areaRhythms.find(function(item){return item.id===e.rhythmId;});
 return rhythm;
}
function connectionRhythmOwner(e){
var owner=null;if(e&&e.rhythmId)S.people.some(function(person){if((person.rhythms||[]).some(function(item){return item.id===e.rhythmId;})){owner=person;return true;}return false;});return owner;
}
function connectionSpark(e){
 var owner=S.people.find(function(person){return person.id===(e.sparkOwnerId||e.personId);}),spark=owner&&(owner.sparks||[]).find(function(item){return e.sparkId?item.id===e.sparkId:item.done&&item.text===e.title&&Number.isFinite(item.doneTs)&&Math.abs(item.doneTs-e.ts)<60000;});
 if(!spark&&!e.sparkId)S.people.some(function(person){var match=(person.sparks||[]).find(function(item){return item.done&&item.text===e.title&&Number.isFinite(item.doneTs)&&Math.abs(item.doneTs-e.ts)<60000;});if(match){owner=person;spark=match;return true;}return false;});
 return {owner:owner,spark:spark};
}
function connectionParticipantIds(e){
 var ids=Array.isArray(e.personIds)?e.personIds.slice():(e.personId?[e.personId]:[]);
 if(e.origin==="spark"||e.note==="Spark landed"){var sparkData=connectionSpark(e);if(sparkData.spark&&sparkData.owner)[sparkData.owner.id].concat(sparkData.spark.sharedWith||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});}
 else if(e.rhythmId&&!Array.isArray(e.personIds)){var rhythm=connectionRhythm(e);if(rhythm)(rhythm.sharedWith||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});}
 return ids.filter(function(id,index){return id&&ids.indexOf(id)===index&&S.people.some(function(person){return person.id===id;});});
}
function connectionCategoryIds(e){
 if(Array.isArray(e.areas))return e.areas;
 if(e.origin==="spark"||e.note==="Spark landed"){var sparkData=connectionSpark(e);return sparkData.spark&&Array.isArray(sparkData.spark.areas)?sparkData.spark.areas:[];}
 var rhythm=e.rhythmId&&connectionRhythm(e);return rhythm&&typeof window.tendRhythmCategoryIds==="function"?window.tendRhythmCategoryIds(rhythm):[];
}
function rippleLine(e){
 var title=(e.title&&e.title.indexOf("Time with")!==0)?e.title.replace(/^Prayer: /,""):"";
 var isSpark=e.origin==="spark"||e.note==="Spark landed";
 var typeBadge=e.rhythmId?'<span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>':(isSpark?'<span class="pill spk">'+collectionIcon("sparks")+' Spark</span>':'<span class="pill touch">'+esc(typeLabel(e))+'</span>');
 var rhythm=e.rhythmId&&connectionRhythm(e),details=e.note&&e.note!=="Spark landed"?e.note:rhythm&&rhythm.description||"",rhythmMeta="";
 if(rhythm)title=rhythm.text||title;
 if(rhythm){
  rhythmMeta=tendRhythmMetaLabel(rhythm,e.ts,false);
 }
 var timestamp=rhythmMeta||when(e.ts)+(daysSince(e.ts)===0&&!e.allDay?" "+fmtHM(e.ts):"");
 timestamp=timestamp.replace(/^today\b/,"Today");
 var connectionPeople=connectionParticipantIds(e);
 var otherParticipants=connectionPeople.filter(function(id,index,ids){return id&&id!==(currentPerson||e.personId)&&ids.indexOf(id)===index;}).map(function(id){var person=S.people.find(function(item){return item.id===id;});return person?'<button type="button" class="prayer-person person-badge-clickable" data-personbadge="'+esc(person.id)+'|connection" aria-label="Open '+esc(person.name)+' connection">'+personAvatar(person,24)+esc(person.name)+'</button>':"";}).join("");
 var connectionCategories=connectionCategoryIds(e),categories=otherParticipants+(typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges({areas:connectionCategories}):"");
 return '<div class="logline moment-row"><div class="moment-type">'+typeBadge+'</div><div class="gr-main">'+tendRowContent(title||"Connection",details,timestamp,categories)+'</div><span class="entry-actions"><button class="iconbtn" data-evedit="'+e.id+'" title="Edit connection" aria-label="Edit connection">\u270E</button><button class="iconbtn" data-evdel="'+e.id+'" title="Delete connection" aria-label="Delete connection">\uD83D\uDDD1</button></span></div>';
}
/* ============ free moment + spark chip ============ */
function sparkChip(p){var s=sortedPersonSparks(p)[0];if(!s)return "";return '<div class="pf-next" style="color:var(--forest)">\u2726 '+esc(s.text)+' \u00b7 '+esc(sparkDueTxt(s))+'</div>';}
function freeMomentHTML(){
 var cands=[],seenSparks=Object.create(null);
 S.people.forEach(function(p){(p.rhythms||[]).forEach(function(r){var d=rhythmDaysSince(r);if((r.tod||"anytime")==="anytime"&&rhythmScheduledToday(r))cands.push({pri:10+(d===999?0:d),rhythm:p.id+"|"+r.id,personId:p.id,label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});});
 S.people.forEach(function(p){sortedPersonSparks(p).forEach(function(s){if(sparkLive(s)&&!s.by){var key=(s.profileOwnerId||p.id)+"|"+s.id;if(seenSparks[key])return;seenSparks[key]=true;cands.push({pri:15,spark:key+"|"+p.id,personId:p.id,label:s.text,description:s.details||"",sub:"No deadline yet",act:' data-sparkdo="'+key+"|"+p.id+'"',btn:"Do it"});}});});
 var lo=S.people.map(function(p){return {p:p,s:personScore(p)};}).sort(function(a,b){return a.s-b.s;})[0];
 if(lo&&lo.s<80)cands.push({pri:(100-lo.s)/10,label:"Reach out to "+lo.p.name,sub:(lo.p.relation||"")+" \u00b7 meter "+lo.s+" - lowest",act:' data-openperson="'+lo.p.id+'"',btn:"Open"});
 cands.sort(function(a,b){return b.pri-a.pri;});
 if(!cands.length)return "";
 var out='<div class="sectiontitle"><h2>Free moment?</h2><span class="hint">Your best options right now (up to 4)</span></div><div class="card dashboard-free-moment">';
 cands.slice(0,4).forEach(function(c){var bb=c.rhythm?rhyDoneBtn(c.rhythm):'<button class="btn mini'+(c.spark?" sparkbtn":"")+'"'+c.act+'>'+c.btn+'</button>',meta=planItemMetaBar(c.sub);out+='<div class="planitem"><div class="pi-main">'+planItemCopy(c)+(meta?"":(c.sub?'<div class="tend-type-meta">'+esc(c.sub)+'</div>':""))+'</div>'+bb+meta+'</div>';});
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
var editSparkId=null,sparkEditOwnerId=null,sparkEditDraft=null,sparkDraftOpenFor=null,noteDraftOpenFor=null,personKeyDateDraftFor=null;
var editRhythmId=null, rhythmEditDraft=null;
var rhythmDraft=null;
var tab="today",openDetail=null,currentArea=null,currentPerson=null,profileBadgePerson=null,rhythmPickerDraft=null;
window._actDone={};window._psModalOpen=false;

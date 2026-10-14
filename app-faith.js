"use strict";
/* ============ Faith practice page ============ */
var FAITH_GROUPS=["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
var faithRhythmDraft=null,faithSparkDraft=null,faithSparkEditId=null,faithSparkOwnerId="faith",faithNotesExpanded=false,faithNotesDestinationOpen=false,faithPrayerDraftOpen=false,faithPrayerExpanded=false,faithTodayExpanded=false,faithMainView="practices",faithMainViewInitialized=false,faithShowAllRhythms=false,faithPrayerSession=null,dashboardPrayerPeople=null,dashboardPrayerTimeMode="now",personDashboardPrayerTimeModes={},personDashboardPrayerPeople={},prayerSelectionDraft=null,prayerPageTimeMode="now",prayerPagePeople=null,faithRequestPrayerTimeMode=null;
var FAITH_MAIN_VIEWS=["practices","today","prayer"];
var faithGroupDescriptions={
 Sabbath:"A weekly invitation to pause, delight, and reconnect with God.",
 Prayer:"Build a steady rhythm of prayer and make room to listen.",
 Fasting:"Explore intentional practices of simplicity and attentiveness.",
 Solitude:"Make room for quiet, reflection, and listening.",
 Generosity:"Practice open-handed living with what you have.",
 Community:"Strengthen belonging through shared worship and life together.",
 Service:"Turn care for others into regular acts of service.",
 Witness:"Live and share your faith with the people around you.",
 Scripture:"Build a steady practice of reading and reflecting on Scripture.",
 Other:"A home for spiritual practices that do not fit another section."
};
var faithLegacyGroupDescriptions={
 Sabbath:["A full day of rest, delight, and presence with God and others."],
 Prayer:["A place to hold your active requests and make room for focused prayer.","Bring today's requests before God, or set aside focused time to pray.","Conversational communion with God — speaking and listening."],
 Fasting:["Voluntarily abstaining from food to create space for God."],
 Solitude:["Withdrawing from noise and people to be alone with God."],
 Generosity:["Giving away money, time, or resources as an act of worship."],
 Community:["Meeting with the people of God for worship, teaching, and life together."],
 Service:["Using your gifts and time to serve others in love."],
 Witness:["Telling others about Jesus through word and deed."],
 Scripture:["Immersing yourself in the Bible to know and love God more."],
 Other:["Practices that do not fit another section."]
};
function faithConfig(){
 S.faithConfig=S.faithConfig||defaultFaithConfig();
 S.faithConfig.disabledGroups=Array.isArray(S.faithConfig.disabledGroups)?S.faithConfig.disabledGroups:[];
 S.faithConfig.groupDescriptions=Object.assign({},faithGroupDescriptions,S.faithConfig.groupDescriptions||{});
 var migrated=false;
 FAITH_GROUPS.forEach(function(group){if(faithLegacyGroupDescriptions[group].indexOf(S.faithConfig.groupDescriptions[group])>=0){S.faithConfig.groupDescriptions[group]=faithGroupDescriptions[group];migrated=true;}});
 if(migrated)save();
 if(!String(S.faithConfig.groupDescriptions.Other||"").trim())S.faithConfig.groupDescriptions.Other=faithGroupDescriptions.Other;
 return S.faithConfig;
}
function faithSelectedGroup(){var group=faithConfig().selectedGroup;return FAITH_GROUPS.indexOf(group)>=0?group:"Sabbath";}
function faithSelectedPrayerView(){
 var config=faithConfig(),view=config.prayerView;
 if(view==="mine"){config.prayerView="all";config.prayerPeople=["me"];config.prayerGroups={marriage:false,parenting:false,friendships:false};save();return "all";}
 return view==="today"?"today":"all";
}
function faithPracticeTab(group){var tabs=faithConfig().practiceTabs||{},tab=tabs[group];if(tab==="notes"||tab==="prayer")return "rhythms";return ["rhythms","sparks"].indexOf(tab)>=0?tab:"rhythms";}
function faithGroupEnabled(group){return faithConfig().disabledGroups.indexOf(group)<0;}
function faithIsLegacyPrayerSeed(r){
 return !r.faithUserCreated&&!r.legacyPrayerSeed&&r.category==="faith"&&r.faithGroup==="Prayer"&&r.text==="Prayer time"&&r.description==="Conversational communion with God — speaking and listening."&&r.freq==="daily"&&r.tod==="early"&&!S.events.some(function(event){return event.areaId==="faith"&&event.rhythmId===r.id;});
}
function faithMigrateData(){
 var changed=false;
 S.rhythms.forEach(function(r,index){
  if(r.category!=="faith"&&!r.faithGroup)return;
  var group=FAITH_GROUPS.indexOf(r.faithGroup)>=0?r.faithGroup:FAITH_GROUPS.indexOf(r.group)>=0?r.group:"Other";
  if(!r.id){r.id="faith-"+group.toLowerCase()+"-"+index;changed=true;}
  if(r.faithGroup!==group){r.faithGroup=group;changed=true;}
  if(r.category!=="faith"){r.category="faith";changed=true;}
  if(!r.added&&!r.start){r.added=todayStr();changed=true;}
  if(r.freq==="weekly"&&!Array.isArray(r.weekdays)){r.weekdays=r.scheduleDow==null?[]:[+r.scheduleDow];changed=true;}
  if(r.freq==="twicewk"){r.freq="custom";r.every=3;r.unit="days";changed=true;}
  if(r.freq==="biweekly"){r.freq="custom";r.every=2;r.unit="weeks";r.weekdays=[+(r.scheduleDow||0)];changed=true;}
  if(r.freq==="custom"&&r.customType){
   if(r.customType==="monthly"){r.freq="monthly";r.monthlyMode="onThe";r.ord=+r.customOrd||1;r.ordWeekday=+r.customDow||0;}
   else{r.freq="weekly";r.weekdays=[+(r.customDow||0)];}
   delete r.customType;delete r.customDow;delete r.customOrd;changed=true;
  }
  if(faithIsLegacyPrayerSeed(r)){r.legacyPrayerSeed=true;changed=true;}
 });
 S.ideas.forEach(function(item,index){
  var isFaithSpark=item.category==="faith"||item.area==="faith"||!!item.faithSection;
  if(isFaithSpark&&!item.id){item.id=uid()+"-"+index;changed=true;}
  if(isFaithSpark&&(item.category!=="faith"||item.area!=="faith")){item.category="faith";item.area="faith";changed=true;}
  if(isFaithSpark&&!item.faithSection){item.faithSection="Other";changed=true;}
  if(isFaithSpark){item.areas=Array.isArray(item.areas)?item.areas:[];if(item.areas.indexOf("faith")<0){item.areas.push("faith");changed=true;}}
 });
 S.followups.forEach(function(item,index){
  if(!item.personId&&item.kind==="faith-note"&&!item.id){item.id=uid()+"-"+index;changed=true;}
 });
 S.prayers.forEach(function(item,index){
  if(item.faithOwner==="me"&&!item.id){item.id=uid()+"-"+index;changed=true;}
 });
 if(changed)save();
}
function faithRhythms(group){
 return S.rhythms.filter(function(r){return r.category==="faith"&&r.faithGroup===group&&!r.disabled&&!r.legacyPrayerSeed&&!rhythmEnded(r);});
}
function faithPracticeRhythmRecords(group){
 var rhythms=faithRhythms(group),seen={};
 rhythms.forEach(function(r){seen[r.id]=true;});
 if(group==="Prayer"){
  var linked=[];
  (S.people||[]).forEach(function(person){(person.rhythms||[]).forEach(function(r){linked.push(r);});});
  (S.areaRhythms||[]).forEach(function(r){linked.push(r);});
  linked.forEach(function(r){
   var linkedToFaith=r.category==="faith"||Array.isArray(r.areas)&&r.areas.indexOf("faith")>=0||FAITH_GROUPS.indexOf(r.faithGroup)>=0;
   if(linkedToFaith&&(r.faithGroup||"Prayer")===group&&!r.disabled&&!rhythmEnded(r)&&!seen[r.id]){seen[r.id]=true;rhythms.push(r);}
  });
 }
 return rhythms;
}
function faithActiveRhythms(){
 return S.rhythms.filter(function(r){return r.category==="faith"&&r.faithGroup&&r.faithGroup!=="Prayer"&&faithGroupEnabled(r.faithGroup)&&!r.disabled&&!r.legacyPrayerSeed&&!rhythmEnded(r);});
}
function faithActivePrayers(){return S.prayers.filter(function(p){return !p.answered&&!p.archived;});}
function faithPrayerScheduledToday(p){return !!(p&&p.freq&&p.freq!=="none"&&prayerOccurs(p,todayStr()));}
function faithPrayerForToday(p){return faithActivePrayers().indexOf(p)>=0&&faithPrayerScheduledToday(p);}
function faithTodayPrayerCount(){return faithActivePrayers().filter(faithPrayerForToday).length;}
function faithAllRhythmRecords(){
 var rhythms=[],seen={};
 faithPracticeGroups().forEach(function(group){
  faithPracticeRhythmRecords(group).forEach(function(rhythm){
   if(!seen[rhythm.id]){seen[rhythm.id]=true;rhythms.push(rhythm);}
  });
 });
 return rhythms;
}
function faithScoreText(score){return Number.isFinite(score)?String(score):"—";}
function faithScoreClass(score){return Number.isFinite(score)?scoreClass(score):"neutral";}
function faithNavScoreHTML(score){
 if(!Number.isFinite(score))return '<span class="faith-nav-score faith-nav-score-unavailable" aria-label="Health score unavailable">—</span>';
 var level=faithScoreClass(score);
 return '<span class="rhythm-health faith-nav-score '+level+'" aria-label="Health score '+score+' out of 100"><span class="sm-dot '+level+'" aria-hidden="true"></span><span>'+score+'</span></span>';
}
function faithPracticeHealthParts(){
 var rhythms=avg(faithPracticeRhythmRecords("Prayer").map(function(r){return rhythmScore(r);}));
 var prayers=avg(faithActivePrayers().map(function(p){return prayerScore(p);}));
 return {rhythms:rhythms,prayers:prayers};
}
function faithPracticeHealth(group){
 if(group!=="Prayer")return avg(faithPracticeRhythmRecords(group).map(function(r){return rhythmScore(r);}));
 var parts=faithPracticeHealthParts(),rhythms=parts.rhythms,prayers=parts.prayers;
 var total=0,weight=0;
 if(rhythms!==null){total+=.4*rhythms;weight+=.4;}
 if(prayers!==null){total+=.3*prayers;weight+=.3;}
 return weight?Math.round(total/weight):null;
}
function faithPrayerRequestHealthHTML(){
 var parts=faithPracticeHealthParts(),prayers=faithActivePrayers();
 var score=parts.prayers,scoreText=faithScoreText(score),scoreClass=faithScoreClass(score),count=prayers.length;
 return '<button type="button" class="faith-prayer-request-health" data-faith-prayer-requests="1" aria-label="Prayer health '+(score===null?"unavailable":score+" out of 100")+', '+count+' active prayer'+(count===1?"":"s")+'"><span class="faith-prayer-request-health-heading"><span><strong>Prayer health</strong><span>'+count+' prayer'+(count===1?"":"s")+'</span></span><span class="faith-prayer-request-health-score '+scoreClass+'">'+scoreText+'</span></span><span class="faith-prayer-request-health-meter" role="meter" aria-label="Prayer health" aria-valuemin="0" aria-valuemax="100"'+(score===null?' aria-valuetext="No score available"':' aria-valuenow="'+score+'" aria-valuetext="'+score+' out of 100"')+'><span class="'+scoreClass+'" style="width:'+(score===null?0:score)+'%"></span></span></button>';
}
function faithTimeRank(tod){if(tod==="allday")return -1;var blocks=dayBlocks(),index=blocks.findIndex(function(block){return block.id===tod;});return index<0?blocks.length:index;}
function faithPracticeCount(group){return faithRhythms(group).length+(typeof window.faithLinkedRhythmCount==="function"?window.faithLinkedRhythmCount(group):0);}
function faithPracticeGroups(){return FAITH_GROUPS.filter(faithGroupEnabled);}
function faithInitialMainView(group){
 if(faithMainViewInitialized)return;
 faithMainViewInitialized=true;
 var legacyTab=(faithConfig().practiceTabs||{})[group];
 faithMainView=legacyTab==="prayer"||legacyTab==="requests"?"prayer":legacyTab==="today"?"today":"practices";
}
function faithSetMainView(view,focus){
 if(FAITH_MAIN_VIEWS.indexOf(view)<0)return;
 faithMainView=view;
 var nav=document.querySelector(".faith-view-nav");
 if(!nav)return;
 nav.querySelectorAll("[data-faith-view-select]").forEach(function(button){
  var selected=button.getAttribute("data-faith-view-select")===view;
  button.setAttribute("aria-selected",String(selected));
  button.tabIndex=selected?0:-1;
 });
 nav.parentElement.querySelectorAll("[data-faith-view-panel]").forEach(function(panel){
  panel.hidden=panel.getAttribute("data-faith-view-panel")!==view;
 });
 if(focus){var active=nav.querySelector('[data-faith-view-select="'+view+'"]');if(active)active.focus({preventScroll:true});}
}
function faithScrollToHeading(target){
 if(!target)return;
 var behavior=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";
 target.focus({preventScroll:true});
 target.scrollIntoView({behavior:behavior,block:"start"});
}
function faithShowPracticeView(showAll,group,headingId){
 if(group&&FAITH_GROUPS.indexOf(group)>=0)faithConfig().selectedGroup=group;
 faithShowAllRhythms=!!showAll;
 faithMainView="practices";
 faithMainViewInitialized=true;
 tendPendingFaithScrollAnchor=null;
 render();
 requestAnimationFrame(function(){requestAnimationFrame(function(){faithScrollToHeading(document.getElementById(headingId||(faithShowAllRhythms?"faithAllRhythmsTitle":"faithPracticeTitle")));});});
}
function faithViewNavHTML(){
 var labels={today:"Today",prayer:"Prayer",practices:"Practices"};
 return '<div class="faith-view-nav" role="tablist" aria-label="Faith views">'+FAITH_MAIN_VIEWS.map(function(view){var selected=faithMainView===view;return '<button type="button" role="tab" id="faith-view-tab-'+view+'" aria-controls="faith-view-panel-'+view+'" aria-selected="'+selected+'" tabindex="'+(selected?"0":"-1")+'" data-faith-view-select="'+view+'">'+labels[view]+'</button>';}).join("")+'</div>';
}
function faithViewHeaderHTML(title,description,trailingHTML,titleId,focusable){
 return '<header class="faith-view-header"><div class="faith-view-header-row"><h2 class="faith-view-header-title"'+(titleId?' id="'+esc(titleId)+'"':"")+(focusable?' tabindex="-1"':"")+'>'+esc(title)+'</h2>'+(trailingHTML||"")+'</div>'+(description?'<p class="faith-view-header-description">'+esc(description)+'</p>':"")+'</header>';
}
function faithViewPanelHTML(view,content){
 return '<section class="faith-view-panel" role="tabpanel" id="faith-view-panel-'+view+'" aria-labelledby="faith-view-tab-'+view+'" data-faith-view-panel="'+view+'"'+(faithMainView===view?"":" hidden")+'>'+content+'</section>';
}
function faithTodayRhythms(){
 return faithAllRhythmRecords().filter(todayRhythmEligible).sort(function(a,b){
  return rhythmPeriod(a)-rhythmPeriod(b)||rhythmScore(a)-rhythmScore(b)||String(a.text||"").localeCompare(String(b.text||""));
 });
}
function faithTodayHTML(){
 var rhythms=faithTodayRhythms(),sparks=faithSparkRecords().filter(function(s){var group=s.faithSection||s.faithGroup||(s.profileOwnerId!=="faith"?"Prayer":"Other");return faithGroupEnabled(group)&&!s.done&&(!s.by||sparkLive(s));});
 function rhythmCard(r){
  var owner=S.people.find(function(person){return (person.rhythms||[]).some(function(item){return item.id===r.id;});}),metadata=window.tendRhythmCardMetadata(r);
  return tendRhythmCardHTML(r,{title:r.text||"(unnamed rhythm)",description:r.description,peopleBadgesHTML:tendAssociationPeopleBadges(r,owner?owner.id:"faith",null,"rhythm"),categoryBadgesHTML:tendAssociationCategoryBadges(r),
   frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
   tendAttributes:{"data-tend-open":"faith-rhythm","data-rhythm-id":r.id},showScore:false});
 }
 function sparkCard(s){
  var owner=s.profileOwnerId||"faith",badges=tendAssociationPeopleBadges(s,owner,null,"spark")+tendAssociationCategoryBadges(s);
  return tendSparkCardHTML(s,{title:s.text||"Faith Spark",description:s.details,actionHTML:'<button type="button" class="btn mini sparkbtn" data-faith-sparkdone="'+esc(owner+"|"+s.id)+'">Do it</button>',
   topMetaHTML:badges?'<div class="plan-item-top-meta">'+badges+'</div>':'',footerHTML:'<span class="dashboard-spark-deadline">'+esc((s.time?fmtHM12(s.time)+" · ":"")+sparkDueTxt(s))+'</span>',className:"faith-today-spark"});
 }
 var scheduledCount=rhythms.length,count=scheduledCount+sparks.length,visibleRhythms=faithTodayExpanded?rhythms:rhythms.slice(0,3),expandToday=scheduledCount>3?'<button type="button" class="btn mini ghost faith-today-expand" data-faith-today-expand="'+(faithTodayExpanded?"fewer":"all")+'">'+(faithTodayExpanded?"Show fewer":"View all for today ("+scheduledCount+")")+'</button>':"";
 var out='<div class="faith-today-content">'+faithViewHeaderHTML("Today in Faith","",'<span class="qpill'+(count?"":" clear")+'">'+(count?count+" for today":"nothing due today")+'</span>',"faithTodayTitle");
 out+='<section class="faith-today-section" aria-labelledby="faithTodayTitle"><div class="faith-today-list">'+(visibleRhythms.length?visibleRhythms.map(rhythmCard).join(""):'<div class="profile-empty-state">No rhythms due today.</div>')+'</div>'+expandToday+'</section>';
 out+=tendSectionHeaderHTML({title:"Sparks",className:"faith-today-subheading"})+'<div class="faith-today-sparks">'+(sparks.length?sparks.map(sparkCard).join(""):'<div class="profile-empty-state faith-today-empty">No Sparks waiting.</div>')+'</div>';
 return out+'</div>';
}
function faithOverallHealth(rhythms,prayers){
 var total=0,weight=0;
 if(rhythms!==null){total+=.4*rhythms;weight+=.4;}
 if(prayers!==null){total+=.3*prayers;weight+=.3;}
 return weight?Math.round(total/weight):null;
}
function faithScores(){
 var rhythms=faithAllRhythmRecords(),prayers=faithActivePrayers(),rhythmScoreValue=avg(rhythms.map(function(r){return rhythmScore(r);})),prayerScoreValue=avg(prayers.map(function(p){return prayerScore(p);}));
 return {overall:faithOverallHealth(rhythmScoreValue,prayerScoreValue),rhythms:rhythms};
}
function faithHealthHTML(){
 var rhythms=faithAllRhythmRecords(),prayers=faithActivePrayers(),rhythmScoreValue=avg(rhythms.map(function(r){return rhythmScore(r);})),prayerScoreValue=avg(prayers.map(function(p){return prayerScore(p);})),overall=faithOverallHealth(rhythmScoreValue,prayerScoreValue),level=faithScoreClass(overall);
 var latestRhythmEvent=null;
 rhythms.forEach(function(rhythm){var event=rhythmLast(rhythm);if(event&&(!latestRhythmEvent||Number(event.ts)>Number(latestRhythmEvent.ts)))latestRhythmEvent=event;});
 var latestPrayer=null;
 prayers.forEach(function(prayer){var logs=prayerLogsFor(prayer),last=logs.length?logs[logs.length-1]:null;if(last!==null&&(!latestPrayer||last>latestPrayer.ts))latestPrayer={prayer:prayer,ts:last};});
 var latestRhythmText=latestRhythmEvent?"Last tended: "+when(latestRhythmEvent.ts):"Last tended: Never";
 var latestPrayerText=latestPrayer?"Last prayed: "+prayerLastPrayedLabel(latestPrayer.prayer):"Last prayed: Never";
 var latestRhythmDate=latestRhythmEvent?when(latestRhythmEvent.ts):"Never";
 var latestPrayerDate=latestPrayer?prayerLastPrayedLabel(latestPrayer.prayer):"Never";
 function summaryItem(key,label,value){
  var count=key==="rhythms"?rhythms.length:prayers.length,countLabel=key==="rhythms"?"active rhythm":"active prayer",lastText=key==="rhythms"?latestRhythmText:latestPrayerText,lastDate=key==="rhythms"?latestRhythmDate:latestPrayerDate,activityIcon=key==="rhythms"?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 5.2A5.5 5.5 0 0 0 3 4.1L2 5.2m0 0V2.7m0 2.5h2.5M2.8 10.8A5.5 5.5 0 0 0 13 11.9l1-1.1m0 0v2.5m0-2.5h-2.5"/></svg>':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.5s-5.5-3.2-5.5-7A3 3 0 0 1 8 5.2a3 3 0 0 1 5.5 1.3c0 3.8-5.5 7-5.5 7Z"/></svg>',calendarIcon='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="3.5" width="11.6" height="10" rx="1.5"/><path d="M5 2v3m6-3v3M2.5 6.5h11"/></svg>';
  return {label:label,score:value,actionAttributes:{"data-faith-health-nav":key},ariaLabel:label+", health score "+(Number.isFinite(value)?faithScoreText(value)+" out of 100":"unavailable")+", "+count+" "+countLabel+(count===1?"":"s")+", "+lastText,detailHTML:'<span>'+activityIcon+'<span>'+esc(count+" active")+'</span></span><span>'+calendarIcon+'<span>'+esc(lastDate)+'</span></span>'};
 }
 var summaries=tendScoreBreakdownHTML([summaryItem("rhythms","Rhythms",rhythmScoreValue),summaryItem("prayer","Prayer",prayerScoreValue)],{columns:2,label:"Faith health summaries"});
 return tendCategoryHealthSummaryHTML({title:"Overall Faith health",titleId:"faithHealthTitle",score:overall,status:overall===null?"No active Faith health scores":scoreLabel(overall),className:"faith-health-card",breakdownHTML:summaries});
}
function faithSettingsHTML(){
 return '<section class="faith-sections-settings" aria-labelledby="faithSectionsTitle"><div class="faith-settings-heading"><div><h2 id="faithSectionsTitle">Faith sections</h2><p>Choose which practice sections appear on the Faith page.</p></div></div><div class="faith-settings-list">'+FAITH_GROUPS.map(function(group){return '<label><input type="checkbox" data-faith-enabled="'+esc(group)+'"'+(faithGroupEnabled(group)?" checked":"")+'><span>'+esc(group)+'</span></label>';}).join("")+'</div><details class="faith-settings-notes"'+(faithNotesDestinationOpen?" open":"")+'><summary id="faithNotesTitle">View Faith notes</summary>'+faithNotesHTML()+'</details></section>';
}
function faithSectionNavHTML(selected){
 return '<nav class="faith-section-nav" aria-label="Faith practices">'+FAITH_GROUPS.map(function(group){
  var score=faithPracticeHealth(group);
  return '<button type="button" data-faith-select="'+esc(group)+'" aria-pressed="'+(group===selected)+'"><span>'+esc(group)+'</span><span class="faith-nav-meta"><span class="faith-count">'+faithPracticeCount(group)+'</span>'+faithNavScoreHTML(score)+'</span></button>';
 }).join("")+'</nav>';
}
function faithRhythmEditorHTML(r){
 var isNew=!r.id,idf="faith|"+(r.id||"draft");
 var groupPicker=r.aggregateCategoryRequired&&isNew?'<label>Faith practice<select required data-faith-rhythm-group><option value="">Choose a practice</option>'+FAITH_GROUPS.map(function(group){return '<option value="'+esc(group)+'"'+(r.faithGroup===group?' selected':'')+'>'+esc(group)+'</option>';}).join("")+'</select></label>':"";
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="faith-rhythm-editor-title"><div class="profile-editor-body faith-item-editor" data-faith-rhythm-editor><h3 id="faith-rhythm-editor-title">'+(isNew?"Add Rhythm":"Edit Rhythm")+'</h3><label>Title<input data-faith-title value="'+esc(r.text||"")+'" placeholder="Practice title"></label><label>Description<textarea data-faith-description placeholder="Why this practice matters (optional)">'+esc(r.description||"")+'</textarea></label>'+groupPicker+personRhythmScheduleHTML(r,idf)+rhythmPickerControlsHTML("faith",r,idf,true)+'<div class="faith-item-actions"><button type="button" class="btn mini" data-faith-rhythm-save="'+(isNew?"new":esc(r.id))+'">Save Rhythm</button><button type="button" class="btn mini ghost" data-faith-rhythm-cancel="1" data-editor-cancel>Cancel</button>'+(isNew?"":'<button type="button" class="btn mini danger" data-faith-rhythm-delete="'+esc(r.id)+'">Delete</button>')+'</div></div></dialog>'+rhythmPickerModalHTML();
}
function faithRhythmRowHTML(r){
 if(faithRhythmDraft&&faithRhythmDraft.id===r.id)return faithRhythmEditorHTML(faithRhythmDraft);
 var score=rhythmScore(r),metadata=window.tendRhythmCardMetadata(r);
 return tendRhythmCardHTML(r,{title:r.text||"(unnamed rhythm)",description:r.description,score:Number.isFinite(score)?score:null,scoreClass:faithScoreClass(score),
  peopleBadgesHTML:typeof rhythmPeopleBadges==="function"?rhythmPeopleBadges(r,null):"",categoryBadgesHTML:typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(r):"",
  frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
  tendAttributes:{"data-tend-open":"faith-rhythm","data-rhythm-id":r.id},editAttributes:{"data-faith-rhythm-edit":r.id},historyAttributes:{"data-faith-rhythm-history":r.id}
 });
}
function faithRhythmsHTML(group){
 var rhythms=faithRhythms(group),linked=typeof window.faithLinkedRhythmRows==="function"?window.faithLinkedRhythmRows(group):"",rows=rhythms.map(faithRhythmRowHTML).join("")+linked;
 var out="";
 if(rows)out+='<div class="faith-practice-rhythm-list">'+rows+'</div>';
 else out+='<div class="empty">No rhythms in this practice yet.</div>';
 if(faithRhythmDraft&&!faithRhythmDraft.id&&faithRhythmDraft.faithGroup===group)out+=faithRhythmEditorHTML(faithRhythmDraft);
 return out;
}
function faithPracticeHeadingHTML(title,description,linkHTML,titleId){
 return '<div class="faith-practice-link-row">'+linkHTML+'</div><div class="faith-practice-divider" aria-hidden="true"></div><header class="faith-practice-heading"><h2 class="faith-selected-practice-title" id="'+titleId+'" tabindex="-1">'+esc(title)+'</h2>'+(description?'<div class="faith-practice-focus"><p>'+esc(description)+'</p></div>':"")+'</header>';
}
function faithAllRhythmsHTML(){
 var groups=faithPracticeGroups().filter(function(group){return faithPracticeRhythmRecords(group).length>0;});
 var content=groups.map(function(group){return '<section class="faith-all-rhythm-group" aria-labelledby="faith-all-rhythm-group-'+FAITH_GROUPS.indexOf(group)+'"><h4 id="faith-all-rhythm-group-'+FAITH_GROUPS.indexOf(group)+'">'+esc(group)+'</h4>'+faithRhythmsHTML(group)+'</section>';}).join("");
 var selected=faithSelectedGroup(),addAction=faithRhythmDraft?"":'<button type="button" class="btn mini ghost faith-practice-add" data-faith-all-rhythm-add="1">+ Add rhythm</button>';
 return '<section class="faith-practice-panel faith-all-rhythms-panel" aria-labelledby="faithAllRhythmsTitle">'+faithPracticeHeadingHTML("All Faith rhythms","Rhythms across every Faith practice.",'<button type="button" class="faith-all-rhythms-link" data-faith-all-rhythms-back="1">Back to '+esc(selected)+'</button>',"faithAllRhythmsTitle")+'<div class="faith-practice-toolbar faith-all-rhythms-toolbar">'+addAction+'</div><div class="faith-all-rhythms">'+(content||'<div class="profile-empty-state">No active rhythms in the enabled Faith sections.</div>')+'</div></section>';
}
function faithPrayerIdentity(p){
 if(p.personId){var person=S.people.find(function(item){return item.id===p.personId;});return person?'<span class="faith-prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>':'<span class="faith-prayer-person">Person</span>';}
 return p.faithOwner==="me"?'<span class="faith-prayer-person">'+(settings().profilePhoto?personAvatar({name:"Me",photo:settings().profilePhoto},24):"")+'Me</span>':'<span class="faith-prayer-person">Unassigned</span>';
}
function faithPrayerTimeGroups(){
 var today=faithActivePrayers().filter(faithPrayerScheduledToday);
 return today.sort(function(a,b){
  var score=(Number.isFinite(prayerScore(a))?prayerScore(a):101)-(Number.isFinite(prayerScore(b))?prayerScore(b):101);if(score)return score;
  var rank=faithTimeRank(a.tod)-faithTimeRank(b.tod);if(rank)return rank;
  var aLogs=prayerLogsFor(a),bLogs=prayerLogsFor(b),aLast=aLogs.length?aLogs[aLogs.length-1]:0,bLast=bLogs.length?bLogs[bLogs.length-1]:0;
  return aLast-bLast||String(a.text||"").localeCompare(String(b.text||""));
 });
}
function faithPrayerRows(items,hidePrayerBadge){
 return items.map(function(p){return '<div class="faith-prayer-row">'+prayerItemHTML(p,"faith",{hidePrayerBadge:hidePrayerBadge})+'</div>';}).join("");
}
function faithPrayerViewRecords(){
 var mode=faithPrayerSelectionMode("faith-requests"),selection=faithPrayerSelectionPeople("faith-requests"),ids=faithPrayerSelectionIds("faith-requests",mode,selection.selected,selection.groups);
 return ids.map(function(id){return S.prayers.find(function(prayer){return prayer.id===id;});}).filter(Boolean);
}
function faithPrayerTodayHTML(items,hidePrayerBadge){
 items=items||faithPrayerViewRecords();
 if(!items.length)return '<div class="empty">No active prayer requests match this selection.</div>';
 var buckets={};
 items.forEach(function(p){var key=p.tod||"anytime";(buckets[key]||(buckets[key]=[])).push(p);});
 var keys=Object.keys(buckets).sort(function(a,b){return faithTimeRank(a)-faithTimeRank(b);});
 return keys.map(function(key){var block=dayBlocks().find(function(item){return item.id===key;});var label=block?block.name:(key==="allday"?"All day":"Flexible");return '<section class="faith-prayer-time-group"><h3>'+esc(label)+'</h3>'+faithPrayerRows(buckets[key],hidePrayerBadge)+'</section>';}).join("");
}
function faithPrayerAllMatches(p){
 var config=faithConfig(),selectedPeople=Array.isArray(config.prayerPeople)?config.prayerPeople:null,groups=Object.assign({marriage:true,parenting:true,friendships:true},config.prayerGroups||{});
 return faithPrayerPeopleMatch(p,selectedPeople,groups);
}
function faithPrayerHasPeople(p){return !!(p&&(p.personId||Array.isArray(p.sharedWith)&&p.sharedWith.length));}
function faithPrayerIsMine(p){return p.faithOwner==="me"&&!faithPrayerHasPeople(p);}
function faithPrayerScoreOrder(a,b){
 var aScore=prayerScore(a),bScore=prayerScore(b),rank=(Number.isFinite(aScore)?aScore:101)-(Number.isFinite(bScore)?bScore:101);
 if(rank)return rank;
 var timeRank=faithTimeRank(a.tod)-faithTimeRank(b.tod);if(timeRank)return timeRank;
 var aLogs=prayerLogsFor(a),bLogs=prayerLogsFor(b),aLast=aLogs.length?aLogs[aLogs.length-1]:0,bLast=bLogs.length?bLogs[bLogs.length-1]:0;
 return aLast-bLast||String(a.text||"").localeCompare(String(b.text||""));
}
function faithPrayerHistoryHTML(hidePrayerBadge){
 var closed=S.prayers.filter(function(p){return (p.answered||p.archived)&&faithPrayerAllMatches(p);});
 return closed.length?'<details class="faith-history-list"><summary>Answered and archived ('+closed.length+')</summary>'+faithPrayerRows(closed,hidePrayerBadge)+'</details>':"";
}
function faithPrayerRequestContentHTML(items){
 if(!items.length)return "";
 var visible=faithPrayerExpanded?items:items.slice(0,3),expandControl=items.length>3?'<button type="button" class="btn mini ghost faith-prayer-expand" data-faith-prayer-expand="'+(faithPrayerExpanded?"fewer":"all")+'">'+(faithPrayerExpanded?"Show fewer":"View all prayers ("+items.length+")")+'</button>':"";
 if(faithPrayerSelectionMode("faith-requests")==="allrequests")return (visible.length?faithPrayerRows(visible,true):'<div class="empty">No active prayer requests match this selection.</div>')+expandControl;
 return faithPrayerTodayHTML(visible,true)+expandControl;
}
function faithPrayerPersonGroup(person){
 var relation=String(person&&person.relation||"").toLowerCase();
 if(/spouse|wife|husband|partner/.test(relation))return "marriage";
 if(/son|daughter|father|dad|mother|mom|brother|sister|in-law|in law|grandchild|grandson|granddaughter|nephew|niece|bonus/.test(relation))return "parenting";
 return "friendships";
}
function faithPrayerAddDialogHTML(){
 if(!faithPrayerDraftOpen)return "";
 var form=prayerEditor({category:"Faith",faithSection:"Prayer",faithOwner:"me",freq:"selectdays",weekdays:[new Date().getDay()],tod:"anytime",added:todayStr()},"faith");
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-label="Add a prayer for me"><div class="profile-editor-body"><h3>Add a prayer for me</h3>'+form.replace('data-faith-section="Prayer"','data-faith-section="Prayer" data-faith-owner="me"')+'</div></dialog>';
}
function faithPrayerSessionSort(view){
 return faithPrayerViewRecords(view).map(function(p){return p.id;});
}
function faithDashboardPrayerMatches(p,timeBlock,people){
 if(timeBlock!=="all"&&(!faithPrayerScheduledToday(p)||p.tod&&p.tod!=="anytime"&&p.tod!==timeBlock))return false;
 return faithPrayerPeopleMatch(p,people,{marriage:true,parenting:true,friendships:true});
}
function faithDashboardPrayerSessionSort(timeBlock,people){
 return faithActivePrayers().filter(function(p){return faithDashboardPrayerMatches(p,timeBlock,people);}).sort(faithPrayerScoreOrder).map(function(p){return p.id;});
}
function faithPrayerPeopleMatch(p,selectedPeople,groups){
 if(selectedPeople===null)return true;
 groups=Object.assign({marriage:true,parenting:true,friendships:true},groups||{});
 if(selectedPeople.indexOf("me")>=0&&faithPrayerIsMine(p))return true;
 var personIds=(p.personId?[p.personId]:[]).concat(Array.isArray(p.sharedWith)?p.sharedWith:[]);
 return personIds.some(function(id){if(selectedPeople.indexOf(id)<0)return false;var person=S.people.find(function(item){return item.id===id;});return !!person&&!!groups[faithPrayerPersonGroup(person)];});
}
function faithPrayerSelectionMode(context){
 if(context==="dashboard"||context==="faith-today")return dashboardPrayerTimeMode;
 if(context==="prayer")return prayerPageTimeMode;
 if(context==="faith-requests")return faithRequestPrayerTimeMode||(faithSelectedPrayerView()==="today"?"allday":"allrequests");
 if(context.indexOf("person:")===0)return personDashboardPrayerTimeModes[context.slice(7)]||"now";
 return "now";
}
function faithPrayerSelectionPeople(context){
 var available=["me"].concat(S.people.map(function(person){return person.id;})),config=faithConfig(),selected,groups={marriage:true,parenting:true,friendships:true};
 if(context==="dashboard"||context==="faith-today")selected=dashboardPrayerPeople===null?available.slice():dashboardPrayerPeople.slice();
 else if(context==="faith-requests"){selected=Array.isArray(config.prayerPeople)?config.prayerPeople.slice():available.slice();groups=Array.isArray(config.prayerPeople)?Object.assign(groups,config.prayerGroups||{}):Object.assign({},groups);if(Array.isArray(config.prayerPeople))selected=selected.filter(function(id){if(id==="me")return true;var person=S.people.find(function(item){return item.id===id;});return !person||groups[faithPrayerPersonGroup(person)];});}
 else if(context==="prayer")selected=prayerPagePeople===null?available.slice():prayerPagePeople.slice();
 else if(context.indexOf("person:")===0){var id=context.slice(7);available=available.filter(function(personId){return personId===id;});selected=Object.prototype.hasOwnProperty.call(personDashboardPrayerPeople,id)?personDashboardPrayerPeople[id].slice():available.slice();}
 else selected=[];
 return {available:available,selected:selected,groups:groups};
}
function faithPrayerSelectionIds(context,mode,selectedPeople,groups){
 var allPeople=["me"].concat(S.people.map(function(person){return person.id;})),allSelected=selectedPeople===null||allPeople.every(function(id){return selectedPeople.indexOf(id)>=0;});
 if(allSelected)selectedPeople=null;
 var timeBlock=mode==="allrequests"?"all":faithDashboardPrayerTimeBlock(mode);
 if(context!=="faith-requests")return faithDashboardPrayerSessionSort(timeBlock,selectedPeople);
 var items=faithActivePrayers().filter(function(prayer){
  if(context==="faith-requests"&&!faithPrayerPeopleMatch(prayer,selectedPeople,groups))return false;
  if(context==="faith-requests"&&mode==="allrequests")return true;
  if(timeBlock==="all")return faithPrayerScheduledToday(prayer);
  return faithPrayerScheduledToday(prayer)&&(!prayer.tod||prayer.tod==="anytime"||prayer.tod===timeBlock);
 });
 if(context==="faith-requests")return items.sort(faithPrayerScoreOrder).map(function(prayer){return prayer.id;});
 return items.sort(faithPrayerScoreOrder).map(function(prayer){return prayer.id;});
}
function faithPrayerSelectionLabel(mode){
 if(mode==="now")return "Now";
 if(mode==="allday")return "All Day";
 if(mode==="allrequests")return "All requests";
 var block=planBlocksDef().find(function(item){return item.id===mode;});
 return block?block.name:"Now";
}
function faithPrayerSelectionResolvedLabel(mode){
 if(mode==="allday")return "Any time today";
 if(mode==="allrequests")return "Any active request";
 var block=planBlocksDef().find(function(item){return item.id===(mode==="now"?dayBlockAt(new Date()):mode);});
 return block?block.name+" · "+block.range:"Current time block";
}
function faithPrayerSelectionPickerData(context,mode,selectedPeople,groups){
 var options=[{id:"now",label:"Now",timeDescription:faithPrayerSelectionResolvedLabel("now"),count:faithPrayerSelectionIds(context,"now",selectedPeople,groups).length,isCurrent:true}];
 planBlocksDef().forEach(function(block){options.push({id:block.id,label:block.name,timeDescription:block.range,count:faithPrayerSelectionIds(context,block.id,selectedPeople,groups).length,isCurrent:block.cur});});
 return {options:options,allDayCount:faithPrayerSelectionIds(context,"allday",selectedPeople,groups).length,allRequestsCount:faithPrayerSelectionIds(context,"allrequests",selectedPeople,groups).length};
}
function faithPrayerSelectionDialogHTML(context){
 if(!prayerSelectionDraft||prayerSelectionDraft.context!==context)return "";
 var draft=prayerSelectionDraft,groupIds=["marriage","parenting","friendships"],groupNames={marriage:"Marriage",parenting:"Parenting",friendships:"Friends"},groupsHTML="",peopleHTML="",available=draft.available,selected=draft.people;
 function groupState(group){
  var members=available.filter(function(id){if(id==="me")return false;var person=S.people.find(function(item){return item.id===id;});return person&&faithPrayerPersonGroup(person)===group;});
  var count=members.filter(function(id){return selected.indexOf(id)>=0;}).length;
  return count===0?"false":count===members.length?"true":"mixed";
 }
 if(context.indexOf("person:")!==0)groupsHTML='<div class="prayer-selection-groups" role="group" aria-label="People categories">'+groupIds.map(function(group){var state=groupState(group);return '<button type="button" class="prayer-selection-group'+(state==="true"?" is-selected":state==="mixed"?" is-mixed":"")+'" role="checkbox" aria-checked="'+state+'" data-prayer-selection-group="'+group+'"'+(available.filter(function(id){var person=S.people.find(function(item){return item.id===id;});return person&&faithPrayerPersonGroup(person)===group;}).length?"":" disabled")+'>'+groupNames[group]+'</button>';}).join("")+'</div>';
 var peopleOrder=available.filter(function(id){return id!=="me";}).sort(function(a,b){var first=S.people.find(function(person){return person.id===a;}),second=S.people.find(function(person){return person.id===b;}),groupOrder={marriage:0,parenting:1,friendships:2},groupDifference=groupOrder[faithPrayerPersonGroup(first)]-groupOrder[faithPrayerPersonGroup(second)];return groupDifference||String(first&&first.name||"").localeCompare(String(second&&second.name||""));});
 if(available.indexOf("me")>=0)peopleOrder.unshift("me");
 peopleHTML=peopleOrder.map(function(id){
  var isMe=id==="me",person=isMe?{id:"me",name:"Me",photo:settings().profilePhoto}:S.people.find(function(item){return item.id===id;}),active=selected.indexOf(id)>=0;
  if(!person)return "";
  var firstName=isMe?"Me":String(person.name||"").trim().split(/\s+/)[0];
  return '<button type="button" class="prayer-selection-person'+(active?" is-selected":"")+'" data-prayer-selection-person="'+esc(id)+'" aria-pressed="'+active+'" aria-label="'+esc((active?"Deselect ":"Select ")+(isMe?"Me":person.name))+'">'+personAvatar(isMe?{name:"Me",photo:person.photo}:{id:person.id,name:person.name,photo:person.photo},30)+'<span>'+esc(firstName||person.name)+'</span><span class="prayer-selection-check" aria-hidden="true">✓</span></button>';
 }).join("");
 var ids=faithPrayerSelectionIds(context,draft.timeframe,selected,draft.groups),picker=faithPrayerSelectionPickerData(context,draft.timeframe,selected,draft.groups),timeframeHTML=tendPrayerTimeframePickerHTML({label:faithPrayerSelectionLabel(draft.timeframe),resolvedLabel:faithPrayerSelectionResolvedLabel(draft.timeframe)});
 return tendPrayerSelectionDialogHTML({view:draft.view,count:ids.length,timeOptions:picker.options,selectedTimeframeId:draft.timeframe,allDayCount:picker.allDayCount,allRequestsCount:picker.allRequestsCount,includeAllRequests:context==="faith-requests",timeframeHTML:timeframeHTML,groupsHTML:groupsHTML,peopleHTML:peopleHTML});
}
window.faithPrayerEntryHTML=function(context){
 var selection=faithPrayerSelectionPeople(context),mode=faithPrayerSelectionMode(context),ids=faithPrayerSelectionIds(context,mode,selection.selected,selection.groups),count=ids.length,peopleCount=selection.selected.length;
 return tendPrayerEntryHTML({id:context,count:count,peopleCount:peopleCount,timeframe:context==="faith-requests"&&mode==="allrequests"?"All":faithPrayerSelectionLabel(mode),dialogHTML:faithPrayerSelectionDialogHTML(context)});
};
function faithOpenPrayerSelection(context,trigger){
 var selection=faithPrayerSelectionPeople(context);
 prayerSelectionDraft={context:context,view:"people",timeframe:faithPrayerSelectionMode(context),people:selection.selected.slice(),available:selection.available.slice(),groups:Object.assign({},selection.groups),scrollTop:0,trigger:trigger||null};
 render();
 requestAnimationFrame(function(){var title=document.getElementById("prayer-selection-title");if(title)title.focus({preventScroll:true});});
}
function faithApplyPrayerSelection(draft){
 if(draft.context==="dashboard"||draft.context==="faith-today"){
  var dashboardAll=draft.available.every(function(id){return draft.people.indexOf(id)>=0;});
  dashboardPrayerPeople=dashboardAll?null:draft.people.slice();dashboardPrayerTimeMode=draft.timeframe;
 }else if(draft.context==="faith-requests"){
  var config=faithConfig(),all= draft.available.every(function(id){return draft.people.indexOf(id)>=0;});
  config.prayerPeople=all?null:draft.people.slice();config.prayerGroups=Object.assign({},draft.groups);faithRequestPrayerTimeMode=draft.timeframe;config.prayerView=draft.timeframe==="allrequests"?"all":"today";save();
 }else if(draft.context==="prayer"){prayerPageTimeMode=draft.timeframe;prayerPagePeople=draft.available.every(function(id){return draft.people.indexOf(id)>=0;})?null:draft.people.slice();}
 else if(draft.context.indexOf("person:")===0){var personId=draft.context.slice(7);personDashboardPrayerTimeModes[personId]=draft.timeframe;personDashboardPrayerPeople[personId]=draft.people.slice();}
}
function faithPrayerSessionBegin(context,draft){
 var selection=draft||faithPrayerSelectionPeople(context),mode=draft?draft.timeframe:faithPrayerSelectionMode(context),people=draft?draft.people:selection.selected,groups=draft?draft.groups:selection.groups,ids=faithPrayerSelectionIds(context,mode,people,groups);
 if(!ids.length)return false;
 faithApplyPrayerSelection(draft||{context:context,timeframe:mode,people:people,available:selection.available,groups:groups});
 var source=context==="faith-requests"?"faith-requests":context.indexOf("person:")===0?"person":context==="prayer"?"prayer":"dashboard",personId=source==="person"?context.slice(7):null,person=S.people.find(function(item){return item.id===personId;});
 var snapshot=ids.map(function(id){var prayer=S.prayers.find(function(item){return item.id===id;});return prayer?JSON.parse(JSON.stringify(prayer)):null;});
 faithPrayerSession={view:context==="faith-requests"?(mode==="allrequests"?"all":"today"):"dashboard",all:mode==="allrequests",people:people.slice(),timeBlock:faithDashboardPrayerTimeBlock(mode),timeframe:mode,ids:ids.slice(),snapshot:snapshot,index:0,source:source,personId:personId,personName:person&&person.name||"Person",prayedCount:0,prayedIds:[]};
 prayerSelectionDraft=null;render();
 requestAnimationFrame(function(){var card=document.querySelector("[data-faith-session-card]")||document.querySelector(".faith-prayer-session [data-faith-session-exit]");if(card)card.focus({preventScroll:true});});
 return true;
}
window.personFocusedPrayerHTML=function(person){
 return window.faithPrayerEntryHTML("person:"+person.id);
};
function faithDashboardPrayerTimeBlock(mode){
 if(mode==="all"||mode==="allday")return "all";
 if(mode==="now")return dayBlockAt(new Date());
 return dayBlocks().some(function(block){return block.id===mode;})?mode:dayBlockAt(new Date());
}
function faithFocusedPrayerButtonHTML(view){
 return window.faithPrayerEntryHTML("faith-requests");
}
function faithPrayerSessionHTML(){
 var ids=faithPrayerSession?faithPrayerSession.ids:[],items=ids.map(function(id,index){return S.prayers.find(function(p){return p.id===id;})||faithPrayerSession.snapshot&&faithPrayerSession.snapshot[index]||null;}).filter(Boolean);
 if(!faithPrayerSession)return "";
 var sessionHeading=faithPrayerSession.source==="person"?esc(faithPrayerSession.personName)+" · Prayer time":"Prayer time",finished=faithPrayerSession.ended||faithPrayerSession.index>=ids.length;
 if(finished)return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><span class="faith-eyebrow">'+sessionHeading+'</span></header><section class="card faith-session-empty"><h1 id="faithSessionTitle">'+(faithPrayerSession.ended?"Prayer session ended":"Prayer time complete")+'</h1><p>You marked '+(faithPrayerSession.prayedCount||0)+' '+((faithPrayerSession.prayedCount||0)===1?"request":"requests")+' prayed.</p><div class="faith-session-actions">'+(!faithPrayerSession.ended?'<button type="button" class="btn ghost" data-faith-session-back="1">Back</button>':'')+'<button type="button" class="btn faith-session-close" data-faith-session-exit="1">Finish</button></div></section></dialog>';
 if(!items.length)return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><span class="faith-eyebrow">'+sessionHeading+'</span><button type="button" class="btn mini ghost faith-session-end" data-faith-session-exit="1" data-editor-cancel>End session</button></header><section class="card faith-session-empty"><h1 id="faithSessionTitle">No requests in this session</h1><p>No active requests match this selection.</p></section></dialog>';
 var p=items[faithPrayerSession.index];
 var alreadyPrayed=faithPrayerSession.prayedIds.indexOf(p.id)>=0;
 return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><div><span class="faith-eyebrow">'+sessionHeading+'</span><h1 id="faithSessionTitle">One request at a time</h1></div><button type="button" class="btn mini ghost faith-session-end" data-faith-session-exit="1" data-editor-cancel>End session</button></header><div class="faith-session-progress" aria-live="polite">Request '+(faithPrayerSession.index+1)+' of '+ids.length+'</div><div class="faith-session-track" aria-hidden="true"><span style="width:'+Math.round((faithPrayerSession.index+1)/ids.length*100)+'%"></span></div><article class="card faith-session-card" data-faith-session-card tabindex="-1"><div class="faith-session-person">'+faithPrayerIdentity(p)+'</div><h2>'+esc(p.text||"Prayer request")+'</h2><p>'+(p.details?esc(p.details):"")+'</p><div class="faith-session-meta">'+esc(prayerScheduleLabel(p))+' · prayed '+(p.prayed||0)+' '+((p.prayed||0)===1?"time":"times")+'</div></article><nav class="faith-session-actions" aria-label="Prayer time actions"><button type="button" class="btn ghost" data-faith-session-back="1"'+(faithPrayerSession.index===0?' disabled':'')+'>Back</button><button type="button" class="btn ghost" data-faith-session-skip="1">Skip</button><button type="button" class="btn faith-session-prayed" data-faith-session-prayed="'+esc(p.id)+'"'+(alreadyPrayed?' disabled aria-label="Already marked prayed"':'')+'>Prayed</button></nav><p class="faith-session-help">Only Prayed records a prayer. <span class="faith-session-keyboard-help">Use ← / → to move between requests.</span></p></dialog>';
}
function faithPrayerRequestsHTML(){
 var items=faithPrayerViewRecords(),addToolbar=faithPrayerDraftOpen?"":'<div class="faith-prayer-add-toolbar"><button type="button" class="btn mini ghost faith-prayer-add-button" data-faith-prayer-add="1">+ Add prayer</button></div>';
 return '<section class="faith-prayer-requests" id="faith-prayer-requests" aria-labelledby="faithPrayerTitle"><div class="faith-prayer-entry-section">'+faithViewHeaderHTML("Prayer","","","faithPrayerTitle",true)+faithFocusedPrayerButtonHTML()+'</div><section class="faith-prayer-list-section" aria-labelledby="faithPrayerRequestsTitle">'+faithViewHeaderHTML("Prayer requests","People and needs to bring before God.","","faithPrayerRequestsTitle",true)+'<div class="faith-prayer-hub" id="faith-prayer-hub">'+addToolbar+'<div class="faith-prayer-content">'+faithPrayerRequestContentHTML(items)+'</div>'+faithPrayerHistoryHTML(true)+faithPrayerAddDialogHTML()+'</div></section></section>';
}
function faithPracticeContent(group){
 var description=faithConfig().groupDescriptions[group]||"";
 var tabs=["rhythms","sparks"],labels={rhythms:"Rhythms",sparks:"Sparks"},selected=faithPracticeTab(group);
 var content=selected==="rhythms"?faithRhythmsHTML(group):faithSparksHTML(group),addAction="";
 if(selected==="rhythms"&&!faithRhythmDraft)addAction='<button type="button" class="btn mini ghost faith-practice-add" data-faith-rhythm-add="'+esc(group)+'">+ Add rhythm</button>';
 if(selected==="sparks"&&!faithSparkDraft)addAction='<button type="button" class="btn mini ghost faith-practice-add" data-faith-spark-add="'+esc(group)+'">+ Add spark</button>';
 return '<section class="faith-practice-panel" id="faith-practice-panel" aria-labelledby="faithPracticeTitle">'+faithPracticeHeadingHTML(group,description,'<button type="button" class="faith-all-rhythms-link" data-faith-all-rhythms-open="1">All Faith rhythms →</button>',"faithPracticeTitle")+'<div class="faith-practice-toolbar"><nav class="faith-practice-tabs" role="tablist" aria-label="'+esc(group)+' content">'+tabs.map(function(tab){var tabId="faith-practice-tab-"+tab;return '<button type="button" id="'+tabId+'" role="tab" data-faith-practice-tab="'+esc(group)+'|'+tab+'" aria-controls="faith-practice-tabpanel" aria-selected="'+(tab===selected)+'" tabindex="'+(tab===selected?"0":"-1")+'">'+labels[tab]+'</button>';}).join("")+'</nav>'+addAction+'</div><div class="faith-tab-content" id="faith-practice-tabpanel" role="tabpanel" aria-labelledby="faith-practice-tab-'+selected+'">'+content+'</div></section>';
}
function faithPracticeOverviewHTML(selected){
 return '<section class="faith-practices-overview" aria-labelledby="faithPracticesTitle">'+faithViewHeaderHTML("Your practices","Choose an area to tend.","","faithPracticesTitle")+'<div class="faith-section-nav-wrap">'+faithSectionNavHTML(selected)+'</div></section>';
}
function faithSparkEditorHTML(item){
 var ownerId=faithSparkOwnerId||"faith";
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="faith-spark-editor-title"><div class="profile-editor-body faith-item-editor"><h3 id="faith-spark-editor-title">'+(item.id?"Edit Spark":"Add Spark")+'</h3><label>Title<input data-faith-spark-title value="'+esc(item.text||"")+'" placeholder="Idea - a movie, a talk, a trip..."></label><label>Details<textarea data-faith-spark-details placeholder="Details (optional)">'+esc(item.details||"")+'</textarea></label><div class="faith-edit-grid"><label>Planned date<input type="date" data-faith-spark-date value="'+esc(item.by||"")+'"></label><label>Time<input type="time" data-faith-spark-time value="'+esc(item.time||"")+'"></label></div>'+tendAssociationControlsHTML("spark",ownerId,item.id||"new",item)+'<div class="faith-item-actions"><button type="button" class="btn mini" data-faith-spark-save="'+(item.id||"new")+'">Save Spark</button><button type="button" class="btn mini ghost" data-faith-spark-cancel="1" data-editor-cancel>Cancel</button>'+(item.id?'<button type="button" class="btn mini danger" data-faith-spark-delete="'+esc(ownerId+"|"+item.id)+'">Delete Spark</button>':'')+'</div></div></dialog>';
}
function faithSparkRecords(){
 var records=[];
 (S.ideas||[]).forEach(function(spark){if((Array.isArray(spark.areas)&&spark.areas.indexOf("faith")>=0)||spark.category==="faith"||spark.area==="faith"||spark.faithSection)records.push(Object.assign({},spark,{profileOwnerId:"faith"}));});
 (S.people||[]).forEach(function(owner){(owner.sparks||[]).forEach(function(spark){if((Array.isArray(spark.areas)&&spark.areas.indexOf("faith")>=0)||spark.category==="faith"||spark.area==="faith"||spark.faithSection)records.push(Object.assign({},spark,{profileOwnerId:owner.id}));});});
 var seen={};
 return records.filter(function(spark){if(seen[spark.id])return false;seen[spark.id]=true;return true;});
}
function faithFindSpark(ownerId,id){
 if(ownerId==="faith")return (S.ideas||[]).find(function(spark){return spark.id===id;})||null;
 var owner=S.people.find(function(person){return person.id===ownerId;});
 return owner&&(owner.sparks||[]).find(function(spark){return spark.id===id;})||null;
}
function faithSparksHTML(group){
 group=group||faithSelectedGroup();
 var items=faithSparkRecords().filter(function(item){return !item.done&&(item.faithSection||item.faithGroup||(item.profileOwnerId!=="faith"?"Prayer":"Other"))===group;}).sort(function(a,b){return String(a.by||"9999").localeCompare(String(b.by||"9999"));});
 var out="";
 out+=items.length?'<div class="faith-practice-spark-list">'+items.map(function(item){
  var ownerId=item.profileOwnerId||"faith";
  if(faithSparkEditId===item.id&&faithSparkOwnerId===ownerId)return faithSparkEditorHTML(item);
  var sparkBadges=tendAssociationPeopleBadges(item,ownerId,null,"spark")+tendAssociationCategoryBadges(item);
  return tendSparkCardHTML(item,{title:item.text||"Untitled Spark",description:item.details||"",actionHTML:'<button type="button" class="btn mini sparkbtn" data-faith-sparkdone="'+esc(ownerId+"|"+item.id)+'">Do it</button>',
   headingEditHTML:'<button type="button" class="iconbtn" data-faith-spark-edit="'+esc(ownerId+"|"+item.id)+'" aria-label="Edit '+esc(item.text)+'">✎</button>',
   topMetaHTML:sparkBadges?'<div class="plan-item-top-meta">'+sparkBadges+'</div>':'<div class="plan-item-top-meta"></div>',
   footerHTML:'<span class="dashboard-spark-deadline">'+esc((item.time?fmtHM12(item.time)+" · ":"")+(item.by?sparkDueTxt(item):"Flexible · no date"))+'</span><button type="button" class="iconbtn" data-faith-spark-delete="'+esc(ownerId+"|"+item.id)+'" aria-label="Delete '+esc(item.text)+'">×</button>',
   className:"faith-practice-spark"});
 }).join("")+'</div>':'<div class="empty">No Sparks in this practice yet.</div>';
 if(faithSparkDraft&&!faithSparkEditId&&(faithSparkDraft.faithSection||"Other")===group)out+=faithSparkEditorHTML(faithSparkDraft);
 var history=faithSparkRecords().filter(function(item){return item.done&&(item.faithSection||item.faithGroup||(item.profileOwnerId!=="faith"?"Prayer":"Other"))===group;}).sort(function(a,b){return (b.completedTs||0)-(a.completedTs||0);});
 if(history.length)out+='<details class="faith-history-list"><summary>Completed Sparks ('+history.length+')</summary>'+history.map(function(item){return '<div class="faith-history-row"><span>'+esc(item.text)+'</span><time>'+(item.completedDate?esc(prayerDate(item.completedDate)):"Completed")+'</time><button type="button" class="btn mini ghost" data-faith-spark-reopen="'+esc(item.profileOwnerId+"|"+item.id)+'">Reopen</button></div>';}).join("")+'</details>';
 return out;
}
function faithNoteRecords(){
 var seen=Object.create(null);
 return S.followups.filter(function(note){
  var areas=Array.isArray(note.areas)?note.areas:[];
  var associated=note.kind==="faith-note"||areas.indexOf("faith")>=0||FAITH_GROUPS.indexOf(note.faithSection)>=0||FAITH_GROUPS.indexOf(note.faithGroup)>=0;
  if(!associated)return false;
  if(note.id!==undefined&&note.id!==null&&String(note.id)!==""){var id=String(note.id);if(seen[id])return false;seen[id]=true;}
  return true;
 });
}
function faithNotesHTML(){
 var notes=faithNoteRecords(),active=notes.filter(function(note){return !note.done;}),completed=notes.filter(function(note){return note.done;}),editingHidden=active.slice(3).some(function(note){return note.id===editingFollowupId;}),completedEdit=completed.find(function(note){return note.id===editingFollowupId;}),showAll=faithNotesExpanded||editingHidden,visible=showAll?active:active.slice(0,3),context={id:"faith"};
 var out='<section class="faith-notes-section" aria-labelledby="faithNotesTitle"><div class="faith-notes-toolbar"><button type="button" class="btn mini ghost profile-rhythm-add" data-profilenoteopen="faith">'+profileActionIcon("log")+'<span>Add note</span></button></div><div class="person-notes faith-notes-list">';
 out+=visible.length?visible.map(function(note){if(editingFollowupId===note.id)return tendNoteEditorHTML(note,"faith");var stamp=note.createdAt||note.ts?when(note.createdAt||note.ts):note.due?"Due "+note.due:"";return tendNoteCardHTML(note,context,{metadata:stamp});}).join(""):'<div class="profile-empty-state">No notes yet</div>';
 out+='</div>';
 if(completedEdit)out+=tendNoteEditorHTML(completedEdit,"faith");
 if(active.length>3)out+='<button type="button" class="btn mini ghost faith-notes-expand" data-faith-notes-expand="'+(showAll?"fewer":"all")+'">'+(showAll?"Show fewer":"View all notes ("+active.length+")")+'</button>';
 if(completed.length)out+='<button type="button" class="btn mini ghost profile-rhythm-add person-note-history-button" data-note-history="faith">Completed ('+completed.length+')</button>';
 if(noteDraftOpenFor==="faith")out+=tendNoteAddEditorHTML("faith",noteAddDrafts.faith||(noteAddDrafts.faith={personId:null,sharedWith:[],areas:["faith"]}));
 return out+'</section>';
}
function renderFaithPage(){
 faithMigrateData();
 if(faithPrayerSession)return faithPrayerSessionHTML();
 var selected=faithSelectedGroup(),config=faithConfig();
 if(FAITH_GROUPS.indexOf(selected)<0){selected=FAITH_GROUPS[0];config.selectedGroup=selected;}
 faithInitialMainView(selected);
 var out='<main class="faith-page">'+tendCategoryPageHeaderHTML("Faith","faith-page-heading");
 var practiceEditor=faithRhythmDraft?faithRhythmEditorHTML(faithRhythmDraft):faithSparkDraft?faithSparkEditorHTML(faithSparkDraft):"";
 out+=faithHealthHTML()+'<div class="faith-views-content">'+faithViewNavHTML();
 out+=faithViewPanelHTML("practices",faithPracticeOverviewHTML(selected)+(faithShowAllRhythms?faithAllRhythmsHTML():faithPracticeContent(selected)));
 out+=faithViewPanelHTML("today",faithTodayHTML());
 out+=faithViewPanelHTML("prayer",faithPrayerRequestsHTML());
 out+='</div>'+practiceEditor+'</main>';
 return out;
}
function faithFindRhythm(id){return S.rhythms.find(function(r){return r.id===id&&(r.category==="faith"||FAITH_GROUPS.indexOf(r.faithGroup)>=0);});}
function faithLogRhythm(r,ts){
 if(!r)return false;
 logEvent("faith",null,/^pray/i.test(r.text||"")?"prayer":"quality",r.text||"Faith rhythm",r.description||"",ts||Date.now(),r.id,{faithGroup:r.faithGroup});
 flash("Rhythm tended \u2713");
 return true;
}
function faithCompleteSpark(item){
 if(!item||item.done)return;
 item.done=true;item.completedTs=Date.now();item.completedDate=todayStr();
 logEvent("faith",null,"quality",item.text||"Faith Spark","One-off Faith practice completed",item.completedTs,null,{origin:"faith-spark",faithGroup:item.faithSection||null});
 flash("Spark completed");
}
function faithSaveRhythm(){
 var draft=faithRhythmDraft;if(!draft)return;
 if(!String(draft.text||"").trim()){flash("Give the rhythm a title");var title=document.querySelector("[data-faith-title]");if(title)title.focus();return;}
 if(draft.aggregateCategoryRequired&&FAITH_GROUPS.indexOf(draft.faithGroup)<0){flash("Choose a Faith practice");var group=document.querySelector("[data-faith-rhythm-group]");if(group)group.focus();return;}
 if(draft.endDateEnabled&&!draft.until){flash("Choose an end date");var until=document.querySelector('[data-rfield$="|until"]');if(until)until.focus();return;}
 var record=JSON.parse(JSON.stringify(draft));delete record.aggregateCategoryRequired;record.text=record.text.trim();record.faithGroup=draft.faithGroup;record.category="faith";record.disabled=false;record.faithUserCreated=true;record.added=record.added||todayStr();record.sharedWith=(record.sharedWith||[]).filter(function(id){return S.people.some(function(person){return person.id===id;});});record.areas=(record.areas||[]).filter(function(id){return id!=="faith";});
 if(record.freq==="weekly"&&!Array.isArray(record.weekdays))record.weekdays=record.scheduleDow==null?[]:[+record.scheduleDow];
 if(record.freq==="custom"&&!record.unit)record.unit="weeks";
 if(draft.id){var current=faithFindRhythm(draft.id);if(current)Object.assign(current,record);}
 else{record.id=uid();S.rhythms.push(record);}
 faithRhythmDraft=null;save();render();flash("Rhythm saved");
}
function faithSaveSpark(){
 var draft=faithSparkDraft;if(!draft)return;
 var title=document.querySelector("[data-faith-spark-title]");
 if(!title||!title.value.trim()){flash("Give the Spark a title");if(title)title.focus();return;}
 draft.text=title.value.trim();draft.details=(document.querySelector("[data-faith-spark-details]")||{}).value||"";draft.by=(document.querySelector("[data-faith-spark-date]")||{}).value||null;draft.time=(document.querySelector("[data-faith-spark-time]")||{}).value||null;draft.tod=draft.tod||"anytime";
 var ownerId=faithSparkOwnerId||"faith",record;
 if(ownerId==="faith"){draft.faithSection=draft.faithSection||faithSelectedGroup();draft.category="faith";draft.area="faith";draft.areas=Array.isArray(draft.areas)?draft.areas:["faith"];if(draft.areas.indexOf("faith")<0)draft.areas.push("faith");}
 if(draft.id){record=faithFindSpark(ownerId,draft.id);if(record)Object.assign(record,draft);}
 else{record=Object.assign({id:uid(),createdAt:Date.now(),done:false},draft);if(ownerId==="faith")S.ideas.push(record);else{var newSparkOwner=S.people.find(function(person){return person.id===ownerId;});if(newSparkOwner){newSparkOwner.sparks=newSparkOwner.sparks||[];newSparkOwner.sparks.push(record);}}}
 if(record){tendAssociationCommit("spark",ownerId,draft.id||"new",record);delete sparkAddDrafts[ownerId];}
 faithSparkDraft=null;faithSparkEditId=null;faithSparkOwnerId="faith";save();render();flash("Spark saved");
}
function faithSavePrayer(button){
 var form=button.closest("[data-prayer-editor]");if(!form||typeof prayerSaveFromForm!=="function")return false;
 return prayerSaveFromForm(form,null);
}
function faithPrayerSessionMove(delta){
 if(!faithPrayerSession)return;
 faithPrayerSession.index=Math.max(0,Math.min(faithPrayerSession.ids.length,faithPrayerSession.index+delta));
 render();
 var focusTarget=document.querySelector("[data-faith-session-card]")||document.querySelector(".faith-session-empty [data-faith-session-exit]");
 if(focusTarget)focusTarget.focus();
}
document.addEventListener("input",function(event){
 var t=event.target;
 if(t.matches&&t.matches("[data-faith-title]")&&faithRhythmDraft)faithRhythmDraft.text=t.value;
 if(t.matches&&t.matches("[data-faith-description]")&&faithRhythmDraft)faithRhythmDraft.description=t.value;
 if(t.matches&&t.matches("[data-faith-spark-title]")&&faithSparkDraft)faithSparkDraft.text=t.value;
 if(t.matches&&t.matches("[data-faith-spark-details]")&&faithSparkDraft)faithSparkDraft.details=t.value;
},true);
document.addEventListener("change",function(event){
 var t=event.target;
 if(t.matches&&t.matches("[data-faith-enabled]")){
  var group=t.getAttribute("data-faith-enabled"),disabled=faithConfig().disabledGroups;
  if(t.checked)faithConfig().disabledGroups=disabled.filter(function(value){return value!==group;});
  else if(disabled.indexOf(group)<0)disabled.push(group);
  save();render();var restored=document.querySelector('[data-faith-enabled="'+group+'"]');if(restored)restored.focus();event.stopImmediatePropagation();return;
 }
 if(t.matches&&t.matches("[data-faith-rhythm-group]")&&faithRhythmDraft){faithRhythmDraft.faithGroup=t.value;event.stopImmediatePropagation();return;}
 if(t.matches&&t.matches("[data-rfield]")&&String(t.getAttribute("data-rfield")).indexOf("faith|")===0&&faithRhythmDraft){
  var parts=t.getAttribute("data-rfield").split("|"),field=parts[2];
  if(field==="weekdays")faithRhythmDraft.weekdays=Array.from(document.querySelectorAll('[data-rfield="faith|'+(faithRhythmDraft.id||"draft")+'|weekdays"]:checked')).map(function(input){return +input.value;});
  else if(field==="scheduleDow")faithRhythmDraft.scheduleDow=t.value===""?null:+t.value;
  else if(field==="endDateEnabled"){faithRhythmDraft.endDateEnabled=t.checked;if(!t.checked)faithRhythmDraft.until="";}
  else faithRhythmDraft[field]=["every","dayOfMonth","ord","ordWeekday","month","monthThe","monthDay","qmonth"].indexOf(field)>=0?(+t.value||1):t.value;
  if((field==="freq"&&["weekly","selectdays"].indexOf(t.value)>=0||field==="unit"&&t.value==="weeks")&&!faithRhythmDraft.weekdays.length)faithRhythmDraft.weekdays=[new Date().getDay()];
  render();event.stopImmediatePropagation();return;
 }
 if(t.matches&&t.matches("[data-faith-spark-date]")&&faithSparkDraft)faithSparkDraft.by=t.value||null;
 if(t.matches&&t.matches("[data-faith-spark-time]")&&faithSparkDraft)faithSparkDraft.time=t.value||null;
},true);
document.addEventListener("click",function(event){
 var faithClickTarget=event.target&&event.target.closest&&event.target.closest("button,[role=tab]");
 if(faithClickTarget&&typeof tendCaptureFaithScrollAnchor==="function"){
  var faithClickAnchor=tendCaptureFaithScrollAnchor(faithClickTarget);
  if(faithClickAnchor){tendPendingFaithScrollAnchor=faithClickAnchor;requestAnimationFrame(function(){if(tendPendingFaithScrollAnchor===faithClickAnchor)tendPendingFaithScrollAnchor=null;});}
 }
 var t=event.target;
 var prayerSelectionOpen=t.closest&&t.closest("[data-prayer-selection-open]");
 if(prayerSelectionOpen){faithOpenPrayerSelection(prayerSelectionOpen.getAttribute("data-prayer-selection-open"),prayerSelectionOpen);event.stopImmediatePropagation();return;}
 var prayerSessionStart=t.closest&&t.closest("[data-prayer-session-start]");
 if(prayerSessionStart){faithPrayerSessionBegin(prayerSessionStart.getAttribute("data-prayer-session-start"));event.stopImmediatePropagation();return;}
 var faithNotesSummary=t.closest&&t.closest(".faith-settings-notes>summary");
 if(faithNotesSummary){faithNotesDestinationOpen=!faithNotesSummary.parentElement.open;return;}
 if(prayerSelectionDraft){
  var selectionBody=document.querySelector("[data-prayer-selection-body]");
  if(t.closest&&t.closest("[data-prayer-selection-time-open]")){prayerSelectionDraft.scrollTop=selectionBody?selectionBody.scrollTop:0;prayerSelectionDraft.view="timeframe";render();requestAnimationFrame(function(){var selected=document.querySelector(".prayer-timeframe-picker__option.is-selected")||document.querySelector(".prayer-selection-back");if(selected)selected.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
  if(t.closest&&t.closest("[data-prayer-selection-back]")){prayerSelectionDraft.view="people";render();requestAnimationFrame(function(){var body=document.querySelector("[data-prayer-selection-body]"),trigger=document.querySelector("[data-prayer-selection-time-open]");if(body)body.scrollTop=prayerSelectionDraft.scrollTop||0;if(trigger)trigger.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
  if(t.closest&&t.closest("[data-prayer-selection-close]")){var closedDraft=prayerSelectionDraft;prayerSelectionDraft=null;render();requestAnimationFrame(function(){var trigger=Array.from(document.querySelectorAll("[data-prayer-selection-open]")).find(function(item){return item.getAttribute("data-prayer-selection-open")===closedDraft.context;});if(trigger)trigger.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
  if(t.closest&&t.closest("[data-prayer-selection-people]")){var bulk=t.closest("[data-prayer-selection-people]").getAttribute("data-prayer-selection-people");prayerSelectionDraft.people=bulk==="all"?prayerSelectionDraft.available.slice():[];prayerSelectionDraft.groups={marriage:bulk==="all",parenting:bulk==="all",friendships:bulk==="all"};render();event.stopImmediatePropagation();return;}
  var groupToggle=t.closest&&t.closest("[data-prayer-selection-group]");
  if(groupToggle){var group=groupToggle.getAttribute("data-prayer-selection-group"),members=prayerSelectionDraft.available.filter(function(id){if(id==="me")return false;var person=S.people.find(function(item){return item.id===id;});return person&&faithPrayerPersonGroup(person)===group;}),allSelected=members.length>0&&members.every(function(id){return prayerSelectionDraft.people.indexOf(id)>=0;});members.forEach(function(id){var index=prayerSelectionDraft.people.indexOf(id);if(allSelected&&index>=0)prayerSelectionDraft.people.splice(index,1);else if(!allSelected&&index<0)prayerSelectionDraft.people.push(id);});prayerSelectionDraft.groups[group]=!allSelected;render();requestAnimationFrame(function(){var next=document.querySelector('[data-prayer-selection-group="'+group+'"]');if(next)next.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
  var personToggle=t.closest&&t.closest("[data-prayer-selection-person]");
  if(personToggle){var personId=personToggle.getAttribute("data-prayer-selection-person"),personIndex=prayerSelectionDraft.people.indexOf(personId);if(personIndex>=0)prayerSelectionDraft.people.splice(personIndex,1);else prayerSelectionDraft.people.push(personId);if(personId!=="me"){var selectedPerson=S.people.find(function(item){return item.id===personId;});if(selectedPerson)prayerSelectionDraft.groups[faithPrayerPersonGroup(selectedPerson)]=true;}render();requestAnimationFrame(function(){var next=Array.from(document.querySelectorAll("[data-prayer-selection-person]")).find(function(item){return item.getAttribute("data-prayer-selection-person")===personId;});if(next)next.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
  var timeframeOption=t.closest&&t.closest("[data-prayer-time-option]");
  if(timeframeOption){var selectedMode=timeframeOption.getAttribute("data-prayer-time-option"),validMode=["now","allday","allrequests"].indexOf(selectedMode)>=0||dayBlocks().some(function(block){return block.id===selectedMode;});if(validMode){prayerSelectionDraft.timeframe=selectedMode;prayerSelectionDraft.view="people";render();requestAnimationFrame(function(){var body=document.querySelector("[data-prayer-selection-body]"),trigger=document.querySelector("[data-prayer-selection-time-open]");if(body)body.scrollTop=prayerSelectionDraft.scrollTop||0;if(trigger)trigger.focus({preventScroll:true});});}event.stopImmediatePropagation();return;}
  if(t.closest&&t.closest("[data-prayer-selection-done]")){var appliedDraft=prayerSelectionDraft;faithApplyPrayerSelection(appliedDraft);prayerSelectionDraft=null;render();requestAnimationFrame(function(){var trigger=Array.from(document.querySelectorAll("[data-prayer-selection-open]")).find(function(item){return item.getAttribute("data-prayer-selection-open")===appliedDraft.context;});if(trigger)trigger.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
  if(t.closest&&t.closest("[data-prayer-selection-start]")){var startDraft=prayerSelectionDraft;faithPrayerSessionBegin(startDraft.context,startDraft);event.stopImmediatePropagation();return;}
 }
 var b=t.closest&&t.closest("button");if(!b)return;
 if(b.matches("[data-faith-view-select]")){faithSetMainView(b.getAttribute("data-faith-view-select"),true);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-health-nav]")){
  var healthDestination=b.getAttribute("data-faith-health-nav");
  if(healthDestination==="rhythms"){
   faithShowPracticeView(true,null,"faithAllRhythmsTitle");
  }else if(healthDestination==="prayer"){
   faithSetMainView("prayer",false);
   requestAnimationFrame(function(){faithScrollToHeading(document.getElementById("faithPrayerTitle"));});
  }
  event.stopImmediatePropagation();return;
 }
 if(b.matches("[data-faith-all-rhythms-open]")){faithShowPracticeView(true,null,"faithAllRhythmsTitle");event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-all-rhythms-back]")){faithShowPracticeView(false,null,"faithPracticeTitle");event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-select]")){faithShowPracticeView(false,b.getAttribute("data-faith-select"));save();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-today-expand]")){faithTodayExpanded=b.getAttribute("data-faith-today-expand")==="all";render();var todayExpand=document.querySelector("[data-faith-today-expand]");if(todayExpand)todayExpand.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-notes-expand]")){faithNotesExpanded=b.getAttribute("data-faith-notes-expand")==="all";render();var expandButton=document.querySelector("[data-faith-notes-expand]");if(expandButton)expandButton.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-expand]")){faithPrayerExpanded=b.getAttribute("data-faith-prayer-expand")==="all";render();var prayerExpandButton=document.querySelector("[data-faith-prayer-expand]");if(prayerExpandButton)prayerExpandButton.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-practice-tab]")){var parts=b.getAttribute("data-faith-practice-tab").split("|"),config=faithConfig(),tabs=config.practiceTabs||{};if(b.closest(".faith-health-card")){config.selectedGroup=parts[0];faithMainView="practices";faithMainViewInitialized=true;}tabs[parts[0]]=parts[1];config.practiceTabs=tabs;save();render();requestAnimationFrame(function(){var tabButton=document.querySelector('[data-faith-practice-tab="'+parts[0]+'|'+parts[1]+'"]');if(tabButton)tabButton.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-requests]")){faithSetMainView("prayer",false);requestAnimationFrame(function(){faithScrollToHeading(document.getElementById("faithPrayerTitle"));});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-exit]")){if(faithPrayerSession&&!faithPrayerSession.ended&&faithPrayerSession.index<faithPrayerSession.ids.length){faithPrayerSession.ended=true;render();var endTitle=document.getElementById("faithSessionTitle");if(endTitle)endTitle.focus({preventScroll:true});}else{var sessionSource=faithPrayerSession&&faithPrayerSession.source,sessionPersonId=faithPrayerSession&&faithPrayerSession.personId;faithPrayerSession=null;render();var navButton=Array.from(document.querySelectorAll("[data-prayer-session-start]")).find(function(button){var context=button.getAttribute("data-prayer-session-start");return sessionSource==="person"?context==="person:"+sessionPersonId:sessionSource==="faith-requests"?context==="faith-requests":sessionSource==="prayer"?context==="prayer":context==="dashboard";});if(navButton)navButton.focus();}event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-skip]")){faithPrayerSessionMove(1);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-back]")){faithPrayerSessionMove(-1);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-prayed]")){
  var prayer=S.prayers.find(function(p){return p.id===b.getAttribute("data-faith-session-prayed")&&!p.answered&&!p.archived;});
  if(prayer&&typeof recordPrayer==="function"&&faithPrayerSession.prayedIds.indexOf(prayer.id)<0){faithPrayerSession.prayedIds.push(prayer.id);faithPrayerSession.prayedCount++;if(!recordPrayer(prayer,!!prayer.personId)){faithPrayerSession.prayedIds.pop();faithPrayerSession.prayedCount--;}faithPrayerSessionMove(1);}
  event.stopImmediatePropagation();return;
 }
 if(b.matches("[data-faith-rhythm-add]")){faithRhythmDraft={id:null,faithGroup:b.getAttribute("data-faith-rhythm-add"),category:"faith",text:"",description:"",freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks",start:todayStr(),sharedWith:[],areas:[]};render();var title=document.querySelector("[data-faith-title]");if(title)title.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-all-rhythm-add]")){faithRhythmDraft={id:null,faithGroup:"",aggregateCategoryRequired:true,category:"faith",text:"",description:"",freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks",start:todayStr(),sharedWith:[],areas:[]};render();var category=document.querySelector("[data-faith-rhythm-group]");if(category)category.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-edit]")){var rhythm=faithFindRhythm(b.getAttribute("data-faith-rhythm-edit"));if(rhythm){faithRhythmDraft=JSON.parse(JSON.stringify(rhythm));if(!faithRhythmDraft.weekdays&&faithRhythmDraft.scheduleDow!=null)faithRhythmDraft.weekdays=[+faithRhythmDraft.scheduleDow];}render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-profile-edit]")){var sharedRhythm=faithFindRhythm(b.getAttribute("data-faith-rhythm-profile-edit"));if(sharedRhythm){currentPerson=null;currentArea="faith";tab="today";faithMainView="practices";faithMainViewInitialized=true;faithShowAllRhythms=false;faithConfig().selectedGroup=sharedRhythm.faithGroup||"Other";faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs[faithConfig().selectedGroup]="rhythms";faithRhythmDraft=JSON.parse(JSON.stringify(sharedRhythm));render();}event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-save]")){faithSaveRhythm();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-cancel]")){faithRhythmDraft=null;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-delete]")){var id=b.getAttribute("data-faith-rhythm-delete");S.rhythms=S.rhythms.filter(function(r){return r.id!==id;});faithRhythmDraft=null;save();render();flash("Rhythm removed");event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-history]")){openRhythmHistory("faith|"+b.getAttribute("data-faith-rhythm-history"));event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-add]")){var sparkGroup=b.getAttribute("data-faith-spark-add");if(FAITH_GROUPS.indexOf(sparkGroup)<0)sparkGroup=faithSelectedGroup();faithSparkOwnerId="faith";delete tendItemAssociationDrafts[tendAssociationKey("spark","faith","new")];faithSparkDraft={id:null,text:"",details:"",by:"",time:"",tod:"anytime",category:"faith",area:"faith",faithSection:sparkGroup,sharedWith:[],areas:["faith"]};sparkAddDrafts.faith=faithSparkDraft;faithSparkEditId=null;render();var sparkTitle=document.querySelector("[data-faith-spark-title]");if(sparkTitle)sparkTitle.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-edit]")){var sparkKey=b.getAttribute("data-faith-spark-edit").split("|"),sparkOwnerId=sparkKey[0],sparkId=sparkKey[1],spark=faithFindSpark(sparkOwnerId,sparkId);if(spark){faithSparkOwnerId=sparkOwnerId;delete tendItemAssociationDrafts[tendAssociationKey("spark",sparkOwnerId,spark.id)];faithSparkDraft=JSON.parse(JSON.stringify(spark));faithSparkEditId=spark.id;}render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-save]")){faithSaveSpark();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-cancel]")){if(faithSparkDraft&&faithSparkDraft.id)delete tendItemAssociationDrafts[tendAssociationKey("spark",faithSparkOwnerId,faithSparkDraft.id)];faithSparkDraft=null;delete sparkAddDrafts[faithSparkOwnerId];delete tendItemAssociationDrafts[tendAssociationKey("spark",faithSparkOwnerId,"new")];faithSparkEditId=null;faithSparkOwnerId="faith";render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-sparkdone]")){var doneKey=b.getAttribute("data-faith-sparkdone").split("|"),doneSpark=faithFindSpark(doneKey[0],doneKey[1]);if(doneSpark)faithCompleteSpark(doneSpark);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-delete]")){var deleteKey=b.getAttribute("data-faith-spark-delete").split("|"),deletedSparkId=deleteKey[1];if(deleteKey[0]==="faith")S.ideas=S.ideas.filter(function(item){return item.id!==deletedSparkId;});else{var deleteOwner=S.people.find(function(person){return person.id===deleteKey[0];});if(deleteOwner)deleteOwner.sparks=(deleteOwner.sparks||[]).filter(function(item){return item.id!==deletedSparkId;});}if(faithSparkDraft&&faithSparkDraft.id===deletedSparkId){faithSparkDraft=null;faithSparkEditId=null;faithSparkOwnerId="faith";}delete tendItemAssociationDrafts[tendAssociationKey("spark",deleteKey[0],deletedSparkId)];save();render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-reopen]")){var reopenKey=b.getAttribute("data-faith-spark-reopen").split("|"),item=faithFindSpark(reopenKey[0],reopenKey[1]);if(item){item.done=false;item.completedTs=null;item.completedDate=null;save();render();}event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-add]")){delete prayerAddDrafts.global;delete tendItemAssociationDrafts[tendAssociationKey("prayer","global","new")];faithPrayerDraftOpen=true;render();var title=document.querySelector('[data-prayer-editor="new-global"] [data-prayer-field="title"]');if(title)title.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-cancel]")){delete prayerAddDrafts.global;delete tendItemAssociationDrafts[tendAssociationKey("prayer","global","new")];faithPrayerDraftOpen=false;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-save]")){if(faithSavePrayer(b)){faithPrayerDraftOpen=false;render();}event.stopImmediatePropagation();return;}
},true);
document.addEventListener("keydown",function(event){
 var current=event.target.closest&&event.target.closest('[role="tab"][data-faith-practice-tab]');
 if(!current)return;
 var tabs=Array.from(current.closest('[role="tablist"]').querySelectorAll('[role="tab"]')),index=tabs.indexOf(current),nextIndex;
 if(event.key==="ArrowRight")nextIndex=(index+1)%tabs.length;
 else if(event.key==="ArrowLeft")nextIndex=(index+tabs.length-1)%tabs.length;
 else if(event.key==="Home")nextIndex=0;
 else if(event.key==="End")nextIndex=tabs.length-1;
 else return;
 event.preventDefault();
 tabs[nextIndex].click();
},true);
document.addEventListener("keydown",function(event){
 var viewTab=event.target.closest&&event.target.closest("[data-faith-view-select]");
 if(viewTab){
  var viewIndex=FAITH_MAIN_VIEWS.indexOf(viewTab.getAttribute("data-faith-view-select")),nextViewIndex=viewIndex;
  if(event.key==="ArrowRight")nextViewIndex=(viewIndex+1)%FAITH_MAIN_VIEWS.length;
  else if(event.key==="ArrowLeft")nextViewIndex=(viewIndex-1+FAITH_MAIN_VIEWS.length)%FAITH_MAIN_VIEWS.length;
  else if(event.key==="Home")nextViewIndex=0;
  else if(event.key==="End")nextViewIndex=FAITH_MAIN_VIEWS.length-1;
  if(nextViewIndex!==viewIndex){event.preventDefault();faithSetMainView(FAITH_MAIN_VIEWS[nextViewIndex],true);return;}
 }
 if(!faithPrayerSession||event.altKey||event.ctrlKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
 if(event.key==="ArrowRight"){event.preventDefault();faithPrayerSessionMove(1);}
 else if(event.key==="ArrowLeft"){event.preventDefault();faithPrayerSessionMove(-1);}
 else if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();faithPrayerSession.ended=true;render();var sessionEndTitle=document.getElementById("faithSessionTitle");if(sessionEndTitle)sessionEndTitle.focus({preventScroll:true});}
},true);
var faithPrayerTouchStart=null;
document.addEventListener("touchstart",function(event){
 if(faithPrayerSession&&event.target.closest&&event.target.closest("[data-faith-session-card]")&&event.touches.length===1)faithPrayerTouchStart=event.touches[0].clientX;
},{passive:true});
document.addEventListener("touchend",function(event){
 if(faithPrayerTouchStart===null||!faithPrayerSession)return;
 var delta=event.changedTouches[0].clientX-faithPrayerTouchStart;faithPrayerTouchStart=null;
 if(Math.abs(delta)>70)faithPrayerSessionMove(delta<0?1:-1);
},{passive:true});

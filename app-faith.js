"use strict";
/* ============ Faith practice page ============ */
var FAITH_GROUPS=["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
var faithRhythmDraft=null,faithSparkDraft=null,faithSparkEditId=null,faithSparkOwnerId="faith",faithNotesExpanded=false,faithPrayerDraftOpen=false,faithPrayerExpanded=false,faithTodayExpanded=false,faithMainView="practices",faithMainViewInitialized=false,faithSettingsOpen=false,faithPrayerSession=null,faithPrayerPeopleOpen=false,dashboardPrayerPeople=null,dashboardPrayerPeopleOpen=false,dashboardPrayerTimeMode="now",personDashboardPrayerTimeModes={},personDashboardPrayerDialogOpen=null;
var FAITH_MAIN_VIEWS=["today","practices","requests","notes"];
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
 return view==="all"?"all":"today";
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
 var value=faithScoreText(score),level=faithScoreClass(score);
 return '<span class="rhythm-health faith-nav-score '+level+'" aria-label="'+(Number.isFinite(score)?score+" percent":"No rhythm score")+'"><span class="sm-dot '+level+'" aria-hidden="true"></span><span>'+value+(Number.isFinite(score)?"%":"")+'</span></span>';
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
 return '<button type="button" class="faith-prayer-request-health" data-faith-prayer-requests="1" aria-label="Prayer health '+(score===null?"unavailable":score+" percent")+', '+count+' active prayer'+(count===1?"":"s")+'"><span class="faith-prayer-request-health-heading"><span><strong>Prayer health</strong><span>'+count+' prayer'+(count===1?"":"s")+'</span></span><span class="faith-prayer-request-health-score '+scoreClass+'">'+scoreText+'</span></span><span class="faith-prayer-request-health-meter" role="meter" aria-label="Prayer health" aria-valuemin="0" aria-valuemax="100"'+(score===null?' aria-valuetext="No score available"':' aria-valuenow="'+score+'" aria-valuetext="'+score+' out of 100"')+'><span class="'+scoreClass+'" style="width:'+(score===null?0:score)+'%"></span></span></button>';
}
function faithTimeRank(tod){if(tod==="allday")return -1;var blocks=dayBlocks(),index=blocks.findIndex(function(block){return block.id===tod;});return index<0?blocks.length:index;}
function faithPracticeCount(group){return faithRhythms(group).length+(typeof window.faithLinkedRhythmCount==="function"?window.faithLinkedRhythmCount(group):0);}
function faithPracticeGroups(){return FAITH_GROUPS.filter(faithGroupEnabled);}
function faithInitialMainView(group){
 if(faithMainViewInitialized)return;
 faithMainViewInitialized=true;
 var legacyTab=(faithConfig().practiceTabs||{})[group];
 faithMainView=legacyTab==="prayer"?"requests":legacyTab==="notes"?"notes":"practices";
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
function faithViewNavHTML(){
 var labels={today:"Today",practices:"Practices",requests:"Requests",notes:"Notes"};
 return '<div class="faith-view-nav" role="tablist" aria-label="Faith views">'+FAITH_MAIN_VIEWS.map(function(view){var selected=faithMainView===view;return '<button type="button" role="tab" id="faith-view-tab-'+view+'" aria-controls="faith-view-panel-'+view+'" aria-selected="'+selected+'" tabindex="'+(selected?"0":"-1")+'" data-faith-view-select="'+view+'">'+labels[view]+'</button>';}).join("")+'</div>';
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
  return tendRhythmCardHTML(r,{title:r.text||"(unnamed rhythm)",description:r.description,peopleBadgesHTML:tendAssociationPeopleBadges(r,owner?owner.id:"faith",null,"rhythm"),
   frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
   tendAttributes:{"data-tend-open":"faith-rhythm","data-rhythm-id":r.id},showScore:false});
 }
 function sparkCard(s){
  var owner=s.profileOwnerId||"faith",badges=tendAssociationPeopleBadges(s,owner,null,"spark")+tendAssociationCategoryBadges(s);
  return tendSparkCardHTML(s,{title:s.text||"Faith Spark",description:s.details,actionHTML:'<button type="button" class="btn mini sparkbtn" data-faith-sparkdone="'+esc(owner+"|"+s.id)+'">Do it</button>',
   topMetaHTML:badges?'<div class="plan-item-top-meta">'+badges+'</div>':'',footerHTML:'<span class="dashboard-spark-deadline">'+esc((s.time?fmtHM12(s.time)+" · ":"")+sparkDueTxt(s))+'</span>',className:"faith-today-spark"});
 }
 var scheduledCount=rhythms.length,count=scheduledCount+sparks.length,visibleRhythms=faithTodayExpanded?rhythms:rhythms.slice(0,3),expandToday=scheduledCount>3?'<button type="button" class="btn mini ghost faith-today-expand" data-faith-today-expand="'+(faithTodayExpanded?"fewer":"all")+'">'+(faithTodayExpanded?"Show fewer":"View all for today ("+scheduledCount+")")+'</button>':"";
 var out='<section class="faith-today-section" aria-labelledby="faithTodayTitle">'+tendSectionHeaderHTML({title:"Today in Faith",titleId:"faithTodayTitle",className:"faith-today-heading",trailingHTML:'<span class="qpill'+(count?"":" clear")+'">'+(count?count+" for today":"nothing due today")+'</span>'});
 out+='<div class="faith-today-list">'+(visibleRhythms.length?visibleRhythms.map(rhythmCard).join(""):'<div class="profile-empty-state">No rhythms due today.</div>')+'</div>'+expandToday+'</section>';
 out+=tendSectionHeaderHTML({title:"Pray",className:"faith-today-subheading"})+dashboardFocusedPrayerHTML();
 out+=tendSectionHeaderHTML({title:"Sparks",className:"faith-today-subheading"})+'<div class="faith-today-sparks">'+(sparks.length?sparks.map(sparkCard).join(""):'<div class="profile-empty-state faith-today-empty">No Sparks waiting.</div>')+'</div>';
 return out;
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
 function summaryButton(key,label,value){
  var display=faithScoreText(value),tone=Number.isFinite(value)?faithScoreClass(value):"neutral";
  return '<button type="button" class="person-health-summary" id="faith-health-summary-'+key+'" data-person-health-summary="'+key+'" aria-label="'+esc(label+' score '+display)+'" aria-controls="person-health-detail" aria-expanded="false"><span class="person-health-summary-score '+tone+'">'+esc(display)+'</span><span class="person-health-summary-label">'+label+'</span></button>';
 }
 var latestRhythmEvent=null;
 rhythms.forEach(function(rhythm){var event=rhythmLast(rhythm);if(event&&(!latestRhythmEvent||Number(event.ts)>Number(latestRhythmEvent.ts)))latestRhythmEvent=event;});
 var latestPrayer=null;
 prayers.forEach(function(prayer){var logs=prayerLogsFor(prayer),last=logs.length?logs[logs.length-1]:null;if(last!==null&&(!latestPrayer||last>latestPrayer.ts))latestPrayer={prayer:prayer,ts:last};});
 var latestRhythmText=latestRhythmEvent?"Last tended: "+when(latestRhythmEvent.ts):"Last tended: Never";
 var latestPrayerText=latestPrayer?"Last prayed: "+prayerLastPrayedLabel(latestPrayer.prayer):"Last prayed: Never";
 var rhythmCount=rhythms.length+" active rhythm"+(rhythms.length===1?"":"s");
 var prayerCount=prayers.length+" active prayer"+(prayers.length===1?"":"s");
 var summaries='<div class="person-health-summaries" role="group" aria-label="Faith health summaries">'
  +summaryButton("rhythms","Rhythms",rhythmScoreValue)+summaryButton("prayer","Prayer",prayerScoreValue)+'</div>';
 summaries+='<div class="person-health-detail" id="person-health-detail" hidden aria-live="polite">'
  +'<section class="person-health-detail-content" data-person-health-detail="rhythms" hidden><div class="person-health-detail-heading"><div><h4>Rhythms</h4><p>'+esc(latestRhythmText)+'</p><p>'+esc(rhythmCount)+'</p></div><button type="button" class="person-health-detail-icon" data-faith-practice-tab="Prayer|rhythms" aria-label="View rhythms" title="View rhythms">'+collectionIcon("rhythms")+'</button></div></section>'
  +'<section class="person-health-detail-content" data-person-health-detail="prayer" hidden><div class="person-health-detail-heading"><div><h4>Prayer</h4><p>'+esc(latestPrayerText)+'</p><p>'+esc(prayerCount)+'</p></div><button type="button" class="person-health-detail-icon" data-faith-prayer-requests="1" aria-label="View prayer requests" title="View prayer requests">'+collectionIcon("prayer")+'</button></div></section>'
  +'</div>';
 return '<section class="card faith-health-card" aria-labelledby="faithHealthTitle"><div class="person-health-heading"><div class="faith-health-overview-copy"><h4 id="faithHealthTitle">Overall Faith health</h4><p>Faith rhythms and prayers, tended together.</p><div class="person-health-status statusword '+level+'">'+(overall===null?"No active Faith health scores":esc(scoreLabel(overall)))+'</div></div><span class="person-profile-score">'+faithScoreText(overall)+'</span></div><div class="bar-ov person-health-bar solid" role="meter" aria-label="Overall Faith health" aria-valuemin="0" aria-valuemax="100"'+(overall===null?' aria-valuetext="No active Faith health scores"':' aria-valuenow="'+overall+'" aria-valuetext="'+overall+' out of 100: '+esc(scoreLabel(overall))+'"')+'><span class="person-health-fill" style="width:'+(overall===null?0:overall)+'%;background:'+personHealthColor(overall)+'" aria-hidden="true"></span></div>'+summaries+'</section>';
}
function faithSettingsHTML(){
 return faithSettingsOpen?'<section class="faith-sections-settings" id="faith-sections-settings" aria-labelledby="faithSectionsTitle"><div class="faith-settings-heading"><div><h2 id="faithSectionsTitle">Sections</h2><p>Choose which practice sections appear on this page.</p></div><button type="button" class="iconbtn" data-faith-settings-close="1" aria-label="Close section settings">×</button></div><div class="faith-settings-list">'+FAITH_GROUPS.map(function(group){return '<label><input type="checkbox" data-faith-enabled="'+esc(group)+'"'+(faithGroupEnabled(group)?" checked":"")+'><span>'+esc(group)+'</span></label>';}).join("")+'</div></section>':'';
}
function faithSectionNavHTML(selected){
 var groups=faithPracticeGroups();
 if(!groups.length)return '<div class="faith-section-nav-empty">All practice sections are off. Re-enable one in Sections settings.</div>';
 return '<nav class="faith-section-nav" aria-label="Faith practices">'+groups.map(function(group){
  var score=faithPracticeHealth(group);
  return '<button type="button" data-faith-select="'+esc(group)+'" aria-current="'+(group===selected?"page":"false")+'"><span>'+esc(group)+'</span><span class="faith-nav-meta"><span class="faith-count">'+faithPracticeCount(group)+'</span>'+faithNavScoreHTML(score)+'</span></button>';
 }).join("")+'</nav>';
}
function faithRhythmEditorHTML(r){
 var isNew=!r.id,idf="faith|"+(r.id||"draft");
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="faith-rhythm-editor-title"><div class="profile-editor-body faith-item-editor" data-faith-rhythm-editor><h3 id="faith-rhythm-editor-title">'+(isNew?"Add Rhythm":"Edit Rhythm")+'</h3><label>Title<input data-faith-title value="'+esc(r.text||"")+'" placeholder="Practice title"></label><label>Description<textarea data-faith-description placeholder="Why this practice matters (optional)">'+esc(r.description||"")+'</textarea></label>'+personRhythmScheduleHTML(r,idf)+rhythmPickerControlsHTML("faith",r,idf,true)+'<div class="faith-item-actions"><button type="button" class="btn mini" data-faith-rhythm-save="'+(isNew?"new":esc(r.id))+'">Save Rhythm</button><button type="button" class="btn mini ghost" data-faith-rhythm-cancel="1" data-editor-cancel>Cancel</button>'+(isNew?"":'<button type="button" class="btn mini danger" data-faith-rhythm-delete="'+esc(r.id)+'">Delete</button>')+'</div></div></dialog>'+rhythmPickerModalHTML();
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
 var out=!faithRhythmDraft?'<div class="faith-add-row"><button type="button" class="btn mini ghost" data-faith-rhythm-add="'+esc(group)+'">+ Add rhythm</button></div>':"";
 if(rows)out+='<div class="faith-practice-rhythm-list">'+rows+'</div>';
 else out+='<div class="empty">No rhythms in this practice yet.</div>';
 if(faithRhythmDraft&&!faithRhythmDraft.id&&faithRhythmDraft.faithGroup===group)out+=faithRhythmEditorHTML(faithRhythmDraft);
 return out;
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
function faithPrayerViewRecords(view){
 var items=view==="today"?faithPrayerTimeGroups():faithActivePrayers().slice().sort(faithPrayerScoreOrder);
 return items.filter(faithPrayerAllMatches);
}
function faithPrayerTodayHTML(items,hidePrayerBadge){
 items=items||faithPrayerViewRecords("today");
 if(!items.length)return '<div class="empty">No active requests are scheduled for today.</div>';
 var buckets={};
 items.forEach(function(p){var key=p.tod||"anytime";(buckets[key]||(buckets[key]=[])).push(p);});
 var keys=Object.keys(buckets).sort(function(a,b){return faithTimeRank(a)-faithTimeRank(b);});
 return keys.map(function(key){var block=dayBlocks().find(function(item){return item.id===key;});var label=block?block.name:(key==="allday"?"All day":"Flexible");return '<section class="faith-prayer-time-group"><h3>'+esc(label)+'</h3>'+faithPrayerRows(buckets[key],hidePrayerBadge)+'</section>';}).join("");
}
function faithPrayerAllMatches(p){
 var config=faithConfig(),selectedPeople=Array.isArray(config.prayerPeople)?config.prayerPeople:null,groups=Object.assign({marriage:true,parenting:true,friendships:true},config.prayerGroups||{});
 if(selectedPeople===null)return true;
 if(selectedPeople.indexOf("me")>=0&&faithPrayerIsMine(p))return true;
 var personIds=(p.personId?[p.personId]:[]).concat(Array.isArray(p.sharedWith)?p.sharedWith:[]);
 return personIds.some(function(id){
  if(selectedPeople.indexOf(id)<0)return false;
  var person=S.people.find(function(item){return item.id===id;});
  return !!person&&!!groups[faithPrayerPersonGroup(person)];
 });
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
function faithPrayerAllHTML(active,expandControl,hidePrayerBadge){
 active=active||faithPrayerViewRecords("all");
 var closed=S.prayers.filter(function(p){return (p.answered||p.archived)&&faithPrayerAllMatches(p);});
 var out=active.length?faithPrayerRows(active,hidePrayerBadge):'<div class="empty">No active prayer requests match these filters.</div>';
 if(expandControl)out+=expandControl;
 if(closed.length)out+='<details class="faith-history-list"><summary>Answered and archived ('+closed.length+')</summary>'+faithPrayerRows(closed,hidePrayerBadge)+'</details>';
 return out;
}
function faithPrayerRequestContentHTML(view,items){
 var visible=faithPrayerExpanded?items:items.slice(0,3),expandControl=items.length>3?'<button type="button" class="btn mini ghost faith-prayer-expand" data-faith-prayer-expand="'+(faithPrayerExpanded?"fewer":"all")+'">'+(faithPrayerExpanded?"Show fewer":"View all prayers ("+items.length+")")+'</button>':"";
 var content=view==="today"?faithPrayerTodayHTML(visible,true)+expandControl:faithPrayerAllHTML(visible,expandControl,true);
 return content;
}
function faithPrayerPeopleFilterHTML(){
 var people=S.people.slice().sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));});
 var config=faithConfig(),selectedPeople=Array.isArray(config.prayerPeople)?config.prayerPeople:null,groups=Object.assign({marriage:true,parenting:true,friendships:true},config.prayerGroups||{});
 var selectedCount=selectedPeople?selectedPeople.length:people.length+1;
 return '<details class="faith-prayer-filter"'+(faithPrayerPeopleOpen?" open":"")+'><summary><span>People:</span><span class="faith-prayer-filter-count">'+selectedCount+' selected</span></summary><div class="faith-prayer-filter-panel"><div class="faith-prayer-filter-actions"><button type="button" data-faith-prayer-filter-action="all">Show all</button><button type="button" data-faith-prayer-filter-action="clear">Clear all</button></div><label class="faith-prayer-person-option faith-prayer-me-option"><input type="checkbox" data-faith-prayer-person="me"'+(!selectedPeople||selectedPeople.indexOf("me")>=0?' checked':'')+'>'+(settings().profilePhoto?personAvatar({name:"Me",photo:settings().profilePhoto},24):'<span class="faith-prayer-me-avatar">Me</span>')+'<span>Me</span></label><div class="faith-prayer-filter-groups">'+["marriage","parenting","friendships"].map(function(group){var labels={marriage:"Marriage",parenting:"Parenting",friendships:"Friendships"};return '<label><input type="checkbox" data-faith-prayer-group="'+group+'"'+(groups[group]?' checked':'')+'><span>'+labels[group]+'</span></label>';}).join("")+'</div><div class="faith-prayer-filter-people">'+people.map(function(person){var checked=!selectedPeople||selectedPeople.indexOf(person.id)>=0;return '<label class="faith-prayer-person-option"><input type="checkbox" data-faith-prayer-person="'+esc(person.id)+'"'+(checked?' checked':'')+'>'+personAvatar(person,24)+'<span>'+esc(person.name)+'</span></label>';}).join("")+'</div></div></details>';
}
function faithPrayerFilterRender(attribute,value){
 var scrollX=window.scrollX,scrollY=window.scrollY,panel=document.querySelector(".faith-prayer-filter-panel"),panelScrollTop=panel?panel.scrollTop:0;
 render();
 requestAnimationFrame(function(){
  var selector="[data-faith-prayer-"+attribute+"]",control=Array.from(document.querySelectorAll(selector)).find(function(item){return item.getAttribute("data-faith-prayer-"+attribute)===value;}),nextPanel=document.querySelector(".faith-prayer-filter-panel");
  if(nextPanel)nextPanel.scrollTop=panelScrollTop;
  if(control)control.focus({preventScroll:true});
  window.scrollTo(scrollX,scrollY);
 });
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
 if(people===null)return true;
 if(people.indexOf("me")>=0&&faithPrayerIsMine(p))return true;
 var personIds=(p.personId?[p.personId]:[]).concat(Array.isArray(p.sharedWith)?p.sharedWith:[]);
 return personIds.some(function(id){return people.indexOf(id)>=0;});
}
function faithDashboardPrayerSessionSort(timeBlock,people){
 return faithActivePrayers().filter(function(p){return faithDashboardPrayerMatches(p,timeBlock,people);}).sort(faithPrayerScoreOrder).map(function(p){return p.id;});
}
function faithPrayerTimeframePickerData(mode,people){
 var options=planBlocksDef().map(function(item){
  var id=item.cur?"now":item.id;
  return {id:id,label:item.name,timeDescription:item.range,count:faithDashboardPrayerSessionSort(item.id,people).length,isCurrent:item.cur};
 });
 var allDayCount=faithDashboardPrayerSessionSort("all",people).length;
 return tendPrayerTimeframePickerState(mode,options,allDayCount);
}
window.personFocusedPrayerHTML=function(person){
 var pid=person.id,mode=personDashboardPrayerTimeModes[pid]||"now",people=[pid],pickerData=faithPrayerTimeframePickerData(mode,people),count=pickerData.selectedCount,timeLabel=pickerData.label;
 var dialog="";
 if(personDashboardPrayerDialogOpen===pid){
  var timeToggle=tendPrayerTimeframePickerHTML({
   personId:pid,
   label:pickerData.label,
   options:pickerData.options,
   selectedTimeframeId:pickerData.selectedTimeframeId,
   allDayCount:pickerData.allDayCount
  });
  dialog=tendPrayerFilterDialogHTML({
   id:"person-dashboard-prayer-dialog",
   titleId:"person-dashboard-prayer-title",
   title:"Prayer timeframe for "+person.name,
   timeframeHTML:timeToggle,
   count:count,
   timeLabel:timeLabel,
   closeActionHTML:'<button type="button" class="btn mini ghost" data-person-dashboard-prayer-close="'+esc(pid)+'" data-editor-cancel>Done</button>'
  });
 }
 return tendFocusedPrayerSectionHTML({className:"person-focused-prayer",ariaLabel:"Focused prayer for "+person.name,controlsHTML:'<span class="dashboard-prayer-context">'+count+' '+(count===1?"prayer":"prayers")+' · '+esc(timeLabel)+'</span>'+tendFilterButtonHTML({className:"dashboard-prayer-filter",label:"Filter",ariaLabel:"Filter prayer timeframe for "+person.name+": "+timeLabel,haspopup:"dialog",controls:"person-dashboard-prayer-dialog",attributes:{"data-person-dashboard-prayer-open":pid}}),actionHTML:'<button type="button" class="btn mini faith-start-prayer" data-person-dashboard-prayer-start="'+esc(pid)+'" aria-label="Start focused prayer for '+count+' '+(count===1?"prayer":"prayers")+' for '+esc(person.name)+'">'+collectionIcon("prayer")+'<span>Focused Prayer</span><span class="faith-prayer-session-count" aria-hidden="true">'+count+'</span></button>',dialogHTML:dialog});
};
function tendFilterButtonHTML(options){
 options=options||{};
 var label=String(options.label||"Filter"),className=["tend-filter-button",options.className].filter(Boolean).join(" "),attributes=Object.keys(options.attributes||{}).filter(function(name){return /^(data|aria)-[a-z0-9-]+$/.test(name);}).map(function(name){return " "+name+'="'+esc(options.attributes[name])+'"';}).join("");
 return '<button type="button" class="'+esc(className)+'"'+attributes+(options.haspopup?' aria-haspopup="'+esc(options.haspopup)+'"':"")+(options.controls?' aria-controls="'+esc(options.controls)+'"':"")+' aria-label="'+esc(options.ariaLabel||label)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h17l-6.5 7.2v5.3l-4 2v-7.3z"/></svg></button>';
}
function faithDashboardPrayerPeopleHTML(){
 var people=S.people.slice().sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));}),selected=dashboardPrayerPeople,selectedCount=selected===null?people.length+1:selected.length,pickerData=faithPrayerTimeframePickerData(dashboardPrayerTimeMode,selected),timeLabel=pickerData.label;
 return '<span class="dashboard-prayer-context">'+selectedCount+' '+(selectedCount===1?"person":"people")+' · '+esc(timeLabel)+'</span>'+tendFilterButtonHTML({className:"dashboard-prayer-filter",label:"Filter",ariaLabel:"Filter prayer: "+selectedCount+" "+(selectedCount===1?"person":"people")+" · "+timeLabel,haspopup:"dialog",controls:"dashboard-prayer-people-dialog",attributes:{"data-dashboard-prayer-people-open":""}});
}
function faithDashboardPrayerTimeBlock(mode){
 if(mode==="all"||mode==="allday")return "all";
 if(mode==="now")return dayBlockAt(new Date());
 return dayBlocks().some(function(block){return block.id===mode;})?mode:dayBlockAt(new Date());
}
function faithDashboardPrayerTimeName(mode){
 if(mode==="now")return "Now";
 if(mode==="all"||mode==="allday")return "All Day";
 var block=dayBlocks().find(function(item){return item.id===mode;});
 return block?block.name:"Now";
}
function faithDashboardPrayerPeopleDialogHTML(){
 if(!dashboardPrayerPeopleOpen)return "";
 var selected=dashboardPrayerPeople===null?["me"].concat(S.people.map(function(person){return person.id;})):dashboardPrayerPeople.slice(),groups=[["marriage","Marriage"],["parenting","Parenting"],["friendships","Friendships"]],groupOrder={marriage:0,parenting:1,friendships:2},pickerData=faithPrayerTimeframePickerData(dashboardPrayerTimeMode,dashboardPrayerPeople),prayerCount=pickerData.selectedCount,timeLabel=pickerData.label;
 function firstName(person){return String(person&&person.name||"").trim().split(/\s+/)[0]||"";}
 function personOption(person){
  var checked=selected.indexOf(person.id)>=0;
  return '<button type="button" class="prayer-person person-badge-clickable rhythm-picker-option'+(checked?" selected":"")+'" data-dashboard-prayer-person-toggle="'+esc(person.id)+'" aria-pressed="'+checked+'">'+personAvatar({id:person.id,name:firstName(person),photo:person.photo},28)+esc(firstName(person))+'</button>';
 }
 var meSelected=selected.indexOf("me")>=0,mePerson={name:"Me",photo:settings().profilePhoto};
 var orderedPeople=S.people.slice().sort(function(a,b){var groupDifference=groupOrder[faithPrayerPersonGroup(a)]-groupOrder[faithPrayerPersonGroup(b)];return groupDifference||firstName(a).localeCompare(firstName(b));});
 var timeLabel=pickerData.label,timeToggle=tendPrayerTimeframePickerHTML({
  label:timeLabel,
  options:pickerData.options,
  selectedTimeframeId:pickerData.selectedTimeframeId,
  allDayCount:pickerData.allDayCount
 });
 var selectionHTML=tendPeopleGroupToggleBar(selected,"me","data-dashboard-prayer-group-toggle")+'<div class="rhythm-picker-options dashboard-prayer-people-options"><button type="button" class="prayer-person person-badge-clickable rhythm-picker-option'+(meSelected?" selected":"")+'" data-dashboard-prayer-person-toggle="me" aria-pressed="'+meSelected+'">'+personAvatar(mePerson,28)+'Me</button>'+orderedPeople.map(personOption).join("")+'</div>';
 return tendPrayerFilterDialogHTML({
  id:"dashboard-prayer-people-dialog",
  titleId:"dashboard-prayer-people-title",
  title:"People for focused prayer",
  timeframeHTML:timeToggle,
  intro:"Choose whose prayer requests to include.",
  count:prayerCount,
  timeLabel:timeLabel,
  selectionHTML:selectionHTML,
  primaryActionHTML:'<button type="button" class="btn mini" data-dashboard-prayer-people-pray>Pray</button>',
  closeActionHTML:'<button type="button" class="btn mini ghost" data-dashboard-prayer-people-close data-editor-cancel>Done</button>'
 });
}
function faithFocusedPrayerButtonHTML(view){
 var prayerCount=faithPrayerSessionSort(view);
 var count=prayerCount.length;
 return '<button type="button" class="btn mini faith-start-prayer faith-request-focused-button" data-faith-session-start="'+view+'" aria-label="Start focused prayer for '+count+' '+(count===1?"prayer":"prayers")+'"'+(count?"":" disabled")+'>'+collectionIcon("prayer")+'<span>Focused Prayer</span><span class="faith-prayer-session-count" aria-hidden="true">'+count+'</span></button>';
}
function faithPrayerSessionHTML(){
 var ids=faithPrayerSession?faithPrayerSession.ids:[],items=ids.map(function(id){return S.prayers.find(function(p){return p.id===id&&!p.answered&&!p.archived;});}).filter(Boolean);
 if(!faithPrayerSession)return "";
 var sessionHeading=faithPrayerSession.source==="person"?esc(faithPrayerSession.personName)+" · Prayer time":"Faith · Prayer time";
 if(!items.length)return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><span class="faith-eyebrow" id="faithSessionTitle">'+sessionHeading+'</span></header><section class="card faith-session-empty"><h1>No requests in this session</h1><p>'+(faithPrayerSession.source==="person"?"There are no active prayer requests for "+esc(faithPrayerSession.personName)+" in this timeframe.":faithPrayerSession.view==="today"?"There are no active requests scheduled for today.":faithPrayerSession.view==="dashboard"?"There are no active prayer requests for this timeframe and these people.":"There are no active prayer requests matching these filters.")+'</p><div class="faith-item-actions">'+(faithPrayerSession.view==="all"&&faithActivePrayers().some(function(p){return faithPrayerScheduledToday(p)&&faithPrayerAllMatches(p);})?'<button type="button" class="btn" data-faith-session-start="today">Focused Prayer · Today</button>':"")+'<button type="button" class="btn" data-faith-session-exit="1">Finish</button></div></section></dialog>';
 if(faithPrayerSession.index>=items.length)return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><span class="faith-eyebrow">'+sessionHeading+'</span></header><section class="card faith-session-empty"><div class="faith-session-progress">'+items.length+' of '+items.length+'</div><h1 id="faithSessionTitle">Prayer time complete</h1><p>You made space for each request in this session.</p><div class="faith-item-actions"><button type="button" class="btn ghost" data-faith-session-back="1">Back</button><button type="button" class="btn" data-faith-session-exit="1">Finish</button></div></section></dialog>';
 var p=items[faithPrayerSession.index];
 return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><div><span class="faith-eyebrow">'+sessionHeading+'</span><h1 id="faithSessionTitle">One request at a time</h1></div></header><div class="faith-session-progress" aria-live="polite">'+(faithPrayerSession.index+1)+' of '+items.length+'</div><div class="faith-session-track" aria-hidden="true"><span style="width:'+Math.round((faithPrayerSession.index+1)/items.length*100)+'%"></span></div><article class="card faith-session-card" data-faith-session-card tabindex="-1"><div class="faith-session-person">'+faithPrayerIdentity(p)+'</div><h2>'+esc(p.text||"Prayer request")+'</h2><p>'+(p.details?esc(p.details):"")+'</p><div class="faith-session-meta">'+esc(prayerScheduleLabel(p))+' · prayed '+(p.prayed||0)+' '+((p.prayed||0)===1?"time":"times")+'</div></article><nav class="faith-session-actions" aria-label="Prayer time actions"><button type="button" class="btn ghost" data-faith-session-back="1"'+(faithPrayerSession.index===0?' disabled':'')+'>Back</button><button type="button" class="btn ghost" data-faith-session-skip="1">Skip</button><button type="button" class="btn faith-session-prayed" data-faith-session-prayed="'+esc(p.id)+'">Prayed</button><button type="button" class="btn ghost faith-session-finish" data-faith-session-exit="1">Finish</button></nav><p class="faith-session-help">Use ← / → to move between requests. Moving never records a prayer.</p></dialog>';
}
function faithPrayerRequestsHTML(){
 var view=faithSelectedPrayerView(),items=faithPrayerViewRecords(view),nextView=view==="today"?"all":"today",buttonLabel=view==="today"?"Today":"All";
 var matchingLabel=items.length+" matching "+(items.length===1?"request":"requests");
 return '<section class="faith-prayer-requests" id="faith-prayer-requests" aria-labelledby="faithPrayerRequestsTitle">'+tendPrayerSectionHTML("Prayer requests","",{titleId:"faithPrayerRequestsTitle",subtitle:"People and needs to bring before God.",headerClassName:"faith-prayer-requests-heading"})+faithPrayerRequestHealthHTML()+'<div class="faith-prayer-hub" id="faith-prayer-hub"><div class="faith-prayer-filters"><button type="button" class="faith-prayer-view-toggle" data-faith-prayer-view="'+nextView+'" aria-pressed="'+(view==="all")+'" aria-label="Switch to '+(nextView==="today"?"Today":"All")+' prayers"><span>Timeframe:</span><strong>'+buttonLabel+'</strong><span aria-hidden="true">↔</span></button>'+faithPrayerPeopleFilterHTML()+'</div><p class="faith-prayer-matching-count" aria-live="polite">'+matchingLabel+'</p><div class="faith-prayer-actions">'+faithFocusedPrayerButtonHTML(view)+(!faithPrayerDraftOpen?'<button type="button" class="btn mini ghost faith-prayer-add-button" data-faith-prayer-add="1">+ Add prayer</button>':'')+'</div><div class="faith-prayer-content">'+faithPrayerRequestContentHTML(view,items)+'</div>'+faithPrayerAddDialogHTML()+'</div></section>';
}
function faithPracticeContent(group){
 var description=faithConfig().groupDescriptions[group]||"";
 var tabs=["rhythms","sparks"],labels={rhythms:"Rhythms",sparks:"Sparks"},selected=faithPracticeTab(group);
 var content=selected==="rhythms"?faithRhythmsHTML(group):faithSparksHTML(group);
 return '<section class="faith-practice-panel" id="faith-practice-panel" aria-labelledby="faithPracticeTitle"><header class="faith-practice-heading">'+tendSectionHeaderHTML({title:group,titleId:"faithPracticeTitle",style:"margin:0"})+(description?'<div class="faith-practice-focus"><p>'+esc(description)+'</p></div>':"")+'</header><nav class="profile-tabs faith-practice-tabs" aria-label="'+esc(group)+' sections">'+tabs.map(function(tab){return '<button type="button" data-faith-practice-tab="'+esc(group)+'|'+tab+'" aria-selected="'+(tab===selected)+'">'+labels[tab]+'</button>';}).join("")+'</nav><div class="faith-tab-content">'+content+'</div></section>';
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
 var out=!faithSparkDraft?'<div class="faith-add-row"><button type="button" class="btn mini ghost" data-faith-spark-add="1">+ Add Spark</button></div>':"";
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
 var out='<section class="faith-notes-section" aria-labelledby="faithNotesTitle">'+tendSectionHeaderHTML({title:"Notes",titleId:"faithNotesTitle",subtitle:"Thoughts, encouragement, and follow-ups to remember.",className:"faith-notes-heading"})+'<div class="faith-notes-toolbar"><button type="button" class="btn mini ghost profile-rhythm-add" data-profilenoteopen="faith">'+profileActionIcon("log")+'<span>Add note</span></button></div><div class="person-notes faith-notes-list">';
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
 var enabled=faithPracticeGroups(),selected=faithSelectedGroup(),config=faithConfig();
 if(enabled.length&&enabled.indexOf(selected)<0){selected=enabled[0];config.selectedGroup=selected;}
 faithInitialMainView(selected);
 var out='<main class="faith-page">'+tendSectionHeaderHTML({title:"Faith",subtitle:"Small practices, tended over time.",className:"faith-page-heading",tagName:"header",trailingHTML:'<button type="button" class="btn ghost faith-sections-toggle" data-faith-settings="1" aria-expanded="'+faithSettingsOpen+'" aria-controls="faith-sections-settings">⚙ Sections</button>'});
 var practices=tendSectionHeaderHTML({title:"Your practices",subtitle:"Choose an area to tend.",className:"faith-practices-heading"})+'<div class="faith-section-nav-wrap">'+faithSectionNavHTML(selected)+'</div><div class="faith-practice-wrap">'+(enabled.length?faithPracticeContent(selected):'<section class="card faith-practice-card"><p>Turn on a section in Sections settings to manage Faith practices.</p></section>')+'</div>';
 out+=faithSettingsHTML()+faithHealthHTML()+faithViewNavHTML();
 out+=faithViewPanelHTML("today",faithTodayHTML());
 out+=faithViewPanelHTML("practices",'<section class="faith-browser" aria-label="Faith practice navigation">'+practices+'</section>');
 out+=faithViewPanelHTML("requests",faithPrayerRequestsHTML());
 out+=faithViewPanelHTML("notes",faithNotesHTML());
 out+='</main>';
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
 if(draft.endDateEnabled&&!draft.until){flash("Choose an end date");var until=document.querySelector('[data-rfield$="|until"]');if(until)until.focus();return;}
 var record=JSON.parse(JSON.stringify(draft));record.text=record.text.trim();record.faithGroup=draft.faithGroup;record.category="faith";record.disabled=false;record.faithUserCreated=true;record.added=record.added||todayStr();record.sharedWith=(record.sharedWith||[]).filter(function(id){return S.people.some(function(person){return person.id===id;});});record.areas=(record.areas||[]).filter(function(id){return id!=="faith";});
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
 var active=faithPrayerSession.ids.filter(function(id){return S.prayers.some(function(p){return p.id===id&&!p.answered&&!p.archived;});});
 faithPrayerSession.ids=active;
 faithPrayerSession.index=Math.max(0,Math.min(active.length,faithPrayerSession.index+delta));
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
  if(!t.checked&&faithSelectedGroup()===group){var next=faithPracticeGroups()[0];if(next)faithConfig().selectedGroup=next;}
  save();render();var restored=document.querySelector('[data-faith-enabled="'+group+'"]');if(restored)restored.focus();event.stopImmediatePropagation();return;
 }
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
 var t=event.target,button=t.closest&&t.closest("[data-dashboard-prayer-people-open]");
 if(button){dashboardPrayerPeopleOpen=true;render();var dialogTitle=document.querySelector("#dashboard-prayer-people-title");if(dialogTitle)dialogTitle.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 var personPrayerOpen=t.closest&&t.closest("[data-person-dashboard-prayer-open]");
 if(personPrayerOpen){personDashboardPrayerDialogOpen=personPrayerOpen.getAttribute("data-person-dashboard-prayer-open");render();var personDialogTitle=document.querySelector("#person-dashboard-prayer-title");if(personDialogTitle)personDialogTitle.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 var summary=t.closest&&t.closest(".faith-prayer-filter>summary");
 if(summary){faithPrayerPeopleOpen=!faithPrayerPeopleOpen;return;}
 var b=t.closest&&t.closest("button");if(!b)return;
 if(b.matches("[data-faith-view-select]")){faithSetMainView(b.getAttribute("data-faith-view-select"),true);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-settings]")){faithSettingsOpen=!faithSettingsOpen;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-settings-close]")){faithSettingsOpen=false;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-select]")){var selected=b.getAttribute("data-faith-select");faithMainView="practices";faithConfig().selectedGroup=selected;save();render();var navButton=document.querySelector('[data-faith-select="'+selected+'"]');if(navButton)navButton.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-today-expand]")){faithTodayExpanded=b.getAttribute("data-faith-today-expand")==="all";render();var todayExpand=document.querySelector("[data-faith-today-expand]");if(todayExpand)todayExpand.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-notes-expand]")){faithNotesExpanded=b.getAttribute("data-faith-notes-expand")==="all";render();var expandButton=document.querySelector("[data-faith-notes-expand]");if(expandButton)expandButton.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-expand]")){faithPrayerExpanded=b.getAttribute("data-faith-prayer-expand")==="all";render();var prayerExpandButton=document.querySelector("[data-faith-prayer-expand]");if(prayerExpandButton)prayerExpandButton.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-practice-tab]")){var parts=b.getAttribute("data-faith-practice-tab").split("|"),config=faithConfig(),tabs=config.practiceTabs||{};if(b.closest(".faith-health-card")){config.selectedGroup=parts[0];faithMainView="practices";}tabs[parts[0]]=parts[1];config.practiceTabs=tabs;save();render();var tabButton=document.querySelector('[data-faith-practice-tab="'+parts[0]+'|'+parts[1]+'"]');if(tabButton)tabButton.focus({preventScroll:true});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-requests]")){faithSetMainView("requests",false);var prayerRequests=document.getElementById("faith-prayer-requests");if(prayerRequests)prayerRequests.scrollIntoView({behavior:"smooth",block:"start"});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-view]")){var view=b.getAttribute("data-faith-prayer-view");if(["today","all"].indexOf(view)<0)return;faithConfig().prayerView=view;save();render();var viewButton=document.querySelector('[data-faith-prayer-view]');if(viewButton)viewButton.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-filter-action]")){var action=b.getAttribute("data-faith-prayer-filter-action");faithConfig().prayerPeople=action==="all"?null:[];faithConfig().prayerGroups={marriage:action==="all",parenting:action==="all",friendships:action==="all"};faithPrayerPeopleOpen=true;save();faithPrayerFilterRender("filter-action",action);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-today]")){faithMainView="requests";faithConfig().prayerView="today";save();render();var hub=document.getElementById("faith-prayer-requests");if(hub)hub.scrollIntoView({behavior:"smooth",block:"start"});event.stopImmediatePropagation();return;}
 if(b.matches("[data-prayer-time-option]")){var selectedPrayerTime=b.getAttribute("data-prayer-time-option"),personIdForTime=b.getAttribute("data-prayer-time-person"),validPrayerTime=selectedPrayerTime==="now"||selectedPrayerTime==="allday"||dayBlocks().some(function(block){return block.id===selectedPrayerTime;});if(personIdForTime){personDashboardPrayerTimeModes[personIdForTime]=validPrayerTime?selectedPrayerTime:"now";personDashboardPrayerDialogOpen=personIdForTime;}else{dashboardPrayerTimeMode=validPrayerTime?selectedPrayerTime:"now";}render();var prayerTimeDialogId=personIdForTime?"#person-dashboard-prayer-dialog":"#dashboard-prayer-people-dialog",prayerTimePicker=document.querySelector(prayerTimeDialogId+" .prayer-timeframe-picker__trigger");if(prayerTimePicker)prayerTimePicker.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-person-dashboard-prayer-close]")){var closedPersonId=b.getAttribute("data-person-dashboard-prayer-close");personDashboardPrayerDialogOpen=null;render();var personFilterTriggers=Array.from(document.querySelectorAll("[data-person-dashboard-prayer-open]")),personFilterTrigger=personFilterTriggers.find(function(trigger){return trigger.getAttribute("data-person-dashboard-prayer-open")===closedPersonId;});if(personFilterTrigger)personFilterTrigger.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-person-dashboard-prayer-start]")){var prayerPersonId=b.getAttribute("data-person-dashboard-prayer-start"),prayerPerson=S.people.find(function(person){return person.id===prayerPersonId;}),personTimeMode=personDashboardPrayerTimeModes[prayerPersonId]||"now",personTimeBlock=faithDashboardPrayerTimeBlock(personTimeMode);faithPrayerSession={view:"dashboard",all:false,people:[prayerPersonId],timeBlock:personTimeBlock,ids:faithDashboardPrayerSessionSort(personTimeBlock,[prayerPersonId]),index:0,source:"person",personId:prayerPersonId,personName:prayerPerson&&prayerPerson.name||"Person"};personDashboardPrayerDialogOpen=null;render();var personPrayerCard=document.querySelector("[data-faith-session-card]")||document.querySelector(".faith-prayer-session [data-faith-session-exit]");if(personPrayerCard)personPrayerCard.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-dashboard-prayer-people-close]")){dashboardPrayerPeopleOpen=false;render();var peopleTrigger=document.querySelector("[data-dashboard-prayer-people-open]");if(peopleTrigger)peopleTrigger.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-dashboard-prayer-group-toggle]")){var groupId=b.getAttribute("data-dashboard-prayer-group-toggle"),groupSelected=dashboardPrayerPeople===null?["me"].concat(S.people.map(function(person){return person.id;})):dashboardPrayerPeople.slice();tendApplyPeopleGroupToggle(groupSelected,"me",groupId);var allPeopleIds=["me"].concat(S.people.map(function(person){return person.id;}));dashboardPrayerPeople=groupSelected.length===allPeopleIds.length&&allPeopleIds.every(function(id){return groupSelected.indexOf(id)>=0;})?null:groupSelected;dashboardPrayerPeopleOpen=true;render();var groupToggle=document.querySelector('[data-dashboard-prayer-group-toggle="'+groupId+'"]');if(groupToggle)groupToggle.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-dashboard-prayer-people-action]")){dashboardPrayerPeople=b.getAttribute("data-dashboard-prayer-people-action")==="all"?null:[];dashboardPrayerPeopleOpen=true;render();var peopleAction=document.querySelector('[data-dashboard-prayer-people-action="'+b.getAttribute("data-dashboard-prayer-people-action")+'"]');if(peopleAction)peopleAction.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-dashboard-prayer-person-toggle]")){var personId=b.getAttribute("data-dashboard-prayer-person-toggle"),allIds=["me"].concat(S.people.map(function(person){return person.id;})),selectedIds=dashboardPrayerPeople===null?allIds.slice():dashboardPrayerPeople.slice(),selectedIndex=selectedIds.indexOf(personId);if(selectedIndex>=0)selectedIds.splice(selectedIndex,1);else selectedIds.push(personId);dashboardPrayerPeople=selectedIds.length===allIds.length&&allIds.every(function(id){return selectedIds.indexOf(id)>=0;})?null:selectedIds;dashboardPrayerPeopleOpen=true;render();requestAnimationFrame(function(){var personToggle=document.querySelector('[data-dashboard-prayer-person-toggle="'+personId+'"]');if(personToggle)personToggle.focus({preventScroll:true});});event.stopImmediatePropagation();return;}
 if(b.matches("[data-dashboard-prayer-start],[data-dashboard-prayer-people-pray]")){var timeBlock=faithDashboardPrayerTimeBlock(dashboardPrayerTimeMode),selectedPeople=dashboardPrayerPeople;faithPrayerSession={view:"dashboard",all:false,people:selectedPeople===null?null:selectedPeople.slice(),timeBlock:timeBlock,ids:faithDashboardPrayerSessionSort(timeBlock,selectedPeople),index:0,source:"dashboard"};dashboardPrayerPeopleOpen=false;render();var dashboardCard=document.querySelector("[data-faith-session-card]")||document.querySelector(".faith-prayer-session [data-faith-session-exit]");if(dashboardCard)dashboardCard.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-start]")){var sessionView=b.getAttribute("data-faith-session-start"),selectedPeople=faithConfig().prayerPeople,sessionIds=faithPrayerSessionSort(sessionView),previousSessionSource=faithPrayerSession&&faithPrayerSession.source;if(!sessionIds.length){event.stopImmediatePropagation();return;}faithPrayerSession={view:sessionView,all:sessionView==="all",people:Array.isArray(selectedPeople)?selectedPeople.slice():null,ids:sessionIds,index:0,source:b.closest(".faith-prayer-requests")?"faith-requests":previousSessionSource};render();var card=document.querySelector("[data-faith-session-card]");if(card)card.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-exit]")){var sessionSource=faithPrayerSession&&faithPrayerSession.source,sessionPersonId=faithPrayerSession&&faithPrayerSession.personId;faithPrayerSession=null;render();var navButton;if(sessionSource==="person"){navButton=Array.from(document.querySelectorAll("[data-person-dashboard-prayer-start]")).find(function(button){return button.getAttribute("data-person-dashboard-prayer-start")===sessionPersonId;});}else if(sessionSource==="faith-requests")navButton=document.querySelector(".faith-prayer-requests [data-faith-session-start]");else navButton=sessionSource==="dashboard"?document.querySelector("[data-dashboard-prayer-start]"):document.querySelector('[data-faith-select="'+faithSelectedGroup()+'"]');if(navButton)navButton.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-skip]")){faithPrayerSessionMove(1);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-back]")){faithPrayerSessionMove(-1);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-prayed]")){
  var prayer=S.prayers.find(function(p){return p.id===b.getAttribute("data-faith-session-prayed")&&!p.answered&&!p.archived;});
  if(prayer&&typeof recordPrayer==="function"){faithPrayerSessionMove(1);recordPrayer(prayer,!!prayer.personId);var nextCard=document.querySelector("[data-faith-session-card]");if(nextCard)nextCard.focus();}
  event.stopImmediatePropagation();return;
 }
 if(b.matches("[data-faith-rhythm-add]")){faithRhythmDraft={id:null,faithGroup:b.getAttribute("data-faith-rhythm-add"),category:"faith",text:"",description:"",freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks",start:todayStr(),sharedWith:[],areas:[]};render();var title=document.querySelector("[data-faith-title]");if(title)title.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-edit]")){var rhythm=faithFindRhythm(b.getAttribute("data-faith-rhythm-edit"));if(rhythm){faithRhythmDraft=JSON.parse(JSON.stringify(rhythm));if(!faithRhythmDraft.weekdays&&faithRhythmDraft.scheduleDow!=null)faithRhythmDraft.weekdays=[+faithRhythmDraft.scheduleDow];}render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-profile-edit]")){var sharedRhythm=faithFindRhythm(b.getAttribute("data-faith-rhythm-profile-edit"));if(sharedRhythm){currentPerson=null;currentArea="faith";tab="today";faithMainView="practices";faithMainViewInitialized=true;faithConfig().selectedGroup=sharedRhythm.faithGroup||"Other";faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs[faithConfig().selectedGroup]="rhythms";faithRhythmDraft=JSON.parse(JSON.stringify(sharedRhythm));render();}event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-save]")){faithSaveRhythm();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-cancel]")){faithRhythmDraft=null;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-delete]")){var id=b.getAttribute("data-faith-rhythm-delete");S.rhythms=S.rhythms.filter(function(r){return r.id!==id;});faithRhythmDraft=null;save();render();flash("Rhythm removed");event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-history]")){openRhythmHistory("faith|"+b.getAttribute("data-faith-rhythm-history"));event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-spark-add]")){faithSparkOwnerId="faith";delete tendItemAssociationDrafts[tendAssociationKey("spark","faith","new")];faithSparkDraft={id:null,text:"",details:"",by:"",time:"",tod:"anytime",category:"faith",area:"faith",faithSection:faithSelectedGroup(),sharedWith:[],areas:["faith"]};sparkAddDrafts.faith=faithSparkDraft;faithSparkEditId=null;render();var sparkTitle=document.querySelector("[data-faith-spark-title]");if(sparkTitle)sparkTitle.focus();event.stopImmediatePropagation();return;}
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
document.addEventListener("change",function(event){
 var t=event.target;
 if(!t.matches)return;
 if(t.matches&&t.matches("[data-faith-prayer-person]")){
  var personId=t.getAttribute("data-faith-prayer-person"),config=faithConfig();config.prayerPeople=Array.from(document.querySelectorAll("[data-faith-prayer-person]:checked")).map(function(input){return input.getAttribute("data-faith-prayer-person");});faithPrayerPeopleOpen=true;save();faithPrayerFilterRender("person",personId);event.stopImmediatePropagation();return;
 }
 if(t.matches&&t.matches("[data-faith-prayer-group]")){
  var config=faithConfig(),group=t.getAttribute("data-faith-prayer-group"),groups=Object.assign({marriage:true,parenting:true,friendships:true},config.prayerGroups||{}),selected=Array.isArray(config.prayerPeople)?config.prayerPeople.slice():["me"].concat(S.people.map(function(person){return person.id;})),members=S.people.filter(function(person){return faithPrayerPersonGroup(person)===group;}).map(function(person){return person.id;});
  groups[group]=t.checked;config.prayerGroups=groups;
  config.prayerPeople=t.checked?selected.concat(members.filter(function(id){return selected.indexOf(id)<0;})):selected.filter(function(id){return members.indexOf(id)<0;});
  faithPrayerPeopleOpen=true;save();faithPrayerFilterRender("group",group);event.stopImmediatePropagation();return;
 }
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
 else if(event.key==="Escape"){event.preventDefault();var escapedSessionSource=faithPrayerSession.source,escapedSessionPerson=faithPrayerSession.personId;faithPrayerSession=null;render();if(escapedSessionSource==="person"){var prayerStartButtons=Array.from(document.querySelectorAll("[data-person-dashboard-prayer-start]")),prayerStartButton=prayerStartButtons.find(function(button){return button.getAttribute("data-person-dashboard-prayer-start")===escapedSessionPerson;});if(prayerStartButton)prayerStartButton.focus();}else if(escapedSessionSource==="faith-requests"){var faithPrayerStart=document.querySelector(".faith-prayer-requests [data-faith-session-start]");if(faithPrayerStart)faithPrayerStart.focus();}}
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

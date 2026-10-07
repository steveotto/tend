"use strict";
/* ============ Faith practice page ============ */
var FAITH_GROUPS=["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
var faithRhythmDraft=null,faithSparkDraft=null,faithSparkEditId=null,faithSparkOwnerId="faith",faithNoteDraft=null,faithNoteEditId=null,faithPrayerDraftOpen=false,faithSettingsOpen=false,faithPrayerSession=null,faithPrayerPeopleOpen=false;
var faithGroupDescriptions={
 Sabbath:"A weekly invitation to pause, delight, and reconnect with God.",
 Prayer:"A place to hold your active requests and make room for focused prayer.",
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
 Prayer:["Bring today's requests before God, or set aside focused time to pray.","Conversational communion with God — speaking and listening."],
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
function faithPracticeTab(group){var tabs=faithConfig().practiceTabs||{},tab=tabs[group];return (group==="Prayer"?["rhythms","sparks","notes","prayer"]:["rhythms","sparks","notes"]).indexOf(tab)>=0?tab:(group==="Prayer"?"prayer":"rhythms");}
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
 return '<span class="rhythm-health faith-nav-score" aria-label="'+(Number.isFinite(score)?score+" percent":"No rhythm score")+'"><span class="sm-dot '+level+'" aria-hidden="true"></span><span>'+value+(Number.isFinite(score)?"%":"")+'</span></span>';
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
function faithPracticeMetersHTML(group){
 if(group!=="Prayer")return "";
 var parts=faithPracticeHealthParts(),rhythms=faithPracticeRhythmRecords(group),prayers=faithActivePrayers();
 function meter(label,score,note,tab){
  var value=Number.isFinite(score)?score:null,level=faithScoreClass(value);
  return '<button type="button" class="pmeter faith-practice-meter" data-faith-practice-tab="Prayer|'+tab+'" aria-label="Open '+label+' tab"><div class="pm-lab"><span>'+label+'</span><span class="pm-val '+level+'">'+faithScoreText(value)+'</span></div><div class="bar" role="meter" aria-label="'+label+' health" aria-valuemin="0" aria-valuemax="100"'+(value===null?' aria-valuetext="No score available"':' aria-valuenow="'+value+'" aria-valuetext="'+value+' out of 100"')+'><i class="'+level+'" style="width:'+(value===null?0:value)+'%"></i></div><div class="pm-note">'+note+'</div></button>';
 }
 return '<div class="pmeters faith-practice-meters">'+meter("Rhythms",parts.rhythms,rhythms.length+" rhythm"+(rhythms.length===1?"":"s"),"rhythms")+meter("Prayer",parts.prayers,prayers.length+" prayer"+(prayers.length===1?"":"s"),"prayer")+'</div>';
}
function faithTimeRank(tod){if(tod==="allday")return -1;var blocks=dayBlocks(),index=blocks.findIndex(function(block){return block.id===tod;});return index<0?blocks.length:index;}
function faithPracticeCount(group){return faithRhythms(group).length+(typeof window.faithLinkedRhythmCount==="function"?window.faithLinkedRhythmCount(group):0);}
function faithPracticeGroups(){return FAITH_GROUPS.filter(faithGroupEnabled);}
function faithTendAction(r){
 return '<button type="button" class="btn mini" data-tend-open="faith-rhythm" data-rhythm-id="'+esc(r.id)+'">Tend</button>';
}
function faithTodayRhythms(){
 return faithActiveRhythms().filter(function(r){return r.tod&&r.tod!=="anytime"&&rhythmScheduledToday(r);}).sort(function(a,b){
  return faithTimeRank(a.tod)-faithTimeRank(b.tod)||String(a.text||"").localeCompare(String(b.text||""));
 });
}
function faithTodayHTML(){
 var rhythms=faithTodayRhythms();
 var out=rhythms.length?rhythms.map(function(r){
  var time=dayBlocks().find(function(block){return block.id===r.tod;});
  return '<article class="faith-today-row"><div class="faith-today-copy"><strong>'+esc(r.text||"Faith rhythm")+'</strong><span>'+esc(r.faithGroup)+(time?" · "+esc(time.name):"")+' · '+esc(rhythmFreqLabel(r))+'</span></div>'+faithTendAction(r)+'</article>';
 }).join(""):'<p class="empty">No Faith rhythms scheduled for today.</p>';
 if(faithGroupEnabled("Prayer")){
  var prayerCount=faithTodayPrayerCount();
  out+='<button type="button" class="faith-prayer-invitation" data-faith-prayer-today="1"><span><strong>Prayer Time</strong><small>'+(prayerCount?prayerCount+" request"+(prayerCount===1?"":"s")+" scheduled today":"No prayer requests scheduled today")+'</small></span><span aria-hidden="true">›</span></button>';
 }
 return out;
}
function faithHealthHTML(){
 var rhythms=faithAllRhythmRecords(),prayers=faithActivePrayers(),rhythmScoreValue=avg(rhythms.map(function(r){return rhythmScore(r);})),prayerScoreValue=avg(prayers.map(function(p){return prayerScore(p);}));
 function meter(label,score,note){
  var value=Number.isFinite(score)?score:null,level=faithScoreClass(value);
  return '<div class="pmeter"><div class="pm-lab"><span>'+label+'</span><span class="pm-val '+level+'">'+faithScoreText(value)+'</span></div><div class="bar" role="meter" aria-label="Overall Faith '+label.toLowerCase()+' health" aria-valuemin="0" aria-valuemax="100"'+(value===null?' aria-valuetext="No score available"':' aria-valuenow="'+value+'" aria-valuetext="'+value+' out of 100"')+'><i class="'+level+'" style="width:'+(value===null?0:value)+'%"></i></div><div class="pm-note">'+note+'</div></div>';
 }
 return '<section class="card faith-health-card" aria-labelledby="faithHealthTitle"><div class="faith-health-head"><h2 id="faithHealthTitle">Overall Faith health</h2></div><div class="pmeters faith-overall-meters">'+meter("Rhythms",rhythmScoreValue,rhythms.length+" active rhythm"+(rhythms.length===1?"":"s"))+meter("Prayer",prayerScoreValue,prayers.length+" active prayer"+(prayers.length===1?"":"s"))+'</div></section>';
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
 var score=rhythmScore(r),className=faithScoreClass(score),meta=tendRhythmMetaLabel(r,null,true)+(rhythmDurLabel(r)?" · "+rhythmDurLabel(r):"");
 var categories=typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(r):"",people=typeof rhythmPeopleBadges==="function"?rhythmPeopleBadges(r,null):"",badges='<span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>'+people+categories;
 return '<div class="rhyrow faith-rhythm-row"><span class="rhythm-health" title="Rhythm health"><span class="sm-dot '+className+'" aria-hidden="true"></span><span>'+faithScoreText(score)+(Number.isFinite(score)?"%":"")+'</span></span><div class="gr-main">'+tendRowContent(r.text||"Untitled rhythm",r.description||"",meta,badges)+'</div>'+faithTendAction(r)+'<button type="button" class="iconbtn rhythm-history-trigger" data-faith-rhythm-history="'+esc(r.id)+'" aria-label="View history for '+esc(r.text)+'" title="History graph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button><button type="button" class="iconbtn" data-faith-rhythm-edit="'+esc(r.id)+'" aria-label="Edit '+esc(r.text)+'" title="Edit">✎</button></div>';
}
function faithRhythmsHTML(group){
 var rhythms=faithRhythms(group),linked=typeof window.faithLinkedRhythmRows==="function"?window.faithLinkedRhythmRows(group):"",out=rhythms.map(faithRhythmRowHTML).join("")+linked;
 if(!out)out='<div class="empty">No rhythms in this practice yet.</div>';
 if(faithRhythmDraft&&!faithRhythmDraft.id&&faithRhythmDraft.faithGroup===group)out+=faithRhythmEditorHTML(faithRhythmDraft);
 else if(!faithRhythmDraft)out+='<div class="faith-add-row"><button type="button" class="btn mini ghost" data-faith-rhythm-add="'+esc(group)+'">+ Add rhythm</button></div>';
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
function faithPrayerRows(items){
 return items.map(function(p){return '<div class="faith-prayer-row">'+prayerItemHTML(p,false)+'</div>';}).join("");
}
function faithPrayerTodayHTML(){
 var items=faithPrayerTimeGroups().filter(faithPrayerAllMatches);
 if(!items.length)return '<div class="empty">No active requests are scheduled for today.</div>';
 var buckets={};
 items.forEach(function(p){var key=p.tod||"anytime";(buckets[key]||(buckets[key]=[])).push(p);});
 var keys=Object.keys(buckets).sort(function(a,b){return faithTimeRank(a)-faithTimeRank(b);});
 return keys.map(function(key){var block=dayBlocks().find(function(item){return item.id===key;});var label=block?block.name:(key==="allday"?"All day":"Flexible");return '<section class="faith-prayer-time-group"><h3>'+esc(label)+'</h3>'+faithPrayerRows(buckets[key])+'</section>';}).join("");
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
function faithPrayerAllHTML(){
 var active=faithActivePrayers().filter(faithPrayerAllMatches).slice().sort(faithPrayerScoreOrder);
 var closed=S.prayers.filter(function(p){return (p.answered||p.archived)&&faithPrayerAllMatches(p);});
 var out=active.length?faithPrayerRows(active):'<div class="empty">No active prayer requests match these filters.</div>';
 if(closed.length)out+='<details class="faith-history-list"><summary>Answered and archived ('+closed.length+')</summary>'+faithPrayerRows(closed)+'</details>';
 return out;
}
function faithPrayerPeopleFilterHTML(){
 var people=S.people.slice().sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));});
 var config=faithConfig(),selectedPeople=Array.isArray(config.prayerPeople)?config.prayerPeople:null,groups=Object.assign({marriage:true,parenting:true,friendships:true},config.prayerGroups||{});
 var selectedCount=selectedPeople?selectedPeople.length:people.length+1;
 return '<details class="faith-prayer-filter"'+(faithPrayerPeopleOpen?" open":"")+'><summary><span>People</span><span class="faith-prayer-filter-count">'+selectedCount+' selected</span></summary><div class="faith-prayer-filter-panel"><div class="faith-prayer-filter-actions"><button type="button" data-faith-prayer-filter-action="all">Show all</button><button type="button" data-faith-prayer-filter-action="clear">Clear all</button></div><label class="faith-prayer-person-option faith-prayer-me-option"><input type="checkbox" data-faith-prayer-person="me"'+(!selectedPeople||selectedPeople.indexOf("me")>=0?' checked':'')+'>'+(settings().profilePhoto?personAvatar({name:"Me",photo:settings().profilePhoto},24):'<span class="faith-prayer-me-avatar">Me</span>')+'<span>Me</span></label><div class="faith-prayer-filter-groups">'+["marriage","parenting","friendships"].map(function(group){var labels={marriage:"Marriage",parenting:"Parenting",friendships:"Friendships"};return '<label><input type="checkbox" data-faith-prayer-group="'+group+'"'+(groups[group]?' checked':'')+'><span>'+labels[group]+'</span></label>';}).join("")+'</div><div class="faith-prayer-filter-people">'+people.map(function(person){var checked=!selectedPeople||selectedPeople.indexOf(person.id)>=0;return '<label class="faith-prayer-person-option"><input type="checkbox" data-faith-prayer-person="'+esc(person.id)+'"'+(checked?' checked':'')+'>'+personAvatar(person,24)+'<span>'+esc(person.name)+'</span></label>';}).join("")+'</div></div></details>';
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
 var items=faithActivePrayers().filter(function(p){return (view!=="today"||faithPrayerScheduledToday(p))&&faithPrayerAllMatches(p);});
 return items.sort(faithPrayerScoreOrder).map(function(p){return p.id;});
}
function faithPrayerSessionCriteriaHTML(){
 var selected=faithPrayerSession.people;
 if(selected===undefined)selected=faithConfig().prayerPeople;
 var people=selected===null?null:(selected||[]).map(function(id){return id==="me"?"Me":(S.people.find(function(person){return person.id===id;})||{}).name;}).filter(Boolean);
 var labels=people===null?["Everyone"]:people.length?people:["No people selected"];
 labels.push(faithPrayerSession.view==="today"?"Today":"All prayers");
 return '<div class="faith-session-criteria" aria-label="Prayer session criteria">'+labels.map(function(label){return '<span>'+esc(label)+'</span>';}).join("")+'</div>';
}
function faithPrayerSessionHTML(){
 var ids=faithPrayerSession?faithPrayerSession.ids:[],items=ids.map(function(id){return S.prayers.find(function(p){return p.id===id&&!p.answered&&!p.archived;});}).filter(Boolean);
 if(!faithPrayerSession)return "";
 if(!items.length)return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><span class="faith-eyebrow" id="faithSessionTitle">Faith · Prayer time</span>'+faithPrayerSessionCriteriaHTML()+'</header><section class="card faith-session-empty"><h1>No requests in this session</h1><p>'+(faithPrayerSession.view==="today"?"There are no active requests scheduled for today.":"There are no active prayer requests matching these filters.")+'</p><div class="faith-item-actions">'+(faithPrayerSession.view!=="today"&&faithActivePrayers().some(function(p){return faithPrayerScheduledToday(p)&&faithPrayerAllMatches(p);})?'<button type="button" class="btn" data-faith-session-start="today">Focused Prayer · Today</button>':"")+'<button type="button" class="btn" data-faith-session-exit="1">Finish</button></div></section></dialog>';
 if(faithPrayerSession.index>=items.length)return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><span class="faith-eyebrow">Faith · Prayer time</span>'+faithPrayerSessionCriteriaHTML()+'</header><section class="card faith-session-empty"><div class="faith-session-progress">'+items.length+' of '+items.length+'</div><h1 id="faithSessionTitle">Prayer time complete</h1><p>You made space for each request in this session.</p><div class="faith-item-actions"><button type="button" class="btn ghost" data-faith-session-back="1">Back</button><button type="button" class="btn" data-faith-session-exit="1">Finish</button></div></section></dialog>';
 var p=items[faithPrayerSession.index];
 return '<dialog class="faith-page faith-prayer-session" data-editor-modal aria-labelledby="faithSessionTitle"><header class="faith-session-heading"><div><span class="faith-eyebrow">Faith · Prayer time</span><h1 id="faithSessionTitle">One request at a time</h1></div>'+faithPrayerSessionCriteriaHTML()+'</header><div class="faith-session-progress" aria-live="polite">'+(faithPrayerSession.index+1)+' of '+items.length+'</div><div class="faith-session-track" aria-hidden="true"><span style="width:'+Math.round((faithPrayerSession.index+1)/items.length*100)+'%"></span></div><article class="card faith-session-card" data-faith-session-card tabindex="-1"><div class="faith-session-person">'+faithPrayerIdentity(p)+'</div><h2>'+esc(p.text||"Prayer request")+'</h2><p>'+(p.details?esc(p.details):"")+'</p><div class="faith-session-meta">'+esc(prayerScheduleLabel(p))+' · prayed '+(p.prayed||0)+' '+((p.prayed||0)===1?"time":"times")+'</div></article><nav class="faith-session-actions" aria-label="Prayer time actions"><button type="button" class="btn ghost" data-faith-session-back="1"'+(faithPrayerSession.index===0?' disabled':'')+'>Back</button><button type="button" class="btn ghost" data-faith-session-skip="1">Skip</button><button type="button" class="btn faith-session-prayed" data-faith-session-prayed="'+esc(p.id)+'">Prayed</button><button type="button" class="btn ghost faith-session-finish" data-faith-session-exit="1">Finish</button></nav><p class="faith-session-help">Use ← / → to move between requests. Moving never records a prayer.</p></dialog>';
}
function faithPrayerHub(){
 var view=faithSelectedPrayerView(),nextView=view==="today"?"all":"today",content=view==="today"?faithPrayerTodayHTML():faithPrayerAllHTML(),buttonLabel=view==="today"?"Today":"All";
 return '<div class="faith-prayer-hub" id="faith-prayer-hub"><div class="faith-prayer-toolbar"><button type="button" class="faith-prayer-view-toggle" data-faith-prayer-view="'+nextView+'" aria-pressed="'+(view==="all")+'" aria-label="Switch to '+(nextView==="today"?"Today":"All")+' prayers">'+buttonLabel+' <span aria-hidden="true">↔</span></button>'+faithPrayerPeopleFilterHTML()+'<button type="button" class="btn mini" data-faith-session-start="'+view+'">Focused Prayer</button></div><div class="faith-prayer-content">'+content+(!faithPrayerDraftOpen?'<div class="faith-add-row"><button type="button" class="btn mini ghost" data-faith-prayer-add="1">+ Add Prayer</button></div>':'')+'</div>'+faithPrayerAddDialogHTML()+'</div>';
}
function faithPracticeContent(group){
 var description=faithConfig().groupDescriptions[group]||"";
 var tabs=group==="Prayer"?["rhythms","sparks","notes","prayer"]:["rhythms","sparks","notes"],labels={rhythms:"Rhythms",sparks:"Sparks",notes:"Notes",prayer:"Prayer"},selected=faithPracticeTab(group);
 function count(tab){
  if(tab==="rhythms")return faithRhythms(group).length+(typeof window.faithLinkedRhythmCount==="function"?window.faithLinkedRhythmCount(group):0);
  if(tab==="sparks")return faithSparkRecords().filter(function(item){return !item.done&&(item.faithSection||item.faithGroup||(item.profileOwnerId!=="faith"?"Prayer":"Other"))===group;}).length;
  if(tab==="notes")return S.followups.filter(function(item){return item.kind==="faith-note"&&!item.done&&(item.faithSection||"Other")===group;}).length;
  return faithActivePrayers().length;
 }
 var content=selected==="rhythms"?faithRhythmsHTML(group):selected==="sparks"?faithSparksHTML(group):selected==="notes"?faithNotesHTML(group):faithPrayerHub();
 return '<section class="card faith-practice-card" id="faith-practice-panel" aria-labelledby="faithPracticeTitle"><header class="faith-practice-heading"><h2 id="faithPracticeTitle">'+esc(group)+'</h2>'+(description?'<div class="faith-practice-focus"><span class="faith-practice-focus-label">Practice focus</span><p>'+esc(description)+'</p></div>':"")+'</header>'+faithPracticeMetersHTML(group)+'<nav class="profile-tabs faith-practice-tabs" aria-label="'+esc(group)+' sections">'+tabs.map(function(tab){return '<button type="button" data-faith-practice-tab="'+esc(group)+'|'+tab+'" aria-selected="'+(tab===selected)+'">'+collectionIcon(tab)+labels[tab]+' <span class="tab-count">'+count(tab)+'</span></button>';}).join("")+'</nav><div class="faith-tab-content">'+content+'</div></section>';
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
 var out=items.length?items.map(function(item){
  var ownerId=item.profileOwnerId||"faith";
  if(faithSparkEditId===item.id&&faithSparkOwnerId===ownerId)return faithSparkEditorHTML(item);
  var sparkBadges=tendAssociationPeopleBadges(item,ownerId,null,"spark")+tendAssociationCategoryBadges(item);
  return '<article class="faith-item-row faith-spark-row"><span class="faith-spark-icon" aria-hidden="true">✦</span><div class="faith-item-copy">'+tendRowContent(item.text||"Untitled Spark",item.details||"",(item.by?esc(sparkDueTxt(item)):"Flexible · no date")+(item.time?" · "+esc(fmtHM12(item.time)):""),sparkBadges)+'</div><div class="faith-item-actions"><button type="button" class="btn mini" data-faith-sparkdone="'+esc(ownerId+"|"+item.id)+'">Complete</button><button type="button" class="iconbtn" data-faith-spark-edit="'+esc(ownerId+"|"+item.id)+'" aria-label="Edit '+esc(item.text)+'">✎</button><button type="button" class="iconbtn" data-faith-spark-delete="'+esc(ownerId+"|"+item.id)+'" aria-label="Delete '+esc(item.text)+'">×</button></div></article>';
 }).join(""):'<div class="empty">No Sparks in this practice yet.</div>';
 if(faithSparkDraft&&!faithSparkEditId&&(faithSparkDraft.faithSection||"Other")===group)out+=faithSparkEditorHTML(faithSparkDraft);
 else if(!faithSparkDraft)out+='<div class="faith-add-row"><button type="button" class="btn mini ghost" data-faith-spark-add="1">+ Add Spark</button></div>';
 var history=faithSparkRecords().filter(function(item){return item.done&&(item.faithSection||item.faithGroup||(item.profileOwnerId!=="faith"?"Prayer":"Other"))===group;}).sort(function(a,b){return (b.completedTs||0)-(a.completedTs||0);});
 if(history.length)out+='<details class="faith-history-list"><summary>Completed Sparks ('+history.length+')</summary>'+history.map(function(item){return '<div class="faith-history-row"><span>'+esc(item.text)+'</span><time>'+(item.completedDate?esc(prayerDate(item.completedDate)):"Completed")+'</time><button type="button" class="btn mini ghost" data-faith-spark-reopen="'+esc(item.profileOwnerId+"|"+item.id)+'">Reopen</button></div>';}).join("")+'</details>';
 return out;
}
function faithNoteRowHTML(item,done){
 if(faithNoteEditId===item.id)return '<li class="faith-note-edit"><dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="faith-note-editor-title"><div class="profile-editor-body"><h3 id="faith-note-editor-title">Edit Note</h3><label class="profile-note-type">Title<input aria-label="Edit Faith note title" data-faith-note-edit-text value="'+esc(item.text||"")+'"></label><label class="profile-note-type">Details<textarea aria-label="Edit Faith note details" data-faith-note-edit-details placeholder="Add details (optional)">'+esc(item.details||"")+'</textarea></label>'+tendAssociationControlsHTML("followup","faith",item.id,item)+'<div class="profile-editor-actions"><button type="button" class="btn mini" data-faith-note-save="'+esc(item.id)+'">Save Note</button><button type="button" class="btn mini ghost" data-faith-note-cancel="1" data-editor-cancel>Cancel</button><button type="button" class="btn mini danger" data-faith-note-delete="'+esc(item.id)+'">Delete Note</button></div></div></dialog></li>';
 var badges=tendAssociationPeopleBadges(item,"faith",null,"notes")+tendAssociationCategoryBadges(item);
 return '<li'+(done?' class="done"':"")+'>'+(done?'':'<input type="checkbox" class="cb" aria-label="Complete: '+esc(item.text)+'" data-faith-note-done="'+esc(item.id)+'">')+tendRowContent(item.text||"",item.details||"","",badges)+'<button type="button" class="iconbtn" data-faith-note-edit="'+esc(item.id)+'" aria-label="Edit Faith note">✎</button>'+(done?'<button type="button" class="btn mini ghost" data-faith-note-reopen="'+esc(item.id)+'">Reopen</button>':'')+'<button type="button" class="iconbtn" data-faith-note-delete="'+esc(item.id)+'" aria-label="Delete Faith note">×</button></li>';
}
function faithNotesHTML(group){
 group=group||faithSelectedGroup();
 var notes=S.followups.filter(function(item){return item.kind==="faith-note"&&(item.faithSection||"Other")===group;}),active=notes.filter(function(item){return !item.done;}),done=notes.filter(function(item){return item.done;});
 var out=active.length?'<ul class="faith-notes-list">'+active.map(function(item){return faithNoteRowHTML(item,false);}).join("")+'</ul>':'<div class="empty">No notes in this practice yet.</div>';
 if(faithNoteDraft&&faithNoteDraft.faithSection===group)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="faith-note-add-title"><div class="profile-editor-body faith-item-editor"><h3 id="faith-note-add-title">Add Note</h3><label class="profile-note-type">Title<input data-faith-note-text placeholder="A short title" value="'+esc(faithNoteDraft.text||"")+'"></label><label class="profile-note-type">Details<textarea data-faith-note-details placeholder="A reflection or something to remember">'+esc(faithNoteDraft.details||"")+'</textarea></label>'+tendAssociationControlsHTML("followup","faith","new",faithNoteDraft)+'<div class="faith-item-actions"><button type="button" class="btn mini" data-faith-note-add="1">Save Note</button><button type="button" class="btn mini ghost" data-faith-note-cancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';
 else if(!faithNoteDraft)out+='<div class="faith-add-row"><button type="button" class="btn mini ghost" data-faith-note-open="'+esc(group)+'">+ Add Note</button></div>';
 if(done.length)out+='<details class="faith-history-list"><summary>Completed Notes ('+done.length+')</summary><ul class="faith-notes-list">'+done.map(function(item){return faithNoteRowHTML(item,true);}).join("")+'</ul></details>';
 return out;
}
function renderFaithPage(){
 faithMigrateData();
 if(faithPrayerSession)return faithPrayerSessionHTML();
 var enabled=faithPracticeGroups(),selected=faithSelectedGroup(),config=faithConfig();
 if(enabled.length&&enabled.indexOf(selected)<0){selected=enabled[0];config.selectedGroup=selected;}
 var out='<main class="faith-page"><header class="sectiontitle faith-page-heading"><h2>Faith</h2><span class="hint">Small practices, tended over time.</span><button type="button" class="btn ghost faith-sections-toggle" data-faith-settings="1" aria-expanded="'+faithSettingsOpen+'" aria-controls="faith-sections-settings">⚙ Sections</button></header>';
 out+=faithSettingsHTML()+faithHealthHTML()+'<section class="card faith-today-card" aria-labelledby="faithTodayTitle"><h2 id="faithTodayTitle">Today in Faith</h2><div class="faith-today-list">'+faithTodayHTML()+'</div></section>';
 out+='<section class="faith-browser" aria-label="Faith practice navigation"><div class="faith-section-nav-wrap">'+faithSectionNavHTML(selected)+'</div><div class="faith-practice-wrap">'+(enabled.length?faithPracticeContent(selected):'<section class="card faith-practice-card"><p>Turn on a section in Sections settings to manage Faith practices.</p></section>')+'</div></section>';
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
 else{record=Object.assign({id:uid(),done:false},draft);if(ownerId==="faith")S.ideas.push(record);else{var newSparkOwner=S.people.find(function(person){return person.id===ownerId;});if(newSparkOwner){newSparkOwner.sparks=newSparkOwner.sparks||[];newSparkOwner.sparks.push(record);}}}
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
 if(t.matches&&t.matches("[data-faith-note-text]")&&faithNoteDraft)faithNoteDraft.text=t.value;
 if(t.matches&&t.matches("[data-faith-note-edit-text]"))faithNoteEditText=t.value;
},true);
var faithNoteEditText="";
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
 var t=event.target,summary=t.closest&&t.closest(".faith-prayer-filter>summary");
 if(summary){faithPrayerPeopleOpen=!faithPrayerPeopleOpen;return;}
 var b=t.closest&&t.closest("button");if(!b)return;
 if(b.matches("[data-faith-settings]")){faithSettingsOpen=!faithSettingsOpen;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-settings-close]")){faithSettingsOpen=false;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-select]")){var selected=b.getAttribute("data-faith-select");faithConfig().selectedGroup=selected;save();render();var navButton=document.querySelector('[data-faith-select="'+selected+'"]');if(navButton)navButton.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-practice-tab]")){var parts=b.getAttribute("data-faith-practice-tab").split("|"),tabs=faithConfig().practiceTabs||{};tabs[parts[0]]=parts[1];faithConfig().practiceTabs=tabs;save();render();var tabButton=document.querySelector('[data-faith-practice-tab="'+parts[0]+'|'+parts[1]+'"]');if(tabButton)tabButton.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-view]")){var view=b.getAttribute("data-faith-prayer-view");if(["today","all"].indexOf(view)<0)return;faithConfig().prayerView=view;save();render();var viewButton=document.querySelector('[data-faith-prayer-view]');if(viewButton)viewButton.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-filter-action]")){var action=b.getAttribute("data-faith-prayer-filter-action");faithConfig().prayerPeople=action==="all"?null:[];faithConfig().prayerGroups={marriage:action==="all",parenting:action==="all",friendships:action==="all"};faithPrayerPeopleOpen=true;save();faithPrayerFilterRender("filter-action",action);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-today]")){faithConfig().selectedGroup="Prayer";faithConfig().prayerView="today";faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs.Prayer="prayer";save();render();var hub=document.getElementById("faith-prayer-hub");if(hub)hub.scrollIntoView({behavior:"smooth",block:"start"});event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-start]")){var sessionView=b.getAttribute("data-faith-session-start"),selectedPeople=faithConfig().prayerPeople;faithPrayerSession={view:sessionView,all:sessionView==="all",people:Array.isArray(selectedPeople)?selectedPeople.slice():null,ids:faithPrayerSessionSort(sessionView),index:0};render();var card=document.querySelector("[data-faith-session-card]");if(card)card.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-exit]")){faithPrayerSession=null;render();var navButton=document.querySelector('[data-faith-select="'+faithSelectedGroup()+'"]');if(navButton)navButton.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-skip]")){faithPrayerSessionMove(1);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-back]")){faithPrayerSessionMove(-1);event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-session-prayed]")){
  var prayer=S.prayers.find(function(p){return p.id===b.getAttribute("data-faith-session-prayed")&&!p.answered&&!p.archived;});
  if(prayer&&typeof recordPrayer==="function"){faithPrayerSessionMove(1);recordPrayer(prayer,!!prayer.personId);var nextCard=document.querySelector("[data-faith-session-card]");if(nextCard)nextCard.focus();}
  event.stopImmediatePropagation();return;
 }
 if(b.matches("[data-faith-rhythm-add]")){faithRhythmDraft={id:null,faithGroup:b.getAttribute("data-faith-rhythm-add"),category:"faith",text:"",description:"",freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks",start:todayStr(),sharedWith:[],areas:[]};render();var title=document.querySelector("[data-faith-title]");if(title)title.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-edit]")){var rhythm=faithFindRhythm(b.getAttribute("data-faith-rhythm-edit"));if(rhythm){faithRhythmDraft=JSON.parse(JSON.stringify(rhythm));if(!faithRhythmDraft.weekdays&&faithRhythmDraft.scheduleDow!=null)faithRhythmDraft.weekdays=[+faithRhythmDraft.scheduleDow];}render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-rhythm-profile-edit]")){var sharedRhythm=faithFindRhythm(b.getAttribute("data-faith-rhythm-profile-edit"));if(sharedRhythm){currentPerson=null;currentArea="faith";tab="today";faithConfig().selectedGroup=sharedRhythm.faithGroup||"Other";faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs[faithConfig().selectedGroup]="rhythms";faithRhythmDraft=JSON.parse(JSON.stringify(sharedRhythm));render();}event.stopImmediatePropagation();return;}
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
 if(b.matches("[data-faith-prayer-add]")){delete prayerAddDrafts.global;delete tendItemAssociationDrafts[tendAssociationKey("prayer","global","new")];faithConfig().selectedGroup="Prayer";faithConfig().prayerView="all";faithConfig().prayerPeople=null;faithConfig().prayerGroups={marriage:true,parenting:true,friendships:true};faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs.Prayer="prayer";faithPrayerDraftOpen=true;render();var title=document.querySelector('[data-prayer-editor="new-global"] [data-prayer-field="title"]');if(title)title.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-cancel]")){delete prayerAddDrafts.global;delete tendItemAssociationDrafts[tendAssociationKey("prayer","global","new")];faithPrayerDraftOpen=false;render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-prayer-save]")){if(faithSavePrayer(b)){faithPrayerDraftOpen=false;render();}event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-open]")){faithNoteDraft={kind:"faith-note",text:"",faithSection:b.getAttribute("data-faith-note-open")||faithSelectedGroup(),sharedWith:[],areas:["faith"]};render();var note=document.querySelector("[data-faith-note-text]");if(note)note.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-add]")){var noteText=document.querySelector("[data-faith-note-text]"),noteDetails=document.querySelector("[data-faith-note-details]");if(noteText&&noteText.value.trim()){var addedNote={id:uid(),personId:null,kind:"faith-note",text:noteText.value.trim(),details:noteDetails?noteDetails.value.trim():"",faithSection:faithNoteDraft&&faithNoteDraft.faithSection||faithSelectedGroup(),done:false};tendAssociationCommit("followup","faith","new",addedNote);S.followups.push(addedNote);faithNoteDraft=null;save();render();flash("Note added");}else if(noteText){flash("Add a title first");noteText.focus();}event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-cancel]")){if(faithNoteDraft)delete tendItemAssociationDrafts[tendAssociationKey("followup","faith","new")];if(faithNoteEditId)delete tendItemAssociationDrafts[tendAssociationKey("followup","faith",faithNoteEditId)];faithNoteDraft=null;faithNoteEditId=null;faithNoteEditText="";render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-edit]")){faithNoteEditId=b.getAttribute("data-faith-note-edit");var note=S.followups.find(function(item){return item.id===faithNoteEditId;});faithNoteEditText=note?note.text:"";render();var edit=document.querySelector("[data-faith-note-edit-text]");if(edit)edit.focus();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-save]")){var note=S.followups.find(function(item){return item.id===b.getAttribute("data-faith-note-save");}),editDetails=document.querySelector("[data-faith-note-edit-details]");if(note&&faithNoteEditText.trim()){note.text=faithNoteEditText.trim();note.details=editDetails?editDetails.value.trim():note.details;tendAssociationCommit("followup","faith",note.id,note);faithNoteEditId=null;faithNoteEditText="";save();render();}else if(note)flash("Add a title first");event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-delete]")){var deletedFaithNote=b.getAttribute("data-faith-note-delete");S.followups=S.followups.filter(function(item){return item.id!==deletedFaithNote;});delete tendItemAssociationDrafts[tendAssociationKey("followup","faith",deletedFaithNote)];faithNoteEditId=null;save();render();event.stopImmediatePropagation();return;}
 if(b.matches("[data-faith-note-reopen]")){var note=S.followups.find(function(item){return item.id===b.getAttribute("data-faith-note-reopen");});if(note){note.done=false;note.completedDate=null;save();render();}event.stopImmediatePropagation();return;}
},true);
document.addEventListener("change",function(event){
 var t=event.target;if(!t.matches)return;
 if(t.matches&&t.matches("[data-faith-prayer-person]")){
  var personId=t.getAttribute("data-faith-prayer-person"),config=faithConfig();config.prayerPeople=Array.from(document.querySelectorAll("[data-faith-prayer-person]:checked")).map(function(input){return input.getAttribute("data-faith-prayer-person");});faithPrayerPeopleOpen=true;save();faithPrayerFilterRender("person",personId);event.stopImmediatePropagation();return;
 }
 if(t.matches&&t.matches("[data-faith-prayer-group]")){
  var config=faithConfig(),group=t.getAttribute("data-faith-prayer-group"),groups=Object.assign({marriage:true,parenting:true,friendships:true},config.prayerGroups||{}),selected=Array.isArray(config.prayerPeople)?config.prayerPeople.slice():["me"].concat(S.people.map(function(person){return person.id;})),members=S.people.filter(function(person){return faithPrayerPersonGroup(person)===group;}).map(function(person){return person.id;});
  groups[group]=t.checked;config.prayerGroups=groups;
  config.prayerPeople=t.checked?selected.concat(members.filter(function(id){return selected.indexOf(id)<0;})):selected.filter(function(id){return members.indexOf(id)<0;});
  faithPrayerPeopleOpen=true;save();faithPrayerFilterRender("group",group);event.stopImmediatePropagation();return;
 }
 if(!t.matches("[data-faith-note-done]"))return;
 var note=S.followups.find(function(item){return item.id===t.getAttribute("data-faith-note-done");});
 if(note){note.done=t.checked;note.completedDate=note.done?todayStr():null;save();render();}
 event.stopImmediatePropagation();
},true);
document.addEventListener("keydown",function(event){
 if(!faithPrayerSession||event.altKey||event.ctrlKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
 if(event.key==="ArrowRight"){event.preventDefault();faithPrayerSessionMove(1);}
 else if(event.key==="ArrowLeft"){event.preventDefault();faithPrayerSessionMove(-1);}
 else if(event.key==="Escape"){event.preventDefault();faithPrayerSession=null;render();}
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

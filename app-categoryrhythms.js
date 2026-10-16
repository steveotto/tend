"use strict";
/* Category links for person rhythms and rhythms owned by an area. */
(function(){
 var CATEGORY_AREAS=["faith","marriage","parenting","health","finances","friendships"];
 var CATEGORY_AREA_LABELS={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var FAITH_SUBCATEGORIES=typeof FAITH_GROUPS!=="undefined"?FAITH_GROUPS.slice():["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
 var CATEGORY_AREA_SET=CATEGORY_AREAS.reduce(function(out,id){out[id]=true;return out;},{});
 var MARRIAGE_RHYTHM_TEMPLATES=[
  {id:"marriage.date-night",title:"Date Night",freq:"weekly",tod:"evening",description:"Enjoy intentional time together beyond responsibilities and logistics."},
  {id:"marriage.marriage-check-in",title:"Marriage Check-In",freq:"weekly",tod:"anytime",description:"Share appreciation, listen to concerns, and choose one supportive next step."},
  {id:"marriage.pray-together",title:"Pray Together",freq:"daily",tod:"anytime",description:"Bring gratitude and needs before God together."},
  {id:"marriage.unhurried-conversation",title:"Unhurried Conversation",freq:"daily",tod:"anytime",description:"Put distractions aside and listen to each other."},
  {id:"marriage.dream-together",title:"Dream Together",freq:"quarterly",tod:"anytime",description:"Talk about hopes, plans, and the next season of life."},
  {id:"marriage.overnight-away",title:"Overnight Away",freq:"quarterly",tod:"anytime",description:"Protect time away from the normal routine to reconnect."},
  {id:"marriage.counseling-check-in",title:"Marriage Counseling Check-In",freq:"yearly",tod:"anytime",description:"Review growth and address concerns proactively with a counselor. Book ahead; complete this rhythm when attending, not when scheduling."},
  {id:"marriage.week-away-together",title:"Week Away Together",freq:"yearly",tod:"anytime",description:"Protect extended time together for rest, enjoyment, and connection."}
 ];
 var marriageSuggestionsOpen=false,marriageLinkTemplateId=null,marriageLinkCandidateId=null;
 var baseEnsureShape=window.ensureShape;
 window.ensureShape=function(state){
  var shaped=baseEnsureShape(state);
  if(!Array.isArray(shaped.areaRhythms))shaped.areaRhythms=[];
  if(!shaped.marriageRhythmTemplateLinks||typeof shaped.marriageRhythmTemplateLinks!=="object"||Array.isArray(shaped.marriageRhythmTemplateLinks))shaped.marriageRhythmTemplateLinks={};
  MARRIAGE_RHYTHM_TEMPLATES.forEach(function(template){
   if(shaped.marriageRhythmTemplateLinks[template.id])return;
   var linked=null;
   (shaped.areaRhythms||[]).some(function(record){if(record.sourceTemplateId===template.id){linked=record.id;return true;}return false;});
   if(!linked)(shaped.people||[]).some(function(person){return(person.rhythms||[]).some(function(record){if(record.sourceTemplateId===template.id){linked=record.id;return true;}return false;});});
   if(linked)shaped.marriageRhythmTemplateLinks[template.id]=linked;
  });
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
  if(id==="faith"||id==="health"||!CATEGORY_AREA_SET[id])return baseAreaScore(id);
  var rhythms=categoryRhythms(id),rhythmAverage=avg(rhythms.map(function(item){return rhythmScore(item.record);}));
  if(rhythmAverage!==null)return rhythmAverage;
  return rawScore(eventsFor(id));
 };
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
  var spouses=(S.people||[]).filter(function(person){return /^(spouse|wife|husband|partner)$/i.test(String(person.relation||"").trim());});
  return {id:"draft",text:template.title,description:template.description,sourceTemplateId:template.id,areas:["marriage"],freq:template.freq,tod:template.tod,weekdays:[],monthlyMode:"onDay",dayOfMonth:null,month:null,monthDay:null,qmonth:null,added:null,start:null,personId:spouses.length===1?spouses[0].id:"",sharedWith:[]};
 }
 function marriageLinkExistingRhythm(templateId,rhythmId,showInMarriage){
  var template=marriageTemplateById(templateId),linked=marriageRhythmById(rhythmId);
  if(!template||!linked||linked.record.fitnessType||linked.record.type==="workout"||linked.record.type==="cardio"||linked.record.type==="weighin")return false;
  var currentStatus=marriageTemplateStatus(templateId);
  if(currentStatus&&currentStatus.record)return false;
  var otherTemplate=MARRIAGE_RHYTHM_TEMPLATES.find(function(item){return item.id!==templateId&&S.marriageRhythmTemplateLinks[item.id]===rhythmId;});
  if(otherTemplate||(linked.record.sourceTemplateId&&linked.record.sourceTemplateId!==templateId))return false;
  linked.record.sourceTemplateId=templateId;
  if(showInMarriage&&areaIds(linked.record).indexOf("marriage")===-1){var areas=Array.isArray(linked.record.areas)?linked.record.areas.slice():[];if(areas.indexOf("marriage")===-1)areas.push("marriage");linked.record.areas=areas;}
  S.marriageRhythmTemplateLinks[templateId]=rhythmId;
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
  function add(record,person){
   if(!record||!record.id||record.fitnessType||["workout","cardio","weighin"].indexOf(record.type)!==-1||record.sourceTemplateId||used[record.id])return;
   if(Object.keys(S.marriageRhythmTemplateLinks).some(function(id){return S.marriageRhythmTemplateLinks[id]===record.id;}))return;
   used[record.id]=true;candidates.push({record:record,person:person||null});
  }
  (S.areaRhythms||[]).forEach(function(record){add(record,null);});
  (S.people||[]).forEach(function(person){(person.rhythms||[]).forEach(function(record){add(record,person);});});
  return candidates.sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));});
 }
 function marriageRhythmSummary(record){
  var labels=areaIds(record).map(function(id){return categoryLabel(id,record);});
  return [typeof window.rhythmFreqLabel==="function"?window.rhythmFreqLabel(record):record.freq||"Frequency not set",record.tod&&record.tod!=="anytime"&&TODS&&TODS[record.tod]?TODS[record.tod]:null,labels.length?labels.join(", "):"No category"].filter(Boolean).join(" · ");
 }
 function marriageSuggestionsDialog(){
  if(!marriageSuggestionsOpen||currentArea!=="marriage")return "";
  var candidates=marriageLinkCandidates(),candidate=marriageLinkCandidateId&&marriageRhythmById(marriageLinkCandidateId),candidateTemplate=marriageLinkTemplateId&&marriageTemplateById(marriageLinkTemplateId),out='<dialog class="profile-editor-dialog marriage-rhythm-suggestions-dialog" data-editor-modal aria-labelledby="marriage-rhythm-suggestions-title"><div class="profile-editor-body"><header class="marriage-suggestions-header"><div><h2 id="marriage-rhythm-suggestions-title" tabindex="-1">Marriage rhythm suggestions</h2><p>Customize a suggestion or link an existing rhythm. Nothing is added until you save.</p></div><button type="button" class="iconbtn" data-marriage-suggestions-close data-editor-cancel aria-label="Close suggestions">×</button></header><div class="marriage-suggestion-list">';
  MARRIAGE_RHYTHM_TEMPLATES.forEach(function(template){
   var info=marriageTemplateStatus(template.id),statusLabel=info.status==="linked"?"Linked":info.status==="inactive"?"Inactive":info.status==="deleted"?"Previously linked rhythm deleted":"Available";
   if(info.record){
    statusLabel=info.status==="inactive"?"Inactive":"Linked";
    if(!info.inMarriage)statusLabel+=" · not shown in Marriage";
   }
   out+='<section class="marriage-suggestion-row"><div class="marriage-suggestion-copy"><h3>'+esc(template.title)+'</h3><p>'+esc(template.description)+'</p><div class="marriage-suggestion-meta">'+esc(typeof window.rhythmFreqLabel==="function"?window.rhythmFreqLabel({freq:template.freq}):template.freq)+' · '+esc(template.tod==="evening"&&TODS.evening?TODS.evening:"Flexible time")+' · <span>'+esc(statusLabel)+'</span></div>';
   if(info.record)out+='<p class="marriage-suggestion-linked">Using “'+esc(info.record.text||"Untitled rhythm")+'” · '+esc(marriageRhythmSummary(info.record))+'</p>';
   if(info.status==="deleted")out+='<p class="marriage-suggestion-linked">The linked rhythm is no longer present; its history was not changed.</p>';
   out+='</div><div class="marriage-suggestion-actions">';
   if(info.status==="available")out+='<button type="button" class="btn mini" data-marriage-suggestion-add="'+esc(template.id)+'" aria-label="Customize '+esc(template.title)+'">Customize</button><button type="button" class="btn mini ghost" data-marriage-link-select="'+esc(template.id)+'" aria-label="Link an existing rhythm to '+esc(template.title)+'">Link existing</button>';
   else if(info.status==="deleted")out+='<button type="button" class="btn mini" data-marriage-suggestion-add="'+esc(template.id)+'" aria-label="Create a replacement for '+esc(template.title)+'">Create replacement</button><button type="button" class="btn mini ghost" data-marriage-link-select="'+esc(template.id)+'" aria-label="Link another rhythm to '+esc(template.title)+'">Link another</button><button type="button" class="btn mini ghost" data-marriage-template-unlink="'+esc(template.id)+'">Clear deleted link</button>';
   else out+='<button type="button" class="btn mini ghost" data-marriage-template-unlink="'+esc(template.id)+'">Unlink suggestion</button>';
   out+='</div>';
   if(marriageLinkTemplateId===template.id&&candidateTemplate){
    out+='<div class="marriage-link-panel"><h4>Choose an existing rhythm</h4>';
    if(!candidates.length)out+='<p>No unlinked rhythms are available to link.</p>';
    else out+='<ul>'+candidates.map(function(item){return '<li><span><strong>'+esc(item.record.text||"Untitled rhythm")+'</strong><small>'+esc(item.person?"For "+item.person.name:"Area rhythm")+" · "+esc(marriageRhythmSummary(item.record))+'</small></span><button type="button" class="btn mini ghost" data-marriage-link-candidate="'+esc(template.id)+'|'+esc(item.record.id)+'"'+(marriageLinkCandidateId===item.record.id?' aria-pressed="true"':'')+'>'+(marriageLinkCandidateId===item.record.id?"Selected":"Select")+'</button></li>';}).join("")+'</ul>';
    if(candidate&&candidateTemplate&&marriageLinkTemplateId===candidateTemplate.id){
     var candidateAreas=areaIds(candidate.record).map(function(id){return categoryLabel(id,candidate.record);});
     out+='<div class="marriage-link-review"><strong>Review before linking</strong><p>'+esc(candidate.record.text||"Untitled rhythm")+' will keep its title, schedule, person and history. Current categories: '+esc(candidateAreas.join(", ")||"none")+'.</p><label><input type="checkbox" data-marriage-link-show checked> Also show it in Marriage'+(candidateAreas.indexOf("Marriage")===-1?' (adds the Marriage category)':'')+'</label><button type="button" class="btn mini" data-marriage-link-confirm="'+esc(candidateTemplate.id)+'|'+esc(candidate.record.id)+'">Link this rhythm</button></div>';
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
 function categoryRhythmRow(item,id){
  var record=item.record;
  if(record.fitnessType&&typeof fitnessSharedRhythmCardHTML==="function")return fitnessSharedRhythmCardHTML(record,{categoryId:id});
  if(item.person){
   return window.rhythmRow(item.person,record,{tendAttributes:{"data-rhythm-area":id}});
  }
  if(areaRhythmEditId===record.id){var editRecord=areaRhythmDraft&&areaRhythmDraft.areaId===id&&areaRhythmDraft.record.id===record.id?areaRhythmDraft.record:record;return categoryRhythmFormHTML(id,editRecord,record.id);}
  var score=rhythmScore(record),metadata=window.tendRhythmCardMetadata(record);
  return tendRhythmCardHTML(record,{title:record.text||"(unnamed rhythm)",description:record.description,score:Number.isFinite(score)?score:null,scoreClass:scoreClass(score),categoryBadgesHTML:areaBadges(record),
   frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
   tendAttributes:{"data-tend-open":"area-rhythm","data-area-id":id,"data-rhythm-id":record.id},
   editAttributes:{"data-area-rhythm-edit":id+"|"+record.id},
   historyAttributes:{"data-rhyhistory":"area-rhythm|"+id+"|"+record.id},
   removeAttributes:{"data-area-rhythm-delete":id+"|"+record.id},removeLabel:"Delete "+(record.text||"rhythm"),removeTitle:"Delete rhythm"
  });
 }
 window.faithLinkedRhythmCount=function(group){return categoryRhythms("faith").filter(function(item){return (item.record.faithGroup||"Prayer")===group&&!item.record.disabled&&!rhythmEnded(item.record);}).length;};
 window.faithLinkedRhythmItems=function(group){return categoryRhythms("faith").filter(function(item){return (item.record.faithGroup||"Prayer")===group&&!item.record.disabled&&!rhythmEnded(item.record);}).map(function(item){return {item:item,id:categoryRhythmOrderId(item)};});};
 window.faithLinkedRhythmHTML=function(item){return categoryRhythmRow(item,"faith");};
 window.faithLinkedRhythmRows=function(group){return window.faithLinkedRhythmItems(group).sort(function(a,b){return String(a.item.record.text||"").localeCompare(String(b.item.record.text||""));}).map(function(entry){return categoryRhythmRow(entry.item,"faith");}).join("");};
 function categoryRhythmFormHTML(id,record,rid,forMe){
  var idf="area-"+id+"|"+rid;
  var templateStart=record.sourceTemplateId&&rid==="draft"?'<label class="careplan-field marriage-template-start">Start date<input type="date" data-rfield="'+esc(idf)+'|start" value="'+esc(record.start||"")+'" required></label>':'';
  var editableCategories=forMe||!!(record.sourceTemplateId&&rid==="draft");
  return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="area-rhythm-editor-title"><div class="profile-editor-body rhyedit area-rhythm-edit" data-area-rhythm-form="'+esc(id)+'|'+esc(rid)+'"><h3 id="area-rhythm-editor-title">'+(rid==="draft"?"Add Rhythm":"Edit Rhythm")+'</h3><label class="careplan-field">Rhythm<input data-crf="text" value="'+esc(record.text||"")+'" placeholder="What is the rhythm?"></label><label class="careplan-field rhythm-description-field">Description (optional)<textarea data-crf="description" placeholder="Add context or details">'+esc(record.description||"")+'</textarea></label>'+(editableCategories?areaChecks(record,idf)+'<p class="me-rhythm-category-note">'+(forMe?"Choose at least one category for this rhythm.":"Choose where this rhythm appears.")+'</p>':'')+window.personRhythmScheduleHTML(record,idf)+templateStart+'<label class="careplan-field">Person (optional)<select data-crf="personId"><option value="">No person</option>'+S.people.map(function(person){return '<option value="'+esc(person.id)+'"'+(record.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join("")+'</select></label><label class="me-personal-toggle"><input type="checkbox" data-crf="personal"'+(record.personal?' checked':'')+'> <span>Personal rhythm</span></label><div class="profile-editor-actions"><button type="button" class="btn mini" data-area-rhythm-save="'+esc(id)+'|'+esc(rid)+'">Save Rhythm</button><button type="button" class="btn mini ghost" data-area-rhythm-cancel="1" data-editor-cancel>Cancel</button>'+(rid==="draft"?"":'<button type="button" class="btn mini danger" data-area-rhythm-delete="'+esc(id)+'|'+esc(rid)+'">Delete Rhythm</button>')+'</div></div></dialog>';
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
  out+='<section class="card category-rhythms"><div class="category-rhythms-heading"><div><div class="subhead">Rhythms</div><div class="profile-tab-intro">Recurring practices connected to this category.</div></div><div class="category-rhythm-header-actions">'+tendRhythmOrderToolbar(orderContext,rows.length,"category-rhythm-order-toolbar")+'<button type="button" class="btn mini ghost" data-area-rhythm-new="'+esc(id)+'">+ Add rhythm</button>'+(id==="marriage"&&rows.length?'<button type="button" class="btn mini ghost" data-marriage-suggestions-open>Explore suggestions</button>':"")+'</div></div>';
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
  if(id==="marriage"&&!areaRhythmDraft&&rows.length===0)out+='<div class="marriage-suggestions-empty"><p>Start with a shared rhythm that fits your season.</p><button type="button" class="btn mini" data-marriage-suggestions-open>Explore suggested rhythms</button></div>';
  return out+(id==="marriage"?marriageSuggestionsDialog():"")+'</section>';
 }
 var baseRenderArea=window.renderArea;
 window.renderArea=function(id){
  if(id==="health"&&typeof renderFitnessPage==="function")return renderFitnessPage();
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
  record.areas=areaIds(record);
  if(id==="me"&&!record.areas.length){flash("Choose at least one category");var firstArea=form.querySelector('[data-rfield$="|areas"]');if(firstArea)firstArea.focus();return;}
  if(record.sourceTemplateId&&!record.areas.length){flash("Choose at least one category");var templateArea=form.querySelector('[data-rfield$="|areas"]');if(templateArea)templateArea.focus();return;}
  if(id!=="me"&&!record.areas.length)record.areas=[id];
  var suggestionTemplateId=rid==="draft"?record.sourceTemplateId:null;
  if(rid==="draft"){record.id=uid();record.added=record.added||todayStr();}
  var assigned=S.people.find(function(person){return person.id===form.querySelector('[data-crf="personId"]').value;});
  if(assigned){
   record.added=record.added||todayStr();
   S.events.forEach(function(event){if(event.rhythmId===record.id)event.personId=assigned.id;});
   assigned.rhythms=assigned.rhythms||[];assigned.rhythms.push(record);
   S.areaRhythms=S.areaRhythms.filter(function(item){return item!==original&&item!==record;});
  }else if(rid==="draft")S.areaRhythms.push(record);
  else if(original)Object.assign(original,record);
  if(suggestionTemplateId)S.marriageRhythmTemplateLinks[suggestionTemplateId]=record.id;
  if(suggestionTemplateId)marriageSuggestionsOpen=true;
  areaRhythmDraft=null;areaRhythmEditId=null;save();if(!window.tendFinishRhythmEdit||!window.tendFinishRhythmEdit())render();flash("Rhythm saved");
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
  var marriageAction=event.target&&event.target.closest&&event.target.closest("[data-marriage-suggestions-open],[data-marriage-suggestions-close],[data-marriage-suggestion-add],[data-marriage-link-select],[data-marriage-link-candidate],[data-marriage-link-confirm],[data-marriage-template-unlink]");
  if(marriageAction){
   event.preventDefault();event.stopImmediatePropagation();
   if(marriageAction.hasAttribute("data-marriage-suggestions-open")){marriageSuggestionsOpen=true;marriageLinkTemplateId=null;marriageLinkCandidateId=null;render();requestAnimationFrame(function(){var heading=document.getElementById("marriage-rhythm-suggestions-title");if(heading)heading.focus({preventScroll:true});});return;}
   if(marriageAction.hasAttribute("data-marriage-suggestions-close")){marriageSuggestionsOpen=false;marriageLinkTemplateId=null;marriageLinkCandidateId=null;render();return;}
   if(marriageAction.hasAttribute("data-marriage-suggestion-add")){
    var templateId=marriageAction.getAttribute("data-marriage-suggestion-add"),draft=marriageTemplateDraft(templateId);
    if(!draft){flash("This suggestion is already linked");return;}
    if(window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(marriageAction);
    marriageSuggestionsOpen=false;marriageLinkTemplateId=null;marriageLinkCandidateId=null;areaRhythmDraft={areaId:"marriage",record:draft};areaRhythmEditId=null;render();requestAnimationFrame(function(){var title=document.querySelector('[data-area-rhythm-form="marriage|draft"] [data-crf="text"]');if(title)title.focus({preventScroll:true});});return;
   }
   if(marriageAction.hasAttribute("data-marriage-link-select")){marriageLinkTemplateId=marriageAction.getAttribute("data-marriage-link-select");marriageLinkCandidateId=null;render();return;}
   if(marriageAction.hasAttribute("data-marriage-link-candidate")){var candidateKey=marriageAction.getAttribute("data-marriage-link-candidate").split("|");marriageLinkTemplateId=candidateKey[0];marriageLinkCandidateId=candidateKey[1];render();return;}
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
   if(button.hasAttribute("data-area-rhythm-new")){var area=button.getAttribute("data-area-rhythm-new"),record=newAreaRhythm(area),faithGroup=button.getAttribute("data-faith-group");if(area==="faith"&&FAITH_SUBCATEGORIES.indexOf(faithGroup)>=0)record.faithGroup=faithGroup;areaRhythmDraft={areaId:area,record:record};areaRhythmEditId=null;render();return;}
   if(button.hasAttribute("data-area-rhythm-edit")){if(window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(button);var edit=button.getAttribute("data-area-rhythm-edit").split("|"),source=categoryRhythmRecord(edit[0],edit[1]);if(source&&tab!=="me"&&currentArea!==edit[0]){tab="areas";currentArea=edit[0];currentPerson=null;}areaRhythmEditId=edit[1];areaRhythmDraft=source?{areaId:edit[0],record:JSON.parse(JSON.stringify(source))}:null;render();return;}
   if(button.hasAttribute("data-area-rhythm-cancel")){if(areaRhythmDraft&&areaRhythmDraft.record.sourceTemplateId&&areaRhythmDraft.record.id==="draft")marriageSuggestionsOpen=true;areaRhythmDraft=null;areaRhythmEditId=null;if(!window.tendFinishRhythmEdit||!window.tendFinishRhythmEdit())render();return;}
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
 window.addEventListener("cancel",function(event){var dialog=event.target;if(dialog&&dialog.matches&&dialog.matches(".rhythm-faith-flyout"))cancelFaithPicker(dialog);},true);
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

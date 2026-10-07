"use strict";
/* Category links for person rhythms and rhythms owned by an area. */
(function(){
 var CATEGORY_AREAS=["faith","marriage","parenting","health","finances","friendships"];
 var CATEGORY_AREA_LABELS={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var FAITH_SUBCATEGORIES=typeof FAITH_GROUPS!=="undefined"?FAITH_GROUPS.slice():["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
 var CATEGORY_AREA_SET=CATEGORY_AREAS.reduce(function(out,id){out[id]=true;return out;},{});
 var baseEnsureShape=window.ensureShape;
 window.ensureShape=function(state){
  var shaped=baseEnsureShape(state);
  if(!Array.isArray(shaped.areaRhythms))shaped.areaRhythms=[];
  return shaped;
 };
 S=window.ensureShape(S);
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
 function categoryLabel(id,record){return id==="faith"?"Faith - "+(record&&record.faithGroup||"Prayer"):CATEGORY_AREA_LABELS[id]||(S.areas[id]&&S.areas[id].name)||id;}
 window.tendRhythmCategoryIds=areaIds;
 function areaBadges(r){
  var ids=areaIds(r);
  if(!ids.length)return "";
  return '<span class="rhythm-area-badges" aria-label="Categories: '+esc(ids.map(function(id){return categoryLabel(id,r);}).join(", "))+'">'+ids.map(function(id){
   var name=categoryLabel(id,r);
   return '<button type="button" class="rhythm-area-badge" data-rhythm-area-badge="'+esc(id)+'" data-category-tooltip="'+esc(name)+'"'+(id==="faith"?' data-rhythm-faith-subcategory="'+esc(r.faithGroup||"Prayer")+'"':'')+' title="'+esc(name)+'" aria-label="Open '+esc(name)+'">'+(AREA_ICONS[id]||"")+'</button>';
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
  return baseFaithRhythmRow(record).replace("</b>","</b>"+areaBadges(record));
 };
 var basePersonRhythmRow=window.rhythmRow;
 window.rhythmRow=function(person,record){
  var html=basePersonRhythmRow(person,record);
  if(editRhythmId===record.id)return html;
  return html.replace("</b>","</b>"+areaBadges(record));
 };

 var baseAreaScore=window.areaScore;
 window.areaScore=function(id){
  if(id==="faith"||!CATEGORY_AREA_SET[id])return baseAreaScore(id);
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
 function categoryRhythmDue(item){return !rhythmEnded(item.record)&&todayRhythmEligible(item.record);}
 function categoryRhythmRow(item,id){
  var record=item.record;
  if(item.person){
   var html=window.rhythmRow(item.person,record);
   html=html.replace(/data-tend-open="person-rhythm"/,function(match){return match+' data-rhythm-area="'+esc(id)+'"';});
   html=html.replace("</strong>",'</strong><span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span><button type="button" class="rhythm-person-badge" data-openperson="'+esc(item.person.id)+'" aria-label="Open '+esc(item.person.name)+'">'+personAvatar(item.person,22)+'<span>'+esc(item.person.name.trim().split(/\s+/)[0])+'</span></button>');
   return html;
  }
  if(areaRhythmEditId===record.id){var editRecord=areaRhythmDraft&&areaRhythmDraft.areaId===id&&areaRhythmDraft.record.id===record.id?areaRhythmDraft.record:record;return categoryRhythmFormHTML(id,editRecord,record.id);}
  var score=rhythmScore(record),badges='<span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>'+areaBadges(record),meta=tendRhythmMetaLabel(record,null,true);
  return '<div class="rhyrow"><span class="rhythm-health"><span class="sm-dot '+scoreClass(score)+'" aria-hidden="true"></span><span>'+score+'%</span></span><div class="gr-main">'+tendRowContent(record.text||"(unnamed rhythm)",record.description||"",meta,badges)+'</div><button type="button" class="btn mini" data-tend-open="area-rhythm" data-area-id="'+esc(id)+'" data-rhythm-id="'+esc(record.id)+'">Tend</button><button type="button" class="iconbtn rhythm-history-trigger" data-rhyhistory="area-rhythm|'+esc(id)+'|'+esc(record.id)+'" aria-label="View history for '+esc(record.text)+'" title="View rhythm history"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button><button type="button" class="iconbtn" data-area-rhythm-edit="'+esc(id)+'|'+esc(record.id)+'" aria-label="Edit '+esc(record.text)+'" title="Edit">✎</button><button type="button" class="iconbtn" data-area-rhythm-delete="'+esc(id)+'|'+esc(record.id)+'" aria-label="Delete '+esc(record.text)+'" title="Delete">×</button></div>';
 }
 window.faithLinkedRhythmCount=function(group){return categoryRhythms("faith").filter(function(item){return (item.record.faithGroup||"Prayer")===group&&!item.record.disabled&&!rhythmEnded(item.record);}).length;};
 window.faithLinkedRhythmRows=function(group){return categoryRhythms("faith").filter(function(item){return (item.record.faithGroup||"Prayer")===group&&!item.record.disabled&&!rhythmEnded(item.record);}).sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));}).map(function(item){return categoryRhythmRow(item,"faith");}).join("");};
 function categoryRhythmFormHTML(id,record,rid){
  var idf="area-"+id+"|"+rid;
  return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="area-rhythm-editor-title"><div class="profile-editor-body rhyedit area-rhythm-edit" data-area-rhythm-form="'+esc(id)+'|'+esc(rid)+'"><h3 id="area-rhythm-editor-title">'+(rid==="draft"?"Add Rhythm":"Edit Rhythm")+'</h3><label class="careplan-field">Rhythm<input data-crf="text" value="'+esc(record.text||"")+'" placeholder="What is the rhythm?"></label><label class="careplan-field rhythm-description-field">Description (optional)<textarea data-crf="description" placeholder="Add context or details">'+esc(record.description||"")+'</textarea></label>'+window.personRhythmScheduleHTML(record,idf)+'<label class="careplan-field">Person (optional)<select data-crf="personId"><option value="">No person</option>'+S.people.map(function(person){return '<option value="'+esc(person.id)+'"'+(record.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join("")+'</select></label><div class="profile-editor-actions"><button type="button" class="btn mini" data-area-rhythm-save="'+esc(id)+'|'+esc(rid)+'">Save Rhythm</button><button type="button" class="btn mini ghost" data-area-rhythm-cancel="1" data-editor-cancel>Cancel</button>'+(rid==="draft"?"":'<button type="button" class="btn mini danger" data-area-rhythm-delete="'+esc(id)+'|'+esc(rid)+'">Delete Rhythm</button>')+'</div></div></dialog>';
 }
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
  var rows=categoryRhythms(id),due=rows.filter(categoryRhythmDue),out='<section class="card category-today-rhythms"><div class="subhead">Today</div>';
  if(due.length){
   due.forEach(function(item){var r=item.record,p=item.person,score=rhythmScore(r),tag=p?'<button type="button" class="rhythm-person-badge" data-openperson="'+esc(p.id)+'">'+personAvatar(p,22)+'<span>'+esc(p.name.trim().split(/\s+/)[0])+'</span></button>':'<span class="rhythm-owner-badge">Personal</span>';
    var tend=p?'<button type="button" class="btn mini" data-tend-open="person-rhythm" data-person-id="'+esc(p.id)+'" data-rhythm-id="'+esc(r.id)+'" data-rhythm-area="'+esc(id)+'">Tend</button>':'<button type="button" class="btn mini" data-tend-open="area-rhythm" data-area-id="'+esc(id)+'" data-rhythm-id="'+esc(r.id)+'">Tend</button>';
    var meta=tendRhythmMetaLabel(r,null,true);
    if(p){
     var badges=typeof window.planPills==="function"?window.planPills({personId:p.id,rhythm:p.id+"|"+r.id}):'<span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>'+rhythmPeopleBadges(r,p.id)+(typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(r):"");
     out+='<div class="actrow"><span class="act-ic" style="background:'+personHealthColor(score)+'"></span><div class="pi-main">'+tendRowContent(r.text||"(unnamed rhythm)",String(r.description||"").trim(),meta,badges)+'</div>'+(typeof window.planPills==="function"?"":tag)+tend+'</div>';
    }else out+='<div class="actrow"><span class="act-ic" style="background:'+personHealthColor(score)+'"></span><div class="pi-main"><div class="pi-label">'+esc(r.text||"(unnamed rhythm)")+'</div><div class="pi-sub">'+esc(meta)+'</div></div>'+tag+tend+'</div>';
   });
  }else out+='<div class="empty">No rhythms due today.</div>';
  out+='</section><section class="card category-rhythms"><div class="category-rhythms-heading"><div><div class="subhead">Rhythms</div><div class="profile-tab-intro">Recurring practices connected to this category.</div></div><button type="button" class="btn mini ghost" data-area-rhythm-new="'+esc(id)+'">+ Add rhythm</button></div>';
  if(areaRhythmDraft&&areaRhythmDraft.areaId===id)out+=categoryRhythmFormForArea(id);
  if(rows.length){
   rows.slice().sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));}).forEach(function(item){out+=categoryRhythmRow(item,id);});
  }else if(!(areaRhythmDraft&&areaRhythmDraft.areaId===id))out+='<div class="empty">No rhythms yet.</div>';
  return out+'</section>';
 }
 var baseRenderArea=window.renderArea;
 window.renderArea=function(id){
  var html=baseRenderArea(id);
  if(!CATEGORY_AREA_SET[id])return html;
  var marker='<div class="card" style="margin-bottom:14px"><div class="subhead">Tasks</div>';
  return html.replace(marker,categoryRhythmSections(id)+marker);
 };
 var baseRenderFaithPage=window.renderFaithPage;
 window.renderFaithPage=function(){
  var html=baseRenderFaithPage();
  if(!categoryRhythms("faith").some(categoryRhythmDue))return html;
  var sections=categoryRhythmSections("faith");
  var duplicateRhythmList='<section class="card category-rhythms">';
  var divider=sections.indexOf('</section>'+duplicateRhythmList);
  var todaySection=divider<0?sections:sections.slice(0,divider+'</section>'.length);
  return html.replace("</main>",todaySection+"</main>");
 };

 function applyRhythmField(record,field,target,form){
  if(field==="text"||field==="description"){record[field]=target.value;return false;}
  if(field==="areas"){record.areas=Array.prototype.slice.call(form.querySelectorAll('[data-rfield$="|areas"]:checked')).map(function(input){return input.value;});return false;}
  if(field==="weekdays"){
   record.weekdays=Array.prototype.slice.call(form.querySelectorAll('[data-rfield$="|weekdays"]:checked')).map(function(input){return +input.value;});
   if(record.freq!=="selectdays"&&record.weekdays.length>1)record.weekdays=[record.weekdays[0]];
   if(!record.weekdays.length)record.weekdays=[+target.value];
   return true;
  }
  if(field==="monthlyMode"){record.monthlyMode=target.value;return true;}
  if(field==="freq"){
   record.freq=target.value;
   if(target.value==="monthly"||target.value==="quarterly"){record.monthlyMode=record.monthlyMode||"onDay";record.dayOfMonth=record.dayOfMonth||new Date().getDate();if(target.value==="quarterly"&&!record.qmonth)record.qmonth=(new Date().getMonth()%3)+1;}
   if(target.value==="yearly"){record.monthlyMode=record.monthlyMode||"onDay";record.month=record.month||(new Date().getMonth()+1);record.monthDay=record.monthDay||new Date().getDate();}
   if(target.value==="custom"){record.every=record.every||1;record.unit=record.unit||"weeks";if(!record.start)record.start=todayStr();}
   if(target.value==="weekly"&&(!Array.isArray(record.weekdays)||record.weekdays.length!==1))record.weekdays=[new Date().getDay()];
   if(target.value==="selectdays"&&(!Array.isArray(record.weekdays)||!record.weekdays.length))record.weekdays=[new Date().getDay()];
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
  record.text=text;record.description=form.querySelector('[data-crf="description"]').value.trim();
  record.areas=areaIds(record);if(!record.areas.length)record.areas=[id];
  if(rid==="draft")record.id=uid();
  var assigned=S.people.find(function(person){return person.id===form.querySelector('[data-crf="personId"]').value;});
  if(assigned){
   record.added=record.added||todayStr();
   S.events.forEach(function(event){if(event.rhythmId===record.id)event.personId=assigned.id;});
   assigned.rhythms=assigned.rhythms||[];assigned.rhythms.push(record);
   S.areaRhythms=S.areaRhythms.filter(function(item){return item!==original&&item!==record;});
  }else if(rid==="draft")S.areaRhythms.push(record);
  else if(original)Object.assign(original,record);
  areaRhythmDraft=null;areaRhythmEditId=null;save();render();flash("Rhythm saved");
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
   if(area==="faith"){
    var group=badge.getAttribute("data-rhythm-faith-subcategory")||"Prayer";
    faithConfig().selectedGroup=group;faithConfig().practiceTabs=faithConfig().practiceTabs||{};faithConfig().practiceTabs[group]="rhythms";
   }
   render();window.scrollTo(0,0);return;
  }
  var button=event.target&&event.target.closest&&event.target.closest("[data-area-rhythm-new],[data-area-rhythm-edit],[data-area-rhythm-save],[data-area-rhythm-cancel],[data-area-rhythm-delete]");
  if(button){
   event.preventDefault();event.stopImmediatePropagation();
   if(button.hasAttribute("data-area-rhythm-new")){var area=button.getAttribute("data-area-rhythm-new"),record=newAreaRhythm(area),faithGroup=button.getAttribute("data-faith-group");if(area==="faith"&&FAITH_SUBCATEGORIES.indexOf(faithGroup)>=0)record.faithGroup=faithGroup;areaRhythmDraft={areaId:area,record:record};areaRhythmEditId=null;render();return;}
   if(button.hasAttribute("data-area-rhythm-edit")){var edit=button.getAttribute("data-area-rhythm-edit").split("|"),source=categoryRhythmRecord(edit[0],edit[1]);areaRhythmEditId=edit[1];areaRhythmDraft=source?{areaId:edit[0],record:JSON.parse(JSON.stringify(source))}:null;render();return;}
   if(button.hasAttribute("data-area-rhythm-cancel")){areaRhythmDraft=null;areaRhythmEditId=null;render();return;}
   if(button.hasAttribute("data-area-rhythm-save")){var key=button.getAttribute("data-area-rhythm-save").split("|");saveAreaRhythm(key[0],key[1],button.closest("[data-area-rhythm-form]"));return;}
   if(button.hasAttribute("data-area-rhythm-delete")){var remove=button.getAttribute("data-area-rhythm-delete").split("|"),entry=categoryRhythmRecord(remove[0],remove[1]);if(entry){S.areaRhythms=S.areaRhythms.filter(function(record){return record!==entry;});areaRhythmDraft=null;areaRhythmEditId=null;save();render();flash("Rhythm removed");}return;}
  }
  var openEdit=event.target&&event.target.closest&&event.target.closest("[data-rhyedit]");
  if(openEdit&&currentArea&&CATEGORY_AREA_SET[currentArea]){
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
 document.head.appendChild(styles);
})();

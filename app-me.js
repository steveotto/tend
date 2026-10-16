"use strict";

var meProfileEditOpen=false;
var meProfileSavePending=false;
function meName(){return window.TendAuth&&typeof window.TendAuth.displayName==="function"?window.TendAuth.displayName()||"":"";}
function meRhythmRecords(){
 var entries=[],seen=Object.create(null);
 function add(record,kind,owner){
  if(!record||record.personal!==true||!record.id)return;
  var key=kind+":"+owner+":"+record.id;
  if(seen[key])return;
  seen[key]=true;entries.push({record:record,kind:kind,owner:owner,id:kind==="person"?"person:"+owner+":"+record.id:kind==="faith"?"faith:"+record.id:record.fitnessType?"fitness:"+record.id:"area:"+record.id});
 }
 (S.people||[]).forEach(function(person){(person.rhythms||[]).forEach(function(record){add(record,"person",person.id);});});
 (S.rhythms||[]).forEach(function(record){add(record,"faith","faith");});
 (S.areaRhythms||[]).forEach(function(record){add(record,"area","area");});
 return entries;
}
window.tendMeRhythmRecords=meRhythmRecords;
function meAreaRhythmCard(record){
 var areas=typeof window.tendRhythmCategoryIds==="function"?window.tendRhythmCategoryIds(record):record.areas||[],area=areas[0]||"health";
 if(record.fitnessType&&typeof window.fitnessSharedRhythmCardHTML==="function")return window.fitnessSharedRhythmCardHTML(record);
 var metadata=window.tendRhythmCardMetadata(record),score=rhythmScore(record);
 return tendRhythmCardHTML(record,{title:record.text||"(unnamed rhythm)",description:record.description,score:Number.isFinite(score)?score:null,scoreClass:scoreClass(score),
  peopleBadgesHTML:typeof rhythmPeopleBadges==="function"?rhythmPeopleBadges(record,null):"",categoryBadgesHTML:window.tendCategoryBadges(record),
  frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
  tendAttributes:{"data-tend-open":"area-rhythm","data-area-id":area,"data-rhythm-id":record.id},
  editAttributes:{"data-area-rhythm-edit":area+"|"+record.id},
  historyAttributes:{"data-rhyhistory":"area-rhythm|"+area+"|"+record.id},
  removeAttributes:{"data-area-rhythm-delete":area+"|"+record.id},removeLabel:"Delete "+(record.text||"rhythm"),removeTitle:"Delete rhythm"
 });
}
function meRhythmCard(entry){
 if(entry.kind==="person"){
  var person=(S.people||[]).find(function(item){return item.id===entry.owner;});
  return person?window.rhythmRow(person,entry.record,{viewerPersonId:null}):"";
 }
 if(entry.kind==="faith")return window.faithRhythmRowHTML(entry.record);
 return meAreaRhythmCard(entry.record);
}
function meRhythmListHTML(){
 var entries=meRhythmRecords(),defaultEntries=entries.slice().sort(function(a,b){return String(a.record.text||"").localeCompare(String(b.record.text||""));});
 entries=window.tendRhythmOrderSort("me",defaultEntries,function(entry){return entry.id;});
 var ids=defaultEntries.map(function(entry){return entry.id;}),out='<section class="me-rhythms-section" aria-labelledby="me-rhythms-title"><div class="me-rhythms-heading"><h2 id="me-rhythms-title">My rhythms</h2><div class="me-rhythms-actions">'+window.tendRhythmOrderToolbar("me",entries.length,"me-rhythm-order-toolbar")+'<button type="button" class="btn mini ghost" data-me-rhythm-add>+ Add rhythm</button></div></div>';
 out+=window.tendMeRhythmEditorHTML?window.tendMeRhythmEditorHTML():"";
 if(!entries.length)out+='<div class="me-rhythms-empty"><p>No personal rhythms yet.</p><button type="button" class="btn mini" data-me-rhythm-add>Add your first rhythm</button></div>';
 else{
  out+='<div class="me-rhythm-list"'+window.tendRhythmOrderListAttributes("me",ids)+'>'+entries.map(function(entry,index){
   var card=meRhythmCard(entry);
   return entries.length>=2?window.tendRhythmOrderItemHTML("me","me",entry.id,entry.record.text,index,entries.length,card):card;
  }).join("")+'</div>';
 }
 return out+"</section>";
}
function meProfileDialogHTML(){
 if(!meProfileEditOpen)return "";
 var name=meName();
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="me-profile-dialog-title"><form class="profile-editor-body me-profile-form" data-me-profile-form><h2 id="me-profile-dialog-title">Edit profile</h2><label class="careplan-field">Display name<input type="text" name="displayName" maxlength="80" autocomplete="name" value="'+esc(name)+'" required></label><p class="me-profile-message" role="status" aria-live="polite"></p><div class="profile-editor-actions"><button type="submit" class="btn mini">Save profile</button><button type="button" class="btn mini ghost" data-me-profile-cancel data-editor-cancel>Cancel</button></div></form></dialog>';
}
function renderMe(){
 var name=meName(),photo=settings().profilePhoto||null,shownName=name||"Display name not set";
 var out=tendSectionHeaderHTML({title:"Me",subtitle:"Your profile and personal rhythms",className:"me-page-heading"});
 out+='<button type="button" class="me-more-link" data-me-more>More</button><section class="me-profile-card" aria-label="Your profile">'+personAvatar({name:name||"Me",photo:photo},64)+'<div class="me-profile-copy"><h2>'+esc(shownName)+'</h2><p>Your personal space in Tend</p></div><button type="button" class="btn mini ghost" data-me-profile-edit>Edit profile</button></section>';
 out+=meRhythmListHTML()+meProfileDialogHTML();
 return '<main class="me-page">'+out+'</main>';
}
document.addEventListener("click",function(event){
 var button=event.target&&event.target.closest&&event.target.closest("[data-me-open],[data-me-more],[data-me-profile-edit],[data-me-profile-cancel],[data-me-rhythm-add]");
 if(!button)return;
 if(button.hasAttribute("data-me-open")){tab="me";currentArea=null;currentPerson=null;openDetail=null;render();window.scrollTo(0,0);return;}
 if(button.hasAttribute("data-me-more")){meProfileEditOpen=false;tab="settings";render();window.scrollTo(0,0);return;}
 if(button.hasAttribute("data-me-profile-edit")){meProfileEditOpen=true;render();var field=document.querySelector('[data-me-profile-form] input[name="displayName"]');if(field)field.focus();return;}
 if(button.hasAttribute("data-me-profile-cancel")){meProfileEditOpen=false;render();return;}
 if(button.hasAttribute("data-me-rhythm-add")){if(window.tendStartMeRhythmEditor)window.tendStartMeRhythmEditor();render();var title=document.querySelector('[data-area-rhythm-form="me|draft"] [data-crf="text"]');if(title)title.focus();return;}
});
document.addEventListener("submit",function(event){
 var form=event.target&&event.target.closest&&event.target.closest("[data-me-profile-form]");
 if(!form)return;
 event.preventDefault();
 var field=form.elements.displayName,message=form.querySelector(".me-profile-message"),name=field.value.trim();
 if(!name){message.textContent="Enter a display name.";field.focus();return;}
 if(name.length>80){message.textContent="Display names must be 80 characters or fewer.";field.focus();return;}
 if(!window.TendAuth||typeof window.TendAuth.updateDisplayName!=="function"){message.textContent="Your account is still loading. Try again.";return;}
 if(meProfileSavePending)return;
 meProfileSavePending=true;
 var submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
 Promise.resolve(window.TendAuth.updateDisplayName(name)).then(function(){
  meProfileSavePending=false;meProfileEditOpen=false;render();flash("Display name saved");
 }).catch(function(error){
  meProfileSavePending=false;
  if(submit)submit.disabled=false;
  message.textContent="Could not save your display name. "+(error&&error.message||"Try again.");
 });
});

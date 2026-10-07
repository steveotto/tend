


"use strict";
/* ============ actions & bindings ============ */
function logEvent(areaId,personId,type,title,note,whenTs,rhythmId,extra){var _ev={id:uid(),ts:(whenTs||Date.now()),areaId:areaId,personId:personId||null,type:type||"inperson",kind:type||"inperson",title:title||"",note:note||"",rhythmId:rhythmId||null,weight:(ETYPES[type]?ETYPES[type].w:3)};if(extra)for(var _k in extra)_ev[_k]=extra[_k];S.events.push(_ev);save();render();}
function recordPrayer(prayer,logForPerson,forPersonId){
 if(!prayer||prayer.answered||prayer.archived)return false;
 var prayedAt=Date.now();
 prayer.prayed=(prayer.prayed||0)+1;prayer.lastPrayed=todayStr();prayer.prayerLogs=prayer.prayerLogs||[];prayer.prayerLogs.push(prayedAt);
 var personId=forPersonId||prayer.personId,person=logForPerson&&personId&&S.people.find(function(item){return item.id===personId;});
 if(person){
  if(typeof actDoneAdd==="function")actDoneAdd(person.id,prayer.id);
  logEvent(person.area,person.id,"prayer",prayer.text||"Prayer",prayer.details||"",prayedAt,null,{prayerId:prayer.id});
 }else{save();render();}
 flash(logForPerson?"Prayed \u2713":"Prayer recorded");
 return true;
}
document.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("[data-meter-tab]")){e.preventDefault();e.target.click();}});
function refreshConnectionDialogs(){if(typeof refreshConnectionHistoryDialog==="function")refreshConnectionHistoryDialog();if(typeof refreshConnectionListDialog==="function")refreshConnectionListDialog();}
function deleteEvent(id,preserveScroll){var scrollPosition={x:window.scrollX,y:window.scrollY};S.events=S.events.filter(function(e){return e.id!==id;});if(editingId===id){editingId=null;editingEvent=null;activityComposerOpen=false;}if(editingConn===id){editingConn=null;window._rippleModalOpen=false;}save();refreshConnectionDialogs();if(preserveScroll)renderPreservingScroll(scrollPosition);else render();flash("Entry deleted");}
function undoConnectionEvent(id){var event=S.events.find(function(item){return item.id===id;});if(!event)return;var scrollPosition={x:window.scrollX,y:window.scrollY},sparkConnection=event.origin==="spark"||event.note==="Spark landed",sparkRestored=false;if(sparkConnection&&typeof connectionSpark==="function"){var sparkData=connectionSpark(event);if(sparkData.spark){sparkData.spark.done=false;delete sparkData.spark.doneTs;Object.keys(window._actDone||{}).forEach(function(personId){if(Array.isArray(window._actDone[personId]))window._actDone[personId]=window._actDone[personId].filter(function(sparkId){return sparkId!==sparkData.spark.id;});});sparkRestored=true;}}delete tendItemAssociationDrafts[tendAssociationKey("connection","connection",id)];S.events=S.events.filter(function(item){return item.id!==id;});if(editingConn===id)editingConn=null;rhythmEditDraft=null;editRhythmId=null;window._rippleModalOpen=false;save();refreshConnectionDialogs();renderPreservingScroll(scrollPosition);flash(sparkConnection?(sparkRestored?"Spark restored":"Connection undone; original Spark not found"):"Connection undone");}
function updateEvent(id,patch,preserveScroll){var e=S.events.find(function(x){return x.id===id;});if(e){Object.keys(patch).forEach(function(k){e[k]=patch[k];});e.weight=(ETYPES[e.type]?ETYPES[e.type].w:3);save();refreshConnectionDialogs();if(preserveScroll)renderPreservingScroll();else render();flash("Entry updated");}}
function renderPreservingScroll(position){var x=position?position.x:window.scrollX,y=position?position.y:window.scrollY;render();requestAnimationFrame(function(){window.scrollTo(x,y);});}
function renderPreservingSparkPosition(row,viewerId){
 var rows=Array.prototype.slice.call(document.querySelectorAll("[data-spark-row]")),index=rows.indexOf(row),anchor=rows[index+1]||rows[index-1],anchorKey=anchor&&anchor.getAttribute("data-spark-row"),anchorTop=anchor&&anchor.getBoundingClientRect().top;
 var addButton=row&&row.closest("#profile-panel-sparks")&&row.closest("#profile-panel-sparks").querySelector("[data-sparkaddopen]"),addTop=addButton&&addButton.getBoundingClientRect().top;
 render();
 requestAnimationFrame(function(){requestAnimationFrame(function(){var target=null;if(anchorKey)target=Array.prototype.slice.call(document.querySelectorAll("[data-spark-row]")).find(function(item){return item.getAttribute("data-spark-row")===anchorKey;});if(target&&anchorTop!==null){window.scrollBy(0,target.getBoundingClientRect().top-anchorTop);return;}var add=Array.prototype.slice.call(document.querySelectorAll("[data-sparkaddopen]")).find(function(item){return item.getAttribute("data-sparkaddopen")===viewerId;});if(add&&addTop!==null)window.scrollBy(0,add.getBoundingClientRect().top-addTop);});});
}
var tendDialogDraft=null;
function tendDialogHTML(){
 function stepper(segment,label,direction){var title=direction>0?"Increase ":"Decrease ";return '<button type="button" class="tend-time-step" tabindex="-1" data-tend-step="'+segment+'" data-step-direction="'+direction+'" aria-label="'+title+label+'"><svg viewBox="0 0 12 8" aria-hidden="true"><path d="'+(direction>0?"m1 7 5-5 5 5":"m1 1 5 5 5-5")+'"/></svg></button>';}
 return '<dialog id="tendDialog" class="tend-dialog" aria-labelledby="tendHeading"><div class="tend-form"><button type="button" class="iconbtn tend-close" data-tend-cancel aria-label="Close">×</button><span class="focus-eyebrow">Tend</span><h2 id="tendHeading">When did you tend it?</h2><p id="tendTitle"></p><label>Date<input type="date" id="tendDate" required></label><label>Time<span class="tend-time-control"><input type="time" id="tendTime" step="60" tabindex="-1" aria-hidden="true" hidden><span class="tend-time-segment"><input type="text" id="tendTimeHour" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="Hour" aria-describedby="tendTimeHelp"><span class="tend-time-steppers">'+stepper("hour","hour",1)+stepper("hour","hour",-1)+'</span></span><span class="tend-time-separator" aria-hidden="true">:</span><span class="tend-time-segment"><input type="text" id="tendTimeMinute" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="Minute" aria-describedby="tendTimeHelp"><span class="tend-time-steppers">'+stepper("minute","minute",1)+stepper("minute","minute",-1)+'</span></span><select id="tendTimePeriod" aria-label="AM or PM"><option value="AM">AM</option><option value="PM">PM</option></select></span></label><div class="tend-actions"><button type="button" class="btn ghost" data-tend-cancel>Cancel</button><button type="button" class="btn" data-tend-save>Save</button></div></div></dialog>';
}
function setTendTime(value){
 var parts=String(value||"").match(/^(\d{2}):(\d{2})$/),hourField=document.getElementById("tendTimeHour"),minuteField=document.getElementById("tendTimeMinute"),period=document.getElementById("tendTimePeriod"),nativeTime=document.getElementById("tendTime");
 if(!parts||!hourField||!minuteField||!period||!nativeTime)return;
 var hour=+parts[1];hourField.value=String(hour%12||12).padStart(2,"0");minuteField.value=parts[2];period.value=hour<12?"AM":"PM";nativeTime.value=parts[1]+":"+parts[2];
}
function normalizeTendTimeSegment(field){if(!field||!field.value)return;var bounds=field.id==="tendTimeHour"?[1,12]:[0,59],value=Number(field.value);if(!Number.isFinite(value))return;value=Math.max(bounds[0],Math.min(bounds[1],value));field.value=String(value).padStart(2,"0");}
function syncTendTime(){
 var hourField=document.getElementById("tendTimeHour"),minuteField=document.getElementById("tendTimeMinute"),period=document.getElementById("tendTimePeriod"),nativeTime=document.getElementById("tendTime");
 if(!hourField||!minuteField||!period||!nativeTime)return false;
 var hour=Number(hourField.value),minute=Number(minuteField.value);
 if(!/^\d{1,2}$/.test(hourField.value)||hour<1||hour>12){nativeTime.value="";return false;}
 if(!/^\d{1,2}$/.test(minuteField.value)||minute<0||minute>59){nativeTime.value="";return false;}
 var hour24=hour%12+(period.value==="PM"?12:0);nativeTime.value=String(hour24).padStart(2,"0")+":"+String(minute).padStart(2,"0");return true;
}
function stepTendTime(segment,direction){
 var field=document.getElementById(segment==="hour"?"tendTimeHour":"tendTimeMinute"),min=segment==="hour"?1:0,max=segment==="hour"?12:59;
 normalizeTendTimeSegment(field);var current=field&&field.value?Number(field.value):(segment==="hour"?1:0),next=current+direction;
 if(next>max)next=min;if(next<min)next=max;field.value=String(next).padStart(2,"0");syncTendTime();field.focus();field.select();
}
function openTendDialog(button){
 var kind=button.getAttribute("data-tend-open"),personId=button.getAttribute("data-person-id"),rhythmId=button.getAttribute("data-rhythm-id"),areaId=button.getAttribute("data-area-id")||button.getAttribute("data-rhythm-area"),title="",rhythm=null;
 if(kind==="person-rhythm"){var person=S.people.find(function(item){return item.id===personId;});rhythm=person&&(person.rhythms||[]).find(function(item){return item.id===rhythmId;});if(!person||!rhythm)return;title=rhythm.text||"Rhythm";}
 else if(kind==="faith-rhythm"){rhythm=typeof faithFindRhythm==="function"?faithFindRhythm(rhythmId):null;if(!rhythm)return;title=rhythm.text||"Faith rhythm";}
 else if(kind==="area-rhythm"){rhythm=(S.areaRhythms||[]).find(function(item){return item.id===rhythmId&&Array.isArray(item.areas)&&item.areas.indexOf(areaId)!==-1;});if(!rhythm)return;title=rhythm.text||"Rhythm";}
 else return;
 var dialog=document.getElementById("tendDialog");
 if(!dialog){var wrapper=document.createElement("div");wrapper.innerHTML=tendDialogHTML();dialog=wrapper.firstElementChild;dialog.addEventListener("close",function(){tendDialogDraft=null;dialog.remove();});document.body.appendChild(dialog);}
 tendDialogDraft={kind:kind,personId:personId,rhythmId:rhythmId,areaId:areaId};
 dialog.querySelector("#tendHeading").textContent="When did you tend it?";
 dialog.querySelector("#tendTitle").textContent=title;
 dialog.querySelector("#tendDate").value=todayStr();
 setTendTime(nowHM());
 tendShowModal(dialog);
 dialog.querySelector("#tendDate").focus();
}
function saveTendDialog(){
 var dialog=document.getElementById("tendDialog"),draft=tendDialogDraft,date=dialog&&dialog.querySelector("#tendDate"),time=dialog&&dialog.querySelector("#tendTime");
 if(!draft||!date||!date.value){flash("Choose a date");if(date)date.focus();return;}
 if(!syncTendTime()){flash("Enter a valid hour and minute");var hourField=document.getElementById("tendTimeHour"),minuteField=document.getElementById("tendTimeMinute");if(!/^\d{1,2}$/.test(hourField.value)||+hourField.value<1||+hourField.value>12)hourField.focus();else minuteField.focus();return;}
 var timestamp=new Date(date.value+"T"+time.value+":00").getTime();
 if(!Number.isFinite(timestamp)){flash("Enter a valid date and time");return;}
 if(draft.kind==="person-rhythm"){
  var person=S.people.find(function(item){return item.id===draft.personId;}),rhythm=person&&(person.rhythms||[]).find(function(item){return item.id===draft.rhythmId;});
  if(!person||!rhythm){flash("This rhythm is no longer available");dialog.close();return;}
  actDoneAdd(person.id,rhythm.id);
  logEvent(draft.areaId||person.area,person.id,"quality",rhythm.text,"",timestamp,rhythm.id);
  flash("Rhythm tended ✓");
 }else if(draft.kind==="faith-rhythm"){
  var faithRhythm=typeof faithFindRhythm==="function"?faithFindRhythm(draft.rhythmId):null;
  if(!faithRhythm){flash("This rhythm is no longer available");dialog.close();return;}
  faithLogRhythm(faithRhythm,timestamp);
 }else if(draft.kind==="area-rhythm"){
  var areaRhythm=(S.areaRhythms||[]).find(function(item){return item.id===draft.rhythmId&&Array.isArray(item.areas)&&item.areas.indexOf(draft.areaId)!==-1;});
  if(!areaRhythm){flash("This rhythm is no longer available");dialog.close();return;}
  logEvent(draft.areaId,null,"quality",areaRhythm.text,"",timestamp,areaRhythm.id);
  flash("Rhythm tended ✓");
 }
 tendDialogDraft=null;
 dialog.close();
 if(typeof focusRefreshDialog==="function")focusRefreshDialog();
}
document.addEventListener("click",function(event){
 var target=event.target,button=target&&target.closest&&target.closest("[data-tend-open],[data-tend-save],[data-tend-cancel],[data-tend-step]");
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(button.matches("[data-tend-open]"))openTendDialog(button);
 else if(button.matches("[data-tend-save]"))saveTendDialog();
 else if(button.matches("[data-tend-cancel]")){var dialog=document.getElementById("tendDialog");tendDialogDraft=null;if(dialog)dialog.close();}
 else if(button.matches("[data-tend-step]"))stepTendTime(button.getAttribute("data-tend-step"),+button.getAttribute("data-step-direction"));
},true);
document.addEventListener("input",function(event){var field=event.target;if(!field||!field.matches||!field.matches("#tendTimeHour,#tendTimeMinute"))return;field.value=field.value.replace(/\D/g,"").slice(0,2);syncTendTime();});
document.addEventListener("focusout",function(event){var field=event.target;if(!field||!field.matches||!field.matches("#tendTimeHour,#tendTimeMinute"))return;normalizeTendTimeSegment(field);syncTendTime();});
document.addEventListener("change",function(event){if(event.target&&event.target.id==="tendTimePeriod")syncTendTime();});
document.addEventListener("keydown",function(event){
 var field=event.target;if(!field||!field.matches||!field.matches("#tendTimeHour,#tendTimeMinute"))return;
 if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();stepTendTime(field.id==="tendTimeHour"?"hour":"minute",event.key==="ArrowUp"?1:-1);}
 else if(event.key==="Enter"){event.preventDefault();normalizeTendTimeSegment(field);syncTendTime();var next=field.id==="tendTimeHour"?document.getElementById("tendTimeMinute"):document.getElementById("tendTimePeriod");next.focus();if(next.select)next.select();}
});
window.openModal=function(){var sel=el("logArea"),selp=el("logPerson"),selk=el("logKind");sel.innerHTML=AREA_IDS.map(function(a){return '<option value="'+a+'">'+S.areas[a].name+'</option>';}).join("");selp.innerHTML='<option value="">- no specific person -</option>'+S.people.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join("");selk.innerHTML=Object.keys(KINDS).map(function(k){return '<option value="'+k+'">'+KINDS[k].label+'</option>';}).join("");el("logNote").value="";el("logModal").classList.add("open");};
window.closeModal=function(){el("logModal").classList.remove("open");};
window.submitLog=function(){logEvent(el("logArea").value,el("logPerson").value||null,el("logKind").value,el("logNote").value.trim());window.closeModal();};
function openPersonTab(pid,fromSectionBadge){tab="people";currentArea=null;currentPerson=pid;profileBadgePerson=fromSectionBadge?pid:null;openDetail=null;render();}
function downloadICS(title){var d=new Date();d.setDate(d.getDate()+1);d.setHours(7,0,0,0);function st(dt){return dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0")+"T"+String(dt.getUTCHours()).padStart(2,"0")+String(dt.getUTCMinutes()).padStart(2,"0")+"00Z";}var end=new Date(d.getTime()+15*60000);var ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Tend//EN","BEGIN:VEVENT","UID:"+uid()+"@tend","DTSTAMP:"+st(new Date()),"DTSTART:"+st(d),"DTEND:"+st(end),"SUMMARY:"+title.replace(/[,;]/g,""),"DESCRIPTION:From Tend","END:VEVENT","END:VCALENDAR"].join("\r\n");var blob=new Blob([ics],{type:"text/calendar"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tend-reminder.ics";a.click();flash("Reminder file downloaded");}
function saveEncNote(pid,ta){var p=S.people.find(function(x){return x.id===pid;});if(p){p.encouragementNote=ta.value;save();var h=document.querySelector('[data-enchint="'+pid+'"]');if(h){h.classList.add("show");setTimeout(function(){h.classList.remove("show");},900);}}}
function savePersonNote(pid,field,ta){var p=S.people.find(function(x){return x.id===pid;});if(p){p[field]=ta.value;save();var h=document.getElementById("prayerSaveHint");if(h){h.classList.add("show");clearTimeout(savePersonNote._t);savePersonNote._t=setTimeout(function(){h.classList.remove("show");},900);}}}

function bind(){
 if(window._tendDelegated)return;
 window._tendDelegated=true;
 document.addEventListener("input",function(e){if(e.target&&/^set(Green|Yellow|Base)$/.test(e.target.id)&&typeof updateMeterThresholdPreview==="function")updateMeterThresholdPreview();});
 document.addEventListener("toggle",function(e){var t=e.target;if(t.matches&&t.matches("[data-plan-block]"))planOpenState[t.getAttribute("data-plan-block")]=t.open;},true);
 document.addEventListener("cancel",function(e){
  if(e.target.id==="rippleDialog"){if(editingConn)delete tendItemAssociationDrafts[tendAssociationKey("connection","connection",editingConn)];rhythmEditDraft=null;editRhythmId=null;window._rippleModalOpen=false;editingConn=null;return;}
  if(e.target.matches&&e.target.matches("dialog[data-rhythm-picker-dialog]")){e.preventDefault();rhythmPickerDraft=null;render();return;}
  if(e.target.matches&&e.target.matches("dialog[data-profile-editor]")){
   e.preventDefault();var editor=e.target.getAttribute("data-profile-editor");
   if(editor==="rhythm")rhythmDraft=null;
   else if(editor==="spark"){var cancelledSparkOwner=sparkDraftOpenFor;if(cancelledSparkOwner){delete sparkAddDrafts[cancelledSparkOwner];delete tendItemAssociationDrafts[tendAssociationKey("spark",cancelledSparkOwner,"new")];}sparkDraftOpenFor=null;}
   else if(editor==="prayer"){var cancelledPrayerOwner=window._personPrayerDraftFor;if(cancelledPrayerOwner){delete prayerAddDrafts[cancelledPrayerOwner];delete tendItemAssociationDrafts[tendAssociationKey("prayer",cancelledPrayerOwner,"new")];}window._personPrayerDraftFor=null;}
   else if(editor==="note")noteDraftOpenFor=null;
   render();
  }
 },true);
 document.addEventListener("click",function(e){
  var t=e.target,b;
  if(b=t.closest('[data-settingstab]')){settingsTab=b.getAttribute('data-settingstab');document.querySelectorAll('[data-settingstab]').forEach(function(x){x.setAttribute('aria-selected',String(x.getAttribute('data-settingstab')===settingsTab));});document.querySelectorAll('.settings-panel').forEach(function(x){x.hidden=x.id!=='settings-panel-'+settingsTab;});return;}
  if(b=t.closest("[data-rhyhistory]")){openRhythmHistory(b.getAttribute("data-rhyhistory"));return;}
  if(b=t.closest("[data-connection-history]")){openConnectionHistory(b.getAttribute("data-connection-history"));return;}
  if(b=t.closest("[data-connection-list-view-all]")){openConnectionList(b.getAttribute("data-connection-list-view-all"));return;}
  if(b=t.closest("[data-prayer-past-view]")){openPersonPrayerPast(b.getAttribute("data-prayer-past-view"));return;}
  if(b=t.closest("[data-note-history]")){openPersonNoteHistory(b.getAttribute("data-note-history"));return;}
  if(b=t.closest("[data-personbadge]")){var target=b.getAttribute("data-personbadge").split("|"),personId=target[0],section={rhythm:"rhythms",spark:"sparks",prayer:"prayer",connection:"connection",notes:"notes"}[target[1]]||"rhythms";if(personId){profileTabs[personId]=section;currentArea=null;openPersonTab(personId,true);requestAnimationFrame(function(){requestAnimationFrame(function(){var panel=el("profile-panel-"+section),sectionTab=el("profile-tab-"+section);if(sectionTab)sectionTab.focus({preventScroll:true});if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"});});});}return;}
  if(b=t.closest("[data-profilenoteopen]")){noteDraftOpenFor=b.getAttribute("data-profilenoteopen");noteAddDrafts[noteDraftOpenFor]={personId:noteDraftOpenFor,sharedWith:[],areas:[]};delete tendItemAssociationDrafts[tendAssociationKey("followup",noteDraftOpenFor,"new")];render();var noteField=el("profileNoteTitle");if(noteField)noteField.focus();return;}
  if(b=t.closest("[data-profilenotecancel]")){if(noteDraftOpenFor){delete noteAddDrafts[noteDraftOpenFor];delete tendItemAssociationDrafts[tendAssociationKey("followup",noteDraftOpenFor,"new")];}noteDraftOpenFor=null;render();return;}
  if(b=t.closest("[data-profilenotesave]")){var noteTitle=el("profileNoteTitle"),noteDetails=el("profileNoteDetails"),noteKind=el("profileNoteKind"),noteOwner=b.getAttribute("data-profilenotesave");if(noteTitle&&noteTitle.value.trim()){var title=noteTitle.value.trim(),addedNote={id:uid(),personId:noteOwner,kind:noteKind?noteKind.value:"general",title:title,text:title,details:noteDetails?noteDetails.value.trim():"",createdAt:Date.now(),done:false};tendAssociationCommit("followup",noteOwner,"new",addedNote);S.followups.push(addedNote);delete noteAddDrafts[noteOwner];noteDraftOpenFor=null;save();render();flash("Note added");}else if(noteTitle){flash("Add a title first");noteTitle.focus();}return;}
  if(b=t.closest("[data-personprayeropen]")){window._personPrayerDraftFor=b.getAttribute("data-personprayeropen");delete prayerAddDrafts[window._personPrayerDraftFor];delete tendItemAssociationDrafts[tendAssociationKey("prayer",window._personPrayerDraftFor,"new")];render();var field=document.querySelector('[data-prayer-editor="new-person"] [data-prayer-field="title"]');if(field)field.focus();return;}
  if(b=t.closest("[data-personprayercancel]")){var prayerDraftOwner=window._personPrayerDraftFor;window._personPrayerDraftFor=null;if(prayerDraftOwner){delete prayerAddDrafts[prayerDraftOwner];delete tendItemAssociationDrafts[tendAssociationKey("prayer",prayerDraftOwner,"new")];}render();return;}
  if(b=t.closest("[data-meter-tab],[data-profiletab]")){var selected=b.getAttribute("data-meter-tab")||b.getAttribute("data-profiletab");profileTabs[currentPerson]=selected;document.querySelectorAll('[data-profiletab]').forEach(function(button){button.setAttribute('aria-selected',String(button.getAttribute('data-profiletab')===selected));});document.querySelectorAll('.profile-tab-panel').forEach(function(panel){panel.hidden=panel.id!=="profile-panel-"+selected;});if(b.hasAttribute('data-meter-tab')){var target=el("profile-tab-"+selected);if(target){target.focus({preventScroll:true});target.scrollIntoView({behavior:"smooth",block:"start"});}}return;}
  if(b=t.closest("[data-rippleidea]")){var pid=b.getAttribute("data-rippleidea");rippleIdeaOffsets[pid]=(rippleIdeaOffsets[pid]||0)+1;var person=S.people.find(function(p){return p.id===pid;});if(person)el("rippleIdea").textContent=rippleIdea(person);return;}
  if(b=t.closest("[data-rippleopen]")){window._rippleModalOpen=true;render();var rippleType=el("plogType");if(rippleType)rippleType.focus();return;}
  if(b=t.closest("[data-plan-kind-toggle]")){e.preventDefault();e.stopPropagation();var scope=b.getAttribute("data-plan-kind-toggle"),kind=b.getAttribute("data-kind");if(planKindVisibility[scope]&&Object.prototype.hasOwnProperty.call(planKindVisibility[scope],kind)){planKindVisibility[scope][kind]=planKindVisibility[scope][kind]===false;render();}return;}
  if(b=t.closest("[data-planview]")){var pv=b.getAttribute("data-planview");planViewState=(planViewState===pv)?null:pv;render();return;}
  if(b=t.closest("[data-areanav]")){currentArea=b.getAttribute("data-areanav");if(currentArea==="faith")faithConfig().selectedGroup="Sabbath";openDetail=null;editingId=null;editingEvent=null;activityComposerOpen=false;taskDraftArea=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-utilnav]")){tab=b.getAttribute("data-utilnav");window._psModalOpen=false;window._personPrayerDraftFor=null;currentArea=null;openDetail=null;editingId=null;editingEvent=null;activityComposerOpen=false;taskDraftArea=null;currentPerson=null;editingConn=null;editRhythmId=null;rhythmEditDraft=null;editSparkId=null;sparkEditDraft=null;sparkDraftOpenFor=null;noteDraftOpenFor=null;rhythmDraft=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-areago]")){currentArea=b.getAttribute("data-areago");if(currentArea==="faith")faithConfig().selectedGroup="Sabbath";openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-personrhythms]")){var pid=b.getAttribute("data-personrhythms");profileTabs[pid]="rhythms";currentArea=null;openPersonTab(pid);var target=el("profile-tab-rhythms");if(target){target.focus({preventScroll:true});target.scrollIntoView({behavior:"smooth",block:"start"});}return;}
  if(b=t.closest("[data-openperson]")){openPersonTab(b.getAttribute("data-openperson"));return;}
  if(b=t.closest("[data-closeperson]")){currentPerson=null;window._psModalOpen=false;window._personPrayerDraftFor=null;editingConn=null;editRhythmId=null;rhythmEditDraft=null;editSparkId=null;sparkEditDraft=null;sparkDraftOpenFor=null;noteDraftOpenFor=null;personKeyDateDraftFor=null;rhythmDraft=null;render();return;}
  if(b=t.closest("[data-personkeydateopen]")){personKeyDateDraftFor=b.getAttribute("data-personkeydateopen");render();var keyDateInput=document.querySelector('[data-kdlabel="'+personKeyDateDraftFor+'"]');if(keyDateInput)keyDateInput.focus();return;}
  if(b=t.closest("[data-personkeydatecancel]")){personKeyDateDraftFor=null;render();return;}
  if(b=t.closest("[data-psettings]")){window._psModalOpen=true;render();return;}
  if(b=t.closest("[data-psettingsclose]")){window._psModalOpen=false;render();return;}
  if(b=t.closest("[data-prayquick]")){var pqP=S.people.find(function(x){return x.id===b.getAttribute("data-prayquick");});if(pqP){var pqRef=b.getAttribute("data-prayref");var pqPr=(pqRef&&pqRef!=="focus")?S.prayers.find(function(x){return x.id===pqRef;}):null;if(pqPr)recordPrayer(pqPr,true,pqP.id);else{logEvent(pqP.area,pqP.id,"prayer","Prayer focus",pqP.prayerFocus||"",Date.now(),null,{});actDoneAdd(pqP.id,pqRef||"focus");render();flash("Prayed \u2713");}}return;}
  if(b=t.closest("[data-rhycancel]")){rhythmDraft=null;render();return;}
  if(b=t.closest("[data-item-picker-open]")){tendAssociationPickerOpen(b.getAttribute("data-item-picker-open"));return;}
  if(b=t.closest("[data-item-picker-faith-open]")){if(tendItemPickerDraft){tendItemPickerDraft.faithSubcategoryOpen=true;tendRefreshAssociationPicker(b.closest("dialog"));}return;}
  if(b=t.closest("[data-item-picker-faith-back]")){if(tendItemPickerDraft){tendItemPickerDraft.faithSubcategoryOpen=false;tendRefreshAssociationPicker(b.closest("dialog"));}return;}
  if(b=t.closest("[data-item-picker-faith-group]")){if(tendItemPickerDraft){var faithGroup=b.getAttribute("data-item-picker-faith-group");tendItemPickerDraft.faithGroup=faithGroup;if(tendItemPickerDraft.selected.indexOf("faith")===-1)tendItemPickerDraft.selected.push("faith");tendItemPickerDraft.faithSubcategoryOpen=false;tendRefreshAssociationPicker(b.closest("dialog"));}return;}
  if(b=t.closest("[data-item-picker-faith-remove]")){if(tendItemPickerDraft){tendItemPickerDraft.selected=tendItemPickerDraft.selected.filter(function(id){return id!=="faith";});tendItemPickerDraft.faithGroup=null;tendItemPickerDraft.faithSubcategoryOpen=false;tendRefreshAssociationPicker(b.closest("dialog"));}return;}
  if(b=t.closest("[data-item-picker-group]")){if(tendItemPickerDraft){tendItemPickerDraft.selected=tendApplyPeopleGroupToggle(tendItemPickerDraft.selected,tendItemPickerDraft.ownerId,b.getAttribute("data-item-picker-group"));tendRefreshPeoplePicker(b.closest("dialog"),tendItemPickerDraft.selected,tendItemPickerDraft.ownerId,"data-item-picker-group","data-item-picker-toggle");}return;}
  if(b=t.closest("[data-item-picker-toggle]")){if(tendItemPickerDraft){var itemToggle=b.getAttribute("data-item-picker-toggle").split("|"),toggleValue=itemToggle.slice(4).join("|"),toggleIndex=tendItemPickerDraft.selected.indexOf(toggleValue),toggleSelected=toggleIndex===-1;if(toggleSelected)tendItemPickerDraft.selected.push(toggleValue);else tendItemPickerDraft.selected.splice(toggleIndex,1);if(tendItemPickerDraft.kind==="people")tendRefreshPeoplePicker(b.closest("dialog"),tendItemPickerDraft.selected,tendItemPickerDraft.ownerId,"data-item-picker-group","data-item-picker-toggle");else{b.classList.toggle("selected",toggleSelected);b.setAttribute("aria-pressed",String(toggleSelected));}}return;}
  if(b=t.closest("[data-item-picker-save]")){
   var itemPicker=tendItemPickerDraft;
   if(itemPicker){
    var itemKey=tendAssociationKey(itemPicker.type,itemPicker.ownerId,itemPicker.itemId),itemRecord=tendAssociationRecord(itemPicker.type,itemPicker.ownerId,itemPicker.itemId),currentValues=tendAssociationValues(itemPicker.type,itemPicker.ownerId,itemPicker.itemId,itemRecord);
    var shared=itemPicker.kind==="people"?itemPicker.selected.filter(function(id){return id!==itemPicker.ownerId&&S.people.some(function(person){return person.id===id;});}):currentValues.sharedWith;
    var areas=itemPicker.kind==="categories"?itemPicker.selected.slice():currentValues.areas;
    if(itemPicker.type==="followup"&&itemPicker.ownerId==="faith"&&itemRecord&&itemRecord.kind==="faith-note"&&areas.indexOf("faith")===-1)areas.push("faith");
    tendItemAssociationDrafts[itemKey]={sharedWith:shared,areas:areas,faithGroup:areas.indexOf("faith")>=0?itemPicker.faithGroup:undefined};
    if(itemPicker.type==="spark"&&itemPicker.itemId==="new"&&sparkAddDrafts[itemPicker.ownerId]){sparkAddDrafts[itemPicker.ownerId].sharedWith=shared.slice();sparkAddDrafts[itemPicker.ownerId].areas=areas.slice();}
    if(itemPicker.type==="spark"&&sparkEditDraft&&sparkEditDraft.id===itemPicker.itemId){sparkEditDraft.sharedWith=shared.slice();sparkEditDraft.areas=areas.slice();}
    if(itemPicker.type==="spark"&&faithSparkDraft&&(itemPicker.itemId==="new"||faithSparkDraft.id===itemPicker.itemId)){faithSparkDraft.sharedWith=shared.slice();faithSparkDraft.areas=areas.slice();if(areas.indexOf("faith")>=0)faithSparkDraft.faithSection=itemPicker.faithGroup;}
    if(itemPicker.type==="followup"&&itemPicker.itemId==="new"){
     var followupDraft=tendAssociationRecord("followup",itemPicker.ownerId,"new");
     if(followupDraft){followupDraft.sharedWith=shared.slice();followupDraft.areas=areas.slice();if(areas.indexOf("faith")>=0)followupDraft.faithSection=itemPicker.faithGroup;else if(followupDraft.kind!=="faith-note")delete followupDraft.faithSection;}
    }
    var controls=Array.prototype.slice.call(document.querySelectorAll("[data-item-association-controls]")).find(function(node){return node.getAttribute("data-item-association-controls")===itemKey;}),focusTrigger=null;
    if(controls){var renderedControls=document.createElement("div");renderedControls.innerHTML=tendAssociationControlsHTML(itemPicker.type,itemPicker.ownerId,itemPicker.itemId,itemRecord);controls.innerHTML=renderedControls.firstElementChild.innerHTML;focusTrigger=Array.prototype.slice.call(controls.querySelectorAll("[data-item-picker-open]")).find(function(node){return node.getAttribute("data-item-picker-open")===itemKey+"|"+itemPicker.kind;});}
    var pickerDialog=b.closest("dialog");if(pickerDialog)pickerDialog.close();
    if(focusTrigger)requestAnimationFrame(function(){focusTrigger.focus({preventScroll:true});});
   }
   return;
  }
  if(b=t.closest("[data-item-picker-cancel]")){var itemPickerDialog=b.closest("dialog");if(itemPickerDialog)itemPickerDialog.close();return;}
  if(b=t.closest("[data-rhythm-picker-open]")){var pickerInfo=b.getAttribute("data-rhythm-picker-open").split("|"),pickerOwner=pickerInfo[1],pickerRhythm=pickerInfo[2],pickerRecord=rhythmPickerRecord(pickerOwner,pickerRhythm),pickerType=pickerInfo[0],pickerCategories=pickerRecord&&pickerType==="categories"?(typeof window.tendRhythmCategoryIds==="function"?window.tendRhythmCategoryIds(pickerRecord):pickerRecord.areas||[]):[];if(pickerRecord){rhythmPickerDraft={type:pickerType,ownerId:pickerOwner,rhythmId:pickerRhythm,selected:pickerType==="people"?(pickerRecord.sharedWith||[]).slice():pickerCategories.filter(function(id){return pickerOwner!=="faith"||id!=="faith";})};render();}return;}
  if(b=t.closest("[data-rhythm-picker-group]")){if(rhythmPickerDraft&&rhythmPickerDraft.type==="people"){rhythmPickerDraft.selected=tendApplyPeopleGroupToggle(rhythmPickerDraft.selected,rhythmPickerDraft.ownerId,b.getAttribute("data-rhythm-picker-group"));tendRefreshPeoplePicker(b.closest("dialog"),rhythmPickerDraft.selected,rhythmPickerDraft.ownerId,"data-rhythm-picker-group","data-rhythm-picker-toggle");}return;}
  if(b=t.closest("[data-rhythm-picker-toggle]")){if(rhythmPickerDraft){var pickerToggle=b.getAttribute("data-rhythm-picker-toggle").split("|"),toggleId=pickerToggle[3],toggleIndex=rhythmPickerDraft.selected.indexOf(toggleId),isSelected=toggleIndex===-1;if(isSelected)rhythmPickerDraft.selected.push(toggleId);else rhythmPickerDraft.selected.splice(toggleIndex,1);if(rhythmPickerDraft.type==="people")tendRefreshPeoplePicker(b.closest("dialog"),rhythmPickerDraft.selected,rhythmPickerDraft.ownerId,"data-rhythm-picker-group","data-rhythm-picker-toggle");else{b.classList.toggle("selected",isSelected);b.setAttribute("aria-pressed",String(isSelected));}}return;}
  if(b=t.closest("[data-rhythm-picker-save]")){if(rhythmPickerDraft){var savedPicker=rhythmPickerDraft,selectedRecord=rhythmPickerRecord(savedPicker.ownerId,savedPicker.rhythmId);if(selectedRecord){if(savedPicker.type==="people")selectedRecord.sharedWith=savedPicker.selected.filter(function(id){return id!==savedPicker.ownerId&&S.people.some(function(person){return person.id===id;});});else if(savedPicker.ownerId==="faith")selectedRecord.areas=savedPicker.selected.filter(function(id){return id!=="faith";});else{selectedRecord.areas=savedPicker.selected.slice();if(selectedRecord.areas.indexOf("faith")===-1){selectedRecord.faithGroup=null;if(selectedRecord.category==="faith")selectedRecord.category="connection";}else if(!selectedRecord.faithGroup)selectedRecord.faithGroup="Prayer";}}rhythmPickerDraft=null;render();}return;}
  if(b=t.closest("[data-rhythm-picker-cancel]")){rhythmPickerDraft=null;render();return;}
  if(b=t.closest("[data-rhyadd]")){var ra=b.getAttribute("data-rhyadd");
   if(rhythmDraft&&rhythmDraft.pid===ra&&rhythmDraft.text&&rhythmDraft.text.trim()){
    var rp2=S.people.find(function(x){return x.id===ra;});
    if(rp2){var nc={id:uid(),text:rhythmDraft.text.trim(),category:rhythmDraft.category||"connection",freq:rhythmDraft.freq||"weekly",tod:rhythmDraft.tod||"anytime",scheduleDow:scheduleHasWeekday(rhythmDraft.freq)?rhythmDraft.scheduleDow:null};
     if(nc.freq==="custom"){nc.customType=rhythmDraft.customType||"weekly";nc.customDow=rhythmDraft.customDow||0;nc.customOrd=rhythmDraft.customOrd||1;}
     if(rhythmDraft.durVal>=1){nc.durUnit=rhythmDraft.durUnit||"min";nc.durVal=rhythmDraft.durVal;}
     if(Array.isArray(rhythmDraft.sharedWith)&&rhythmDraft.sharedWith.length)nc.sharedWith=rhythmDraft.sharedWith.filter(function(id){return id!==rp2.id;});
     rp2.rhythms=rp2.rhythms||[];rp2.rhythms.push(nc);rhythmDraft=null;save();render();flash("Rhythm added");}
   }else if(rhythmDraft&&rhythmDraft.pid===ra){flash("Give the rhythm a name first");}
   else{rhythmDraft={pid:ra,text:"",category:"connection",freq:"weekly",tod:"anytime",durUnit:"min",durVal:0};render();}
   return;}
  if(b=t.closest("[data-sparkdo]")){
   var spd=b.getAttribute("data-sparkdo").split("|"),spp=S.people.find(function(x){return x.id===spd[0];}),faithSparkOwner=spd[0]==="faith",ss=faithSparkOwner?S.ideas.find(function(x){return x.id===spd[1]&&(x.category==="faith"||x.area==="faith"||x.faithSection);}):spp&&(spp.sparks||[]).find(function(x){return x.id===spd[1];}),sparkViewer=S.people.find(function(x){return x.id===(spd[2]||spd[0]);});
   if(ss&&sparkViewer){
    var completedAt=Date.now();ss.done=true;ss.doneTs=completedAt;if(faithSparkOwner){ss.completedTs=completedAt;ss.completedDate=todayStr();}actDoneAdd(sparkViewer.id,ss.id);
    var sparkPeople=(spp?[spp.id]:[]).concat(Array.isArray(ss.sharedWith)?ss.sharedWith:[],sparkViewer.id).filter(function(id,index,ids){return id&&ids.indexOf(id)===index&&S.people.some(function(person){return person.id===id;});});
    logEvent(sparkViewer.area,sparkViewer.id,"quality",ss.text,ss.details||"Spark landed",completedAt,null,{origin:"spark",sparkId:ss.id,sparkOwnerId:faithSparkOwner?"faith":spp.id,personIds:sparkPeople});
    flash("Spark landed - connection logged");
   }
   return;
  }
  if(b=t.closest("[data-sparkaddopen]")){sparkDraftOpenFor=b.getAttribute("data-sparkaddopen");delete tendItemAssociationDrafts[tendAssociationKey("spark",sparkDraftOpenFor,"new")];sparkAddDrafts[sparkDraftOpenFor]={sharedWith:[],areas:[]};render();var sparkTitle=document.querySelector('[data-spnewtext="'+sparkDraftOpenFor+'"]');if(sparkTitle)sparkTitle.focus();return;}
  if(b=t.closest("[data-sparkaddcancel]")){var sparkCancelledOwner=b.getAttribute("data-sparkaddcancel");delete sparkAddDrafts[sparkCancelledOwner];delete tendItemAssociationDrafts[tendAssociationKey("spark",sparkCancelledOwner,"new")];sparkDraftOpenFor=null;render();return;}
  if(b=t.closest("[data-sedit]")){var editParts=b.getAttribute("data-sedit").split("|"),sei=editParts[1]||editParts[0],sparkOwnerId=editParts[1]?editParts[0]:currentPerson,sparkOwner=S.people.find(function(person){return person.id===sparkOwnerId;}),spark=sparkOwner?(sparkOwner.sparks||[]).find(function(item){return item.id===sei;}):sparkOwnerId==="faith"?S.ideas.find(function(item){return item.id===sei;}):null;delete tendItemAssociationDrafts[tendAssociationKey("spark",sparkOwnerId,sei)];editSparkId=sei;sparkEditOwnerId=sparkOwnerId;sparkEditDraft=spark?JSON.parse(JSON.stringify(spark)):null;render();return;}
  if(b=t.closest("[data-sparkeditcancel]")){if(sparkEditOwnerId&&editSparkId)delete tendItemAssociationDrafts[tendAssociationKey("spark",sparkEditOwnerId,editSparkId)];editSparkId=null;sparkEditOwnerId=null;sparkEditDraft=null;render();return;}
  if(b=t.closest("[data-sparkeditsave]")){var draftId=b.getAttribute("data-sparkeditsave"),draftDialog=b.closest("dialog"),sparkTitle=draftDialog&&draftDialog.querySelector('[data-sfield="text"]'),sparkDetails=draftDialog&&draftDialog.querySelector('[data-sfield="details"]'),sparkDate=draftDialog&&draftDialog.querySelector('[data-sfield="by"]'),sparkTime=draftDialog&&draftDialog.querySelector('[data-sfield="time"]'),savedSpark=sparkEditDraft&&sparkEditDraft.id===draftId?sparkEditDraft:findSparkById(draftId),sparkOwnerId=sparkEditOwnerId||(currentPerson||"");if(savedSpark&&sparkTitle&&sparkTitle.value.trim()){savedSpark.text=sparkTitle.value.trim();savedSpark.details=sparkDetails&&sparkDetails.value.trim()?sparkDetails.value.trim():null;savedSpark.by=sparkDate&&sparkDate.value?sparkDate.value:null;savedSpark.time=savedSpark.by&&sparkTime&&sparkTime.value?sparkTime.value:null;tendAssociationCommit("spark",sparkOwnerId,draftId,savedSpark);var actualSparkOwner=S.people.find(function(person){return person.id===sparkOwnerId;});if(actualSparkOwner){var actualSpark=(actualSparkOwner.sparks||[]).find(function(item){return item.id===draftId;});if(actualSpark)Object.assign(actualSpark,savedSpark);}else if(sparkOwnerId==="faith"){var actualFaithSpark=S.ideas.find(function(item){return item.id===draftId;});if(actualFaithSpark){delete savedSpark.profileOwnerId;Object.assign(actualFaithSpark,savedSpark);}}editSparkId=null;sparkEditOwnerId=null;sparkEditDraft=null;save();render();flash("Spark updated");}else if(sparkTitle){flash("Add a spark first");sparkTitle.focus();}return;}
  if(b=t.closest("[data-scleardate]")){var sparkDateField=b.closest("dialog")&&b.closest("dialog").querySelector('[data-sfield="by"]'),sparkTimeField=b.closest("dialog")&&b.closest("dialog").querySelector('[data-sfield="time"]');if(sparkDateField)sparkDateField.value="";if(sparkTimeField)sparkTimeField.value="";return;}
  if(b=t.closest("[data-pphorm]")){var prp=S.people.find(function(x){return x.id===b.getAttribute("data-pphorm");});if(prp){prp.photo=null;save();render();flash("Photo removed");}return;}
  if(b=t.closest("[data-psubmit]")){var psp=S.people.find(function(x){return x.id===b.getAttribute("data-psubmit");});
   if(psp){var editingRippleEvent=editingConn&&S.events.find(function(event){return event.id===editingConn;}),rhythmConnection=editingRippleEvent&&editingRippleEvent.rhythmId,sparkConnection=editingRippleEvent&&(editingRippleEvent.origin==="spark"||editingRippleEvent.note==="Spark landed"),lockedConnectionType=rhythmConnection||sparkConnection;var pk=lockedConnectionType?(sparkConnection?"spark":"rhythm"):(el("plogType")?el("plogType").value:(editingRippleEvent&&(editingRippleEvent.kind||editingRippleEvent.type)||"quality"));var rippleLabel=RIPPLE_TYPES[pk];if(pk==="other"){pk=(el("plogOther")&&el("plogOther").value.trim())||"other";rippleLabel=pk==="other"?"Other":pk;}
    var pAll=el("momentAllDay")?el("momentAllDay").checked:false;
    var pDv=(el("momentDate")&&el("momentDate").value)||todayStr();var pTv=(!pAll&&el("momentTime")&&el("momentTime").value)?el("momentTime").value:"12:00";
    var pTs=new Date(pDv+"T"+pTv+":00").getTime();
    var pTtl=el("momentTitle")?el("momentTitle").value.trim():"";var pNt=el("momentNote")?el("momentNote").value.trim():"";
    var pTitle=pTtl||("Time with "+psp.name);
    if(rhythmConnection&&rhythmEditDraft&&rhythmEditDraft.endDateEnabled&&!rhythmEditDraft.until){flash("Choose an end date");var rhythmEndDate=document.querySelector('[data-rfield$="|until"]');if(rhythmEndDate)rhythmEndDate.focus();return;}
    window._rippleModalOpen=false;var editingRipple=editingConn;editingConn=null;
    if(editingRipple){var connectionPatch={ts:pTs,allDay:pAll};if(!rhythmConnection)Object.assign(connectionPatch,{title:pTitle,note:pNt});if(!lockedConnectionType){connectionPatch.kind=pk;connectionPatch.type=ETYPES[pk]?pk:"";connectionPatch.rippleLabel=rippleLabel;}if(lockedConnectionType){tendAssociationCommit("connection","connection",editingRipple,editingRippleEvent);Object.assign(connectionPatch,{personId:editingRippleEvent.personId,personIds:editingRippleEvent.personIds,areaId:editingRippleEvent.areaId,areas:editingRippleEvent.areas});}if(rhythmConnection&&rhythmEditDraft){var rhythmOwner=S.people.find(function(person){return (person.rhythms||[]).some(function(rhythm){return rhythm.id===rhythmEditDraft.id;});}),sourceRhythm=rhythmOwner&&(rhythmOwner.rhythms||[]).find(function(rhythm){return rhythm.id===rhythmEditDraft.id;});if(sourceRhythm){Object.assign(sourceRhythm,rhythmEditDraft);delete sourceRhythm.profileOwnerId;connectionPatch.title=sourceRhythm.text;S.events.forEach(function(event){if(event.rhythmId===sourceRhythm.id)event.title=sourceRhythm.text;});}}delete tendItemAssociationDrafts[tendAssociationKey("connection","connection",editingRipple)];rhythmEditDraft=null;editRhythmId=null;editingConn=null;updateEvent(editingRipple,connectionPatch,true);flash("Connection updated \u2713");}
    else{logEvent(psp.area,psp.id,pk,pTitle,pNt,pTs,null,{allDay:pAll,rippleLabel:rippleLabel});flash("Connection logged \u2713");}}
   return;}
  if(b=t.closest("[data-peditcancel]")){if(editingConn)delete tendItemAssociationDrafts[tendAssociationKey("connection","connection",editingConn)];rhythmEditDraft=null;editRhythmId=null;window._rippleModalOpen=false;editingConn=null;renderPreservingScroll();return;}
  if(b=t.closest("[data-spdel]")){var sdd=b.getAttribute("data-spdel").split("|"),sdp=S.people.find(function(x){return x.id===sdd[0];}),sparkIdToRemove=sdd[1],sparkViewerId=sdd[2]||currentPerson,sparkRow=b.closest("[data-spark-row]");if(sdp){if(sparkViewerId&&sparkViewerId!==sdp.id){var sharedSpark=(sdp.sparks||[]).find(function(item){return item.id===sparkIdToRemove;});if(sharedSpark)sharedSpark.sharedWith=(sharedSpark.sharedWith||[]).filter(function(id){return id!==sparkViewerId;});}else sdp.sparks=(sdp.sparks||[]).filter(function(item){return item.id!==sparkIdToRemove;});}else if(sdd[0]==="faith"){var faithSpark=S.ideas.find(function(item){return item.id===sparkIdToRemove;});if(faithSpark&&sparkViewerId)faithSpark.sharedWith=(faithSpark.sharedWith||[]).filter(function(id){return id!==sparkViewerId;});}if(sdp||sdd[0]==="faith"){editSparkId=null;sparkEditOwnerId=null;sparkEditDraft=null;save();if(sparkRow)renderPreservingSparkPosition(sparkRow,sparkViewerId);else renderPreservingScroll();flash(sparkViewerId&&sparkViewerId!==(sdp&&sdp.id)?"Spark removed":"Spark deleted");}return;}
  if(b=t.closest("[data-spadd]")){var sra=b.getAttribute("data-spadd");var srp=S.people.find(function(x){return x.id===sra;});var sri=document.querySelector('[data-spnewtext="'+sra+'"]');var srx=document.querySelector('[data-spnewdetails="'+sra+'"]');var srd=document.querySelector('[data-spnewdate="'+sra+'"]');var srt=document.querySelector('[data-spnewtime="'+sra+'"]');if(srp&&sri&&sri.value.trim()){var sparkAssociations=tendAssociationValues("spark",sra,"new",sparkAddDrafts[sra]);srp.sparks=srp.sparks||[];srp.sparks.push({id:uid(),text:sri.value.trim(),details:(srx&&srx.value.trim())?srx.value.trim():null,by:(srd&&srd.value)?srd.value:null,time:(srt&&srt.value)?srt.value:null,tod:"anytime",done:false,sharedWith:sparkAssociations.sharedWith.filter(function(id){return id!==sra&&S.people.some(function(person){return person.id===id;});}),areas:sparkAssociations.areas.slice()});delete sparkAddDrafts[sra];delete tendItemAssociationDrafts[tendAssociationKey("spark",sra,"new")];sparkDraftOpenFor=null;save();render();flash("Spark added");}else if(sri){flash("Add a spark first");sri.focus();}return;}
  if(b=t.closest("[data-rhyeditcancel]")){editRhythmId=null;rhythmEditDraft=null;renderPreservingScroll();return;}
  if(b=t.closest("[data-rhyeditsave]")){var key=b.getAttribute("data-rhyeditsave").split("|");var person=S.people.find(function(x){return x.id===key[0];});var rhythm=person&&(person.rhythms||[]).find(function(x){return x.id===key[1];});if(rhythm&&rhythmEditDraft&&rhythmEditDraft.id===rhythm.id){if(!rhythmEditDraft.text.trim()){flash("Give this rhythm a name");return;}Object.assign(rhythm,rhythmEditDraft);delete rhythm.profileOwnerId;rhythm.sharedWith=(rhythm.sharedWith||[]).filter(function(id){return id!==person.id&&S.people.some(function(p){return p.id===id;});});S.events.forEach(function(event){if(event.rhythmId===rhythm.id)event.title=rhythm.text;});editRhythmId=null;rhythmEditDraft=null;save();renderPreservingScroll();flash("Rhythm saved");}return;}
  if(b=t.closest("[data-rhyedit]")){rhythmEditDraft=null;var editKey=b.getAttribute("data-rhyedit").split("|");editRhythmId=(editRhythmId===editKey[1])?null:editKey[1];renderPreservingScroll();var rhythmEditorTitle=document.getElementById("rhythm-editor-title");if(rhythmEditorTitle)rhythmEditorTitle.focus({preventScroll:true});return;}
  if(b=t.closest("[data-rhydel]")){var rl=b.getAttribute("data-rhydel").split("|");if(rl[0]==="faith"&&currentPerson){var sharedFaith=S.rhythms.find(function(item){return item.id===rl[1];});if(sharedFaith)sharedFaith.sharedWith=(sharedFaith.sharedWith||[]).filter(function(id){return id!==currentPerson;});}else{var rp3=S.people.find(function(x){return x.id===rl[0];});if(rp3){if(currentPerson!==rp3.id){var sharedRhythm=(rp3.rhythms||[]).find(function(x){return x.id===rl[1];});if(sharedRhythm)sharedRhythm.sharedWith=(sharedRhythm.sharedWith||[]).filter(function(id){return id!==currentPerson;});}else rp3.rhythms=(rp3.rhythms||[]).filter(function(x){return x.id!==rl[1];});}}editRhythmId=null;rhythmEditDraft=null;save();render();flash("Rhythm removed");return;}
  if(b=t.closest("[data-plandone]")){var log={};try{log=JSON.parse(decodeURIComponent(b.getAttribute("data-plandone")));}catch(err){return;}var tid=b.getAttribute("data-taskid");if(tid){var tk=S.tasks.find(function(x){return x.id===tid;});if(tk)tk.done=true;}logEvent(log.area||"faith",null,log.type||"note",log.title||"","");flash("Done. On to the next.");return;}
  if(b=t.closest("[data-upitem]")){var kd=S.keyDates.find(function(k){return k.id===b.getAttribute("data-upitem");});var cl=S.checklists.find(function(c){return c.linkId===kd.id;});if(cl)showChecklist(cl.id);return;}
  if(b=t.closest("[data-eedit]")){var id=b.getAttribute("data-eedit");editingEvent=S.events.find(function(x){return x.id===id;});if(editingEvent){editingId=id;activityComposerOpen=false;render();}return;}
  if(b=t.closest("[data-task-open]")){taskDraftArea=b.getAttribute("data-task-open");render();var taskInput=document.querySelector('[data-tasknew="'+taskDraftArea+'"]');if(taskInput)taskInput.focus();return;}
  if(b=t.closest("[data-task-cancel]")){taskDraftArea=null;render();return;}
  if(b=t.closest("[data-edel]")){deleteEvent(b.getAttribute("data-edel"));return;}
  if(b=t.closest("[data-taskdel]")){S.tasks=S.tasks.filter(function(x){return x.id!==b.getAttribute("data-taskdel");});save();render();return;}
  if(b=t.closest("[data-taskadd]")){var aid=b.getAttribute("data-taskadd");var inp=document.querySelector('[data-tasknew="'+aid+'"]');if(inp&&inp.value.trim()){S.tasks.push({id:uid(),areaId:aid,text:inp.value.trim(),done:false});taskDraftArea=null;save();render();flash("Task added");}else if(inp){flash("Add a task first");inp.focus();}return;}
  if(b=t.closest("[data-fuedit]")){editingFollowupId=b.getAttribute("data-fuedit");var noteToEdit=S.followups.find(function(x){return x.id===editingFollowupId;});if(noteToEdit)delete tendItemAssociationDrafts[tendAssociationKey("followup",followupAssociationOwner(noteToEdit),noteToEdit.id)];render();return;}
  if(b=t.closest("[data-fucancel]")){var cancelEditor=b.closest("[data-editor-modal]"),cancelSave=cancelEditor&&cancelEditor.querySelector("[data-fusave]"),cancelNote=cancelSave&&S.followups.find(function(x){return x.id===cancelSave.getAttribute("data-fusave");});if(cancelNote)delete tendItemAssociationDrafts[tendAssociationKey("followup",followupAssociationOwner(cancelNote),cancelNote.id)];editingFollowupId=null;render();return;}
  if(b=t.closest("button[data-fudone]")){var followup=S.followups.find(function(x){return x.id===b.getAttribute("data-fudone");});if(followup){followup.done=!followup.done;followup.completedDate=followup.done?todayStr():null;save();render();}return;}
  if(b=t.closest("[data-fudel]")){var deletedFollowup=S.followups.find(function(x){return x.id===b.getAttribute("data-fudel");});if(deletedFollowup)delete tendItemAssociationDrafts[tendAssociationKey("followup",followupAssociationOwner(deletedFollowup),deletedFollowup.id)];S.followups=S.followups.filter(function(x){return x.id!==b.getAttribute("data-fudel");});editingFollowupId=null;save();render();flash("Deleted");return;}
  if(b=t.closest("[data-fusave]")){var f=S.followups.find(function(x){return x.id===b.getAttribute("data-fusave");}),titleField=el("followupEditTitle"),legacyText=el("followupEditText"),text=titleField?titleField.value.trim():legacyText?legacyText.value.trim():"",detailField=el("followupEditDetails"),kindField=b.closest("[data-editor-modal]")&&b.closest("[data-editor-modal]").querySelector("[data-fu-kind]");if(f&&text){f.text=text;f.title=titleField?text:f.title;f.details=detailField?detailField.value.trim():f.details;if(f.kind!=="faith-note"&&kindField)f.kind=kindField.value;tendAssociationCommit("followup",followupAssociationOwner(f),f.id,f);editingFollowupId=null;save();render();flash("Note updated");}else if(f){flash("Add a title first");if(titleField)titleField.focus();else if(legacyText)legacyText.focus();}return;}
  if(b=t.closest("[data-fuadd]")){var pid=b.getAttribute("data-fuadd");var ft=el("personFUNew");if(ft&&ft.value.trim()){S.followups.push({id:uid(),personId:pid,text:ft.value.trim(),done:false,due:null});save();render();}return;}
  if(b=t.closest("[data-pray]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-pray");}),faithScroll=currentArea==="faith"?{x:window.scrollX,y:window.scrollY}:null;if(p)recordPrayer(p,!!p.personId);if(faithScroll)requestAnimationFrame(function(){window.scrollTo(faithScroll.x,faithScroll.y);});return;}
  if(b=t.closest("[data-prayerarchive]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerarchive");});if(p){p.archived=true;p.archivedDate=todayStr();p.answered=false;p.answeredDate=null;save();renderPreservingScroll();}return;}
  if(b=t.closest("[data-prayeredit]")){editingPrayerId=b.getAttribute("data-prayeredit");var editingPrayerRecord=S.prayers.find(function(item){return item.id===editingPrayerId;});if(editingPrayerRecord)delete tendItemAssociationDrafts[tendAssociationKey("prayer",editingPrayerRecord.personId||"global",editingPrayerId)];render();return;}
  if(b=t.closest("[data-prayercancel]")){var cancelledPrayer=S.prayers.find(function(item){return item.id===editingPrayerId;});if(cancelledPrayer)delete tendItemAssociationDrafts[tendAssociationKey("prayer",cancelledPrayer.personId||"global",cancelledPrayer.id)];editingPrayerId=null;render();return;}
  if(b=t.closest("[data-prayerans]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerans");});if(p){p.answered=true;p.archived=false;p.archivedDate=null;p.answeredDate=todayStr();save();renderPreservingScroll();flash("God answered \u2713");}return;}
  if(b=t.closest("[data-prayerunans]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerunans");});if(p){p.answered=false;p.answeredDate=null;p.archived=false;p.archivedDate=null;save();renderPreservingScroll();}return;}
  if(b=t.closest("[data-prayerdel]")){var prayerToRemove=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerdel");});if(prayerToRemove&&currentPerson&&currentPerson!==prayerToRemove.personId){prayerToRemove.sharedWith=(prayerToRemove.sharedWith||[]).filter(function(id){return id!==currentPerson;});}else S.prayers=S.prayers.filter(function(x){return x.id!==b.getAttribute("data-prayerdel");});if(prayerToRemove)delete tendItemAssociationDrafts[tendAssociationKey("prayer",prayerToRemove.personId||"global",prayerToRemove.id)];editingPrayerId=null;window._ppEditId=null;save();render();return;}
  if(b=t.closest("[data-prayerics]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerics");});if(p)downloadICS("Pray: "+p.text);return;}
  if(b=t.closest("[data-echoopen]")){echoDraftOpen=true;render();var echoTitle=el("echoNew");if(echoTitle)echoTitle.focus();return;}
  if(b=t.closest("#echoCancel")){echoDraftOpen=false;render();return;}
  if(b=t.closest("[data-echodel]")){S.echoes=S.echoes.filter(function(x){return x.id!==b.getAttribute("data-echodel");});save();render();return;}
  if(b=t.closest("[data-echoitemopen]")){echoItemDraftId=b.getAttribute("data-echoitemopen");render();var echoInput=document.querySelector('[data-echonew="'+echoItemDraftId+'"]');if(echoInput)echoInput.focus();return;}
  if(b=t.closest("[data-echoitemcancel]")){echoItemDraftId=null;render();return;}
  if(b=t.closest("[data-echoadd]")){var bid=b.getAttribute("data-echoadd");var blk=S.echoes.find(function(x){return x.id===bid;});var inp=document.querySelector('[data-echonew="'+bid+'"]');if(blk&&inp&&inp.value.trim()){blk.items=blk.items||[];blk.items.push({id:uid(),text:inp.value.trim(),status:"to contact"});echoItemDraftId=null;save();render();flash("Outreach item added");}else if(inp){flash("Add a contact or action first");inp.focus();}return;}
  if(b=t.closest("[data-echoitemdel]")){var parts=b.getAttribute("data-echoitemdel").split("|");var blk=S.echoes.find(function(x){return x.id===parts[0];});if(blk){blk.items=blk.items.filter(function(i){return i.id!==parts[1];});save();render();}return;}
  if(b=t.closest("[data-echostatus]")){var parts=b.getAttribute("data-echostatus").split("|");var it=findEchoItem(parts[1]||parts[0]);if(it){var order=["to contact","contacted","met","booked","passed"];it.status=order[(order.indexOf(it.status)+1)%order.length];save();render();}return;}
  if(b=t.closest("[data-ideadel]")){S.ideas=S.ideas.filter(function(x){return x.id!==b.getAttribute("data-ideadel");});save();render();return;}
  if(b=t.closest("[data-ideatask]")){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-ideatask");});if(i&&!i.converted){var area=prompt("Which area? "+AREA_IDS.join(", "),"today");if(area===null)return;area=area.trim().toLowerCase();if(!S.areas[area]){flash("Not an area: "+area);return;}S.tasks.push({id:uid(),areaId:area,text:i.text,done:false});i.converted="task in "+S.areas[area].name;save();render();}return;}
  if(b=t.closest("[data-ideaperson]")){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-ideaperson");});if(i&&!i.converted){var pn=prompt("Save as a note for who? "+S.people.map(function(x){return x.name;}).join(", "));if(pn===null)return;var person=S.people.find(function(x){return x.name.toLowerCase()===pn.trim().toLowerCase();});if(!person){flash("No person named "+pn);return;}S.events.push({id:uid(),ts:Date.now(),areaId:person.area,personId:person.id,kind:"note",type:"note",title:"Encouragement idea",note:i.text,weight:2});i.converted="note on "+person.name;save();render();}return;}
  if(b=t.closest("[data-idealb]")){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-idealb");});if(i){var txt="From my Tend Offload inbox, help me develop this: '"+i.text+"'. Turn it into concrete next steps or a short plan.";if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){flash("Copied - paste into Littlebird");});}else flash("Copy failed");}return;}
  if(b=t.closest("[data-cldel]")){var parts=b.getAttribute("data-cldel").split("|");var cl=S.checklists.find(function(c){return c.id===parts[0];});if(!cl)return;cl.items=cl.items.filter(function(i){return i.id!==parts[1];});save();render();return;}
  if(b=t.closest("[data-clopen]")){checklistDraftId=b.getAttribute("data-clopen");render();var checklistInput=document.querySelector('[data-clnew="'+checklistDraftId+'"]');if(checklistInput)checklistInput.focus();return;}
  if(b=t.closest("[data-clcancel]")){checklistDraftId=null;render();return;}
  if(b=t.closest("[data-cladd]")){var cid=b.getAttribute("data-cladd");var cl=S.checklists.find(function(c){return c.id===cid;});var inp=document.querySelector('[data-clnew="'+cid+'"]');if(cl&&inp&&inp.value.trim()){cl.items.push({id:uid(),text:inp.value.trim(),done:false});checklistDraftId=null;save();render();flash("Checklist item added");}else if(inp){flash("Add an item first");inp.focus();}return;}
  if(b=t.closest("[data-plog]")){var p=S.people.find(function(x){return x.id===currentPerson;});
   if(p){var dv=el("momentDate")?el("momentDate").value:"";var tv=el("momentTime")?el("momentTime").value:"";var nv=el("momentNote")?el("momentNote").value.trim():"";var tsN=new Date((dv||todayStr())+"T"+(tv||"12:00")+":00").getTime();var k=b.getAttribute("data-plog");
    window._rippleModalOpen=false;var editingRipple=editingConn;editingConn=null;
    if(editingRipple){updateEvent(editingRipple,{kind:k,type:k,ts:tsN,note:nv,title:"Time with "+p.name});editingConn=null;}
    else{logEvent(p.area,currentPerson,k,"Time with "+p.name,nv,tsN);flash("Connection logged \u2713");}}
   return;}
  if(b=t.closest("[data-plogother]")){var p2=S.people.find(function(x){return x.id===currentPerson;});
   if(p2){var custom=prompt("What kind of moment? (e.g. Golf, Movie, Project together)");if(!custom)return;
    var dv2=el("momentDate")?el("momentDate").value:"";var tv2=el("momentTime")?el("momentTime").value:"";var nv2=el("momentNote")?el("momentNote").value.trim():"";var ts2N=new Date((dv2||todayStr())+"T"+(tv2||"12:00")+":00").getTime();
    window._rippleModalOpen=false;var editingRipple=editingConn;editingConn=null;
    if(editingRipple){updateEvent(editingRipple,{kind:custom,type:"",ts:ts2N,note:nv2,title:"Time with "+p2.name});editingConn=null;}
    else{logEvent(p2.area,currentPerson,custom,"Time with "+p2.name,nv2,ts2N);flash("Connection logged \u2713");}}
   return;}
  if(b=t.closest("[data-evedit]")){var ev=S.events.find(function(z){return z.id===b.getAttribute("data-evedit");});
   if(ev){editingConn=ev.id;window._rippleModalOpen=true;renderPreservingScroll();var connectionField=el("momentDate")||el("plogType");if(connectionField)connectionField.focus({preventScroll:true});}return;}
  if(b=t.closest("[data-connectionundo]")){undoConnectionEvent(b.getAttribute("data-connectionundo"));return;}
  if(b=t.closest("[data-evdel]")){deleteEvent(b.getAttribute("data-evdel"),true);return;}
  if(b=t.closest("[data-kddel]")){S.keyDates=S.keyDates.filter(function(k){return k.id!==b.getAttribute("data-kddel");});save();render();return;}
  if(b=t.closest("[data-kdadd]")){var pid=b.getAttribute("data-kdadd");var inp=document.querySelector('[data-kdlabel="'+pid+'"]');if(inp&&inp.value.trim()){S.keyDates.push({id:uid(),personId:pid,label:inp.value.trim(),month:1,day:1});save();render();flash("Added - tell Littlebird the date to set it precisely");}return;}
  if(b=t.closest("[data-activity-open]")){activityComposerOpen=true;render();var activityTitle=el("logTitle");if(activityTitle)activityTitle.focus();return;}
  if(b=t.closest("#logSubmit")){var dv=el("logDate").value;var ts=dv?new Date(dv+"T12:00:00").getTime():Date.now();var title=el("logTitle").value.trim();var talk=el("logTalk").value.trim();var person=el("logPersonSel").value||null;var type=el("logTypeSel").value;if(editingId){var eventId=editingId,patch={ts:ts,personId:person,type:type,kind:type,title:title,note:talk};if(editingEvent&&editingEvent.rippleLabel&&RIPPLE_TYPES[type])patch.rippleLabel=RIPPLE_TYPES[type];editingId=null;editingEvent=null;activityComposerOpen=false;updateEvent(eventId,patch);}else{activityComposerOpen=false;logEvent(currentArea,person,type,title,talk,ts,null);}return;}
  if(b=t.closest("#logCancel")){editingId=null;editingEvent=null;activityComposerOpen=false;render();return;}
  if(b=t.closest("#saveDayBlocks")){var blocks=DEFAULT_DAY_BLOCKS.map(function(block){return {id:block.id,name:document.querySelector('[data-block-name="'+block.id+'"]').value.trim(),start:document.querySelector('[data-block-start="'+block.id+'"]').value};});var error=validateDayBlocks(blocks);if(error){el("dayBlocksError").textContent=error;return;}S.settings=S.settings||{};S.settings.dayBlocks=blocks;save();render();flash("Time sections saved");return;}
  if(b=t.closest("#setSave")){S.settings.greenAt=clamp(+el("setGreen").value||80,50,100);S.settings.yellowAt=clamp(+el("setYellow").value||50,10,80);S.settings.baseline=clamp(+el("setBase").value||50,0,100);save();render();flash("Thresholds saved");return;}
  if(b=t.closest("[data-calrefresh]")){if(window._calLoading)return;b.disabled=true;b.textContent="Refreshing calendar…";localStorage.removeItem("tend:cal2");window._calLoading=false;if(window.SYNCcfg&&SYNCcfg.token&&typeof window.refreshCalendarNow==="function")window.refreshCalendarNow();loadCalendars(true);return;}
  if(b=t.closest("[data-calretry]")){localStorage.removeItem("tend:cal2");window._calLoading=false;loadCalendars(true);return;}
  if(b=t.closest("#calAdd")){S.calendars.push({id:uid(),name:"New calendar",url:"",color:"#4C9AFF"});save();render();return;}
  if(b=t.closest("#calSaveAll")){document.querySelectorAll("[data-calrow]").forEach(function(row){var id=row.getAttribute("data-calrow");var c=S.calendars.find(function(x){return x.id===id;});if(!c)return;c.name=row.querySelector("[data-calname]").value;c.url=row.querySelector("[data-calurl]").value.trim();c.color=row.querySelector("[data-calcolor]").value;});save();localStorage.removeItem("tend:cal2");if(window.TEND_LOAD_CALENDAR)TEND_LOAD_CALENDAR();render();flash("Calendars saved");return;}
  if(b=t.closest("[data-caldel]")){S.calendars=S.calendars.filter(function(x){return x.id!==b.getAttribute("data-caldel");});save();localStorage.removeItem("tend:cal2");render();return;}
  if(b=t.closest("#syncSave")){SYNCcfg.owner=el("syncOwner").value.trim();SYNCcfg.repo=el("syncRepo").value.trim();SYNCcfg.token=el("syncToken").value.trim();localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();flash("Sync settings saved");render();return;}
  if(b=t.closest("#syncPull")){pullNow(true);return;}
  if(b=t.closest("#syncPush")){pushNow();return;}
  if(b=t.closest("#syncExport")){var blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tend-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();return;}
  if(b=t.closest("#prayerFormOpen")){prayerFormOpen=true;render();return;}
  if(b=t.closest("#prayerFormCancel")){prayerFormOpen=false;render();return;}
  if(b=t.closest("#prayerAdd")){var nt=el("prayerNew");if(nt&&nt.value.trim()){S.prayers.push({id:uid(),category:el("prayerCat").value,personId:el("prayerPerson").value||null,text:nt.value.trim(),details:el("prayerDetails").value.trim(),freq:el("prayerNewFreq").value==="none"?null:el("prayerNewFreq").value,tod:el("prayerNewTod").value,scheduleDow:scheduleHasWeekday(el("prayerNewFreq").value)&&el("prayerNewDow").value!==""?+el("prayerNewDow").value:null,added:new Date().toISOString().slice(0,10),answered:false,prayed:0});prayerFormOpen=false;save();render();flash("Prayer added");}else flash("Give the prayer a title first");return;}
  if(b=t.closest("#echoAdd")){var nt=el("echoNew");if(nt&&nt.value.trim()){S.echoes.push({id:uid(),title:nt.value.trim(),note:"",items:[]});echoDraftOpen=false;save();render();flash("Echoblock added");}else if(nt){flash("Add a block name first");nt.focus();}return;}
  if(b=t.closest("#ideaAdd")){var nt=el("ideaNew");if(nt&&nt.value.trim()){S.ideas.push({id:uid(),text:nt.value.trim(),ts:Date.now(),done:false,converted:null});ideaDraftOpen=false;save();render();flash("Added to Offload");}else if(nt){flash("Add an idea first");nt.focus();}return;}
  if(b=t.closest("[data-ideaopen]")){ideaDraftOpen=true;render();var ideaField=el("ideaNew");if(ideaField)ideaField.focus();return;}
  if(b=t.closest("[data-ideacancel]")){ideaDraftOpen=false;render();return;}
  if(b=t.closest("#introOk")){try{localStorage.setItem("tend:introSeen","1");}catch(err){}render();return;}
  if(b=t.closest("[data-dosugg]")){var parts=b.getAttribute("data-dosugg").split("|");logEvent(parts[1],parts[2]||null,parts[3],parts[0]);flash("Logged. Well tended.");return;}
 });
 document.addEventListener("change",function(e){
  var t=e.target;
  if(t.matches('[data-holiday]')){S.settings=S.settings||{};S.settings.holidays=S.settings.holidays||{};S.settings.holidays[t.getAttribute('data-holiday')]=t.checked;save();return;}
  if(t.id==="plogType"){var por=el("plogOtherRow");if(por)por.style.display=(t.value==="other")?"flex":"none";return;}
  if(t.id==="momentAllDay"){var pmt=el("momentTime");if(pmt){pmt.disabled=t.checked;if(t.checked)pmt.value="";}return;}
  if(t.matches("[data-task]")){var x=S.tasks.find(function(z){return z.id===t.getAttribute("data-task");});if(x){x.done=t.checked;save();render();}}
  else if(t.matches("[data-clitem]")){var parts=t.getAttribute("data-clitem").split("|");var cl=S.checklists.find(function(c){return c.id===parts[0];});if(!cl)return;var it=cl.items.find(function(i){return i.id===parts[1];});if(it){it.done=t.checked;save();render();}}
  else if(t.matches("input[data-fudone]")){var f=S.followups.find(function(z){return z.id===t.getAttribute("data-fudone");});if(f){f.done=t.checked;f.completedDate=f.done?todayStr():null;save();render();}}
  else if(t.matches("[data-praymark]")){var p=S.prayers.find(function(z){return z.id===t.getAttribute("data-praymark");});if(p){p.prayed=(p.prayed||0)+1;p.lastPrayed=new Date().toISOString().slice(0,10);save();render();flash("Prayed \u2713");}}
  else if(t.matches("[data-pphoto]")){var pfE=t.getAttribute("data-pphoto");var pfP=S.people.find(function(x){return x.id===pfE;});var pfF=t.files&&t.files[0];if(pfP&&pfF){var prd=new FileReader();prd.onload=function(){var pim=new Image();pim.onload=function(){var pcv=document.createElement("canvas");var psz=144;pcv.width=psz;pcv.height=psz;var pcx=pcv.getContext("2d");var pw=pim.width,ph=pim.height,pdim=Math.min(pw,ph);pcx.drawImage(pim,(pw-pdim)/2,(ph-pdim)/2,pdim,pdim,0,0,psz,psz);pfP.photo=pcv.toDataURL("image/jpeg",.82);save();render();flash("Photo saved");};pim.src=prd.result;};prd.readAsDataURL(pfF);}return;}
  else if(t.matches("[data-pfield]")){if(t.type==="date")return;var pf=t.getAttribute("data-pfield");var pp=S.people.find(function(x){return x.id===t.getAttribute("data-pid");});if(pp){if(!(pf==="relation"&&t.value==="__custom"))pp[pf]=t.value;save();render();flash("Saved");}}
  else if(t.matches("[data-rfield]")){var rf=t.getAttribute("data-rfield").split("|");var rr4=null;
   if(rf[1]==="draft"){if(rhythmDraft&&rhythmDraft.pid===rf[0])rr4=rhythmDraft;}
   else if(rhythmEditDraft&&rhythmEditDraft.id===rf[1]&&editRhythmId===rf[1])rr4=rhythmEditDraft;
   if(rr4){var fld=rf[2];if(fld==="text"){rr4.text=t.value;return;}if(fld==="scheduleDow")rr4[fld]=t.value===""?null:+t.value;else if(fld==="customDow"||fld==="customOrd"||fld==="durVal")rr4[fld]=+t.value||0;else rr4[fld]=t.value;if(fld==="freq"&&!scheduleHasWeekday(t.value))rr4.scheduleDow=null;if(fld==="durUnit"){var mx=DUR_UNITS[rr4.durUnit]?DUR_UNITS[rr4.durUnit].max:120;if(!(rr4.durVal>=1&&rr4.durVal<=mx))rr4.durVal=0;}render();}}
 });
 // Date segments emit change while the year is still being typed. Commit on blur
 // without rebuilding the profile, preserving focus and the open settings panel.
 document.addEventListener("focusout",function(e){
  var t=e.target;
  if(!t.matches('input[type="date"][data-pfield]')||!t.validity.valid)return;
  var person=S.people.find(function(p){return p.id===t.getAttribute("data-pid");});
  var field=t.getAttribute("data-pfield");
  if(person&&person[field]!==t.value){person[field]=t.value;save();flash("Saved");}
 });
 document.addEventListener("input",function(e){
  var t=e.target;
  if(t.matches("[data-block-start]")){var index=DEFAULT_DAY_BLOCKS.findIndex(function(b){return b.id===t.getAttribute("data-block-start");});var previous=(index+6)%7;var end=document.querySelector('[data-block-end="'+DEFAULT_DAY_BLOCKS[previous].id+'"]');if(end)end.textContent=Number.isFinite(dayTimeMinutes(t.value))?dayTimeLabel(t.value)+(previous===6?' (next day)':''):'—';return;}

  if(t.matches("[data-encnote]"))saveEncNote(t.getAttribute("data-encnote"),t);
  else if(t.matches("[data-phpray]"))savePersonNote(t.getAttribute("data-pid"),"howToPray",t);
  else if(t.matches("[data-pfocus]"))savePersonNote(t.getAttribute("data-pid"),"prayerFocus",t);
  else if(t.matches("[data-rfield]")){var rf5=t.getAttribute("data-rfield").split("|");if(rf5[2]==="text"&&rhythmEditDraft&&rhythmEditDraft.id===rf5[1]&&editRhythmId===rf5[1])rhythmEditDraft.text=t.value;if(rf5[2]==="text"&&rf5[1]==="draft"&&rhythmDraft&&rhythmDraft.pid===rf5[0]){rhythmDraft.text=t.value;var _b5=document.querySelector('[data-rhyadd="'+rf5[0]+'"]');if(_b5)_b5.textContent=(t.value&&t.value.trim())?"Save Rhythm":"+ Add rhythm";}}
 });
}





/* one-time migration: legacy howToPray textarea -> prayernote checklist item (v20260930u) */
(function(){var ch=false;S.people.forEach(function(p){var t=String(p.howToPray||"").trim();if(t&&!p.prayerNotesMigrated&&!S.followups.some(function(f){return f.personId===p.id&&(f.kind||"followup")==="prayernote";})) {p.prayerNotesMigrated=true;S.followups.push({id:uid(),personId:p.id,kind:"prayernote",text:t,done:false,ts:Date.now()});p.howToPray="";ch=true;}});if(ch)save();})();

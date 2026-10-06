


"use strict";
/* ============ actions & bindings ============ */
function logEvent(areaId,personId,type,title,note,whenTs,rhythmId,extra){var _ev={id:uid(),ts:(whenTs||Date.now()),areaId:areaId,personId:personId||null,type:type||"inperson",kind:type||"inperson",title:title||"",note:note||"",rhythmId:rhythmId||null,weight:(ETYPES[type]?ETYPES[type].w:3)};if(extra)for(var _k in extra)_ev[_k]=extra[_k];S.events.push(_ev);save();render();}
function recordPrayer(prayer,logForPerson){
 if(!prayer||prayer.answered||prayer.archived)return false;
 var prayedAt=Date.now();
 prayer.prayed=(prayer.prayed||0)+1;prayer.lastPrayed=todayStr();prayer.prayerLogs=prayer.prayerLogs||[];prayer.prayerLogs.push(prayedAt);
 var person=logForPerson&&prayer.personId&&S.people.find(function(item){return item.id===prayer.personId;});
 if(person){
  if(typeof actDoneAdd==="function")actDoneAdd(person.id,prayer.id);
  logEvent(person.area,person.id,"prayer",prayer.text||"Prayer",prayer.details||"",prayedAt,null,{prayerId:prayer.id});
 }else{save();render();}
 flash(logForPerson?"Prayed \u2713":"Prayer recorded");
 return true;
}
document.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("[data-meter-tab]")){e.preventDefault();e.target.click();}});
function deleteEvent(id){S.events=S.events.filter(function(e){return e.id!==id;});if(editingId===id){editingId=null;editingEvent=null;activityComposerOpen=false;}if(editingConn===id){editingConn=null;window._rippleModalOpen=false;}save();render();flash("Entry deleted");}
function updateEvent(id,patch){var e=S.events.find(function(x){return x.id===id;});if(e){Object.keys(patch).forEach(function(k){e[k]=patch[k];});e.weight=(ETYPES[e.type]?ETYPES[e.type].w:3);save();render();flash("Entry updated");}}
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
 dialog.showModal();
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
  logEvent(draft.areaId||person.area,person.id,(rhythm.category==="prayer"||/^pray/i.test(rhythm.text||""))?"prayer":"quality",rhythm.text,"",timestamp,rhythm.id);
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
function openPersonTab(pid){tab="people";currentArea=null;currentPerson=pid;openDetail=null;render();}
function downloadICS(title){var d=new Date();d.setDate(d.getDate()+1);d.setHours(7,0,0,0);function st(dt){return dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0")+"T"+String(dt.getUTCHours()).padStart(2,"0")+String(dt.getUTCMinutes()).padStart(2,"0")+"00Z";}var end=new Date(d.getTime()+15*60000);var ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Tend//EN","BEGIN:VEVENT","UID:"+uid()+"@tend","DTSTAMP:"+st(new Date()),"DTSTART:"+st(d),"DTEND:"+st(end),"SUMMARY:"+title.replace(/[,;]/g,""),"DESCRIPTION:From Tend","END:VEVENT","END:VCALENDAR"].join("\r\n");var blob=new Blob([ics],{type:"text/calendar"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tend-reminder.ics";a.click();flash("Reminder file downloaded");}
function saveEncNote(pid,ta){var p=S.people.find(function(x){return x.id===pid;});if(p){p.encouragementNote=ta.value;save();var h=document.querySelector('[data-enchint="'+pid+'"]');if(h){h.classList.add("show");setTimeout(function(){h.classList.remove("show");},900);}}}
function savePersonNote(pid,field,ta){var p=S.people.find(function(x){return x.id===pid;});if(p){p[field]=ta.value;save();var h=document.getElementById("prayerSaveHint");if(h){h.classList.add("show");clearTimeout(savePersonNote._t);savePersonNote._t=setTimeout(function(){h.classList.remove("show");},900);}}}

function bind(){
 if(window._tendDelegated)return;
 window._tendDelegated=true;
 document.addEventListener("input",function(e){if(e.target&&/^set(Green|Yellow|Base)$/.test(e.target.id)&&typeof updateMeterThresholdPreview==="function")updateMeterThresholdPreview();});
 document.addEventListener("toggle",function(e){var t=e.target;if(t.matches&&t.matches("[data-plan-block]"))planOpenState[t.getAttribute("data-plan-block")]=t.open;},true);
 document.addEventListener("cancel",function(e){
  if(e.target.id==="rippleDialog"){window._rippleModalOpen=false;editingConn=null;return;}
  if(e.target.matches&&e.target.matches("dialog[data-profile-editor]")){
   e.preventDefault();var editor=e.target.getAttribute("data-profile-editor");
   if(editor==="rhythm")rhythmDraft=null;
   else if(editor==="spark")sparkDraftOpenFor=null;
   else if(editor==="prayer")window._personPrayerDraftFor=null;
   else if(editor==="note")noteDraftOpenFor=null;
   render();
  }
 },true);
 document.addEventListener("click",function(e){
  var t=e.target,b;
  if(b=t.closest('[data-settingstab]')){settingsTab=b.getAttribute('data-settingstab');document.querySelectorAll('[data-settingstab]').forEach(function(x){x.setAttribute('aria-selected',String(x.getAttribute('data-settingstab')===settingsTab));});document.querySelectorAll('.settings-panel').forEach(function(x){x.hidden=x.id!=='settings-panel-'+settingsTab;});return;}
  if(b=t.closest("[data-rhyhistory]")){openRhythmHistory(b.getAttribute("data-rhyhistory"));return;}
  if(b=t.closest("[data-profilenoteopen]")){noteDraftOpenFor=b.getAttribute("data-profilenoteopen");render();var noteField=el("profileNoteText");if(noteField)noteField.focus();return;}
  if(b=t.closest("[data-profilenotecancel]")){noteDraftOpenFor=null;render();return;}
  if(b=t.closest("[data-profilenotesave]")){var noteTitle=el("profileNoteTitle"),noteDetails=el("profileNoteDetails"),noteKind=el("profileNoteKind");if(noteTitle&&noteTitle.value.trim()){var title=noteTitle.value.trim();S.followups.push({id:uid(),personId:b.getAttribute("data-profilenotesave"),kind:noteKind?noteKind.value:"general",title:title,text:title,details:noteDetails?noteDetails.value.trim():"",done:false});noteDraftOpenFor=null;save();render();flash("Note added");}else if(noteTitle){flash("Add a title first");noteTitle.focus();}return;}
  if(b=t.closest("[data-prayernoteopen]")){prayerNoteDraftOpenFor=b.getAttribute("data-prayernoteopen");render();var prayerNoteInput=el("noteNew-prayernote");if(prayerNoteInput)prayerNoteInput.focus();return;}
  if(b=t.closest("[data-prayernotecancel]")){prayerNoteDraftOpenFor=null;render();return;}
  if(b=t.closest("[data-noteadd]")){var noteKind=b.getAttribute("data-notekind"),noteInput=el("noteNew-"+noteKind);if(noteInput&&noteInput.value.trim()){S.followups.push({id:uid(),personId:b.getAttribute("data-noteadd"),kind:noteKind,text:noteInput.value.trim(),done:false});prayerNoteDraftOpenFor=null;save();render();flash("Prayer note added");}else if(noteInput){flash("Add a note first");noteInput.focus();}return;}
  if(b=t.closest("[data-personprayeropen]")){window._personPrayerDraftFor=b.getAttribute("data-personprayeropen");render();var field=document.querySelector('[data-prayer-editor="new-person"] [data-prayer-field="title"]');if(field)field.focus();return;}
  if(b=t.closest("[data-personprayercancel]")){window._personPrayerDraftFor=null;render();return;}
  if(b=t.closest("[data-personprayeradd]")){var person=S.people.find(function(p){return p.id===b.getAttribute("data-personprayeradd");});var title=el("personPrayerTitle").value.trim();if(person&&title){var categories={marriage:"Marriage",parenting:"Kids",friendships:"Friends"};var freq=el("personPrayerFreq").value;S.prayers.push({id:uid(),personId:person.id,category:categories[person.area]||"Family",text:title,details:el("personPrayerDetails").value.trim(),freq:freq==="none"?null:freq,tod:el("personPrayerTod").value,scheduleDow:scheduleHasWeekday(freq)&&el("personPrayerDow").value!==""?+el("personPrayerDow").value:null,added:todayStr(),answered:false,archived:false,prayed:0});window._personPrayerDraftFor=null;save();render();flash("Prayer added");}else flash("Add a prayer title");return;}
  if(b=t.closest("[data-meter-tab],[data-profiletab]")){var selected=b.getAttribute("data-meter-tab")||b.getAttribute("data-profiletab");profileTabs[currentPerson]=selected;document.querySelectorAll('[data-profiletab]').forEach(function(button){button.setAttribute('aria-selected',String(button.getAttribute('data-profiletab')===selected));});document.querySelectorAll('.profile-tab-panel').forEach(function(panel){panel.hidden=panel.id!=="profile-panel-"+selected;});if(b.hasAttribute('data-meter-tab')){var target=el("profile-tab-"+selected);if(target){target.focus({preventScroll:true});target.scrollIntoView({behavior:"smooth",block:"start"});}}return;}
  if(b=t.closest("[data-rippleidea]")){var pid=b.getAttribute("data-rippleidea");rippleIdeaOffsets[pid]=(rippleIdeaOffsets[pid]||0)+1;var person=S.people.find(function(p){return p.id===pid;});if(person)el("rippleIdea").textContent=rippleIdea(person);return;}
  if(b=t.closest("[data-rippleopen]")){window._rippleModalOpen=true;render();var rippleType=el("plogType");if(rippleType)rippleType.focus();return;}
  if(b=t.closest("[data-planview]")){var pv=b.getAttribute("data-planview");planViewState=(planViewState===pv)?null:pv;render();return;}
  if(b=t.closest("[data-areanav]")){currentArea=b.getAttribute("data-areanav");if(currentArea==="faith")faithConfig().selectedGroup="Sabbath";openDetail=null;editingId=null;editingEvent=null;activityComposerOpen=false;taskDraftArea=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-utilnav]")){tab=b.getAttribute("data-utilnav");window._psModalOpen=false;window._personPrayerDraftFor=null;currentArea=null;openDetail=null;editingId=null;editingEvent=null;activityComposerOpen=false;taskDraftArea=null;currentPerson=null;editingConn=null;editRhythmId=null;rhythmEditDraft=null;editSparkId=null;sparkEditDraft=null;sparkDraftOpenFor=null;noteDraftOpenFor=null;prayerNoteDraftOpenFor=null;rhythmDraft=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-areago]")){currentArea=b.getAttribute("data-areago");if(currentArea==="faith")faithConfig().selectedGroup="Sabbath";openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-personrhythms]")){var pid=b.getAttribute("data-personrhythms");profileTabs[pid]="rhythms";currentArea=null;openPersonTab(pid);var target=el("profile-tab-rhythms");if(target){target.focus({preventScroll:true});target.scrollIntoView({behavior:"smooth",block:"start"});}return;}
  if(b=t.closest("[data-openperson]")){openPersonTab(b.getAttribute("data-openperson"));return;}
  if(b=t.closest("[data-closeperson]")){currentPerson=null;window._psModalOpen=false;window._personPrayerDraftFor=null;editingConn=null;editRhythmId=null;rhythmEditDraft=null;editSparkId=null;sparkEditDraft=null;sparkDraftOpenFor=null;noteDraftOpenFor=null;prayerNoteDraftOpenFor=null;personKeyDateDraftFor=null;rhythmDraft=null;render();return;}
  if(b=t.closest("[data-personkeydateopen]")){personKeyDateDraftFor=b.getAttribute("data-personkeydateopen");render();var keyDateInput=document.querySelector('[data-kdlabel="'+personKeyDateDraftFor+'"]');if(keyDateInput)keyDateInput.focus();return;}
  if(b=t.closest("[data-personkeydatecancel]")){personKeyDateDraftFor=null;render();return;}
  if(b=t.closest("[data-psettings]")){window._psModalOpen=true;render();return;}
  if(b=t.closest("[data-psettingsclose]")){window._psModalOpen=false;render();return;}
  if(b=t.closest("[data-prayquick]")){var pqP=S.people.find(function(x){return x.id===b.getAttribute("data-prayquick");});if(pqP){var pqRef=b.getAttribute("data-prayref");var pqPr=(pqRef&&pqRef!=="focus")?S.prayers.find(function(x){return x.id===pqRef;}):null;if(pqPr)recordPrayer(pqPr,true);else{logEvent(pqP.area,pqP.id,"prayer","Prayer focus",pqP.prayerFocus||"",Date.now(),null,{});actDoneAdd(pqP.id,pqRef||"focus");render();flash("Prayed \u2713");}}return;}
  if(b=t.closest("[data-rhycancel]")){rhythmDraft=null;render();return;}
  if(b=t.closest("[data-rhyadd]")){var ra=b.getAttribute("data-rhyadd");
   if(rhythmDraft&&rhythmDraft.pid===ra&&rhythmDraft.text&&rhythmDraft.text.trim()){
    var rp2=S.people.find(function(x){return x.id===ra;});
    if(rp2){var nc={id:uid(),text:rhythmDraft.text.trim(),category:rhythmDraft.category||"connection",freq:rhythmDraft.freq||"weekly",tod:rhythmDraft.tod||"anytime",scheduleDow:scheduleHasWeekday(rhythmDraft.freq)?rhythmDraft.scheduleDow:null};
     if(nc.freq==="custom"){nc.customType=rhythmDraft.customType||"weekly";nc.customDow=rhythmDraft.customDow||0;nc.customOrd=rhythmDraft.customOrd||1;}
     if(rhythmDraft.durVal>=1){nc.durUnit=rhythmDraft.durUnit||"min";nc.durVal=rhythmDraft.durVal;}
     rp2.rhythms=rp2.rhythms||[];rp2.rhythms.push(nc);rhythmDraft=null;save();render();flash("Rhythm added");}
   }else if(rhythmDraft&&rhythmDraft.pid===ra){flash("Give the rhythm a name first");}
   else{rhythmDraft={pid:ra,text:"",category:"connection",freq:"weekly",tod:"anytime",durUnit:"min",durVal:0};render();}
   return;}
  if(b=t.closest("[data-sparkdo]")){var spd=b.getAttribute("data-sparkdo").split("|");var spp=S.people.find(function(x){return x.id===spd[0];});var ss=spp&&(spp.sparks||[]).find(function(x){return x.id===spd[1];});if(ss){ss.done=true;ss.doneTs=Date.now();actDoneAdd(spp.id,ss.id);logEvent(spp.area,spp.id,"quality",ss.text,"Spark landed",Date.now(),null,{origin:"spark"});flash("Spark landed - connection logged");}return;}
  if(b=t.closest("[data-sparkaddopen]")){sparkDraftOpenFor=b.getAttribute("data-sparkaddopen");render();var sparkTitle=document.querySelector('[data-spnewtext="'+sparkDraftOpenFor+'"]');if(sparkTitle)sparkTitle.focus();return;}
  if(b=t.closest("[data-sparkaddcancel]")){sparkDraftOpenFor=null;render();return;}
  if(b=t.closest("[data-sedit]")){var sei=b.getAttribute("data-sedit"),spark=findSparkById(sei);editSparkId=sei;sparkEditDraft=spark?JSON.parse(JSON.stringify(spark)):null;render();return;}
  if(b=t.closest("[data-sparkeditcancel]")){editSparkId=null;sparkEditDraft=null;render();return;}
  if(b=t.closest("[data-sparkeditsave]")){var draftId=b.getAttribute("data-sparkeditsave"),draftDialog=b.closest("dialog"),sparkTitle=draftDialog&&draftDialog.querySelector('[data-sfield="text"]'),sparkDate=draftDialog&&draftDialog.querySelector('[data-sfield="by"]'),sparkTime=draftDialog&&draftDialog.querySelector('[data-sfield="time"]'),savedSpark=findSparkById(draftId);if(savedSpark&&sparkTitle&&sparkTitle.value.trim()){savedSpark.text=sparkTitle.value.trim();savedSpark.by=sparkDate&&sparkDate.value?sparkDate.value:null;savedSpark.time=savedSpark.by&&sparkTime&&sparkTime.value?sparkTime.value:null;editSparkId=null;sparkEditDraft=null;save();render();flash("Spark updated");}else if(sparkTitle){flash("Add a spark idea first");sparkTitle.focus();}return;}
  if(b=t.closest("[data-scleardate]")){var sparkDateField=b.closest("dialog")&&b.closest("dialog").querySelector('[data-sfield="by"]'),sparkTimeField=b.closest("dialog")&&b.closest("dialog").querySelector('[data-sfield="time"]');if(sparkDateField)sparkDateField.value="";if(sparkTimeField)sparkTimeField.value="";return;}
  if(b=t.closest("[data-pphorm]")){var prp=S.people.find(function(x){return x.id===b.getAttribute("data-pphorm");});if(prp){prp.photo=null;save();render();flash("Photo removed");}return;}
  if(b=t.closest("[data-psubmit]")){var psp=S.people.find(function(x){return x.id===b.getAttribute("data-psubmit");});
   if(psp){var pk=el("plogType")?el("plogType").value:"quality";var rippleLabel=RIPPLE_TYPES[pk];if(pk==="other"){pk=(el("plogOther")&&el("plogOther").value.trim())||"other";rippleLabel=pk==="other"?"Other":pk;}
    var pAll=el("momentAllDay")?el("momentAllDay").checked:false;
    var pDv=(el("momentDate")&&el("momentDate").value)||todayStr();var pTv=(!pAll&&el("momentTime")&&el("momentTime").value)?el("momentTime").value:"12:00";
    var pTs=new Date(pDv+"T"+pTv+":00").getTime();
    var pTtl=el("momentTitle")?el("momentTitle").value.trim():"";var pNt=el("momentNote")?el("momentNote").value.trim():"";
    var pTitle=pTtl||("Time with "+psp.name);
    window._rippleModalOpen=false;var editingRipple=editingConn;editingConn=null;
    if(editingRipple){updateEvent(editingRipple,{kind:pk,type:(ETYPES[pk]?pk:""),ts:pTs,title:pTitle,note:pNt,allDay:pAll,rippleLabel:rippleLabel});editingConn=null;flash("Connection updated \u2713");}
    else{logEvent(psp.area,psp.id,pk,pTitle,pNt,pTs,null,{allDay:pAll,rippleLabel:rippleLabel});flash("Connection logged \u2713");}}
   return;}
  if(b=t.closest("[data-peditcancel]")){window._rippleModalOpen=false;editingConn=null;render();return;}
  if(b=t.closest("[data-spdel]")){var sdd=b.getAttribute("data-spdel").split("|");var sdp=S.people.find(function(x){return x.id===sdd[0];});if(sdp){sdp.sparks=(sdp.sparks||[]).filter(function(x){return x.id!==sdd[1];});editSparkId=null;sparkEditDraft=null;save();render();flash("Spark deleted");}return;}
  if(b=t.closest("[data-spadd]")){var sra=b.getAttribute("data-spadd");var srp=S.people.find(function(x){return x.id===sra;});var sri=document.querySelector('[data-spnewtext="'+sra+'"]');var srd=document.querySelector('[data-spnewdate="'+sra+'"]');var srt=document.querySelector('[data-spnewtime="'+sra+'"]');if(srp&&sri&&sri.value.trim()){srp.sparks=srp.sparks||[];srp.sparks.push({id:uid(),text:sri.value.trim(),by:(srd&&srd.value)?srd.value:null,time:(srt&&srt.value)?srt.value:null,tod:"anytime",done:false});sparkDraftOpenFor=null;save();render();flash("Spark added");}else if(sri){flash("Add a spark idea first");sri.focus();}return;}
  if(b=t.closest("[data-rhyeditcancel]")){editRhythmId=null;rhythmEditDraft=null;render();return;}
  if(b=t.closest("[data-rhyeditsave]")){var key=b.getAttribute("data-rhyeditsave").split("|");var person=S.people.find(function(x){return x.id===key[0];});var rhythm=person&&(person.rhythms||[]).find(function(x){return x.id===key[1];});if(rhythm&&rhythmEditDraft&&rhythmEditDraft.id===rhythm.id){if(!rhythmEditDraft.text.trim()){flash("Give this rhythm a name");return;}Object.assign(rhythm,rhythmEditDraft);editRhythmId=null;rhythmEditDraft=null;save();render();flash("Rhythm saved");}return;}
  if(b=t.closest("[data-rhyedit]")){rhythmEditDraft=null;editRhythmId=(editRhythmId===b.getAttribute("data-rhyedit"))?null:b.getAttribute("data-rhyedit");render();return;}
  if(b=t.closest("[data-rhydel]")){var rl=b.getAttribute("data-rhydel").split("|");var rp3=S.people.find(function(x){return x.id===rl[0];});if(rp3){rp3.rhythms=(rp3.rhythms||[]).filter(function(x){return x.id!==rl[1];});editRhythmId=null;rhythmEditDraft=null;save();render();flash("Rhythm removed");}return;}
  if(b=t.closest("[data-plandone]")){var log={};try{log=JSON.parse(decodeURIComponent(b.getAttribute("data-plandone")));}catch(err){return;}var tid=b.getAttribute("data-taskid");if(tid){var tk=S.tasks.find(function(x){return x.id===tid;});if(tk)tk.done=true;}logEvent(log.area||"faith",null,log.type||"note",log.title||"","");flash("Done. On to the next.");return;}
  if(b=t.closest("[data-upitem]")){var kd=S.keyDates.find(function(k){return k.id===b.getAttribute("data-upitem");});var cl=S.checklists.find(function(c){return c.linkId===kd.id;});if(cl)showChecklist(cl.id);return;}
  if(b=t.closest("[data-eedit]")){var id=b.getAttribute("data-eedit");editingEvent=S.events.find(function(x){return x.id===id;});if(editingEvent){editingId=id;activityComposerOpen=false;render();}return;}
  if(b=t.closest("[data-task-open]")){taskDraftArea=b.getAttribute("data-task-open");render();var taskInput=document.querySelector('[data-tasknew="'+taskDraftArea+'"]');if(taskInput)taskInput.focus();return;}
  if(b=t.closest("[data-task-cancel]")){taskDraftArea=null;render();return;}
  if(b=t.closest("[data-edel]")){deleteEvent(b.getAttribute("data-edel"));return;}
  if(b=t.closest("[data-taskdel]")){S.tasks=S.tasks.filter(function(x){return x.id!==b.getAttribute("data-taskdel");});save();render();return;}
  if(b=t.closest("[data-taskadd]")){var aid=b.getAttribute("data-taskadd");var inp=document.querySelector('[data-tasknew="'+aid+'"]');if(inp&&inp.value.trim()){S.tasks.push({id:uid(),areaId:aid,text:inp.value.trim(),done:false});taskDraftArea=null;save();render();flash("Task added");}else if(inp){flash("Add a task first");inp.focus();}return;}
  if(b=t.closest("[data-fuedit]")){editingFollowupId=b.getAttribute("data-fuedit");render();return;}
  if(b=t.closest("[data-fucancel]")){editingFollowupId=null;render();return;}
  if(b=t.closest("button[data-fudone]")){var followup=S.followups.find(function(x){return x.id===b.getAttribute("data-fudone");});if(followup){followup.done=!followup.done;followup.completedDate=followup.done?todayStr():null;save();render();}return;}
  if(b=t.closest("[data-fudel]")){S.followups=S.followups.filter(function(x){return x.id!==b.getAttribute("data-fudel");});editingFollowupId=null;save();render();flash("Deleted");return;}
  if(b=t.closest("[data-fusave]")){var f=S.followups.find(function(x){return x.id===b.getAttribute("data-fusave");}),titleField=el("followupEditTitle"),legacyText=el("followupEditText"),text=titleField?titleField.value.trim():legacyText?legacyText.value.trim():"",detailField=el("followupEditDetails"),kindField=b.closest("[data-editor-modal]")&&b.closest("[data-editor-modal]").querySelector("[data-fu-kind]");if(f&&text){f.text=text;f.title=titleField?text:f.title;f.details=detailField?detailField.value.trim():f.details;f.kind=kindField?kindField.value:f.kind;editingFollowupId=null;save();render();flash("Note updated");}else if(f){flash("Add a title first");if(titleField)titleField.focus();else if(legacyText)legacyText.focus();}return;}
  if(b=t.closest("[data-fuadd]")){var pid=b.getAttribute("data-fuadd");var ft=el("personFUNew");if(ft&&ft.value.trim()){S.followups.push({id:uid(),personId:pid,text:ft.value.trim(),done:false,due:null});save();render();}return;}
  if(b=t.closest("[data-pray]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-pray");}),faithScroll=currentArea==="faith"?{x:window.scrollX,y:window.scrollY}:null;if(p)recordPrayer(p,!!p.personId);if(faithScroll)requestAnimationFrame(function(){window.scrollTo(faithScroll.x,faithScroll.y);});return;}
  if(b=t.closest("[data-prayerarchive]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerarchive");});if(p){p.archived=true;p.archivedDate=todayStr();p.answered=false;p.answeredDate=null;save();render();}return;}
  if(b=t.closest("[data-prayeredit]")){editingPrayerId=b.getAttribute("data-prayeredit");render();return;}
  if(b=t.closest("[data-prayercancel]")){editingPrayerId=null;render();return;}
  if(b=t.closest("[data-prayersave]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayersave");});var text=el("prayerEditText").value.trim();if(p&&text){p.text=text;p.details=el("prayerEditDetails").value.trim();p.category=el("prayerEditCat").value;p.personId=el("prayerEditPerson").value||null;p.freq=el("prayerEditFreq").value==="none"?null:el("prayerEditFreq").value;p.tod=el("prayerEditTod").value;var editDow=el("prayerEditDow");p.scheduleDow=scheduleHasWeekday(p.freq)&&editDow&&editDow.value!==""?+editDow.value:null;editingPrayerId=null;save();render();flash("Prayer updated");}else flash("Add a prayer request before saving");return;}
  if(b=t.closest("[data-prayerans]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerans");});if(p){p.answered=true;p.archived=false;p.archivedDate=null;p.answeredDate=todayStr();save();render();flash("God answered \u2713");}return;}
  if(b=t.closest("[data-prayerunans]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerunans");});if(p){p.answered=false;p.answeredDate=null;p.archived=false;p.archivedDate=null;save();render();}return;}
  if(b=t.closest("[data-prayerdel]")){S.prayers=S.prayers.filter(function(x){return x.id!==b.getAttribute("data-prayerdel");});editingPrayerId=null;window._ppEditId=null;save();render();return;}
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
   if(ev){editingConn=ev.id;window._rippleModalOpen=true;render();var connectionType=el("plogType");if(connectionType)connectionType.focus();}return;}
  if(b=t.closest("[data-connectiondelete]")){var connectionId=b.getAttribute("data-connectiondelete");editingConn=null;window._rippleModalOpen=false;deleteEvent(connectionId);return;}
  if(b=t.closest("[data-evdel]")){deleteEvent(b.getAttribute("data-evdel"));return;}
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

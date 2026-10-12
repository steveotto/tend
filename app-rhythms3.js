"use strict";
/* app-rhythms3.js - repair overlay for app-rhythms2.js.
   WHY THIS EXISTS: app-rhythms2.js is a strict-mode IIFE that assigns
   carePlanEditHTML/carePlanSave, but app-careplan.js (which declares those
   globals) loads AFTER it. The ReferenceError silently killed everything
   after that point in rhythms2: carePlanSave, the profile-pill fix and the
   editor event handlers. This file re-installs those overrides with
   window.-prefixed assignments (load-order safe) and re-runs the data
   migration at render time so pills always match personScore.
   Load order requirement: AFTER app-careplan.js. */
(function(){
 var RHYTHM_FREQS={selectdays:{label:"Select Days"},daily:{label:"Daily"},weekly:{label:"Weekly"},monthly:{label:"Monthly"},quarterly:{label:"Quarterly"},yearly:{label:"Yearly"},custom:{label:"Custom"}};
 var R_MOS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
 var R_ORDS=["1st","2nd","3rd","4th","last"];
 var RHYTHM_FIELD_LIST=["description","areas","faithGroup","weekdays","monthlyMode","dayOfMonth","ord","ordWeekday","month","monthDay","qmonth","every","unit","until","start","sharedWith"];
 /* ---- migration (mirror of rhythms2, re-applied lazily) ---- */
 function ensureRhythm(r){
  if(!r)return r;
  if(!r.added&&!r.start)r.added=todayStr();
  if(r.freq==="twicewk"){r.freq="custom";r.every=3;r.unit="days";}
  else if(r.freq==="biweekly"){r.freq="custom";r.every=2;r.unit="weeks";r.weekdays=[+(r.scheduleDow||0)];}
  else if(r.freq==="custom"&&(r.customType!==undefined||r.customDow!==undefined||r.customOrd!==undefined)){
   if(r.customType==="monthly"){r.freq="monthly";r.monthlyMode="onThe";r.ord=+r.customOrd||1;r.ordWeekday=+r.customDow||0;}
   else{r.freq="weekly";r.weekdays=[+(r.customDow||0)];}
  }
  if(r.freq==="weekly"&&!Array.isArray(r.weekdays))r.weekdays=(r.scheduleDow===null||r.scheduleDow===undefined||r.scheduleDow==="")?[]:[+r.scheduleDow];
  if((r.freq==="monthly"||r.freq==="quarterly")&&r.monthlyMode===undefined){r.monthlyMode="onDay";r.dayOfMonth=r.dayOfMonth||null;}
  if(r.freq==="yearly"&&r.month===undefined){r.monthlyMode=r.monthlyMode||"onDay";r.month=r.month||null;r.monthDay=r.monthDay||null;}
  if(r.freq==="quarterly"&&!r.qmonth)r.qmonth=((new Date().getMonth())%3)+1;
  if(r.freq==="custom"&&!r.unit)r.unit="weeks";
  ["customType","customDow","customOrd","scheduleDow","category","dur","durVal","durUnit","rule"].forEach(function(k){delete r[k];});
  return r;
 }
 window.tendNormalizeRhythmEditRecord=ensureRhythm;
 function migrateAllRhythms(){
  try{
   var before=JSON.stringify(S.people.map(function(p){return p.rhythms||[];}));
   S.people.forEach(function(p){(p.rhythms||[]).forEach(ensureRhythm);});
   if(JSON.stringify(S.people.map(function(p){return p.rhythms||[];}))!==before)save();
  }catch(err){}
 }
 migrateAllRhythms();
 /* ---- recurrence editor builders (mirror of rhythms2) ---- */
 function rDowPills(r,A){var sel=Array.isArray(r.weekdays)?r.weekdays.map(Number):[];if(r.freq!=="selectdays"&&sel.length>1)sel=[sel[0]];r.weekdays=sel;return scheduleWeekdayPills(sel,A("weekdays"),r.freq==="selectdays");}
 function rDaySelect(r,A,fld,dis,maxDay){var mx=maxDay||31,cur=r[fld]?+r[fld]:null,o='<select '+A(fld)+(dis?' disabled':'')+'>';for(var i=1;i<=mx;i++)o+='<option value="'+i+'"'+(cur===i?' selected':'')+'>'+i+'</option>';return o+'</select>';}
 function rOrdSelect(r,A,fld,dis){var d=dis?' disabled':'';return '<select '+A(fld||"ord")+d+'>'+R_ORDS.map(function(o,i){return '<option value="'+(i+1)+'"'+((+r.ord||1)===i+1?' selected':'')+'>'+o+'</option>';}).join('')+'</select><select '+A("ordWeekday")+d+'>'+DOW.map(function(d,i){return '<option value="'+i+'"'+((+r.ordWeekday||0)===i?' selected':'')+'>'+d+'</option>';}).join('')+'</select>';}
 function rMonthSelect(r,A,fld,dis){return '<select '+A(fld||"month")+(dis?' disabled':'')+'>'+R_MOS.map(function(m,i){return '<option value="'+(i+1)+'"'+((+r.month||1)===i+1?' selected':'')+'>'+m+'</option>';}).join('')+'</select>';}
 function rhythmRecurrenceHTML(r,A){
  var out="",u=r.freq==="custom"?(r.unit||"weeks"):r.freq,grp="rmode-"+String(r.id||"draft").replace(/[^a-z0-9]/gi,"-");
  if(u==="weekly"||u==="weeks"||u==="selectdays")out+='<div class="addrow"><span class="rlabel">On</span>'+rDowPills(r,A)+'</div>';
  if(u==="monthly"||u==="months"||u==="quarterly"){
   if(u==="quarterly"){var qm=+r.qmonth||(((new Date().getMonth())%3)+1);out+='<div class="addrow"><span class="rlabel">In</span><select '+A("qmonth")+'>'+[[1,"Jan \u2022 Apr \u2022 Jul \u2022 Oct"],[2,"Feb \u2022 May \u2022 Aug \u2022 Nov"],[3,"Mar \u2022 Jun \u2022 Sep \u2022 Dec"]].map(function(q){return '<option value="'+q[0]+'"'+(qm===q[0]?' selected':'')+'>'+q[1]+'</option>';}).join('')+'</select></div>';}
   var onDay=r.monthlyMode!=="onThe";
   out+='<div class="addrow monthly-mode-options"><div class="monthly-mode-option"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onDay"'+(onDay?' checked':'')+'> On day</label><select '+A("dayOfMonth")+(onDay?'':' disabled')+'>'+scheduleOptions(Array.from({length:28},function(_,i){return [i+1,String(i+1)];}),r.dayOfMonth||1)+'</select></div><div class="monthly-mode-option"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onThe"'+(onDay?'':' checked')+'> On the</label>'+rOrdSelect(r,A,null,onDay)+'</div></div>';
  }
  if(u==="yearly"||u==="years"){
   out+='<div class="addrow"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onDay"'+(r.monthlyMode!=="onThe"?' checked':'')+'> On</label>'+rMonthSelect(r,A,"month",r.monthlyMode==="onThe")+rDaySelect(r,A,"monthDay",r.monthlyMode==="onThe",31)+'</div>';
   out+='<div class="addrow"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onThe"'+(r.monthlyMode==="onThe"?' checked':'')+'> On the</label>'+rOrdSelect(r,A,null,r.monthlyMode!=="onThe")+'<span class="rsep">of</span>'+rMonthSelect(r,A,"monthThe",r.monthlyMode!=="onThe")+'</div>';
  }
  if(r.freq==="custom")out+='<div class="addrow"><span class="rlabel">Repeat every</span><input type="number" min="1" max="365" '+A("every")+' value="'+(+r.every||1)+'"><select '+A("unit")+'>'+["days","weeks","months","years"].map(function(x){return '<option value="'+x+'"'+((r.unit||"weeks")===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></div>'
  +'<div class="addrow rhy-daterow"><label class="rlabel">Starting on</label><input type="date" '+A("start")+' value="'+esc(r.start||"")+'"></div>';
  out+=scheduleEndDate(r,A,'data-rhythm-end-date-field');
  return out;
 }
 /* ---- profile editor: same recurrence UI as the care plan editor ---- */
 var _prshBase=window.personRhythmScheduleHTML;
 window.personRhythmScheduleHTML=function(r,idf){
  var A=function(f){return 'data-rfield="'+idf+'|'+f+'"';};
  return '<div class="rhythm-schedule-grid"><label class="careplan-field">Frequency<select '+A("freq")+'>'+Object.keys(RHYTHM_FREQS).map(function(k){return '<option value="'+k+'"'+(r.freq===k?' selected':'')+'>'+RHYTHM_FREQS[k].label+'</option>';}).join('')+'</select></label><label class="careplan-field">Time of day<select '+A("tod")+'>'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((r.tod||"anytime")===k?' selected':'')+'>'+esc(TODS[k])+'</option>';}).join('')+'</select></label></div>'
  +'<div class="rhy-recur">'+rhythmRecurrenceHTML(r,A)+'</div>';
 };
 window.tendRhythmEditModalHTML=function(record,options){
  options=options||{};
  var carePlan=options.mode==="careplan",idf=String(options.idf||""),key=String(options.key||""),ownerId=String(options.ownerId||""),viewerId=String(options.viewerId||ownerId);
  var A=function(field){return carePlan?'data-cpf="'+(field==="freq"?"frequency":field)+'"':'data-rfield="'+esc(idf+"|"+field)+'"';};
  var schedule=carePlan?'<div class="rhythm-schedule-grid"><label class="careplan-field">Frequency<select '+A("freq")+'>'+Object.keys(RHYTHM_FREQS).map(function(freq){return '<option value="'+freq+'"'+(record.freq===freq?' selected':'')+'>'+RHYTHM_FREQS[freq].label+'</option>';}).join('')+'</select></label><label class="careplan-field">Time of day<select '+A("tod")+'>'+Object.keys(TODS).map(function(time){return '<option value="'+time+'"'+((record.tod||"anytime")===time?' selected':'')+'>'+esc(TODS[time])+'</option>';}).join('')+'</select></label></div><div class="rhy-recur">'+rhythmRecurrenceHTML(record,A)+'</div>':window.personRhythmScheduleHTML(record,idf);
  if(carePlan){
   var personOptions=S.people.map(function(person){return '<option value="'+esc(person.id)+'"'+(options.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join('');
   return '<dialog class="profile-editor-dialog" data-editor-modal aria-label="Edit rhythm"><div class="profile-editor-body careplan-edit careplan-rhythm-edit" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-rhythm">Rhythm</span><strong>Edit rhythm</strong></div><label class="careplan-field">Title<input '+A("title")+' value="'+esc(record.text||"")+'"></label><label class="careplan-field">Description (optional)<textarea '+A("description")+' placeholder="Add context or details">'+esc(record.description||"")+'</textarea></label>'+schedule+'<label class="careplan-field">Person<select '+A("person")+'>'+personOptions+'</select></label><div class="careplan-actions"><button type="button" class="btn mini" data-cpsave="'+esc(key)+'">Save</button><button type="button" class="btn mini ghost" data-cpcancel="'+esc(key)+'" data-editor-cancel>Cancel</button><button type="button" class="btn mini ghost careplan-delete" data-cpdelete="'+esc(key)+'">Delete</button></div></div></dialog>';
  }
  return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="rhythm-editor-title"><div class="profile-editor-body"><h3 id="rhythm-editor-title" tabindex="-1">Edit Rhythm</h3><div class="rhyedit"><div class="addrow" style="margin-top:2px"><input '+A("text")+' value="'+esc(record.text||"")+'" placeholder="What is the rhythm?"></div><label class="careplan-field rhythm-description-field">Description (optional)<textarea '+A("description")+' placeholder="Add context or details">'+esc(record.description||"")+'</textarea></label>'+schedule+rhythmPickerControlsHTML(ownerId,record,idf)+'<div class="profile-editor-actions rhythm-editor-actions"><div class="rhythm-editor-primary-actions"><button class="btn mini" data-rhyeditsave="'+esc(idf)+'">Save</button><button class="btn mini ghost" data-rhyeditcancel="1" data-editor-cancel>Cancel</button></div><button class="btn mini danger" data-rhydel="'+esc(idf)+'">'+(currentPerson!==ownerId?"Remove":"Delete")+'</button></div></div></div></dialog>';
 };
 /* ---- style: heights, widths, disabled look ---- */
 try{
  var st=document.createElement("style");
  st.textContent=".rhythm-schedule-grid select,.careplan-rhythm-edit .careplan-edit-grid select,.rhy-recur .addrow select,.rhy-recur .addrow input{min-height:44px!important;height:44px;padding:8px 12px;font-size:13.5px!important;line-height:1.4}"
  +".rhy-recur .addrow select,.rhy-recur .addrow input[type=number]{flex:0 0 auto;width:auto;min-width:84px}"
  +".rhy-recur .addrow input[type=date]{flex:0 0 auto;width:160px}"
  +".rhy-recur .rhy-daterow{flex-wrap:wrap;gap:10px}"
  +".rhy-end-date{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:8px}.rhy-end-toggle{display:inline-flex;align-items:center;gap:8px;width:max-content;color:var(--ink);font-size:13px;cursor:pointer}.rhy-end-toggle input{width:17px;height:17px;accent-color:var(--forest)}.rhy-end-field{display:inline-flex;align-items:center;gap:8px;width:max-content;color:var(--ink-soft);font-size:12px}.rhy-end-field[hidden]{display:none}.rhy-end-field input[type=date]{width:180px}"
  +".rhy-recur select:disabled,.rhy-recur input:disabled{opacity:.45;cursor:not-allowed;background:var(--mist)}";
  document.head.appendChild(st);
 }catch(err){}
 /* ---- care plan edit form + save (revives rhythms2's dead overrides) ---- */
 window.carePlanEditHTML=function(item,key){
  var r=item.record,kind=item.kind;
  var frequencies=kind==='rhythm'?Object.keys(RHYTHM_FREQS).map(function(k){return [k,RHYTHM_FREQS[k].label];}):Object.keys(FREQS).map(function(k){return [k,FREQS[k].label];});
  var times=[['anytime','No timeframe assigned'],['allday','All day']].concat(dayBlocks().map(function(b){return [b.id,b.name];}));
  if(kind==='spark')return '<dialog class="profile-editor-dialog" data-editor-modal aria-label="Edit Spark schedule"><div class="profile-editor-body careplan-edit" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-spark">Spark</span><strong>Edit Spark schedule</strong></div><label class="careplan-field">Time of day<select data-cpf="tod">'+carePlanOptions(times,r.tod||'anytime')+'</select></label><div class="careplan-edit-grid"><label class="careplan-field">Date<input type="date" data-cpf="by" value="'+esc(r.by||'')+'"></label><label class="careplan-field">Time<input type="time" data-cpf="time" value="'+esc(r.time||'')+'"></label></div><div class="careplan-actions"><button type="button" class="btn mini" data-cpsave="'+esc(key)+'">Save</button><button type="button" class="btn mini ghost" data-cpcancel="'+esc(key)+'" data-editor-cancel>Cancel</button></div></div></dialog>';
  if(kind==='rhythm')return window.tendRhythmEditModalHTML(r,{mode:'careplan',key:key,personId:item.person.id});
  if(kind!=='rhythm')frequencies.unshift(['','No frequency']);
  var peopleOptions=[['','No person']].concat(S.people.map(function(p){return [p.id,p.name];}));
  var out='<dialog class="profile-editor-dialog" data-editor-modal aria-label="Edit '+(kind==='rhythm'?'rhythm':'prayer')+'"><div class="profile-editor-body careplan-edit'+(kind==='rhythm'?' careplan-rhythm-edit':'')+'" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-'+kind+'">'+(kind==='rhythm'?'Rhythm':'Prayer')+'</span><strong>Edit '+(kind==='rhythm'?'rhythm':'prayer')+'</strong></div><label class="careplan-field">Title<input data-cpf="title" value="'+esc(r.text||'')+'"></label>';
  if(kind==='rhythm')out+='<label class="careplan-field">Description (optional)<textarea data-cpf="description" placeholder="Add context or details">'+esc(r.description||'')+'</textarea></label>';
  else out+='<label class="careplan-field">Details<textarea data-cpf="details">'+esc(r.details||'')+'</textarea></label>';
  out+='<div class="careplan-edit-grid"><label class="careplan-field">Frequency<select data-cpf="frequency">'+carePlanOptions(frequencies,r.freq)+'</select></label><label class="careplan-field">Time of day<select data-cpf="tod">'+carePlanOptions(times,r.tod||'anytime')+'</select></label>';
  if(kind==='prayer')out+='<label class="careplan-field" data-schedule-day'+(scheduleHasWeekday(r.freq)?'':' hidden')+'>Day of week<select data-cpf="scheduleDow">'+scheduleDayOptions(r.scheduleDow)+'</select></label>';
  if(kind==='rhythm')out+='<label class="careplan-field">Person<select data-cpf="person">'+carePlanOptions(S.people.map(function(p){return [p.id,p.name];}),item.person.id)+'</select></label>';
  if(kind==='prayer')out+='<label class="careplan-field">Person<select data-cpf="person">'+carePlanOptions(peopleOptions,r.personId)+'</select></label><label class="careplan-field">Status<select data-cpf="status">'+carePlanOptions([['active','Active'],['answered','Answered'],['archived','Archived']],r.answered?'answered':r.archived?'archived':'active')+'</select></label>';
  out+='</div>';
  if(kind==='rhythm'){var A=function(f){return 'data-cpf="'+f+'"';};out+='<div class="rhy-recur">'+rhythmRecurrenceHTML(r,A)+'</div>';}
  out+='<div class="careplan-actions"><button type="button" class="btn mini" data-cpsave="'+esc(key)+'">Save</button><button type="button" class="btn mini ghost" data-cpcancel="'+esc(key)+'" data-editor-cancel>Cancel</button><button type="button" class="btn mini ghost careplan-delete" data-cpdelete="'+esc(key)+'">Delete</button></div></div></dialog>';
  return out;
 };
 window.carePlanSave=function(key,form){
  var found=carePlanFind(key),r=found.record;if(!r)return;
  var field=function(name){return form.querySelector('[data-cpf="'+name+'"]');};
  if(found.kind==='spark'){var by=field('by').value;r.tod=field('tod').value;r.by=by||null;r.time=by&&field('time').value?field('time').value:null;carePlanEdit=null;save();render();flash('Spark schedule updated');return;}
  if(found.kind==='rhythm'){
   var rhythmValidation=window.tendValidateRhythmEditForm(form,'careplan');
   if(rhythmValidation){flash(rhythmValidation.message==='endDate'?'Choose an end date':'Add a title');if(rhythmValidation.field)rhythmValidation.field.focus();return;}
   window.tendApplyRhythmEditForm(r,form,'careplan');
   var newPerson=S.people.find(function(p){return p.id===field('person').value;});
   if(newPerson&&newPerson!==found.person){found.person.rhythms=found.person.rhythms.filter(function(x){return x!==r;});newPerson.rhythms=newPerson.rhythms||[];newPerson.rhythms.push(r);}
  }
  if(found.kind==='prayer'){var title=field('title').value.trim();if(!title){flash('Add a title');field('title').focus();return;}r.text=title;r.tod=field('tod').value;r.details=field('details').value.trim();r.freq=field('frequency').value||null;r.scheduleDow=r.freq&&scheduleHasWeekday(r.freq)&&field('scheduleDow')&&field('scheduleDow').value!==''?+field('scheduleDow').value:null;r.personId=field('person').value||null;var status=field('status').value;r.answered=status==='answered';r.archived=status==='archived';}
  carePlanEdit=null;carePlanRhythmDraft=null;save();render();flash('Updated in Care Plan');
 };
 /* ---- person profile pills: same inputs as personScore, robust replace ---- */
 var _ppBase=window.personProfile;
 window.personProfile=function(pid){
  var html=_ppBase(pid);
  var p=S.people.find(function(x){return x.id===pid;});if(!p)return html;
  migrateAllRhythms();
  var rs=sortedPersonRhythms(p),pInfo=typeof personPrayerScheduleInfo==='function'?personPrayerScheduleInfo(p):personPrayerInfo(p);
  var pScore=prayerMeterScore(p),rm=rs.length?avg(rs.map(rhythmScore)):null,pTouch=personConnInfo(p),tScore=connectionScore(p);
  var activePrayerCount=personPrayerRecords(p).filter(function(item){return !item.answered&&!item.archived;}).length;
  function summaryButton(key,label,value){
   var display=value===null||value===undefined||!Number.isFinite(Number(value))?"\u2014":String(value);
   var tone=display==="\u2014"?"neutral":scoreClass(Number(value));
   return '<button type="button" class="person-health-summary" id="person-health-summary-'+key+'" data-person-health-summary="'+key+'" aria-label="'+esc(label+' score '+display)+'" aria-controls="person-health-detail" aria-expanded="false"><span class="person-health-summary-score '+tone+'">'+esc(display)+'</span><span class="person-health-summary-label">'+esc(label)+'</span></button>';
  }
  var pills='<div class="person-health-summaries" role="group" aria-label="Relationship health summaries">'
   +summaryButton("rhythms","Rhythms",rm)+summaryButton("connection","Connection",tScore)+summaryButton("prayer","Prayer",pScore)+'</div>';
  var lastConnection=pTouch.last?"Last connection: "+when(pTouch.last.ts):"No connections yet";
  var lastPrayer=pInfo.last?"Last prayed: "+when(pInfo.last.ts):"No prayers logged";
  var latestRhythmEvent=null;
  rs.forEach(function(rhythm){
   var event=rhythmLast(rhythm);
   if(event&&(!latestRhythmEvent||Number(event.ts)>Number(latestRhythmEvent.ts)))latestRhythmEvent={rhythm:rhythm,event:event};
  });
  var latestRhythmText=latestRhythmEvent?"Last tended: "+when(latestRhythmEvent.event.ts):"Last tended: Never";
  var connectionTarget="Target: "+personCadenceTargetLabel(p);
  var prayerCount=activePrayerCount+" active prayer request"+(activePrayerCount===1?"":"s");
  pills+='<div class="person-health-detail" id="person-health-detail" hidden aria-live="polite">'
   +'<section class="person-health-detail-content" data-person-health-detail="rhythms" hidden><div class="person-health-detail-heading"><div><h4>Rhythms</h4><p>'+esc(latestRhythmText)+'</p><p>'+(rs.length?rs.length+" rhythm"+(rs.length===1?"":"s"):"No rhythms yet")+'</p></div><button type="button" class="person-health-detail-icon" data-meter-tab="rhythms" aria-label="View rhythms" title="View rhythms">'+collectionIcon("rhythms")+'</button></div></section>'
   +'<section class="person-health-detail-content" data-person-health-detail="connection" hidden><div class="person-health-detail-heading"><div><h4>Connection</h4><p>'+esc(lastConnection)+'</p><p>'+esc(connectionTarget)+'</p></div><button type="button" class="person-health-detail-icon" data-meter-tab="connection" aria-label="View connections" title="View connections">'+collectionIcon("connection")+'</button></div></section>'
   +'<section class="person-health-detail-content" data-person-health-detail="prayer" hidden><div class="person-health-detail-heading"><div><h4>Prayer</h4><p>'+esc(lastPrayer)+'</p><p>'+esc(prayerCount)+'</p></div><button type="button" class="person-health-detail-icon" data-meter-tab="prayer" aria-label="View prayers" title="View prayers">'+collectionIcon("prayer")+'</button></div></section>'
   +'</div>';
  var i=html.indexOf('<div class="pmeters');
  if(i<0)return html;
  var tagRe=/<\/?div\b[^>]*>/g;tagRe.lastIndex=i;
  var depth=0,m2,end=-1;
  while((m2=tagRe.exec(html))){if(m2[0].charAt(1)===String.fromCharCode(47)){depth--;}else{depth++;}if(depth===0){end=m2.index+m2[0].length;break;}}
  if(end<0)return html;
  return html.slice(0,i)+pills+html.slice(end);
 };
 document.addEventListener("change",function(e){
  var t=e.target;
  if(t&&t.matches&&t.matches('[data-cpf="weekdays"]')&&t.checked&&t.closest('[data-schedule-days="single"]')){
   var fm=t.closest("[data-cpform]");
   if(fm)Array.prototype.slice.call(fm.querySelectorAll('[data-cpf="weekdays"]')).forEach(function(x){if(x!==t)x.checked=false;});
  }
  if(!t||!t.matches||!t.matches('[data-cpf="monthlyMode"]'))return;
  var form=t.closest("[data-cpform]");if(!form||!form.classList.contains("careplan-rhythm-edit")||!window.carePlanRhythmDraft)return;
  window.tendApplyRhythmEditForm(window.carePlanRhythmDraft,form,"careplan");
  window.carePlanRhythmDraft.monthlyMode=t.value;
  render();
  var restored=document.querySelector('[data-cpform="'+carePlanEdit+'"] [data-cpf="monthlyMode"]:checked');if(restored)restored.focus();
 });
 /* ---- weekday pills: single-day enforcement at window-capture.
    WHY WINDOW: r2's document-capture weekday handler (wd.push, multi-select)
    runs before r3's document handlers and calls stopImmediatePropagation,
    so it would win. Window-capture fires before ALL document listeners. ---- */
 window.addEventListener("change",function(e){
  var t=e.target;
  if(!t||!t.matches||!t.closest)return;
  if(t.matches('[data-rfield$="|endDateEnabled"]')){
   var endParts=t.getAttribute('data-rfield').split('|'),endDraft=endParts[1]==='draft'?rhythmDraft:rhythmEditDraft;
   if(endDraft){endDraft.endDateEnabled=t.checked;if(!t.checked)endDraft.until=null;render();}
   e.stopImmediatePropagation();return;
  }
  if(t.matches('[data-cpf="endDateEnabled"]')){
   var endField=t.closest('[data-cpform]').querySelector('[data-rhythm-end-date-field]'),endInput=endField.querySelector('[data-cpf="until"]');
   endField.hidden=!t.checked;endInput.disabled=!t.checked;endInput.required=t.checked;
   if(!t.checked)endInput.value='';else endInput.focus();
   e.stopImmediatePropagation();return;
  }
  var isRf=t.matches('[data-rfield$="|weekdays"]'),isCp=t.matches('[data-cpf="weekdays"]');
  if(!isRf&&!isCp)return;
  if(isCp){
   var fm2=t.closest("[data-cpform]");
   if(fm2&&t.checked&&t.closest('[data-schedule-days="single"]'))Array.prototype.slice.call(fm2.querySelectorAll('[data-cpf="weekdays"]')).forEach(function(x){if(x!==t)x.checked=false;});
   if(fm2&&fm2.classList.contains("careplan-rhythm-edit")&&window.carePlanRhythmDraft)window.tendApplyRhythmEditForm(window.carePlanRhythmDraft,fm2,"careplan");
   e.stopImmediatePropagation();return;
  }
  var rf=t.getAttribute("data-rfield").split("|"),rr2=null;
  if(rf[1]==="draft"){if(rhythmDraft&&rhythmDraft.pid===rf[0])rr2=rhythmDraft;}
  else if(rhythmEditDraft&&rhythmEditDraft.id===rf[1]&&editRhythmId===rf[1])rr2=rhythmEditDraft;
  if(!rr2)return;
  var selected=Array.prototype.slice.call(t.closest('.dow-pills').querySelectorAll('input:checked')).map(function(x){return +x.value;});
  rr2.weekdays=rr2.freq==="selectdays"?selected:(t.checked?[+t.value]:[]);
  if(!rr2.weekdays.length)rr2.weekdays=[+t.value];
  render();e.stopImmediatePropagation();
 },true);
 window.addEventListener('click',function(e){
  var button=e.target&&e.target.closest&&e.target.closest('[data-rhyadd],[data-rhyeditsave]');if(!button)return;
  var key=button.hasAttribute('data-rhyeditsave')?button.getAttribute('data-rhyeditsave'):button.getAttribute('data-rhyadd')+'|draft';
  var toggle=document.querySelector('[data-rfield="'+key+'|endDateEnabled"]');
  var date=document.querySelector('[data-rfield="'+key+'|until"]');
  if(toggle&&toggle.checked&&(!date||!date.value)){
   e.preventDefault();e.stopImmediatePropagation();flash('Choose an end date');if(date)date.focus();
  }
 },true);
 /* ---- handlers: create/edit rhythms (revives rhythms2's dead listeners) ---- */
 document.addEventListener("change",function(e){
  var t=e.target;
  if(!t||!t.matches||!t.matches("[data-rfield]"))return;
  var rf=t.getAttribute("data-rfield").split("|"),rr=null;
  if(rf[1]==="draft"){if(rhythmDraft&&rhythmDraft.pid===rf[0])rr=rhythmDraft;}
  else if(rhythmEditDraft&&rhythmEditDraft.id===rf[1]&&editRhythmId===rf[1])rr=rhythmEditDraft;
  if(!rr)return;
  var fld=rf[2];
  if(fld==="text"){rr.text=t.value;e.stopImmediatePropagation();return;}
  if(fld==="weekdays"){var v=+t.value;rr.weekdays=rr.freq==="selectdays"?Array.prototype.slice.call(t.closest('.dow-pills').querySelectorAll('input:checked')).map(function(x){return +x.value;}):(t.checked?[v]:[]);if(!rr.weekdays.length)rr.weekdays=[v];render();e.stopImmediatePropagation();return;}
  if(fld==="freq"){
   rr.freq=t.value;
   if(t.value==="monthly"||t.value==="quarterly"){rr.monthlyMode=rr.monthlyMode||"onDay";rr.dayOfMonth=rr.dayOfMonth||new Date().getDate();if(t.value==="quarterly"&&!rr.qmonth)rr.qmonth=((new Date().getMonth())%3)+1;}
   if(t.value==="yearly"){rr.monthlyMode=rr.monthlyMode||"onDay";rr.month=rr.month||(new Date().getMonth()+1);rr.monthDay=rr.monthDay||new Date().getDate();}
   if(t.value==="custom"){rr.every=rr.every||1;rr.unit=rr.unit||"weeks";if(!rr.weekdays)rr.weekdays=[];if(!rr.start)rr.start=(function(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");})();}
   if(t.value==="weekly"&&(!Array.isArray(rr.weekdays)||rr.weekdays.length!==1))rr.weekdays=[new Date().getDay()];
   if(t.value==="selectdays"&&(!Array.isArray(rr.weekdays)||!rr.weekdays.length))rr.weekdays=[new Date().getDay()];
   render();e.stopImmediatePropagation();return;
  }
  if(fld==="unit"){rr.unit=t.value;if(t.value==="weeks"&&(!Array.isArray(rr.weekdays)||!rr.weekdays.length))rr.weekdays=[new Date().getDay()];render();e.stopImmediatePropagation();return;}
  if(fld==="every"||fld==="dayOfMonth"||fld==="ord"||fld==="ordWeekday"||fld==="month"||fld==="monthThe"||fld==="monthDay"||fld==="qmonth"){var dst=fld==="monthThe"?"month":fld;rr[dst]=+t.value||1;render();e.stopImmediatePropagation();return;}
  rr[fld]=t.value;render();e.stopImmediatePropagation();
 },true);
 document.addEventListener("click",function(e){
  if(!e.target||!e.target.closest)return;
  var b=e.target.closest("[data-rhyadd]");
  if(b){
   var ra=b.getAttribute("data-rhyadd");
   if(rhythmDraft&&rhythmDraft.pid===ra&&rhythmDraft.text&&rhythmDraft.text.trim()){
    var rp=S.people.find(function(x){return x.id===ra;});
    if(rp){
     var nc={id:uid(),text:rhythmDraft.text.trim(),freq:rhythmDraft.freq||"weekly",tod:rhythmDraft.tod||"anytime",added:todayStr()};
     RHYTHM_FIELD_LIST.forEach(function(k){var v=rhythmDraft[k];if(v===undefined||v===null||v==="")return;if(Array.isArray(v)){if(v.length)nc[k]=v.slice();}else nc[k]=v;});
     ensureRhythm(nc);rp.rhythms=rp.rhythms||[];rp.rhythms.push(nc);rhythmDraft=null;save();render();flash("Rhythm added");
    }
   }else if(rhythmDraft&&rhythmDraft.pid===ra){flash("Give the rhythm a name first");}
   else{rhythmDraft={pid:ra,text:"",freq:"weekly",tod:"anytime",weekdays:[new Date().getDay()],every:1,unit:"weeks"};render();}
   e.stopImmediatePropagation();return;
  }
 },true);
})();

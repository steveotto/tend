"use strict";
/* ============ rhythms v2 (2026-10-02): one rhythm, no categories, Outlook-style recurrence ============
   - A rhythm is just a rhythm. Prayers stay separate (logged prayer events); "Pray together" is a rhythm.
   - Frequency: Daily, Weekly, Monthly, Quarterly, Yearly, Custom.
   - Custom = Outlook recurrence: repeat every N days/weeks/months/years, weekday picker for weeks,
     "on day N" vs "on the Nth [weekday]" for months/years, optional Until end date.
   - Time-of-day sections stay; duration (minutes/hours) is gone.
   - Loads LAST and overrides the category-era engine + forms. Legacy data migrates in place. */
(function(){
 /* ---- css for the recurrence editor ---- */
 var st=document.createElement("style");
 st.textContent=".dow-pills{display:inline-flex;gap:6px;flex-wrap:wrap}"
 +".dow-pill{position:relative;display:inline-flex}"
 +".dow-pill input{position:absolute;opacity:0;pointer-events:none}"
 +".dow-pill span{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:#FDFDFD;font-size:12px;font-weight:600;color:var(--ink-soft);cursor:pointer;user-select:none}"
 +".dow-pill input:checked+span{background:var(--forest);border-color:var(--forest);color:#fff}"
 +".rhy-recur{display:flex;flex-direction:column;gap:8px;margin:2px 0 8px}"
 +".rhy-recur .addrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0}"
 +".rhy-recur .rlabel,.rhy-recur .rsep{font-size:13px;color:var(--ink-soft)}"
 +".rhy-recur .rmode{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--ink-soft)}"
 +".rhy-recur select,.rhy-recur input[type=number],.rhy-recur input[type=date]{height:38px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font:inherit;font-size:14px;background:#FDFDFE}"
 +".rhy-recur input[type=number]{width:64px}";
 document.head.appendChild(st);

/* ---- constants ---- */
var RHYTHM_FREQS={daily:{label:"Daily"},weekly:{label:"Weekly"},monthly:{label:"Monthly"},quarterly:{label:"Quarterly"},yearly:{label:"Yearly"},custom:{label:"Custom"}};
var R_MOS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var R_ORDS=["1st","2nd","3rd","4th","last"];
var RHYTHM_FIELD_LIST=["description","weekdays","monthlyMode","dayOfMonth","ord","ordWeekday","month","monthDay","every","unit","until"];

/* ---- migration: legacy category/duration-era rhythms -> v2, in place ---- */
function ensureRhythm(r){
 if(!r)return r;
 if(r.freq==="twicewk"){r.freq="custom";r.every=3;r.unit="days";}
 else if(r.freq==="biweekly"){r.freq="custom";r.every=2;r.unit="weeks";r.weekdays=[+(r.scheduleDow||0)];}
 else if(r.freq==="custom"&&(r.customType!==undefined||r.customDow!==undefined||r.customOrd!==undefined)){
  if(r.customType==="monthly"){r.freq="monthly";r.monthlyMode="onThe";r.ord=+r.customOrd||1;r.ordWeekday=+r.customDow||0;}
  else{r.freq="weekly";r.weekdays=[+(r.customDow||0)];}
 }
 if(r.freq==="weekly"&&!Array.isArray(r.weekdays))r.weekdays=(r.scheduleDow===null||r.scheduleDow===undefined||r.scheduleDow==="")?[]:[+r.scheduleDow];
 if((r.freq==="monthly"||r.freq==="quarterly")&&r.monthlyMode===undefined){r.monthlyMode="onDay";r.dayOfMonth=r.dayOfMonth||null;}
 if(r.freq==="yearly"&&r.month===undefined){r.monthlyMode=r.monthlyMode||"onDay";r.month=r.month||null;r.monthDay=r.monthDay||null;}
 if(r.freq==="custom"&&!r.unit)r.unit="weeks";
 ["customType","customDow","customOrd","scheduleDow","dur","durVal","durUnit"].forEach(function(k){delete r[k];});
 if(r.category!=="faith")delete r.category;
 return r;
}
function migrateAllRhythms(){
 try{
  var before=JSON.stringify(S.people.map(function(p){return p.rhythms||[];}));
  S.people.forEach(function(p){(p.rhythms||[]).forEach(ensureRhythm);});
  if(JSON.stringify(S.people.map(function(p){return p.rhythms||[];}))!==before)save();
 }catch(err){}
}
migrateAllRhythms();

/* ---- engine ---- */
function rhythmUnit(r){return r.freq==="custom"?(r.unit||"weeks"):r.freq;}
function rhythmPeriod(r){
 var u=rhythmUnit(r),ev=+r.every||1;
 if(u==="daily")return 1;
 if(u==="weekly"||u==="weeks")return 7*(r.freq==="custom"?ev:1);
 if(u==="monthly"||u==="months")return 30*(r.freq==="custom"?ev:1);
 if(u==="quarterly")return 91;
 if(u==="yearly"||u==="years")return 365*(r.freq==="custom"?ev:1);
 if(u==="days")return Math.max(1,ev);
 return 7;
}
function rhythmMatchesDay(r,date){
 date=date||new Date();
 if(rhythmEnded(r))return false;
 var u=rhythmUnit(r);
 if(u==="daily"||u==="days")return true;
 if(u==="weekly"||u==="weeks")return !(r.weekdays||[]).length||(r.weekdays||[]).indexOf(date.getDay())>=0;
 if(u==="monthly"||u==="months"||u==="quarterly"){
  if(r.monthlyMode==="onThe"){
   var ord=+r.ord||1,wd=+r.ordWeekday||0;
   if(ord===5){var last=new Date(date.getFullYear(),date.getMonth()+1,0);return date.getDay()===wd&&last.getDate()-date.getDate()<7;}
   return date.getDay()===wd&&Math.ceil(date.getDate()/7)===ord;
  }
  if(!r.dayOfMonth)return true; /* legacy: any day, period-based */
  var dim=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  return date.getDate()===Math.min(+r.dayOfMonth,dim);
 }
 if(u==="yearly"||u==="years"){
  if(!r.month)return true; /* legacy: any day, period-based */
  if(date.getMonth()!==r.month-1)return false;
  if(r.monthlyMode==="onThe"){
   var ord2=+r.ord||1,wd2=+r.ordWeekday||0;
   if(ord2===5){var last2=new Date(date.getFullYear(),r.month,0);return date.getDay()===wd2&&last2.getDate()-date.getDate()<7;}
   return date.getDay()===wd2&&Math.ceil(date.getDate()/7)===ord2;
  }
  var dim2=new Date(date.getFullYear(),r.month,0).getDate();
  return date.getDate()===Math.min(+r.monthDay||1,dim2);
 }
 return true;
}
function rWkTxt(r){var wd=r.weekdays||[];return wd.length?" on "+wd.slice().sort(function(a,b){return a-b;}).map(function(i){return DOW[i];}).join(" & "):"";}
function rMoTxt(r){if(r.monthlyMode==="onThe")return " on the "+(R_ORDS[(+r.ord||1)-1]||"1st")+" "+DOW[+r.ordWeekday||0];return r.dayOfMonth?" on day "+r.dayOfMonth:"";}
function rQuarterlyTxt(r){
 var offset=Math.max(1,Math.min(3,+r.qmonth||1))-1;
 var months=[0,3,6,9].map(function(q){return q+offset;});
 var names=months.map(function(m){return R_MOS[m];}).join(", ");
 if(r.monthlyMode==="onThe")return " on the "+(R_ORDS[(+r.ord||1)-1]||"1st")+" "+DOW[+r.ordWeekday||0]+" in "+names;
 var day=+r.dayOfMonth||0;
 if(!day)return " in "+names;
 var valid=months.filter(function(m){return day<=(m===1?29:new Date(2026,m+1,0).getDate());});
 var dates=valid.map(function(m){return R_MOS[m]+" "+day;}).join(", ");
 return " on "+dates+(valid.length<months.length?" (months without that date are skipped)":"");
}
function rYrTxt(r){if(r.monthlyMode==="onThe")return " on the "+(R_ORDS[(+r.ord||1)-1]||"1st")+" "+DOW[+r.ordWeekday||0]+" of "+R_MOS[(+r.month||1)-1];return " on "+(R_MOS[(+r.month||1)-1]||"")+" "+(r.monthDay||1);}
function rUntilTxt(r){if(!r.until)return "";var d=new Date(r.until+"T12:00:00");return " until "+R_MOS[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();}
rhythmFreqLabel=function(r){
 ensureRhythm(r);
 if(rhythmEnded(r))return (r.freq==="custom"?"Every "+(+r.every||1)+" "+(r.unit||"weeks"):RHYTHM_FREQS[r.freq]?RHYTHM_FREQS[r.freq].label:"Rhythm")+" - ended"+rUntilTxt(r);
 if(r.freq==="custom"){var u=r.unit||"weeks";return "Every "+(+r.every||1)+" "+u+(u==="weeks"?rWkTxt(r):u==="months"?rMoTxt(r):u==="years"?rYrTxt(r):"")+rUntilTxt(r);}
 if(r.freq==="weekly")return "Weekly"+rWkTxt(r)+rUntilTxt(r);
 if(r.freq==="selectdays")return "Selected days"+rWkTxt(r)+rUntilTxt(r);
 if(r.freq==="monthly")return "Monthly"+rMoTxt(r)+rUntilTxt(r);
 if(r.freq==="quarterly")return "Quarterly"+rQuarterlyTxt(r)+rUntilTxt(r);
 if(r.freq==="yearly")return "Yearly"+rYrTxt(r)+rUntilTxt(r);
 return "Daily"+rUntilTxt(r);
};
personRhythms=function(p){return ((p&&p.rhythms)||[]).filter(function(r){return !rhythmEnded(ensureRhythm(r));});};
personScore=function(p){
 var rs=personRhythms(p),rhythms=avg(rs.map(rhythmScore)),conn=connectionScore(p);
 var ps=prayerMeterScore(p),total=0,weight=0;
 if(rhythms!==null){total+=0.4*rhythms;weight+=0.4;}
 total+=0.3*conn;weight+=0.3;
 if(ps!==null){total+=0.3*ps;weight+=0.3;}
 return Math.round(clamp(total/weight,0,100));
};
defaultRhythms=function(){return[{id:uid(),text:"Pray together",freq:"daily",tod:"early"},{id:uid(),text:"Afternoon walk around the block",freq:"daily",tod:"afternoon"},{id:uid(),text:"Date night",freq:"weekly",weekdays:[5],tod:"evening"},{id:uid(),text:"Overnight getaway",freq:"quarterly",tod:"anytime"}];};
rhythmScheduledToday=function(r,date){
 date=date||new Date();
 if(rhythmDaysSince(r)===0)return false;
 if(!rhythmMatchesDay(r,date))return false;
 return r.freq==="daily"||rhythmDaysSince(r)>=rhythmPeriod(r);
};
dashboardRhythmEligible=function(r){
 var days=rhythmDaysSince(r),period=rhythmPeriod(r);if(days===0)return false;
 if(!rhythmMatchesDay(r))return false;
 return days>=Math.max(1,period-(period<=14?1:0));
};
todayRhythmEligible=function(r){
 if(!rhythmMatchesDay(r))return false;
 var days=rhythmDaysSince(r);if(days===999)return true;if(days===0)return false;
 var period=rhythmPeriod(r),win=Math.min(Math.ceil(period/2),7);
 return days>=Math.max(1,period-win);
};

/* ---- recurrence editor builders ---- */
function rDowPills(r,A){var sel=r.weekdays||[];return '<span class="dow-pills">'+DOW.map(function(d,i){return '<label class="dow-pill"><input type="checkbox" '+A("weekdays")+' value="'+i+'"'+(sel.indexOf(i)>=0?' checked':'')+'><span>'+d.charAt(0)+'</span></label>';}).join('')+'</span>';}
function rOrdSelect(r,A,fld){return '<select '+A(fld||"ord")+'>'+R_ORDS.map(function(o,i){return '<option value="'+(i+1)+'"'+((+r.ord||1)===i+1?' selected':'')+'>'+o+'</option>';}).join('')+'</select><select '+A("ordWeekday")+'>'+DOW.map(function(d,i){return '<option value="'+i+'"'+((+r.ordWeekday||0)===i?' selected':'')+'>'+d+'</option>';}).join('')+'</select>';}
function rMonthSelect(r,A,fld){return '<select '+A(fld||"month")+'>'+R_MOS.map(function(m,i){return '<option value="'+(i+1)+'"'+((+r.month||1)===i+1?' selected':'')+'>'+m+'</option>';}).join('')+'</select>';}
function rhythmRecurrenceHTML(r,A){
 var out="",u=rhythmUnit(r),grp="rmode-"+String(r.id||"draft").replace(/[^a-z0-9]/gi,"-");
 if(u==="weekly"||u==="weeks")out+='<div class="addrow"><span class="rlabel">On</span>'+rDowPills(r,A)+'</div>';
 if(u==="monthly"||u==="months"||u==="quarterly"){
  out+='<div class="addrow"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onDay"'+(r.monthlyMode!=="onThe"?' checked':'')+'> On day</label><input type="number" min="1" max="31" '+A("dayOfMonth")+' value="'+(r.dayOfMonth||"")+'" placeholder="any"></div>';
  out+='<div class="addrow"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onThe"'+(r.monthlyMode==="onThe"?' checked':'')+'> On the</label>'+rOrdSelect(r,A)+'</div>';
 }
 if(u==="yearly"||u==="years"){
  out+='<div class="addrow"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onDay"'+(r.monthlyMode!=="onThe"?' checked':'')+'> On</label>'+rMonthSelect(r,A,"month")+'<input type="number" min="1" max="31" '+A("monthDay")+' value="'+(r.monthDay||"")+ '" placeholder="any"></div>';
  out+='<div class="addrow"><label class="rmode"><input type="radio" name="'+grp+'" '+A("monthlyMode")+' value="onThe"'+(r.monthlyMode==="onThe"?' checked':'')+'> On the</label>'+rOrdSelect(r,A)+'<span class="rsep">of</span>'+rMonthSelect(r,A,"monthThe")+'</div>';
 }
 if(r.freq==="custom")out+='<div class="addrow"><span class="rlabel">Repeat every</span><input type="number" min="1" max="365" '+A("every")+' value="'+(+r.every||1)+'"><select '+A("unit")+'>'+["days","weeks","months","years"].map(function(x){return '<option value="'+x+'"'+((r.unit||"weeks")===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></div>';
 out+='<div class="addrow"><label class="rlabel">Until (optional)</label><input type="date" '+A("until")+' value="'+esc(r.until||"")+'"></div>';
 return out;
}
personRhythmScheduleHTML=function(r,idf){
 var A=function(f){return 'data-rfield="'+idf+'|'+f+'"';};
 return '<div class="rhythm-schedule-grid"><label class="careplan-field">Frequency<select '+A("freq")+'>'+Object.keys(RHYTHM_FREQS).map(function(k){return '<option value="'+k+'"'+(r.freq===k?' selected':'')+'>'+RHYTHM_FREQS[k].label+'</option>';}).join('')+'</select></label><label class="careplan-field">Time of day<select '+A("tod")+'>'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((r.tod||"anytime")===k?' selected':'')+'>'+esc(TODS[k])+'</option>';}).join('')+'</select></label></div>'
 +'<div class="rhy-recur">'+rhythmRecurrenceHTML(r,A)+'</div>';
};

/* ---- person page rhythm rows (profile Rhythms tab) ---- */
rhythmRow=function(p,r){
 ensureRhythm(r);
 var sc=rhythmScore(r),hasScore=Number.isFinite(sc),c=scoreClass(hasScore?sc:null),scoreText=hasScore?sc+"%":"\u2014";
 var ownerId=r.profileOwnerId||p.id,idf=ownerId+"|"+r.id;
 if(editRhythmId===r.id){
  if(!rhythmEditDraft||rhythmEditDraft.id!==r.id){rhythmEditDraft=JSON.parse(JSON.stringify(r));delete rhythmEditDraft.profileOwnerId;}
  r=rhythmEditDraft;
  var out='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="rhythm-editor-title"><div class="profile-editor-body"><h3 id="rhythm-editor-title" tabindex="-1">Edit Rhythm</h3><div class="rhyedit">';
  out+='<div class="addrow" style="margin-top:2px"><input data-rfield="'+idf+'|text" value="'+esc(r.text)+'" placeholder="What is the rhythm?"></div>';
  out+='<label class="careplan-field rhythm-description-field">Description (optional)<textarea data-rfield="'+idf+'|description" placeholder="Add context or details">'+esc(r.description||'')+'</textarea></label>';
  out+=personRhythmScheduleHTML(r,idf);
  out+=rhythmPickerControlsHTML(ownerId,r,idf);
  out+='<div class="profile-editor-actions rhythm-editor-actions"><div class="rhythm-editor-primary-actions"><button class="btn mini" data-rhyeditsave="'+idf+'">Save</button><button class="btn mini ghost" data-rhyeditcancel="1" data-editor-cancel>Cancel</button></div><button class="btn mini danger" data-rhydel="'+idf+'">'+(currentPerson!==ownerId?"Remove":"Delete")+'</button></div>';
  out+='</div></div></dialog>';
  return out;
 }
 var categories=rhythmPeopleBadges(r,p.id)+(typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(r):"");
 var last=rhythmLast(r),schedule=tendRhythmFrequencyLabel(r),status=last?"Last tended "+when(last.ts):"Not yet tended";
 var timeLabel=r.tod&&r.tod!=="anytime"&&TODS[r.tod]?TODS[r.tod]:"";
 if(rhythmEnded(r))status+=" \u00b7 ended";
 var faithShared=r.sharedFaithRhythm===true;
 var tendAction=faithShared&&typeof faithTendAction==="function"?faithTendAction(r):rhyDoneBtn(ownerId+"|"+r.id);
 var editAction=faithShared?'<button type="button" class="btn mini ghost profile-secondary-action profile-rhythm-icon-action profile-rhythm-edit-action" data-faith-rhythm-profile-edit="'+esc(r.id)+'" aria-label="Edit '+esc(r.text)+'" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8Z"/></svg></button>':'<button type="button" class="btn mini ghost profile-secondary-action profile-rhythm-icon-action profile-rhythm-edit-action" data-rhyedit="'+idf+'" aria-label="Edit '+esc(r.text)+'" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8Z"/></svg></button>';
 var removeAction=faithShared?'<button type="button" class="iconbtn profile-remove-action" data-rhydel="faith|'+esc(r.id)+'" title="Remove from profile" aria-label="Remove '+esc(r.text)+' from this profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7"/></svg></button>':"";
 var chartAction='<button type="button" class="rhythm-health profile-rhythm-health profile-rhythm-chart-action '+c+'" data-rhyhistory="'+ownerId+'|'+r.id+'" aria-label="Rhythm health '+(hasScore?sc+"%":"unknown")+'. View chart." title="View rhythm health chart"><span>'+scoreText+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/></svg></button>';
 var scheduleMeta='<div class="profile-rhythm-meta"><div class="profile-rhythm-meta-schedule"><span class="plan-item-meta-entry">'+planMetaIcon("frequency")+'<span>'+esc(schedule)+'</span></span>'+(timeLabel?'<span class="plan-item-meta-entry">'+planMetaIcon("time")+'<span>'+esc(timeLabel)+'</span></span>':"")+'<div class="profile-rhythm-meta-history"><span class="plan-item-meta-entry">'+planMetaIcon("occurred")+'<span>'+esc(status)+'</span></span></div></div></div>';
 return '<div class="rhyrow card profile-rhythm-row"><div class="profile-rhythm-main"><div class="profile-rhythm-top"><div class="profile-rhythm-heading"><div class="profile-rhythm-title-line"><strong class="tend-type-title">'+esc(r.text||"(unnamed rhythm)")+'</strong>'+editAction+'</div>'
  +(String(r.description||"").trim()?'<div class="tend-type-description">'+esc(String(r.description).trim())+'</div>':'<div class="tend-type-description no-details">No details...</div>')
  +'</div><div class="profile-rhythm-tend">'+tendAction+chartAction+'</div></div>'
  +(categories?'<div class="tend-row-people">'+categories+'</div>':'')+'</div>'
  +(removeAction?'<div class="profile-rhythm-footer"><div class="profile-rhythm-actions">'+removeAction+'</div></div>':"")
  +scheduleMeta+'</div>';
};
draftRow=function(p){
 var r=rhythmDraft,idf=p.id+"|draft";
 if(!r.weekdays)r.weekdays=[];
 var out='<div class="rhyedit">';
 out+='<div class="addrow" style="margin-top:2px"><input data-rfield="'+idf+'|text" value="'+esc(r.text||"")+'" placeholder="What is the rhythm?"></div>';
 out+='<label class="careplan-field rhythm-description-field">Description (optional)<textarea data-rfield="'+idf+'|description" placeholder="Add context or details">'+esc(r.description||'')+'</textarea></label>';
 out+=personRhythmScheduleHTML(r,idf);
 out+=rhythmPickerControlsHTML(p.id,r,idf);
 out+='</div>';
 return out;
};

/* Later overrides in this legacy file depend on Care Plan globals that load
   afterward. app-rhythms3.js provides the active implementations instead. */
return;
/* ---- care plan: rhythm edit form + save ---- */
carePlanEditHTML=function(item,key){
 var r=item.record,kind=item.kind;
 var frequencies=kind==='rhythm'?Object.keys(RHYTHM_FREQS).map(function(k){return [k,RHYTHM_FREQS[k].label];}):Object.keys(FREQS).map(function(k){return [k,FREQS[k].label];});
 var times=[['anytime','No timeframe assigned'],['allday','All day']].concat(dayBlocks().map(function(b){return [b.id,b.name];}));
 if(kind!=='rhythm')frequencies.unshift(['','No frequency']);
 var peopleOptions=[['','No person']].concat(S.people.map(function(p){return [p.id,p.name];}));
 var out='<div class="careplan-edit'+(kind==='rhythm'?' careplan-rhythm-edit':'')+'" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-'+kind+'">'+(kind==='rhythm'?'Rhythm':'Prayer')+'</span><strong>Edit '+(kind==='rhythm'?'rhythm':'prayer')+'</strong></div><label class="careplan-field">Title<input data-cpf="title" value="'+esc(r.text||'')+'"></label>';
 if(kind!=='rhythm')out+='<label class="careplan-field">Details<textarea data-cpf="details">'+esc(r.details||'')+'</textarea></label>';
 out+='<div class="careplan-edit-grid"><label class="careplan-field">Frequency<select data-cpf="frequency">'+carePlanOptions(frequencies,r.freq)+'</select></label><label class="careplan-field">Time of day<select data-cpf="tod">'+carePlanOptions(times,r.tod||'anytime')+'</select></label>';
 if(kind==='prayer')out+='<label class="careplan-field" data-schedule-day'+(scheduleHasWeekday(r.freq)?'':' hidden')+'>Day of week<select data-cpf="scheduleDow">'+scheduleDayOptions(r.scheduleDow)+'</select></label>';
 if(kind==='rhythm')out+='<label class="careplan-field">Person<select data-cpf="person">'+carePlanOptions(S.people.map(function(p){return [p.id,p.name];}),item.person.id)+'</select></label>';
 if(kind==='prayer')out+='<label class="careplan-field">Person<select data-cpf="person">'+carePlanOptions(peopleOptions,r.personId)+'</select></label><label class="careplan-field">Status<select data-cpf="status">'+carePlanOptions([['active','Active'],['answered','Answered'],['archived','Archived']],r.answered?'answered':r.archived?'archived':'active')+'</select></label>';
 out+='</div>';
 if(kind==='rhythm'){var A=function(f){return 'data-cpf="'+f+'"';};out+='<div class="rhy-recur">'+rhythmRecurrenceHTML(r,A)+'</div>';}
 out+='<div class="careplan-actions"><button type="button" class="btn mini" data-cpsave="'+esc(key)+'">Save</button><button type="button" class="btn mini ghost" data-cpcancel="'+esc(key)+'">Cancel</button><button type="button" class="btn mini ghost careplan-delete" data-cpdelete="'+esc(key)+'">Delete</button></div></div>';
 return out;
};
carePlanSave=function(key,form){
 var found=carePlanFind(key),r=found.record;if(!r)return;
 var field=function(name){return form.querySelector('[data-cpf="'+name+'"]');};
 var title=field('title').value.trim();if(!title){flash('Add a title');field('title').focus();return;}
 r.text=title;r.tod=field('tod').value;
 if(found.kind==='rhythm'){
  r.freq=field('frequency').value;
  r.weekdays=Array.prototype.slice.call(form.querySelectorAll('[data-cpf="weekdays"]:checked')).map(function(x){return +x.value;});
  var mm=form.querySelector('[data-cpf="monthlyMode"]:checked');if(mm)r.monthlyMode=mm.value;
  ['ord','ordWeekday','month','monthThe','every'].forEach(function(k){var f2=field(k);{var dst=k==="monthThe"?"month":k;r[dst]=+f2.value||1;}});
  ['dayOfMonth','monthDay'].forEach(function(k){var f2=field(k);if(f2&&f2.value!=='')r[k]=+f2.value||1;});
  var uf=field('unit');if(uf)r.unit=uf.value;
  var un=field('until');r.until=un&&un.value?un.value:null;
  ensureRhythm(r);
  var newPerson=S.people.find(function(p){return p.id===field('person').value;});
  if(newPerson&&newPerson!==found.person){found.person.rhythms=found.person.rhythms.filter(function(x){return x!==r;});newPerson.rhythms=newPerson.rhythms||[];newPerson.rhythms.push(r);}
 }
 if(found.kind==='prayer'){r.details=field('details').value.trim();r.freq=field('frequency').value||null;r.scheduleDow=r.freq&&scheduleHasWeekday(r.freq)&&field('scheduleDow')&&field('scheduleDow').value!==''?+field('scheduleDow').value:null;r.personId=field('person').value||null;var status=field('status').value;r.answered=status==='answered';r.archived=status==='archived';}
 carePlanEdit=null;save();render();flash('Updated in Care Plan');
};

/* ---- scheduled-planned line: rhythms appear once (no category doubling) ---- */
nextDateLine=function(pid){
 var base=_nextDateLine(pid);
 var p=S.people.find(function(q){return q.id===pid;});
 if(!p)return base;
 personRhythms(p).forEach(function(r){
  var s=window.rhythmScheduled(r,p);
  if(s){
   var days=Math.max(0,Math.round((s.t-new Date())/86400000));
   base+='<div class="pf-next planned">'+esc(r.text)+' \u00B7 planned for '+MOS_SHORT[s.t.getMonth()]+' '+s.t.getDate()+(days===0?" \u00B7 today":" \u00B7 in "+days+" days")+'</div>';
  }
 });
 return base;
};

/* ---- person profile pills: Rhythms = all rhythms, Prayer = prayer events ---- */
var _ppBase=personProfile;
personProfile=function(pid){
 var html=_ppBase(pid);
 var p=S.people.find(function(x){return x.id===pid;});if(!p)return html;
 var rs=personRhythms(p),pInfo=personPrayerInfo(p);
 var pScore=prayerScoreFromDays(pInfo.days),pCls=scoreClass(pScore);
 var pills;
 if(rs.length){
  var rm=avg(rs.map(rhythmScore)),rmCls=scoreClass(rm);
  var pTouch=personTouchInfo(p),tScore=touchScoreFromDays(pTouch.days),tCls=scoreClass(tScore);
  pills='<div class="pmeters three"><div class="pmeter"><div class="pm-lab"><span>Rhythms</span><span class="pm-val '+rmCls+'">'+rm+'</span></div><div class="bar"><i class="'+rmCls+'" style="width:'+rm+'%"></i></div><div class="pm-note">'+rs.length+" rhythm"+(rs.length===1?"":"s")+'</div></div>'
  +'<div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+tCls+'">'+tScore+'</span></div><div class="bar"><i class="'+tCls+'" style="width:'+tScore+'%"></i></div><div class="pm-note">'+(pTouch.last?("last: "+when(pTouch.last.ts)):"no connections yet")+'</div></div>'
  +'<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }else{
  var cInfo=personConnInfo(p),cScore=connScoreFromDays(cInfo.days,personCadenceDays(p)),cCls=scoreClass(cScore);
  pills='<div class="pmeters"><div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+cCls+'">'+cScore+'</span></div><div class="bar"><i class="'+cCls+'" style="width:'+cScore+'%"></i></div><div class="pm-note">'+(cInfo.last?("last: "+when(cInfo.last.ts)):"no connections yet")+'</div></div>'
  +'<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }
 return html.replace(/<div class="pmeters( three)?">[\s\S]*?<\/div><\/div><\/div>/,pills);
};

/* ---- handlers: create/edit rhythms (preempt the category-era handlers) ---- */
document.addEventListener("change",function(e){
 var t=e.target;
 if(!t||!t.matches||!t.matches("[data-rfield]"))return;
 var rf=t.getAttribute("data-rfield").split("|"),rr=null;
 if(rf[1]==="draft"){if(rhythmDraft&&rhythmDraft.pid===rf[0])rr=rhythmDraft;}
 else if(rhythmEditDraft&&rhythmEditDraft.id===rf[1]&&editRhythmId===rf[1])rr=rhythmEditDraft;
 if(!rr)return;
 var fld=rf[2];
 if(fld==="text"){rr.text=t.value;e.stopImmediatePropagation();return;}
 if(fld==="weekdays"){var wd=rr.weekdays||[],v=+t.value,i2=wd.indexOf(v);if(t.checked){if(i2<0)wd.push(v);}else if(i2>=0)wd.splice(i2,1);rr.weekdays=wd;render();e.stopImmediatePropagation();return;}
 if(fld==="freq"){
  rr.freq=t.value;
  if(t.value==="monthly"||t.value==="quarterly"){rr.monthlyMode=rr.monthlyMode||"onDay";rr.dayOfMonth=rr.dayOfMonth||new Date().getDate();}
  if(t.value==="yearly"){rr.monthlyMode=rr.monthlyMode||"onDay";rr.month=rr.month||(new Date().getMonth()+1);rr.monthDay=rr.monthDay||new Date().getDate();}
  if(t.value==="custom"){rr.every=rr.every||1;rr.unit=rr.unit||"weeks";if(!rr.weekdays)rr.weekdays=[];}
  if(t.value==="weekly"&&!rr.weekdays)rr.weekdays=[];
  render();e.stopImmediatePropagation();return;
 }
 if(fld==="unit"){rr.unit=t.value;if(t.value==="weeks"&&!rr.weekdays)rr.weekdays=[];render();e.stopImmediatePropagation();return;}
 if(fld==="every"||fld==="dayOfMonth"||fld==="ord"||fld==="ordWeekday"||fld==="month"||fld==="monthThe"||fld==="monthDay"){var dst=fld==="monthThe"?"month":fld;rr[dst]=+t.value||1;render();e.stopImmediatePropagation();return;}
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
    var nc={id:uid(),text:rhythmDraft.text.trim(),freq:rhythmDraft.freq||"weekly",tod:rhythmDraft.tod||"anytime"};
    RHYTHM_FIELD_LIST.forEach(function(k){var v=rhythmDraft[k];if(v===undefined||v===null||v==="")return;if(Array.isArray(v)){if(v.length)nc[k]=v.slice();}else nc[k]=v;});
    ensureRhythm(nc);rp.rhythms=rp.rhythms||[];rp.rhythms.push(nc);rhythmDraft=null;save();render();flash("Rhythm added");
   }
  }else if(rhythmDraft&&rhythmDraft.pid===ra){flash("Give the rhythm a name first");}
  else{rhythmDraft={pid:ra,text:"",freq:"weekly",tod:"anytime",weekdays:[],every:1,unit:"weeks"};render();}
  e.stopImmediatePropagation();return;
 }
},true);
})();

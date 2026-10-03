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
 var RHYTHM_FREQS={daily:{label:"Daily"},weekly:{label:"Weekly"},monthly:{label:"Monthly"},quarterly:{label:"Quarterly"},yearly:{label:"Yearly"},custom:{label:"Custom"}};
 var R_MOS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
 var R_ORDS=["1st","2nd","3rd","4th","last"];
 var RHYTHM_FIELD_LIST=["weekdays","monthlyMode","dayOfMonth","ord","ordWeekday","month","monthDay","every","unit","until"];
 /* ---- migration (mirror of rhythms2, re-applied lazily) ---- */
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
  ["customType","customDow","customOrd","scheduleDow","category","dur","durVal","durUnit"].forEach(function(k){delete r[k];});
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
 /* ---- recurrence editor builders (mirror of rhythms2) ---- */
 function rDowPills(r,A){var sel=r.weekdays||[];return '<span class="dow-pills">'+DOW.map(function(d,i){return '<label class="dow-pill"><input type="checkbox" '+A("weekdays")+' value="'+i+'"'+(sel.indexOf(i)>=0?' checked':'')+'><span>'+d.charAt(0)+'</span></label>';}).join('')+'</span>';}
 function rOrdSelect(r,A,fld){return '<select '+A(fld||"ord")+'>'+R_ORDS.map(function(o,i){return '<option value="'+(i+1)+'"'+((+r.ord||1)===i+1?' selected':'')+'>'+o+'</option>';}).join('')+'</select><select '+A("ordWeekday")+'>'+DOW.map(function(d,i){return '<option value="'+i+'"'+((+r.ordWeekday||0)===i?' selected':'')+'>'+d+'</option>';}).join('')+'</select>';}
 function rMonthSelect(r,A,fld){return '<select '+A(fld||"month")+'>'+R_MOS.map(function(m,i){return '<option value="'+(i+1)+'"'+((+r.month||1)===i+1?' selected':'')+'>'+m+'</option>';}).join('')+'</select>';}
 function rhythmRecurrenceHTML(r,A){
  var out="",u=r.freq==="custom"?(r.unit||"weeks"):r.freq,grp="rmode-"+String(r.id||"draft").replace(/[^a-z0-9]/gi,"-");
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
 /* ---- care plan edit form + save (revives rhythms2's dead overrides) ---- */
 window.carePlanEditHTML=function(item,key){
  var r=item.record,kind=item.kind;
  var frequencies=kind==='rhythm'?Object.keys(RHYTHM_FREQS).map(function(k){return [k,RHYTHM_FREQS[k].label];}):Object.keys(FREQS).map(function(k){return [k,FREQS[k].label];});
  var times=[['anytime','No timeframe assigned'],['allday','All day']].concat(dayBlocks().map(function(b){return [b.id,b.name];}));
  if(kind!=='rhythm')frequencies.unshift(['','No frequency']);
  if(kind==='goal')frequencies.push(['custom','Custom interval']);
  var peopleOptions=[['','No person']].concat(S.people.map(function(p){return [p.id,p.name];}));
  var out='<div class="careplan-edit" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-'+kind+'">'+(kind==='rhythm'?'Rhythm':kind==='prayer'?'Prayer':'Goal')+'</span><strong>Edit '+kind+'</strong></div><label class="careplan-field">Title<input data-cpf="title" value="'+esc(r.text||'')+'"></label>';
  if(kind!=='rhythm')out+='<label class="careplan-field">Details<textarea data-cpf="details">'+esc(r.details||'')+'</textarea></label>';
  out+='<div class="careplan-edit-grid"><label class="careplan-field">Frequency<select data-cpf="frequency">'+carePlanOptions(frequencies,kind==='prayer'?r.freq:kind==='goal'?(r.cadence||r.freq):r.freq)+'</select></label><label class="careplan-field">Time of day<select data-cpf="tod">'+carePlanOptions(times,r.tod||'anytime')+'</select></label>';
  if(kind!=='rhythm')out+='<label class="careplan-field" data-schedule-day'+(scheduleHasWeekday(kind==='goal'?r.cadence:r.freq)?'':' hidden')+'>Day of week<select data-cpf="scheduleDow">'+scheduleDayOptions(r.scheduleDow)+'</select></label>';
  if(kind==='rhythm')out+='<label class="careplan-field">Person<select data-cpf="person">'+carePlanOptions(S.people.map(function(p){return [p.id,p.name];}),item.person.id)+'</select></label>';
  if(kind==='prayer')out+='<label class="careplan-field">Person<select data-cpf="person">'+carePlanOptions(peopleOptions,r.personId)+'</select></label><label class="careplan-field">Status<select data-cpf="status">'+carePlanOptions([['active','Active'],['answered','Answered'],['archived','Archived']],r.answered?'answered':r.archived?'archived':'active')+'</select></label>';
  if(kind==='goal')out+='<label class="careplan-field">Area<select data-cpf="area">'+carePlanOptions(AREA_IDS.map(function(id){return [id,S.areas[id].name];}),r.area)+'</select></label>';
  out+='</div>';
  if(kind==='rhythm'){var A=function(f){return 'data-cpf="'+f+'"';};out+='<div class="rhy-recur">'+rhythmRecurrenceHTML(r,A)+'</div>';}
  if(kind==='goal')out+='<div class="careplan-custom" data-cpcustom'+(r.cadence==='custom'?'':' hidden')+'><label class="careplan-field">Every how many days?<input data-cpf="days" type="number" min="1" max="365" value="'+(r.days||2)+'"></label></div><fieldset class="careplan-people"><legend>People</legend>'+S.people.map(function(p){return '<label><input type="checkbox" data-cpperson="'+esc(p.id)+'"'+(item.people.indexOf(p.id)!==-1?' checked':'')+'>'+esc(p.name)+'</label>';}).join('')+'</fieldset>';
  out+='<div class="careplan-actions"><button type="button" class="btn mini" data-cpsave="'+esc(key)+'">Save</button><button type="button" class="btn mini ghost" data-cpcancel="'+esc(key)+'">Cancel</button><button type="button" class="btn mini ghost careplan-delete" data-cpdelete="'+esc(key)+'">Delete</button></div></div>';
  return out;
 };
 window.carePlanSave=function(key,form){
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
  if(found.kind==='goal'){r.details=field('details').value.trim();r.cadence=field('frequency').value||null;r.days=field('days')?Math.max(1,+field('days').value||2):r.days;r.area=field('area').value;r.personIds=Array.prototype.slice.call(form.querySelectorAll('[data-cpperson]:checked')).map(function(x){return x.getAttribute('data-cpperson');});r.personId=r.personIds[0]||null;}
  carePlanEdit=null;save();render();flash('Updated in Care Plan');
 };
 /* ---- person profile pills: same inputs as personScore, robust replace ---- */
 var _ppBase=window.personProfile;
 window.personProfile=function(pid){
  var html=_ppBase(pid);
  var p=S.people.find(function(x){return x.id===pid;});if(!p)return html;
  migrateAllRhythms();
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
  var i=html.indexOf('<div class="pmeters');
  if(i<0)return html;
  var tagRe=/<\/?div\b[^>]*>/g;tagRe.lastIndex=i;
  var depth=0,m2,end=-1;
  while((m2=tagRe.exec(html))){if(m2[0].charAt(1)==="/",false){}if(m2[0].charAt(1)==="/"||m2[0].slice(0,2)==="</"){depth--;}else{depth++;}if(depth===0){end=m2.index+m2[0].length;break;}}
  if(end<0)return html;
  return html.slice(0,i)+pills+html.slice(end);
 };
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
  b=e.target.closest("[data-rhyconfirm]");
  if(b){
   var rck=b.getAttribute("data-rhyconfirm").split("|");
   var rcp=S.people.find(function(x){return x.id===rck[0];});
   var rcr=rcp&&(rcp.rhythms||[]).find(function(x){return x.id===rck[1];});
   var rcd=document.querySelector('[data-rhydate="'+b.getAttribute("data-rhyconfirm")+'"]');
   var rct=document.querySelector('[data-rhytime="'+b.getAttribute("data-rhyconfirm")+'"]');
   if(rcp&&rcr&&rcd&&rcd.value){
    var rts=rcd.value+"T"+((rct&&rct.value)?rct.value:"12:00")+":00";
    rhyDoneDraft=null;actDoneAdd(rcp.id,rcr.id);
    logEvent(rcp.area,rcp.id,(/^pray/i.test(rcr.text||"")?"prayer":"quality"),rcr.text,"",new Date(rts).getTime(),null,rcr.id);
    flash("Rhythm tended \u2713");
   }
   e.stopImmediatePropagation();
  }
 },true);
})();

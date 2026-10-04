"use strict";
/* Prayer schedules, scores, and shared editor for the Prayer page, profiles, and Care Plan. */
var prayerComposerOpen=false;
var PRAYER_FREQUENCIES=[["selectdays","Select Days"],["daily","Daily"],["weekly","Weekly"],["monthly","Monthly"]];
function prayerLocalDate(value){var s=String(value||"").slice(0,10).split("-");return new Date(+s[0],(+s[1]||1)-1,+s[2]||1);}
function prayerDayString(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function prayerDayNumber(value){var d=prayerLocalDate(value);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000;}
function prayerFreq(p){return PRAYER_FREQUENCIES.some(function(x){return x[0]===p.freq;})?p.freq:"daily";}
function prayerMonthDay(p){return Math.max(1,Math.min(31,+p.monthDay||+(p.added||todayStr()).slice(8,10)||1));}
function prayerOccurs(p,ds){return recOccursOn(recNormRule(Object.assign({},p,{freq:prayerFreq(p)})),ds);}
function prayerNextDue(p,after,inclusive){var d=prayerLocalDate(after);if(!inclusive)d.setDate(d.getDate()+1);
 for(var i=0;i<380;i++,d.setDate(d.getDate()+1)){var ds=prayerDayString(d);if(p.until&&ds>p.until)return null;if(prayerOccurs(p,ds))return ds;}
 return null;
}
function prayerLogsFor(p){var logs=(p.prayerLogs||[]).filter(function(ts){return Number.isFinite(ts);}).slice();
 if(!logs.length&&p.lastPrayed){var legacy=new Date(p.lastPrayed+"T12:00:00").getTime();if(Number.isFinite(legacy))logs.push(legacy);}
 return logs.sort(function(a,b){return a-b;});
}
function prayerScore(p,now){if(!p||p.answered||p.archived||(p.until&&(now?prayerDayString(now):todayStr())>p.until))return null;var logs=prayerLogsFor(p),last=logs.length?prayerDayString(new Date(logs[logs.length-1])):null;return scheduleHealthScore(Object.assign({},p,{freq:prayerFreq(p)}),last,now?prayerDayString(now):todayStr());}
function prayerIsDue(p){if(!p||p.answered||p.archived||(p.until&&todayStr()>p.until))return false;
 var logs=prayerLogsFor(p),last=logs.length?prayerDayString(new Date(logs[logs.length-1])):null;
 if(last===todayStr())return false;
 var next=last?prayerNextDue(p,last,false):prayerNextDue(p,p.added||todayStr(),true);
 return !!next&&next<=todayStr();
}
function prayerMeterScore(person){return avg(S.prayers.filter(function(p){return p.personId===person.id&&!p.answered&&!p.archived;}).map(function(p){return prayerScore(p);}));}
function personPrayerScheduleInfo(person){var last=null;S.prayers.filter(function(p){return p.personId===person.id&&!p.answered&&!p.archived;}).forEach(function(p){prayerLogsFor(p).forEach(function(ts){if(last===null||ts>last)last=ts;});});return {last:last===null?null:{ts:last}};}
function prayerScheduleLabel(p){var f=prayerFreq(p),days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],label="Daily";
 if(f==="daily")label="Daily";
 if(f==="weekly")label="Weekly on "+days[p.scheduleDow==null?((p.weekdays||[])[0]??1):+p.scheduleDow];
 if(f==="selectdays")label="Every "+(p.weekdays||[]).slice().sort().map(function(x){return days[+x];}).join(", ");
 if(f==="monthly")label=recDescribe(Object.assign(recNormRule(Object.assign({},p,{freq:f})),{end:null})).replace(/^Every month /,'Monthly ');
 label+=" · "+(TODS[p.tod]||TODS.anytime||"Anytime");
 if(p.until)label+=" · ends "+prayerDate(p.until);
 return label;
}
function prayerEditorFields(p){p=p||{};var f=prayerFreq(p),days=(p.weekdays||[]).map(Number),checked=!!p.until;
 var frequency='<label class="prayer-field">Frequency<select data-prayer-field="freq">'+scheduleOptions(PRAYER_FREQUENCIES,f)+'</select></label>';
 var time='<label class="prayer-field">Time of day<select data-prayer-field="tod">'+scheduleOptions(Object.keys(TODS).map(function(k){return [k,TODS[k]];}),p.tod||"anytime")+'</select></label>';
 var chosen=f==="weekly"?[p.scheduleDow==null?1:+p.scheduleDow]:days;
 var circles='<div class="prayer-day-row" data-prayer-days'+(f==="selectdays"||f==="weekly"?'':' hidden')+'><span>On</span>'+scheduleWeekdayPills(chosen,'data-prayer-day',f==="selectdays")+'</div>';
 var monthItem=Object.assign({},p,{dayOfMonth:p.dayOfMonth||p.monthDay||prayerMonthDay(p)});
 var A=function(name){return 'data-prayer-field="'+name+'"';};
 var month='<div class="prayer-month-pattern rhy-recur" data-prayer-month'+(f==="monthly"?'':' hidden')+'>'+scheduleMonthPattern(monthItem,A,'prayer-month-'+(p.id||'new'))+'</div>';
 var end='<div class="prayer-end">'+scheduleEndDate(p,A,'data-prayer-end-field')+'</div>';
 return '<div class="prayer-schedule">'+frequency+time+circles+month+end+'</div>';
}
function prayerEditor(p,context){var profile=context==="profile",newPrayer=!p.id;
 var header=profile?'':'<div class="prayer-identity-fields"><label class="prayer-field">Category<select data-prayer-field="category">'+PRAYER_CATS.map(function(c){return '<option'+((p.category||"Family")===c?' selected':'')+'>'+esc(c)+'</option>';}).join("")+'</select></label><label class="prayer-field">Person<select data-prayer-field="person"><option value="">No person</option>'+S.people.map(function(person){return '<option value="'+esc(person.id)+'"'+(p.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join("")+'</select></label></div>';
 var actions='<div class="prayer-editor-actions"><button type="button" class="btn mini" '+(newPrayer?(profile?'data-personprayeradd="'+esc(p.personId)+'"':'id="prayerAdd"'):'data-prayersave="'+esc(p.id)+'"')+'>'+ (newPrayer?'Save prayer':'Save')+'</button><button type="button" class="btn mini ghost" '+(newPrayer?(profile?'data-personprayercancel="1"':'id="prayerFormCancel"'):'data-prayercancel="1"')+'>Cancel</button>'+(newPrayer?'':'<button type="button" class="btn mini danger prayer-delete" data-prayerdel="'+esc(p.id)+'">Delete</button>')+'</div>';
 return '<div class="prayer-editor" data-prayer-editor="'+(newPrayer?(profile?'new-person':'new-global'):'edit')+'"'+(profile?' data-person-id="'+esc(p.personId)+'"':'')+'>'+header+'<label class="prayer-field">Title<input data-prayer-field="title" value="'+esc(p.text||'')+'" placeholder="Prayer title"></label><label class="prayer-field">Details<textarea data-prayer-field="details" placeholder="Details (optional)">'+esc(p.details||'')+'</textarea></label>'+prayerEditorFields(p)+actions+'</div>';
}
function personPrayerAddFields(pid){var p=S.people.find(function(x){return x.id===pid;}),categories={marriage:"Marriage",parenting:"Kids",friendships:"Friends"};return prayerEditor({personId:pid,category:categories[p&&p.area]||"Family",freq:"selectdays",weekdays:[new Date().getDay()],tod:"anytime",added:todayStr()},"profile");}
function prayerCloseMenu(p){return '<details class="prayer-close-menu"><summary class="btn mini ghost">Close</summary><div class="prayer-close-options"><button type="button" data-prayerans="'+esc(p.id)+'">Answered</button><button type="button" data-prayerarchive="'+esc(p.id)+'">Archive</button></div></details>';}
function prayerItemHTML(p,profile){var person=S.people.find(function(x){return x.id===p.personId;}),count=p.prayed||0,closed=p.answered||p.archived;
 if(editingPrayerId===p.id)return '<article class="prayer-item prayer-item-editing">'+prayerEditor(p,profile?'profile':'global')+'</article>';
 var sc=prayerScore(p),scoreText=sc===null?'—%':sc+'%';
 var prayButton=closed?'':'<button class="btn mini" '+(profile?'data-prayquick="'+esc(p.personId)+'" data-prayref="'+esc(p.id)+'"':'data-pray="'+esc(p.id)+'"')+'>Pray</button>';
 var scoreClassName=sc===null?'neutral':scoreClass(sc);
 var score='<span class="rhythm-health prayer-health" title="Prayer health"><span class="sm-dot '+scoreClassName+'" aria-hidden="true"></span><span>'+scoreText+'</span></span>';
 var identity='<div class="prayer-heading"><h3 class="prayer-title">'+esc(p.text)+'</h3>'+(person&&!profile?'<span class="prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>':'')+'<span class="prayed-pill">Prayed for '+count+' '+(count===1?'time':'times')+'</span></div>';
 var details=p.details?'<p class="prayer-details">'+esc(p.details)+'</p>':'';
 var meta='<div class="gr-meta">'+esc(prayerScheduleLabel(p))+(p.lastPrayed?' · last prayed '+esc(prayerDate(p.lastPrayed)):' · not yet prayed')+' · added '+esc(prayerDate(p.added))+(p.answered?' · answered '+esc(prayerDate(p.answeredDate)):'')+(p.archived?' · archived '+esc(prayerDate(p.archivedDate)):'')+'</div>';
 var actions='<div class="prayer-row-actions">'+prayButton+(closed?'<button class="btn mini ghost" data-prayerunans="'+esc(p.id)+'">Reopen</button>':prayerCloseMenu(p))+'<button class="iconbtn rhythm-history-trigger" data-prayerhistory="'+esc(p.id)+'" aria-label="View history for '+esc(p.text)+'" title="View prayer history"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button><button class="iconbtn prayer-edit-trigger" data-prayeredit="'+esc(p.id)+'" aria-label="Edit '+esc(p.text)+'" title="Edit prayer">✎</button></div>';
 return '<article class="prayer-item prayer-rhythm-row">'+score+'<div class="prayer-content gr-main">'+identity+details+meta+'</div>'+actions+'</article>';
}
window.prayerRow=function(p){return prayerItemHTML(p,false);};
window.prayerList=function(items,profile){items=items||[];var active=items.filter(function(p){return !p.answered&&!p.archived;});
 var out=active.length?active.map(function(p){return prayerItemHTML(p,!!profile);}).join(''):'<div class="empty">No active prayer requests.</div>';
 var answered=items.filter(function(p){return p.answered;}),archived=items.filter(function(p){return p.archived;});
 if(answered.length||archived.length)out+='<div class="prayer-history-section"><div class="subhead">History</div>'+(answered.length?'<details class="prayer-past"'+(answered.some(function(p){return p.id===editingPrayerId;})?' open':'')+'><summary>Answered ('+answered.length+')</summary>'+answered.map(function(p){return prayerItemHTML(p,!!profile);}).join('')+'</details>':'')+(archived.length?'<details class="prayer-past"'+(archived.some(function(p){return p.id===editingPrayerId;})?' open':'')+'><summary>Archived ('+archived.length+')</summary>'+archived.map(function(p){return prayerItemHTML(p,!!profile);}).join('')+'</details>':'')+'</div>';
 return out;
};
window.renderPrayer=function(){var out='<div class="sectiontitle" style="margin-top:6px"><h2>Prayer</h2><span class="hint">carry these people before God</span></div>';
 out+='<div class="card prayer-compose">'+(prayerComposerOpen?prayerEditor({freq:"selectdays",weekdays:[new Date().getDay()],tod:"anytime",added:todayStr()},"global"):'<button type="button" class="btn" id="prayerFormOpen">+ Add prayer</button>')+'</div>';
 PRAYER_CATS.forEach(function(cat){var items=S.prayers.filter(function(p){return p.category===cat&&!p.answered&&!p.archived;});if(items.length)out+='<div class="card prayer-cat"><div class="subhead">'+esc(cat)+'</div>'+items.map(function(p){return prayerItemHTML(p,false);}).join('')+'</div>';});
 var closed=S.prayers.filter(function(p){return p.answered||p.archived;});if(closed.length)out+='<div class="card prayer-cat"><div class="subhead">History</div>'+window.prayerList(closed,false)+'</div>';
 if(!S.prayers.length)out+='<div class="empty">Prayers tagged with a person also show up on their profile.</div>';
 return out;
};
var prayerPreviousCarePlanEditHTML=window.carePlanEditHTML;
window.carePlanEditHTML=function(item,key){
 if(item.kind!=="prayer")return prayerPreviousCarePlanEditHTML(item,key);
 return '<div class="careplan-edit careplan-prayer-edit" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-prayer">Prayer</span><strong>Edit prayer</strong></div>'+prayerEditor(item.record,"global").replace('data-prayersave="'+esc(item.id)+'"','data-cpsave="'+esc(key)+'"')+'</div>';
};
var prayerPreviousCarePlanFreq=window.carePlanFreq;
window.carePlanFreq=function(item){return item.kind==="prayer"?prayerScheduleLabel(item.record):prayerPreviousCarePlanFreq(item);};
window.prayerHistoryData=function(p,now){now=now||new Date();var logs=prayerLogsFor(p).filter(function(ts){return ts<=now.getTime();}),freq=prayerFreq(p),unit=freq==='daily'||freq==='selectdays'?'day':freq==='monthly'?'month':'week',count=unit==='day'?30:unit==='month'?12:24;
 var end=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(unit==='week')end.setDate(end.getDate()-(end.getDay()+6)%7);if(unit==='month')end.setDate(1);
 function step(date,n){var d=new Date(date);if(unit==='month')d.setMonth(d.getMonth()+n);else d.setDate(d.getDate()+n*(unit==='week'?7:1));return d;}
 function floor(ts){var d=new Date(ts),x=new Date(d.getFullYear(),d.getMonth(),d.getDate());if(unit==='week')x.setDate(x.getDate()-(x.getDay()+6)%7);if(unit==='month')x.setDate(1);return x;}
 var start=step(end,1-count);if(logs.length&&floor(logs[0])<start)start=floor(logs[0]);
 var bins=[];for(var d=new Date(start);d<=end;d=step(d,1)){var next=step(d,1),n=logs.filter(function(ts){return ts>=d.getTime()&&ts<next.getTime();}).length;
  bins.push({label:(unit==='week'?'Week of ':'')+d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),count:n,current:d.getTime()===end.getTime()});}
 var total=Math.max(p.prayed||0,logs.length);return {unit:unit,bins:bins,total:total,unknown:Math.max(0,total-logs.length)};
};
window.openPrayerHistory=function(id){var p=S.prayers.find(function(x){return x.id===id;});if(!p)return;
 var old=document.getElementById('prayerHistoryDialog');if(old)old.remove();
 var data=prayerHistoryData(p),max=Math.max.apply(null,[1].concat(data.bins.map(function(b){return b.count;})));
 var dialog=document.createElement('dialog');dialog.id='prayerHistoryDialog';dialog.className='rhythm-history-dialog';dialog.setAttribute('aria-labelledby','prayerHistoryTitle');
 dialog.innerHTML='<div class="history-heading"><div><span class="history-eyebrow">Prayer history</span><h2 id="prayerHistoryTitle">'+esc(p.text)+'</h2></div><button class="iconbtn" data-prayerhistoryclose="1" aria-label="Close history">✕</button></div><div class="history-stat"><strong>'+data.total+'</strong> time'+(data.total===1?'':'s')+' prayed <span>across '+data.bins.length+' '+data.unit+'s</span></div><p class="settings-help">Each bar counts every Pray tap, even when the prayer was already fulfilled for that date. The score stays at 100%.</p>'+(data.unknown?'<p class="settings-help">'+data.unknown+' earlier prayer'+(data.unknown===1?' has':'s have')+' no saved date and cannot be placed on the chart.</p>':'')+'<div class="history-scroll" tabindex="0" aria-label="Prayer history chart, scroll horizontally"><div class="history-bars">'+data.bins.map(function(bin,i){return '<button class="history-column" data-prayerhistorybin="'+i+'" title="'+esc(bin.label)+': '+bin.count+' prayer'+(bin.count===1?'':'s')+'" aria-label="'+esc(bin.label)+': '+bin.count+' prayer'+(bin.count===1?'':'s')+'"><span class="history-count">'+bin.count+'</span><span class="history-track"><span class="history-fill" style="height:'+(bin.count?Math.max(4,100*bin.count/max):2)+'%;background:'+(bin.count?'#1E9C68':'var(--line)')+'"></span></span><span class="history-label">'+esc(bin.label)+(bin.current?' •':'')+'</span></button>';}).join('')+'</div></div><p class="history-selection" aria-live="polite">Select a bar to see its count.</p>';
 dialog.addEventListener('click',function(e){if(e.target.closest('[data-prayerhistoryclose]'))dialog.close();var b=e.target.closest('[data-prayerhistorybin]');if(b){var bin=data.bins[+b.getAttribute('data-prayerhistorybin')];dialog.querySelector('.history-selection').textContent=bin.label+' — '+bin.count+' prayer'+(bin.count===1?'':'s');}});
 dialog.addEventListener('close',function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();var scroll=dialog.querySelector('.history-scroll');scroll.scrollLeft=scroll.scrollWidth;
};
function prayerReadEditor(form,existing){var value=function(k){var el=form.querySelector('[data-prayer-field="'+k+'"]');return el?el.value:'';};
 var title=value('title').trim();if(!title){flash('Give the prayer a title');form.querySelector('[data-prayer-field="title"]').focus();return null;}
 var freq=value('freq');
 var weekdays=Array.from(form.querySelectorAll('[data-prayer-day]:checked')).map(function(x){return +x.value;});
 if(freq==='selectdays'&&!weekdays.length){flash('Choose at least one day');return null;}
 if(freq==='weekly'&&weekdays.length!==1){flash('Choose one day');return null;}
 var end=form.querySelector('[data-prayer-field="endEnabled"]'),until=value('until');
 if(freq&&end&&end.checked&&!until){flash('Choose an end date');form.querySelector('[data-prayer-field="until"]').focus();return null;}
 var category=form.querySelector('[data-prayer-field="category"]'),person=form.querySelector('[data-prayer-field="person"]');
 var personId=person?person.value||null:(existing&&existing.personId)||form.getAttribute('data-person-id')||null;
 var owner=S.people.find(function(p){return p.id===personId;}),categories={marriage:'Marriage',parenting:'Kids',friendships:'Friends'};
 var mode=form.querySelector('[data-prayer-field="monthlyMode"]:checked');
 return {text:title,details:value('details').trim(),category:category?category.value:(existing&&existing.category)||categories[owner&&owner.area]||'Family',personId:personId,freq:freq,tod:value('tod'),weekdays:freq==='selectdays'?weekdays:freq==='weekly'?[weekdays[0]]:[],scheduleDow:freq==='weekly'?weekdays[0]:null,monthlyMode:freq==='monthly'?(mode?mode.value:'onDay'):null,dayOfMonth:freq==='monthly'?+value('dayOfMonth'):null,monthDay:freq==='monthly'?+value('dayOfMonth'):null,ord:freq==='monthly'?+value('ord'):null,ordWeekday:freq==='monthly'?+value('ordWeekday'):null,until:end&&end.checked?until:null};
}
function prayerSaveFromForm(form,existing){var fields=prayerReadEditor(form,existing);if(!fields)return false;
 if(existing)Object.assign(existing,fields);else S.prayers.push(Object.assign({id:uid(),added:todayStr(),answered:false,archived:false,prayed:0,prayerLogs:[]},fields));
 prayerComposerOpen=false;editingPrayerId=null;window._personPrayerDraftFor=null;save();render();flash(existing?'Prayer updated':'Prayer added');return true;
}
document.addEventListener('change',function(e){var form=e.target.closest&&e.target.closest('[data-prayer-editor]');if(!form)return;
 if(e.target.matches('[data-prayer-field="freq"]')){var f=e.target.value;form.querySelector('[data-prayer-days]').hidden=f!=='weekly'&&f!=='selectdays';form.querySelector('[data-prayer-month]').hidden=f!=='monthly';var checks=form.querySelectorAll('[data-prayer-day]');var wrapper=form.querySelector('[data-schedule-days]');wrapper.setAttribute('data-schedule-days',f==='selectdays'?'multiple':'single');if(f==='weekly'&&Array.from(checks).filter(function(x){return x.checked;}).length!==1){checks.forEach(function(x){x.checked=false;});checks[1].checked=true;}if(f==='selectdays'&&!Array.from(checks).some(function(x){return x.checked;}))checks[1].checked=true;e.stopImmediatePropagation();}
 if(e.target.matches('[data-prayer-day]')){var freq=form.querySelector('[data-prayer-field="freq"]').value;if(freq==='weekly'){form.querySelectorAll('[data-prayer-day]').forEach(function(x){x.checked=x===e.target;});}else if(!Array.from(form.querySelectorAll('[data-prayer-day]')).some(function(x){return x.checked;}))e.target.checked=true;}
 if(e.target.matches('[data-prayer-field="monthlyMode"]')){var onThe=e.target.value==='onThe';form.querySelector('[data-prayer-field="dayOfMonth"]').disabled=onThe;form.querySelector('[data-prayer-field="ord"]').disabled=!onThe;form.querySelector('[data-prayer-field="ordWeekday"]').disabled=!onThe;}
 if(e.target.matches('[data-prayer-field="endEnabled"]')){var on=e.target.checked,field=form.querySelector('[data-prayer-end-field]'),date=form.querySelector('[data-prayer-field="until"]');field.hidden=!on;date.disabled=!on;date.required=on;if(!on)date.value='';e.stopImmediatePropagation();}
},true);
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#prayerFormOpen,#prayerFormCancel,#prayerAdd,[data-personprayeradd],[data-prayersave],[data-cpsave]');if(!b)return;
 if(b.id==='prayerFormOpen'){prayerComposerOpen=true;render();e.stopImmediatePropagation();return;}
 if(b.id==='prayerFormCancel'){prayerComposerOpen=false;render();e.stopImmediatePropagation();return;}
 var form=b.closest('[data-prayer-editor]');if(!form)return;
 if(b.hasAttribute('data-cpsave')){var key=b.getAttribute('data-cpsave');if(key.slice(0,7)!=='prayer|')return;var p=S.prayers.find(function(x){return x.id===key.split('|')[1];});var previous=carePlanEdit;carePlanEdit=null;if(!p||!prayerSaveFromForm(form,p))carePlanEdit=previous;e.stopImmediatePropagation();return;}
 var existing=b.hasAttribute('data-prayersave')?S.prayers.find(function(x){return x.id===b.getAttribute('data-prayersave');}):null;
 prayerSaveFromForm(form,existing);e.stopImmediatePropagation();
},true);

"use strict";
/* Prayer schedules, scores, and shared editor for the Prayer page, profiles, and Care Plan. */
var prayerComposerOpen=false;
var PRAYER_FREQUENCIES=[["selectdays","Select Days"],["daily","Daily"],["weekly","Weekly"],["monthly","Monthly"]];
function prayerLocalDate(value){var s=String(value||"").slice(0,10).split("-");return new Date(+s[0],(+s[1]||1)-1,+s[2]||1);}
function prayerDayString(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function prayerDayNumber(value){var d=prayerLocalDate(value);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000;}
function prayerTimeAgo(value){if(!value)return "";var days=Math.max(0,prayerDayNumber(todayStr())-prayerDayNumber(value));if(days===0)return "today";if(days===1)return "yesterday";if(days<14)return days+" days ago";if(days<60){var weeks=Math.floor(days/7);return weeks+" week"+(weeks===1?"":"s")+" ago";}var months=Math.floor(days/30);return months+" month"+(months===1?"":"s")+" ago";}
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
function prayerLastPrayedLabel(p){var logs=prayerLogsFor(p),last=logs.length?logs[logs.length-1]:null;return last===null?"not yet prayed":prayerTimeAgo(prayerDayString(new Date(last)));}
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
function prayerEditor(p,context){var profile=context==="profile",faith=context==="faith",newPrayer=!p.id;
 var header=profile||faith?'':'<div class="prayer-identity-fields"><label class="prayer-field">Category<select data-prayer-field="category">'+PRAYER_CATS.map(function(c){return '<option'+((p.category||"Family")===c?' selected':'')+'>'+esc(c)+'</option>';}).join("")+'</select></label><label class="prayer-field">Person<select data-prayer-field="person"><option value="">No person</option>'+S.people.map(function(person){return '<option value="'+esc(person.id)+'"'+(p.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join("")+'</select></label></div>';
 var actions='<div class="prayer-editor-actions"><button type="button" class="btn mini" '+(newPrayer?(profile?'data-personprayeradd="'+esc(p.personId)+'"':faith?'data-faith-prayer-save="1"':'id="prayerAdd"'):'data-prayersave="'+esc(p.id)+'"')+'>'+ (newPrayer?'Save prayer':'Save')+'</button><button type="button" class="btn mini ghost" '+(newPrayer?(profile?'data-personprayercancel="1"':faith?'data-faith-prayer-cancel="1"':'id="prayerFormCancel"'):'data-prayercancel="1"')+' data-editor-cancel>Cancel</button>'+(newPrayer?'':'<button type="button" class="btn mini danger prayer-delete" data-prayerdel="'+esc(p.id)+'">Delete</button>')+'</div>';
 if(faith)header='<input type="hidden" data-prayer-field="category" value="Faith">';
 return '<div class="prayer-editor" data-prayer-editor="'+(newPrayer?(profile?'new-person':'new-global'):'edit')+'"'+(profile?' data-person-id="'+esc(p.personId)+'"':'')+(faith?' data-faith-section="'+esc(p.faithSection||'Other')+'"':'')+'>'+header+'<label class="prayer-field">Title<input data-prayer-field="title" value="'+esc(p.text||'')+'" placeholder="Prayer title"></label><label class="prayer-field">Details<textarea data-prayer-field="details" placeholder="Details (optional)">'+esc(p.details||'')+'</textarea></label>'+prayerEditorFields(p)+actions+'</div>';
}
function personPrayerAddFields(pid){var p=S.people.find(function(x){return x.id===pid;}),categories={marriage:"Marriage",parenting:"Kids",friendships:"Friends"};return prayerEditor({personId:pid,category:categories[p&&p.area]||"Family",freq:"selectdays",weekdays:[new Date().getDay()],tod:"anytime",added:todayStr()},"profile");}
function prayerCloseMenu(p){return '<details class="prayer-close-menu"><summary class="btn mini ghost">Close</summary><div class="prayer-close-options"><button type="button" data-prayerans="'+esc(p.id)+'">Answered</button><button type="button" data-prayerarchive="'+esc(p.id)+'">Archive</button></div></details>';}
function prayerItemHTML(p,profile){var faith=profile==="faith",person=S.people.find(function(x){return x.id===p.personId;}),count=p.prayed||0,closed=p.answered||p.archived;
 if(editingPrayerId===p.id)return '<dialog class="profile-editor-dialog prayer-edit-dialog" data-editor-modal aria-label="Edit prayer">'+prayerEditor(p,faith?'faith':profile?'profile':'global')+'</dialog>';
 var sc=prayerScore(p),scoreText=sc===null?'-':sc+'%';
 var prayAttr=profile&&!faith?'data-prayquick="'+esc(p.personId)+'" data-prayref="'+esc(p.id)+'"':'data-pray="'+esc(p.id)+'"';
 var prayButton=closed?'':'<button class="btn mini" '+prayAttr+'>Pray</button>';
 var scoreClassName=sc===null?'neutral':scoreClass(sc);
 var score='<span class="rhythm-health prayer-health tend-type-metric" title="Prayer health"><span class="sm-dot '+scoreClassName+'" aria-hidden="true"></span><span>'+scoreText+'</span></span>';
 var identity='<div class="prayer-heading"><h3 class="prayer-title tend-type-title">'+esc(p.text)+'</h3>'+(person&&!profile?'<span class="prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>':!person&&p.faithOwner==="me"?'<span class="prayer-person">Me</span>':'')+'<span class="prayed-pill">Prayed for '+count+' '+(count===1?'time':'times')+'</span></div>';
 var details=p.details?'<p class="prayer-details tend-type-description">'+esc(p.details)+'</p>':'';
 var meta='<div class="gr-meta">'+esc(prayerScheduleLabel(p))+' · last prayed '+esc(prayerLastPrayedLabel(p))+' · added '+esc(prayerDate(p.added))+(p.answered?' · answered '+esc(prayerDate(p.answeredDate)):'')+(p.archived?' · archived '+esc(prayerDate(p.archivedDate)):'')+'</div>';
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
 out+='<div class="card prayer-compose"><button type="button" class="btn" id="prayerFormOpen">+ Add prayer</button></div>';
 if(prayerComposerOpen)out+='<dialog class="profile-editor-dialog prayer-edit-dialog" data-editor-modal aria-labelledby="prayer-compose-title"><div class="profile-editor-body"><h3 id="prayer-compose-title">Add Prayer</h3>'+prayerEditor({freq:"selectdays",weekdays:[new Date().getDay()],tod:"anytime",added:todayStr()},"global")+'</div></dialog>';
 PRAYER_CATS.forEach(function(cat){var items=S.prayers.filter(function(p){return p.category===cat&&!p.answered&&!p.archived;});if(items.length)out+='<div class="card prayer-cat"><div class="subhead">'+esc(cat)+'</div>'+items.map(function(p){return prayerItemHTML(p,false);}).join('')+'</div>';});
 var closed=S.prayers.filter(function(p){return p.answered||p.archived;});if(closed.length)out+='<div class="card prayer-cat"><div class="subhead">History</div>'+window.prayerList(closed,false)+'</div>';
 if(!S.prayers.length)out+='<div class="empty">Prayers tagged with a person also show up on their profile.</div>';
 return out;
};
var prayerPreviousCarePlanEditHTML=window.carePlanEditHTML;
window.carePlanEditHTML=function(item,key){
 if(item.kind!=="prayer")return prayerPreviousCarePlanEditHTML(item,key);
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-label="Edit prayer"><div class="profile-editor-body careplan-edit careplan-prayer-edit" data-cpform="'+esc(key)+'"><div class="careplan-edit-head"><span class="careplan-kind careplan-kind-prayer">Prayer</span><strong>Edit prayer</strong></div>'+prayerEditor(item.record,"global").replace('data-prayersave="'+esc(item.id)+'"','data-cpsave="'+esc(key)+'"').replace('data-prayercancel="1"','data-cpcancel="'+esc(key)+'" data-editor-cancel')+'</div></dialog>';
};
var prayerPreviousCarePlanFreq=window.carePlanFreq;
window.carePlanFreq=function(item){return item.kind==="prayer"?prayerScheduleLabel(item.record):prayerPreviousCarePlanFreq(item);};
window.prayerHistoryData=function(p,now){now=now||new Date();var logs=prayerLogsFor(p).filter(function(ts){return ts<=now.getTime();}),freq=prayerFreq(p),unit=freq==='daily'||freq==='selectdays'?'day':freq==='monthly'?'month':'week',count=unit==='day'?30:unit==='month'?12:26;
 S.events.forEach(function(e){var matches=e.prayerId===p.id||(e.personId===p.personId&&e.title===p.text);if(!matches||!(e.kind==="prayer"||e.type==="prayer")||!Number.isFinite(e.ts)||e.ts>now.getTime())return;if(!logs.some(function(ts){return Math.abs(ts-e.ts)<60000;}))logs.push(e.ts);});
 if(!logs.length&&p.lastPrayed){var legacy=new Date(p.lastPrayed+'T12:00:00').getTime();if(Number.isFinite(legacy)&&legacy<=now.getTime())logs.push(legacy);}
 logs.sort(function(a,b){return a-b;});
 var end=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(unit==='week')end.setDate(end.getDate()-(end.getDay()+6)%7);if(unit==='month')end.setDate(1);
 function step(date,n){var d=new Date(date);if(unit==='month')d.setMonth(d.getMonth()+n);else d.setDate(d.getDate()+n*(unit==='week'?7:1));return d;}
 function floor(ts){var d=new Date(ts),x=new Date(d.getFullYear(),d.getMonth(),d.getDate());if(unit==='week')x.setDate(x.getDate()-(x.getDay()+6)%7);if(unit==='month')x.setDate(1);return x;}
 function colorFor(score){if(!Number.isFinite(score))return "#AEB8B2";var colors=["#1E9C68","#48A94F","#76B43C","#A7B636","#CDB333","#E0A02D","#E47E2D","#E76535","#E4513D","#E34B43","#E25745"];return colors[Math.max(0,Math.min(10,Math.round((100-score)/10)))];}
 var start=step(end,1-count),created=p.added||null,createdDate=created?new Date(created+'T00:00:00'):null;if(createdDate&&Number.isFinite(createdDate.getTime())){logs=logs.filter(function(ts){return ts>=createdDate.getTime();});if(floor(createdDate)>start)start=floor(createdDate);}else createdDate=null;
 var bins=[],index=0,lastPrayer=null,rule=Object.assign({},p,{freq:freq});
 while(index<logs.length&&logs[index]<start.getTime())lastPrayer=logs[index++];
 for(var d=new Date(start);d<=end;d=step(d,1)){var next=step(d,1),n=0;
  while(index<logs.length&&logs[index]<next.getTime()){if(logs[index]>=d.getTime())n++;lastPrayer=logs[index++];}
  var current=d.getTime()===end.getTime(),cutoff=current?now:new Date(next.getTime()-1),lastDate=lastPrayer?prayerDayString(new Date(lastPrayer)):null,score=lastDate&&typeof scheduleHealthScore==="function"?scheduleHealthScore(rule,lastDate,prayerDayString(cutoff)):null;
  var label=unit==='week'?'Week of '+d.toLocaleDateString('en-US',{month:'short',day:'numeric'}):unit==='month'?d.toLocaleDateString('en-US',{month:'short',year:'numeric'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if(createdDate&&Number.isFinite(createdDate.getTime())&&d.getTime()===start.getTime()&&createdDate>d)label='Since '+createdDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  bins.push({label:label,count:n,percent:score,color:colorFor(score),current:current});}
 var total=Math.max(p.prayed||0,logs.length);return {unit:unit,bins:bins,total:total,unknown:Math.max(0,total-logs.length),range:bins.length};
};
window.openPrayerHistory=function(id){var p=S.prayers.find(function(x){return x.id===id;});if(!p)return;
 var old=document.getElementById('prayerHistoryDialog');if(old)old.remove();
 var data=prayerHistoryData(p),person=p.personId&&S.people.find(function(x){return x.id===p.personId;}),rangeUnit=data.unit==='day'?'days':data.unit==='week'?'weeks':'months',personLine=person?'<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div>':'<div class="history-person"><strong>Prayer history</strong></div>',details=prayerScheduleLabel(p);
 var dialog=document.createElement('dialog');dialog.id='prayerHistoryDialog';dialog.className='rhythm-history-dialog';dialog.setAttribute('aria-labelledby','prayerHistoryTitle');
 dialog.innerHTML=personLine+'<div class="history-heading"><div><h2 id="prayerHistoryTitle">'+esc(p.text)+'</h2><p class="history-rhythm-details">'+esc(details)+'</p>'+(p.details?'<p class="history-rhythm-description">'+esc(p.details)+'</p>':'')+'</div><button class="iconbtn" data-prayerhistoryclose="1" aria-label="Close history">✕</button></div><div class="history-stat"><strong>'+data.total+'</strong> time'+(data.total===1?'':'s')+' prayed <span>· last '+data.range+' '+rangeUnit+'</span></div>'+(data.unknown?'<p class="history-scroll-hint prayer-history-unknown">'+data.unknown+' earlier prayer'+(data.unknown===1?' has':'s have')+' no saved date.</p>':'')+(data.total?'':'<div class="history-empty">Your story starts with the first Pray.</div>')+'<div class="history-scroll" tabindex="0" aria-label="Prayer history chart, scroll horizontally"><div class="history-bars history-bars-'+data.unit+'">'+data.bins.map(function(bin){var health=Number.isFinite(bin.percent)?bin.percent+'%':'—',height=Math.max(26,180*(Number.isFinite(bin.percent)?bin.percent:0)/100),label=bin.label+(bin.current?(data.unit==='day'?' · today':' · current'):'');return '<div class="history-column" role="img" aria-label="'+esc(label)+': '+health+' prayer health, '+bin.count+' prayer'+(bin.count===1?'':'s')+'"><span class="history-track"><span class="history-fill'+(Number.isFinite(bin.percent)&&bin.percent<20?' low':'')+'" style="height:'+height+'px;background:'+bin.color+'"><span>'+health+'</span></span></span><span class="prayer-history-count">'+bin.count+'</span><span class="history-label">'+esc(label)+'</span></div>';}).join('')+'</div></div><p class="history-scroll-hint prayer-history-scroll-hint" hidden>Scroll horizontally to explore older history.</p>';
 dialog.addEventListener('click',function(e){if(e.target.closest('[data-prayerhistoryclose]'))dialog.close();});
 dialog.addEventListener('close',function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();var scroll=dialog.querySelector('.history-scroll');scroll.scrollLeft=scroll.scrollWidth;var hint=dialog.querySelector('.prayer-history-scroll-hint');if(hint)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;
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
 if(existing){Object.assign(existing,fields);if(form.hasAttribute('data-faith-section'))existing.faithSection=form.getAttribute('data-faith-section');if(form.hasAttribute('data-faith-owner'))existing.faithOwner=form.getAttribute('data-faith-owner');else if(fields.personId&&existing.faithOwner==="me")delete existing.faithOwner;}
 else S.prayers.push(Object.assign({id:uid(),added:todayStr(),answered:false,archived:false,prayed:0,prayerLogs:[]},fields,form.hasAttribute('data-faith-section')?{faithSection:form.getAttribute('data-faith-section')}: {},form.hasAttribute('data-faith-owner')?{faithOwner:form.getAttribute('data-faith-owner')}:{}));
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

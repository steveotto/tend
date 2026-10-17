"use strict";
function rhythmHistoryData(person,rhythm,now){
 now=now||new Date();
 var selectedDays=rhythm.freq==="selectdays",customUnit=rhythm.freq==="custom"?(rhythm.unit||"weeks"):"";
 var unit=rhythm.freq==='yearly'||customUnit==='years'?'year':rhythm.freq==='quarterly'||customUnit==='quarterly'?'quarter':rhythm.freq==='daily'||selectedDays||customUnit==='days'?'day':rhythm.freq==='biweekly'?'fortnight':rhythm.freq==='monthly'||(rhythm.freq==='custom'&&(customUnit==='months'||rhythm.customType==='monthly'))?'month':customUnit==='weeks'&&(+rhythm.every||1)>=2?'fortnight':'week';
 var minimum=unit==='day'?30:unit==='week'?26:unit==='fortnight'?13:unit==='month'?6:unit==='quarter'?8:2;
 function floor(date){var d=new Date(date.getFullYear(),date.getMonth(),date.getDate());if(unit==='week')d.setDate(d.getDate()-(d.getDay()+6)%7);if(unit==='fortnight'){var anchor=Date.UTC(1970,0,5),days=Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-anchor)/864e5);d.setDate(d.getDate()-((days%14)+14)%14);}if(unit==='month')d=new Date(d.getFullYear(),d.getMonth(),1);if(unit==='quarter')d=new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3,1);if(unit==='year')d=new Date(d.getFullYear(),0,1);return d;}
 function step(d,n){var result=new Date(d);if(unit==='day'||unit==='week'||unit==='fortnight')result.setDate(result.getDate()+n*(unit==='fortnight'?14:unit==='week'?7:1));else result.setMonth(result.getMonth()+n*(unit==='month'?1:unit==='quarter'?3:12));return result;}
 var events=S.events.filter(function(e){return e.rhythmId===rhythm.id&&Number.isFinite(e.ts)&&e.ts<=now.getTime();}).sort(function(a,b){return a.ts-b.ts;});
 var end=floor(now),start=step(end,1-minimum),created=rhythm.rule&&rhythm.rule.start||rhythm.start||rhythm.added,createdDate=null;
 if(created){
  createdDate=new Date(created+"T00:00:00");
  if(Number.isFinite(createdDate.getTime())&&floor(createdDate)>start)start=floor(createdDate);
  else if(!Number.isFinite(createdDate.getTime()))createdDate=null;
 }
 if(events.length&&floor(new Date(events[0].ts))<start)start=floor(new Date(events[0].ts));
 var bins=[],index=0,lastEvent=null,selectedWeekdays=Array.isArray(rhythm.weekdays)?rhythm.weekdays.map(Number):[];
 if(!selectedWeekdays.length&&Array.isArray(rhythm.scheduleDows))selectedWeekdays=rhythm.scheduleDows.map(Number);
 var cadence=typeof rhythmPeriod==="function"?rhythmPeriod(rhythm):rhythm.freq==="daily"?1:rhythm.freq==="weekly"?7:rhythm.freq==="monthly"?30:rhythm.freq==="quarterly"?91:365;
 while(index<events.length&&events[index].ts<start.getTime())lastEvent=events[index++];
 function daysBetween(a,b){var first=new Date(a.getFullYear(),a.getMonth(),a.getDate()),last=new Date(b.getFullYear(),b.getMonth(),b.getDate());return Math.round((Date.UTC(last.getFullYear(),last.getMonth(),last.getDate())-Date.UTC(first.getFullYear(),first.getMonth(),first.getDate()))/864e5);}
 function scoreAt(cutoff){
  if(!lastEvent)return null;
  if(typeof scheduleHealthScore==="function"){
   var lastDate=lastEvent&&typeof recDayString==="function"?recDayString(new Date(lastEvent.ts)):lastEvent?new Date(lastEvent.ts).toISOString().slice(0,10):null;
   var day=cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0");
   var scheduledScore=scheduleHealthScore(rhythm,lastDate,day);
   return Number.isFinite(scheduledScore)?scheduledScore:null;
  }
  if(!lastEvent)return 0;
  var since=daysBetween(new Date(lastEvent.ts),cutoff);
  if(selectedDays){
   var missed=0,day=new Date(new Date(lastEvent.ts).getFullYear(),new Date(lastEvent.ts).getMonth(),new Date(lastEvent.ts).getDate());
   day.setDate(day.getDate()+1);
   while(day<=cutoff){if(selectedWeekdays.indexOf(day.getDay())>=0)missed++;day.setDate(day.getDate()+1);}
   return Math.max(0,100-missed*10);
  }
  if(since<cadence)return 100;
  return Math.max(0,100-10*(since-cadence+1));
 }
 function colorFor(score){if(!Number.isFinite(score))return "#AEB8B2";var colors=["#1E9C68","#48A94F","#76B43C","#A7B636","#CDB333","#E0A02D","#E47E2D","#E76535","#E4513D","#E34B43","#E25745"];return colors[Math.max(0,Math.min(10,Math.round((100-score)/10)))];}
 var today=floor(now),rangeDays=daysBetween(start,end)+1;
 for(var date=new Date(start);date<=end;date=step(date,1)){
  var next=step(date,1),count=0,noteCount=0;
  while(index<events.length&&events[index].ts<next.getTime()){
   if(events[index].ts>=date.getTime()){count++;if(String(events[index].completionNote||"").trim())noteCount++;}
   lastEvent=events[index++];
  }
  var current=date.getTime()===floor(end).getTime(),cutoff=current?now:new Date(next.getTime()-1);
  var percent=scoreAt(cutoff),include=!selectedDays||!selectedWeekdays.length||selectedWeekdays.indexOf(date.getDay())>=0;
  var label=unit==='month'?date.toLocaleDateString('en-US',{month:'short'}):unit==='year'?String(date.getFullYear()):unit==='quarter'?'Q'+(Math.floor(date.getMonth()/3)+1)+' '+date.getFullYear():unit==='week'?'Week of '+date.toLocaleDateString('en-US',{month:'short',day:'numeric'}):unit==='fortnight'?'2 weeks from '+date.toLocaleDateString('en-US',{month:'short',day:'numeric'}):date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if(createdDate&&date.getTime()===start.getTime()&&createdDate>date&&createdDate<next)label='Since '+createdDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if(include)bins.push({label:label,count:count,noteCount:noteCount,percent:percent,color:colorFor(percent),current:current,weekday:date.getDay(),dayLabel:date.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase(),startTs:date.getTime(),endTs:next.getTime()});
 }
 return {unit:unit,bins:bins,total:bins.reduce(function(total,bin){return total+bin.count;},0),range:unit==="day"&&selectedDays?rangeDays:bins.length,selectedDays:selectedDays,scheduledDays:selectedWeekdays};
}
function tendRhythmMomentumHTML(rhythm,momentum){
 if(!momentum)return "";
 var score=Number.isFinite(momentum.score)?Math.max(0,Math.min(100,momentum.score)):null,tone=score===null?"neutral":typeof scoreClass==="function"?scoreClass(score):score>=75?"green":score>=50?"yellow":"red",color=score===null?"var(--line)":typeof tendHealthScoreColor==="function"?tendHealthScoreColor(score):"var(--forest)",feedback=score===null?"Building momentum":score>=90?"You're doing great!":score>=75?"Keep it going!":score>=50?"Let's build momentum.":"Time to reconnect.",name=String(rhythm.text||"this Rhythm"),plural=name.match(/s$/i)?name:name+"s",completed=Number(momentum.completed)||0,expected=Number(momentum.expected)||0,missed=Number(momentum.missed)||0,specific;
 if(score===null)specific=expected?"Keep showing up for the scheduled chances to build your score.":"Your first scheduled follow-through will start your score.";
 else if(missed===0)specific=completed===1?"You've kept your scheduled "+name+".":"You've kept all "+completed+" scheduled "+plural+".";
 else if(completed===0)specific="You've missed "+missed+" recent "+(missed===1?"opportunity":"opportunities")+" to connect.";
 else specific="You've completed "+completed+" of your last "+expected+" scheduled "+plural+".";
 var dates=(momentum.occurrences||[]),today=typeof todayStr==="function"?todayStr():new Date().toISOString().slice(0,10),past=dates.filter(function(item){return item.date<=today&&item.status!=="upcoming";}).slice(-3),upcoming=dates.find(function(item){return item.date>=today&&item.status==="upcoming";}),recent=past.concat(upcoming?[upcoming]:[]),recentTitle=past.length===1?"Your last scheduled "+name.toLowerCase():past.length?"Your last "+past.length+" "+plural.toLowerCase():"Recent scheduled chances";
 function occurrenceHTML(item){
  var date=new Date(item.date+"T12:00:00"),label=date.toLocaleDateString(undefined,{month:"short",day:"numeric",year:date.getFullYear()===new Date().getFullYear()?undefined:"numeric"}),icon=item.status==="completed"?"✓":item.status==="missed"?"•":"○",status=item.status==="completed"?"Completed":item.status==="missed"?"Missed":"Upcoming";
  return '<li class="rhythm-momentum-occurrence is-'+item.status+'" aria-label="'+status+' · '+esc(label)+'"><span aria-hidden="true">'+icon+'</span><time datetime="'+item.date+'">'+esc(label)+'</time></li>';
 }
 var summary=(momentum.window?momentum.window.label:"Measurement period")+" · "+(score===null?"Building momentum":completed+" of "+expected+" completed");
 return '<section class="rhythm-momentum-card'+(score===null?" is-unscored":"")+'" aria-labelledby="rhythm-momentum-title" style="--momentum-percent:'+(score===null?0:score)+';--momentum-angle:'+(score===null?0:score*3.6)+'deg;--momentum-color:'+color+'"><header class="rhythm-momentum-header"><h3 id="rhythm-momentum-title">Your Momentum</h3><button type="button" class="rhythm-momentum-info-trigger" data-momentum-info aria-expanded="false" aria-controls="rhythm-momentum-info" aria-label="How Momentum Works">i</button><span class="rhythm-momentum-status '+tone+'">'+(score===null?"Building":score>=75?"On track":score>=50?"Getting there":"Needs a boost")+'</span></header><div class="rhythm-momentum-main"><div class="rhythm-momentum-ring" role="img" aria-label="'+(score===null?"Building momentum":Math.round(score)+" out of 100")+'"><div class="rhythm-momentum-ring-center">'+(score===null?'<span class="rhythm-momentum-ring-empty">—</span>':'<strong>'+Math.round(score)+'</strong><small>out of 100</small>')+'</div></div><div class="rhythm-momentum-feedback"><strong>'+feedback+'</strong><p>'+esc(specific)+'</p></div></div>'+(recent.length?'<div class="rhythm-momentum-recent"><h4>'+esc(recentTitle)+'</h4><ul>'+recent.map(occurrenceHTML).join("")+'</ul></div>':'')+'<footer class="rhythm-momentum-footer"><span>'+esc(summary)+'</span></footer><div class="rhythm-momentum-info" id="rhythm-momentum-info" role="dialog" aria-labelledby="rhythm-momentum-info-title" hidden><header><h4 id="rhythm-momentum-info-title">How Momentum Works</h4><button type="button" class="iconbtn" data-momentum-info-close aria-label="Close explanation">×</button></header><p>Your Momentum Score shows how well you\'ve been keeping up with this Rhythm. Every time you follow through, you\'re building momentum. Missing scheduled times can lower your score. Getting back on track helps your score improve over time.</p><p>One completion won\'t automatically erase a long period of missed commitments, but each follow-through helps rebuild momentum.</p><details><summary>See the numbers</summary><dl><div><dt>Measurement period</dt><dd>'+esc(momentum.window?momentum.window.label:"No eligible period")+'</dd></div><div><dt>Expected occurrences</dt><dd>'+esc(String(momentum.expected))+'</dd></div><div><dt>Completed occurrences</dt><dd>'+esc(String(momentum.completed))+'</dd></div><div><dt>Missed occurrences</dt><dd>'+esc(String(momentum.missed))+'</dd></div><div><dt>Historical consistency</dt><dd>'+(Number.isFinite(momentum.consistency)?Math.round(momentum.consistency)+"%":"Not scored")+'</dd></div><div><dt>Overdue adjustment</dt><dd>−'+esc(String(momentum.overdueAdjustment||0))+' points</dd></div><div><dt>Final Momentum Score</dt><dd>'+(score===null?"Not scored":Math.round(score)+"%")+'</dd></div></dl></details></div></section>';
}
if(typeof window!=="undefined")window.tendRhythmMomentumHTML=tendRhythmMomentumHTML;
function openRhythmHistory(key,showOccurrences,onClose){
 var ids=key.split('|'),isFaith=ids[0]==="faith",isArea=ids[0]==="area-rhythm",isFitness=ids[0]==="fitness",person=isFaith?{id:"faith",name:"Faith"}:isArea?{id:"area-rhythm:"+ids[1],name:S.areas[ids[1]]?S.areas[ids[1]].name:"Category"}:isFitness?{id:"health",name:"Health & Fitness"}:S.people.find(function(p){return p.id===ids[0];}),rhythm=isFaith?S.rhythms.find(function(r){return r.id===ids[1]&&r.category==="faith";}):isArea?(S.areaRhythms||[]).find(function(r){return r.id===ids[2]&&Array.isArray(r.areas)&&r.areas.indexOf(ids[1])!==-1;}):isFitness?fitnessRhythmRecords().find(function(r){return r.id===ids[1];}):person&&(person.rhythms||[]).find(function(r){return r.id===ids[1];});if(!rhythm)return;
 if(isFitness)rhythm=Object.assign({},rhythm,{type:rhythm.fitnessType});
 var previous=document.getElementById('rhythmHistoryDialog');if(previous)previous.remove();
 var data=rhythmHistoryData(person,rhythm),details=rhythmFreqLabel(rhythm)+(rhythm.tod&&rhythm.tod!=="anytime"?" · "+(TODS[rhythm.tod]||rhythm.tod):"");
 var events=S.events.filter(function(event){return event.rhythmId===rhythm.id&&Number.isFinite(event.ts);}).sort(function(a,b){return b.ts-a.ts;});
 var unitLabels={day:"day",week:"week",fortnight:"2-week period",month:"month",quarter:"quarter",year:"year"},rangeUnit=data.selectedDays?"day":data.unit,rangeLabel=data.range+" "+(data.range===1?unitLabels[rangeUnit]:unitLabels[rangeUnit]+"s");
 var marriageAreas=Array.isArray(rhythm.areas)?rhythm.areas:[],marriageHistory=typeof window.tendMarriageRhythmConsistency==="function"&&(isArea&&ids[1]==="marriage"||marriageAreas.indexOf("marriage")!==-1||String(rhythm.sourceTemplateId||"").indexOf("marriage.")===0),marriageConsistency=marriageHistory?window.tendMarriageRhythmConsistency(rhythm):null;
 function countLabel(value){return Number.isInteger(value)?String(value):Number(value).toFixed(1);}
 var marriageSummary=marriageConsistency?tendRhythmMomentumHTML(rhythm,marriageConsistency)+'<h3 class="marriage-history-chart-title">All completion history</h3>':"";
 var dialog=document.createElement('dialog');dialog.id='rhythmHistoryDialog';dialog.className='rhythm-history-dialog';dialog.setAttribute('aria-labelledby','rhythmHistoryTitle');
 function historyElement(attribute,value){return Array.prototype.slice.call(dialog.querySelectorAll("["+attribute+"]")).find(function(node){return node.getAttribute(attribute)===value;})||null;}
 var momentumInfo=null,momentumInfoTrigger=null;
 function closeMomentumInfo(restoreFocus){
  if(!momentumInfo||momentumInfo.hidden)return;
  momentumInfo.hidden=true;
  if(momentumInfoTrigger){momentumInfoTrigger.setAttribute("aria-expanded","false");if(restoreFocus)momentumInfoTrigger.focus();}
 }
 dialog.addEventListener("click",function(e){
  if(e.target.closest("[data-momentum-info]")&&momentumInfo){momentumInfo.hidden=false;momentumInfoTrigger.setAttribute("aria-expanded","true");var close=momentumInfo.querySelector("[data-momentum-info-close]");if(close)close.focus();return;}
  if(e.target.closest("[data-momentum-info-close]")){closeMomentumInfo(true);}
 });
 dialog.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&momentumInfo&&!momentumInfo.hidden){e.preventDefault();e.stopPropagation();closeMomentumInfo(true);}
 });
 function refreshHistoryNoteIndicators(){
  Array.prototype.forEach.call(dialog.querySelectorAll("[data-history-bin-start]"),function(column){
   var start=Number(column.getAttribute("data-history-bin-start")),end=Number(column.getAttribute("data-history-bin-end")),count=S.events.filter(function(event){return event.rhythmId===rhythm.id&&event.ts>=start&&event.ts<end&&String(event.completionNote||"").trim();}).length;
   var indicator=column.querySelector(".history-note-indicator");
   if(count&&!indicator){indicator=document.createElement("span");indicator.className="history-note-indicator";var label=column.querySelector(".history-label");if(label)label.appendChild(indicator);}
   if(indicator){if(!count)indicator.remove();else{indicator.textContent=count+" "+(count===1?"note":"notes");indicator.setAttribute("aria-label",count+" memories");indicator.title=count+" memories";}}
   var labelText=column.getAttribute("aria-label").replace(/, \d+ with memories/,"");
   column.setAttribute("aria-label",labelText+(count?", "+count+" with memories":""));
  });
 }
 dialog.innerHTML='<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="rhythmHistoryTitle">'+esc(rhythm.text)+'</h2><p class="history-rhythm-details">'+esc(details)+'</p>'+(rhythm.description?'<p class="history-rhythm-description">'+esc(rhythm.description)+'</p>':'')+'</div><button class="iconbtn" data-historyclose="1" aria-label="Close history">✕</button></div>'+marriageSummary+'<div class="history-stat"><strong>'+data.total+'</strong> moments tended <span>across '+esc(rangeLabel)+'</span></div>'+(!data.total?'<div class="history-empty">Your story starts with the first Tend.</div>':'')+'<div class="history-scroll" tabindex="0" aria-label="Rhythm history chart, scroll horizontally"><div class="history-bars history-bars-'+data.unit+'">'+data.bins.map(function(b){var active=Number.isFinite(b.percent),healthLabel=active?String(b.percent):"—",height=Math.max(26,180*(active?b.percent:0)/100),noteIndicator=b.noteCount?'<span class="history-note-indicator" aria-label="'+b.noteCount+' memories" title="'+b.noteCount+' memories">Note</span>':"",dayCircle=data.selectedDays?'<span class="history-day-circle">'+DOW_SHORT[b.weekday]+'</span><span class="history-label">'+esc(b.dayLabel)+noteIndicator+'</span>':'<span class="history-label">'+esc(b.label)+(b.current?' · today':'')+noteIndicator+'</span>';return '<div class="history-column" data-history-bin-start="'+b.startTs+'" data-history-bin-end="'+b.endTs+'" role="img" aria-label="'+esc(b.label)+': '+healthLabel+(active?' out of 100':'')+' rhythm health, '+b.count+' logged moments'+(b.noteCount?', '+b.noteCount+' with memories':'')+'"><span class="history-track"><span class="history-fill'+(active&&b.percent<20?' low':'')+'" style="height:'+height+'px;background:'+(active&&typeof tendHealthScoreColor==="function"?tendHealthScoreColor(b.percent):b.color)+'"><span>'+healthLabel+'</span></span></span>'+(data.selectedDays?'<span class="history-day-label">'+dayCircle+'</span>':dayCircle)+'</div>';}).join('')+'</div></div><p class="history-scroll-hint" hidden>Scroll horizontally to explore older history.</p>';
 momentumInfo=dialog.querySelector(".rhythm-momentum-info");momentumInfoTrigger=dialog.querySelector("[data-momentum-info]");
 if(events.length)dialog.insertAdjacentHTML('beforeend','<details class="history-occurrences"'+(showOccurrences?' open':'')+'><summary>Logged moments ('+events.length+')</summary><div class="history-occurrence-list">'+events.map(function(event){var timestamp=new Date(event.ts).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}),hasNote=String(event.completionNote||"").trim();return '<article class="history-occurrence" data-history-event="'+esc(event.id)+'"><div class="history-occurrence-main"><span><strong>'+esc(event.title||rhythm.text||"Tended rhythm")+'</strong><time datetime="'+new Date(event.ts).toISOString()+'">'+esc(timestamp)+'</time></span>'+(hasNote?'<p class="history-completion-note">'+esc(event.completionNote)+'</p>':'')+'<details class="history-note-editor"><summary>'+ (hasNote?"Edit memory":"Add a memory")+'</summary><label class="sr-only" for="history-note-'+esc(event.id)+'">Memory for '+esc(timestamp)+'</label><textarea id="history-note-'+esc(event.id)+'" maxlength="500" rows="2" data-history-note-text="'+esc(event.id)+'">'+esc(event.completionNote||"")+'</textarea><div class="history-note-actions"><small>Up to 500 characters</small><button type="button" class="btn mini ghost" data-history-note-remove="'+esc(event.id)+'">Remove</button><button type="button" class="btn mini" data-history-note-save="'+esc(event.id)+'">Save</button></div></details></div><button type="button" class="btn mini ghost history-occurrence-delete" data-history-delete="'+esc(event.id)+'" aria-label="Delete occurrence from '+esc(timestamp)+'">Delete</button></article>';}).join('')+'</div></details>');
 dialog.addEventListener('click',function(e){
  if(e.target.closest('[data-historyclose]')){dialog.close();return;}
  var noteSave=e.target.closest('[data-history-note-save]'),noteRemove=e.target.closest('[data-history-note-remove]');
  if(noteSave||noteRemove){
   var noteEventId=(noteSave||noteRemove).getAttribute(noteSave?'data-history-note-save':'data-history-note-remove'),noteEvent=S.events.find(function(item){return item.id===noteEventId&&item.rhythmId===rhythm.id;});
   if(!noteEvent)return;
   var noteField=historyElement("data-history-note-text",noteEventId),noteValue=noteRemove?"":noteField&&noteField.value||"",noteRow=historyElement("data-history-event",noteEventId),editor=noteRow&&noteRow.querySelector('.history-note-editor');
   tendSaveRhythmCompletionNote(noteEventId,noteValue,function(note){
    var notePreview=noteRow&&noteRow.querySelector('.history-completion-note');
    if(note){if(notePreview)notePreview.textContent=note;else if(noteRow){notePreview=document.createElement('p');notePreview.className='history-completion-note';notePreview.textContent=note;editor.parentNode.insertBefore(notePreview,editor);}}
    else if(notePreview)notePreview.remove();
    if(editor){var editorField=editor.querySelector('[data-history-note-text]'),editorSummary=editor.querySelector('summary');if(editorField)editorField.value=note||"";editor.open=false;editorSummary.textContent=note?"Edit memory":"Add a memory";editorSummary.focus();}
    refreshHistoryNoteIndicators();
    flash(noteRemove?"Memory removed":note?"Memory saved":"Memory cleared");
   },function(error){flash(error.message||"Could not save this memory");});
   return;
  }
  var remove=e.target.closest('[data-history-delete]');if(!remove)return;
  var eventId=remove.getAttribute('data-history-delete'),event=S.events.find(function(item){return item.id===eventId&&item.rhythmId===rhythm.id;});
  if(!event)return;
  if(event.fitnessLogId){var logId=event.fitnessLogId,collection=["workouts","runs","weighIns"].find(function(name){return (S.fitness[name]||[]).some(function(item){return item.id===logId;});});if(collection)fitnessStoreDelete(collection,logId);else{S.events=S.events.filter(function(item){return item!==event;});save();}}
  else{S.events=S.events.filter(function(item){return item!==event;});save();}
  dialog.close();render();openRhythmHistory(key,true);flash('Tend removed from history');
 });
 dialog.addEventListener('close',function(){dialog.remove();if(typeof onClose==="function")onClose();});document.body.appendChild(dialog);tendShowModal(dialog);var scroll=dialog.querySelector('.history-scroll');scroll.scrollLeft=scroll.scrollWidth;var hint=dialog.querySelector('.history-scroll-hint');if(hint)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;
}

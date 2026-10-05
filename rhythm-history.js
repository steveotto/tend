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
  var next=step(date,1),count=0;
  while(index<events.length&&events[index].ts<next.getTime()){
   if(events[index].ts>=date.getTime())count++;
   lastEvent=events[index++];
  }
  var current=date.getTime()===floor(end).getTime(),cutoff=current?now:new Date(next.getTime()-1);
  var percent=scoreAt(cutoff),include=!selectedDays||!selectedWeekdays.length||selectedWeekdays.indexOf(date.getDay())>=0;
  var label=unit==='month'?date.toLocaleDateString('en-US',{month:'short'}):unit==='year'?String(date.getFullYear()):unit==='quarter'?'Q'+(Math.floor(date.getMonth()/3)+1)+' '+date.getFullYear():unit==='week'?'Week of '+date.toLocaleDateString('en-US',{month:'short',day:'numeric'}):unit==='fortnight'?'2 weeks from '+date.toLocaleDateString('en-US',{month:'short',day:'numeric'}):date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if(createdDate&&date.getTime()===start.getTime()&&createdDate>date&&createdDate<next)label='Since '+createdDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if(include)bins.push({label:label,count:count,percent:percent,color:colorFor(percent),current:current,weekday:date.getDay(),dayLabel:date.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()});
 }
 return {unit:unit,bins:bins,total:bins.reduce(function(total,bin){return total+bin.count;},0),range:unit==="day"&&selectedDays?rangeDays:bins.length,selectedDays:selectedDays,scheduledDays:selectedWeekdays};
}
function openRhythmHistory(key){
 var ids=key.split('|'),isFaith=ids[0]==="faith",isArea=ids[0]==="area-rhythm",person=isFaith?{id:"faith",name:"Faith"}:isArea?{id:"area-rhythm:"+ids[1],name:S.areas[ids[1]]?S.areas[ids[1]].name:"Category"}:S.people.find(function(p){return p.id===ids[0];}),rhythm=isFaith?S.rhythms.find(function(r){return r.id===ids[1]&&r.category==="faith";}):isArea?(S.areaRhythms||[]).find(function(r){return r.id===ids[2]&&Array.isArray(r.areas)&&r.areas.indexOf(ids[1])!==-1;}):person&&(person.rhythms||[]).find(function(r){return r.id===ids[1];});if(!rhythm)return;
 var previous=document.getElementById('rhythmHistoryDialog');if(previous)previous.remove();
 var data=rhythmHistoryData(person,rhythm),details=rhythmFreqLabel(rhythm)+(rhythm.tod&&rhythm.tod!=="anytime"?" · "+(TODS[rhythm.tod]||rhythm.tod):"");
 var unitLabels={day:"day",week:"week",fortnight:"2-week period",month:"month",quarter:"quarter",year:"year"},rangeUnit=data.selectedDays?"day":data.unit,rangeLabel=data.range+" "+(data.range===1?unitLabels[rangeUnit]:unitLabels[rangeUnit]+"s");
 var dialog=document.createElement('dialog');dialog.id='rhythmHistoryDialog';dialog.className='rhythm-history-dialog';dialog.setAttribute('aria-labelledby','rhythmHistoryTitle');
 dialog.innerHTML='<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="rhythmHistoryTitle">'+esc(rhythm.text)+'</h2><p class="history-rhythm-details">'+esc(details)+'</p>'+(rhythm.description?'<p class="history-rhythm-description">'+esc(rhythm.description)+'</p>':'')+'</div><button class="iconbtn" data-historyclose="1" aria-label="Close history">✕</button></div><div class="history-stat"><strong>'+data.total+'</strong> moments tended <span>across '+esc(rangeLabel)+'</span></div>'+(!data.total?'<div class="history-empty">Your story starts with the first Tend.</div>':'')+'<div class="history-scroll" tabindex="0" aria-label="Rhythm history chart, scroll horizontally"><div class="history-bars history-bars-'+data.unit+'">'+data.bins.map(function(b){var active=Number.isFinite(b.percent),healthLabel=active?b.percent+"%":"—",height=Math.max(26,180*(active?b.percent:0)/100),dayCircle=data.selectedDays?'<span class="history-day-circle">'+DOW_SHORT[b.weekday]+'</span><span class="history-label">'+esc(b.dayLabel)+'</span>':'<span class="history-label">'+esc(b.label)+(b.current?' · today':'')+'</span>';return '<div class="history-column" role="img" aria-label="'+esc(b.label)+': '+healthLabel+' rhythm health, '+b.count+' logged moments"><span class="history-track"><span class="history-fill'+(active&&b.percent<20?' low':'')+'" style="height:'+height+'px;background:'+b.color+'"><span>'+healthLabel+'</span></span></span>'+(data.selectedDays?'<span class="history-day-label">'+dayCircle+'</span>':dayCircle)+'</div>';}).join('')+'</div></div><p class="history-scroll-hint" hidden>Scroll horizontally to explore older history.</p>';
 dialog.addEventListener('click',function(e){if(e.target.closest('[data-historyclose]'))dialog.close();});
 dialog.addEventListener('close',function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();var scroll=dialog.querySelector('.history-scroll');scroll.scrollLeft=scroll.scrollWidth;var hint=dialog.querySelector('.history-scroll-hint');if(hint)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;
}

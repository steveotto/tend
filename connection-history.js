"use strict";
function connectionHistoryData(person,now){
 now=now||new Date();
 var today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),events=S.events.filter(function(event){return eventHasPerson(event,person.id)&&connectionEvent(event)&&Number.isFinite(event.ts)&&event.ts<=now.getTime();}).sort(function(a,b){return a.ts-b.ts;});
 var start=new Date(today);start.setDate(start.getDate()-29);
 if(events.length){var first=new Date(events[0].ts);first=new Date(first.getFullYear(),first.getMonth(),first.getDate());if(first<start)start=first;}
 function dayDiff(a,b){return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);}
 function colorFor(score){if(!Number.isFinite(score))return "#AEB8B2";var colors=["#1E9C68","#48A94F","#76B43C","#A7B636","#CDB333","#E0A02D","#E47E2D","#E76535","#E4513D","#E34B43","#E25745"];return colors[Math.max(0,Math.min(10,Math.round((100-score)/10)))];}
 var bins=[],index=0,last=null,cadence=personCadenceDays(person),total=0;
 while(index<events.length&&new Date(events[index].ts)<start)last=events[index++];
 for(var date=new Date(start);date<=today;date.setDate(date.getDate()+1)){
  var next=new Date(date);next.setDate(next.getDate()+1);var count=0;
  while(index<events.length&&events[index].ts<next.getTime()){last=events[index++];count++;}
  total+=count;
  var score=last?Math.max(0,100-10*Math.max(0,Math.floor(dayDiff(new Date(last.ts),date)-cadence)+1)):null;
  bins.push({date:new Date(date),count:count,score:score,color:colorFor(score),current:date.getTime()===today.getTime()});
 }
 return {bins:bins,total:total,events:events,range:bins.length};
}
function connectionHistoryBarsHTML(data){
 return data.bins.map(function(bin){
  var percent=Number.isFinite(bin.score),health=percent?bin.score+"%":"—",height=Math.max(26,180*(percent?bin.score:0)/100),label=bin.date.toLocaleDateString("en-US",{month:"short",day:"numeric"}),fullDate=bin.date.toLocaleDateString("en-US",{dateStyle:"full"}),key=bin.date.getFullYear()+"-"+String(bin.date.getMonth()+1).padStart(2,"0")+"-"+String(bin.date.getDate()).padStart(2,"0");
  return '<button type="button" class="history-column connection-history-column" data-connection-history-day="'+key+'" aria-label="'+esc(fullDate)+": "+health+" connection health, "+bin.count+' connections"><span class="history-track"><span class="history-fill'+(percent&&bin.score<20?' low':'')+'" style="height:'+height+'px;background:'+bin.color+'"><span>'+health+'</span></span></span><span class="history-label">'+esc(label)+(bin.current?' · today':'')+'</span><span class="prayer-history-count connection-history-count">'+bin.count+'</span></button>';
 }).join("");
}
function connectionDayKeyParts(key){var parts=key.split("-").map(Number);return {from:new Date(parts[0],parts[1]-1,parts[2]).getTime(),to:new Date(parts[0],parts[1]-1,parts[2]+1).getTime()};}
function renderConnectionDayDialog(dialog,key,data){
 var range=connectionDayKeyParts(key),dayEvents=data.events.filter(function(item){return item.ts>=range.from&&item.ts<range.to;}).sort(function(a,b){return b.ts-a.ts;});
 dialog.setAttribute("data-connection-day-key",key);
 dialog.innerHTML='<div class="history-heading"><div><h2 id="connectionDayTitle">'+esc(new Date(range.from).toLocaleDateString(undefined,{dateStyle:"full"}))+'</h2><p class="history-rhythm-details">'+dayEvents.length+' connection'+(dayEvents.length===1?"":"s")+'</p></div><button class="iconbtn" data-connection-day-close aria-label="Close day details">✕</button></div>'+(dayEvents.length?'<div class="connection-list connection-day-list">'+dayEvents.map(function(item){return rippleLine(item);}).join("")+'</div>':'<div class="history-empty">No connections were logged on this day.</div>');
}
function openConnectionHistory(personId){
 var person=S.people.find(function(item){return item.id===personId;});if(!person)return;
 var existing=document.getElementById("connectionHistoryDialog");if(existing)existing.remove();
 var data=connectionHistoryData(person),dialog=document.createElement("dialog");dialog.id="connectionHistoryDialog";dialog.className="rhythm-history-dialog connection-history-dialog";dialog.setAttribute("aria-labelledby","connectionHistoryTitle");
 var rangeLabel=data.range+" days";
 dialog.setAttribute("data-connection-history-person",personId);
 dialog.innerHTML='<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="connectionHistoryTitle">Connection history</h2><p class="connection-cadence-label"><span>Connection Cadence:</span><span class="connection-cadence-badge">'+esc(personCadenceLabel(person))+'</span></p></div><button class="iconbtn" data-connection-history-close aria-label="Close history">✕</button></div><div class="history-stat"><strong>'+data.total+'</strong> connections <span>across '+rangeLabel+'</span></div>'+(!data.total?'<div class="history-empty">Your connection story starts with the first shared moment.</div>':'')+'<div class="history-scroll" tabindex="0" aria-label="Connection history chart, scroll horizontally"><div class="history-bars history-bars-day">'+connectionHistoryBarsHTML(data)+'</div></div><p class="history-scroll-hint" hidden>Scroll horizontally to explore older connection history.</p>';
 dialog._refreshHistory=function(){
  data=connectionHistoryData(person);
  var stat=dialog.querySelector(".history-stat"),empty=dialog.querySelector(".history-empty"),chart=dialog.querySelector(".history-bars-day"),scroll=dialog.querySelector(".history-scroll"),day=document.querySelector(".connection-day-dialog"),scrollLeft=scroll?scroll.scrollLeft:0;
  if(stat)stat.innerHTML='<strong>'+data.total+'</strong> connections <span>across '+data.range+' days</span>';
  if(!data.total&&!empty){empty=document.createElement("div");empty.className="history-empty";empty.textContent="Your connection story starts with the first shared moment.";stat.insertAdjacentElement("afterend",empty);}
  else if(data.total&&empty&&empty.parentNode===dialog)empty.remove();
  if(chart)chart.innerHTML=connectionHistoryBarsHTML(data);
  if(scroll)scroll.scrollLeft=scrollLeft;
  var hint=dialog.querySelector(".history-scroll-hint");if(hint&&scroll)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;
  if(day)renderConnectionDayDialog(day,day.getAttribute("data-connection-day-key"),data);
 };
 dialog.addEventListener("click",function(event){
  if(event.target.closest("[data-connection-history-close]")){dialog.close();return;}
  var column=event.target.closest("[data-connection-history-day]");if(!column)return;
  var key=column.getAttribute("data-connection-history-day");
  var dayDialog=document.createElement("dialog");dayDialog.className="rhythm-history-dialog connection-day-dialog";dayDialog.setAttribute("aria-labelledby","connectionDayTitle");
  renderConnectionDayDialog(dayDialog,key,data);
  dayDialog.addEventListener("click",function(e){if(e.target.closest("[data-connection-day-close]"))dayDialog.close();});
  dayDialog.addEventListener("close",function(){dayDialog.remove();});document.body.appendChild(dayDialog);tendShowModal(dayDialog);
 });
 dialog.addEventListener("close",function(){var day=document.querySelector(".connection-day-dialog");if(day)day.close();dialog.remove();});
 document.body.appendChild(dialog);tendShowModal(dialog);var scroll=dialog.querySelector(".history-scroll");scroll.scrollLeft=scroll.scrollWidth;var hint=dialog.querySelector(".history-scroll-hint");if(hint)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;
}
function refreshConnectionHistoryDialog(){var dialog=document.getElementById("connectionHistoryDialog");if(dialog&&typeof dialog._refreshHistory==="function")dialog._refreshHistory();}

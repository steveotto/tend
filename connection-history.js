"use strict";
var CONNECTION_HISTORY_BATCH_SIZE=40;
function connectionHistoryEvents(personId){
 return S.events.filter(function(event){return eventHasPerson(event,personId)&&connectionEvent(event)&&Number.isFinite(Number(event.ts));}).sort(function(a,b){return Number(b.ts)-Number(a.ts);});
}
function connectionHistoryData(person,now){
 now=now||new Date();
 var today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),events=connectionHistoryEvents(person.id),chartEvents=events.filter(function(event){return Number(event.ts)<=now.getTime();}).slice().reverse();
 var start=new Date(today);start.setDate(start.getDate()-29);
 if(chartEvents.length){var first=new Date(Number(chartEvents[0].ts));first=new Date(first.getFullYear(),first.getMonth(),first.getDate());if(first<start)start=first;}
 function dayDiff(a,b){return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);}
 function colorFor(score){if(!Number.isFinite(score))return "#AEB8B2";var colors=["#1E9C68","#48A94F","#76B43C","#A7B636","#CDB333","#E0A02D","#E47E2D","#E76535","#E4513D","#E34B43","#E25745"];return colors[Math.max(0,Math.min(10,Math.round((100-score)/10)))];}
 var bins=[],index=0,last=null,cadence=personCadenceDays(person),total=0;
 while(index<chartEvents.length&&new Date(Number(chartEvents[index].ts))<start)last=chartEvents[index++];
 for(var date=new Date(start);date<=today;date.setDate(date.getDate()+1)){
  var next=new Date(date);next.setDate(next.getDate()+1);var count=0;
  while(index<chartEvents.length&&Number(chartEvents[index].ts)<next.getTime()){last=chartEvents[index++];count++;}
  total+=count;
  var score=last?Math.max(0,100-10*Math.max(0,Math.floor(dayDiff(new Date(Number(last.ts)),date)-cadence)+1)):null;
  bins.push({date:new Date(date),count:count,score:score,color:colorFor(score),current:date.getTime()===today.getTime()});
 }
 return {bins:bins,total:total,events:events,chartEvents:chartEvents,range:bins.length,start:bins[0]&&bins[0].date,end:today};
}
function connectionHistoryDateKey(date){
 return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function connectionHistoryDateLabel(date,now){
 var day=new Date(date.getFullYear(),date.getMonth(),date.getDate()),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),delta=Math.round((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(day.getFullYear(),day.getMonth(),day.getDate()))/86400000);
 if(delta===0)return "Today";
 if(delta===1)return "Yesterday";
 return day.toLocaleDateString(undefined,{dateStyle:"full"});
}
function connectionHistoryBarsHTML(data,selectedDay){
 return data.bins.map(function(bin){
  var percent=Number.isFinite(bin.score),health=percent?bin.score+"%":"—",height=Math.max(26,180*(percent?bin.score:0)/100),label=bin.date.toLocaleDateString(undefined,{month:"short",day:"numeric"}),fullDate=bin.date.toLocaleDateString(undefined,{dateStyle:"full"}),key=connectionHistoryDateKey(bin.date);
  return '<button type="button" class="history-column connection-history-column'+(key===selectedDay?" is-selected":"")+'" data-connection-history-day="'+key+'" aria-pressed="'+(key===selectedDay)+'" aria-label="'+esc(fullDate)+": "+health+" connection health, "+bin.count+' connections"><span class="history-track"><span class="history-fill'+(percent&&bin.score<20?' low':'')+'" style="height:'+height+'px;background:'+bin.color+'"><span>'+health+'</span></span></span><span class="history-label">'+esc(label)+(bin.current?' · today':'')+'</span><span class="prayer-history-count connection-history-count">'+bin.count+'</span></button>';
 }).join("");
}
function connectionHistoryDayEvents(data,key){
 var parts=key.split("-").map(Number),from=new Date(parts[0],parts[1]-1,parts[2]).getTime(),to=new Date(parts[0],parts[1]-1,parts[2]+1).getTime();
 return data.chartEvents.filter(function(event){return Number(event.ts)>=from&&Number(event.ts)<to;});
}
function connectionHistoryListHTML(data,personId,limit){
 var groups=[],today=new Date(),seen=0;
 data.events.forEach(function(event){
  var date=new Date(Number(event.ts)),key=connectionHistoryDateKey(date),group=groups[groups.length-1];
  if(!group||group.key!==key){group={key:key,date:date,events:[]};groups.push(group);}
  group.events.push(event);
 });
 var html=groups.map(function(group){var remaining=Math.max(0,limit-seen),visible=group.events.slice(0,remaining);seen+=group.events.length;if(!visible.length)return "";return '<section class="connection-history-date-group" aria-labelledby="connection-history-date-'+group.key+'"><h3 id="connection-history-date-'+group.key+'">'+esc(connectionHistoryDateLabel(group.date,today))+'</h3><div class="connection-list">'+visible.map(function(event){return connectionCardHTML(event,personId);}).join("")+'</div></section>';}).join("");
 return html+(limit<data.events.length?'<button type="button" class="btn mini ghost connection-history-load-more" data-connection-history-load-more>Load more</button>':"");
}
function openConnectionHistory(personId,initialView){
 var person=S.people.find(function(item){return item.id===personId;});if(!person)return;
 var existing=document.getElementById("connectionHistoryDialog");if(existing)existing.close();
 var data=connectionHistoryData(person),todayKey=connectionHistoryDateKey(new Date()),state={view:initialView==="list"?"list":"chart",selectedDay:todayKey,listLimit:CONNECTION_HISTORY_BATCH_SIZE,chartInitialized:false,listScrollTop:0,chartScrollTop:0,chartScrollLeft:null},dialog=document.createElement("dialog");
 dialog.id="connectionHistoryDialog";dialog.className="rhythm-history-dialog connection-history-dialog";dialog.setAttribute("aria-labelledby","connectionHistoryTitle");dialog.setAttribute("data-connection-history-person",personId);
 dialog.innerHTML='<div class="connection-history-header"><div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="connectionHistoryTitle">Connection history</h2><p class="connection-cadence-label"><span>Connection cadence:</span><span class="connection-cadence-badge">'+esc(personCadenceLabel(person))+'</span></p></div><button class="iconbtn" data-connection-history-close aria-label="Close connection history">✕</button></div><div class="connection-history-tabs" role="tablist" aria-label="Connection history display"><button type="button" role="tab" aria-controls="connection-history-list-panel" data-connection-history-view="list" aria-selected="'+(state.view==="list")+'" tabindex="'+(state.view==="list"?"0":"-1")+'">List</button><button type="button" role="tab" aria-controls="connection-history-chart-panel" data-connection-history-view="chart" aria-selected="'+(state.view==="chart")+'" tabindex="'+(state.view==="chart"?"0":"-1")+'">Chart</button></div></div><section id="connection-history-list-panel" class="connection-history-view connection-history-list-view" data-connection-history-panel="list" role="tabpanel" aria-label="Connection history list"'+(state.view==="list"?"":' hidden')+'></section><section id="connection-history-chart-panel" class="connection-history-view connection-history-chart-view" data-connection-history-panel="chart" role="tabpanel" aria-label="Connection history chart"'+(state.view==="chart"?"":' hidden')+'></section>';
 function renderList(){
  var panel=dialog.querySelector('[data-connection-history-panel="list"]'),scrollTop=panel.scrollTop;
  panel.innerHTML='<p class="history-rhythm-details connection-history-list-count">'+data.events.length+' logged connection'+(data.events.length===1?"":"s")+'</p>'+(data.events.length?connectionHistoryListHTML(data,personId,state.listLimit):'<div class="history-empty">No connections yet. Log a shared moment to start your history.</div>');
  panel.scrollTop=scrollTop;
 }
 function renderSelectedDate(){
  var panel=dialog.querySelector('[data-connection-history-panel="chart"]'),detail=panel.querySelector(".connection-history-day-detail");
  if(!detail)return;
  var dateParts=state.selectedDay.split("-").map(Number),date=new Date(dateParts[0],dateParts[1]-1,dateParts[2]),dayEvents=connectionHistoryDayEvents(data,state.selectedDay);
  detail.innerHTML='<div class="connection-history-day-heading"><h3>'+esc(date.toLocaleDateString(undefined,{dateStyle:"full"}))+'</h3><span>'+dayEvents.length+' connection'+(dayEvents.length===1?"":"s")+'</span></div>'+(dayEvents.length?'<div class="connection-list">'+dayEvents.map(function(event){return connectionCardHTML(event,personId);}).join("")+'</div>':'<p class="history-empty">No connections on this date.</p>');
 }
 function renderChart(){
  var panel=dialog.querySelector('[data-connection-history-panel="chart"]'),scrollBefore=panel.querySelector(".history-scroll"),oldScroll=panel.hidden?state.chartScrollTop:panel.scrollTop,oldLeft=panel.hidden?state.chartScrollLeft:scrollBefore&&scrollBefore.scrollLeft,latest=data.bins.length?connectionHistoryDateKey(data.bins[data.bins.length-1].date):todayKey;
  if(!data.bins.some(function(bin){return connectionHistoryDateKey(bin.date)===state.selectedDay;}))state.selectedDay=latest;
  var start=data.start?data.start.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"Today",end=data.end?data.end.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"Today";
  panel.innerHTML='<div class="history-stat"><strong>'+data.total+'</strong> connections <span>from '+esc(start)+' through '+esc(end)+' ('+data.range+' days)</span></div>'+(data.total?'<div class="history-scroll" tabindex="0" aria-label="Connection history chart, scroll horizontally"><div class="history-bars history-bars-day">'+connectionHistoryBarsHTML(data,state.selectedDay)+'</div></div><p class="history-scroll-hint" hidden>Scroll horizontally to explore older connection history.</p><div class="connection-history-day-detail"></div>':'<div class="history-empty">Your connection story starts with the first shared moment.</div>');
  var scroll=panel.querySelector(".history-scroll"),hint=panel.querySelector(".history-scroll-hint");
  if(scroll){scroll.scrollLeft=oldLeft===null||oldLeft===undefined?scroll.scrollWidth:oldLeft;if(hint)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;}
  panel.scrollTop=oldScroll;
  renderSelectedDate();
 }
 function setView(view,focusTab){
  var currentPanel=dialog.querySelector('[data-connection-history-panel="'+state.view+'"]');
  if(currentPanel){if(state.view==="list")state.listScrollTop=currentPanel.scrollTop;else{state.chartScrollTop=currentPanel.scrollTop;var currentChartScroll=currentPanel.querySelector(".history-scroll");if(currentChartScroll)state.chartScrollLeft=currentChartScroll.scrollLeft;}}
  state.view=view==="list"?"list":"chart";
  dialog.querySelectorAll("[data-connection-history-view]").forEach(function(button){var selected=button.getAttribute("data-connection-history-view")===state.view;button.setAttribute("aria-selected",String(selected));button.tabIndex=selected?0:-1;if(selected&&focusTab)button.focus();});
  dialog.querySelectorAll("[data-connection-history-panel]").forEach(function(panel){panel.hidden=panel.getAttribute("data-connection-history-panel")!==state.view;});
  requestAnimationFrame(function(){var active=dialog.querySelector('[data-connection-history-panel="'+state.view+'"]');if(!active)return;active.scrollTop=state.view==="list"?state.listScrollTop:state.chartScrollTop;var chartScroll=active.querySelector(".history-scroll");if(chartScroll&&state.chartScrollLeft!==null)chartScroll.scrollLeft=state.chartScrollLeft;});
  if(state.view==="chart"&&!state.chartInitialized){requestAnimationFrame(function(){var scroll=dialog.querySelector(".history-scroll"),hint=dialog.querySelector(".history-scroll-hint");if(scroll){scroll.scrollLeft=scroll.scrollWidth;state.chartScrollLeft=scroll.scrollLeft;if(hint)hint.hidden=scroll.scrollWidth<=scroll.clientWidth+1;}state.chartInitialized=true;});}
 }
 renderList();renderChart();setView(state.view,false);
 dialog._refreshHistory=function(){
  var nextPerson=S.people.find(function(item){return item.id===personId;});if(!nextPerson){dialog.close();return;}
  var active=dialog.querySelector('[data-connection-history-panel="'+state.view+'"]');if(active){if(state.view==="list")state.listScrollTop=active.scrollTop;else{state.chartScrollTop=active.scrollTop;var chartScroll=active.querySelector(".history-scroll");if(chartScroll)state.chartScrollLeft=chartScroll.scrollLeft;}}
  person=nextPerson;data=connectionHistoryData(person);state.listLimit=Math.min(data.events.length,Math.max(CONNECTION_HISTORY_BATCH_SIZE,state.listLimit));renderList();renderChart();
 };
 dialog.addEventListener("click",function(event){
  var close=event.target.closest("[data-connection-history-close]");if(close){dialog.close();return;}
  var view=event.target.closest("[data-connection-history-view]");if(view){setView(view.getAttribute("data-connection-history-view"),false);return;}
  var loadMore=event.target.closest("[data-connection-history-load-more]");if(loadMore){var panel=dialog.querySelector('[data-connection-history-panel="list"]'),top=panel.scrollTop;state.listLimit=Math.min(data.events.length,state.listLimit+CONNECTION_HISTORY_BATCH_SIZE);renderList();panel.scrollTop=top;var next=panel.querySelector("[data-connection-history-load-more]");if(next)next.focus({preventScroll:true});return;}
  var day=event.target.closest("[data-connection-history-day]");if(day){state.selectedDay=day.getAttribute("data-connection-history-day");var panel=dialog.querySelector('[data-connection-history-panel="chart"]'),scroll=panel.querySelector(".history-scroll"),left=scroll.scrollLeft,top=panel.scrollTop;state.chartScrollTop=top;state.chartScrollLeft=left;renderChart();panel.scrollTop=top;var refreshed=panel.querySelector('[data-connection-history-day="'+state.selectedDay+'"]');if(refreshed)refreshed.focus({preventScroll:true});var refreshedScroll=panel.querySelector(".history-scroll");if(refreshedScroll)refreshedScroll.scrollLeft=left;}
 });
 dialog.addEventListener("keydown",function(event){
  var tab=event.target.closest&&event.target.closest("[data-connection-history-view]");if(!tab)return;
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();var tabs=Array.prototype.slice.call(dialog.querySelectorAll("[data-connection-history-view]")),index=tabs.indexOf(tab);
  if(event.key==="ArrowLeft")index=(index+tabs.length-1)%tabs.length;else if(event.key==="ArrowRight")index=(index+1)%tabs.length;else index=event.key==="Home"?0:tabs.length-1;
  setView(tabs[index].getAttribute("data-connection-history-view"),true);
 });
 dialog.addEventListener("close",function(){dialog.remove();});document.body.appendChild(dialog);tendShowModal(dialog);
 if(state.view==="chart"){var chartScroll=dialog.querySelector(".history-scroll"),hint=dialog.querySelector(".history-scroll-hint");if(chartScroll){chartScroll.scrollLeft=chartScroll.scrollWidth;state.chartScrollLeft=chartScroll.scrollLeft;if(hint)hint.hidden=chartScroll.scrollWidth<=chartScroll.clientWidth+1;state.chartInitialized=true;}}
}
function refreshConnectionHistoryDialog(){var dialog=document.getElementById("connectionHistoryDialog");if(dialog&&typeof dialog._refreshHistory==="function")dialog._refreshHistory();}

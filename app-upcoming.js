"use strict";
/* ============ Coming up: calendar-icon rows + hide dashboard checklists ============
   Overrides upcomingDates/upcomingHTML/renderChecklists from app-views1.js.
   Load order matters: this file must come after app-views1.js.
   To restore the old behavior, remove this file and its script tag in index.html. */
(function(){
 var style=document.createElement("style");
 style.textContent=
  ".upitem{gap:11px}"+
  ".cal-ic{width:34px;height:37px;border-radius:8px;overflow:hidden;flex:none;display:flex;flex-direction:column;background:#FDFDFD;border:1px solid rgba(32,39,35,.14);box-shadow:0 1px 3px rgba(32,39,35,.18)}"+
  ".cal-ic-top{background:#F04531;color:#fff;font-size:8.5px;font-weight:700;letter-spacing:.08em;text-align:center;line-height:12px;height:12px;font-family:var(--sans)}"+
  ".cal-ic-day{flex:1;display:grid;place-items:center;font-size:18px;line-height:1;color:#202723;font-variant-numeric:tabular-nums}"+
  ".upmain{display:flex;flex-direction:column;min-width:0;flex:1}"+
  ".upmain .uplabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
  ".update{font-size:11.5px;color:var(--ink-faint);font-weight:500}"+
  ".updays{margin-left:auto;flex:none;align-self:center}";
 document.head.appendChild(style);
})();
var MOS_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var DOW_SHORT=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function upcomingDates(now){
 var today=new Date(now||Date.now());today.setHours(0,0,0,0);var rows=[];
 function add(label,month,day,attrs){
  if(!(month>=1&&month<=12&&day>=1&&day<=31))return;
  var date=new Date(today.getFullYear(),month-1,day);if(date<today)date=new Date(today.getFullYear()+1,month-1,day);
  var days=Math.round((date-today)/86400000);if(days<=30)rows.push({label:label,days:days,date:date,attrs:attrs||""});
 }
 S.people.forEach(function(p){[['birthday','Birthday'],['anniversary','Anniversary']].forEach(function(pair){var v=String(p[pair[0]]||'').split('-');if(v.length===3)add(p.name+' \u00b7 '+pair[1],+v[1],+v[2],' data-openperson="'+esc(p.id)+'"');});});
 S.keyDates.forEach(function(k){var person=S.people.find(function(p){return p.id===k.personId;});add((person?person.name+' \u00b7 ':'')+k.label,+k.month,+k.day,' data-upitem="'+esc(k.id)+'"');});
 majorHolidays.forEach(function(h){if(!holidayEnabled(h.id))return;[today.getFullYear(),today.getFullYear()+1].forEach(function(y){var date=h.date(y),days=Math.round((date-today)/86400000);if(days>=0&&days<=30)rows.push({label:h.name,days:days,date:date,attrs:''});});});
 return rows.sort(function(a,b){return a.days-b.days||a.label.localeCompare(b.label);});
}
function calIconHTML(date){
 return '<span class="cal-ic" aria-hidden="true"><span class="cal-ic-top">'+MOS_SHORT[date.getMonth()].toUpperCase()+'</span><span class="cal-ic-day">'+date.getDate()+'</span></span>';
}
function upcomingHTML(){
 var rows=upcomingDates();
 return '<div class="sectiontitle"><h2>Coming up</h2><span class="hint">next 30 days</span></div><div class="uprow">'+(rows.length?rows.map(function(x){
  var dtxt=DOW_SHORT[x.date.getDay()]+' \u00b7 '+MOS_SHORT[x.date.getMonth()]+' '+x.date.getDate();
  return '<div class="upitem"'+x.attrs+'>'+calIconHTML(x.date)+'<span class="upmain"><span class="uplabel">'+esc(x.label)+'</span><span class="update">'+dtxt+'</span></span><span class="updays '+(x.days<=7?'soon':x.days<=21?'mid':'far')+'">'+(x.days===0?'today':'in '+x.days+'d')+'</span></div>';
 }).join(''):'<div class="empty">No personal dates or selected holidays in the next 30 days.</div>')+'</div>';
}
/* Hide the three checklist cards (wedding, Christmas, Thanksgiving) on the dashboard for now. */
function renderChecklists(){return "";}

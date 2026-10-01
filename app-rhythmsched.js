"use strict";
/* ============ scheduled future rhythm occurrences ([Tend]-tagged calendar events) ============
   Model agreed 2026-10-01:
   - a future scheduled occurrence PAUSES overdue penalties (no decay while planned)
   - plus a small intentionality bump (planned soon = a bit more credit)
   - full credit still comes from actually logging the moment
   Matching: a future calendar event counts for a rhythm if its title mentions the
   person's name or any significant word (4+ chars) from the rhythm text. */
(function(){
 var style=document.createElement("style");
 style.textContent=".pf-next.planned{color:var(--forest);background:rgba(31,156,104,.07);border-color:rgba(31,156,104,.35)}";
 document.head.appendChild(style);
})();
window.rhythmScheduled=function(r,p){
 var words=String(r.text||"").toLowerCase().split(/[^a-z]+/).filter(function(w){return w.length>=4;});
 var nm=String((p&&p.name)||"").toLowerCase();
 var best=null;
 (window.TEND_EVENTS||[]).forEach(function(ev){
  var v=String(ev.date||"").split("-");if(v.length!==3)return;
  var t=new Date(+v[0],+v[1]-1,+v[2],23,59,59);
  if(t<new Date())return;
  var title=String(ev.title||"").toLowerCase();
  var hit=(nm&&title.indexOf(nm)>=0)||words.some(function(w){return title.indexOf(w)>=0;});
  if(hit&&(!best||t<best.t))best={t:t,ev:ev};
 });
 return best;
};
function rhythmOwner(r){var owner=null;S.people.forEach(function(pp){if(((pp.rhythms)||[]).some(function(x){return x.id===r.id;}))owner=pp;});return owner;}
var _rhythmScore=rhythmScore;
rhythmScore=function(r){
 var d=rhythmDaysSince(r);
 if(d===999)return 0;
 var per=rhythmPeriod(r);
 if(d<per)return 100;
 var sched=window.rhythmScheduled(r,rhythmOwner(r));
 if(sched){
  var daysOut=Math.round((sched.t-new Date())/86400000);
  return Math.min(88,75+(daysOut<=14?6:3)); /* penalties paused + planned bump */
 }
 return _rhythmScore(r);
};
var _rhythmDueTxt=rhythmDueTxt;
rhythmDueTxt=function(r){
 var d=rhythmDaysSince(r);
 if(d!==999&&d>rhythmPeriod(r)){
  var sched=window.rhythmScheduled(r,rhythmOwner(r));
  if(sched)return "planned for "+MOS_SHORT[sched.t.getMonth()]+" "+sched.t.getDate();
 }
 return _rhythmDueTxt(r);
};
var _nextDateLine=nextDateLine;
nextDateLine=function(pid){
 var base=_nextDateLine(pid);
 var p=S.people.find(function(q){return q.id===pid;});
 if(!p)return base;
 personRhythms(p,"connection").concat(personRhythms(p,"prayer")).forEach(function(r){
  var s=window.rhythmScheduled(r,p);
  if(s){
   var days=Math.max(0,Math.round((s.t-new Date())/86400000));
   base+='<div class="pf-next planned">'+esc(r.text)+' \u00B7 planned for '+MOS_SHORT[s.t.getMonth()]+' '+s.t.getDate()+(days===0?" \u00B7 today":" \u00B7 in "+days+" days")+'</div>';
  }
 });
 return base;
};

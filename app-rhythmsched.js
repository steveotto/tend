"use strict";
/* ============ scheduled future rhythm occurrences ([Tend]-tagged calendar events) ============
   Oct 2 2026 revision (supersedes the Oct 1 "planned pause" model):
   - Scoring NEVER pauses for planned events: rhythmScore is always
     "100% - 10% per missed occurrence" (computed in app-recurrence.js).
     The 75/81/88 planned-bump override is gone.
   - "planned for <date>" stays as an informational line, but only for
     rhythms with a period of 7+ days (weekly or longer). Daily rhythms are
     never "planned" - their next occurrence is just the next day.
   - Matching is strict: a calendar event counts only if its title contains a
     whole word (4+ chars) from the rhythm text. Person-name-only matches no
     longer count; previously any event titled with the person's name would
     "plan" every rhythm for that person (e.g. Amy's walk + a random Nov 14 event). */
(function(){
 var style=document.createElement("style");
 style.textContent=".pf-next.planned{color:var(--forest);background:rgba(31,156,104,.07);border-color:rgba(31,156,104,.35)}";
 document.head.appendChild(style);
})();
window.rhythmScheduled=function(r,p){
 if(!r)return null;
 var per=7;
 try{per=rhythmPeriod(r);}catch(err){}
 if(per<7)return null; /* daily / short-period rhythms: next occurrence is imminent */
 var words=String(r.text||"").toLowerCase().split(/[^a-z]+/).filter(function(w){return w.length>=4;});
 if(!words.length)return null;
 var best=null;
 (window.TEND_EVENTS||[]).forEach(function(ev){
  var v=String(ev.date||"").split("-");if(v.length!==3)return;
  var t=new Date(+v[0],+v[1]-1,+v[2],23,59,59);
  if(t<new Date())return;
  var title=String(ev.title||"").toLowerCase();
  var hit=words.some(function(w){return new RegExp("\\b"+w+"\\b").test(title);});
  if(hit&&(!best||t<best.t))best={t:t,ev:ev};
 });
 return best;
};
function rhythmOwner(r){var owner=null;S.people.forEach(function(pp){if(((pp.rhythms)||[]).some(function(x){return x.id===r.id;}))owner=pp;});return owner;}
var _rhythmDueTxt=rhythmDueTxt;
rhythmDueTxt=function(r){
 var d=rhythmDaysSince(r);
 if(d!==999&&d>rhythmPeriod(r)){
  var sched=window.rhythmScheduled(r,rhythmOwner(r));
  if(sched)return "planned for "+MOS_SHORT[sched.t.getMonth()]+" "+sched.t.getDate();
 }
 return _rhythmDueTxt(r);
};

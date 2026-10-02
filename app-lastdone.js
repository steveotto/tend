"use strict";
/* ============ goalLastDone: calendar-day semantics (reset at midnight, not 24h) ============ */
/* A daily goal completed yesterday evening should be due again this morning.              */
window.goalLastDone=function(g){
 var e=lastGoalEvent(g);if(!e)return null;
 var a=new Date(e.ts);a.setHours(0,0,0,0);
 var b=new Date();b.setHours(0,0,0,0);
 var d=Math.round((b-a)/86400000);
 return d<0?0:d; /* future-stamped events count as done today, never negative */
};

"use strict";
/* app-todaychip.js - renders the rhythm-health chip (color-coded rounded-square
   dot + %) at the END of every rhythm row in the "Today with ..." queue on
   person profiles. Works by overriding the rhyRowQ renderer after
   app-views1.js loads, so the chip is part of the row HTML itself.
   Overlay: safe to delete. */
(function(){
 var ORIG=window.rhyRowQ;
 window.rhyRowQ=function(r,dim){
  var p=S.people.find(function(x){return x.id===currentPerson;});
  if(!p)return ORIG?ORIG.apply(this,arguments):"";
  var rl=rhythmLast(r);
  var sub=esc(rhythmFreqLabel(r))+(rhythmDueTxt(r)?" \u00B7 "+esc(rhythmDueTxt(r)):"")+(rl&&rhythmDaysSince(r)!==0?" \u00B7 last tended "+when(rl.ts):"");
  var sc=rhythmScore(r);
  var chip='<span class="rhythm-health" title="Rhythm health" style="display:inline-flex;align-items:center;gap:5px;flex-shrink:0;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap"><span style="width:10px;height:10px;border-radius:3px;flex:none;background:'+personHealthColor(sc)+'"></span><span>'+sc+'%</span></span>';
  return '<div class="actrow'+(dim?" done":"")+'"><span class="act-ic" style="background:'+personHealthColor(rhythmScore(r))+'"></span><div class="pi-main"><div class="pi-label">'+esc(r.text||"(unnamed rhythm)")+' <span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span></div><div class="pi-sub">'+sub+'</div></div>'+(dim?'<span class="praycount">Tended \u2713</span>':rhyDoneBtn(p.id+"|"+r.id))+chip+'</div>';
 };
})();

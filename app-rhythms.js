"use strict";
/* ============ rhythms: no more Connection/Prayer sub-category ============
   A rhythm is just a rhythm. Three parts:
   1. Data migration: strip r.category from every stored rhythm (boot + save).
      Everything downstream defaults missing category to "connection":
      personRhythms(p,"connection") -> ALL rhythms (they feed the connection
      meter), personRhythms(p,"prayer") -> none, so the prayer score now
      comes only from the Prayers feature (prayer logs). Action queue no
      longer hides prayer-tagged rhythms. No migration needed for events.
   2. UI: remove the Rhythm type select from the rhythm add/edit forms
      (views1 renders it as .addrow > select[data-rfield$="|category"]).
   3. app-careplan.js is patched at the source (field + save read removed). */
window.stripRhythmCats=function(){
 var n=0;
 S.people.forEach(function(p){((p.rhythms)||[]).forEach(function(r){
  if("category" in r){delete r.category;n++;}
 });});
 return n;
};
window.stripRhythmCats();
var _rhySave=window.save;
window.save=function(){
 window.stripRhythmCats();
 return _rhySave.apply(this,arguments);
};
var _rhyMO=new MutationObserver(function(){
 document.querySelectorAll('select[data-rfield$="|category"]').forEach(function(s){
  var row=s.closest(".addrow")||s.parentNode;
  if(row&&row.parentNode)row.parentNode.removeChild(row);
 });
});
var _rhyStart=function(){_rhyMO.observe(document.getElementById("view")||document,{childList:true,subtree:true});};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",_rhyStart);else _rhyStart();

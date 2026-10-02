"use strict";
/* ============ relations: "Family" option belongs to Friendships ============ */
window.REL_OPTIONS=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Son-in-law","Daughter-in-law","Father","Mother","Brother","Sister","Friend","Mentor","Coworker","Family"];
window.REL_GROUPS={"Family":["Spouse","Son","Daughter","Bonus son","Bonus daughter","Father","Mother","Brother","Sister","Son-in-law","Daughter-in-law","Grandchild","Nephew","Niece","In-law"],"Friends & others":["Family","Friend","Close friend","Mentor","Mentee","Coworker","Neighbor","Small group friend","Accountability partner","Pastor","Other"]};
window.relOptionsHTML=function(){
 return Object.keys(REL_GROUPS).map(function(g){return '<optgroup label="'+g+'">'+REL_GROUPS[g].map(function(r){return '<option value="'+r+'">'+r+'</option>';}).join("")+'</optgroup>';}).join("");
};
var _relCat=relCategory;
window.relCategory=function(rel){
 var r=(rel||"").toLowerCase();
 if(r==="family")return "friendships"; /* exact "Family" = extended family -> Friendships */
 return _relCat(rel);
};
/* ---- keep stored p.area in sync with the live relation category ---- */
window.syncPersonAreas=function(){
 var n=0;
 S.people.forEach(function(p){
  var want=CAT_AREA[personCategory(p)];
  if(p.area!==want){p.area=want;n++;}
 });
 return n;
};
if(typeof save==="function"){
 var _save=save;
 window.save=function(){syncPersonAreas();return _save.apply(this,arguments);};
}else{setTimeout(function(){var _s=window.save;window.save=function(){syncPersonAreas();return _s.apply(this,arguments);};},1200);}
syncPersonAreas();
/* ---- unify the person-settings relation dropdown with the add-person one ---- */
window.unifyRelSelect=function(sel){
 if(!sel||sel.dataset.unified)return;
 sel.dataset.unified="1";
 var cur=sel.value,custom=cur&&cur!=="__custom"&&REL_GROUPS["Family"].indexOf(cur)<0&&REL_GROUPS["Friends & others"].indexOf(cur)<0;
 sel.innerHTML='<option value="">- not set -</option>'+
  (custom?'<option value="'+cur.replace(/"/g,"&quot;")+"\" selected>"+cur.replace(/"/g,"&quot;")+'</option>':'')+
  relOptionsHTML()+
  '<option value="__custom">Custom...</option>';
 sel.value=cur||"";
};
var mo=new MutationObserver(function(){
 document.querySelectorAll('select[data-pfield="relation"]').forEach(unifyRelSelect);
});
var start=function(){mo.observe(document.getElementById("view")||document,{childList:true,subtree:true});};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();

"use strict";
/* ============ relations: "Family" option belongs to Friendships ============ */
/* Extended family (siblings, parents outside the household) should be tended   */
/* under Friendships, not Parenting. Pick relation "Family" for them.           */
window.REL_OPTIONS=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Son-in-law","Daughter-in-law","Father","Mother","Brother","Sister","Friend","Mentor","Coworker","Family"];
window.relOptionsHTML=function(){
 var fam=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Father","Mother","Brother","Sister","Son-in-law","Daughter-in-law","Grandchild","Nephew","Niece","In-law"];
 var fr=["Family","Friend","Close friend","Mentor","Mentee","Coworker","Neighbor","Small group friend","Accountability partner","Pastor","Other"];
 return '<optgroup label="Family">'+fam.map(function(r){return '<option value="'+r+'">'+r+'</option>';}).join("")+'</optgroup>'+
 '<optgroup label="Friends & others">'+fr.map(function(r){return '<option value="'+r+'">'+r+'</option>';}).join("")+'</optgroup>';
};
var _relCat=relCategory;
window.relCategory=function(rel){
 var r=(rel||"").toLowerCase();
 if(r==="family")return "friendships"; /* exact "Family" = extended family -> Friendships */
 return _relCat(rel);
};

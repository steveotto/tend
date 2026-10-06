"use strict";
/* ============ Today plan pills: show ALL people on multi-person items ============ */
(function(){
var css=document.createElement("style");css.textContent=".plan-pills{flex-wrap:wrap}";document.head.appendChild(css);
window.planPills=function(it){
 var label=it.rhythm||it.rkey?"Rhythm":it.spark||it.sparky?"Spark":it.taskId?"Task":"Suggestion";
 var ids=[];
 if(!ids.length&&it.personId)ids=[it.personId];
 var pills=ids.map(function(id){
  var person=S.people.find(function(p){return p.id===id;});
  if(!person)return "";
  return (it.rhythm||it.rkey)
   ?'<button class="prayer-person person-rhythm-link" data-personrhythms="'+person.id+'" aria-label="Open '+esc(person.name)+' rhythms">'+personAvatar(person,24)+esc(person.name)+'</button>'
   :'<span class="prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>';
 }).join("");
 var area=it.area||(it.log&&it.log.area);
 return pills+'<span class="plan-kind">'+label+'</span>'+(!ids.length&&area&&S.areas[area]?'<span class="plan-kind">'+esc(S.areas[area].name)+'</span>':'');
};
})();

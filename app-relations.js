"use strict";
/* ============ relations: person-settings dropdown unifier ============
   The canonical grouped options live in app-people.js (window.relOptionsHTML,
   window.REL_GROUPS). This file only rebuilds the person-settings modal select
   so it matches the add-person dropdown exactly. Safe to load - no private
   references. */
window.unifyRelSelect=function(sel){
 if(!sel||sel.dataset.unified)return;
 sel.dataset.unified="1";
 var groups=window.REL_GROUPS,cur=sel.value||"";
 var all=groups?groups["Family"].concat(groups["Friends & others"]):[];
 var isKnown=all.indexOf(cur)>=0;
 var html='<option value="">- not set -</option>';
 if(cur&&!isKnown)html+='<option value="'+cur.replace(/"/g,"&quot;")+'" selected>'+cur.replace(/"/g,"&quot;")+'</option>';
 html+=window.relOptionsHTML(isKnown?cur:"");
 html+='<option value="__custom">Custom...</option>';
 sel.innerHTML=html;
 sel.value=cur;
};
var _relMO=new MutationObserver(function(){
 document.querySelectorAll('select[data-pfield="relation"]').forEach(function(s){window.unifyRelSelect(s);});
});
var _relStart=function(){_relMO.observe(document.getElementById("view")||document,{childList:true,subtree:true});};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",_relStart);else _relStart();

"use strict";
/* ============ relations: person-settings dropdown unifier ============
   Canonical grouped options live in app-people.js (window.relOptionsHTML,
   window.REL_GROUPS). This file normalizes the person-settings modal select
   at runtime so it matches the add-person dropdown exactly.
   Key: read the person's ACTUAL relation from S (source of truth), never
   the select's current value - views1 marks both the custom option and
   __custom selected when a relation is not in its flat legacy list, so the
   select's value can be the meaningless "__custom" sentinel. */
window.unifyRelSelect=function(sel){
 if(!sel||sel.dataset.unified)return;
 sel.dataset.unified="1";
 var pid=sel.getAttribute("data-pid");
 var p=null;
 try{p=S.people.find(function(x){return x.id===pid;});}catch(e){p=null;}
 var cur=(p?p.relation:sel.value)||"";
 var groups=window.REL_GROUPS;
 var all=groups?groups["Family"].concat(groups["Friends & others"]):[];
 var known=!!cur&&all.indexOf(cur)>=0;
 var html='<option value="">- not set -</option>';
 if(cur&&!known)html+='<option value="'+cur.replace(/"/g,"&quot;")+"\" selected>"+cur.replace(/"/g,"&quot;")+' (custom)</option>';
 html+=window.relOptionsHTML(known?cur:"");
 html+='<option value="__custom">Custom...</option>';
 sel.innerHTML=html;
 sel.value=cur;
 /* keep the custom-relation text row consistent: remove it when the
    relation is now a known grouped option; sync it when genuinely custom */
 var box=sel.closest(".field");
 var txt=box?box.querySelector('input[data-pfield="relation"]'):null;
 if(txt){
  if(known){if(txt.parentNode)txt.parentNode.removeChild(txt);}
  else if(txt.value!==cur)txt.value=cur;
 }
};
var _relMO=new MutationObserver(function(){
 document.querySelectorAll('select[data-pfield="relation"]').forEach(function(s){window.unifyRelSelect(s);});
});
var _relStart=function(){_relMO.observe(document.getElementById("view")||document,{childList:true,subtree:true});};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",_relStart);else _relStart();

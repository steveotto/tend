"use strict";
/* Keep the Notes tab badge aligned with the active notes shown on the profile. */
(function(){
 if(typeof personProfile!=="function")return;
 window._profilePid=null;
 var _pp=personProfile;
 window.personProfile=function(pid){window._profilePid=pid;return _pp(pid);};
 var mo=new MutationObserver(function(){
  var badge=document.querySelector('.profile-tabs [data-profiletab="notes"] .tab-count');
  if(!badge||!window._profilePid)return;
  var n=typeof personNoteRecords==="function"?personNoteRecords({id:window._profilePid}).filter(function(f){return !f.done;}).length:S.followups.filter(function(f){return f.personId===window._profilePid&&!f.done;}).length;
  if(badge.textContent!==String(n))badge.textContent=String(n);
 });
 var start=function(){mo.observe(document.getElementById("view")||document,{childList:true,subtree:true});};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();

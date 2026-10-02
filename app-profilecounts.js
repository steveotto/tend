"use strict";
/* ============ Notes tab badge counts only what the Notes panel shows ============ */
/* Prayer notes (kind prayernote) live in the Prayer panel - they must not inflate   */
/* the Notes count. Badge now mirrors the panel: encouragement + followup only.      */
(function(){
 if(typeof personProfile!=="function")return;
 window._profilePid=null;
 var _pp=personProfile;
 window.personProfile=function(pid){window._profilePid=pid;return _pp(pid);};
 var mo=new MutationObserver(function(){
  var badge=document.querySelector('.profile-tabs [data-profiletab="notes"] .tab-count');
  if(!badge||!window._profilePid)return;
  var n=S.followups.filter(function(f){
   return f.personId===window._profilePid&&!f.done&&((f.kind||"followup")==="encouragement"||(f.kind||"followup")==="followup");
  }).length;
  if(badge.textContent!==String(n))badge.textContent=String(n);
 });
 var start=function(){mo.observe(document.getElementById("view")||document,{childList:true,subtree:true});};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();

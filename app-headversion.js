"use strict";
/* app-headversion.js - shows the code version in the header next to the
   sync status. Overlay: keeps the base label (synced / local only /
   sync error) and appends the version. Safe to delete. */
(function(){
 setInterval(function(){
  var lbl=document.getElementById("syncLabel");
  if(!lbl)return;
  var v=(window.TEND_VERSION||"").replace(/^v/,"");
  if(!v)return;
  var base=lbl.getAttribute("data-base")||String(lbl.textContent).split(" \u00b7 ")[0].trim();
  if(!base)return;
  lbl.setAttribute("data-base",base);
  var want=base+" \u00b7 "+v;
  if(lbl.textContent!==want)lbl.textContent=want;
 },500);
})();

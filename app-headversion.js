"use strict";
/* app-headversion.js - shows the code version in the header next to the
   sync status. Clicking the version acts like the "Reload latest" button:
   it force-refreshes every file from the server and hard-reloads the page.
   Overlay: safe to delete. */
(function(){
 function apply(){
  var lbl=document.getElementById("syncLabel");
  if(!lbl)return;
  var v=(window.TEND_VERSION||"").replace(/^v/,"");
  if(!v)return;
  var base=lbl.getAttribute("data-base")||String(lbl.textContent).split(" \u00b7 ")[0].trim();
  if(!base)return;
  lbl.setAttribute("data-base",base);
  var want=base+" \u00b7 <span id=\"syncVerLink\" title=\"Reload latest code - same as the Reload latest button\" style=\"cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px\">"+v+"</span>";
  if(lbl.innerHTML!==want)lbl.innerHTML=want;
 }
 setInterval(apply,500);
 document.addEventListener("click",function(e){
  var t=e.target;
  if(t&&t.id==="syncVerLink"){e.preventDefault();if(typeof window.forceRefreshApp==="function")window.forceRefreshApp();}
 });
})();

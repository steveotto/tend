"use strict";
/* ============ scroll to top when opening a person page ============
   Person cards set currentPerson + render() but never reset the scroll
   position, so a scrolled-down page opens the profile scrolled down too.
   openPersonTab is a top-level global in app-actions.js, so wrapping the
   global covers every caller (card clicks, plan pills, apCreate, etc.).
   The scroll happens on the next frame, after render has painted. */
var _openPersonTab=window.openPersonTab;
window.openPersonTab=function(pid){
 var was=_openPersonTab.apply(this,arguments);
 requestAnimationFrame(function(){window.scrollTo(0,0);});
 return was;
};

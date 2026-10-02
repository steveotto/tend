"use strict";
/* app-todaychip.js - appends a rhythm-health chip (color-coded rounded-square
   dot + %) to the END of every rhythm row in the "Today with ..." action queue
   on person profiles. Overlay: does not modify app-views1.js. Safe to delete. */
(function(){
 var CSS=".actrow .rhythm-health.q-health{min-width:0;margin-left:2px}\n"+
         ".actrow .q-health .sm-dot{border-radius:3px;width:10px;height:10px}";
 var chipHTML=function(sc,c){return '<span class="rhythm-health q-health" title="Rhythm health"><span class="sm-dot '+c+'" aria-hidden="true"></span><span>'+sc+'%</span></span>';};
 function rhythmByKey(key){
  var parts=String(key).split("|");
  var p=S.people.find(function(x){return x.id===parts[0];});
  if(!p)return null;
  return (p.rhythms||[]).find(function(r){return r.id===parts[1];})||null;
 }
 function rhythmByText(pid,text){
  var p=S.people.find(function(x){return x.id===pid;});
  if(!p||!text)return null;
  return (p.rhythms||[]).find(function(r){return String(r.text||"(unnamed rhythm)")===text;})||null;
 }
 function decorate(){
  if(!S||!S.people)return;
  document.querySelectorAll(".actrow").forEach(function(row){
   if(row.querySelector(".q-health"))return;
   if(!row.querySelector(".pill.rhy")&&!row.querySelector("[data-rhydone]"))return;
   var btn=row.querySelector("[data-rhydone]");
   var r=btn?rhythmByKey(btn.getAttribute("data-rhydone")):null;
   if(!r){
    var lab=row.querySelector(".pi-label");
    var txt=lab?lab.childNodes[0].textContent.trim():"";
    r=rhythmByText(currentPerson||"",txt);
   }
   if(!r)return;
   var sc=rhythmScore(r),c=scoreClass(sc);
   row.insertAdjacentHTML("beforeend",chipHTML(sc,c));
  });
 }
 var st=document.createElement("style");
 st.textContent=CSS;
 document.head.appendChild(st);
 var mo=new MutationObserver(function(){decorate();});
 function arm(){
  var v=document.getElementById("view");
  if(v)mo.observe(v,{childList:true,subtree:true});
  decorate();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arm);else arm();
})();

"use strict";
/* ============ GitHub sync ============ */
var SYNCcfg=(function(){try{return JSON.parse(localStorage.getItem(LS_SYNC))||{auto:true};}catch(e){return {auto:true};}})();
window.SYNCcfg=SYNCcfg;
window._tendDirty=false; /* local changes not yet pushed - auto-pull must not clobber them */
function ghHeaders(){return {"Authorization":"Bearer "+SYNCcfg.token,"Accept":"application/vnd.github+json"};}
function updateSyncDot(){var dot=el("syncDot"),lbl=el("syncLabel");if(!SYNCcfg.token){dot.className="syncdot";lbl.textContent="local only";}else{dot.className="syncdot on";lbl.textContent="synced";}}
function updateSyncErr(){var dot=el("syncDot");dot.className="syncdot err";el("syncLabel").textContent="sync error";}
function schedulePush(){clearTimeout(pushTimer);pushTimer=setTimeout(pushNow,4000);}
function pushNow(){
 if(!SYNCcfg.token||!SYNCcfg.owner||!SYNCcfg.repo){flash("Configure sync first");return;}
 var url="https://api.github.com/repos/"+SYNCcfg.owner+"/"+SYNCcfg.repo+"/contents/state.json";
 fetch(url,{headers:ghHeaders()}).then(function(r){
  if(r.status===200)return r.json();if(r.status===404)return {sha:null};throw new Error("repo check failed ("+r.status+")");
 }).then(function(j){
  var body={message:"Tend sync "+new Date().toISOString(),content:btoa(unescape(encodeURIComponent(JSON.stringify(S,null,2)))),branch:"main"};
  if(j&&j.sha)body.sha=j.sha;
  return fetch(url,{method:"PUT",headers:ghHeaders(),body:JSON.stringify(body)});
 }).then(function(r){
  if(!r.ok)throw new Error("push failed ("+r.status+")");
  SYNCcfg.lastSync=Date.now();window._tendDirty=false;localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();flash("Synced to GitHub");if(tab==="sync")render();
 }).catch(function(e){console.error(e);updateSyncErr();flash(e.message);});}
function pullNow(explicit){
 if(!SYNCcfg.token||!SYNCcfg.owner||!SYNCcfg.repo){if(explicit)flash("Configure sync first");return;}
 var url="https://api.github.com/repos/"+SYNCcfg.owner+"/"+SYNCcfg.repo+"/contents/state.json";
 fetch(url,{headers:ghHeaders()}).then(function(r){
  if(r.status===404){if(explicit)flash("No data in repo yet - push first");return null;}
  if(!r.ok)throw new Error("pull failed ("+r.status+")");return r.json();
 }).then(function(j){
  if(!j)return;var remote=JSON.parse(decodeURIComponent(escape(atob(j.content))));
  if(window._tendDirty){if(explicit)flash("Local changes not pushed yet - pull skipped to protect them");return;}
  if(remote.events&&remote.events.length>=S.events.length){S=ensureShape(remote);localStorage.setItem(LS_STATE,JSON.stringify(S));}
  SYNCcfg.lastSync=Date.now();localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();flash("Pulled from GitHub");render();
 }).catch(function(e){console.error(e);updateSyncErr();if(explicit)flash(e.message);});}
/* init */
el("headDate").textContent=(function(){var d=new Date();var m=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];return d.getDate()+" "+m[d.getMonth()]+" "+d.getFullYear();})();
updateSyncDot();
if(SYNCcfg.token)pullNow(false);
function bootTend(){if(typeof render==="function"){render();}else{setTimeout(bootTend,400);}}
bootTend();
window.addEventListener("focus",function(){if(SYNCcfg.token)pullNow(false);});

"use strict";
/* ============ GitHub sync ============ */
var SYNCcfg=(function(){try{return JSON.parse(localStorage.getItem(LS_SYNC))||{auto:true};}catch(e){return {auto:true};}})();
window.SYNCcfg=SYNCcfg;
var TEND_VERSION="v20261004b";window.TEND_VERSION=TEND_VERSION;
window._tendDirty=false;
function ghHeaders(){return {"Authorization":"Bearer "+SYNCcfg.token,"Accept":"application/vnd.github+json"};}
function updateSyncDot(){var dot=el("syncDot"),lbl=el("syncLabel");if(!SYNCcfg.token){dot.className="syncdot";lbl.textContent="local only";}else{dot.className="syncdot on";lbl.textContent="synced";}}
function updateSyncErr(){var dot=el("syncDot");dot.className="syncdot err";el("syncLabel").textContent="sync error";}
function schedulePush(){clearTimeout(pushTimer);pushTimer=setTimeout(pushNow,4000);}
function addPersonDraftOpen(){var modal=document.getElementById("addPersonModal");return !!(modal&&modal.classList.contains("open"));}
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
 if(!explicit&&addPersonDraftOpen())return;
 if(!SYNCcfg.token||!SYNCcfg.owner||!SYNCcfg.repo){if(explicit)flash("Configure sync first");return;}
 var url="https://api.github.com/repos/"+SYNCcfg.owner+"/"+SYNCcfg.repo+"/contents/state.json";
 fetch(url,{headers:ghHeaders()}).then(function(r){
  if(r.status===404){if(explicit)flash("No data in repo yet - push first");return null;}
  if(!r.ok)throw new Error("pull failed ("+r.status+")");return r.json();
 }).then(function(j){
  if(!explicit&&addPersonDraftOpen())return;
  if(!j)return;var remote=JSON.parse(decodeURIComponent(escape(atob(j.content))));
  if(window._tendDirty){if(explicit)flash("Local changes not pushed - pull skipped. Push first, or use Force pull if cloud wins.");return;}
  if(remote.events&&remote.events.length>=S.events.length){S=ensureShape(remote);localStorage.setItem(LS_STATE,JSON.stringify(S));}
  else if(explicit){flash("Cloud is older/smaller than local - kept local. Use Force pull (cloud wins) to overwrite.");return;}
  SYNCcfg.lastSync=Date.now();localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();flash("Pulled from GitHub");render();
 }).catch(function(e){console.error(e);updateSyncErr();if(explicit)flash(e.message);});}
function forcePullNow(){
 if(!SYNCcfg.token||!SYNCcfg.owner||!SYNCcfg.repo){flash("Configure sync first");return;}
 if(!confirm("Replace ALL data on this device with the cloud copy? This overwrites local changes."))return;
 var url="https://api.github.com/repos/"+SYNCcfg.owner+"/"+SYNCcfg.repo+"/contents/state.json";
 fetch(url,{headers:ghHeaders()}).then(function(r){
  if(!r.ok)throw new Error("pull failed ("+r.status+")");return r.json();
 }).then(function(j){
  var remote=JSON.parse(decodeURIComponent(escape(atob(j.content))));
  S=ensureShape(remote);localStorage.setItem(LS_STATE,JSON.stringify(S));
  window._tendDirty=false;
  SYNCcfg.lastSync=Date.now();localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();
  flash("Cloud wins - local data replaced");
  render();
 }).catch(function(e){console.error(e);updateSyncErr();flash(e.message);});}
window.forcePullNow=forcePullNow;
setInterval(function(){var pb=document.getElementById("syncPull");if(!pb)return;
 if(!document.getElementById("syncForcePull")){var fb=document.createElement("button");fb.className="btn ghost";fb.id="syncForcePull";fb.type="button";fb.title="Replace ALL data with the cloud copy - use when the cloud is the truth";fb.textContent="Force pull (cloud wins)";pb.parentNode.insertBefore(fb,pb.nextSibling);}
 var line=document.getElementById("syncVersionLine");
 if(!line){line=document.createElement("div");line.id="syncVersionLine";line.style.cssText="font-size:12.5px;color:var(--ink-faint);margin:8px 0 2px;line-height:1.6";pb.parentNode.insertBefore(line,pb);}
 var rb=document.getElementById("syncReloadLatest");
 if(!rb){rb=document.createElement("button");rb.id="syncReloadLatest";rb.className="btn ghost";rb.type="button";rb.title="Fetch the newest version from the server and reload this page";rb.textContent="Reload latest";pb.parentNode.insertBefore(rb,pb.nextSibling);}
 var ls=SYNCcfg.lastSync?new Date(SYNCcfg.lastSync).toLocaleTimeString():"never";
 line.innerHTML="<b style='color:var(--ink)'>Code: "+TEND_VERSION+"</b> &middot; data last synced: "+ls+(window._tendDirty?" &middot; <span style='color:#B3402E;font-weight:700'>unpushed local changes</span>":" &middot; <span style='color:var(--forest);font-weight:700'>all changes pushed</span>");
},500);
document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest("#syncForcePull")){forcePullNow();}});
function forceRefreshApp(){
 var bust=Date.now();
 fetch("index.html?bust="+bust,{cache:"reload"}).then(function(r){return r.text();}).then(function(txt){
  var m=txt.match(/app-sync\.js\?v=([0-9A-Za-z]+)/);
  var latest=m?m[1]:"";
  var cur=TEND_VERSION.replace(/^v/,"");
  if(latest&&latest!==cur){flash("Update found ("+latest+") - reloading...");setTimeout(function(){location.replace(location.pathname+"?fresh="+bust);},700);}
  else if(latest){flash("Already on the latest ("+TEND_VERSION+")");}
  else{flash("Could not read version - forcing reload");setTimeout(function(){location.replace(location.pathname+"?fresh="+bust);},700);}
 }).catch(function(){location.replace(location.pathname+"?fresh="+bust);});
}
window.forceRefreshApp=forceRefreshApp;
document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest("#syncReloadLatest")){e.preventDefault();forceRefreshApp();}});
el("headDate").textContent=(function(){var d=new Date();var m=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];return d.getDate()+" "+m[d.getMonth()]+" "+d.getFullYear();})();
updateSyncDot();
if(SYNCcfg.token)pullNow(false);
function bootTend(){if(typeof render==="function"){if(document.readyState==="complete"){render();}else{window.addEventListener("load",function(){render();});}}else{setTimeout(bootTend,400);}}
bootTend();
window.addEventListener("focus",function(){if(SYNCcfg.token)pullNow(false);});

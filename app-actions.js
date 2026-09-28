/* ================= actions ================= */
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function personName(id){ var p=S.people.find(function(x){return x.id===id;}); return p?p.name:""; }
function logEvent(areaId,personId,kind,note){
  S.events.push({id:uid(),ts:Date.now(),areaId:areaId,personId:personId||null,kind:kind,note:note||"",weight:(KINDS[kind]?KINDS[kind].w:3)});
  save(); render();
}
window.openModal=function(){
  var sel=el("logArea"), selp=el("logPerson"), selk=el("logKind");
  sel.innerHTML=AREA_IDS.map(function(a){return '<option value="'+a+'">'+S.areas[a].name+'</option>';}).join("");
  selp.innerHTML='<option value="">- no specific person -</option>'+S.people.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+' ('+S.areas[p.area].name+')</option>';}).join("");
  selk.innerHTML=Object.keys(KINDS).map(function(k){return '<option value="'+k+'">'+KINDS[k].label+'</option>';}).join("");
  el("logNote").value="";
  el("logModal").classList.add("open");
};
window.closeModal=function(){ el("logModal").classList.remove("open"); };
window.submitLog=function(){
  logEvent(el("logArea").value, el("logPerson").value||null, el("logKind").value, el("logNote").value.trim());
  window.closeModal();
};

function bind(){
  var v=el("view");
  document.querySelectorAll("#tabs button").forEach(function(b){
    b.onclick=function(){ tab=b.getAttribute("data-tab"); openDetail=null; render(); };
  });
  v.querySelectorAll("[data-area]").forEach(function(c){
    c.onclick=function(e){
      if(e.target.closest(".submeter")) return;
      var id=c.getAttribute("data-area");
      openDetail=(openDetail===id)?null:id; render();
    };
  });
  v.querySelectorAll("[data-closedetail]").forEach(function(b){ b.onclick=function(){ openDetail=null; render(); }; });
  v.querySelectorAll("[data-quicklog]").forEach(function(b){
    b.onclick=function(e){ e.stopPropagation(); window.openModal(); };
  });
  v.querySelectorAll("[data-person]").forEach(function(ch){
    ch.onclick=function(e){
      e.stopPropagation();
      var pid=ch.getAttribute("data-person");
      openPersonPanel(pid);
    };
  });
  if(!window._tendDelegated){
    window._tendDelegated=true;
    document.addEventListener("click", function(e){
      var b=e.target.closest("[data-dosugg]");
      if(b){
        var parts=b.getAttribute("data-dosugg").split("|");
        logEvent(parts[1], parts[2]||null, parts[3], parts[0]);
        flash("Logged. Well tended.");
      }
    });
  }
  var io=el("introOk");
  if(io) io.onclick=function(){ try{localStorage.setItem("tend:introSeen","1");}catch(e){} render(); };
  v.querySelectorAll("[data-task]").forEach(function(cb){
    cb.onchange=function(){
      var t=S.tasks.find(function(x){return x.id===cb.getAttribute("data-task");});
      if(t){ t.done=cb.checked; save(); render(); }
    };
  });
  v.querySelectorAll("[data-taskadd]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-taskadd");
      var inp=document.querySelector('[data-tasknew="'+id+'"]');
      if(inp.value.trim()){ S.tasks.push({id:uid(),areaId:id,text:inp.value.trim(),done:false}); save(); render(); }
    };
  });
  v.querySelectorAll("[data-taskdel]").forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute("data-taskdel"); S.tasks=S.tasks.filter(function(t){return t.id!==id;}); save(); render(); };
  });
  v.querySelectorAll("[data-goaladd]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-goaladd");
      var inp=document.querySelector('[data-goalnew="'+id+'"]');
      if(inp.value.trim()){ S.goals.push({id:uid(),areaId:id,text:inp.value.trim()}); save(); render(); }
    };
  });
  v.querySelectorAll("[data-goaldel]").forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute("data-goaldel"); S.goals=S.goals.filter(function(g){return g.id!==id;}); save(); render(); };
  });
  v.querySelectorAll("[data-fudone]").forEach(function(cb){
    cb.onchange=function(){ var f=S.followups.find(function(x){return x.id===cb.getAttribute("data-fudone");}); if(f){ f.done=cb.checked; save(); render(); } };
  });
  v.querySelectorAll("[data-fudel]").forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute("data-fudel"); S.followups=S.followups.filter(function(f){return f.id!==id;}); save(); render(); };
  });

  /* prayer */
  var pa=el("prayerAdd");
  if(pa) pa.onclick=function(){
    var t=el("prayerNew").value.trim();
    if(t){ S.prayers.push({id:uid(),category:el("prayerCat").value,text:t,added:new Date().toISOString().slice(0,10),answered:false,prayed:0}); save(); render(); }
  };
  v.querySelectorAll("[data-praymark]").forEach(function(cb){
    cb.onchange=function(){
      var p=S.prayers.find(function(x){return x.id===cb.getAttribute("data-praymark");});
      if(p){ p.prayed=(p.prayed||0)+1; p.lastPrayed=new Date().toISOString().slice(0,10); save(); render(); flash("Prayed \u2713"); }
    };
  });
  v.querySelectorAll("[data-prayerans]").forEach(function(b){
    b.onclick=function(){ var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerans");}); if(p){ p.answered=true; p.answeredDate=new Date().toISOString().slice(0,10); save(); render(); flash("God answered \u2713"); } };
  });
  v.querySelectorAll("[data-prayerunans]").forEach(function(b){
    b.onclick=function(){ var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerunans");}); if(p){ p.answered=false; p.answeredDate=null; save(); render(); } };
  });
  v.querySelectorAll("[data-prayerdel]").forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute("data-prayerdel"); S.prayers=S.prayers.filter(function(p){return p.id!==id;}); save(); render(); };
  });
  v.querySelectorAll("[data-prayerics]").forEach(function(b){
    b.onclick=function(){ var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerics");}); if(p) downloadICS("Pray: "+p.text); };
  });

  /* free time */
  var sl=el("freeSlider");
  if(sl) sl.oninput=function(){
    sliderMin=+sl.value;
    var bt=document.querySelector(".bigtime"); if(bt) bt.textContent=sliderMin+" min";
    var sb=el("suggBox"); if(sb) sb.innerHTML=suggHTML();
  };

  /* teach */
  var ta=el("teachAdd");
  if(ta) ta.onclick=function(){
    var t=el("teachNew").value.trim();
    if(t){ S.teachings.push({id:uid(),topic:t,status:"idea",notes:""}); save(); render(); }
  };
  v.querySelectorAll("[data-teachstatus]").forEach(function(b){
    b.onclick=function(){
      var t=S.teachings.find(function(x){return x.id===b.getAttribute("data-teachstatus");});
      if(t){ t.status=({idea:"planned",planned:"done",done:"idea"})[t.status]; save(); render(); }
    };
  });
  v.querySelectorAll("[data-teachdel]").forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute("data-teachdel"); S.teachings=S.teachings.filter(function(t){return t.id!==id;}); save(); render(); };
  });
  v.querySelectorAll("[data-teachnotes]").forEach(function(ta2){
    ta2.oninput=function(){
      var t=S.teachings.find(function(x){return x.id===ta2.getAttribute("data-teachnotes");});
      if(t){ t.notes=ta2.value; save(); }
    };
  });
  v.querySelectorAll("[data-teachlb]").forEach(function(b){
    b.onclick=function(){
      var t=S.teachings.find(function(x){return x.id===b.getAttribute("data-teachlb");});
      if(t){
        var txt="Help me develop this family teaching idea: '"+t.topic+"'. "+(t.notes?("My notes so far: "+t.notes+". "):"")+"Suggest an outline for a family night devotional - an opening question, 2-3 scriptures, one hands-on activity, and a challenge for the week.";
        if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(function(){ flash("Copied - paste into Littlebird chat"); }); }
        else flash("Copy failed - select the text manually");
      }
    };
  });

  /* sync buttons */
  var ss=el("syncSave");
  if(ss){
    ss.onclick=function(){
      SYNCcfg.owner=el("syncOwner").value.trim();
      SYNCcfg.repo=el("syncRepo").value.trim();
      SYNCcfg.token=el("syncToken").value.trim();
      localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));
      updateSyncDot(); flash("Sync settings saved"); render();
    };
    el("syncPull").onclick=function(){ pullNow(true); };
    el("syncPush").onclick=function(){ pushNow(); };
    el("syncExport").onclick=function(){
      var blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
      var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download="tend-backup-"+new Date().toISOString().slice(0,10)+".json"; a.click();
    };
  }
}

/* person panel */
function openPersonPanel(pid){
  var p=S.people.find(function(x){return x.id===pid;}); if(!p) return;
  var evs=S.events.filter(function(e){return e.personId===pid;}).sort(function(a,b){return b.ts-a.ts;}).slice(0,8);
  var fus=S.followups.filter(function(f){return f.personId===pid && !f.done;});
  var score=personScore(p);
  var html='<div class="card detail open" style="grid-column:1/-1;display:block;margin-top:4px" id="personPanel">'+
    '<div style="display:flex;justify-content:space-between;align-items:baseline"><h3>'+esc(p.name)+' <span style="font-size:13px;color:var(--ink-faint)">'+esc(p.relation||"")+'</span></h3><div><span class="score '+scoreClass(score)+'">'+score+'</span><button class="btn mini ghost" style="margin-left:10px" onclick="document.getElementById(\'personPanel\').remove()">Close</button></div></div>'+
    '<div class="cols">'+
    '<div><div class="subhead">Log time with '+esc(p.name)+'</div><div class="quicklog">'+
      '<button data-plog="coffee">Coffee</button><button data-plog="meal">Meal</button><button data-plog="call">Call</button><button data-plog="quality">Quality time</button><button data-plog="prayer">Prayed for them</button>'+
    '</div>'+
    '<div class="subhead" style="margin-top:14px">What we talked about</div>'+
    '<div class="notewrap"><textarea id="personNote" placeholder="After coffee with '+esc(p.name)+': what mattered, what to follow up..."></textarea><span class="savehint" id="personNoteHint">saved</span></div>'+
    '<button class="btn mini" style="margin-top:8px" id="personNoteSave">Save note</button>'+
    '<div class="subhead" style="margin-top:14px">Follow up on</div><ul class="tasks" id="personFU">'+
      fus.map(function(f){ return '<li><input type="checkbox" class="cb" data-fudone="'+f.id+'"><span class="txt">'+esc(f.text)+'</span></li>'; }).join("")+
    '</ul><div class="addrow"><input id="personFUNew" placeholder="Follow up on..."><button class="btn mini" id="personFUAdd">Add</button></div>'+
    '</div>'+
    '<div><div class="subhead">History</div>'+
    (evs.length? evs.map(function(e){ return '<div class="logline"><span class="when">'+when(e.ts)+'</span><span class="kind">'+(KINDS[e.kind]?KINDS[e.kind].label:e.kind)+'</span><span class="txt">'+esc(e.note||"")+'</span></div>'; }).join("") : '<div class="empty">No history yet.</div>')+
    '</div></div></div>';
  var parentGrid=document.querySelector(".grid");
  if(!parentGrid) return;
  var existing=el("personPanel"); if(existing) existing.remove();
  parentGrid.insertAdjacentHTML("beforeend", html);
  var panel=el("personPanel");
  panel.querySelectorAll("[data-plog]").forEach(function(b){
    b.onclick=function(){ logEvent(p.area,pid,b.getAttribute("data-plog"),""); };
  });
  panel.querySelector("#personNoteSave").onclick=function(){
    var t=el("personNote").value.trim();
    if(t){ logEvent(p.area,pid,"note",t); }
  };
  panel.querySelectorAll("[data-fudone]").forEach(function(cb){
    cb.onchange=function(){ var f=S.followups.find(function(x){return x.id===cb.getAttribute("data-fudone");}); if(f){f.done=cb.checked; save(); render();} };
  });
  panel.querySelector("#personFUAdd").onclick=function(){
    var t=el("personFUNew").value.trim();
    if(t){ S.followups.push({id:uid(),personId:pid,text:t,done:false,due:null}); save(); render(); openPersonPanel(pid); }
  };
}

/* ================= ICS ================= */
function downloadICS(title){
  var d=new Date(); d.setDate(d.getDate()+1); d.setHours(7,0,0,0);
  function st(dt){
    return dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0")+"T"+String(dt.getUTCHours()).padStart(2,"0")+String(dt.getUTCMinutes()).padStart(2,"0")+"00Z";
  }
  var end=new Date(d.getTime()+15*60000);
  var ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Tend//EN","BEGIN:VEVENT","UID:"+uid()+"@tend","DTSTAMP:"+st(new Date()),"DTSTART:"+st(d),"DTEND:"+st(end),"SUMMARY:"+title.replace(/[,;]/g,""),"DESCRIPTION:From your Tend prayer list","END:VEVENT","END:VCALENDAR"].join("\r\n");
  var blob=new Blob([ics],{type:"text/calendar"});
  var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="prayer-reminder.ics"; a.click();
  flash("Reminder file downloaded - open it to add to Calendar");
}

/* ================= GitHub sync ================= */
var SYNCcfg=(function(){ try{ return JSON.parse(localStorage.getItem(LS_SYNC))||{auto:true}; }catch(e){ return {auto:true}; } })();
window.SYNCcfg=SYNCcfg;
function ghHeaders(){
  return {"Authorization":"Bearer "+SYNCcfg.token,"Accept":"application/vnd.github+json"};
}
function syncStatusHTML(){
  if(!SYNCcfg.token) return "Not configured - running locally on this device. Follow the steps below to enable two-device sync.";
  return 'Configured for <b>'+esc(SYNCcfg.owner||"?")+"/"+esc(SYNCcfg.repo||"?")+'</b>. Last sync: '+(SYNCcfg.lastSync?new Date(SYNCcfg.lastSync).toLocaleString():"never")+'.';
}
function updateSyncDot(){
  var dot=el("syncDot"), lbl=el("syncLabel");
  if(!SYNCcfg.token){ dot.className="syncdot"; lbl.textContent="local only"; }
  else { dot.className="syncdot on"; lbl.textContent="synced"; }
}
function schedulePush(){ clearTimeout(pushTimer); pushTimer=setTimeout(pushNow,4000); }
function pushNow(){
  if(!SYNCcfg.token||!SYNCcfg.owner||!SYNCcfg.repo){ flash("Configure sync first"); return; }
  var url="https://api.github.com/repos/"+SYNCcfg.owner+"/"+SYNCcfg.repo+"/contents/state.json";
  fetch(url,{headers:ghHeaders()}).then(function(r){
    if(r.status===200) return r.json();
    if(r.status===404) return {sha:null};
    throw new Error("repo check failed ("+r.status+") - check owner/repo/token");
  }).then(function(j){
    var body={message:"Tend sync "+new Date().toISOString(),content:btoa(unescape(encodeURIComponent(JSON.stringify(S,null,2)))),branch:"main"};
    if(j&&j.sha) body.sha=j.sha;
    return fetch(url,{method:"PUT",headers:ghHeaders(),body:JSON.stringify(body)});
  }).then(function(r){
    if(!r.ok) throw new Error("push failed ("+r.status+")");
    SYNCcfg.lastSync=Date.now(); localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));
    updateSyncDot(); flash("Synced to GitHub");
    if(tab==="sync") render();
  }).catch(function(e){ console.error(e); updateSyncErr(); flash(e.message); });
}
function updateSyncErr(){ var dot=el("syncDot"); dot.className="syncdot err"; el("syncLabel").textContent="sync error"; }
function pullNow(explicit){
  if(!SYNCcfg.token||!SYNCcfg.owner||!SYNCcfg.repo){ if(explicit) flash("Configure sync first"); return; }
  var url="https://api.github.com/repos/"+SYNCcfg.owner+"/"+SYNCcfg.repo+"/contents/state.json";
  fetch(url,{headers:ghHeaders()}).then(function(r){
    if(r.status===404){ flash("No data in repo yet - push first"); return null; }
    if(!r.ok) throw new Error("pull failed ("+r.status+")");
    return r.json();
  }).then(function(j){
    if(!j) return;
    var remote=JSON.parse(decodeURIComponent(escape(atob(j.content))));
    if(remote.events && remote.events.length>=S.events.length){
      S=remote; localStorage.setItem(LS_STATE,JSON.stringify(S));
    }
    SYNCcfg.lastSync=Date.now(); localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));
    updateSyncDot(); flash("Pulled from GitHub"); render();
  }).catch(function(e){ console.error(e); updateSyncErr(); if(explicit) flash(e.message); });
}

/* ================= init ================= */
el("headDate").textContent=(function(){var d=new Date();var m=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];return d.getDate()+" "+m[d.getMonth()]+" "+d.getFullYear();})();
updateSyncDot();
if(SYNCcfg.token){ pullNow(false); }
render();
window.addEventListener("focus",function(){ if(SYNCcfg.token) pullNow(false); });

"use strict";
/* ============ actions & bindings ============ */
function logEvent(areaId,personId,type,title,note,whenTs,goalId){S.events.push({id:uid(),ts:(whenTs||Date.now()),areaId:areaId,personId:personId||null,type:type||"inperson",kind:type||"inperson",title:title||"",note:note||"",goalId:goalId||null,weight:(ETYPES[type]?ETYPES[type].w:3)});save();render();}
function deleteEvent(id){S.events=S.events.filter(function(e){return e.id!==id;});save();render();flash("Entry deleted");}
function updateEvent(id,patch){var e=S.events.find(function(x){return x.id===id;});if(e){Object.keys(patch).forEach(function(k){e[k]=patch[k];});e.weight=(ETYPES[e.type]?ETYPES[e.type].w:3);save();render();flash("Entry updated");}}
window.openModal=function(){var sel=el("logArea"),selp=el("logPerson"),selk=el("logKind");sel.innerHTML=AREA_IDS.map(function(a){return '<option value="'+a+'">'+S.areas[a].name+'</option>';}).join("");selp.innerHTML='<option value="">- no specific person -</option>'+S.people.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join("");selk.innerHTML=Object.keys(KINDS).map(function(k){return '<option value="'+k+'">'+KINDS[k].label+'</option>';}).join("");el("logNote").value="";el("logModal").classList.add("open");};
window.closeModal=function(){el("logModal").classList.remove("open");};
window.submitLog=function(){logEvent(el("logArea").value,el("logPerson").value||null,el("logKind").value,el("logNote").value.trim());window.closeModal();};
function openPersonTab(pid){tab="people";currentPerson=pid;openDetail=null;render();}
function downloadICS(title){var d=new Date();d.setDate(d.getDate()+1);d.setHours(7,0,0,0);function st(dt){return dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0")+"T"+String(dt.getUTCHours()).padStart(2,"0")+String(dt.getUTCMinutes()).padStart(2,"0")+"00Z";}var end=new Date(d.getTime()+15*60000);var ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Tend//EN","BEGIN:VEVENT","UID:"+uid()+"@tend","DTSTAMP:"+st(new Date()),"DTSTART:"+st(d),"DTEND:"+st(end),"SUMMARY:"+title.replace(/[,;]/g,""),"DESCRIPTION:From Tend","END:VEVENT","END:VCALENDAR"].join("\r\n");var blob=new Blob([ics],{type:"text/calendar"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tend-reminder.ics";a.click();flash("Reminder file downloaded");}
function saveEncNote(pid,ta){var p=S.people.find(function(x){return x.id===pid;});if(p){p.encouragementNote=ta.value;save();var h=document.querySelector('[data-enchint="'+pid+'"]');if(h){h.classList.add("show");setTimeout(function(){h.classList.remove("show");},900);}}}
function bind(){
 var v=el("view");
 document.querySelectorAll("#tabs button").forEach(function(b){b.onclick=function(){tab=b.getAttribute("data-tab");openDetail=null;currentPerson=null;render();};});
 v.querySelectorAll("[data-areanav]").forEach(function(b){b.onclick=function(){currentArea=b.getAttribute("data-areanav");openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);};});
 v.querySelectorAll("[data-utilnav]").forEach(function(b){b.onclick=function(){tab=b.getAttribute("data-utilnav");currentArea=null;openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);};});
 v.querySelectorAll("[data-person]").forEach(function(ch){ch.onclick=function(e){e.stopPropagation();openPersonTab(ch.getAttribute("data-person"));};});
 v.querySelectorAll("[data-openperson]").forEach(function(c){c.onclick=function(){openPersonTab(c.getAttribute("data-openperson"));};});
 v.querySelectorAll("[data-closeperson]").forEach(function(b){b.onclick=function(){currentPerson=null;render();};});
 v.querySelectorAll("[data-goaldone]").forEach(function(b){b.onclick=function(){var g=S.goals.find(function(x){return x.id===b.getAttribute("data-goaldone");});if(g){var t={scripture:"note",prayer:"note",date:"inperson",quality:"inperson",workout:"inperson",outdoors:"inperson"}[g.kind]||"inperson";logEvent(g.area,g.personId,t,g.text,"",Date.now(),g.id);flash("Logged - keep tending");}};});
 v.querySelectorAll("[data-upitem]").forEach(function(u){u.onclick=function(){var kd=S.keyDates.find(function(k){return k.id===u.getAttribute("data-upitem");});var cl=S.checklists.find(function(c){return c.linkId===kd.id;});if(cl)showChecklist(cl.id);};});
 v.querySelectorAll("[data-task]").forEach(function(cb){cb.onchange=function(){var t=S.tasks.find(function(x){return x.id===cb.getAttribute("data-task");});if(t){t.done=cb.checked;save();render();}};});
 v.querySelectorAll("[data-taskadd]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-taskadd");var inp=document.querySelector('[data-tasknew="'+id+'"]');if(inp.value.trim()){S.tasks.push({id:uid(),areaId:id,text:inp.value.trim(),done:false});save();render();}};});
 v.querySelectorAll("[data-taskdel]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-taskdel");S.tasks=S.tasks.filter(function(t){return t.id!==id;});save();render();};});
 v.querySelectorAll("[data-fudone]").forEach(function(cb){cb.onchange=function(){var f=S.followups.find(function(x){return x.id===cb.getAttribute("data-fudone");});if(f){f.done=cb.checked;save();render();}};});
 v.querySelectorAll("[data-fuadd]").forEach(function(b){b.onclick=function(){var pid=b.getAttribute("data-fuadd");var t=el("personFUNew").value.trim();if(t){S.followups.push({id:uid(),personId:pid,text:t,done:false,due:null});save();render();}};});
 /* prayer */
 var pa=el("prayerAdd");
 if(pa)pa.onclick=function(){var t=el("prayerNew").value.trim();if(t){S.prayers.push({id:uid(),category:el("prayerCat").value,personId:el("prayerPerson").value||null,text:t,added:new Date().toISOString().slice(0,10),answered:false,prayed:0});save();render();}};
 v.querySelectorAll("[data-praymark]").forEach(function(cb){cb.onchange=function(){var p=S.prayers.find(function(x){return x.id===cb.getAttribute("data-praymark");});if(p){p.prayed=(p.prayed||0)+1;p.lastPrayed=new Date().toISOString().slice(0,10);save();render();flash("Prayed \u2713");}};});
 v.querySelectorAll("[data-prayerans]").forEach(function(b){b.onclick=function(){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerans");});if(p){p.answered=true;p.answeredDate=new Date().toISOString().slice(0,10);save();render();flash("God answered \u2713");}};});
 v.querySelectorAll("[data-prayerunans]").forEach(function(b){b.onclick=function(){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerunans");});if(p){p.answered=false;p.answeredDate=null;save();render();}};});
 v.querySelectorAll("[data-prayerdel]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-prayerdel");S.prayers=S.prayers.filter(function(p){return p.id!==id;});save();render();};});
 v.querySelectorAll("[data-prayerics]").forEach(function(b){b.onclick=function(){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerics");});if(p)downloadICS("Pray: "+p.text);};});
 /* echo */
 var ea=el("echoAdd");if(ea)ea.onclick=function(){var t=el("echoNew").value.trim();if(t){S.echoes.push({id:uid(),title:t,note:"",items:[]});save();render();}};
 v.querySelectorAll("[data-echodel]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-echodel");S.echoes=S.echoes.filter(function(x){return x.id!==id;});save();render();};});
 v.querySelectorAll("[data-echoadd]").forEach(function(b){b.onclick=function(){var bid=b.getAttribute("data-echoadd");var blk=S.echoes.find(function(x){return x.id===bid;});var inp=document.querySelector('[data-echonew="'+bid+'"]');if(blk&&inp.value.trim()){blk.items=blk.items||[];blk.items.push({id:uid(),text:inp.value.trim(),status:"to contact"});save();render();}};});
 v.querySelectorAll("[data-echoitemdel]").forEach(function(b){b.onclick=function(){var parts=b.getAttribute("data-echoitemdel").split("|");var blk=S.echoes.find(function(x){return x.id===parts[0];});if(blk){blk.items=blk.items.filter(function(i){return i.id!==parts[1];});save();render();}};});
 v.querySelectorAll(".echo-block .badge").forEach(function(bd){bd.onclick=function(){var blk=S.echoes.find(function(x){return x.items.some(function(i){return i.id===bd.getAttribute("data-item");});});};});
 v.querySelectorAll("[data-echostatus]").forEach(function(b){b.onclick=function(){var it=findEchoItem(b.getAttribute("data-echostatus"));if(it){var order=["to contact","contacted","met","booked","passed"];it.status=order[(order.indexOf(it.status)+1)%order.length];save();render();}};});
 /* offload */
 var ia=el("ideaAdd");if(ia)ia.onclick=function(){var t=el("ideaNew").value.trim();if(t){S.ideas.push({id:uid(),text:t,ts:Date.now(),done:false,converted:null});save();render();}};
 v.querySelectorAll("[data-ideadel]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-ideadel");S.ideas=S.ideas.filter(function(x){return x.id!==id;});save();render();};});
 v.querySelectorAll("[data-ideatask]").forEach(function(b){b.onclick=function(){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-ideatask");});if(i&&!i.converted){var area=prompt("Which area? "+AREA_IDS.join(", "),"today");if(area===null)return;area=area.trim().toLowerCase();if(!S.areas[area]){flash("Not an area: "+area);return;}S.tasks.push({id:uid(),areaId:area,text:i.text,done:false});i.converted="task in "+S.areas[area].name;save();render();}};});
 v.querySelectorAll("[data-ideaperson]").forEach(function(b){b.onclick=function(){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-ideaperson");});if(i&&!i.converted){var p=prompt("Save as a note for who? "+S.people.map(function(x){return x.name;}).join(", "));if(p===null)return;var person=S.people.find(function(x){return x.name.toLowerCase()===p.trim().toLowerCase();});if(!person){flash("No person named "+p);return;}S.events.push({id:uid(),ts:Date.now(),areaId:person.area,personId:person.id,kind:"note",note:i.text,weight:2});i.converted="note on "+person.name;save();render();}};});
 v.querySelectorAll("[data-idealb]").forEach(function(b){b.onclick=function(){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-idealb");});if(i){var txt="From my Tend Offload inbox, help me develop this: '"+i.text+"'. Turn it into concrete next steps or a short plan.";if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){flash("Copied - paste into Littlebird");});}else flash("Copy failed");}};});
 /* settings */
 var ss=el("setSave");
 if(ss){ss.onclick=function(){S.settings.greenAt=clamp(+el("setGreen").value||80,50,100);S.settings.yellowAt=clamp(+el("setYellow").value||50,10,80);S.settings.baseline=clamp(+el("setBase").value||50,0,100);save();render();flash("Thresholds saved");};
  v.querySelectorAll("[data-gdel]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-gdel");S.goals=S.goals.filter(function(g){return g.id!==id;});save();render();};});
  v.querySelectorAll("[data-gadd]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-gadd");var inp=document.querySelector('[data-gnewtext="'+id+'"]');if(inp.value.trim()){S.goals.push({id:uid(),area:id,text:inp.value.trim(),cadence:"daily",personId:null});save();render();}};});
  ["gtext","gcad","gdays","gperson"].forEach(function(attr){
   v.querySelectorAll("[data-"+attr+"]").forEach(function(inp){
    var handler=function(){var id=inp.getAttribute("data-"+attr);var g=S.goals.find(function(x){return x.id===id;});if(!g)return;
     if(attr==="gtext")g.text=inp.value;
     if(attr==="gcad"){g.cadence=inp.value;save();render();return;}
     if(attr==="gdays")g.days=+inp.value||2;
     if(attr==="gperson")g.personId=inp.value||null;
     save();};
    inp.onchange=handler;if(inp.tagName==="INPUT"&&inp.type!=="number")inp.onblur=handler;});});}
 /* person profile inputs */
 v.querySelectorAll("[data-encnote]").forEach(function(ta){ta.oninput=function(){saveEncNote(ta.getAttribute("data-encnote"),ta);};});
 v.querySelectorAll("[data-plog]").forEach(function(b){b.onclick=function(){var pid=window._tendCurrentPerson||currentPerson;var p=S.people.find(function(x){return x.id===pid;});if(p)logEvent(p.area,pid,b.getAttribute("data-plog"),"Time with "+p.name,"");};});
 v.querySelectorAll("[data-kdadd]").forEach(function(b){b.onclick=function(){var pid=b.getAttribute("data-kdadd");var inp=document.querySelector('[data-kdlabel="'+pid+'"]');if(inp.value.trim()){S.keyDates.push({id:uid(),personId:pid,label:inp.value.trim(),month:1,day:1});save();render();flash("Added - tell Littlebird the date to set it precisely");}};});
 /* area log form */
 var ls=el("logSubmit");
 if(ls){ls.onclick=function(){
  var dv=el("logDate").value;var ts=dv?new Date(dv+"T12:00:00").getTime():Date.now();
  var title=el("logTitle").value.trim();var talk=el("logTalk").value.trim();
  var person=el("logPersonSel").value||null;var type=el("logTypeSel").value;
  if(editingId){updateEvent(editingId,{ts:ts,personId:person,type:type,title:title,note:talk});editingId=null;editingEvent=null;}
  else{logEvent(currentArea,person,type,title,talk,ts,null);}
 };
 var lc=el("logCancel");if(lc)lc.onclick=function(){editingId=null;editingEvent=null;render();};}
 v.querySelectorAll("[data-eedit]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-eedit");editingEvent=S.events.find(function(x){return x.id===id;});if(editingEvent){editingId=id;render();window.scrollTo(0,document.body.scrollHeight);}};});
 v.querySelectorAll("[data-edel]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-edel");if(confirm("Delete this entry?"))deleteEvent(id);};});
 /* sync buttons */
 var sy=el("syncSave");
 if(sy){sy.onclick=function(){SYNCcfg.owner=el("syncOwner").value.trim();SYNCcfg.repo=el("syncRepo").value.trim();SYNCcfg.token=el("syncToken").value.trim();localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();flash("Sync settings saved");render();};
  el("syncPull").onclick=function(){pullNow(true);};el("syncPush").onclick=function(){pushNow();};
  el("syncExport").onclick=function(){var blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tend-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();};}
 var io=el("introOk");if(io)io.onclick=function(){try{localStorage.setItem("tend:introSeen","1");}catch(e){}render();};
 if(!window._tendDelegated){window._tendDelegated=true;document.addEventListener("click",function(e){var b=e.target.closest("[data-dosugg]");if(b){var parts=b.getAttribute("data-dosugg").split("|");logEvent(parts[1],parts[2]||null,parts[3],parts[0]);flash("Logged. Well tended.");}});}
}
function showChecklist(clId){var cl=S.checklists.find(function(c){return c.id===clId;});if(!cl)return;tab="settings";openDetail=null;render();flash(cl.title+" - see checklists in Coming up");}
function findEchoItem(id){var hit=null;S.echoes.forEach(function(b){(b.items||[]).forEach(function(i){if(i.id===id)hit=i;});});return hit;}

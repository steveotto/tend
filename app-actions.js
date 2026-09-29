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
function showChecklist(clId){tab="today";currentArea=null;render();var d=document.getElementById("cl-"+clId);if(d){d.open=true;d.scrollIntoView({behavior:"smooth",block:"center"});}}
function findEchoItem(id){var hit=null;S.echoes.forEach(function(b){(b.items||[]).forEach(function(i){if(i.id===id)hit=i;});});return hit;}

function bind(){
 if(window._tendDelegated)return;
 window._tendDelegated=true;
 document.addEventListener("click",function(e){
  var t=e.target,b;
  if(b=t.closest("[data-areanav]")){currentArea=b.getAttribute("data-areanav");openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-utilnav]")){tab=b.getAttribute("data-utilnav");currentArea=null;openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-areago]")){currentArea=b.getAttribute("data-areago");openDetail=null;editingId=null;editingEvent=null;render();window.scrollTo(0,0);return;}
  if(b=t.closest("[data-openperson]")){openPersonTab(b.getAttribute("data-openperson"));return;}
  if(b=t.closest("[data-closeperson]")){currentPerson=null;render();return;}
  if(b=t.closest("[data-goaldone]")){var g=S.goals.find(function(x){return x.id===b.getAttribute("data-goaldone");});if(g){var ty={scripture:"note",prayer:"note",date:"inperson",quality:"inperson",workout:"inperson",outdoors:"inperson"}[g.kind]||"inperson";logEvent(g.area,g.personId,ty,g.text,"",Date.now(),g.id);flash("Logged - keep tending");}return;}
  if(b=t.closest("[data-plandone]")){var log={};try{log=JSON.parse(decodeURIComponent(b.getAttribute("data-plandone")));}catch(err){return;}var tid=b.getAttribute("data-taskid");if(tid){var tk=S.tasks.find(function(x){return x.id===tid;});if(tk)tk.done=true;}logEvent(log.area||"faith",null,log.type||"note",log.title||"","",Date.now(),log.goalId||null);flash("Done. On to the next.");return;}
  if(b=t.closest("[data-upitem]")){var kd=S.keyDates.find(function(k){return k.id===b.getAttribute("data-upitem");});var cl=S.checklists.find(function(c){return c.linkId===kd.id;});if(cl)showChecklist(cl.id);return;}
  if(b=t.closest("[data-eedit]")){var id=b.getAttribute("data-eedit");editingEvent=S.events.find(function(x){return x.id===id;});if(editingEvent){editingId=id;render();window.scrollTo(0,document.body.scrollHeight);}return;}
  if(b=t.closest("[data-edel]")){if(confirm("Delete this entry?"))deleteEvent(b.getAttribute("data-edel"));return;}
  if(b=t.closest("[data-taskdel]")){S.tasks=S.tasks.filter(function(x){return x.id!==b.getAttribute("data-taskdel");});save();render();return;}
  if(b=t.closest("[data-taskadd]")){var aid=b.getAttribute("data-taskadd");var inp=document.querySelector('[data-tasknew="'+aid+'"]');if(inp&&inp.value.trim()){S.tasks.push({id:uid(),areaId:aid,text:inp.value.trim(),done:false});save();render();}return;}
  if(b=t.closest("[data-fuadd]")){var pid=b.getAttribute("data-fuadd");var ft=el("personFUNew");if(ft&&ft.value.trim()){S.followups.push({id:uid(),personId:pid,text:ft.value.trim(),done:false,due:null});save();render();}return;}
  if(b=t.closest("[data-prayerans]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerans");});if(p){p.answered=true;p.answeredDate=new Date().toISOString().slice(0,10);save();render();flash("God answered \u2713");}return;}
  if(b=t.closest("[data-prayerunans]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerunans");});if(p){p.answered=false;p.answeredDate=null;save();render();}return;}
  if(b=t.closest("[data-prayerdel]")){S.prayers=S.prayers.filter(function(x){return x.id!==b.getAttribute("data-prayerdel");});save();render();return;}
  if(b=t.closest("[data-prayerics]")){var p=S.prayers.find(function(x){return x.id===b.getAttribute("data-prayerics");});if(p)downloadICS("Pray: "+p.text);return;}
  if(b=t.closest("[data-echodel]")){S.echoes=S.echoes.filter(function(x){return x.id!==b.getAttribute("data-echodel");});save();render();return;}
  if(b=t.closest("[data-echoadd]")){var bid=b.getAttribute("data-echoadd");var blk=S.echoes.find(function(x){return x.id===bid;});var inp=document.querySelector('[data-echonew="'+bid+'"]');if(blk&&inp&&inp.value.trim()){blk.items=blk.items||[];blk.items.push({id:uid(),text:inp.value.trim(),status:"to contact"});save();render();}return;}
  if(b=t.closest("[data-echoitemdel]")){var parts=b.getAttribute("data-echoitemdel").split("|");var blk=S.echoes.find(function(x){return x.id===parts[0];});if(blk){blk.items=blk.items.filter(function(i){return i.id!==parts[1];});save();render();}return;}
  if(b=t.closest("[data-echostatus]")){var parts=b.getAttribute("data-echostatus").split("|");var it=findEchoItem(parts[1]||parts[0]);if(it){var order=["to contact","contacted","met","booked","passed"];it.status=order[(order.indexOf(it.status)+1)%order.length];save();render();}return;}
  if(b=t.closest("[data-ideadel]")){S.ideas=S.ideas.filter(function(x){return x.id!==b.getAttribute("data-ideadel");});save();render();return;}
  if(b=t.closest("[data-ideatask]")){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-ideatask");});if(i&&!i.converted){var area=prompt("Which area? "+AREA_IDS.join(", "),"today");if(area===null)return;area=area.trim().toLowerCase();if(!S.areas[area]){flash("Not an area: "+area);return;}S.tasks.push({id:uid(),areaId:area,text:i.text,done:false});i.converted="task in "+S.areas[area].name;save();render();}return;}
  if(b=t.closest("[data-ideaperson]")){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-ideaperson");});if(i&&!i.converted){var pn=prompt("Save as a note for who? "+S.people.map(function(x){return x.name;}).join(", "));if(pn===null)return;var person=S.people.find(function(x){return x.name.toLowerCase()===pn.trim().toLowerCase();});if(!person){flash("No person named "+pn);return;}S.events.push({id:uid(),ts:Date.now(),areaId:person.area,personId:person.id,kind:"note",type:"note",title:"Encouragement idea",note:i.text,weight:2});i.converted="note on "+person.name;save();render();}return;}
  if(b=t.closest("[data-idealb]")){var i=S.ideas.find(function(x){return x.id===b.getAttribute("data-idealb");});if(i){var txt="From my Tend Offload inbox, help me develop this: '"+i.text+"'. Turn it into concrete next steps or a short plan.";if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){flash("Copied - paste into Littlebird");});}else flash("Copy failed");}return;}
  if(b=t.closest("[data-cldel]")){var parts=b.getAttribute("data-cldel").split("|");var cl=S.checklists.find(function(c){return c.id===parts[0];});if(!cl)return;cl.items=cl.items.filter(function(i){return i.id!==parts[1];});save();render();return;}
  if(b=t.closest("[data-cladd]")){var cid=b.getAttribute("data-cladd");var cl=S.checklists.find(function(c){return c.id===cid;});var inp=document.querySelector('[data-clnew="'+cid+'"]');if(cl&&inp&&inp.value.trim()){cl.items.push({id:uid(),text:inp.value.trim(),done:false});save();render();}return;}
  if(b=t.closest("[data-gdel]")){S.goals=S.goals.filter(function(g){return g.id!==b.getAttribute("data-gdel");});save();render();return;}
  if(b=t.closest("[data-gadd]")){var gid=b.getAttribute("data-gadd");var inp=document.querySelector('[data-gnewtext="'+gid+'"]');if(inp&&inp.value.trim()){S.goals.push({id:uid(),area:gid,text:inp.value.trim(),cadence:"daily",personId:null});save();render();}return;}
  if(b=t.closest("[data-plog]")){var p=S.people.find(function(x){return x.id===currentPerson;});if(p)logEvent(p.area,currentPerson,b.getAttribute("data-plog"),"Time with "+p.name,"");return;}
  if(b=t.closest("[data-kdadd]")){var pid=b.getAttribute("data-kdadd");var inp=document.querySelector('[data-kdlabel="'+pid+'"]');if(inp&&inp.value.trim()){S.keyDates.push({id:uid(),personId:pid,label:inp.value.trim(),month:1,day:1});save();render();flash("Added - tell Littlebird the date to set it precisely");}return;}
  if(b=t.closest("#logSubmit")){var dv=el("logDate").value;var ts=dv?new Date(dv+"T12:00:00").getTime():Date.now();var title=el("logTitle").value.trim();var talk=el("logTalk").value.trim();var person=el("logPersonSel").value||null;var type=el("logTypeSel").value;if(editingId){updateEvent(editingId,{ts:ts,personId:person,type:type,title:title,note:talk});editingId=null;editingEvent=null;}else{logEvent(currentArea,person,type,title,talk,ts,null);}return;}
  if(b=t.closest("#logCancel")){editingId=null;editingEvent=null;render();return;}
  if(b=t.closest("#setSave")){S.settings.greenAt=clamp(+el("setGreen").value||80,50,100);S.settings.yellowAt=clamp(+el("setYellow").value||50,10,80);S.settings.baseline=clamp(+el("setBase").value||50,0,100);save();render();flash("Thresholds saved");return;}
  if(b=t.closest("#calAdd")){S.calendars.push({id:uid(),name:"New calendar",url:"",color:"#4C9AFF"});save();render();return;}
  if(b=t.closest("#calSaveAll")){document.querySelectorAll("[data-calrow]").forEach(function(row){var id=row.getAttribute("data-calrow");var c=S.calendars.find(function(x){return x.id===id;});if(!c)return;c.name=row.querySelector("[data-calname]").value;c.url=row.querySelector("[data-calurl]").value.trim();c.color=row.querySelector("[data-calcolor]").value;});save();localStorage.removeItem("tend:cal2");if(window.TEND_LOAD_CALENDAR)TEND_LOAD_CALENDAR();render();flash("Calendars saved");return;}
  if(b=t.closest("[data-caldel]")){S.calendars=S.calendars.filter(function(x){return x.id!==b.getAttribute("data-caldel");});save();localStorage.removeItem("tend:cal2");render();return;}
  if(b=t.closest("#syncSave")){SYNCcfg.owner=el("syncOwner").value.trim();SYNCcfg.repo=el("syncRepo").value.trim();SYNCcfg.token=el("syncToken").value.trim();localStorage.setItem(LS_SYNC,JSON.stringify(SYNCcfg));updateSyncDot();flash("Sync settings saved");render();return;}
  if(b=t.closest("#syncPull")){pullNow(true);return;}
  if(b=t.closest("#syncPush")){pushNow();return;}
  if(b=t.closest("#syncExport")){var blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tend-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();return;}
  if(b=t.closest("#prayerAdd")){var nt=el("prayerNew");if(nt&&nt.value.trim()){S.prayers.push({id:uid(),category:el("prayerCat").value,personId:el("prayerPerson").value||null,text:nt.value.trim(),added:new Date().toISOString().slice(0,10),answered:false,prayed:0});save();render();}return;}
  if(b=t.closest("#echoAdd")){var nt=el("echoNew");if(nt&&nt.value.trim()){S.echoes.push({id:uid(),title:nt.value.trim(),note:"",items:[]});save();render();}return;}
  if(b=t.closest("#ideaAdd")){var nt=el("ideaNew");if(nt&&nt.value.trim()){S.ideas.push({id:uid(),text:nt.value.trim(),ts:Date.now(),done:false,converted:null});save();render();}return;}
  if(b=t.closest("#introOk")){try{localStorage.setItem("tend:introSeen","1");}catch(err){}render();return;}
  if(b=t.closest("[data-dosugg]")){var parts=b.getAttribute("data-dosugg").split("|");logEvent(parts[1],parts[2]||null,parts[3],parts[0]);flash("Logged. Well tended.");return;}
 });
 document.addEventListener("change",function(e){
  var t=e.target;
  if(t.matches("[data-task]")){var x=S.tasks.find(function(z){return z.id===t.getAttribute("data-task");});if(x){x.done=t.checked;save();render();}}
  else if(t.matches("[data-clitem]")){var parts=t.getAttribute("data-clitem").split("|");var cl=S.checklists.find(function(c){return c.id===parts[0];});if(!cl)return;var it=cl.items.find(function(i){return i.id===parts[1];});if(it){it.done=t.checked;save();render();}}
  else if(t.matches("[data-fudone]")){var f=S.followups.find(function(z){return z.id===t.getAttribute("data-fudone");});if(f){f.done=t.checked;save();render();}}
  else if(t.matches("[data-praymark]")){var p=S.prayers.find(function(z){return z.id===t.getAttribute("data-praymark");});if(p){p.prayed=(p.prayed||0)+1;p.lastPrayed=new Date().toISOString().slice(0,10);save();render();flash("Prayed \u2713");}}
  else if(t.matches("[data-gtext]")){var g=S.goals.find(function(z){return z.id===t.getAttribute("data-gtext");});if(g){g.text=t.value;save();}}
  else if(t.matches("[data-gcad]")){var g=S.goals.find(function(z){return z.id===t.getAttribute("data-gcad");});if(g){g.cadence=t.value;save();render();}}
  else if(t.matches("[data-gdays]")){var g=S.goals.find(function(z){return z.id===t.getAttribute("data-gdays");});if(g){g.days=+t.value||2;save();}}
  else if(t.matches("[data-gperson]")){var g=S.goals.find(function(z){return z.id===t.getAttribute("data-gperson");});if(g){g.personId=t.value||null;save();}}
 });
 document.addEventListener("input",function(e){
  var t=e.target;
  if(t.matches("[data-encnote]"))saveEncNote(t.getAttribute("data-encnote"),t);
 });
}

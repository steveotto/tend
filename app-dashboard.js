"use strict";
/* ============ settings (with sync) + iCloud calendar ============ */
function renderSettings(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Settings</h2><span class="hint">meters, calendar, goals, sync</span></div>';
 /* meters */
 var s=settings();
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Meters</div>'+
 '<div class="setrow"><label>Green starts at</label><input type="number" id="setGreen" value="'+s.greenAt+'"></div>'+
 '<div class="setrow"><label>Yellow starts at</label><input type="number" id="setYellow" value="'+s.yellowAt+'"></div>'+
 '<div class="setrow"><label>Baseline (empty areas)</label><input type="number" id="setBase" value="'+s.baseline+'"></div>'+
 '<button class="btn" id="setSave">Save meter settings</button></div>';
 /* calendars */
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Calendars</div>'+
 '<div class="hint" style="margin-bottom:10px">On icloud.com: Calendar &gt; share icon next to a calendar &gt; "Public Calendar" &gt; copy link. Paste it here (webcal:// or https://). Each calendar gets a name and color on the dashboard.</div>';
 (S.calendars||[]).forEach(function(ca){
  out+='<div class="calrow" data-calrow="'+ca.id+'">'+
  '<input class="cal-color" type="color" data-calcolor="'+ca.id+'" value="'+(ca.color||"#4C9AFF")+'">'+
  '<input class="cal-name" placeholder="Name" data-calname="'+ca.id+'" value="'+esc(ca.name||"")+'">'+
  '<input class="cal-url" placeholder="webcal://icloud.com/..." data-calurl="'+ca.id+'" value="'+esc(ca.url||"")+'">'+
  '<button class="del" data-caldel="'+ca.id+'" title="remove">\u00D7</button></div>';
 });
 if(!S.calendars.length)out+='<div class="empty">No calendars yet - add one below.</div>';
 out+='<div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" id="calAdd">+ Add calendar</button><button class="btn" id="calSaveAll">Save &amp; refresh</button></div></div>';
 /* goals */
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Goals</div>';
 AREA_IDS.forEach(function(id){
  var gs=S.goals.filter(function(g){return g.area===id;});
  out+='<div style="margin-bottom:12px"><b style="font-size:14px">'+S.areas[id].name+'</b>';
  gs.forEach(function(g){
   out+='<div class="goalrow edit"><input class="goaltext" data-gtext="'+g.id+'" value="'+esc(g.text)+'">'+
   '<select data-gcad="'+g.id+'">'+["daily","weekly","monthly","custom"].map(function(c){return '<option value="'+c+'"'+(g.cadence===c?" selected":"")+'>'+c+'</option>';}).join("")+'</select>'+
   (g.cadence==="custom"?'<input type="number" data-gdays="'+g.id+'" value="'+(g.days||2)+'" style="width:56px">':'')+
   '<select data-gtod="'+g.id+'" title="Time of day">'+Object.keys(TODS).map(function(t){return '<option value="'+t+'"'+((g.tod||"anytime")===t?" selected":"")+'>'+TODS[t]+'</option>';}).join("")+'</select>'+
   '<select data-gperson="'+g.id+'"><option value="">- no person -</option>'+S.people.map(function(p){return '<option value="'+p.id+'"'+(g.personId===p.id?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select>'+
   '<button class="del" data-gdel="'+g.id+'">\u00D7</button></div>';
  });
  out+='<div class="addrow"><input placeholder="New goal for '+S.areas[id].name+'..." data-gnewtext="'+id+'"><button class="btn mini" data-gadd="'+id+'">Add</button></div></div>';
 });
 out+='</div>';
 /* sync */
 var st=window.SYNCcfg||{};
 out+='<div class="card"><div class="subhead">Sync (GitHub)</div>'+
 '<div class="field"><label>Owner</label><input id="syncOwner" value="'+esc(st.owner||"")+'"></div>'+
 '<div class="field"><label>Repo</label><input id="syncRepo" value="'+esc(st.repo||"")+'"></div>'+
 '<div class="field"><label>Personal access token</label><input id="syncToken" type="password" placeholder="paste a fine-grained token scoped to tend-data" value="'+esc(st.token||"")+'"></div>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="syncSave">Save</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncPush">Push now</button><button class="btn ghost" id="syncExport">Export backup</button></div></div>';
 return out;}
/* ============ calendar ============ */
function parseICS(txt){
 var evs=[];var lines=txt.split(/\r?\n/);var cur=null;
 for(var i=0;i<lines.length;i++){
  var L=lines[i];
  if(L.indexOf("BEGIN:VEVENT")===0){cur={};}
  else if(L.indexOf("END:VEVENT")===0){if(cur){evs.push(cur);cur=null;}}
  else if(cur){
   var m=L.match(/^([A-Z]+[^:]*):(.*)$/);
   if(m){var k=m[1],val=m[2].trim();
    if(k.indexOf("DTSTART")===0)cur.start=parseICSDate(val);
    else if(k.indexOf("DTEND")===0)cur.end=parseICSDate(val);
    else if(k==="SUMMARY")cur.title=val.replace(/\\,/g,",").replace(/\\n/g," ");
   }
  }
 }
 var t0=new Date();t0.setHours(0,0,0,0);var t1=new Date(t0.getTime()+86400000);
 return evs.filter(function(e){return e.start&&e.start<t1&&((e.end||new Date(e.start.getTime()+3600000))>t0);}).sort(function(a,b){return a.start-b.start;});
}
function parseICSDate(v){
 var m=v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(?:Z)?$/);
 if(!m)return null;
 var d=m[6]?new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])):new Date(+m[1],+m[2]-1,+m[3]);
 if(m[6]&&v.indexOf("Z")<0){/* floating time: treat as local */d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);}
 return d;}
function calUrl(u){u=(u||"").trim();if(u.indexOf("webcal://")===0)u="https://"+u.slice(10);return u;}
function fetchICS(u){
 var proxies=[
  "https://api.allorigins.win/raw?url="+encodeURIComponent(u),
  "https://corsproxy.io/?url="+encodeURIComponent(u),
  "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(u)
 ];
 function tryOne(pu){
  var ctrl=new AbortController();var to=setTimeout(function(){ctrl.abort();},10000);
  return fetch(pu,{signal:ctrl.signal}).then(function(r){clearTimeout(to);if(!r.ok)throw new Error(r.status);return r.text();}).catch(function(e){clearTimeout(to);throw e;});
 }
 return tryOne(proxies[0]).catch(function(){return tryOne(proxies[1]);}).catch(function(){return tryOne(proxies[2]);});
}
function loadCalendars(){
 var strip=el("calStrip");
 var cals=(S.calendars||[]).filter(function(c){return calUrl(c.url);});
 if(!cals.length){window._calLoading=false;if(strip)strip.innerHTML='<div class="empty">No calendars connected - add one in Settings.</div>';return;}
 if(window._calLoading)return;window._calLoading=true;
 var cached=null;try{cached=JSON.parse(localStorage.getItem("tend:cal2")||"null");}catch(e){}
 if(cached&&Date.now()-cached.at<900000&&cached.n===cals.length){window._calLoading=false;renderCalStrip(cached.events);return;}
 if(strip)strip.innerHTML='<div class="empty">Loading calendars...</div>';
 function toEv(x){var m=null;cals.forEach(function(c2){if(x.cal&&c2.name===x.cal)m=c2;});if(!m)m=cals[0];return {t:x.t,s:Date.parse(x.s),e:Date.parse(x.e||x.s),cal:x.cal||m.name,color:m.color||"#4C9AFF",allDay:x.allDay};}
 fetch("events.json?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("nofeed");return r.json();}).then(function(data){
  if(!data||!data.events||!data.events.length)throw new Error("empty");
  window._calLoading=false;window._calSync=data.synced;
  var evs=data.events.map(toEv);evs.sort(function(a,b){return a.s-b.s;});
  localStorage.setItem("tend:cal2",JSON.stringify({at:Date.now(),events:evs,n:cals.length}));
  renderCalStrip(evs);
 }).catch(function(){
  var jobs=cals.map(function(ca){
   return fetchICS(calUrl(ca.url)).then(function(t){
    var evs=parseICS(t).map(function(e){return {t:e.title,s:e.start.getTime(),e:(e.end?e.end.getTime():e.start.getTime()+3600000),cal:ca.name,color:ca.color||"#4C9AFF"};});
    return evs;
   }).catch(function(){return {err:ca.name};});
  });
  Promise.all(jobs).then(function(res){
   var errs=[],evs=[];
   res.forEach(function(r){if(r&&r.err){errs.push(r.err);return;}evs=evs.concat(r);});
   evs.sort(function(a,b){return a.s-b.s;});
   window._calLoading=false;
   if(errs.length&&cals.length===errs.length){renderCalStrip([],errs);return;}
   if(!errs.length)localStorage.setItem("tend:cal2",JSON.stringify({at:Date.now(),events:evs,n:cals.length}));
   renderCalStrip(evs,errs);
  });
 });
}
function fmtT(ms){var d=new Date(ms);var h=d.getHours(),m=d.getMinutes(),ap=h<12?"am":"pm";h=h%12||12;return h+(m?":"+String(m).padStart(2,"0"):"")+ap;}
function renderCalStrip(evs,errs){
 var strip=el("calStrip");if(!strip)return;
 var out="";
 if(errs&&errs.length)out+='<div class="empty">Could not load: '+esc(errs.join(", "))+' (calendar proxies may be down - try again)</div><button class="btn mini ghost" data-calretry="1" style="margin-top:6px">Retry</button>';
 var t0=new Date();t0.setHours(0,0,0,0);var t1=t0.getTime()+86400000;var now=Date.now();
 var tod=(evs||[]).filter(function(e){return e.s<t1&&e.e>t0;}).sort(function(a,b){return a.s-b.s;});
 if(!tod.length){out+='<div class="empty">Nothing else on the calendar today - wide open.</div>';}
 else{
  var allDay=tod.filter(function(e){return e.allDay;}),timed=tod.filter(function(e){return !e.allDay;});
  var nextShown=false;
  function item(e,cls){
   var badge="";
   if(cls.indexOf("now")>=0)badge='<span class="now-badge">Now</span>';
   else if(cls.indexOf("next")>=0)badge='<span class="next-badge">in '+Math.max(1,Math.round((e.s-now)/60000))+' min</span>';
   return '<div class="calitem '+cls+'"><span class="cal-bar" style="background:'+(e.color||"#4C9AFF")+'"></span><div class="cal-main"><div class="cal-title">'+esc(e.t||"(untitled)")+'</div><div class="cal-range">'+(e.allDay?"All day":fmtT(e.s)+" \u2013 "+fmtT(e.e))+'</div></div>'+badge+'<span class="cal-calname">'+esc(e.cal||"")+'</span></div>';
  }
  allDay.forEach(function(e){out+=item(e,"");});
  timed.forEach(function(e){
   var cls=e.e<=now?"past":(now>=e.s?"now":(!nextShown?(nextShown=true,"next"):""));
   out+=item(e,cls);
  });
 }
 if(window._calSync){var sa=now-Date.parse(window._calSync);out+='<div class="calsync">Synced '+when(Date.parse(window._calSync))+(sa>7200000?" - may be out of date":"")+'</div>';}
 strip.innerHTML=out;}
window.TEND_LOAD_CALENDAR=loadCalendars;
setTimeout(function(){if(el("calStrip")&&typeof loadCalendars==="function")loadCalendars();},600);
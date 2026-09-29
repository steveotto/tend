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
 if(!(S.calendars||[]).length)out+='<div class="empty">No calendars yet - add one below.</div>';
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
   '<select data-gperson="'+g.id+'"><option value="">- no person -</option>'+S.people.map(function(p){return '<option value="'+p.id+'"'+(g.personId===p.id?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select>'+
   '<button class="del" data-gdel="'+g.id+'">\u00D7</button></div>';
  });
  out+='<div class="addrow"><input placeholder="New goal for '+S.areas[id].name+'..." data-gnewtext="'+id+'"><button class="btn mini" data-gadd="'+id+'">Add</button></div></div>';
 });
 out+='</div>';
 /* sync */
 var st=window.SYNCcfg||{};
 out+='<div class="card"><div class="subhead">Sync (GitHub)</div>'+
 '<div class="field"><label>Owner</label><input id="syncOwner" value="'+esc(st.owner||"")+'" placeholder="steveotto"></div>'+
 '<div class="field"><label>Repo</label><input id="syncRepo" value="'+esc(st.repo||"")+'" placeholder="tend-data"></div>'+
 '<div class="field"><label>Personal access token</label><input id="syncToken" type="password" placeholder="paste a fine-grained token scoped to tend-data" value="'+esc(st.token||"")+'"></div>'+
 '<div class="btn-row"><button class="btn" id="syncSave">Save</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncPush">Push now</button><button class="btn ghost" id="syncExport">Export backup</button></div></div>';
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
 if(m[6]&&v.indexOf("Z")<0){d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);}
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
 if(cached&&Date.now()-cached.at<1800000&&cached.n===cals.length){window._calLoading=false;renderCalStrip(cached.events);return;}
 if(strip)strip.innerHTML='<div class="empty">Loading calendars...</div>';
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
}
function renderCalStrip(evs,errs){
 var strip=el("calStrip");if(!strip)return;
 var out="";
 if(errs&&errs.length)out+='<div class="empty">Could not load: '+esc(errs.join(", "))+' (calendar proxies may be down - try again)</div><button class="btn mini ghost" data-calretry="1" style="margin-top:6px">Retry</button>';
 if(!evs||!evs.length){if(!out)out='<div class="empty">Nothing on the calendar today - wide open.</div>';strip.innerHTML=out;return;}
 strip.innerHTML=out+evs.map(function(e){
  var d=new Date(e.s);var hm=d.getHours()%12||12;var ap=d.getHours()<12?"am":"pm";var mm=d.getMinutes()?(":"+String(d.getMinutes()).padStart(2,"0")):"";
  return '<div class="calitem"><span class="cal-dot" style="background:'+(e.color||"#4C9AFF")+'"></span><span class="cal-time">'+hm+mm+ap+'</span><span class="cal-title">'+esc(e.t||"(untitled)")+'</span><span class="cal-calname">'+esc(e.cal||"")+'</span></div>';
 }).join("");}
window.TEND_LOAD_CALENDAR=loadCalendars;
setTimeout(function(){if(el("calStrip"))loadCalendars();},600);

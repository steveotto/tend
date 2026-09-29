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
 /* calendar */
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">iCloud calendar</div>'+
 '<div class="hint" style="margin-bottom:8px">On icloud.com: Calendar &gt; click the calendar\'s share icon &gt; turn on "Public Calendar" &gt; copy the link. Paste it here (starts with webcal:// or https://).</div>'+
 '<div class="addrow"><input id="icsUrl" placeholder="webcal://icloud.com/..." value="'+esc(settings().icsUrl||"")+'"><button class="btn" id="icsSave">Save</button></div></div>';
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
function loadCalendar(){
 var u=(settings().icsUrl||"").trim();
 if(!u)return;
 if(u.indexOf("webcal://")===0)u="https://"+u.slice(10);
 var strip=el("calStrip");
 try{var cached=JSON.parse(localStorage.getItem("tend:cal")||"null");if(cached&&Date.now()-cached.at<1800000){renderCalStrip(cached.events);return;}}catch(e){}
 fetch("https://api.allorigins.win/raw?url="+encodeURIComponent(u)).then(function(r){return r.text();}).then(function(t){
  var evs=parseICS(t).map(function(e){return {t:e.title,s:e.start.getTime(),e:(e.end?e.end.getTime():e.start.getTime()+3600000)};});
  localStorage.setItem("tend:cal",JSON.stringify({at:Date.now(),events:evs}));
  renderCalStrip(evs);
 }).catch(function(){if(strip)strip.innerHTML='<div class="empty">Could not load calendar right now.</div>';});
}
function renderCalStrip(evs){
 var strip=el("calStrip");if(!strip)return;
 if(!evs||!evs.length){strip.innerHTML='<div class="empty">Nothing on the calendar today - wide open.</div>';return;}
 strip.innerHTML=evs.map(function(e){
  var d=new Date(e.s);var hm=d.getHours()%12||12;var ap=d.getHours()<12?"am":"pm";
  return '<div class="calitem"><span class="cal-time">'+hm+String(d.getMinutes()).padStart(2,"0").replace("00","")+(d.getMinutes()?":":"")+ap+'</span><span class="cal-title">'+esc(e.t||"(untitled)")+'</span></div>';
 }).join("");}
window.TEND_LOAD_CALENDAR=loadCalendar;

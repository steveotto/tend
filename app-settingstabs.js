"use strict";
/* ============ settings tabs override: Calendars + Sync as real tabs ============
   app-views2.js keeps the Calendars card inside the General panel and renders the
   Sync card after ALL panels (always visible). This override gives each its own tab. */
function renderSettings(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Settings</h2><span class="hint">meters, calendar, goals, sync</span></div>';
 out+='<div class="profile-tabs" role="tablist" aria-label="Settings">'+[['general','General'],['times','Daily time sections'],['dates','Key dates'],['holidays','Major holidays'],['calendars','Calendars'],['goals','Goals'],['sync','Sync']].map(function(t){return '<button role="tab" id="settings-tab-'+t[0]+'" aria-controls="settings-panel-'+t[0]+'" aria-selected="'+(settingsTab===t[0])+'" data-settingstab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
 out+=settingsPanel('times')+dayBlockSettingsHTML()+'</section>'+settingsPanel('dates')+keyDatesSettingsHTML()+'</section>'+settingsPanel('holidays')+holidaySettingsHTML()+'</section>'+settingsPanel('general');
 /* meters */
 var s=settings();
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Meters</div>'+
 '<div class="setrow"><label>Green starts at</label><input type="number" id="setGreen" value="'+s.greenAt+'"></div>'+
 '<div class="setrow"><label>Yellow starts at</label><input type="number" id="setYellow" value="'+s.yellowAt+'"></div>'+
 '<div class="setrow"><label>Baseline (empty areas)</label><input type="number" id="setBase" value="'+s.baseline+'"></div>'+
 '<button class="btn" id="setSave">Save meter settings</button></div>';
 out+='</section>'+settingsPanel('calendars');
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
 out+='</section>'+settingsPanel('goals');
 /* goals */
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Goals</div>';
 AREA_IDS.forEach(function(id){
  var gs=S.goals.filter(function(g){return g.area===id;});
  out+='<div style="margin-bottom:12px"><b style="font-size:14px">'+S.areas[id].name+'</b>';
  gs.forEach(function(g){
   out+='<div class="goalrow edit"><input class="goaltext" data-gtext="'+g.id+'" value="'+esc(g.text)+'">'+
   '<select data-gcad="'+g.id+'">'+["daily","weekly","monthly","custom"].map(function(c){return '<option value="'+c+'"'+(g.cadence===c?" selected":"")+'>'+c+'</option>';}).join("")+'</select>'+
   (g.cadence==="custom"?'<input type="number" data-gdays="'+g.id+'" value="'+(g.days||2)+'" style="width:56px">':'')+
   '<select data-gtod="'+g.id+'" title="Time of day">'+Object.keys(TODS).map(function(t){return '<option value="'+t+'"'+((g.tod||"anytime")===t?" selected":"")+'>'+esc(TODS[t])+'</option>';}).join("")+'</select>'+
   '<select data-gperson="'+g.id+'"><option value="">- no person -</option>'+S.people.map(function(p){return '<option value="'+p.id+'"'+(g.personId===p.id?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select>'+
   '<button class="del" data-gdel="'+g.id+'">\u00D7</button></div>';
  });
  out+='<div class="addrow"><input placeholder="New goal for '+S.areas[id].name+'..." data-gnewtext="'+id+'"><button class="btn mini" data-gadd="'+id+'">Add</button></div></div>';
 });
 out+='</div>';
 out+='</section>'+settingsPanel('sync');
 /* sync */
 var st=window.SYNCcfg||{};
 out+='<div class="card"><div class="subhead">Sync (GitHub)</div>'+
 '<div class="field"><label>Owner</label><input id="syncOwner" value="'+esc(st.owner||"")+'"></div>'+
 '<div class="field"><label>Repo</label><input id="syncRepo" value="'+esc(st.repo||"")+'"></div>'+
 '<div class="field"><label>Personal access token</label><input id="syncToken" type="password" placeholder="paste a fine-grained token scoped to tend-data" value="'+esc(st.token||"")+'"></div>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="syncSave">Save</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncPush">Push now</button><button class="btn ghost" id="syncExport">Export backup</button></div></div>';
 out+='</section>';
 return out;}

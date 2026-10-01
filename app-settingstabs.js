"use strict";
/* ============ settings tabs override: Calendars + Sync as real tabs ============
   app-views2.js keeps the Calendars card inside the General panel and renders the
   Sync card after ALL panels (always visible). This override gives each its own tab. */
function renderSettings(){
 if(settingsTab==='goals')settingsTab='general';
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Settings</h2><span class="hint">meters, calendar, sync</span></div>';
 out+='<div class="profile-tabs" role="tablist" aria-label="Settings">'+[['general','General'],['times','Daily time sections'],['focus','Focus'],['dates','Key dates'],['holidays','Major holidays'],['calendars','Calendars'],['sync','Sync']].map(function(t){return '<button role="tab" id="settings-tab-'+t[0]+'" aria-controls="settings-panel-'+t[0]+'" aria-selected="'+(settingsTab===t[0])+'" data-settingstab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
 out+=settingsPanel('times')+dayBlockSettingsHTML()+'</section>'+settingsPanel('focus')+focusSettingsHTML()+'</section>'+settingsPanel('dates')+keyDatesSettingsHTML()+'</section>'+settingsPanel('holidays')+holidaySettingsHTML()+'</section>'+settingsPanel('general');
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
 out+='</section>'+settingsPanel('sync');
 /* sync - Reload latest featured (most used), then data actions, then config */
 var st=window.SYNCcfg||{};
 out+='<div class="card"><div class="subhead">Sync (GitHub)</div>'+ 
 '<div class="field"><label>Owner</label><input id="syncOwner" value="'+esc(st.owner||"")+'"></div>'+ 
 '<div class="field"><label>Repo</label><input id="syncRepo" value="'+esc(st.repo||"")+'"></div>'+ 
 '<div class="field"><label>Personal access token</label><input id="syncToken" type="password" placeholder="paste a fine-grained token scoped to tend-data" value="'+esc(st.token||"")+'"></div>'+ 
 '<div class="sync-featured" style="display:flex;align-items:center;gap:12px;margin:14px 0 4px;flex-wrap:wrap">'+ 
 '<button class="btn" id="syncReloadLatest" type="button" title="Fetch the newest version of Tend from the server and reload this page" style="background:var(--forest);color:#fff;font-weight:600;padding:11px 22px;font-size:14.5px;border-radius:10px;box-shadow:0 2px 8px rgba(27,67,50,.25)">&#10227; Reload latest</button>'+ 
 '<span class="hint" style="flex:1;min-width:180px">grabs the newest version of Tend &amp; reloads - your data stays put</span></div>'+ 
 '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" id="syncPush">Push now</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncForcePull" type="button" title="Replace ALL local data with the cloud copy - use when the cloud is the truth">Force pull (cloud wins)</button></div>'+ 
 '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn ghost" id="syncSave">Save</button><button class="btn ghost" id="syncExport">Export backup</button></div>'+ 
 '<div id="syncVersionLine" style="font-size:12.5px;color:var(--ink-faint);margin:10px 0 2px;line-height:1.6"></div>'+ 
 '</div>';
 out+='</section>';
 return out;}

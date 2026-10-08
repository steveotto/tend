"use strict";
/* ============ settings (with sync) + iCloud calendar ============ */
var settingsTab='peoplemeters';
function holidayFixed(month,day){return function(y){return new Date(y,month-1,day);};}
function holidayWeekday(month,weekday,n){return function(y){var d=new Date(y,month-1,1);return new Date(y,month-1,1+(weekday-d.getDay()+7)%7+7*(n-1));};}
var majorHolidays=[
 {id:'new-year',name:"New Year's Day",date:holidayFixed(1,1)},
 {id:'mlk',name:'Martin Luther King Jr. Day',date:holidayWeekday(1,1,3)},
 {id:'valentine',name:"Valentine\u2019s Day",date:holidayFixed(2,14)},
 {id:'presidents',name:"Presidents\u2019 Day",date:holidayWeekday(2,1,3)},
 {id:'easter',name:'Easter',date:function(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return new Date(y,Math.floor(n/31)-1,n%31+1);}},
 {id:'mothers',name:"Mother\u2019s Day",date:holidayWeekday(5,0,2)},
 {id:'memorial',name:'Memorial Day',date:function(y){var d=new Date(y,4,31);d.setDate(31-(d.getDay()+6)%7);return d;}},
 {id:'juneteenth',name:'Juneteenth',date:holidayFixed(6,19)},
 {id:'fathers',name:"Father\u2019s Day",date:holidayWeekday(6,0,3)},
 {id:'independence',name:'Independence Day',date:holidayFixed(7,4)},
 {id:'labor',name:'Labor Day',date:holidayWeekday(9,1,1)},
 {id:'indigenous',name:'Indigenous Peoples\u2019 Day / Columbus Day',date:holidayWeekday(10,1,2)},
 {id:'halloween',name:'Halloween',date:holidayFixed(10,31)},
 {id:'veterans',name:'Veterans Day',date:holidayFixed(11,11)},
 {id:'thanksgiving',name:'Thanksgiving',date:holidayWeekday(11,4,4)},
 {id:'christmas',name:'Christmas',date:holidayFixed(12,25)},
 {id:'new-year-eve',name:"New Year\u2019s Eve",date:holidayFixed(12,31)}
];
function holidayEnabled(id){return !!(S.settings&&S.settings.holidays&&S.settings.holidays[id]);}
function holidaySettingsHTML(){return '<div class="card"><div class="subhead">Major holidays</div><p class="settings-help">Choose which U.S. holidays and occasions appear in Coming up, starting 30 days ahead. Uses the actual date, rather than an observed day off. Changes save automatically.</p><div class="holiday-options">'+majorHolidays.map(function(h){return '<label><input type="checkbox" data-holiday="'+h.id+'"'+(holidayEnabled(h.id)?' checked':'')+'><span>'+esc(h.name)+'</span></label>';}).join('')+'</div></div>';}
var keyDateEditorDraft=null;
function keyDateEditorHTML(){
 if(!keyDateEditorDraft)return '';
 var draft=keyDateEditorDraft,months=["January","February","March","April","May","June","July","August","September","October","November","December"];
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-label="'+(draft.id?'Edit':'Add')+' key date"><div class="profile-editor-body"><h3>'+(draft.id?'Edit':'Add')+' key date</h3><label class="field">Name<input id="keyDateEditorLabel" value="'+esc(draft.label||'')+'" placeholder="Key date name"></label><div class="key-date-editor-date"><label class="field">Month<select id="keyDateEditorMonth">'+months.map(function(month,index){return '<option value="'+(index+1)+'"'+(+draft.month===index+1?' selected':'')+'>'+month+'</option>';}).join('')+'</select></label><label class="field">Day<input id="keyDateEditorDay" type="number" min="1" max="31" value="'+(draft.day||1)+'"></label><label class="field">Year <span class="hint">(optional)</span><input id="keyDateEditorYear" type="number" min="1900" max="2100" value="'+(draft.year||'')+'" placeholder="Repeats yearly"></label></div>'+(S.people.length?'<fieldset class="key-date-editor-people"><legend>People</legend>'+S.people.map(function(person){var selected=kdPeopleIds(draft).indexOf(person.id)!==-1;return '<label><input type="checkbox" data-kd-editor-person="'+esc(person.id)+'"'+(selected?' checked':'')+'> '+esc(person.name)+'</label>';}).join('')+'</fieldset>':'')+'<div class="profile-editor-actions"><button type="button" class="btn mini" data-kd-editor-save>Save</button><button type="button" class="btn mini ghost" data-kd-editor-cancel data-editor-cancel>Cancel</button>'+(draft.id?'<button type="button" class="btn mini danger" style="margin-left:auto" data-kd-editor-delete>Delete</button>':'')+'</div></div></dialog>';
}
function keyDatesSettingsHTML(){
 var out='<div class="card"><div class="subhead">Key dates</div><p class="settings-help">Milestones shown in Coming up and on associated people\'s profiles. Add or edit a date to set its name, date, and people.</p><button type="button" class="btn mini" data-kd-editor-add>+ Add key date</button><div class="settings-key-dates">';
 S.keyDates.forEach(function(k){
  var names=kdPeopleIds(k).map(function(id){var person=S.people.find(function(candidate){return candidate.id===id;});return person?person.name:'';}).filter(Boolean);
  out+='<div class="settings-key-date-row"><div><strong>'+esc(k.label)+'</strong><span>'+esc(kdDateTxt(k))+(names.length?' · '+esc(names.join(', ')):'')+'</span></div><button type="button" class="btn mini ghost" data-kd-editor-edit="'+esc(k.id)+'">Edit</button></div>';
 });
 if(!S.keyDates.length)out+='<div class="empty">No key dates yet — add one here or from a person\'s profile.</div>';
 out+='</div>'+keyDateEditorHTML()+'</div>';
 return out;}
document.addEventListener('click',function(event){
 var button=event.target.closest&&event.target.closest('[data-kd-editor-add],[data-kd-editor-edit],[data-kd-editor-save],[data-kd-editor-cancel],[data-kd-editor-delete]');
 if(!button)return;
 if(button.hasAttribute('data-kd-editor-add')){keyDateEditorDraft={id:null,label:'',month:1,day:1,personIds:[]};render();return;}
 if(button.hasAttribute('data-kd-editor-edit')){var source=S.keyDates.find(function(date){return date.id===button.getAttribute('data-kd-editor-edit');});if(source){keyDateEditorDraft=JSON.parse(JSON.stringify(source));render();}return;}
 if(button.hasAttribute('data-kd-editor-cancel')){keyDateEditorDraft=null;render();return;}
 if(button.hasAttribute('data-kd-editor-delete')){if(keyDateEditorDraft&&keyDateEditorDraft.id){S.keyDates=S.keyDates.filter(function(date){return date.id!==keyDateEditorDraft.id;});keyDateEditorDraft=null;save();render();flash('Key date removed');}return;}
 if(button.hasAttribute('data-kd-editor-save')){
  var label=document.getElementById('keyDateEditorLabel'),day=document.getElementById('keyDateEditorDay'),year=document.getElementById('keyDateEditorYear'),month=document.getElementById('keyDateEditorMonth');
  if(!label||!label.value.trim()){flash('Add a key date name');if(label)label.focus();return;}
  var selected=[];document.querySelectorAll('[data-kd-editor-person]:checked').forEach(function(input){selected.push(input.getAttribute('data-kd-editor-person'));});
  var date=keyDateEditorDraft,record=date.id?S.keyDates.find(function(item){return item.id===date.id;}):null;
  if(!record){record={id:uid()};S.keyDates.push(record);}
  record.label=label.value.trim();record.month=+(month&&month.value)||1;record.day=Math.min(31,Math.max(1,+(day&&day.value)||1));record.personIds=selected;record.personId=selected[0]||'';
  if(year&&String(year.value).trim())record.year=Math.min(2100,Math.max(1900,+year.value||1900));else delete record.year;
  keyDateEditorDraft=null;save();render();flash(date.id?'Key date updated':'Key date added');
 }
});
function settingsPanel(key){return '<section class="profile-tab-panel settings-panel" id="settings-panel-'+key+'" role="tabpanel" aria-labelledby="settings-tab-'+key+'"'+(settingsTab===key?'':' hidden')+'>';}
function renderSettings(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Settings</h2><span class="hint">people, time, focus, sync</span></div>';
 out+='<div class="profile-tabs" role="tablist" aria-label="Settings">'+[['general','General'],['times','Daily time sections'],['dates','Key dates'],['holidays','Major holidays']].map(function(t){return '<button role="tab" id="settings-tab-'+t[0]+'" aria-controls="settings-panel-'+t[0]+'" aria-selected="'+(settingsTab===t[0])+'" data-settingstab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
 out+=settingsPanel('times')+dayBlockSettingsHTML()+'</section>'+settingsPanel('dates')+keyDatesSettingsHTML()+'</section>'+settingsPanel('holidays')+holidaySettingsHTML()+'</section>'+settingsPanel('general');
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
 out+='</section>';
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
function loadCalendars(force){
 var strip=el("calStrip");
 var cals=(S.calendars||[]).filter(function(c){return calUrl(c.url);});
 if(!cals.length){window._calLoading=false;if(strip)strip.innerHTML='<div class="empty">No calendars connected - add one in Settings.</div>';return;}
 if(window._calLoading)return;window._calLoading=true;
 var cached=null;try{cached=JSON.parse(localStorage.getItem("tend:cal2")||"null");}catch(e){}
 if(!force&&cached&&Date.now()-cached.at<900000&&cached.n===cals.length){window._calLoading=false;window._calSync=cached.synced||cached.at;renderCalStrip(cached.events);return;}
 if(strip)strip.innerHTML='<div class="empty">Loading calendars...</div>';
 function toEv(x){var m=null;cals.forEach(function(c2){if(x.cal&&c2.name===x.cal)m=c2;});if(!m)m=cals[0];return {t:x.t,s:Date.parse(x.s),e:Date.parse(x.e||x.s),cal:x.cal||m.name,color:m.color||"#4C9AFF",allDay:x.allDay};}
 fetch("events.json?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("nofeed");return r.json();}).then(function(data){
  if(!data||!data.events||!data.events.length)throw new Error("empty");
  window._calLoading=false;window._calSync=data.synced||Date.now();
  var evs=data.events.map(toEv);evs.sort(function(a,b){return a.s-b.s;});
  localStorage.setItem("tend:cal2",JSON.stringify({at:Date.now(),synced:window._calSync,events:evs,n:cals.length}));
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
   if(!errs.length){window._calSync=Date.now();localStorage.setItem("tend:cal2",JSON.stringify({at:window._calSync,synced:window._calSync,events:evs,n:cals.length}));}
   renderCalStrip(evs,errs);
  });
 });
}
function fmtT(ms){var d=new Date(ms);var h=d.getHours(),m=d.getMinutes(),ap=h<12?"am":"pm";h=h%12||12;return h+(m?":"+String(m).padStart(2,"0"):"")+ap;}
function fmtD(ms){var d=new Date(ms);return d.toLocaleDateString(undefined,{month:"short",day:"numeric"});}
function rangeTxt(e,t0,t1){
 var startsToday=e.s>=t0&&e.s<t1,multi=(e.e-e.s)>86400000;
 if(e.allDay){if(startsToday&&!multi)return "All day";return "All day \u00b7 "+fmtD(e.s)+(multi?" \u2013 "+fmtD(e.e):"");}
 if(startsToday&&!multi)return fmtT(e.s)+" \u2013 "+fmtT(e.e);
 return fmtD(e.s)+" "+fmtT(e.s)+" \u2013 "+(multi?fmtD(e.e)+" ":"")+fmtT(e.e);}
function renderCalStrip(evs,errs){
 window._tendCalendarEvents=evs||[];
 var strip=el("calStrip");if(!strip)return;
 var out="";
 if(errs&&errs.length)out+='<div class="empty">Could not load: '+esc(errs.join(", "))+' (calendar proxies may be down - try again)</div><button class="btn mini ghost" data-calretry="1" style="margin-top:6px">Retry</button>';
 var t0=new Date();t0.setHours(0,0,0,0);var t1=t0.getTime()+86400000;var now=Date.now();
 var tod=(evs||[]).filter(function(e){return e.s<t1&&e.e>t0;}).sort(function(a,b){return a.s-b.s;});
 if(!tod.length){out+='<div class="calendar-breathing-room"><span class="calendar-breathing-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8.5 15l2.2 2.2 4.8-4.8"/></svg></span><div><strong>A little room to breathe</strong><p>Your calendar is clear today. Enjoy the open space.</p></div></div>';}
 else{
  var allDay=tod.filter(function(e){return e.allDay;}),timed=tod.filter(function(e){return !e.allDay;});
  var nextShown=false;
  function item(e,cls){
   var badge="";
   if(cls.indexOf("now")>=0)badge='<span class="now-badge">Now</span>';
   else if(cls.indexOf("next")>=0){var until=Math.max(1,Math.round((e.s-now)/60000)),hours=Math.floor(until/60),minutes=until%60;badge='<span class="next-badge">in '+(hours?hours+' hr'+(hours===1?'':'s')+(minutes?' '+minutes+' min':''):minutes+' min')+'</span>';}
   return '<div class="calitem '+cls+'"><span class="cal-bar" style="background:'+(e.color||"#4C9AFF")+'"></span><div class="cal-main"><div class="cal-title">'+esc(e.t||"(untitled)")+'</div><div class="cal-range">'+rangeTxt(e,t0,t1)+'</div></div>'+badge+'<span class="cal-calname">'+esc(e.cal||"")+'</span></div>';
  }
  allDay.forEach(function(e){out+=item(e,"");});
  timed.forEach(function(e){
   var cls=e.e<=now?"past":(now>=e.s?"now":(!nextShown?(nextShown=true,"next"):""));
   out+=item(e,cls);
  });
 }
 strip.innerHTML=out;
 var syncSlot=el("calendarSyncSlot");
 if(syncSlot){if(window._calSync){var syncDate=new Date(window._calSync),syncToday=syncDate.toDateString()===new Date(now).toDateString(),syncLabel=syncToday?"Calendar synced at "+fmtT(syncDate.getTime()):"Calendar synced "+syncDate.toLocaleDateString(undefined,{weekday:"long"})+" at "+fmtT(syncDate.getTime());syncSlot.innerHTML='<button type="button" class="calsync" data-calrefresh title="Refresh calendar events now">'+syncLabel+'</button>';}else syncSlot.innerHTML="";}
}
window.TEND_LOAD_CALENDAR=loadCalendars;
setTimeout(function(){if(el("calStrip")&&typeof loadCalendars==="function")loadCalendars();},600);

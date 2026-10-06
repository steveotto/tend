"use strict";
/* ============ views: prayer, echo, offload, settings, sync ============ */
var PRAYER_CATS=["Family","Marriage","Kids","Friends","Work & Ministry","Church & Pastors","World & Others","Faith"];
var editingPrayerId=null;
function prayerDate(value){if(!value)return "";var d=new Date(value+"T12:00:00");return isNaN(d.getTime())?value:String(d.getDate()).padStart(2,"0")+" "+["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]+" "+d.getFullYear();}
function prayerRow(p){
 var person=S.people.find(function(person){return person.id===p.personId;});
 var count='Prayed for '+(p.prayed||0)+' '+((p.prayed||0)===1?'time':'times');
 var out='<article class="prayer-item">';
 if(editingPrayerId===p.id){
  out+='<label class="field">Title<input id="prayerEditText" value="'+esc(p.text)+'"></label><label class="field">Details<textarea id="prayerEditDetails" placeholder="What would you like to pray for?">'+esc(p.details||"")+'</textarea></label><div class="addrow"><select id="prayerEditCat" aria-label="Category">'+PRAYER_CATS.map(function(c){return '<option'+(p.category===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select><select id="prayerEditPerson" aria-label="Person"><option value="">No person</option>'+S.people.map(function(person){return '<option value="'+person.id+'"'+(p.personId===person.id?' selected':'')+'>'+esc(person.name)+'</option>';}).join('')+'</select></div><div class="pp-opts"><label class="pp-option">Frequency<select id="prayerEditFreq" aria-label="Prayer frequency">'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'"'+(p.freq===k?' selected':'')+'>'+FREQS[k].label+'</option>';}).join('')+'<option value="none"'+(p.freq?'':' selected')+'>No schedule</option></select></label><label class="pp-option">Time<select id="prayerEditTod" aria-label="Prayer time of day">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((p.tod||'anytime')===k?' selected':'')+'>'+esc(TODS[k])+'</option>';}).join('')+'</select></label><label class="pp-option" data-schedule-day'+(scheduleHasWeekday(p.freq)?'':' hidden')+'>Day of week<select id="prayerEditDow">'+scheduleDayOptions(p.scheduleDow)+'</select></label></div><div class="prayer-actions"><button class="btn mini" data-prayersave="'+p.id+'">Save</button><button class="btn mini ghost" data-prayercancel="1">Cancel</button><button class="btn mini danger" data-prayerdel="'+p.id+'">Delete</button></div>';
 }else{
  out+='<div class="prayer-heading"><h3 class="prayer-title">'+esc(p.text)+'</h3>'+(person?'<span class="prayer-person">'+personAvatar(person,24)+esc(person.name)+'</span>':'')+(!p.answered&&!p.archived?'<button class="prayed-pill" data-pray="'+p.id+'" title="Record a prayer" aria-label="'+esc(count)+'. Record a prayer">'+count+'</button>':'<span class="prayed-pill">'+count+'</span>')+'</div>'+(p.details?'<p class="prayer-details">'+esc(p.details)+'</p>':'')+'<div class="prayer-schedule-summary">'+esc(p.freq&&FREQS[p.freq]?FREQS[p.freq].label:'No schedule')+(scheduleDayLabel(p)?' · '+esc(scheduleDayLabel(p)):'')+' · '+esc(TODS[p.tod]||TODS.anytime||'Anytime')+'</div><div class="prayer-footer"><div class="prayer-date">Added '+esc(prayerDate(p.added))+(p.lastPrayed?' · Last prayed '+esc(prayerDate(p.lastPrayed)):'')+(p.answered?' · Answered '+esc(prayerDate(p.answeredDate)):'')+(p.archived?' · Archived '+esc(prayerDate(p.archivedDate)):'')+'</div>';
  out+='<span class="prayer-tools"><button class="prayer-icon" data-prayerhistory="'+p.id+'" title="View prayer history" aria-label="View history for '+esc(p.text)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17 M8 16v-5 M13 16V6 M18 16V9"/></svg></button><button class="prayer-icon" data-prayeredit="'+p.id+'" title="Edit prayer" aria-label="Edit prayer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg></button>';
  if(!p.answered&&!p.archived)out+='<button class="prayer-icon" data-prayerics="'+p.id+'" title="Download calendar reminder for tomorrow at 7 AM" aria-label="Download calendar reminder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 21H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5 M6 2v4 M16 2v4 M2 9h18 M17 12v9 m-4-4 4 4 4-4"/></svg></button>';
  out+='</span><div class="prayer-actions prayer-status-actions">';
  if(!p.answered&&!p.archived)out+='<button class="btn mini ghost" data-prayerans="'+p.id+'">Answered</button><button class="btn mini ghost" data-prayerarchive="'+p.id+'">Archive</button>';
  else out+='<button class="btn mini ghost" data-prayerunans="'+p.id+'">Reopen</button>';
  out+='</div></div>';
 }
 return out+'</article>';
}
function prayerList(items){
 var active=items.filter(function(p){return !p.answered&&!p.archived;});
 var out=active.length?active.map(prayerRow).join(''):'<div class="empty">No active prayer requests.</div>';
 [['answered','Answered'],['archived','Archived']].forEach(function(group){var past=items.filter(function(p){return p[group[0]];});if(past.length)out+='<details class="prayer-past"'+(past.some(function(p){return p.id===editingPrayerId;})?' open':'')+'><summary>'+group[1]+' ('+past.length+')</summary>'+past.map(prayerRow).join('')+'</details>';});return out;
}
function renderPrayer(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Prayer</h2><span class="hint">carry these people before God</span></div>';
 out+='<div class="card" style="margin-bottom:14px"><div class="addrow" style="margin:0"><select id="prayerCat">'+PRAYER_CATS.map(function(c){return '<option>'+c+'</option>';}).join("")+'</select><select id="prayerPerson"><option value="">- person (optional) -</option>'+S.people.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join("")+'</select></div><label class="field prayer-new-field">Title<input id="prayerNew" placeholder="Prayer title"></label><label class="field prayer-new-field">Details<textarea id="prayerDetails" placeholder="Details (optional)"></textarea></label><div class="pp-opts"><label class="pp-option">Frequency<select id="prayerNewFreq"><option value="none">No schedule</option>'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'">'+FREQS[k].label+'</option>';}).join('')+'</select></label><label class="pp-option">Time<select id="prayerNewTod">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'">'+esc(TODS[k])+'</option>';}).join('')+'</select></label><label class="pp-option" data-schedule-day hidden>Day of week<select id="prayerNewDow">'+scheduleDayOptions(null)+'</select></label></div><button class="btn" id="prayerAdd">Add prayer</button></div>';
 PRAYER_CATS.forEach(function(cat){var items=S.prayers.filter(function(p){return p.category===cat;});if(items.length)out+='<div class="card prayer-cat"><div class="subhead">'+esc(cat)+'</div>'+prayerList(items)+'</div>';});
 if(!S.prayers.length)out+='<div class="empty">Prayers tagged with a person also show up on their profile.</div>';
 return out;
}
function renderEcho(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Echoblocks</h2><span class="hint">outreach blocks that echo back - calls, notes, intros</span></div>';
 out+='<button type="button" class="btn" data-echoopen>+ Add block</button>';
 if(echoDraftOpen)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="echo-editor-title"><div class="profile-editor-body"><h3 id="echo-editor-title">Add Echoblock</h3><label class="profile-note-type">Block name<input id="echoNew" placeholder="Photographers, Pastors, Old friends..."></label><div class="profile-editor-actions"><button class="btn" id="echoAdd">Save Block</button><button class="btn ghost" id="echoCancel" data-editor-cancel>Cancel</button></div></div></dialog>';
 out+='<div style="margin-top:14px" class="grid">';
 if(!S.echoes.length)out='<div class="sectiontitle" style="margin-top:6px"><h2>Echoblocks</h2></div><div class="empty" style="text-align:center;padding:30px 0">No blocks yet. A block is a group of people you keep reaching out to - like photographers for Jake & Addi\'s wedding.</div>';
 S.echoes.forEach(function(b){
  out+='<div class="card echo-block"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:16px;font-weight:600">'+esc(b.title)+'</h3><button class="del" data-echodel="'+b.id+'">\u00D7</button></div>';
  if(b.note)out+='<div style="font-size:12px;color:var(--ink-faint);margin-bottom:8px">'+esc(b.note)+'</div>';
  out+='<ul class="tasks">';
  (b.items||[]).forEach(function(it){out+='<li><span class="badge st-'+it.status.replace(/ /g,"-")+'">'+it.status+'</span><span class="txt">'+esc(it.text)+'</span><button class="del" data-echoitemdel="'+b.id+'|'+it.id+'">\u00D7</button></li>';});
  out+='</ul><button type="button" class="btn mini ghost" data-echoitemopen="'+b.id+'">+ Add contact / outreach</button></div>';
  if(echoItemDraftId===b.id)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="echo-item-title"><div class="profile-editor-body"><h3 id="echo-item-title">Add Outreach Item</h3><label class="profile-note-type">Contact or action<input placeholder="Name or next step" data-echonew="'+b.id+'"></label><div class="profile-editor-actions"><button class="btn mini" data-echoadd="'+b.id+'">Save Item</button><button class="btn mini ghost" data-echoitemcancel data-editor-cancel>Cancel</button></div></div></dialog>';
 });
 out+='</div>';
 out+='<div class="card" style="margin-top:14px;font-size:13px;color:var(--ink-soft)"><b>Working with Littlebird:</b> ask Littlebird to draft the outreach email or text, or to research vendors - then paste results here as items.</div>';
 return out;}
function renderOffload(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Offload</h2><span class="hint">brain dump now, sort later</span></div>';
 out+='<button type="button" class="btn" data-ideaopen>+ Add to Offload</button>';
 if(ideaDraftOpen)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="idea-editor-title"><div class="profile-editor-body"><h3 id="idea-editor-title">Add to Offload</h3><label class="profile-note-type">Idea or reminder<textarea id="ideaNew" placeholder="Any idea, to-do, worry - get it out of your head..."></textarea></label><div class="profile-editor-actions"><button class="btn" id="ideaAdd">Save</button><button class="btn ghost" data-ideacancel data-editor-cancel>Cancel</button></div></div></dialog>';
 out+='<div style="margin-top:14px">';
 if(!S.ideas.length)out+='<div class="empty" style="text-align:center;padding:30px 0">Inbox zero. It will fill up again - that is what it is for.</div>';
 S.ideas.forEach(function(i){
  out+='<div class="card idea" style="margin-bottom:10px"><div style="display:flex;gap:10px;align-items:flex-start"><span class="txt"'+(i.done?' style="color:var(--ink-faint)"':'')+'>'+esc(i.text)+'</span><button class="btn mini" data-ideatask="'+i.id+'">To task</button><button class="btn mini ghost" data-ideaperson="'+i.id+'">To person</button><button class="btn mini ghost" data-idealb="'+i.id+'">Littlebird</button><button class="del" data-ideadel="'+i.id+'">\u00D7</button></div>';
  if(i.converted)out+='<div style="font-size:11px;color:var(--forest);margin-top:6px">converted \u2192 '+esc(i.converted)+'</div>';
  out+='</div>';});
 out+='</div>';
 out+='<div class="card" style="margin-top:14px;font-size:13px;color:var(--ink-soft)"><b>Littlebird conversion:</b> tap <b>Littlebird</b> to copy an idea as a prompt, then paste it into your Littlebird chat - e.g. "help me develop this into a plan." Or just tell Littlebird in chat what to turn into tasks.</div>';
 return out;}
function renderSettings(){
 var st=settings();
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Settings</h2></div>';
 out+='<div class="grid"><div class="card" style="grid-column:1/-1"><h3 style="font-size:16px;font-weight:600;margin-bottom:10px">Meter thresholds</h3>';
 out+='<div style="font-size:13px;color:var(--ink-soft);margin-bottom:12px">How meters are scored: recent activity and rhythm health inform each score. Area meters average activity across the area. Fresh start = baseline.</div>';
 out+='<div class="setrow"><label>Green at or above</label><input type="number" id="setGreen" min="50" max="100" value="'+st.greenAt+'"></div>';
 out+='<div class="setrow"><label>Yellow at or above (below = red)</label><input type="number" id="setYellow" min="10" max="80" value="'+st.yellowAt+'"></div>';
 out+='<div class="setrow"><label>Fresh-start baseline</label><input type="number" id="setBase" min="0" max="100" value="'+st.baseline+'"></div>';
 out+='<button class="btn" id="setSave">Save thresholds</button></div></div>';
 return out;}
function syncStatusHTML(){
 if(!SYNCcfg.token)return "Not configured - running locally on this device.";
 return 'Configured for <b>'+esc(SYNCcfg.owner||"?")+"/"+esc(SYNCcfg.repo||"?")+'</b>. Last sync: '+(SYNCcfg.lastSync?new Date(SYNCcfg.lastSync).toLocaleString():"never")+'.';}
function renderSync(){
 var c=window.SYNCcfg||{auto:true};
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Sync</h2></div><div class="grid"><div class="card syncbox" style="grid-column:1/-1">';
 out+='<div class="status">'+syncStatusHTML()+'</div>';
 out+='<div class="field"><label>GitHub username</label><input id="syncOwner" value="'+esc(c.owner||"")+'"></div>';
 out+='<div class="field"><label>Data repo (private)</label><input id="syncRepo" value="'+esc(c.repo||"")+'"></div>';
 out+='<div class="field"><label>Fine-grained token (Contents: read & write, tend-data only)</label><input id="syncToken" type="password" value="'+esc(c.token||"")+'" placeholder="github_pat_..."></div>';
 out+='<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="syncSave">Save settings</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncPush">Push now</button><button class="btn danger" id="syncExport">Download backup</button></div></div></div>';
 return out;}

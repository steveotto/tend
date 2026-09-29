"use strict";
/* ============ views: prayer, echo, offload, settings, sync ============ */
var PRAYER_CATS=["Family","Marriage","Kids","Friends","Work & Ministry","Church & Pastors","World & Others"];
function renderPrayer(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Prayer</h2><span class="hint">carry these people before God</span></div>';
 out+='<div class="card" style="margin-bottom:14px"><div class="addrow" style="margin:0"><select id="prayerCat">'+PRAYER_CATS.map(function(c){return '<option>'+c+'</option>';}).join("")+'</select><select id="prayerPerson"><option value="">- person (optional) -</option>'+S.people.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join("")+'</select></div><div class="addrow"><input id="prayerNew" placeholder="New prayer request..."><button class="btn" id="prayerAdd">Add</button></div></div>';
 PRAYER_CATS.forEach(function(cat){
  var items=S.prayers.filter(function(p){return p.category===cat&&!p.answered;});var ans=S.prayers.filter(function(p){return p.category===cat&&p.answered;});
  if(!items.length&&!ans.length)return;
  out+='<div class="card prayer-cat"><div class="subhead">'+cat+'</div>';
  items.forEach(function(p){out+='<div class="preq"><input type="checkbox" class="cb" data-praymark="'+p.id+'" title="mark prayed"><div class="ptext">'+esc(p.text)+(p.personId?' <span class="badge">'+esc(personName(p.personId))+'</span>':'')+'<div style="font-size:11px;color:var(--ink-faint);margin-top:2px">added '+p.added+' \u00B7 prayed '+(p.prayed||0)+'x</div></div><button class="btn mini ghost" data-prayerics="'+p.id+'">remind</button><button class="del" data-prayerans="'+p.id+'" title="mark answered">\u2713</button><button class="del" data-prayerdel="'+p.id+'">\u00D7</button></div>';});
  if(ans.length){out+='<div class="subhead" style="margin-top:12px;color:var(--forest)">Answered \u2713</div>';ans.forEach(function(p){out+='<div class="preq answered"><div class="ptext">'+esc(p.text)+(p.personId?' <span class="badge">'+esc(personName(p.personId))+'</span>':'')+'<div style="font-size:11px;color:var(--forest)">answered '+p.answeredDate+'</div></div><button class="del" data-prayerunans="'+p.id+'" title="restore">\u21BA</button></div>';});}
  out+='</div>';});
 if(!S.prayers.length)out+='<div class="empty" style="text-align:center;padding:30px 0">No requests yet. Prayers tagged with a person also show up on their profile.</div>';
 return out;}
function renderEcho(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Echoblocks</h2><span class="hint">outreach blocks that echo back - calls, notes, intros</span></div>';
 out+='<div class="addrow"><input id="echoNew" placeholder="New block: Photographers, Pastors, Old friends..."><button class="btn" id="echoAdd">Add block</button></div><div style="margin-top:14px" class="grid">';
 if(!S.echoes.length)out='<div class="sectiontitle" style="margin-top:6px"><h2>Echoblocks</h2></div><div class="empty" style="text-align:center;padding:30px 0">No blocks yet. A block is a group of people you keep reaching out to - like photographers for Jake & Addi\'s wedding.</div>';
 S.echoes.forEach(function(b){
  out+='<div class="card echo-block"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:16px;font-weight:600">'+esc(b.title)+'</h3><button class="del" data-echodel="'+b.id+'">\u00D7</button></div>';
  if(b.note)out+='<div style="font-size:12px;color:var(--ink-faint);margin-bottom:8px">'+esc(b.note)+'</div>';
  out+='<ul class="tasks">';
  (b.items||[]).forEach(function(it){out+='<li><span class="badge st-'+it.status.replace(/ /g,"-")+'">'+it.status+'</span><span class="txt">'+esc(it.text)+'</span><button class="del" data-echoitemdel="'+b.id+'|'+it.id+'">\u00D7</button></li>';});
  out+='</ul><div class="addrow"><input placeholder="Add contact / outreach..." data-echonew="'+b.id+'"><button class="btn mini" data-echoadd="'+b.id+'">Add</button></div></div>';
 });
 out+='</div>';
 out+='<div class="card" style="margin-top:14px;font-size:13px;color:var(--ink-soft)"><b>Working with Littlebird:</b> ask Littlebird to draft the outreach email or text, or to research vendors - then paste results here as items.</div>';
 return out;}
function renderOffload(){
 var out='<div class="sectiontitle" style="margin-top:6px"><h2>Offload</h2><span class="hint">brain dump now, sort later</span></div>';
 out+='<div class="addrow"><input id="ideaNew" placeholder="Any idea, to-do, worry - get it out of your head..."><button class="btn" id="ideaAdd">Offload</button></div>';
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
 out+='<div style="font-size:13px;color:var(--ink-soft);margin-bottom:12px">How meters are scored: every goal has a cadence (daily, weekly, monthly...). Doing it inside the window scores 80-100 (green); slipping past scores 50-80 (yellow); well overdue scores below 50 (red). Area meters average their goals. Fresh start = baseline.</div>';
 out+='<div class="setrow"><label>Green at or above</label><input type="number" id="setGreen" min="50" max="100" value="'+st.greenAt+'"></div>';
 out+='<div class="setrow"><label>Yellow at or above (below = red)</label><input type="number" id="setYellow" min="10" max="80" value="'+st.yellowAt+'"></div>';
 out+='<div class="setrow"><label>Fresh-start baseline</label><input type="number" id="setBase" min="0" max="100" value="'+st.baseline+'"></div>';
 out+='<button class="btn" id="setSave">Save thresholds</button></div></div>';
 out+='<div class="sectiontitle"><h2>Goals</h2><span class="hint">what "healthy" means for each area</span></div><div class="grid">';
 AREA_IDS.forEach(function(id){
  var goals=areaGoals(id);
  out+='<div class="card"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">'+S.areas[id].name+'</h3>';
  goals.forEach(function(g){
   out+='<div class="goalrow edit"><div class="gr-main"><input class="goaltext" data-gtext="'+g.id+'" value="'+esc(g.text)+'"><div class="gr-meta" style="display:flex;gap:6px;margin-top:5px"><select data-gcad="'+g.id+'">'+Object.keys(CADENCES).map(function(c){return '<option value="'+c+'"'+(g.cadence===c?" selected":"")+'>'+CADENCES[c].label+'</option>';}).join("")+'</select>'+(g.cadence==="custom"?'<input type="number" min="1" max="365" style="width:60px" data-gdays="'+g.id+'" value="'+(g.days||2)+'">':'')+'<select data-gtod="'+g.id+'" title="Time of day">'+Object.keys(TODS).map(function(t){return '<option value="'+t+'"'+((g.tod||"anytime")===t?" selected":"")+'>'+TODS[t]+'</option>';}).join("")+'</select><select data-gperson="'+g.id+'"><option value="">- anyone -</option>'+S.people.map(function(p){return '<option value="'+p.id+'"'+(g.personId===p.id?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select></div></div><button class="del" data-gdel="'+g.id+'">\u00D7</button></div>';});
  out+='<div class="addrow"><input placeholder="New goal..." data-gnewtext="'+id+'"><button class="btn mini" data-gadd="'+id+'">Add</button></div></div>';
 });
 out+='</div>';
 out+='<div class="card" style="margin-top:14px;font-size:13px;color:var(--ink-soft)"><b>How the Faith example works:</b> "Read the Bible" is a daily goal. Log it today \u2192 green. A day or two stale \u2192 yellow. Three or more days \u2192 red. Change any cadence above and the meter follows.</div>';
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

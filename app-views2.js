"use strict";
/* ============ views: prayer, echo, offload, settings, sync ============ */
var PRAYER_CATS=["Family","Marriage","Kids","Friends","Work & Ministry","Church & Pastors","World & Others","Faith"];
var editingPrayerId=null;
function prayerDate(value){if(!value)return "";var d=new Date(value+"T12:00:00");return isNaN(d.getTime())?value:String(d.getDate()).padStart(2,"0")+" "+["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]+" "+d.getFullYear();}
function renderEcho(){
 var out=tendSectionHeaderHTML({title:"Echoblocks",subtitle:"outreach blocks that echo back - calls, notes, intros",style:"margin-top:6px"});
 out+='<button type="button" class="btn" data-echoopen>+ Add block</button>';
 if(echoDraftOpen)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="echo-editor-title"><div class="profile-editor-body"><h3 id="echo-editor-title">Add Echoblock</h3><label class="profile-note-type">Block name<input id="echoNew" placeholder="Photographers, Pastors, Old friends..."></label><div class="profile-editor-actions"><button class="btn" id="echoAdd">Save Block</button><button class="btn ghost" id="echoCancel" data-editor-cancel>Cancel</button></div></div></dialog>';
 out+='<div style="margin-top:14px" class="grid">';
 if(!S.echoes.length)out=tendSectionHeaderHTML({title:"Echoblocks",style:"margin-top:6px"})+'<div class="empty" style="text-align:center;padding:30px 0">No blocks yet. A block is a group of people you keep reaching out to - like photographers for Jake & Addi\'s wedding.</div>';
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
 var out=tendSectionHeaderHTML({title:"Offload",subtitle:"brain dump now, sort later",style:"margin-top:6px"});
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
 var out=tendSectionHeaderHTML({title:"Settings",style:"margin-top:6px"});
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
 var out=tendSectionHeaderHTML({title:"Sync",style:"margin-top:6px"})+'<div class="grid"><div class="card syncbox" style="grid-column:1/-1">';
 out+='<div class="status">'+syncStatusHTML()+'</div>';
 out+='<div class="field"><label>GitHub username</label><input id="syncOwner" value="'+esc(c.owner||"")+'"></div>';
 out+='<div class="field"><label>Data repo (private)</label><input id="syncRepo" value="'+esc(c.repo||"")+'"></div>';
 out+='<div class="field"><label>Fine-grained token (Contents: read & write, tend-data only)</label><input id="syncToken" type="password" value="'+esc(c.token||"")+'" placeholder="github_pat_..."></div>';
 out+='<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="syncSave">Save settings</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncPush">Push now</button><button class="btn danger" id="syncExport">Download backup</button></div></div></div>';
 return out;}

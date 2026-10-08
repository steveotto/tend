"use strict";
/* ============ settings tabs override: focused, task-based settings groups ============ */
var calendarEditorDraft=null;
function applyMobileDashboardTextSize(){
 var size=settings().mobileTextSize==="large"?"large":"normal";
 document.documentElement.setAttribute("data-mobile-text-size",size);
}
applyMobileDashboardTextSize();
function mobileDisplaySettingsHTML(){
 var selected=settings().mobileTextSize==="large"?"large":"normal";
 return settingsPanel('display')+'<div class="card settings-card"><div class="subhead">Mobile display</div><p class="settings-help">Choose the text size for Today and other pages on phones. This changes only mobile; tablet and desktop layouts stay the same.</p><div class="setrow"><label for="mobileTextSize">Mobile text size</label><select id="mobileTextSize" data-mobile-text-size><option value="normal"'+(selected==="normal"?' selected':'')+'>Normal</option><option value="large"'+(selected==="large"?' selected':'')+'>Large</option></select></div></div></section>';
}
function weatherSettingsHTML(){
 return settingsPanel('weather')+'<div class="card settings-card"><div class="subhead">Weather</div><p class="settings-help">Tend asks your browser for your current location first. Allow location access for this site to get local weather. If location is unavailable or denied, Tend uses this fallback location instead.</p><label class="field" for="weatherFallbackLocation">Fallback location<input id="weatherFallbackLocation" type="text" autocomplete="address-level2" value="'+esc(settings().weatherFallbackLocation||"")+'" placeholder="City, state or postal code"></label><p class="settings-help">Enter a city, town, or postal code. Weather is provided by Open-Meteo; your location is used only to request the forecast.</p><div class="settings-actions"><button type="button" class="btn" data-weather-settings-save>Save weather settings</button></div></div></section>';
}
document.addEventListener('change',function(event){
 var input=event.target.closest&&event.target.closest('[data-mobile-text-size]');
 if(!input)return;
 settings().mobileTextSize=input.value==="large"?"large":"normal";
 applyMobileDashboardTextSize();save();flash('Mobile display saved');
});
document.addEventListener('click',function(event){
 var button=event.target.closest&&event.target.closest('[data-weather-settings-save]');
 if(!button)return;
 var input=document.getElementById('weatherFallbackLocation');
 if(!input)return;
 settings().weatherFallbackLocation=input.value.trim();
 nowWeather.requestId++;nowWeather.status='idle';nowWeather.position=null;nowWeather.report=null;
 save();flash(settings().weatherFallbackLocation?'Weather settings saved':'Weather fallback cleared');
});
function openCalendarEditor(id){
 var calendar=id?S.calendars.find(function(item){return item.id===id;}):null;
 calendarEditorDraft=calendar?JSON.parse(JSON.stringify(calendar)):{id:null,name:'',url:'',color:'#4C9AFF'};
 render();
}
function calendarColor(color){return /^#[0-9a-fA-F]{6}$/.test(color||'')?color:'#4C9AFF';}
function calendarEditorHTML(){
 if(!calendarEditorDraft)return '';
 var draft=calendarEditorDraft;
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-label="'+(draft.id?'Edit':'Add')+' calendar"><div class="profile-editor-body"><h3>'+(draft.id?'Edit':'Add')+' calendar</h3><label class="field">Name<input id="calendarEditorName" value="'+esc(draft.name||'')+'" placeholder="Calendar name"></label><label class="field">Calendar link<input id="calendarEditorUrl" value="'+esc(draft.url||'')+'" placeholder="webcal:// or https:// calendar link"></label><label class="field">Color<input id="calendarEditorColor" type="color" value="'+calendarColor(draft.color)+'"></label><div class="profile-editor-actions"><button type="button" class="btn mini" data-calendar-editor-save>Save</button><button type="button" class="btn mini ghost" data-calendar-editor-cancel data-editor-cancel>Cancel</button>'+(draft.id?'<button type="button" class="btn mini danger" style="margin-left:auto" data-calendar-editor-delete>Delete</button>':'')+'</div></div></dialog>';
}
function refreshCalendarSettings(){
 localStorage.removeItem('tend:cal2');
 if(window.TEND_LOAD_CALENDAR)window.TEND_LOAD_CALENDAR();
}
document.addEventListener('click',function(event){
 var button=event.target.closest&&event.target.closest('[data-calendar-editor-add],[data-calendar-editor-edit],[data-calendar-editor-save],[data-calendar-editor-cancel],[data-calendar-editor-delete]');
 if(!button)return;
 if(button.hasAttribute('data-calendar-editor-add')){openCalendarEditor();return;}
 if(button.hasAttribute('data-calendar-editor-edit')){openCalendarEditor(button.getAttribute('data-calendar-editor-edit'));return;}
 if(button.hasAttribute('data-calendar-editor-cancel')){calendarEditorDraft=null;render();return;}
 if(button.hasAttribute('data-calendar-editor-delete')){var deleteId=calendarEditorDraft&&calendarEditorDraft.id;if(deleteId){S.calendars=S.calendars.filter(function(item){return item.id!==deleteId;});calendarEditorDraft=null;save();refreshCalendarSettings();render();flash('Calendar removed');}return;}
 if(button.hasAttribute('data-calendar-editor-save')){
  var name=document.getElementById('calendarEditorName'),url=document.getElementById('calendarEditorUrl'),color=document.getElementById('calendarEditorColor'),draft=calendarEditorDraft;
  if(!draft||!name||!url||!color)return;
  var record=draft.id?S.calendars.find(function(item){return item.id===draft.id;}):null;
  if(!record){record={id:uid()};S.calendars.push(record);}
  record.name=name.value.trim();record.url=url.value.trim();record.color=color.value;
  calendarEditorDraft=null;save();refreshCalendarSettings();render();flash(draft.id?'Calendar updated':'Calendar added');
 }
});
function badgeColorsSettingsHTML(){
 var colors=badgeColorSettings(),labels={rhythm:'Rhythm',spark:'Spark',prayer:'Prayer',faith:'Faith'};
 return '<div class="card settings-card"><div class="subhead">Badge colors</div><p class="settings-help">Choose a distinct brand color for each badge. The app keeps the badge text readable against a softly tinted background.</p><div class="badge-color-settings">'+Object.keys(labels).map(function(key){return '<label class="badge-color-setting" for="badgeColor-'+key+'"><span>'+labels[key]+'</span><input type="color" id="badgeColor-'+key+'" data-badge-color="'+key+'" value="'+colors[key]+'"><span class="plan-kind plan-kind-'+key+'">'+(key==='faith'?collectionIcon('faith'):key==='rhythm'?collectionIcon('rhythms'):key==='spark'?collectionIcon('sparks'):collectionIcon('prayer'))+' '+labels[key]+'</span></label>';}).join('')+'</div><p class="settings-help">Color changes are saved automatically on this device.</p></div>';
}
function myProfileSettingsHTML(){
 var photo=settings().profilePhoto||null;
 return settingsPanel('profile')+'<div class="card settings-card"><div class="subhead">My profile</div><p class="settings-help">Add a photo to personalize the places where Tend shows you as “Me”. Your photo is saved with your Tend data.</p><div class="person-photo-controls">'+personAvatar({name:"Me",photo:photo},72)+'<input type="file" accept="image/*" data-profile-photo aria-label="Upload your profile photo">'+(photo?'<button type="button" class="btn mini danger" data-profile-photo-remove>Remove photo</button>':'')+'</div><p class="settings-help">Images are cropped to a square and compressed before saving.</p></div></section>';
}
document.addEventListener('click',function(event){
 var button=event.target.closest&&event.target.closest('[data-profile-photo-remove]');
 if(!button)return;
 if(settings().profilePhoto){delete settings().profilePhoto;save();render();flash('Profile photo removed');}
});
document.addEventListener('change',function(event){
 var input=event.target.closest&&event.target.closest('[data-profile-photo]'),file=input&&input.files&&input.files[0];
 if(!file)return;
 if(!/^image\//i.test(file.type)){flash('Choose an image file');input.value='';return;}
 var reader=new FileReader();
 reader.onerror=function(){flash('Could not read that image');input.value='';};
 reader.onload=function(){
  var image=new Image();
  image.onerror=function(){flash('Could not load that image');input.value='';};
  image.onload=function(){
   var size=144,side=Math.min(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');
   if(!side){flash('That image has no usable dimensions');input.value='';return;}
   canvas.width=size;canvas.height=size;
   var context=canvas.getContext('2d');
   if(!context){flash('Could not process that image');input.value='';return;}
   context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,size,size);
   settings().profilePhoto=canvas.toDataURL('image/jpeg',.82);save();render();flash('Profile photo saved');
  };
  image.src=reader.result;
 };
 reader.readAsDataURL(file);
});
document.addEventListener('input',function(event){
 var input=event.target.closest&&event.target.closest('[data-badge-color]');
 if(!input||!/^#[0-9a-fA-F]{6}$/.test(input.value))return;
 document.documentElement.style.setProperty('--badge-'+input.getAttribute('data-badge-color')+'-color',input.value);
});
document.addEventListener('change',function(event){
 var input=event.target.closest&&event.target.closest('[data-badge-color]'),key;
 if(!input||!/^#[0-9a-fA-F]{6}$/.test(input.value))return;
 key=input.getAttribute('data-badge-color');
 S.settings.badgeColors=badgeColorSettings();
 S.settings.badgeColors[key]=input.value;
 save();applyBadgeColors();flash('Badge color saved');
});
function renderSettings(){
 if(settingsTab==='general'||settingsTab==='peoplecolors'||settingsTab==='goals')settingsTab='peoplemeters';
 if(settingsTab==='times'||settingsTab==='dates'||settingsTab==='holidays'||settingsTab==='calendars')settingsTab='schedule';
 var tabs=[['profile','My profile'],['display','Display'],['peoplemeters','People & meters'],['badges','Badge colors'],['schedule','Time & dates'],['weather','Weather'],['focus','Focus'],['plan','Plan'],['offload','Offload'],['sync','Sync']];
 var out='<div class="sectiontitle settings-title"><h2>Settings</h2><span class="hint">Make Tend work for you</span></div>';
 out+='<p class="settings-intro">Choose a section below to update your preferences.</p>';
 out+='<div class="profile-tabs settings-tabs" role="tablist" aria-label="Settings">'+tabs.map(function(t){return '<button type="button" role="tab" id="settings-tab-'+t[0]+'" aria-controls="settings-panel-'+t[0]+'" aria-selected="'+(settingsTab===t[0])+'" data-settingstab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
 out+=myProfileSettingsHTML();
 out+=mobileDisplaySettingsHTML();
 out+=settingsPanel('peoplemeters')+
  '<div class="settings-group-grid">'+
  (typeof peopleColorsSettingsHTML==='function'?peopleColorsSettingsHTML():'')+
  '<div class="card settings-card"><div class="subhead">Meters</div><p class="settings-help">These thresholds change score colors, not the scores themselves. They are used across the dashboard and area, people, rhythm, and prayer meters.</p>'+
  '<div class="meter-threshold-preview" id="meterThresholdPreview">'+meterThresholdPreviewHTML(settings().greenAt,settings().yellowAt,settings().baseline)+'</div>'+
  '<div class="setrow"><label for="setGreen">Green at or above</label><input type="number" id="setGreen" min="50" max="100" value="'+settings().greenAt+'"></div>'+
  '<div class="setrow"><label for="setYellow">Yellow at or above <span class="settings-field-note">(red is below)</span></label><input type="number" id="setYellow" min="10" max="80" value="'+settings().yellowAt+'"></div>'+
  '<div class="setrow meter-baseline-row"><label for="setBase">Starting score for inactive areas</label><input type="number" id="setBase" min="0" max="100" value="'+settings().baseline+'"></div>'+
  '<p class="settings-help meter-baseline-help">This baseline starts activity-based area scores when there are no recent events and no active rhythms. Faith uses its active practice scores; people, rhythms, and prayers use their own scoring.</p>'+
  '<button class="btn" id="setSave">Save meter settings</button></div></div></section>';
 out+=settingsPanel('badges')+badgeColorsSettingsHTML()+'</section>';
 out+=settingsPanel('schedule')+dayBlockSettingsHTML()+keyDatesSettingsHTML()+holidaySettingsHTML();
 out+='<div class="card settings-card"><div class="subhead">Connected calendars</div><p class="settings-help">Add a public iCloud calendar to show its events on your Tend dashboard. On iCloud.com, open Calendar, choose the share icon beside a calendar, enable Public Calendar, and copy its link.</p>';
 (S.calendars||[]).forEach(function(ca){
  out+='<div class="settings-calendar-row"><span class="settings-calendar-swatch" style="background:'+calendarColor(ca.color)+'"></span><div><strong>'+esc(ca.name||'Unnamed calendar')+'</strong><span>'+esc(ca.url||'No calendar link yet')+'</span></div><button type="button" class="btn mini ghost" data-calendar-editor-edit="'+esc(ca.id)+'">Edit</button></div>';
 });
 if(!S.calendars.length)out+='<div class="empty">No calendars connected yet.</div>';
 out+='<div class="settings-actions"><button type="button" class="btn ghost" data-calendar-editor-add>Add calendar</button></div>'+calendarEditorHTML()+'</div></section>';
 out+=weatherSettingsHTML();
 out+=settingsPanel('focus')+focusSettingsHTML()+'</section>';
 out+=settingsPanel('plan')+(typeof renderCarePlan==='function'?renderCarePlan():'')+'</section>';
 out+=settingsPanel('offload')+(typeof renderOffload==='function'?renderOffload():'')+'</section>';
 out+=settingsPanel('sync');
 var st=window.SYNCcfg||{};
 out+='<div class="card settings-card"><div class="subhead">Sync your data</div><p class="settings-help">Connect to your private data repository to back up and sync Tend between devices. These settings are stored on this device.</p>'+
 '<div class="field"><label for="syncOwner">Repository owner</label><input id="syncOwner" autocomplete="off" value="'+esc(st.owner||"")+'"></div>'+
 '<div class="field"><label for="syncRepo">Repository name</label><input id="syncRepo" autocomplete="off" value="'+esc(st.repo||"")+'"></div>'+
 '<div class="field"><label for="syncToken">Personal access token</label><input id="syncToken" type="password" autocomplete="off" placeholder="Fine-grained token scoped to your data repository" value="'+esc(st.token||"")+'"></div>'+
 '<div class="settings-actions"><button type="button" class="btn ghost" id="syncSave">Save connection</button><button type="button" class="btn ghost" id="syncExport">Export backup</button></div>'+
 '<div class="settings-sync-actions"><button type="button" class="btn" id="syncReloadLatest" title="Fetch the newest version of Tend and reload this page">&#10227; Reload latest</button><button type="button" class="btn" id="syncPush">Push now</button><button type="button" class="btn ghost" id="syncPull">Pull now</button><button type="button" class="btn ghost" id="syncForcePull" title="Replace all local data with the cloud copy">Force pull (cloud wins)</button></div>'+
 '<div id="syncVersionLine" class="settings-version-line"></div></div></section>';
 return out;
}
function meterThresholdPreviewHTML(green,yellow,baseline){
 green=Number(green);yellow=Number(yellow);baseline=Number(baseline);
 if(!Number.isFinite(green))green=80;if(!Number.isFinite(yellow))yellow=50;if(!Number.isFinite(baseline))baseline=50;
 var yellowAt=clamp(yellow,0,100),greenAt=clamp(green,0,100),baseAt=clamp(baseline,0,100),baseColor=baseAt>=greenAt?"green":(baseAt>=yellowAt?"yellow":"red");
 var baseStatus=baseColor==="green"?"Healthy":baseColor==="yellow"?"Slipping - tend it soon":"Needs attention now";
 return '<div class="meter-scale-wrap"><div class="meter-scale" aria-hidden="true"><span class="meter-scale-red" style="width:'+yellowAt+'%"></span><span class="meter-scale-yellow" style="width:'+Math.max(0,greenAt-yellowAt)+'%"></span><span class="meter-scale-green" style="width:'+Math.max(0,100-greenAt)+'%"></span><i class="meter-scale-marker" style="left:'+baseAt+'%"></i></div><div class="meter-scale-ticks" aria-label="Score scale from 0 to 100">'+Array.from({length:11},function(_,i){return '<span style="left:'+(i*10)+'%"><i></i><b>'+i*10+'</b></span>';}).join('')+'</div></div><div class="meter-scale-labels"><span>Red</span><span>Yellow '+yellowAt+'</span><span>Green '+greenAt+'</span></div><div class="meter-baseline-preview"><span class="sm-dot '+baseColor+'" aria-hidden="true"></span><span>Inactive area starts at <strong>'+baseAt+'</strong> · '+baseStatus+'</span></div>';
}
function updateMeterThresholdPreview(){
 var preview=el("meterThresholdPreview");if(!preview)return;
 preview.innerHTML=meterThresholdPreviewHTML(el("setGreen").value,el("setYellow").value,el("setBase").value);
}

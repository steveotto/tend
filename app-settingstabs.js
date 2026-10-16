"use strict";
/* ============ settings tabs override: focused, task-based settings groups ============ */
var settingsTab="general",settingsDialogOpen=null,settingsDialogReturn=null,settingsDialogOpener=null;
var calendarEditorDraft=null;
function applyMobileDashboardTextSize(){
 var savedSize=settings().mobileTextSize,size=savedSize==="large"||savedSize==="larger"?savedSize:"normal";
 document.documentElement.setAttribute("data-mobile-text-size",size==="larger"?"large":size);
 document.documentElement.setAttribute("data-mobile-text-size-level",size);
}
applyMobileDashboardTextSize();
function mobileDisplaySettingsHTML(){
 var savedSize=settings().mobileTextSize,selected=savedSize==="large"||savedSize==="larger"?savedSize:"normal";
 return '<label class="settings-inline-row"><span><strong>Text size</strong><small>Today dashboard</small></span><select id="mobileTextSize" data-mobile-text-size aria-label="Today dashboard text size"><option value="normal"'+(selected==="normal"?' selected':'')+'>Small</option><option value="large"'+(selected==="large"?' selected':'')+'>Medium</option><option value="larger"'+(selected==="larger"?' selected':'')+'>Large</option></select></label>';
}
function weatherSettingsHTML(){
 return '<div class="card settings-card"><p class="settings-help">Tend tries your device location first. This fallback is used only when location is unavailable or denied.</p><label class="field" for="weatherFallbackLocation">Fallback location<input id="weatherFallbackLocation" type="text" autocomplete="address-level2" value="'+esc(settings().weatherFallbackLocation||"")+'" placeholder="City, state or postal code"></label><div class="settings-actions"><button type="button" class="btn" data-weather-settings-save>Save</button></div></div>';
}
document.addEventListener('change',function(event){
 var input=event.target.closest&&event.target.closest('[data-mobile-text-size]');
 if(!input)return;
 settings().mobileTextSize=input.value==="large"||input.value==="larger"?input.value:"normal";
 applyMobileDashboardTextSize();save();flash('Mobile display saved');
});
document.addEventListener('click',function(event){
 var button=event.target.closest&&event.target.closest('[data-weather-settings-save]');
 if(!button)return;
 var input=document.getElementById('weatherFallbackLocation');
 if(!input)return;
 settings().weatherFallbackLocation=input.value.trim();
 nowWeather.requestId++;nowWeather.status='idle';nowWeather.position=null;nowWeather.report=null;
 if(window.tendCloseSettingsDialog)window.tendCloseSettingsDialog();
 save();render();if(window.tendRestoreSettingsDialogFocus)window.tendRestoreSettingsDialogFocus();flash(settings().weatherFallbackLocation?'Weather settings saved':'Weather fallback cleared');
});
function openCalendarEditor(id){
 var calendar=id?S.calendars.find(function(item){return item.id===id;}):null;
 settingsDialogReturn=settingsDialogOpen;
 settingsDialogOpen=null;
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
 if(window.clearTendCalendarCache)window.clearTendCalendarCache();else localStorage.removeItem('tend:cal2');
 if(window.TEND_LOAD_CALENDAR)window.TEND_LOAD_CALENDAR();
}
function finishCalendarEditor(){
 calendarEditorDraft=null;
 settingsDialogOpen=settingsDialogReturn;
 settingsDialogReturn=null;
 render();
}
document.addEventListener('click',function(event){
 var button=event.target.closest&&event.target.closest('[data-calendar-editor-add],[data-calendar-editor-edit],[data-calendar-editor-save],[data-calendar-editor-cancel],[data-calendar-editor-delete]');
 if(!button)return;
 if(button.hasAttribute('data-calendar-editor-add')){openCalendarEditor();return;}
 if(button.hasAttribute('data-calendar-editor-edit')){openCalendarEditor(button.getAttribute('data-calendar-editor-edit'));return;}
 if(button.hasAttribute('data-calendar-editor-cancel')){finishCalendarEditor();return;}
 if(button.hasAttribute('data-calendar-editor-delete')){var deleteId=calendarEditorDraft&&calendarEditorDraft.id;if(deleteId){S.calendars=S.calendars.filter(function(item){return item.id!==deleteId;});finishCalendarEditor();save();refreshCalendarSettings();flash('Calendar removed');}return;}
 if(button.hasAttribute('data-calendar-editor-save')){
  var name=document.getElementById('calendarEditorName'),url=document.getElementById('calendarEditorUrl'),color=document.getElementById('calendarEditorColor'),draft=calendarEditorDraft;
  if(!draft||!name||!url||!color)return;
  var record=draft.id?S.calendars.find(function(item){return item.id===draft.id;}):null;
  if(!record){record={id:uid()};S.calendars.push(record);}
  record.name=name.value.trim();record.url=url.value.trim();record.color=color.value;
  var wasEdit=!!draft.id;finishCalendarEditor();save();refreshCalendarSettings();flash(wasEdit?'Calendar updated':'Calendar added');
 }
});
function actionColorsSettingsHTML(){
 var colors=actionColorSettings(),labels={rhythm:["Rhythms","Tend"],spark:["Sparks","Do it"],prayer:["Prayer","Pray"],fitness:["Health & Fitness","Log"]};
 var cards=Object.keys(labels).map(function(key){
  return '<article class="action-color-card"><div class="action-color-card-heading"><div><h3>'+labels[key][0]+'</h3><span>'+labels[key][1]+'</span></div><button type="button" class="action-color-swatch" data-action-color-open="'+key+'" style="--action-swatch:'+colors[key]+'" aria-label="Choose '+labels[key][0].toLowerCase()+' action color"></button></div><button type="button" class="btn mini action-color-preview action-color-'+key+'" data-action-color-open="'+key+'" aria-label="Preview '+labels[key][1]+' button. Tap to choose its color">'+labels[key][1]+'</button><input class="action-color-input" type="color" data-action-color="'+key+'" value="'+colors[key]+'" aria-label="'+labels[key][0]+' action base color"></article>';
 }).join("");
 return '<div class="card settings-card"><div class="subhead">Action colors</div><p class="settings-help">Choose a color for each action. Tend creates a matching palette for buttons and Health & Fitness cards.</p><div class="action-color-settings">'+cards+'</div><div class="action-color-footer"><p class="settings-help">Changes save automatically and update actions and cards right away.</p><button type="button" class="action-color-reset" data-action-colors-reset>Reset to defaults</button></div></div><div class="card settings-card faith-badge-colors-card"><div class="subhead">Faith badge color</div><p class="settings-help">This badge color is separate from action colors.</p><div class="badge-color-settings"><label class="badge-color-setting" for="badgeColor-faith"><span>Faith</span><input type="color" id="badgeColor-faith" data-badge-color="faith" value="'+badgeColorSettings().faith+'"><span class="plan-kind plan-kind-faith">'+collectionIcon('faith')+' Faith</span></label></div></div>';
}
function openActionColorPicker(key){
 var input=document.querySelector('[data-action-color="'+key+'"]');
 if(!input)return;
 if(typeof input.showPicker==="function"){try{input.showPicker();return;}catch(error){}}
 input.click();
}
function myProfileSettingsHTML(){
 var photo=settings().profilePhoto||null;
 return '<div class="settings-profile-photo">'+personAvatar({name:"Me",photo:photo},40)+'<label class="btn mini ghost">Change photo<input type="file" accept="image/*" data-profile-photo aria-label="Upload your profile photo"></label>'+(photo?'<button type="button" class="btn mini ghost" data-profile-photo-remove>Remove</button>':'')+'</div>';
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
document.addEventListener('click',function(event){
 var picker=event.target.closest&&event.target.closest('[data-action-color-open]');
 if(picker){openActionColorPicker(picker.getAttribute('data-action-color-open'));return;}
 var reset=event.target.closest&&event.target.closest('[data-action-colors-reset]');
 if(!reset)return;
 S.settings.actionColors=Object.assign({},DEFAULT_ACTION_COLORS);
 applyActionColors();save();render();flash('Action colors reset');
});
document.addEventListener('input',function(event){
 var input=event.target.closest&&event.target.closest('[data-action-color]');
 if(!input||!/^#[0-9a-fA-F]{6}$/.test(input.value))return;
 var key=input.getAttribute('data-action-color');
 S.settings.actionColors=Object.assign(actionColorSettings(),{[key]:input.value});
 applyActionColors();
 var swatch=document.querySelector('[data-action-color-open="'+key+'"].action-color-swatch');
 if(swatch)swatch.style.setProperty('--action-swatch',input.value);
 save();
});
document.addEventListener('change',function(event){
 var input=event.target.closest&&event.target.closest('[data-badge-color]'),key;
 if(!input||!/^#[0-9a-fA-F]{6}$/.test(input.value))return;
 key=input.getAttribute('data-badge-color');
 S.settings.badgeColors=badgeColorSettings();
 S.settings.badgeColors[key]=input.value;
 save();applyBadgeColors();flash('Badge color saved');
});
document.addEventListener('change',function(event){
 var input=event.target.closest&&event.target.closest('[data-action-color]');
 if(!input||!/^#[0-9a-fA-F]{6}$/.test(input.value))return;
 flash('Action color saved');
});
function renderSettings(){
 var tabs=[["general","General"],["appearance","Appearance"],["connections","Connections"],["data","Data"]];
 function row(label,value,key,extra){
  return '<button type="button" class="settings-row" data-settings-open="'+key+'"><span><strong>'+label+'</strong><small>'+value+'</small></span><span class="settings-row-chevron" aria-hidden="true">›</span></button>';
 }
 function group(title,content){
  return '<section class="settings-group"><h2>'+title+'</h2><div class="settings-list">'+content+'</div></section>';
 }
 function panel(key,title,content){
  return '<section id="settings-panel-'+key+'" class="settings-panel" role="tabpanel" aria-labelledby="settings-tab-'+key+'"'+(settingsTab===key?'':' hidden')+'><h2 class="settings-panel-title">'+title+'</h2>'+content+'</section>';
 }
 function dialog(title,content,explicit){
  return '<dialog class="profile-editor-dialog settings-dialog" data-editor-modal aria-label="'+title+'"><div class="profile-editor-body"><div class="settings-dialog-heading"><h2>'+title+'</h2><button type="button" class="settings-dialog-close" data-settings-dialog-close data-editor-cancel aria-label="Close '+title+'">×</button></div><div class="settings-dialog-content">'+content+'</div><div class="settings-dialog-footer"><button type="button" class="btn mini ghost" data-settings-dialog-close data-editor-cancel>'+(explicit?'Cancel':'Done')+'</button></div></div></dialog>';
 }
 function metersHTML(){
  return '<div class="card settings-card"><p class="settings-help">These thresholds change score colors, not scores.</p><div class="meter-threshold-preview" id="meterThresholdPreview">'+meterThresholdPreviewHTML(settings().greenAt,settings().yellowAt,settings().baseline)+'</div>'+
   '<div class="setrow"><label for="setGreen">Green at or above</label><input type="number" id="setGreen" min="50" max="100" value="'+settings().greenAt+'"></div>'+
   '<div class="setrow"><label for="setYellow">Yellow at or above</label><input type="number" id="setYellow" min="10" max="80" value="'+settings().yellowAt+'"></div>'+
   '<div class="setrow meter-baseline-row"><label for="setBase">Starting score for inactive areas</label><input type="number" id="setBase" min="0" max="100" value="'+settings().baseline+'"></div>'+
   '<p class="settings-help">The baseline applies when activity-based areas have no recent events or active rhythms.</p><button class="btn" id="setSave">Save</button></div>';
 }
 function calendarHTML(){
  var html='<div class="card settings-card"><p class="settings-help">Add a public iCloud calendar to show its events on your Tend dashboard.</p>';
  (S.calendars||[]).forEach(function(calendar){
   html+='<div class="settings-calendar-row"><span class="settings-calendar-swatch" style="background:'+calendarColor(calendar.color)+'"></span><div><strong>'+esc(calendar.name||'Unnamed calendar')+'</strong><span>'+esc(calendar.url||'No calendar link yet')+'</span></div><button type="button" class="btn mini ghost" data-calendar-editor-edit="'+esc(calendar.id)+'">Edit</button></div>';
  });
  if(!(S.calendars||[]).length)html+='<div class="empty">No calendars connected yet.</div>';
  return html+'<div class="settings-actions"><button type="button" class="btn mini ghost" data-calendar-editor-add>Add calendar</button></div></div>';
 }
 var displayName=window.TendAuth&&typeof window.TendAuth.displayName==="function"?window.TendAuth.displayName():"";
 var activeHolidays=typeof majorHolidays==="undefined"?0:majorHolidays.filter(function(item){return holidayEnabled(item.id);}).length;
 var focusCount=typeof focusBlocks==="function"?focusBlocks().length:0;
 var legacyRecovery=typeof tendLegacyRecoverySettingsHTML==="function"?tendLegacyRecoverySettingsHTML():"";
 var backup=typeof tendAccountDataSettingsHTML==="function"?tendAccountDataSettingsHTML("backup"):"";
 var recovery=typeof tendAccountDataSettingsHTML==="function"?tendAccountDataSettingsHTML("recovery"):"";
 var general=group("Account & profile",
  '<button type="button" class="settings-row" data-me-open><span><strong>Profile</strong><small>'+esc(displayName||"Add your display name in Me")+'</small></span><span class="settings-row-chevron" aria-hidden="true">›</span></button>'+
  (typeof tendAccountSettingsHTML==="function"?tendAccountSettingsHTML():'')+
  '<div class="settings-row-static"><span><strong>Profile photo</strong><small>Shown where Tend represents you.</small></span>'+myProfileSettingsHTML()+'</div>')+
  group("Daily use",row("Focus",focusCount+" time sections selected","general-focus")+row("Daily time sections","Rename sections and adjust their start times","general-time"))+
  '<nav class="settings-destinations" aria-label="More Tend tools"><span>Open a dedicated page</span><button type="button" class="btn mini ghost" data-utilnav="careplan">Plan</button><button type="button" class="btn mini ghost" data-utilnav="offload">Offload</button></nav>';
 var appearance=group("Display",mobileDisplaySettingsHTML()+row("Colors","Actions, people and Faith badges","appearance-colors")+row("Meters","Score color thresholds: "+settings().greenAt+" green · "+settings().yellowAt+" yellow","appearance-meters"))+
  (typeof faithSettingsHTML==="function"?group("Faith",row("Faith presentation","Section visibility and badge color","appearance-faith")):"");
 var connections=group("Calendar & integrations",
  row("Calendar feeds",(S.calendars||[]).length+" configured","connections-calendars")+
  row("Weather","Fallback: "+(settings().weatherFallbackLocation?esc(settings().weatherFallbackLocation):"device location when allowed"),"connections-weather")+
  row("Key dates",(S.keyDates||[]).length+" configured","connections-keydates")+
  row("Holidays",activeHolidays+" selected","connections-holidays")+
  (legacyRecovery?'<details class="settings-advanced"><summary>Advanced · optional GitHub recovery</summary><div class="settings-advanced-content">'+legacyRecovery+'</div></details>':''));
 var dataContent=backup+(recovery?'<section class="settings-data-recovery"><h3>Recovery</h3>'+recovery+'</section>':'');
 var data=group("Data & privacy",dataContent||'<p class="settings-empty">No account data tools are available.</p>');
 var dialogContent="";
 if(settingsDialogOpen==="general-focus")dialogContent=dialog("Focus",typeof focusSettingsHTML==="function"?focusSettingsHTML():"",false);
 else if(settingsDialogOpen==="general-time"){
  dialogContent=dialog("Daily time sections",dayBlockSettingsHTML(),true);
 }
 else if(settingsDialogOpen==="appearance-colors")dialogContent=dialog("Colors",actionColorsSettingsHTML()+(typeof peopleColorsSettingsHTML==="function"?peopleColorsSettingsHTML():""),false);
 else if(settingsDialogOpen==="appearance-meters")dialogContent=dialog("Meters",metersHTML(),true);
 else if(settingsDialogOpen==="appearance-faith")dialogContent=dialog("Faith presentation",typeof faithSettingsHTML==="function"?faithSettingsHTML():"",false);
 else if(settingsDialogOpen==="connections-calendars")dialogContent=dialog("Calendar feeds",calendarHTML(),false);
 else if(settingsDialogOpen==="connections-weather")dialogContent=dialog("Weather",weatherSettingsHTML(),true);
 else if(settingsDialogOpen==="connections-keydates")dialogContent=dialog("Key dates",typeof keyDatesSettingsHTML==="function"?keyDatesSettingsHTML(false):"",false);
 else if(settingsDialogOpen==="connections-holidays")dialogContent=dialog("Holidays",typeof holidaySettingsHTML==="function"?holidaySettingsHTML():"",false);
 var out='<main class="settings-page">'+tendSectionHeaderHTML({title:"Settings",subtitle:"",className:"settings-title"})+
  '<div class="settings-tablist" role="tablist" aria-label="Settings sections">'+tabs.map(function(item){return '<button type="button" role="tab" id="settings-tab-'+item[0]+'" aria-controls="settings-panel-'+item[0]+'" aria-selected="'+(settingsTab===item[0])+'" tabindex="'+(settingsTab===item[0]?'0':'-1')+'" data-settings-tab="'+item[0]+'">'+item[1]+'</button>';}).join("")+'</div>'+
  panel("general","General",general)+panel("appearance","Appearance",appearance)+panel("connections","Connections",connections)+panel("data","Data",data)+dialogContent+'</main>';
 if(calendarEditorDraft)out+=calendarEditorHTML();
 if(typeof keyDateEditorDraft!=="undefined"&&keyDateEditorDraft)out+=keyDateEditorHTML();
 return out;
}
function closeTendSettingsDialog(){
 settingsDialogOpen=null;
}
window.tendCloseSettingsDialog=closeTendSettingsDialog;
window.tendRestoreSettingsDialogFocus=function(){
 var focusKey=settingsDialogOpener,focusTarget=focusKey&&document.querySelector('[data-settings-open="'+focusKey+'"]');
 if(focusTarget)focusTarget.focus();
};
document.addEventListener("click",function(event){
 var tabButton=event.target.closest&&event.target.closest("[data-settings-tab]");
 if(tabButton){
  settingsTab=tabButton.getAttribute("data-settings-tab");
  render();
  var selected=document.getElementById("settings-tab-"+settingsTab);if(selected)selected.focus();
  return;
 }
 var opener=event.target.closest&&event.target.closest("[data-settings-open]");
 if(opener){
  settingsDialogOpener=opener.getAttribute("data-settings-open");
  settingsDialogOpen=settingsDialogOpener;
  render();
  return;
 }
 if(event.target.closest&&event.target.closest("[data-settings-dialog-close]")){
  var focusKey=settingsDialogOpener;
  settingsDialogOpen=null;
  render();
  var focusTarget=focusKey&&document.querySelector('[data-settings-open="'+focusKey+'"]');if(focusTarget)focusTarget.focus();
 }
});
document.addEventListener("keydown",function(event){
 var active=event.target.closest&&event.target.closest('[role="tab"][data-settings-tab]');
 if(!active)return;
 var index=settingsTab==="general"?0:settingsTab==="appearance"?1:settingsTab==="connections"?2:3;
 if(event.key==="ArrowRight"||event.key==="ArrowDown")index=(index+1)%4;
 else if(event.key==="ArrowLeft"||event.key==="ArrowUp")index=(index+3)%4;
 else if(event.key==="Home")index=0;
 else if(event.key==="End")index=3;
 else return;
 event.preventDefault();
 var next=["general","appearance","connections","data"][index];settingsTab=next;render();
 var button=document.getElementById("settings-tab-"+next);if(button)button.focus();
});
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

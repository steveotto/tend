"use strict";
/* Shared presentation components for Today, People, Faith, and related views. */
function tendSectionHeaderHTML(options){
 options=options||{};
 var title=String(options.title||""),classes=["sectiontitle",options.className||""].filter(Boolean).join(" "),titleId=options.titleId?' id="'+esc(options.titleId)+'"':"",subtitle=options.subtitle?'<span class="hint">'+esc(options.subtitle)+'</span>':"",metadata=options.metadata?'<span class="hint">'+esc(options.metadata)+'</span>':"",icon=options.iconHTML?'<span class="sectiontitle-icon" aria-hidden="true">'+options.iconHTML+'</span>':"",trailing=options.trailingHTML||"",tag=options.tagName==="header"?"header":"div",style=options.style?' style="'+esc(options.style)+'"':"";
 return '<'+tag+' class="'+esc(classes)+'"'+style+'>'+icon+'<h2'+titleId+'>'+esc(title)+'</h2>'+subtitle+metadata+trailing+'</'+tag+'>';
}
function tendPrayerSectionHTML(title,content,options){
 options=options||{};
 return tendSectionHeaderHTML({title:title,className:options.headerClassName,subtitle:options.subtitle,metadata:options.metadata,trailingHTML:options.trailingHTML,iconHTML:options.iconHTML,titleId:options.titleId})+content;
}
function tendFocusedPrayerSectionHTML(options){
 options=options||{};
 return '<section class="'+esc(["dashboard-focused-prayer",options.className||""].join(" ").trim())+'" aria-label="'+esc(options.ariaLabel||"Focused prayer")+'"><div class="dashboard-prayer-controls">'+(options.controlsHTML||"")+'</div>'+(options.actionHTML||"")+(options.dialogHTML||"")+'</section>';
}
function tendPrayerTimeframePickerHTML(options){
 options=options||{};
 var personId=options.personId===undefined?"":String(options.personId);
 function optionHTML(item){
  var count=Number(item.count)||0;
  var selected=String(item.id)===String(options.selectedTimeframeId);
  return '<button type="button" class="prayer-timeframe-picker__option'+(item.isCurrent?" is-current":"")+(selected?" is-selected":"")+'" data-prayer-time-option="'+esc(item.id)+'"'+(personId?' data-prayer-time-person="'+esc(personId)+'"':"")+' aria-pressed="'+selected+'"><span class="prayer-timeframe-picker__label">'+esc(item.label)+'</span><span class="prayer-timeframe-picker__description">'+esc(item.timeDescription)+'</span><span class="prayer-timeframe-picker__count">'+count+' '+(count===1?"prayer":"prayers")+'</span></button>';
 }
 var items=(options.options||[]).map(optionHTML);
 items.push(optionHTML({id:"allday",label:"All Day",timeDescription:"Any time today",count:options.allDayCount}));
 var label=String(options.label||"Now");
 return '<div class="prayer-timeframe-picker"><details class="prayer-timeframe-picker__menu"><summary class="prayer-timeframe-picker__trigger" aria-label="Choose timeframe, currently '+esc(label)+'"><span>'+esc(label)+'</span><span class="prayer-timeframe-picker__chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 6 4.5 4.5L12.5 6"/></svg></span></summary><div class="prayer-timeframe-picker__options" role="group" aria-label="Prayer timeframes">'+items.join("")+'</div></details></div>';
}
function tendPrayerTimeframePickerState(mode,options,allDayCount){
 options=options||[];
 var selectedId=mode==="all"||mode==="allday"?"allday":mode==="now"||options.some(function(item){return item.id===mode;})?mode:"now";
 var selectedOption=options.find(function(item){return item.id===selectedId;});
 return {
  options:options,
  selectedTimeframeId:selectedId,
  selectedCount:selectedId==="allday"?Number(allDayCount)||0:selectedOption?Number(selectedOption.count)||0:0,
  allDayCount:Number(allDayCount)||0,
  label:selectedId==="now"?"Now":selectedId==="allday"?"All Day":selectedOption?selectedOption.label:"Now"
 };
}
function tendPrayerFilterDialogHTML(options){
 options=options||{};
 var id=String(options.id||"dashboard-prayer-people-dialog"),titleId=String(options.titleId||"dashboard-prayer-people-title"),intro=options.intro?'<p class="profile-tab-intro">'+esc(options.intro)+'</p>':"",selection=options.selectionHTML||"",primary=options.primaryActionHTML||"",close=options.closeActionHTML||"";
 var classes="profile-editor-dialog rhythm-picker-dialog dashboard-prayer-people-dialog";
 return '<dialog class="'+classes+'" id="'+esc(id)+'" data-editor-modal aria-labelledby="'+esc(titleId)+'"><div class="profile-editor-body"><h3 id="'+esc(titleId)+'" tabindex="-1">'+esc(options.title||"Prayer timeframe")+'</h3>'+(options.timeframeHTML||"")+intro+tendPrayerIncludedSummaryHTML(options.count,options.timeLabel)+selection+'<div class="profile-editor-actions dashboard-prayer-people-actions">'+primary+close+'</div></div></dialog>';
}
function tendPrayerIncludedSummaryHTML(count,label){
 count=Number(count)||0;
 return '<p class="dashboard-prayer-people-count" aria-live="polite">Focused Prayer will include <strong>'+count+' '+(count===1?"prayer request":"prayer requests")+'</strong> · '+esc(label||"Now")+'</p>';
}
function tendTodayWithPersonHTML(options){
 options=options||{};
 var waiting=Number(options.waitingCount)||0,title="Today with "+String(options.personName||"");
 var queueLabel=waiting?waiting+" in queue":"all tended \u2713";
 var header=tendSectionHeaderHTML({title:title,className:"today-with-person-heading",trailingHTML:'<span class="qpill'+(waiting?"":" clear")+'">'+queueLabel+'</span>'});
 var content=options.itemsHTML||'<div class="empty" style="margin-top:8px">'+esc(options.emptyMessage||"Nothing waiting - these next steps are all tended.")+'</div>';
 return header+'<div class="card act today-with-person" style="margin-bottom:14px">'+content+'</div>';
}
function tendRecordCardContentHTML(kind,record,options){
 record=record||{};options=options||{};
 var title=options.title!==undefined?options.title:record.text||"",description=String(options.description!==undefined?options.description:(kind==="spark"?record.details:record.description)||"").trim(),meta=options.meta,badges=options.badges||"",peopleBadges=options.peopleBadges||"",metaMarkup=options.metaMarkup;
 if(options.layout==="plan")return '<div class="plan-item-copy"><div class="plan-item-heading"><strong class="tend-type-title">'+esc(title)+'</strong>'+(options.actionHTML?'<div class="plan-item-action">'+options.actionHTML+'</div>':"")+'</div><div class="plan-item-description">'+(description?'<div class="tend-type-description">'+esc(description)+'</div>':options.showNoDetails?'<div class="plan-item-no-description">No details...</div>':"")+'</div></div>';
 if(options.layout==="profile")return '<div class="profile-rhythm-heading"><div class="profile-rhythm-title-line"><strong class="tend-type-title">'+esc(title||"")+'</strong>'+(options.headingActionHTML||"")+'</div>'+(description?'<div class="tend-type-description">'+esc(description)+'</div>':options.showNoDetails?'<div class="tend-type-description no-details">No details...</div>':"")+'</div>';
 if(options.layout==="careplan")return '<div class="careplan-title"><strong class="tend-type-title">'+esc(title||"")+'</strong>'+peopleBadges+'</div>'+(meta?'<div class="careplan-meta tend-type-meta">'+esc(meta)+'</div>':"")+(description?'<div class="careplan-details tend-type-description">'+esc(description)+'</div>':options.showNoDetails?'<div class="careplan-details tend-type-description no-details">No details...</div>':"");
 return '<div class="tend-row-content"><div class="tend-row-heading"><strong class="tend-type-title">'+esc(title||"")+'</strong>'+badges+'</div>'+(description?'<div class="tend-type-description">'+esc(description)+'</div>':options.showNoDetails?'<div class="tend-type-description no-details">No details...</div>':'')+(peopleBadges?'<div class="tend-row-people">'+peopleBadges+'</div>':'')+(metaMarkup!==undefined?metaMarkup:(meta?'<div class="tend-type-meta">'+esc(meta)+'</div>':""))+'</div>';
}
function tendRhythmCardContentHTML(record,options){
 options=options||{};
 return tendRecordCardContentHTML("rhythm",record,{title:options.title!==undefined?options.title:record&&record.text,description:options.description!==undefined?options.description:record&&record.description,meta:options.meta,badges:options.badges,peopleBadges:options.peopleBadges,metaMarkup:options.metaMarkup,showNoDetails:options.showNoDetails,layout:options.layout,actionHTML:options.actionHTML,headingActionHTML:options.headingActionHTML});
}
function tendRhythmCardHTML(record,options){
 record=record||{};options=options||{};
 function attrs(values){
  return Object.keys(values||{}).map(function(name){
   if(!/^[a-z][a-z0-9-]*$/i.test(name))return "";
   return " "+name+'="'+esc(values[name])+'"';
  }).join("");
 }
 var title=String(options.title||record.text||"(unnamed rhythm)"),description=String(options.description!==undefined?options.description:record.description||"").trim();
 var score=Number.isFinite(options.score)?options.score:null,scoreText=score===null?"—":score+"%",scoreClass=String(options.scoreClass||"neutral");
 var editAction=options.editAttributes?'<button type="button" class="rhythm-card__edit"'+attrs(options.editAttributes)+' aria-label="Edit '+esc(title)+'" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8Z"/></svg></button>':"";
 var tendAction='<button type="button" class="btn mini rhythm-card__tend"'+attrs(options.tendAttributes)+' title="Record a moment of care">Tend</button>';
 var chartAction='<button type="button" class="rhythm-card__score '+esc(scoreClass)+'"'+attrs(options.historyAttributes)+' aria-label="Rhythm health '+(score===null?"unknown":score+"%")+'. View chart." title="View rhythm health chart"><span>'+scoreText+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/></svg></button>';
 var people=options.peopleBadgesHTML||"",categories=options.categoryBadgesHTML||"",remove=options.removeAttributes?'<button type="button" class="rhythm-card__remove"'+attrs(options.removeAttributes)+' aria-label="'+esc(options.removeLabel||"Remove "+title)+'" title="'+esc(options.removeTitle||"Remove")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7"/></svg></button>':"";
 var frequency=options.frequency||{},time=options.time||{},last=options.lastTended||{};
 return '<article class="rhythm-card card">'
  +'<div class="rhythm-card__main"><div class="rhythm-card__top"><div class="rhythm-card__heading"><div class="rhythm-card__title-line"><strong class="tend-type-title">'+esc(title)+'</strong>'+editAction+'</div>'
  +(description?'<div class="tend-type-description">'+esc(description)+'</div>':'<div class="tend-type-description no-details">No details...</div>')
  +'</div><div class="rhythm-card__actions">'+tendAction+chartAction+'</div></div>'
  +(people||categories||remove?'<div class="rhythm-card__badges">'+people+categories+remove+'</div>':"")
  +'</div><footer class="rhythm-card__meta" aria-label="Rhythm schedule and history">'
  +'<span class="rhythm-card__meta-item" aria-label="Frequency: '+esc(frequency.full||frequency.label||"")+'">'+(options.frequencyIconHTML||"")+'<span class="rhythm-card__meta-text"><span class="rhythm-card__meta-wide">'+esc(frequency.label||"")+'</span><span class="rhythm-card__meta-narrow">'+esc(frequency.narrow||frequency.label||"")+'</span></span></span>'
  +'<span class="rhythm-card__meta-item" aria-label="Preferred time: '+esc(time.full||time.label||"")+'">'+(options.timeIconHTML||"")+'<span class="rhythm-card__meta-text"><span class="rhythm-card__meta-wide">'+esc(time.label||"")+'</span><span class="rhythm-card__meta-narrow">'+esc(time.narrow||time.label||"")+'</span></span></span>'
  +'<span class="rhythm-card__meta-item rhythm-card__last" aria-label="'+esc(last.full||"Never tended")+'">'+(options.lastIconHTML||"")+'<span>'+esc(last.label||"Never")+'</span></span></footer></article>';
}
function tendSparkCardContentHTML(record,options){
 options=options||{};
 return tendRecordCardContentHTML("spark",record,{title:options.title!==undefined?options.title:record&&record.text,description:options.description!==undefined?options.description:record&&record.details,meta:options.meta,badges:options.badges,peopleBadges:options.peopleBadges,metaMarkup:options.metaMarkup,showNoDetails:options.showNoDetails,layout:options.layout,actionHTML:options.actionHTML,headingActionHTML:options.headingActionHTML});
}
function tendPrayerCardContentHTML(record,options){
 options=options||{};
 return tendRecordCardContentHTML("prayer",record,{title:options.title!==undefined?options.title:record&&record.text,description:options.description!==undefined?options.description:record&&record.details,meta:options.meta,badges:options.badges,peopleBadges:options.peopleBadges,metaMarkup:options.metaMarkup,showNoDetails:options.showNoDetails});
}
function tendValidateRhythmEditForm(form,mode){
 var title=mode==="careplan"?form.querySelector('[data-cpf="title"]'):form.querySelector('[data-rfield$="|text"]');
 if(!title||!title.value.trim())return {field:title,message:"title"};
 var enabled=mode==="careplan"?form.querySelector('[data-cpf="endDateEnabled"]'):form.querySelector('[data-rfield$="|endDateEnabled"]');
 var until=mode==="careplan"?form.querySelector('[data-cpf="until"]'):form.querySelector('[data-rfield$="|until"]');
 if(enabled&&enabled.checked&&(!until||!until.value))return {field:until,message:"endDate"};
 return null;
}
function tendApplyRhythmEditForm(record,form,mode){
 var carePlan=mode==="careplan";
 function field(name){return carePlan?form.querySelector('[data-cpf="'+(name==="freq"?"frequency":name)+'"]'):form.querySelector('[data-rfield$="|'+name+'"]');}
 var title=field(carePlan?"title":"text"),description=field("description"),frequency=field("freq"),tod=field("tod");
 record.text=title.value.trim();
 record.description=description.value.trim();
 record.freq=frequency.value;
 record.tod=tod.value;
 var weekdays=Array.prototype.slice.call(form.querySelectorAll(carePlan?'[data-cpf="weekdays"]:checked':'[data-rfield$="|weekdays"]:checked')).map(function(input){return +input.value;});
 if(weekdays.length)record.weekdays=weekdays;
 else if(record.freq==="weekly"||record.freq==="selectdays")record.weekdays=[new Date().getDay()];
 if(record.freq!=="selectdays"&&record.weekdays&&record.weekdays.length>1)record.weekdays=[record.weekdays[0]];
 var monthlyMode=form.querySelector(carePlan?'[data-cpf="monthlyMode"]:checked':'[data-rfield$="|monthlyMode"]:checked');
 if(monthlyMode)record.monthlyMode=monthlyMode.value;
 ["ord","ordWeekday","month","monthThe","every"].forEach(function(name){var input=field(name);if(input){var key=name==="monthThe"?"month":name;record[key]=+input.value||1;}});
 ["dayOfMonth","monthDay","qmonth"].forEach(function(name){var input=field(name);if(input&&input.value!=="")record[name]=+input.value||1;});
 var unit=field("unit");if(unit)record.unit=unit.value;
 var start=field("start");if(start)record.start=start.value||null;
 var enabled=field("endDateEnabled"),until=field("until");
 record.until=enabled&&enabled.checked&&until?until.value:null;
 record.endDateEnabled=!!record.until;
 if(typeof window!=="undefined"&&typeof window.tendNormalizeRhythmEditRecord==="function")window.tendNormalizeRhythmEditRecord(record);
 return record;
}
function tendRowContent(title,description,meta,badges,peopleBadges,metaMarkup,showNoDetails){
 return tendRecordCardContentHTML("record",{text:title,description:description},{meta:meta,badges:badges,peopleBadges:peopleBadges,metaMarkup:metaMarkup,showNoDetails:showNoDetails});
}

"use strict";
/* Shared presentation components for Today, People, Faith, and related views. */
function tendSectionHeaderHTML(options){
 options=options||{};
 var title=String(options.title||""),classes=["sectiontitle",options.className||""].filter(Boolean).join(" "),titleId=options.titleId?' id="'+esc(options.titleId)+'"':"",subtitle=options.subtitle?'<span class="hint">'+esc(options.subtitle)+'</span>':"",metadata=options.metadata?'<span class="hint">'+esc(options.metadata)+'</span>':"",icon=options.iconHTML?'<span class="sectiontitle-icon" aria-hidden="true">'+options.iconHTML+'</span>':"",trailing=options.trailingHTML||"",tag=options.tagName==="header"?"header":"div",style=options.style?' style="'+esc(options.style)+'"':"";
 return '<'+tag+' class="'+esc(classes)+'"'+style+'>'+icon+'<h2'+titleId+'>'+esc(title)+'</h2>'+subtitle+metadata+trailing+'</'+tag+'>';
}
function tendCategoryPageHeaderHTML(title,className){
 return tendSectionHeaderHTML({title:title,subtitle:"Structure beats good intentions",className:["category-page-heading",className||""].filter(Boolean).join(" "),tagName:"header"});
}
function tendHealthScoreText(score){
 return Number.isFinite(score)?String(Math.round(score)):"—";
}
function tendHealthScoreColor(score){
 if(!Number.isFinite(score))return "#BCC7C0";
 var tone=scoreClass(score);
 return tone==="green"?"#12B76A":tone==="yellow"?"#FFC133":"#FF5A45";
}
function tendScoreBreakdownHTML(items,options){
 options=options||{};
 var columns=Math.max(1,Number(options.columns)||items.length||1);
 var content=(items||[]).map(function(item){
  var score=Number.isFinite(item.score)?item.score:null,tone=score===null?"neutral":scoreClass(score),display=tendHealthScoreText(score),tag=item.actionAttributes?"button":"div",attributes=Object.keys(item.actionAttributes||{}).map(function(name){if(!/^data-[a-z0-9-]+$/i.test(name))return "";return " "+name+'="'+esc(item.actionAttributes[name])+'"';}).join(""),label=String(item.label||""),description=item.detailHTML!==undefined?item.detailHTML:item.detail?'<span>'+esc(item.detail)+'</span>':"",chevron=item.actionAttributes?'<span class="health-summary-chevron" aria-hidden="true">›</span>':"";
  var aria=item.ariaLabel||label+", health score "+(score===null?"unavailable":display+" out of 100");
  return '<'+tag+(tag==="button"?' type="button"':"")+' class="health-summary-item'+(item.actionAttributes?" is-action":"")+'"'+attributes+(item.actionAttributes?' aria-label="'+esc(aria)+'"':"")+'><span class="health-summary-score '+tone+'">'+esc(display)+'</span><span class="health-summary-label">'+esc(label)+chevron+'</span>'+(description?'<span class="health-summary-detail">'+description+'</span>':"")+'</'+tag+'>';
 }).join("");
 return '<div class="health-summary-breakdown" style="--health-summary-columns:'+columns+'" role="group" aria-label="'+esc(options.label||"Health breakdown")+'">'+content+'</div>';
}
function tendCategoryHealthSummaryHTML(options){
 options=options||{};
 var score=Number.isFinite(options.score)?options.score:null,tone=score===null?"neutral":scoreClass(score),display=tendHealthScoreText(score),title=String(options.title||"Overall health"),status=String(options.status||(score===null?"No activity yet":scoreLabel(score))),fill=options.fillHTML!==undefined?options.fillHTML:'<span class="category-health-fill '+tone+'" style="width:'+(score===null?0:Math.max(0,Math.min(100,score)))+'%" aria-hidden="true"></span>',lower=options.breakdownHTML||options.contentHTML||"";
 return '<section class="card category-health-card '+esc(options.className||"")+'" aria-labelledby="'+esc(options.titleId||"categoryHealthTitle")+'"><div class="category-health-heading"><div class="category-health-copy"><h3 id="'+esc(options.titleId||"categoryHealthTitle")+'">'+esc(title)+'</h3><p class="category-health-status statusword '+tone+'">'+esc(status)+'</p></div><span class="category-health-score '+tone+'">'+esc(display)+'</span></div><div class="category-health-meter" role="meter" aria-label="'+esc(title)+'" aria-valuemin="0" aria-valuemax="100"'+(score===null?' aria-valuetext="'+esc(status)+'"':' aria-valuenow="'+score+'" aria-valuetext="'+display+' out of 100: '+esc(status)+'"')+'>'+fill+'</div>'+lower+'</section>';
}
function tendPrayerSectionHTML(title,content,options){
 options=options||{};
 return tendSectionHeaderHTML({title:title,className:options.headerClassName,subtitle:options.subtitle,metadata:options.metadata,trailingHTML:options.trailingHTML,iconHTML:options.iconHTML,titleId:options.titleId})+content;
}
function tendPrayerEntryHTML(options){
 options=options||{};
 var id=String(options.id||"dashboard"),count=Number(options.count)||0,peopleCount=Number(options.peopleCount)||0,timeframe=String(options.timeframe||"Now");
 return '<section class="prayer-entry-module" aria-label="Focused Prayer"><div class="prayer-entry-summary"><strong>'+count+' '+(count===1?"request":"requests")+' · '+esc(timeframe)+'</strong><span>'+peopleCount+' '+(peopleCount===1?"person":"people")+' selected</span>'+(count?"":'<span class="prayer-entry-empty">No active requests match this selection.</span>')+'</div><div class="prayer-entry-actions"><button type="button" class="btn mini ghost" data-prayer-selection-open="'+esc(id)+'">Customize</button><button type="button" class="btn mini faith-start-prayer" data-prayer-session-start="'+esc(id)+'" aria-label="Start focused prayer for '+count+' '+(count===1?"request":"requests")+'"'+(count?"":" disabled")+'><span>Focused Prayer · '+count+'</span></button></div>'+(options.dialogHTML||"")+'</section>';
}
function tendPrayerTimeframePickerHTML(options){
 options=options||{};
 function optionHTML(item){
  var count=Number(item.count)||0;
  var selected=String(item.id)===String(options.selectedTimeframeId);
  return '<button type="button" class="prayer-timeframe-picker__option'+(item.isCurrent?" is-current":"")+(selected?" is-selected":"")+'" data-prayer-time-option="'+esc(item.id)+'" aria-pressed="'+selected+'"><span class="prayer-timeframe-picker__label">'+esc(item.label)+'</span><span class="prayer-timeframe-picker__description">'+esc(item.timeDescription)+'</span><span class="prayer-timeframe-picker__count">'+count+' '+(count===1?"request":"requests")+'</span></button>';
 }
 if(options.mode==="options"){
  var optionsHTML=(options.options||[]).map(optionHTML);
  optionsHTML.push(optionHTML({id:"allday",label:"All Day",timeDescription:"Any time today",count:options.allDayCount}));
  if(options.includeAllRequests)optionsHTML.push(optionHTML({id:"allrequests",label:"All requests",timeDescription:"Any active request, regardless of schedule",count:options.allRequestsCount}));
  return '<div class="prayer-timeframe-picker__options" role="group" aria-label="Prayer timeframes">'+optionsHTML.join("")+'</div>';
 }
 var label=String(options.label||"Now");
 return '<button type="button" class="prayer-timeframe-picker__trigger" data-prayer-selection-time-open aria-label="Change timeframe, currently '+esc(label)+'. '+esc(options.resolvedLabel||"")+'"><span class="prayer-timeframe-picker__summary"><strong>'+esc(label)+'</strong><span>'+esc(options.resolvedLabel||"")+'</span></span><span class="prayer-timeframe-picker__chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 6 4.5 4.5L12.5 6"/></svg></span></button>';
}
function tendPrayerTimeframePickerState(mode,options,allDayCount,allRequestsCount){
 options=options||[];
 var selectedId=mode==="all"||mode==="allday"?"allday":mode==="allrequests"?"allrequests":mode==="now"||options.some(function(item){return item.id===mode;})?mode:"now";
 var selectedOption=options.find(function(item){return item.id===selectedId;});
 return {
  options:options,
  selectedTimeframeId:selectedId,
  selectedCount:selectedId==="allday"?Number(allDayCount)||0:selectedId==="allrequests"?Number(allRequestsCount)||0:selectedOption?Number(selectedOption.count)||0:0,
  allDayCount:Number(allDayCount)||0,
  allRequestsCount:Number(allRequestsCount)||0,
  label:selectedId==="now"?"Now":selectedId==="allday"?"All Day":selectedId==="allrequests"?"All requests":selectedOption?selectedOption.label:"Now"
 };
}
function tendPrayerSelectionDialogHTML(options){
 options=options||{};
 var id=String(options.id||"prayer-selection-dialog"),titleId=String(options.titleId||"prayer-selection-title"),isTimeframe=options.view==="timeframe",close='<button type="button" class="prayer-selection-close" data-prayer-selection-close data-editor-cancel aria-label="Close prayer selection">×</button>';
 var body=isTimeframe?'<div class="prayer-selection-time-view"><button type="button" class="btn mini ghost prayer-selection-back" data-prayer-selection-back>Back</button><h4>Timeframe</h4>'+tendPrayerTimeframePickerHTML({mode:"options",options:options.timeOptions,selectedTimeframeId:options.selectedTimeframeId,allDayCount:options.allDayCount,allRequestsCount:options.allRequestsCount,includeAllRequests:options.includeAllRequests})+(Number(options.count)?"":'<p class="prayer-selection-empty" aria-live="polite">No active requests match these selections.</p>')+'</div>':'<div class="prayer-selection-people-view"><section class="prayer-selection-section"><h4>Timeframe</h4>'+(options.timeframeHTML||"")+'</section><section class="prayer-selection-section"><div class="prayer-selection-people-heading"><h4>People</h4><div class="prayer-selection-bulk"><button type="button" class="btn mini ghost" data-prayer-selection-people="all">Select all</button><button type="button" class="btn mini ghost" data-prayer-selection-people="clear">Clear</button></div></div>'+(options.groupsHTML||"")+'<div class="prayer-selection-people">'+(options.peopleHTML||"")+'</div></section>'+(Number(options.count)?"":'<p class="prayer-selection-empty" aria-live="polite">No active requests match these selections.</p>')+'</div>';
 return '<dialog class="profile-editor-dialog prayer-selection-dialog" id="'+esc(id)+'" data-editor-modal aria-labelledby="'+esc(titleId)+'"><header class="prayer-selection-header"><h3 id="'+esc(titleId)+'" tabindex="-1">'+(isTimeframe?"Timeframe":"Prayer selection")+'</h3>'+close+'</header><div class="prayer-selection-body" data-prayer-selection-body>'+body+'</div><footer class="prayer-selection-footer"><p class="prayer-selection-count" aria-live="polite">'+Number(options.count||0)+' '+(Number(options.count)===1?"request":"requests")+' selected</p><div class="prayer-selection-footer-actions"><button type="button" class="btn mini ghost" data-prayer-selection-done>Done</button><button type="button" class="btn mini faith-start-prayer" data-prayer-selection-start'+(Number(options.count)?"":" disabled")+'>Start prayer</button></div></footer></dialog>';
}
function tendTodayWithPersonHTML(options){
 options=options||{};
 var waiting=Number(options.waitingCount)||0,title="Today with "+String(options.personName||"");
 var queueLabel=waiting?waiting+" in queue":"all tended \u2713";
 var header=tendSectionHeaderHTML({title:title,className:"today-with-person-heading",trailingHTML:'<span class="qpill'+(waiting?"":" clear")+'">'+queueLabel+'</span>'});
 var content=options.itemsHTML||'<div class="profile-empty-state">'+esc(options.emptyMessage||"Nothing waiting - these next steps are all tended.")+'</div>';
 return header+'<div class="today-with-person" style="margin-bottom:14px">'+content+'</div>';
}
function tendRecordCardContentHTML(kind,record,options){
 record=record||{};options=options||{};
 var title=options.title!==undefined?options.title:record.text||"",description=String(options.description!==undefined?options.description:(kind==="spark"?record.details:record.description)||"").trim(),meta=options.meta,badges=options.badges||"",peopleBadges=options.peopleBadges||"",metaMarkup=options.metaMarkup;
 if(options.layout==="plan")return '<div class="plan-item-copy"><div class="plan-item-heading">'+(options.headingEditHTML?'<div class="spark-card__title-line"><strong class="tend-type-title">'+esc(title)+'</strong><div class="spark-card__title-edit">'+options.headingEditHTML+'</div></div>':'<strong class="tend-type-title">'+esc(title)+'</strong>')+(options.actionHTML?'<div class="plan-item-action">'+options.actionHTML+'</div>':"")+'</div><div class="plan-item-description">'+(description?'<div class="tend-type-description">'+esc(description)+'</div>':options.showNoDetails?'<div class="plan-item-no-description">No details...</div>':"")+'</div></div>';
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
 if(options.fitnessVariantHTML!==undefined){
  var variantClass=String(options.fitnessVariantClass||"").replace(/[^a-z0-9_-]/gi,"");
  return '<article class="rhythm-card card fitness-today-rhythm-card'+(variantClass?" "+variantClass:"")+'">'+options.fitnessVariantHTML+'</article>';
 }
 function attrs(values){
  return Object.keys(values||{}).map(function(name){
   if(!/^[a-z][a-z0-9-]*$/i.test(name))return "";
   return " "+name+'="'+esc(values[name])+'"';
  }).join("");
 }
 var title=String(options.title||record.text||"(unnamed rhythm)"),description=String(options.description!==undefined?options.description:record.description||"").trim();
 var score=Number.isFinite(options.score)?options.score:null,scoreText=tendHealthScoreText(score),scoreClass=String(options.scoreClass||"neutral");
 var editAction=options.editAttributes?'<button type="button" class="rhythm-card__edit"'+attrs(options.editAttributes)+' aria-label="Edit '+esc(title)+'" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8Z"/></svg></button>':"";
 var actionClass=String(options.actionClassName||"").replace(/[^a-z0-9_-]/gi,""),tendAction='<button type="button" class="btn mini rhythm-card__tend'+(actionClass?" "+actionClass:"")+'"'+(options.actionDisabled?' disabled aria-disabled="true"':"")+attrs(options.tendAttributes)+' title="'+esc(options.actionTitle||"Record a moment of care")+'">'+esc(options.actionLabel||"Tend")+'</button>';
 var chartAction=options.showScore===false?"":'<button type="button" class="rhythm-card__score '+esc(scoreClass)+'"'+attrs(options.historyAttributes)+' aria-label="Rhythm health '+(score===null?"unknown":scoreText+" out of 100")+'. View chart." title="View rhythm health chart"><span>'+scoreText+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/></svg></button>';
 var people=options.peopleBadgesHTML||"",categories=options.categoryBadgesHTML||"",remove=options.removeAttributes?'<button type="button" class="rhythm-card__remove"'+attrs(options.removeAttributes)+' aria-label="'+esc(options.removeLabel||"Remove "+title)+'" title="'+esc(options.removeTitle||"Remove")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7"/></svg></button>':"";
 var frequency=options.frequency||{},time=options.time||{},last=options.lastTended||{};
 var cardClass=String(options.cardClassName||"").replace(/[^a-z0-9_-]/gi,"");
 return '<article class="rhythm-card card'+(cardClass?" "+cardClass:"")+'">'
  +'<div class="rhythm-card__main"><div class="rhythm-card__top"><div class="rhythm-card__heading"><div class="rhythm-card__title-line"><strong class="tend-type-title">'+esc(title)+'</strong>'+editAction+'</div>'
  +(description?'<div class="tend-type-description">'+esc(description)+'</div>':'<div class="tend-type-description no-details">No details...</div>')
  +'</div><div class="rhythm-card__actions">'+tendAction+chartAction+'</div></div>'
  +(options.extensionHTML||"")
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
function tendSparkCardHTML(record,options){
 record=record||{};options=options||{};
 var title=options.title!==undefined?options.title:record.text||"";
 function attributes(values){
  return Object.keys(values||{}).map(function(name){
   if(!/^data-[a-z0-9-]+$/i.test(name))return "";
   return " "+name+'="'+esc(values[name])+'"';
  }).join("");
 }
 var classes=["spark-card","planitem"].concat(options.className?[options.className]:[]).join(" ");
 return '<div class="'+esc(classes)+'"'+attributes(options.cardAttributes)+'>'
  +'<div class="pi-main">'+tendRecordCardContentHTML("spark",record,{layout:"plan",title:title,description:options.description!==undefined?options.description:record.details,actionHTML:options.actionHTML,headingEditHTML:options.headingEditHTML,showNoDetails:true})+'</div>'
  +(options.topMetaHTML||'<div class="plan-item-top-meta"></div>')
  +'<div class="plan-item-footer dashboard-spark-footer'+(options.footerClass?" "+esc(options.footerClass):"")+'">'+(options.footerHTML||"")+'</div></div>';
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

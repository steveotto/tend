"use strict";
/* ============ views: dashboard, area pages, people ============ */
var dashboardSparkCarouselIndex=0,dashboardSparkCarouselAnimating=false,dashboardSparkCarouselReady=false,dashboardSparkCarouselInitPending=false;
var personSparkCarouselIndexes=Object.create(null),personSparkCarouselAnimating=Object.create(null);
function dashboardInitSparkCarousel(){
 if(dashboardSparkCarouselReady||dashboardSparkCarouselInitPending)return;
 dashboardSparkCarouselInitPending=true;
 requestAnimationFrame(function(){
  requestAnimationFrame(function(){
   dashboardSparkCarouselInitPending=false;
   var card=document.querySelector("[data-dashboard-free-spark-card]");
   if(!card||!card.isConnected)return;
   var bounds=card.getBoundingClientRect();
   if(!bounds.width||!bounds.height)return;
   dashboardSparkCarouselReady=true;
   document.querySelectorAll("[data-dashboard-spark-carousel-step]").forEach(function(button){
    var step=Number(button.getAttribute("data-dashboard-spark-carousel-step"));
    button.disabled=dashboardSparkCarouselIndex+step<0||dashboardSparkCarouselIndex+step>=dashboardFreeMomentSparkQueue().length;
   });
  });
 });
}
function renderNav(){
 var an=el("areaNav");if(an)an.innerHTML=AREA_IDS.map(function(id){return '<button data-areanav="'+id+'" class="'+(navKind()==="area"&&currentArea===id?"active":"")+'"><span class="nav-ic">'+(AREA_ICONS[id]||"")+'</span><span>'+S.areas[id].name+'</span></button>';}).join("");
 var un=el("utilNav");if(un){var settingsActive=tab==="settings"||tab==="careplan"||tab==="offload";un.innerHTML='<div class="utility-primary"><button type="button" data-utilnav="today" class="utility-primary-button'+(tab==="today"&&navKind()!=="area"?" active":"")+'"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg></span><span>Today</span></button>'+(typeof focusNavButtonHTML==="function"?focusNavButtonHTML():'')+'<button type="button" data-utilnav="people" class="utility-primary-button'+(tab==="people"&&navKind()!=="area"?" active":"")+'"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20zM16 5a3.5 3.5 0 0 0 0 6.8M18 14a5.5 5.5 0 0 1 3.5 5.2V20h-3"/></svg></span><span>People</span></button><button type="button" data-utilnav="settings" class="utility-primary-button'+(settingsActive&&navKind()!=="area"?" active":"")+'" aria-label="More, settings"><span class="utility-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></span><span>More</span></button></div><label class="utility-search"><span class="utility-search-icon" aria-hidden="true">⌕</span><input type="search" id="tendSearch" placeholder="Search Tend..." autocomplete="off" aria-label="Search people, rhythms, prayers, and sparks" aria-controls="tendSearchResults" aria-expanded="false"><button type="button" class="utility-search-clear" data-search-clear aria-label="Clear search" hidden>×</button><div class="utility-search-results" id="tendSearchResults" role="region" aria-label="Search results" hidden></div></label>';}
 var displayToggle=document.querySelector("[data-mobile-display-toggle]"),textSize=settings().mobileTextSize,sizeLabel=textSize==="large"?"Medium":textSize==="larger"?"Large":"Small",nextTextSize=textSize==="normal"?"Medium":textSize==="large"?"Large":"Small";if(displayToggle){displayToggle.setAttribute("data-text-size",sizeLabel.toLowerCase());displayToggle.setAttribute("aria-label","Today dashboard text size: "+sizeLabel+". Tap to increase to "+nextTextSize);displayToggle.title="Today dashboard text size: "+sizeLabel+". Tap to increase to "+nextTextSize;}
}
function tendSearchText(value){return String(value||"").toLocaleLowerCase();}
function tendSearchMatches(query){var q=tendSearchText(query),people=S.people||[],results={people:[],rhythms:[],prayers:[],sparks:[]};if(!q)return results;
 people.forEach(function(person){if(tendSearchText(person.name).includes(q))results.people.push({id:person.id,title:person.name,subtitle:person.relation||"",tag:"Person",person:person});});
 function rhythmMatch(record,person){if(tendSearchText([record.text,record.description,person&&person.name,record.faithGroup].join(" ")).includes(q))results.rhythms.push({id:record.id,title:record.text||"Untitled rhythm",subtitle:person?person.name:(record.faithGroup||"Faith"),tag:record.category==="faith"||record.faithGroup?(record.faithGroup||"Faith"):(S.areas[person&&person.area]?S.areas[person.area].name:"Rhythm"),person:person,faith:!person});}
 people.forEach(function(person){(person.rhythms||[]).forEach(function(record){rhythmMatch(record,person);});});
 (S.rhythms||[]).forEach(function(record){if(record.category==="faith"||record.faithGroup)rhythmMatch(record,null);});
 (S.prayers||[]).forEach(function(record){var person=people.find(function(candidate){return candidate.id===record.personId;}),category=record.category||"Prayer";if(tendSearchText([record.text,record.details,category,person&&person.name].join(" ")).includes(q))results.prayers.push({id:record.id,title:record.text||"Untitled prayer",subtitle:person?person.name:category,tag:category,person:person,faith:true});});
 people.forEach(function(person){(person.sparks||[]).forEach(function(record){if(tendSearchText([record.text,person.name].join(" ")).includes(q))results.sparks.push({id:record.id,title:record.text||"Untitled spark",subtitle:person.name,tag:"Spark",person:person});});});
 return results;
}
function tendSearchResultsHTML(query){var groups=tendSearchMatches(query),order=[["people","People"],["rhythms","Rhythms"],["prayers","Prayers"],["sparks","Sparks"]],out="",total=0;order.forEach(function(group){var results=groups[group[0]];if(!results.length)return;total+=results.length;out+='<section class="search-result-group"><h3>'+group[1]+' <span>'+results.length+'</span></h3>'+results.slice(0,6).map(function(result){return '<button type="button" class="search-result" data-search-result="'+group[0]+'" data-search-id="'+esc(result.id)+'"'+(result.person?' data-search-person="'+esc(result.person.id)+'"':'')+(result.area?' data-search-area="'+esc(result.area)+'"':'')+(result.faith?' data-search-faith="1"':'')+'><span class="search-result-main"><strong>'+esc(result.title)+'</strong><small>'+esc(result.subtitle)+'</small></span><span class="search-result-tag">'+esc(result.tag)+'</span></button>';}).join("")+(results.length>6?'<div class="search-result-more">+'+(results.length-6)+' more</div>':'')+'</section>';});return total?out:'<div class="search-empty">No matches for “'+esc(query)+'”.</div>';}
function tendSearchUpdate(){var input=el("tendSearch"),results=el("tendSearchResults"),clear=document.querySelector("[data-search-clear]");if(!input||!results)return;var query=input.value.trim(),open=!!query;results.innerHTML=open?tendSearchResultsHTML(query):"";results.hidden=!open;input.setAttribute("aria-expanded",String(open));if(clear)clear.hidden=!query;}
document.addEventListener("click",function(event){
 var toggle=event.target.closest&&event.target.closest("[data-mobile-search-toggle]");
 if(toggle){var open=!document.body.classList.contains("mobile-search-open");document.body.classList.toggle("mobile-search-open",open);toggle.setAttribute("aria-expanded",String(open));if(open){var input=el("tendSearch");if(input)requestAnimationFrame(function(){input.focus();});}else{var search=el("tendSearch");if(search){search.value="";tendSearchUpdate();}toggle.focus();}return;}
 toggle=event.target.closest&&event.target.closest("[data-mobile-display-toggle]");
 if(toggle){var current=settings().mobileTextSize,next=current==="normal"?"large":current==="large"?"larger":"normal",nextLabel=next==="normal"?"Small":next==="large"?"Medium":"Large",followingLabel=next==="normal"?"Medium":next==="large"?"Large":"Small";settings().mobileTextSize=next;document.documentElement.setAttribute("data-mobile-text-size",next==="larger"?"large":next);document.documentElement.setAttribute("data-mobile-text-size-level",next);save();toggle.setAttribute("data-text-size",nextLabel.toLowerCase());toggle.setAttribute("aria-label","Today dashboard text size: "+nextLabel+". Tap to increase to "+followingLabel);toggle.title="Today dashboard text size: "+nextLabel+". Tap to increase to "+followingLabel;flash(nextLabel+" text enabled");}
});
document.addEventListener("click",function(event){
 var personButton=event.target.closest&&event.target.closest("[data-person-spark-carousel-step]");
 if(personButton){
  event.stopImmediatePropagation();
  var personId=personButton.getAttribute("data-person-spark-carousel-person"),step=Number(personButton.getAttribute("data-person-spark-carousel-step")),person=S.people.find(function(item){return item.id===personId;}),queue=personFreeMomentSparkQueue(person),currentIndex=personSparkCarouselIndexes[personId]||0,nextIndex=currentIndex+step;
  if(!person||personSparkCarouselAnimating[personId]||!queue.length||!Number.isInteger(step)||!step||nextIndex<0||nextIndex>=queue.length)return;
  var oldCard=Array.from(document.querySelectorAll("[data-person-free-spark-card]")).find(function(card){return card.getAttribute("data-person-free-spark-card")===personId;}),animate=!!oldCard&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function slidePersonCard(card,from,to,onFinish){
   if(!card||!animate||typeof card.animate!=="function"){onFinish();return;}
   var finished=false,animation=card.animate([{transform:"translateX("+from+")"},{transform:"translateX("+to+")"}],{duration:460,easing:"cubic-bezier(.22,.72,.24,1)",fill:"forwards"}),
       finish=function(){if(finished)return;finished=true;animation.onfinish=null;animation.cancel();onFinish();};
   animation.onfinish=finish;
   setTimeout(finish,520);
  }
  function showPersonSpark(){
   personSparkCarouselIndexes[personId]=nextIndex;
   renderPreservingScroll();
   var newCard=Array.from(document.querySelectorAll("[data-person-free-spark-card]")).find(function(card){return card.getAttribute("data-person-free-spark-card")===personId;});
   var buttons=Array.from(document.querySelectorAll("[data-person-spark-carousel-step]")).filter(function(button){return button.getAttribute("data-person-spark-carousel-person")===personId;}),nextButton=buttons.find(function(button){return Number(button.getAttribute("data-person-spark-carousel-step"))===step&&!button.disabled;});
   if(!nextButton)nextButton=buttons.find(function(button){return !button.disabled;});
   if(nextButton)nextButton.focus({preventScroll:true});
   if(!animate||!newCard){personSparkCarouselAnimating[personId]=false;return;}
   slidePersonCard(newCard,step>0?"100%":"-100%","0%",function(){personSparkCarouselAnimating[personId]=false;});
  }
  if(!animate){showPersonSpark();return;}
  personSparkCarouselAnimating[personId]=true;
  document.querySelectorAll("[data-person-spark-carousel-step]").forEach(function(control){if(control.getAttribute("data-person-spark-carousel-person")===personId)control.disabled=true;});
  if(oldCard){oldCard.setAttribute("aria-hidden","true");oldCard.inert=true;}
  slidePersonCard(oldCard,"0%",step>0?"-100%":"100%",showPersonSpark);
  return;
 }
 var button=event.target.closest&&event.target.closest("[data-dashboard-spark-carousel-step]");
 if(!button)return;
 event.stopImmediatePropagation();
 if(!dashboardSparkCarouselReady||dashboardSparkCarouselAnimating)return;
 var queue=dashboardFreeMomentSparkQueue(),step=Number(button.getAttribute("data-dashboard-spark-carousel-step"));
 var currentIndex=Math.max(0,Math.min(queue.length-1,dashboardSparkCarouselIndex)),nextIndex=currentIndex+step;
 if(!queue.length||!Number.isInteger(step)||!step||nextIndex<0||nextIndex>=queue.length)return;
 var oldCard=document.querySelector("[data-dashboard-free-spark-card]"),animate=!!oldCard&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 function slideCard(card,from,to,onFinish){
  if(!card||!animate||typeof card.animate!=="function"){onFinish();return;}
  var finished=false,animation=card.animate([{transform:"translateX("+from+")"},{transform:"translateX("+to+")"}],{duration:460,easing:"cubic-bezier(.22,.72,.24,1)",fill:"forwards"}),
      finish=function(){if(finished)return;finished=true;animation.onfinish=null;animation.cancel();onFinish();};
  animation.onfinish=finish;
  setTimeout(finish,520);
 }
 function showNextCard(){
  dashboardSparkCarouselIndex=nextIndex;
  renderPreservingScroll();
  var newCard=document.querySelector("[data-dashboard-free-spark-card]"),nextButton=document.querySelector('[data-dashboard-spark-carousel-step="'+step+'"]:not(:disabled)');
  if(!nextButton)nextButton=document.querySelector('[data-dashboard-spark-carousel-step="'+(-step)+'"]:not(:disabled)')||document.querySelector("[data-dashboard-free-spark]");
  if(nextButton)nextButton.focus({preventScroll:true});
  if(!animate||!newCard){dashboardSparkCarouselAnimating=false;return;}
  slideCard(newCard,step>0?"100%":"-100%","0%",function(){dashboardSparkCarouselAnimating=false;});
 }
 if(!animate){showNextCard();return;}
 dashboardSparkCarouselAnimating=true;
 document.querySelectorAll("[data-dashboard-spark-carousel-step]").forEach(function(control){control.disabled=true;});
 oldCard.setAttribute("aria-hidden","true");
 oldCard.inert=true;
 slideCard(oldCard,"0%",step>0?"-100%":"100%",showNextCard);
});
document.addEventListener("input",function(event){if(event.target&&event.target.id==="tendSearch")tendSearchUpdate();});
document.addEventListener("keydown",function(event){if(event.target&&event.target.id==="tendSearch"&&event.key==="Escape"){event.target.value="";tendSearchUpdate();event.target.blur();document.body.classList.remove("mobile-search-open");var toggle=document.querySelector("[data-mobile-search-toggle]");if(toggle){toggle.setAttribute("aria-expanded","false");toggle.focus();}}});
document.addEventListener("click",function(event){var button=event.target.closest("[data-search-clear],[data-search-result]");if(!button)return;if(button.matches("[data-search-clear]")){var input=el("tendSearch");if(input){input.value="";tendSearchUpdate();input.focus();}return;}var type=button.getAttribute("data-search-result"),personId=button.getAttribute("data-search-person");if(type==="people"&&personId){profileTabs[personId]="rhythms";openPersonTab(personId);}else if(personId){profileTabs[personId]=type==="rhythms"?"rhythms":type==="sparks"?"sparks":"prayer";openPersonTab(personId);}else if(button.hasAttribute("data-search-faith")){currentArea="faith";tab="today";faithMainView=type==="prayers"||type==="requests"?"prayer":type==="rhythms"?"practices":"today";faithMainViewInitialized=true;faithShowAllRhythms=false;if(type==="rhythms"){var faithRhythm=S.rhythms.find(function(item){return item.id===button.getAttribute("data-search-id");});if(faithRhythm&&FAITH_GROUPS.indexOf(faithRhythm.faithGroup)>=0)faithConfig().selectedGroup=faithRhythm.faithGroup;}render();if(type==="rhythms")requestAnimationFrame(function(){requestAnimationFrame(function(){faithScrollToHeading(document.getElementById("faithPracticeTitle"));});});else if(type==="prayers"||type==="requests")requestAnimationFrame(function(){faithScrollToHeading(document.getElementById("faithPrayerTitle"));});}var input=el("tendSearch");if(input){input.value="";tendSearchUpdate();}document.body.classList.remove("mobile-search-open");var toggle=document.querySelector("[data-mobile-search-toggle]");if(toggle)toggle.setAttribute("aria-expanded","false");event.stopImmediatePropagation();});
function navKind(){return currentArea?"area":"tab";}
function sizeProfileTabPanels(root){
 var panels=Array.prototype.slice.call(root.querySelectorAll(".profile-tab-panel"));if(!panels.length)return;
 panels.forEach(function(panel){panel.style.minHeight="";panel.style.marginBottom="";});
}
var tendPendingProfileScrollAnchor=null;
var tendPendingFaithScrollAnchor=null;
var tendFaithScrollBuffer=0;
function tendCaptureProfileScrollAnchor(target){
 var profile=target&&target.closest(".person-profile-page");if(!profile||(!target.closest(".profile-tab-panel")&&!target.closest(".profile-tabs-row")))return null;
 var attributes=target.attributes||[],key=null;
 for(var i=0;i<attributes.length;i++){if(/^data-[a-z0-9-]+$/i.test(attributes[i].name)){key=attributes[i].name;break;}}
 return {key:key,value:key?target.getAttribute(key):null,top:target.getBoundingClientRect().top,position:{x:window.scrollX,y:window.scrollY}};
}
function tendCaptureFaithScrollAnchor(target){
 var page=target&&target.closest(".faith-page");if(!page)return null;
 var attributes=target.attributes||[],key=null;
 for(var i=0;i<attributes.length;i++){if(/^data-[a-z0-9-]+$/i.test(attributes[i].name)){key=attributes[i].name;break;}}
 return {key:key,value:key?target.getAttribute(key):null,top:target.getBoundingClientRect().top,position:{x:window.scrollX,y:window.scrollY}};
}
function tendRestoreProfileScrollAnchor(anchor){
 if(!anchor)return;
 var target=null;
 if(anchor.key){var candidates=document.querySelectorAll("["+anchor.key+"]");for(var i=0;i<candidates.length;i++){if(candidates[i].getAttribute(anchor.key)===anchor.value){target=candidates[i];break;}}}
 if(target)window.scrollBy(0,target.getBoundingClientRect().top-anchor.top);
 else window.scrollTo(anchor.position.x,anchor.position.y);
}
function tendRestoreFaithScrollAnchor(anchor){
 if(!anchor)return;
 var target=null;
 if(anchor.key){var candidates=document.querySelectorAll("["+anchor.key+"]");for(var i=0;i<candidates.length;i++){if(candidates[i].getAttribute(anchor.key)===anchor.value){target=candidates[i];break;}}}
 if(!target){window.scrollTo(anchor.position.x,anchor.position.y);return;}
 var desiredY=window.scrollY+target.getBoundingClientRect().top-anchor.top,page=document.querySelector(".faith-page");
 if(page){
  var maxY=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),extra=Math.max(0,desiredY-maxY);
  if(extra){tendFaithScrollBuffer+=extra;page.style.paddingBottom=tendFaithScrollBuffer+"px";}
 }
 window.scrollTo(anchor.position.x,desiredY);
}
document.addEventListener("click",function(event){
 var target=event.target&&event.target.closest&&event.target.closest("button,[role=tab]");
 if(target){
  var anchor=tendCaptureProfileScrollAnchor(target);
  if(anchor){tendPendingProfileScrollAnchor=anchor;requestAnimationFrame(function(){if(tendPendingProfileScrollAnchor===anchor)tendPendingProfileScrollAnchor=null;});}
  var faithAnchor=tendCaptureFaithScrollAnchor(target);
  if(faithAnchor){tendPendingFaithScrollAnchor=faithAnchor;requestAnimationFrame(function(){if(tendPendingFaithScrollAnchor===faithAnchor)tendPendingFaithScrollAnchor=null;});}
 }
},true);
window.addEventListener("resize",function(){if(tab==="people"&&currentPerson)sizeProfileTabPanels(el("view"));if(typeof layoutPlanPeopleBadges==="function")requestAnimationFrame(function(){layoutPlanPeopleBadges(el("view"));});});
var tendRenderScrollSnapshot=null;
function tendRestorePageScroll(position){requestAnimationFrame(function(){window.scrollTo(position.x,position.y);});}
function tendShowModal(dialog){if(!dialog||dialog.open)return;var snapshot=tendRenderScrollSnapshot,position=snapshot?snapshot.position:{x:window.scrollX,y:window.scrollY};if(!snapshot||snapshot.preserve)dialog.addEventListener("close",function(){tendRestorePageScroll(position);},{once:true});dialog.showModal();if(!snapshot||snapshot.preserve)tendRestorePageScroll(position);}
function tendRenderRouteKey(){var faith=S&&S.faithConfig,group=faith&&faith.selectedGroup;return JSON.stringify([tab,currentArea,currentPerson,currentPerson&&profileTabs[currentPerson],openDetail,group,faith&&faith.prayerView,faith&&faith.practiceTabs&&faith.practiceTabs[group],typeof faithPrayerSession!=="undefined"&&faithPrayerSession?"session":null,typeof settingsTab!=="undefined"?settingsTab:null]);}
var tendLastRenderRouteKey=null;
function render(){var existingPersonSettingsModal=el("personSettingsModal");if(existingPersonSettingsModal&&existingPersonSettingsModal.parentElement===document.body)existingPersonSettingsModal.remove();if(currentArea!=="faith")tendFaithScrollBuffer=0;var routeKey=tendRenderRouteKey(),preserve=routeKey===tendLastRenderRouteKey,scrollPosition={x:window.scrollX,y:window.scrollY},scrollAnchor=tendPendingProfileScrollAnchor,faithScrollAnchor=tendPendingFaithScrollAnchor,previousSnapshot=tendRenderScrollSnapshot;tendPendingProfileScrollAnchor=null;tendPendingFaithScrollAnchor=null;tendRenderScrollSnapshot={position:scrollPosition,preserve:preserve};renderNav();var syncFooter=el("syncDot");if(syncFooter)syncFooter.hidden=!(tab==="today"&&!currentArea);var v=el("view");
 if(navKind()==="area"&&currentArea)v.innerHTML=currentArea==="faith"&&typeof renderFaithPage==="function"?renderFaithPage():renderArea(currentArea);
 else if(tab==="today")v.innerHTML=renderToday();
 else if(tab==="people")v.innerHTML=renderPeople();
 else if(tab==="prayer")v.innerHTML=renderPrayer();
 else if(tab==="careplan")v.innerHTML=renderCarePlan();
 else if(tab==="echo")v.innerHTML=renderEcho();
 else if(tab==="offload")v.innerHTML=renderOffload();
 else if(tab==="settings")v.innerHTML=renderSettings();
 if(typeof fitnessRenderDialogPortal==="function")fitnessRenderDialogPortal();
 if(currentArea==="faith"){var faithPage=v.querySelector(".faith-page");if(faithPage&&tendFaithScrollBuffer)faithPage.style.paddingBottom=tendFaithScrollBuffer+"px";}
 var personSettingsModal=tab==="people"&&currentPerson?v.querySelector("#personSettingsModal"):null;if(personSettingsModal){document.body.appendChild(personSettingsModal);var relationSelect=personSettingsModal.querySelector('select[data-pfield="relation"]');if(relationSelect&&typeof window.unifyRelSelect==="function")window.unifyRelSelect(relationSelect);}
 sizeProfileTabPanels(v);
 if(typeof layoutPlanPeopleBadges==="function")layoutPlanPeopleBadges(v);
 if(typeof bind==="function")bind();
 var activePanel=currentPerson&&v.querySelector('.profile-tab-panel:not([hidden])'),editorDialog=activePanel&&activePanel.querySelector('dialog[data-profile-editor],dialog[data-editor-modal]');if(!editorDialog)editorDialog=v.querySelector('dialog[data-editor-modal]');if(editorDialog){if(!editorDialog.open)tendShowModal(editorDialog);editorDialog.addEventListener("cancel",function(event){var cancel=editorDialog.querySelector("[data-editor-cancel]");if(cancel){event.preventDefault();cancel.click();}});}
 var rhythmPickerDialog=v.querySelector("dialog[data-rhythm-picker-dialog]");if(rhythmPickerDialog&&!rhythmPickerDialog.open){tendShowModal(rhythmPickerDialog);var rhythmPickerTitle=rhythmPickerDialog.querySelector("#rhythm-picker-title");if(rhythmPickerTitle)rhythmPickerTitle.focus({preventScroll:true});}
 if(tab==="today"&&!currentArea&&el("calStrip")&&typeof loadCalendars==="function")loadCalendars();if(tab==="today"&&!currentArea&&typeof loadNowWeather==="function")loadNowWeather();tendRenderScrollSnapshot=previousSnapshot;var renderedRouteKey=tendRenderRouteKey();tendLastRenderRouteKey=renderedRouteKey;if(faithScrollAnchor&&currentArea==="faith"){requestAnimationFrame(function(){requestAnimationFrame(function(){tendRestoreFaithScrollAnchor(faithScrollAnchor);});});}else if(preserve&&routeKey===renderedRouteKey){if(scrollAnchor)requestAnimationFrame(function(){requestAnimationFrame(function(){tendRestoreProfileScrollAnchor(scrollAnchor);});});else tendRestorePageScroll(scrollPosition);}}
/* ============ overall meter ============ */
function overallScore(){return avg(AREA_IDS.map(areaScore))||50;}
function areaMenuHTML(){
 return '<div class="menu-grid">'+AREA_IDS.map(function(id){
  var v=areaScore(id),c=scoreClass(v);
  return '<button class="menu-area" data-areago="'+id+'"><span class="sm-dot '+c+'"></span><span class="menu-area-icon" aria-hidden="true">'+(AREA_ICONS[id]||"")+'</span><span class="ma-name">'+S.areas[id].name+'</span><span class="ma-score '+c+'">'+v+'</span></button>';
 }).join("")+'</div>';}
function renderToday(){
 var d=new Date(),h=d.getHours();
 var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];
 var greet=h<12?"Good morning":(h<18?"Good afternoon":"Good evening");
 var ov=overallScore(),oc=scoreClass(ov);
 var out='<main class="home-dashboard">'+tendSectionHeaderHTML({title:greet+', Steve',metadata:days[d.getDay()]+", "+mos[d.getMonth()]+" "+d.getDate(),className:"dashboard-greeting"});
 out+='<div class="card overall-card"><div class="dashboard-overall-heading"><h3>Overall health</h3><span class="ov-score '+oc+'">'+ov+'</span></div><div class="bar-ov"><i class="ov-marker" style="left:'+ov+'%"></i></div>'+'<div class="meta"><span class="statusword '+oc+'">'+scoreLabel(ov)+'</span></div>'+areaMenuHTML()+'</div>';
 out+=tendSectionHeaderHTML({title:"On your calendar",className:"calendar-sectiontitle"})+'<div class="card calendar-card"><div id="calStrip"><div class="empty">'+((S.calendars||[]).length?"Loading calendars...":"No calendars connected - add one in Settings.")+'</div></div></div><div id="calendarSyncSlot" class="calendar-sync-slot"></div>';
 out+=planHTML();
 out+=tendPrayerSectionHTML("Prayer",dashboardFocusedPrayerHTML());
 out+=freeMomentHTML();
 out+=upcomingHTML();
 out+=renderChecklists();
 if(typeof faithPrayerSession!=="undefined"&&faithPrayerSession)out+=faithPrayerSessionHTML();
 return out+'</main>';}
/* ============ time-aware routine plan ============ */
var DEFAULT_DAY_BLOCKS=[
 {id:"early",name:"Early morning",start:"05:30"},{id:"morning",name:"Midday focus",start:"09:00"},
 {id:"lunch",name:"Lunch",start:"11:30"},{id:"afternoon",name:"Afternoon",start:"13:30"},
 {id:"commute",name:"Way home",start:"16:30"},{id:"evening",name:"Evening",start:"18:00"},
 {id:"bedtime",name:"Bedtime",start:"21:30"}];
function dayTimeMinutes(time){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||""))return NaN;var parts=time.split(":");return +parts[0]*60+(+parts[1]);}
function validateDayBlocks(blocks){
 if(!Array.isArray(blocks)||blocks.length!==7)return "Keep all seven time sections.";
 for(var i=0;i<blocks.length;i++){
  if(blocks[i].id!==DEFAULT_DAY_BLOCKS[i].id||!String(blocks[i].name||"").trim())return "Give every section a name.";
  var minutes=dayTimeMinutes(blocks[i].start);
  if(!Number.isFinite(minutes))return "Enter a valid start time for every section.";
  if(i&&minutes<=dayTimeMinutes(blocks[i-1].start))return "Start times must move forward through the day. The last section continues overnight.";
 }
 return "";
}
function dayBlocks(){var saved=S.settings&&S.settings.dayBlocks;return !validateDayBlocks(saved)?saved:DEFAULT_DAY_BLOCKS;}
function dayBlockAt(date){var minute=date.getHours()*60+date.getMinutes(),blocks=dayBlocks(),id=blocks[blocks.length-1].id;blocks.forEach(function(b){if(minute>=dayTimeMinutes(b.start))id=b.id;});return id;}
function dayTimeLabel(time){var parts=time.split(":"),hour=+parts[0];return (hour%12||12)+":"+parts[1]+(hour<12?"am":"pm");}
function planBlocksDef(){var blocks=dayBlocks(),current=dayBlockAt(new Date());return blocks.map(function(b,i){return {id:b.id,name:b.name,range:dayTimeLabel(b.start)+" – "+dayTimeLabel(blocks[(i+1)%blocks.length].start),cur:b.id===current};});}
function planBlockName(block){var defaults={early:"Early morning",morning:"Morning",lunch:"Lunch",afternoon:"Afternoon",commute:"Way home",evening:"Evening",bedtime:"Bedtime"},original=DEFAULT_DAY_BLOCKS.filter(function(item){return item.id===block.id;})[0];return original&&block.name===original.name?defaults[block.id]:block.name;}
function dayBlockSettingsHTML(){return '<div class="card" style="margin-bottom:14px"><div class="subhead">Daily time sections</div><p class="settings-help">Rename your sections and choose when each starts. Each ends when the next begins; the last continues overnight. These settings apply throughout Tend.</p><div class="day-settings-grid"><span>Name</span><span>Starts</span><span>Ends</span>'+dayBlocks().map(function(b,i,blocks){return '<input aria-label="Section '+(i+1)+' name" data-block-name="'+b.id+'" value="'+esc(b.name)+'"><input type="time" aria-label="Section '+(i+1)+' start time" data-block-start="'+b.id+'" value="'+b.start+'"><span data-block-end="'+b.id+'">'+dayTimeLabel(blocks[(i+1)%blocks.length].start)+(i===blocks.length-1?' (next day)':'')+'</span>';}).join('')+'</div><p id="dayBlocksError" role="alert" class="day-settings-error"></p><button class="btn" id="saveDayBlocks">Save time sections</button></div>';}
function rhythmScheduledToday(r,date){
 date=date||new Date();
 if(rhythmDaysSince(r)===0)return false;
 if(r.freq==="custom"&&(r.every||r.unit)&&typeof recOccursOn==="function")return recOccursOn(recNormRule(r),todayStrFromTs(date.getTime()));
 if(r.freq==="custom")return date.getDay()===(r.customDow||0)&&(r.customType!=="monthly"||Math.ceil(date.getDate()/7)===(r.customOrd||1));
 return scheduleDayMatches(r,date)&&(r.freq==="daily"||rhythmDaysSince(r)>=rhythmPeriod(r));
}
function planItemPeople(it){
 var ids=Array.isArray(it.personIds)?it.personIds.slice():[],kind=planItemKind(it),record=null,ownerId="";
 if(it.personId)ids.push(it.personId);
 if(it.rhythm){var rhythmIds=String(it.rhythm).split("|");ownerId=rhythmIds[0];var owner=S.people.find(function(p){return p.id===ownerId;});record=owner&&(owner.rhythms||[]).find(function(r){return r.id===rhythmIds[1];});}
 else if(it.faithRhythm)record=typeof faithFindRhythm==="function"?faithFindRhythm(it.faithRhythm):null;
 else if(it.prayer)record=(S.prayers||[]).find(function(p){return p.id===it.prayer;});
 else if(it.spark){var sparkIds=String(it.spark).split("|");ownerId=sparkIds[0];var sparkOwner=S.people.find(function(p){return p.id===ownerId;});record=sparkOwner&&(sparkOwner.sparks||[]).find(function(s){return s.id===sparkIds[1];});}
 if(ownerId)ids.push(ownerId);
 if(record&&Array.isArray(record.personIds))ids=ids.concat(record.personIds);
 if(record&&Array.isArray(record.sharedWith))ids=ids.concat(record.sharedWith);
 ids=ids.filter(function(id,index){return id&&id!==currentPerson&&ids.indexOf(id)===index&&S.people.some(function(person){return person.id===id;});});
 return ids.map(function(id){var person=S.people.find(function(p){return p.id===id;});if(!person)return "";var rhythmLink=(kind==="rhythm"||!!it.faithRhythm)&&person.id!==ownerId,firstName=String(person.name||"").trim().split(/\s+/)[0];return '<button type="button" class="prayer-person person-badge-clickable'+(rhythmLink?' person-rhythm-link':'')+'" '+(rhythmLink?'data-personrhythms="'+esc(person.id)+'" aria-label="Open '+esc(person.name)+' rhythms"':'data-openperson="'+esc(person.id)+'" aria-label="Open '+esc(person.name)+' profile"')+'>'+personAvatar(person,24)+esc(firstName||person.name)+'</button>';}).join("");
}
function planItemKindBadge(it){
 var kind=planItemKind(it);
 return kind?'<span class="pill plan-kind-badge '+(kind==="rhythm"?"rhy":kind==="spark"?"spk":"pry")+'" aria-label="'+(kind==="rhythm"?"Rhythm":kind==="spark"?"Spark":"Prayer")+'" title="'+(kind==="rhythm"?"Rhythm":kind==="spark"?"Spark":"Prayer")+'">'+collectionIcon(kind==="rhythm"?"rhythms":kind==="spark"?"sparks":"prayer")+'</span>':"";
}
function planCategoryBadges(it){
 var record=null;
 if(it.rhythm){var ids=String(it.rhythm).split("|"),owner=S.people.find(function(p){return p.id===ids[0];});record=owner&&(owner.rhythms||[]).find(function(r){return r.id===ids[1];});}
 else if(it.faithRhythm)record=typeof faithFindRhythm==="function"?faithFindRhythm(it.faithRhythm):null;
 else if(it.prayer){var prayerRecord=(S.prayers||[]).find(function(p){return p.id===it.prayer;});if(prayerRecord&&prayerRecord.category==="Faith")record={areas:["faith"],faithGroup:prayerRecord.faithSection||prayerRecord.faithGroup};}
 else if(it.spark){var sparkIds=String(it.spark).split("|"),sparkOwner=S.people.find(function(p){return p.id===sparkIds[0];});record=sparkOwner&&(sparkOwner.sparks||[]).find(function(s){return s.id===sparkIds[1];});}
 var categories=record&&typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(record):"";
 return categories;
}
function layoutPlanPeopleBadges(root){
 (root||document).querySelectorAll(".plan-item-top-meta").forEach(function(row){
  var people=row.querySelector("[data-plan-people]"),categories=row.querySelector("[data-plan-categories]"),gap=parseFloat(getComputedStyle(row).columnGap)||0,lists=[];
  [[people,".plan-people-visible",".plan-people-overflow",".plan-people-menu",".prayer-person",2,"people"],[categories,".plan-category-visible",".plan-category-overflow",".plan-category-menu",".rhythm-area-badge",3,"categories"]].forEach(function(config){
   var container=config[0];if(!container)return;
   var visible=container.querySelector(config[1]),overflow=container.querySelector(config[2]),menu=container.querySelector(config[3]),summary=overflow&&overflow.querySelector("summary");
   if(!visible||!overflow||!menu||!summary)return;
   var badges=Array.prototype.slice.call(visible.querySelectorAll(config[4])).concat(Array.prototype.slice.call(menu.querySelectorAll(config[4])));
   badges.forEach(function(badge){visible.appendChild(badge);});
   var wasOpen=overflow.open;
   overflow.hidden=false;
   var badgeGap=parseFloat(getComputedStyle(visible).columnGap)||0,widths=badges.map(function(badge){return badge.getBoundingClientRect().width;}),limit=config[6]==="people"?2:config[6]==="categories"&&badges.length>3?3:config[5],shown=Math.min(badges.length,limit);
   lists.push({visible:visible,overflow:overflow,menu:menu,summary:summary,badges:badges,wasOpen:wasOpen,gap:badgeGap,widths:widths,shown:shown,type:config[6]});
  });
  var categoryRow=row.querySelector(".plan-item-category-row"),edit=row.querySelector(".plan-item-edit-trigger"),groupCount=(people?1:0)+(categoryRow?1:0),editWidth=edit?edit.getBoundingClientRect().width:0,editGap=edit&&categories?(parseFloat(getComputedStyle(edit.parentElement).columnGap)||0):0;
  var available=Math.max(0,row.clientWidth-gap*Math.max(0,groupCount-1)-editWidth-editGap);
  function usedWidth(list,count){
   var total=list.widths.slice(0,count).reduce(function(sum,width){return sum+width;},0);
   return total+Math.max(0,count-1)*list.gap+(count<list.badges.length?list.summary.getBoundingClientRect().width+(count?list.gap:0):0);
  }
  function setSummary(list){list.summary.textContent="+"+(list.badges.length-list.shown)+" more";list.summary.setAttribute("aria-label","Show "+(list.badges.length-list.shown)+" more "+list.type);}
  lists.forEach(function(list){if(list.shown<list.badges.length)setSummary(list);});
  while(lists.reduce(function(sum,list){return sum+usedWidth(list,list.shown);},0)>available){
   var reducible=lists.filter(function(list){return list.shown>0;}).sort(function(a,b){return a.type==="categories"?-1:1;})[0];
   if(!reducible)break;
   reducible.shown--;
   setSummary(reducible);
  }
  lists.forEach(function(list){
   list.overflow.hidden=list.shown>=list.badges.length;
   list.badges.slice(list.shown).forEach(function(badge){list.menu.appendChild(badge);});
   list.overflow.open=list.wasOpen&&!list.overflow.hidden;
  });
 });
}
function planItemCopy(it,action){
 return tendRecordCardContentHTML(planItemKind(it),it,{layout:"plan",title:it.label,description:it.description,actionHTML:action,showNoDetails:true});
}
function planItemEditAction(it){
 if(it.rhythm){
  return '<button type="button" class="iconbtn plan-item-edit-trigger" data-plan-edit-rhythm="'+esc(it.rhythm)+'" aria-label="Edit '+esc(it.label||"rhythm")+'" title="Edit rhythm">'+profileActionIcon("edit")+'</button>';
 }
 var sparkKey=it.spark||it.sparky;
 if(sparkKey){
  var parts=String(sparkKey).split("|"),ownerId=parts[0],sparkId=parts[1],viewerId=parts[2]||it.personId||ownerId;
  if(ownerId&&sparkId)return '<button type="button" class="iconbtn plan-item-edit-trigger" data-sedit="'+esc(ownerId+"|"+sparkId)+'" data-plan-spark-edit-viewer="'+esc(viewerId)+'" aria-label="Edit '+esc(it.label||"Spark")+'" title="Edit Spark">'+profileActionIcon("edit")+'</button>';
 }
 return "";
}
function planItemPeopleRow(it){
 var people=planItemPeople(it);
 return people?'<div class="plan-item-meta-people plan-people" data-plan-people><span class="plan-people-visible">'+people+'</span><details class="plan-people-overflow" hidden><summary></summary><span class="plan-people-menu"></span></details></div>':"";
}
function planItemTopRow(it,showEdit){
 var categories=planCategoryBadges(it),editAction=showEdit===false?"":planItemEditAction(it),categoryRow=categories||editAction?'<div class="plan-item-category-row'+(categories?'':' plan-item-category-row-empty')+'"'+(categories?' data-plan-categories':'')+'>'+(categories?'<span class="rhythm-area-badges plan-category-visible">'+categories.replace(/^<span class="rhythm-area-badges"[^>]*>|<\/span>$/g,"")+'</span><details class="plan-category-overflow" hidden><summary></summary><span class="plan-category-menu"></span></details>':"")+editAction+'</div>':"";
 return '<div class="plan-item-top-meta">'+planItemPeopleRow(it)+categoryRow+'</div>';
}
function freeMomentSparkCardHTML(item,options){
 options=options||{};
 return tendSparkCardHTML(item,{title:item.label,description:item.description,actionHTML:options.actionHTML,headingEditHTML:planItemEditAction(item),topMetaHTML:planItemTopRow(item,false),footerHTML:options.footerHTML,className:options.className,cardAttributes:options.cardAttributes});
}
function planRhythmCardBadges(it){
 var people=planItemPeopleRow(it),categories=planCategoryBadges(it);
 var categoryRow=categories?'<div class="plan-item-category-row" data-plan-categories><span class="rhythm-area-badges plan-category-visible">'+categories.replace(/^<span class="rhythm-area-badges"[^>]*>|<\/span>$/g,"")+'</span><details class="plan-category-overflow" hidden><summary></summary><span class="plan-category-menu"></span></details></div>':"";
 return people||categoryRow?'<div class="plan-item-top-meta">'+people+categoryRow+'</div>':"";
}
function planRhythmCardHTML(it){
 var record=null,ownerId="";
 if(it.rhythm){
  var ids=String(it.rhythm).split("|");ownerId=ids[0];
  var owner=S.people.find(function(person){return person.id===ownerId;});
  record=owner&&(owner.rhythms||[]).find(function(item){return item.id===ids[1];});
 }else if(it.faithRhythm){
  ownerId="faith";record=typeof faithFindRhythm==="function"?faithFindRhythm(it.faithRhythm):null;
 }else if(it.fitnessRhythm){
  record=fitnessRhythmRecords().find(function(item){return item.id===it.fitnessRhythm;});
  if(record&&typeof window.fitnessSharedRhythmCardHTML==="function")return window.fitnessSharedRhythmCardHTML(record,{completed:!!it.fitnessCompleted});
 }
 if(!record)return "";
 var score=rhythmScore(record),metadata=window.tendRhythmCardMetadata(record);
 return tendRhythmCardHTML(record,{title:record.text||"(unnamed rhythm)",description:record.description,score:Number.isFinite(score)?score:null,scoreClass:scoreClass(score),
  peopleBadgesHTML:planRhythmCardBadges(it),categoryBadgesHTML:it.fitnessRhythm&&typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges({areas:["health"]}):"",
  frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
  tendAttributes:it.fitnessRhythm?{"data-tend-open":"fitness-rhythm","data-rhythm-id":it.fitnessRhythm}:it.rhythm?{"data-tend-open":"person-rhythm","data-person-id":ownerId,"data-rhythm-id":String(it.rhythm).split("|")[1]}:{"data-tend-open":"faith-rhythm","data-rhythm-id":it.faithRhythm},
  editAttributes:it.fitnessRhythm?{"data-fitness-rhythm-edit":it.fitnessRhythm}:it.rhythm?{"data-plan-edit-rhythm":it.rhythm}:null,
  historyAttributes:it.fitnessRhythm?{"data-rhyhistory":"fitness|"+it.fitnessRhythm}:it.rhythm?{"data-rhyhistory":it.rhythm}:{"data-faith-rhythm-history":it.faithRhythm}
 });
}
function planItemFooter(it,meta,sub){
 var kindBadge=planItemKindBadge(it),fallbackSub=!meta&&sub&&!kindBadge?'<div class="tend-type-meta">'+esc(sub)+'</div>':"",details=meta?meta.replace('<div class="plan-item-meta">',"").replace(/<\/div>$/,""):"";
 if(kindBadge)details=kindBadge+(details||(sub?'<span class="plan-item-meta-entry">'+esc(sub)+'</span>':""));
 var detailRows=details?'<div class="plan-item-meta"><div class="plan-item-meta-details">'+details+'</div></div>':"";
 return '<div class="plan-item-footer">'+(fallbackSub?'<div class="plan-item-footer-badges"><span class="plan-pills"></span>'+fallbackSub+'</div>':"")+detailRows+'</div>';
}
function genItem(label,sub,area,type,title){return {label:label,sub:sub,log:{area:area,type:type,title:title||label}};}
function taskItem(t){return {label:t.text,sub:"task · "+(S.areas[t.areaId]?S.areas[t.areaId].name:""),log:{area:t.areaId,type:"note",title:"Task: "+t.text},taskId:t.id};}
function dashboardRhythmEligible(r){
 var days=rhythmDaysSince(r),period=rhythmPeriod(r);if(days===0)return false;
 if(r.freq==="custom"){var date=new Date();return date.getDay()===(r.customDow||0)&&(r.customType!=="monthly"||Math.ceil(date.getDate()/7)===(r.customOrd||1));}
 return days>=Math.max(1,period-(period<=14?1:0))&&(days===999||days>=period||scheduleDayMatches(r));
}
function prioritizePlanItems(items){
 var ranked=items.slice().sort(function(a,b){
  return Number(!!b.scheduled)-Number(!!a.scheduled)||Number(!!b.prayer)-Number(!!a.prayer)||Number(!!b.calendarDay)-Number(!!a.calendarDay)||Number(!!b.rhythm)-Number(!!a.rhythm)||(a.period||Infinity)-(b.period||Infinity)||(b.waitDays||0)-(a.waitDays||0);
 });
 return {visible:ranked,more:[]};
}
function planCandidates(bid,curBid){
 var out=[],seenSparks=Object.create(null);
 S.tasks.forEach(function(t){if(t.done)return;if(t.tod==="anytime")return;if(t.tod==="allday"){if(bid==="allday")out.push(taskItem(t));return;}if((t.tod?t.tod===bid:bid===curBid))out.push(taskItem(t));});
 S.people.forEach(function(person){
  (person.rhythms||[]).forEach(function(r){var tod=r.tod||curBid;if(tod==="anytime"||tod!==bid||!dashboardRhythmEligible(r))return;out.push({scheduled:!!r.tod,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),rhythm:person.id+"|"+r.id,personId:person.id,label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
  sortedPersonSparks(person).forEach(function(spark){if(!spark.by||!sparkLive(spark)||spark.tod==="anytime")return;if((sparkBlock(spark)||curBid)!==bid)return;var key=(spark.profileOwnerId||person.id)+"|"+spark.id;if(seenSparks[key])return;seenSparks[key]=true;out.push({spark:key,personId:person.id,label:spark.text,description:spark.details||"",sub:(spark.time?fmtHM12(spark.time)+" \u00b7 ":"")+sparkDueTxt(spark)});});
 });
 if(typeof faithActiveRhythms==="function"&&typeof rhythmScheduledToday==="function"){
  faithActiveRhythms().forEach(function(r){if(r.tod!==bid||!rhythmScheduledToday(r))return;out.push({scheduled:true,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),faithRhythm:r.id,faithGroup:r.faithGroup,area:"faith",label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
 }
 (typeof fitnessRhythmRecords==="function"?fitnessRhythmRecords():[]).forEach(function(source){var r=Object.assign({},source,{type:source.fitnessType}),today=todayStr();if(r.paused||(r.tod||"anytime")!==bid||!fitnessRhythmScheduled(r,today))return;out.push({scheduled:!!r.tod,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),fitnessRhythm:r.id,fitnessCompleted:fitnessRhythmCompletionToday(r,today),label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
 return out;
}
function planAnytimeCandidates(){
 var out=[];
 S.people.forEach(function(person){
  (person.rhythms||[]).forEach(function(r){if(r.tod!=="anytime"||!dashboardRhythmEligible(r))return;out.push({scheduled:false,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),rhythm:person.id+"|"+r.id,personId:person.id,label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
 });
 if(typeof faithActiveRhythms==="function"&&typeof rhythmScheduledToday==="function"){
  faithActiveRhythms().forEach(function(r){if(r.tod!=="anytime"||!rhythmScheduledToday(r))return;out.push({scheduled:false,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),faithRhythm:r.id,faithGroup:r.faithGroup,area:"faith",label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
 }
 (typeof fitnessRhythmRecords==="function"?fitnessRhythmRecords():[]).forEach(function(source){var r=Object.assign({},source,{type:source.fitnessType}),today=todayStr();if(r.paused||(r.tod||"anytime")!=="anytime"||!fitnessRhythmScheduled(r,today))return;out.push({scheduled:false,calendarDay:r.freq==="custom",period:rhythmPeriod(r),waitDays:rhythmDaysSince(r),fitnessRhythm:r.id,fitnessCompleted:fitnessRhythmCompletionToday(r,today),label:r.text,description:r.description||"",sub:tendRhythmMetaLabel(r,null,false)});});
 return planUniqueItems(out);
}
function planItemStableKey(item){
 if(item.taskId)return "task:"+item.taskId;
 if(item.rhythm)return "rhythm:"+item.rhythm;
 if(item.faithRhythm)return "faith-rhythm:"+item.faithRhythm;
 if(item.fitnessRhythm)return "fitness-rhythm:"+item.fitnessRhythm;
 if(item.spark)return "spark:"+item.spark;
 return null;
}
function planUniqueItems(items){
 var seen=Object.create(null),unique=items.filter(function(item){var key=planItemStableKey(item);if(!key)return true;if(seen[key])return false;seen[key]=true;return true;});
 return prioritizePlanItems(unique).visible;
}
function planViewGroups(viewId,currentId,blocks,itemType){
 itemType=planNormalizeItemType(itemType);
 if(itemType==="anytime")return [{id:"anytime",title:"",items:planAnytimeCandidates()}];
 if(itemType==="all-day")return [{id:"all-day-items",title:"",items:planUniqueItems(planCandidates("allday",currentId))}];
 if(viewId==="allday")viewId="all-day-items";
 if(viewId==="everything-today"){
  var seen=Object.create(null);
  function uniqueGroup(items){return items.filter(function(item){var key=planItemStableKey(item);if(!key)return true;if(seen[key])return false;seen[key]=true;return true;});}
  var groups=blocks.map(function(block){return {id:block.id,title:planBlockName(block),items:prioritizePlanItems(uniqueGroup(planCandidates(block.id,currentId))).visible};});
  return groups.filter(function(group){return group.items.length>0;});
 }
 if(viewId==="anytime")return [{id:"anytime",title:"",items:planAnytimeCandidates()}];
 if(viewId==="all-day-items")return [{id:"all-day-items",title:"",items:planUniqueItems(planCandidates("allday",currentId))}];
 var selectedBlock=blocks.filter(function(block){return block.id===viewId;})[0];
 if(selectedBlock)return [{id:"scheduled",title:"",items:planUniqueItems(planCandidates(selectedBlock.id,currentId))}];
 return [{id:"scheduled",title:"",items:planUniqueItems(planNowItems(planCandidates(currentId,currentId)))}];
}
function planViewItemCount(groups){return groups.reduce(function(total,group){return total+group.items.length;},0);}
function planViewCountLabel(viewId,groups){
 var total=planViewItemCount(groups);
 function itemWord(count){return count===1?"item":"items";}
 return total?total+" "+itemWord(total):"No items";
}
function blocksViewId(viewId){return dayBlocks().some(function(block){return block.id===viewId;});}
function planNormalizeFocusState(viewId,blocks){
 if(viewId==="allday")return "all-day-items";
 if(viewId==="now"||viewId==="everything-today"||viewId==="anytime"||viewId==="all-day-items"||(blocks||dayBlocks()).some(function(block){return block.id===viewId;}))return viewId;
 return "now";
}
function planNormalizeItemType(itemType){return ["scheduled","anytime","all-day"].indexOf(itemType)>=0?itemType:"scheduled";}
var planFocusState="now";var planItemTypeState="scheduled";var planHomeSelectionInitialized=false;var planKindVisibility={};
function planHomeSelection(blocks){
 if(!planHomeSelectionInitialized){
  planItemTypeState="scheduled";
  var stored=S.homePlanSelection,saved=stored&&typeof stored==="object"?stored:{},legacyView=(typeof stored==="string"?stored:saved.view||saved.timeframe)||S.homePlanFocus,migrated=!!legacyView;
  if(saved.itemType||saved.segment)planItemTypeState=planNormalizeItemType(saved.itemType||saved.segment);
  else if(legacyView==="anytime"){planItemTypeState="anytime";legacyView="now";migrated=true;}
  else if(legacyView==="allday"||legacyView==="all-day-items"){planItemTypeState="all-day";legacyView="now";migrated=true;}
  planFocusState=planNormalizeFocusState(legacyView||"now",blocks);
  if(planFocusState==="anytime"){planItemTypeState="anytime";planFocusState="now";migrated=true;}
  else if(planFocusState==="all-day-items"){planItemTypeState="all-day";planFocusState="now";migrated=true;}
  planHomeSelectionInitialized=true;
  if(migrated){S.homePlanSelection={timeframe:planFocusState,itemType:planItemTypeState};save();}
 }
 return {timeframe:planFocusState,itemType:planNormalizeItemType(planItemTypeState)};
}
function planSaveHomeSelection(){S.homePlanSelection={timeframe:planFocusState,itemType:planItemTypeState};save();}
function planKindVisibilityFor(scope){
 if(!planKindVisibility[scope])planKindVisibility[scope]={rhythm:true,spark:true};
 return planKindVisibility[scope];
}
function planItemKind(item){return item.rhythm||item.rkey||item.faithRhythm?"rhythm":item.spark||item.sparky?"spark":item.prayer?"prayer":"";}
function planNowItems(items){return items.filter(function(item){return planItemKind(item)!=="spark";});}
function planKindTogglesHTML(scope,label){
 var visibility=planKindVisibilityFor(scope);
 return '<span class="plan-kind-toggles" role="group" aria-label="'+esc(label||"Show or hide item types")+'">'+[["rhythm","Rhythm","rhythms"],["spark","Spark","sparks"]].map(function(type){var active=visibility[type[0]]!==false,buttonLabel=(active?"Hide ":"Show ")+type[1]+" items";return '<button type="button" class="plan-kind-toggle plan-kind-'+type[0]+(active?"":" is-muted")+'" data-plan-kind-toggle="'+esc(scope)+'" data-kind="'+type[0]+'" aria-label="'+buttonLabel+'" title="'+buttonLabel+'" aria-pressed="'+active+'">'+collectionIcon(type[2])+'</button>';}).join("")+'</span>';
}
function planFocusMenuHTML(blocks,currentId,selectedId){
 var current=blocks.filter(function(item){return item.id===currentId;})[0]||blocks[0];
 selectedId=planNormalizeFocusState(selectedId,blocks);
 var selected=selectedId==="now"?"Now":selectedId==="everything-today"?"Everything today":planBlockName(blocks.filter(function(item){return item.id===selectedId;})[0]||current);
 function option(id,name,range){
  var groups=planViewGroups(id,currentId,blocks,"scheduled"),countLabel=planViewCountLabel(id,groups);
  return '<button type="button" class="current-plan-time-option'+(id==="now"?' is-current':'')+(selectedId===id?' is-selected':'')+'" data-plan-focus="'+esc(id)+'" aria-pressed="'+(selectedId===id)+'"><span class="current-plan-time-option-name">'+esc(name)+'</span><span class="current-plan-time-option-range">'+esc(range)+'</span><span class="current-plan-time-option-count">'+esc(countLabel)+'</span></button>';
 }
 var views='<div class="current-plan-time-group" role="group" aria-label="View"><span class="current-plan-time-group-label">View</span>'+option("now","Now",current.range)+option("everything-today","Everything today","Across every time block")+'</div>';
 var specific='<div class="current-plan-time-group" role="group" aria-label="Specific time"><span class="current-plan-time-group-label">Specific time</span>'+
  blocks.map(function(item){return option(item.id,planBlockName(item),item.range);}).join("")+'</div>';
 return '<details class="current-plan-time-menu"><summary class="current-plan-time-picker" aria-label="Choose a time frame, currently '+esc(selected)+'"><span>'+esc(selected)+'</span><span class="current-plan-time-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 6 4.5 4.5L12.5 6"/></svg></span></summary><div class="current-plan-time-options" role="group" aria-label="Timeframes">'+views+specific+'</div></details>';
}
function planMetaIcon(kind){
 var paths={frequency:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5 M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',occurred:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5 2 2 4-4"/>'};
 return '<svg class="plan-detail-icon'+(kind==="frequency"?" plan-detail-icon-frequency":"")+'" viewBox="0 0 24 24" aria-hidden="true">'+paths[kind]+'</svg>';
}
function planItemMetaBar(meta,isRhythm){
 var parts=String(meta||"").split(" \u00b7 ").filter(Boolean);
 if(!parts.length||!parts.some(function(part){return /last tended|last prayed|not yet tended|not yet prayed/i.test(part);}))return "";
 var isTime=function(part){var normalized=part.toLowerCase();return Object.keys(TODS||{}).some(function(key){return TODS[key]&&TODS[key].toLowerCase()===normalized;});};
 var isOccurred=function(part){return /last tended|last prayed|not yet tended|not yet prayed|^tended |^prayed /i.test(part);};
 var time=parts.filter(isTime),occurred=parts.filter(isOccurred),frequency=parts.filter(function(part){return !isTime(part)&&!isOccurred(part)&&!/^(ends |due )/i.test(part)&&!/ready to tend again/i.test(part);}).slice(0,1);
 function entries(items,kind){return items.map(function(part){
  var iconKind=kind==="schedule"?(isTime(part)?"time":"frequency"):"occurred";
  var label=isRhythm?part.replace(/^last tended\s+/i,""):part;
  return '<span class="plan-item-meta-entry'+(kind==="occurred"?" plan-item-meta-entry--history":"")+'">'+planMetaIcon(iconKind)+'<span>'+esc(label)+'</span></span>';
 }).join("");}
 return '<div class="plan-item-meta">'+entries(frequency.concat(time),"schedule")+entries(occurred,"occurred")+'</div>';
}
function todayQueueMetaBar(meta,isRhythm){
 var parts=String(meta||"").split(" \u00b7 ").filter(Boolean);
 if(!parts.length)return "";
 var isTime=function(part){var normalized=part.toLowerCase();return Object.keys(TODS||{}).some(function(key){return TODS[key]&&TODS[key].toLowerCase()===normalized;})||/^\d{1,2}(?::\d{2})?\s?(?:am|pm)$/i.test(part);};
 var isHistory=function(part){return /last tended|last prayed|not yet tended|not yet prayed|^tended |^prayed /i.test(part);};
 var time=parts.filter(isTime),history=parts.filter(isHistory),details=parts.filter(function(part){return !isTime(part)&&!isHistory(part)&&!/ready to tend again/i.test(part);});
 function entry(part,kind,icon){var label=isRhythm?part.replace(/^last tended\s+/i,""):part;return '<span class="plan-item-meta-entry plan-item-meta-entry--'+kind+'">'+(icon?planMetaIcon(icon):"")+'<span>'+esc(label)+'</span></span>';}
 var frequency=details.filter(function(part){return /^(daily|weekly|monthly|quarterly|yearly|annually|every\b|once\b)/i.test(part);}),other=details.filter(function(part){return frequency.indexOf(part)===-1;});
 if(!frequency.length&&!time.length&&!history.length&&!other.length)return "";
 return '<div class="plan-item-meta">'+frequency.map(function(part){return entry(part,"schedule","frequency");}).join("")+time.map(function(part){return entry(part,"time","time");}).join("")+other.map(function(part){return entry(part,"detail","");}).join("")+history.map(function(part){return entry(part,"history","occurred");}).join("")+'</div>';
}
function planBlockCard(viewId,curId,focusBlocks){
 var selection=planHomeSelection(focusBlocks),itemType=selection.itemType;
 viewId=planNormalizeFocusState(viewId,focusBlocks);
 var groups=planViewGroups(viewId,curId,focusBlocks,itemType),count=planViewItemCount(groups),isNow=viewId==="now",block=focusBlocks.filter(function(item){return item.id===viewId;})[0],current=focusBlocks.filter(function(item){return item.id===curId;})[0]||focusBlocks[0];
 var title=itemType==="anytime"?"Anytime":itemType==="all-day"?"All-day items":viewId==="now"?"Now":viewId==="everything-today"?"Everything today":planBlockName(block||current);
 var subtitle=itemType==="anytime"?"No preferred time":itemType==="all-day"?"Assigned All day":viewId==="everything-today"?"Across every time block":isNow?planBlockName(current)+" · "+current.range:block.range;
 var weather=isNow?nowWeatherHTML():block&&typeof planWeatherHTML==="function"?planWeatherHTML(dayBlocks().filter(function(item){return item.id===viewId;})[0].start):"";
 function header(){
  var timeframe=planFocusMenuHTML(focusBlocks,curId,viewId),heading=itemType==="scheduled"?timeframe:'<h2 class="home-plan-view-heading">'+esc(title)+'</h2>',countLabel=planViewCountLabel(viewId,groups);
  var weatherSlot=isNow||block?'<div class="current-plan-weather" id="nowWeather" data-plan-weather-time="'+(block&&!isNow?esc(dayBlocks().filter(function(item){return item.id===viewId;})[0].start):"")+'">'+weather+'</div>':"";
  var segments='<div class="faith-practice-tabs home-plan-type-tabs" role="tablist" aria-label="Home item type">'+[["scheduled","Scheduled"],["anytime","Anytime"],["all-day","All-day"]].map(function(pair){var selected=itemType===pair[0];return '<button type="button" role="tab" id="home-plan-type-'+pair[0]+'" aria-controls="home-plan-items" data-plan-item-type="'+pair[0]+'" aria-selected="'+selected+'" tabindex="'+(selected?"0":"-1")+'">'+pair[1]+'</button>';}).join("")+'</div>';
  return '<div class="current-plan-summary'+(weather?" has-weather":"")+'"><div class="current-plan-topline"><div class="current-plan-heading-controls">'+heading+'</div></div>'+weatherSlot+'</div>'+segments+'<div class="home-plan-context-row"><div class="home-plan-context">'+esc(subtitle)+'</div><span class="current-plan-item-count" aria-label="'+esc(countLabel)+'"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3h8M5.5 8h8M5.5 13h8M2.5 3h.01M2.5 8h.01M2.5 13h.01"/></svg>'+esc(countLabel)+'</span></div>';
 }
 function itemHTML(it){
  if(it.rhythm||it.faithRhythm||it.fitnessRhythm){var rhythmCard=planRhythmCardHTML(it);if(rhythmCard)return rhythmCard;}
  var btn=it.rhythm?rhyDoneBtn(it.rhythm):(it.faithRhythm?'<button type="button" class="btn mini" data-tend-open="faith-rhythm" data-rhythm-id="'+esc(it.faithRhythm)+'">Tend</button>':(it.fitnessRhythm?'<button type="button" class="btn mini" data-tend-open="fitness-rhythm" data-rhythm-id="'+esc(it.fitnessRhythm)+'">Tend</button>':(it.prayer?'<button type="button" class="btn mini" data-pray="'+esc(it.prayer)+'">Pray</button>':(it.spark?'<button class="btn mini sparkbtn" data-sparkdo="'+it.spark+'">Do it</button>':'<button class="btn mini" data-plandone="'+encodeURIComponent(JSON.stringify(it.log))+'" data-taskid="'+(it.taskId||"")+'">Done</button>'))));
  var meta=planItemMetaBar(it.sub,!!(it.rhythm||it.faithRhythm||it.fitnessRhythm));
  return '<div class="planitem"><div class="pi-main">'+planItemCopy(it,btn)+'</div>'+planItemTopRow(it)+planItemFooter(it,meta,it.sub)+'</div>';
 }
 var nonempty=groups.filter(function(group){return group.items.length>0;}),emptyMessage=itemType==="anytime"?"No eligible Anytime rhythms.":itemType==="all-day"?"No eligible All-day items.":"Nothing queued - all items tended.",body=nonempty.length?nonempty.map(function(group){return '<section class="current-plan-item-group"'+(group.title?' aria-label="'+esc(group.title)+'"':"")+'>'+(group.title?'<h3 class="current-plan-item-group-title">'+esc(group.title)+'</h3>':"")+'<div class="current-plan-item-group-items">'+group.items.map(itemHTML).join("")+'</div></section>';}).join(""):'<div class="empty plan-empty-card">'+esc(emptyMessage)+'</div>';
 return '<section id="plan-'+esc(itemType==="scheduled"?viewId:itemType==="anytime"?"anytime":"all-day-items")+'" data-plan-block="'+esc(itemType==="scheduled"?viewId:itemType==="anytime"?"anytime":"all-day-items")+'" class="card planblock current'+(itemType==="all-day"?' all-day':'')+'">'+header()+'<div class="current-plan-items" id="home-plan-items" role="tabpanel" aria-labelledby="home-plan-type-'+itemType+'">'+body+'</div></section>';
}
function planHTML(){
 var blocks=planBlocksDef();
 var current=blocks.filter(function(x){return x.cur;})[0]||blocks[0],curId=current.id;
 planHomeSelection(blocks);
 planFocusState=planNormalizeFocusState(planFocusState,blocks);
 return planBlockCard(planFocusState,curId,blocks);}
function dashboardFocusedPrayerHTML(){
 return window.faithPrayerEntryHTML("dashboard");
}
function upcomingDates(now){
 var today=new Date(now||Date.now());today.setHours(0,0,0,0);var rows=[];
 function add(label,month,day,attrs){
  if(!(month>=1&&month<=12&&day>=1&&day<=31))return;
  var date=new Date(today.getFullYear(),month-1,day);if(date<today)date=new Date(today.getFullYear()+1,month-1,day);
  var days=Math.round((date-today)/86400000);if(days<=30)rows.push({label:label,days:days,attrs:attrs||""});
 }
 S.people.forEach(function(p){[['birthday','Birthday'],['anniversary','Anniversary']].forEach(function(pair){var v=String(p[pair[0]]||'').split('-');if(v.length===3)add(p.name+' · '+pair[1],+v[1],+v[2],' data-openperson="'+esc(p.id)+'"');});});
 S.keyDates.forEach(function(k){var person=S.people.find(function(p){return p.id===k.personId;});add((person?person.name+' · ':'')+k.label,+k.month,+k.day,' data-upitem="'+esc(k.id)+'"');});
 majorHolidays.forEach(function(h){if(!holidayEnabled(h.id))return;[today.getFullYear(),today.getFullYear()+1].forEach(function(y){var date=h.date(y),days=Math.round((date-today)/86400000);if(days>=0&&days<=30)rows.push({label:h.name,days:days,attrs:''});});});
 return rows.sort(function(a,b){return a.days-b.days||a.label.localeCompare(b.label);});
}
function upcomingHTML(){
 var rows=upcomingDates();
 return tendSectionHeaderHTML({title:"Coming up",subtitle:"next 30 days"})+'<div class="uprow">'+(rows.length?rows.map(function(x){return '<div class="upitem"'+x.attrs+'><span class="updays '+(x.days<=7?'soon':x.days<=21?'mid':'far')+'">'+(x.days===0?'today':'in '+x.days+'d')+'</span><span class="uplabel">'+esc(x.label)+'</span></div>';}).join(''):'<div class="empty">No personal dates or selected holidays in the next 30 days.</div>')+'</div>';
}
function nextDateLine(pid){var kds=S.keyDates.filter(function(k){return k.personId===pid;});if(!kds.length)return "";var best=null;kds.forEach(function(k){var d=daysUntil(k);if(best===null||d<best.d)best={k:k,d:d};});if(!best)return "";return '<div class="pf-next">'+esc(best.k.label)+' \u00b7 '+(best.d===0?"TODAY":"in "+best.d+" days")+'</div>';}
function personHealthColor(score){
 if(score===null||score===undefined)return '#CBD5D0';
 // Match the dashboard gradient stops: coral at 0, amber at 48, green at 100.
 var value=Math.max(0,Math.min(100,score));
 var start=value<=48?[255,90,69]:[255,193,51];
 var end=value<=48?[255,193,51]:[18,183,106];
 var fraction=value<=48?value/48:(value-48)/52;
 return "rgb("+start.map(function(channel,i){return Math.round(channel+(end[i]-channel)*fraction);}).join(",")+")";
}
function personHealthMeter(score,name,solid){
 var available=score!==null&&score!==undefined&&Number.isFinite(Number(score)),value=available?Math.max(0,Math.min(100,Number(score))):0;
 var valueText=available?value+' out of 100: '+esc(scoreLabel(value)):'Unavailable';
 return '<div class="bar-ov person-health-bar'+(solid?' solid':'')+'" role="meter" aria-label="'+esc(name)+' tending health" aria-valuemin="0" aria-valuemax="100"'+(available?' aria-valuenow="'+value+'"':'')+' aria-valuetext="'+valueText+'">'+(solid?'<span class="person-health-fill" style="width:'+value+'%;background:'+personHealthColor(available?value:null)+'" aria-hidden="true"></span>':'<i class="ov-marker" style="left:clamp(10px, '+value+'%, calc(100% - 10px))" aria-hidden="true"></i>')+'</div>';
}
function renderPeople(){
 var HINT='rhythms, sparks, prayers - tending the people you love';
 if(currentPerson)return personProfile(currentPerson);
 var out=tendSectionHeaderHTML({title:"People",subtitle:HINT,style:"margin-top:6px"})+'<div class="grid">';
 S.people.forEach(function(p){
  var sc=personScore(p),c=scoreClass(sc);
  var ci=personConnInfo(p);
  var prayers=personPrayerRecords(p).filter(function(x){return !x.answered&&!x.archived;}).length;
  out+='<div class="card person-card" data-openperson="'+p.id+'" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px;min-width:0">'+personAvatar(p,42)+'<h3 style="margin:0">'+esc(p.name)+'</h3></div><span class="person-card-score">'+sc+'</span></div>'+personHealthMeter(sc,p.name,true)+'<div class="person-health-status statusword '+c+'">'+scoreLabel(sc)+'</div><div class="meta">'+esc(p.relation||"")+' \u00b7 '+(ci.last?("connected "+when(ci.last.ts)):"no connections yet")+(prayers?" \u00b7 "+prayers+" prayer"+(prayers>1?"s":""):"")+'</div>'+nextDateLine(p)+personDateLines(p)+'</div>';
 });
 out+='</div>';
 return out;}
/* ============ person profile: rhythms + touch points ============ */
function sortedPersonRhythms(person){
 var order=dayBlocks().map(function(block){return block.id;});
 function timeRank(r){var index=order.indexOf(r.tod);return index<0?order.length:index;}
 var rhythms=[];
 S.people.forEach(function(owner){(owner.rhythms||[]).forEach(function(r){if(owner.id===person.id||(Array.isArray(r.sharedWith)&&r.sharedWith.indexOf(person.id)!==-1))rhythms.push(Object.assign({},r,{profileOwnerId:owner.id}));});});
 (S.rhythms||[]).forEach(function(r){if((r.category==="faith"||r.faithGroup)&&Array.isArray(r.sharedWith)&&r.sharedWith.indexOf(person.id)!==-1)rhythms.push(Object.assign({},r,{profileOwnerId:"faith",sharedFaithRhythm:true}));});
 var seen=Object.create(null);
 return rhythms.filter(function(r){var key=(r.profileOwnerId||person.id)+"|"+r.id;if(seen[key])return false;seen[key]=true;return true;}).sort(function(a,b){return rhythmPeriod(a)-rhythmPeriod(b)||timeRank(a)-timeRank(b);});
}
function sortedPersonSparks(person){
 var sparks=[];
 S.people.forEach(function(owner){(owner.sparks||[]).forEach(function(spark){if(owner.id===person.id||(Array.isArray(spark.sharedWith)&&spark.sharedWith.indexOf(person.id)!==-1))sparks.push(Object.assign({},spark,{profileOwnerId:owner.id}));});});
 (S.ideas||[]).forEach(function(spark){if((spark.category==="faith"||spark.area==="faith"||spark.faithSection)&&Array.isArray(spark.sharedWith)&&spark.sharedWith.indexOf(person.id)!==-1)sparks.push(Object.assign({},spark,{profileOwnerId:"faith",sharedFaithSpark:true}));});
 var seen=Object.create(null);
 return sparks.filter(function(spark){var key=(spark.profileOwnerId||person.id)+"|"+spark.id;if(spark.done||seen[key])return false;seen[key]=true;return true;}).sort(function(a,b){return (a.by||"9999")<(b.by||"9999")?-1:1;});
}
function rhythmPeopleBadges(r,excludeId){
 var ids=[r.profileOwnerId||excludeId].concat(Array.isArray(r.sharedWith)?r.sharedWith:[]);
 return ids.filter(function(id,index){return id&&id!==excludeId&&ids.indexOf(id)===index;}).map(function(id){var person=S.people.find(function(x){return x.id===id;});return person?'<button type="button" class="prayer-person person-badge-clickable person-rhythm-link" data-personbadge="'+esc(person.id)+'|rhythm" aria-label="Open '+esc(person.name)+' rhythms">'+personAvatar(person,24)+esc(person.name)+'</button>':"";}).join("");
}
var tendItemAssociationDrafts={},tendItemPickerDraft=null,sparkAddDrafts={},prayerAddDrafts={},noteAddDrafts={};
function tendAssociationKey(type,ownerId,itemId){return type+"|"+ownerId+"|"+itemId;}
function tendFollowupHasFaith(record){
 var groups=typeof FAITH_GROUPS!=="undefined"?FAITH_GROUPS:["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
 return !!record&&(record.kind==="faith-note"||Array.isArray(record.areas)&&record.areas.indexOf("faith")>=0||groups.indexOf(record.faithSection)>=0||groups.indexOf(record.faithGroup)>=0);
}
function tendAssociationValues(type,ownerId,itemId,record){
 var draft=tendItemAssociationDrafts[tendAssociationKey(type,ownerId,itemId)];
 var sharedWith=draft?draft.sharedWith:record&&record.sharedWith,areas=draft?draft.areas:record&&record.areas;
 var faithGroup=draft?draft.faithGroup:record&&(record.faithSection||record.faithGroup);
 if(type==="connection"&&!draft){sharedWith=record&&Array.isArray(record.personIds)?record.personIds:record&&record.personId?[record.personId]:[];}
 if((type==="followup"&&tendFollowupHasFaith(record)||type==="spark"&&ownerId==="faith")&&!draft&&(!Array.isArray(areas)||areas.indexOf("faith")===-1))areas=(Array.isArray(areas)?areas:[]).concat("faith");
 return {sharedWith:Array.isArray(sharedWith)?sharedWith:[],areas:Array.isArray(areas)?areas:[],faithGroup:faithGroup};
}
function tendPersonRelationshipGroup(person){
 if(typeof faithPrayerPersonGroup==="function")return faithPrayerPersonGroup(person);
 var relation=String(person&&person.relation||"").toLowerCase();
 if(/spouse|wife|husband|partner/.test(relation))return "marriage";
 if(/son|daughter|father|dad|mother|mom|brother|sister|in-law|in law|grandchild|grandson|granddaughter|nephew|niece|bonus/.test(relation))return "parenting";
 return "friendships";
}
function tendPeopleGroupToggles(selected,ownerId,attribute){
 return [["marriage","Marriage"],["parenting","Parenting"],["friendships","Friends"]].map(function(group){
  var members=S.people.filter(function(person){return person.id!==ownerId&&tendPersonRelationshipGroup(person)===group[0];}),active=members.length>0&&members.every(function(person){return selected.indexOf(person.id)!==-1;});
  return '<button type="button" class="people-picker-group-toggle'+(active?" selected":"")+'" '+attribute+'="'+group[0]+'" aria-pressed="'+active+'"'+(members.length?"":" disabled")+'>'+group[1]+'</button>';
 }).join("");
}
function tendPeopleGroupToggleBar(selected,ownerId,attribute){
 return '<div class="people-picker-groups" aria-label="Quick select people by relationship">'+tendPeopleGroupToggles(selected,ownerId,attribute)+'</div>';
}
function tendApplyPeopleGroupToggle(selected,ownerId,group){
 var members=S.people.filter(function(person){return person.id!==ownerId&&tendPersonRelationshipGroup(person)===group;}),allSelected=members.length>0&&members.every(function(person){return selected.indexOf(person.id)!==-1;});
 members.forEach(function(person){var index=selected.indexOf(person.id);if(allSelected&&index!==-1)selected.splice(index,1);else if(!allSelected&&index===-1)selected.push(person.id);});
 return selected;
}
function tendRefreshPeoplePicker(container,selected,ownerId,groupAttribute,personAttribute){
 if(!container)return;
 Array.prototype.forEach.call(container.querySelectorAll("["+groupAttribute+"]"),function(button){var group=button.getAttribute(groupAttribute),members=S.people.filter(function(person){return person.id!==ownerId&&tendPersonRelationshipGroup(person)===group;}),active=members.length>0&&members.every(function(person){return selected.indexOf(person.id)!==-1;});button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});
 Array.prototype.forEach.call(container.querySelectorAll("["+personAttribute+"]"),function(button){var personId=button.getAttribute(personAttribute).split("|").pop(),active=personId===ownerId||selected.indexOf(personId)!==-1;button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});
}
function tendAssociationPeopleBadges(record,ownerId,excludeId,section){
 var ids=(ownerId&&ownerId!=="global"?[ownerId]:[]).concat(record&&Array.isArray(record.sharedWith)?record.sharedWith:[]);
 return ids.filter(function(id,index){return id&&id!==excludeId&&ids.indexOf(id)===index;}).map(function(id){
  var person=S.people.find(function(x){return x.id===id;});
  return person?'<button type="button" class="prayer-person person-badge-clickable person-rhythm-link" data-personbadge="'+esc(person.id)+'|'+section+'" aria-label="Open '+esc(person.name)+' '+section+'">'+personAvatar(person,24)+esc(person.name)+'</button>':"";
 }).join("");
}
function tendAssociationCategoryBadges(record){
 if(!record||typeof window.tendCategoryBadges!=="function")return "";
 var areas=Array.isArray(record.areas)?record.areas.slice():[];
 if(tendFollowupHasFaith(record)&&areas.indexOf("faith")===-1)areas.push("faith");
 return window.tendCategoryBadges({areas:areas,faithGroup:record.faithSection||record.faithGroup});
}
function tendPrayerCategoryBadges(prayer){
 var area={Marriage:"marriage",Kids:"parenting",Friends:"friendships",Faith:"faith"}[prayer&&prayer.category],areas=(prayer&&prayer.areas||[]).slice();
 if(area&&areas.indexOf(area)===-1)areas.unshift(area);
 return typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges({areas:areas,faithGroup:prayer&& (prayer.faithSection||prayer.faithGroup)}):"";
}
function tendQueuePeopleAndCategoryBadges(record,ownerId,excludeId,section){
 var people=tendAssociationPeopleBadges(record,ownerId,excludeId,section);
 var categories=section==="prayer"?tendPrayerCategoryBadges(record):tendAssociationCategoryBadges(record);
 return people+categories;
}
function tendAssociationControlsHTML(type,ownerId,itemId,record){
 var values=tendAssociationValues(type,ownerId,itemId,record),names={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var key=type+"|"+ownerId+"|"+itemId;
 var action=itemId==="new"?"Add":"Edit";
 var faithNote=type==="followup"&&(ownerId==="faith"||tendFollowupHasFaith(record));
 var faithGroup=values.faithGroup||(faithNote?"":"Prayer");
 var categories=values.areas.map(function(id){var label=id==="faith"?(faithGroup?"Faith - "+faithGroup:"Faith"):names[id]||id;return '<span class="rhythm-picker-chip category-selected">'+(AREA_ICONS[id]||"")+esc(label)+'</span>';}).join("");
 var people=values.sharedWith.map(function(id){var person=S.people.find(function(x){return x.id===id;});return person?'<span class="rhythm-picker-person">'+personAvatar(person,22)+esc(person.name)+'</span>':"";}).join("");
 return '<div class="rhythm-picker-controls item-association-controls" data-item-association-controls="'+esc(key)+'"><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-item-picker-open="'+esc(key+'|categories')+'">'+action+' categories</button>'+categories+'</div><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-item-picker-open="'+esc(key+'|people')+'">'+action+' people</button>'+people+'</div></div>';
}
function tendSparkEditModalHTML(ownerId,viewerId,planEditor){
 var spark=sparkEditDraft;if(!spark||spark.id!==editSparkId)return "";
 var deleteButton=planEditor?'<button class="btn mini danger" data-cpsparkdelete="'+esc(spark.id)+'">Delete</button>':ownerId==="faith"?'<button class="btn mini danger" data-faith-spark-delete="faith|'+esc(spark.id)+'">Delete</button>':'<button class="btn mini danger" data-spdel="'+esc(ownerId+"|"+spark.id+"|"+viewerId)+'">'+(viewerId!==ownerId?"Remove":"Delete")+'</button>';
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="spark-editor-title"><div class="profile-editor-body"><h3 id="spark-editor-title">Edit Spark</h3><div class="addrow spark-draft"><input data-sfield="text" value="'+esc(spark.text||"")+'" placeholder="Spark text"><textarea data-sfield="details" placeholder="Details (optional)">'+esc(spark.details||"")+'</textarea><input type="date" data-sfield="by" value="'+esc(spark.by||"")+'" aria-label="Spark date" style="max-width:150px"><input type="time" data-sfield="time" value="'+esc(spark.time||"")+'" aria-label="Spark time" style="max-width:110px"><button class="btn mini ghost" data-scleardate="1">No date</button></div>'+tendAssociationControlsHTML("spark",ownerId,spark.id,spark)+'<p class="profile-tab-intro">With a date it lands on the dashboard; without one it waits in Free moment.</p><div class="profile-editor-actions"><button class="btn mini" data-sparkeditsave="'+esc(spark.id)+'">Save</button><button class="btn mini ghost" data-sparkeditcancel data-editor-cancel>Cancel</button>'+deleteButton+'</div></div></dialog>';
}
function tendAssociationPickerHTML(picker){
 var people=picker.kind==="people",ownerId=picker.ownerId,type=picker.type,itemId=picker.itemId,target=type+"|"+ownerId+"|"+itemId+"|"+picker.kind;
 var itemName=type==="spark"?"spark":type==="connection"?"connection":type==="followup"?"note":"prayer";
 var names={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 if(!people&&(type==="followup"||type==="spark")&&picker.faithSubcategoryOpen){
  var faithGroups=typeof FAITH_GROUPS!=="undefined"?FAITH_GROUPS:["Sabbath","Prayer","Fasting","Solitude","Generosity","Community","Service","Witness","Scripture","Other"];
  var faithRecord=tendAssociationRecord(type,ownerId,itemId),faithNote=type==="followup"&&(ownerId==="faith"||tendFollowupHasFaith(faithRecord));
  var selectedGroup=faithGroups.indexOf(picker.faithGroup)>=0?picker.faithGroup:faithNote?null:"Prayer";
  var options=faithGroups.map(function(group){return '<button type="button" class="rhythm-picker-option category-option'+(group===selectedGroup?' selected':'')+'" data-item-picker-faith-group="'+esc(group)+'" aria-pressed="'+(group===selectedGroup)+'"><span>'+esc(group)+'</span></button>';}).join("");
  if(faithNote)options+='<button type="button" class="rhythm-picker-option category-option'+(selectedGroup===null?' selected':'')+'" data-item-picker-faith-group="" aria-pressed="'+(selectedGroup===null)+'"><span>No subcategory</span></button>';
  if(picker.selected.indexOf("faith")>=0&&(!faithRecord||faithRecord.kind!=="faith-note")&&!(type==="spark"&&ownerId==="faith"))options+='<button type="button" class="rhythm-picker-option category-option" data-item-picker-faith-remove><span>Remove Faith category</span></button>';
  return '<dialog class="profile-editor-dialog rhythm-picker-dialog" data-item-association-dialog aria-labelledby="item-association-title"><div class="profile-editor-body"><button type="button" class="rhythm-picker-trigger" data-item-picker-faith-back>‹ Categories</button><h3 id="item-association-title" tabindex="-1">Faith subcategory</h3><p class="profile-tab-intro">Choose where this '+itemName+' belongs in Faith.</p><div class="rhythm-picker-options" role="group" aria-label="Faith subcategory">'+options+'</div><div class="profile-editor-actions"><button type="button" class="btn mini ghost" data-item-picker-cancel>Cancel</button></div></div></dialog>';
 }
 var choices=people?S.people.map(function(person){var isOwner=ownerId!=="connection"&&person.id===ownerId,selected=isOwner||picker.selected.indexOf(person.id)!==-1;return '<button type="button" class="prayer-person person-badge-clickable rhythm-picker-option'+(selected?' selected':'')+'" data-item-picker-toggle="'+esc(target+'|'+person.id)+'" aria-pressed="'+selected+'"'+(isOwner?' disabled':'')+'>'+personAvatar(person,28)+esc(person.name)+'</button>';}).join(""):["faith","marriage","parenting","health","finances","friendships"].map(function(id){var selected=picker.selected.indexOf(id)!==-1;if(id==="faith"&&(type==="followup"||type==="spark"))return '<button type="button" class="rhythm-picker-option category-option'+(selected?' selected':'')+'" data-item-picker-faith-open aria-haspopup="dialog" aria-pressed="'+selected+'">'+(AREA_ICONS[id]||"")+'<span>'+(picker.faithGroup?"Faith - "+esc(picker.faithGroup):"Faith")+'</span></button>';return '<button type="button" class="rhythm-picker-option category-option'+(selected?' selected':'')+'" data-item-picker-toggle="'+esc(target+'|'+id)+'" aria-pressed="'+selected+'">'+(AREA_ICONS[id]||"")+'<span>'+names[id]+'</span></button>';}).join("");
 return '<dialog class="profile-editor-dialog rhythm-picker-dialog" data-item-association-dialog aria-labelledby="item-association-title"><div class="profile-editor-body"><h3 id="item-association-title" tabindex="-1">'+(people?"People for this "+itemName:"Categories for this "+itemName)+'</h3><p class="profile-tab-intro">'+(people?"Choose everyone involved in this "+itemName+".":"Choose the categories where this "+itemName+" should appear.")+'</p>'+(people&&ownerId!=="connection"?tendPeopleGroupToggleBar(picker.selected,ownerId,"data-item-picker-group"):"")+'<div class="rhythm-picker-options">'+choices+'</div><div class="profile-editor-actions"><button type="button" class="btn mini" data-item-picker-save>Save</button><button type="button" class="btn mini ghost" data-item-picker-cancel>Cancel</button></div></div></dialog>';
}
function tendAssociationRecord(type,ownerId,itemId){
 if(type==="connection")return S.events.find(function(event){return event.id===itemId;});
 if(type==="followup"){
  if(itemId==="new")return noteAddDrafts[ownerId]||null;
  return S.followups.find(function(item){return item.id===itemId;});
 }
 if(type==="spark"){
  if(itemId==="new")return ownerId==="faith"?(sparkAddDrafts.faith||faithSparkDraft):(sparkAddDrafts[ownerId]||(sparkAddDrafts[ownerId]={sharedWith:[],areas:[]}));
  if(sparkEditDraft&&sparkEditDraft.id===itemId)return sparkEditDraft;
  if(faithSparkDraft&&faithSparkDraft.id===itemId&&faithSparkOwnerId===ownerId)return faithSparkDraft;
  if(ownerId==="faith")return S.ideas.find(function(item){return item.id===itemId;});
  var owner=S.people.find(function(person){return person.id===ownerId;});return owner&&(owner.sparks||[]).find(function(item){return item.id===itemId;});
 }
 if(itemId==="new")return prayerAddDrafts[ownerId]||(prayerAddDrafts[ownerId]={sharedWith:[],areas:[]});
 return S.prayers.find(function(item){return item.id===itemId;});
}
function tendRefreshAssociationPicker(dialog){
 if(!dialog)return;
 var wrapper=document.createElement("div");wrapper.innerHTML=tendAssociationPickerHTML(tendItemPickerDraft);
 var next=wrapper.firstElementChild;if(!next)return;
 dialog.innerHTML=next.innerHTML;
 var title=dialog.querySelector("#item-association-title");if(title)title.focus({preventScroll:true});
}
function tendAssociationPickerOpen(key){
 var parts=key.split("|"),type=parts[0],ownerId=parts[1],itemId=parts[2],kind=parts[3],record=tendAssociationRecord(type,ownerId,itemId);
 if(!record)return;
 var values=tendAssociationValues(type,ownerId,itemId,record),isFaithNote=type==="followup"&&(ownerId==="faith"||tendFollowupHasFaith(record)),picker={type:type,ownerId:ownerId,itemId:itemId,kind:kind,selected:(kind==="people"?values.sharedWith:values.areas).slice(),faithGroup:values.faithGroup||(isFaithNote?null:"Prayer")};
 tendItemPickerDraft=picker;
 var wrapper=document.createElement("div");wrapper.innerHTML=tendAssociationPickerHTML(picker);
 var dialog=wrapper.firstElementChild;document.body.appendChild(dialog);tendShowModal(dialog);
 var title=dialog.querySelector("#item-association-title");if(title)title.focus({preventScroll:true});
 dialog.addEventListener("close",function(){dialog.remove();tendItemPickerDraft=null;});
}
function tendAssociationCommit(type,ownerId,itemId,record){
 var key=tendAssociationKey(type,ownerId,itemId),draft=tendItemAssociationDrafts[key];
 if(draft&&record){
  if(type==="connection"){
   record.personIds=draft.sharedWith.filter(function(id,index,ids){return ids.indexOf(id)===index&&S.people.some(function(person){return person.id===id;});});
   record.personId=record.personIds[0]||null;
   var primaryPerson=S.people.find(function(person){return person.id===record.personId;});if(primaryPerson)record.areaId=primaryPerson.area;
   record.areas=draft.areas.slice();
  }else{
   var recordOwner=record.personId||ownerId;record.sharedWith=draft.sharedWith.filter(function(id){return id!==recordOwner&&S.people.some(function(person){return person.id===id;});});record.areas=draft.areas.slice();
   if(type==="followup"&&record.kind==="faith-note"&&record.areas.indexOf("faith")===-1)record.areas.push("faith");
   if(type==="followup"&&record.areas.indexOf("faith")>=0&&draft.faithGroup)record.faithSection=draft.faithGroup;
   else if(type==="followup"&&record.areas.indexOf("faith")>=0){delete record.faithSection;delete record.faithGroup;}
   else if(type==="followup"&&record.kind!=="faith-note")delete record.faithSection;
   if(type==="spark"){
    if(ownerId==="faith"&&record.areas.indexOf("faith")===-1)record.areas.push("faith");
    if(record.areas.indexOf("faith")>=0)record.faithSection=draft.faithGroup||record.faithSection||"Prayer";
    else if(ownerId!=="faith")delete record.faithSection;
   }
  }
 }
 delete tendItemAssociationDrafts[key];
}
function rhythmPickerRecord(ownerId,rid){
 if(ownerId==="faith")return faithRhythmDraft&&(rid==="draft"?!faithRhythmDraft.id:faithRhythmDraft.id===rid)?faithRhythmDraft:null;
 if(ownerId==="fitness-workout"){
  if(rid==="draft"&&typeof fitnessDialog!=="undefined"&&fitnessDialog&&fitnessDialog.kind==="savedWorkout")return fitnessDialog.workoutDraft||(fitnessDialog.workoutDraft={id:"draft",name:"",muscleIds:[],sharedWith:[]});
  return (S.fitness&&S.fitness.savedWorkouts||[]).find(function(record){return record.id===rid;})||null;
 }
 if(ownerId==="fitness"){
  if(fitnessRhythmEditor&&String(fitnessRhythmEditor.record.id||"draft")===rid)return fitnessRhythmEditor.record;
  return (S.areaRhythms||[]).find(function(record){return record.id===rid&&["workout","cardio","weighin"].indexOf(record.fitnessType)>=0;})||null;
 }
 return rid==="draft"?(rhythmDraft&&rhythmDraft.pid===ownerId?rhythmDraft:null):(rhythmEditDraft&&rhythmEditDraft.id===rid?rhythmEditDraft:null);
}
function rhythmPickerControlsHTML(ownerId,r,idf,excludeFaith){
 var categories=typeof window.tendRhythmCategoryIds==="function"?window.tendRhythmCategoryIds(r):(r.areas||[]);
 if(excludeFaith)categories=categories.filter(function(id){return id!=="faith";});
 var categoryNames={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"};
 var categoryChips=categories.map(function(id){var label=id==="health"&&ownerId==="fitness"&&r.healthSubcategory?categoryNames[id]+" · "+({strength:"Strength",cardio:"Cardio",weight:"Weight"}[r.healthSubcategory]||""):categoryNames[id]||id;return '<span class="rhythm-picker-chip category-selected">'+(AREA_ICONS[id]||"")+esc(label)+'</span>';}).join("");
 var peopleChips=(r.sharedWith||[]).map(function(id){var person=S.people.find(function(x){return x.id===id;});return person?'<span class="rhythm-picker-person">'+personAvatar(person,22)+esc(person.name)+'</span>':"";}).join("");
 var fitnessCategory=ownerId==="fitness"&&categories.indexOf("health")!==-1?'<label class="rhythm-picker-subcategory">Health &amp; Fitness subcategory<select data-rhythm-health-subcategory="'+esc(idf)+'"><option value="strength"'+(r.healthSubcategory==="strength"?" selected":"")+'>Strength</option><option value="cardio"'+(r.healthSubcategory==="cardio"?" selected":"")+'>Cardio</option><option value="weight"'+(r.healthSubcategory==="weight"?" selected":"")+'>Weight</option></select></label>':"";
 return '<div class="rhythm-picker-controls"><div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="categories|'+esc(idf)+'">Add categories</button>'+categoryChips+'</div>'+fitnessCategory+'<div class="rhythm-picker-row"><button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="people|'+esc(idf)+'">Add people</button>'+peopleChips+'</div></div>';
}
function rhythmPickerModalHTML(){
 var picker=rhythmPickerDraft;if(!picker)return "";
 var target=picker.ownerId+"|"+picker.rhythmId,record=rhythmPickerRecord(picker.ownerId,picker.rhythmId);if(!record)return "";
 var people=picker.type==="people";
 var title=people?"People for this rhythm":"Categories for this rhythm";
 var description=people?"Choose everyone who shares this rhythm.":"Choose the categories where this rhythm should appear.";
 var choices=people?S.people.map(function(person){var isOwner=person.id===picker.ownerId,selected=isOwner||picker.selected.indexOf(person.id)!==-1;return '<button type="button" class="prayer-person person-badge-clickable rhythm-picker-option'+(selected?' selected':'')+'" data-rhythm-picker-toggle="people|'+esc(target)+'|'+esc(person.id)+'" aria-pressed="'+selected+'"'+(isOwner?' disabled':'')+'>'+personAvatar(person,28)+esc(person.name)+'</button>';}).join(""):(function(){var names={faith:"Faith",marriage:"Marriage",parenting:"Parenting",health:"Health & Fitness",finances:"Finances",friendships:"Friendships"},ids=picker.ownerId==="faith"?["marriage","parenting","health","finances","friendships"]:["faith","marriage","parenting","health","finances","friendships"];return ids.map(function(id){var selected=picker.selected.indexOf(id)!==-1;return '<button type="button" class="rhythm-picker-option category-option'+(selected?' selected':'')+'" data-rhythm-picker-toggle="categories|'+esc(target)+'|'+id+'" aria-pressed="'+selected+'">'+(AREA_ICONS[id]||"")+'<span>'+names[id]+'</span></button>';}).join("");})();
 return '<dialog class="profile-editor-dialog rhythm-picker-dialog" data-rhythm-picker-dialog aria-labelledby="rhythm-picker-title"><div class="profile-editor-body"><h3 id="rhythm-picker-title" tabindex="-1">'+title+'</h3><p class="profile-tab-intro">'+description+'</p>'+(people?tendPeopleGroupToggleBar(picker.selected,picker.ownerId,"data-rhythm-picker-group"):"")+'<div class="rhythm-picker-options">'+choices+'</div><div class="profile-editor-actions"><button type="button" class="btn mini" data-rhythm-picker-save>Save</button><button type="button" class="btn mini ghost" data-rhythm-picker-cancel data-editor-cancel>Cancel</button></div></div></dialog>';
}
function personRhythmScheduleHTML(r,idf){
 return '<div class="rhythm-schedule-grid"><label class="careplan-field">Frequency<select data-rfield="'+idf+'|freq">'+Object.keys(FREQS).map(function(k){return '<option value="'+k+'"'+(r.freq===k?' selected':'')+'>'+FREQS[k].label+'</option>';}).join('')+'<option value="custom"'+(r.freq==='custom'?' selected':'')+'>Custom...</option></select></label><label class="careplan-field">Time of day<select data-rfield="'+idf+'|tod">'+Object.keys(TODS).map(function(k){return '<option value="'+k+'"'+((r.tod||'anytime')===k?' selected':'')+'>'+esc(TODS[k])+'</option>';}).join('')+'</select></label><label class="careplan-field" data-schedule-day'+(scheduleHasWeekday(r.freq)?'':' hidden')+'>Day of week<select data-rfield="'+idf+'|scheduleDow">'+scheduleDayOptions(r.scheduleDow)+'</select></label></div>';
}
/* ---- action queue (Today with {name}) ---- */
function actDoneAdd(pid,id){window._actDone[pid]=window._actDone[pid]||[];if(window._actDone[pid].indexOf(id)<0)window._actDone[pid].push(id);}
function prayedThisWeek(pid){var d=new Date(),sod=new Date(d.getFullYear(),d.getMonth(),d.getDate()-d.getDay()),n=0;S.events.forEach(function(e){if(e.personId===pid&&(e.kind==="prayer"||e.type==="prayer")&&e.ts>=sod.getTime())n++;});return n;}
var profileTabs={},rippleIdeaOffsets={};
window.addEventListener("click",function(event){
 var rhythmButton=event.target&&event.target.closest&&event.target.closest("[data-plan-edit-rhythm]");
 if(rhythmButton){
  var parts=rhythmButton.getAttribute("data-plan-edit-rhythm").split("|"),owner=S.people.find(function(person){return person.id===parts[0];}),record=owner&&(owner.rhythms||[]).find(function(item){return item.id===parts[1];});
  if(!owner||!record)return;
  event.preventDefault();event.stopImmediatePropagation();
  editRhythmId=record.id;rhythmEditDraft=null;profileTabs[owner.id]="rhythms";currentPerson=owner.id;currentArea=null;tab="people";render();
  return;
 }
 var button=event.target&&event.target.closest&&event.target.closest("[data-plan-spark-edit-viewer]");
 if(!button)return;
 var viewerId=button.getAttribute("data-plan-spark-edit-viewer");
 if(!S.people.some(function(person){return person.id===viewerId;}))return;
 currentPerson=viewerId;currentArea=null;tab="people";profileTabs[viewerId]="sparks";
},true);
function todayRhythmEligible(r){var days=rhythmDaysSince(r);if(days===999)return true;if(days===0)return false;var period=rhythmPeriod(r);var window=Math.min(Math.ceil(period/2),7);if(days>=period)return true;if(!scheduleDayMatches(r))return false;return days>=Math.max(1,period-window);}
function rippleIdea(p){
 var common=["Send a thoughtful text","Make a quick call","Write a handwritten note","Ask how their day really went","Share a happy memory","Follow up on something they mentioned","Offer encouragement before a big day","Send a photo that made you think of them","Ask what would help this week","Thank them for something specific"];
 var byLanguage={qt:["Take a phone-free walk","Share coffee and conversation","Cook a meal together","Ask about the best part of their week","Listen to a favorite song together","Run an errand side by side","Plan a quiet lunch","Spend ten minutes catching up","Look through old photos together","Try something new together"],wa:["Text a specific encouragement","Write a short thank-you note","Say what you admire about them","Celebrate a recent effort","Leave an encouraging voice message","Recall something they handled well","Tell them why you value them","Write a note for a difficult day","Thank them for a small kindness","Ask about a win and celebrate it"],as:["Take a chore off their list","Offer to run an errand","Bring them a meal","Help prepare for tomorrow","Tidy a shared space","Offer a ride","Fix a small annoyance","Help with a task they have postponed","Bring their favorite drink","Ask what practical help they need"],gf:["Bring their favorite snack","Pick a small flower bouquet","Share a book they might love","Print a favorite photo","Bring a little treat from your day","Give a handwritten card","Make a small homemade gift","Replace something they have worn out","Choose something for their hobby","Leave a thoughtful surprise"],pt:["Offer a warm hug","Hold hands on a walk","Sit close while talking","Offer a shoulder rub","Greet them with affection","Share a quiet moment together","Offer a reassuring hand","Ask what kind of affection feels good","Pause for a goodbye hug","Cuddle while watching something together"]};
 var ideas=(byLanguage[p.loveLanguage]||common).slice();
 var last=S.events.filter(function(e){return e.personId===p.id&&e.kind!=="prayer";}).sort(function(a,b){return b.ts-a.ts;})[0];
 if(last&&last.title&&last.title.indexOf("Time with")!==0)ideas[9]='Follow up on \u201c'+last.title+'\u201d';
 return ideas[(Math.floor(Date.now()/864e5)+(rippleIdeaOffsets[p.id]||0))%ideas.length];
}
function collectionIcon(key){var paths={rhythms:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5 M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',connection:'<path d="m9.5 14.5-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0 M14.5 9.5l2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0 M8.5 15.5l7-7"/>',sparks:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',prayer:'<circle cx="17" cy="4.3" r="2.7"/><path d="M10.2 8.1c.7-.8 1.9-.9 2.7-.2l3.3 2.8 2-2c.8-.8 2.1-.8 2.9 0s.8 2.1 0 2.9l-3.4 3.4c-.8.8-2.1.8-2.9 0l-1.1-1-2.6 3.2 4.5 3.2c.6.4.9 1.1.9 1.8 0 1-.8 1.8-1.8 1.8H5.1c-1.2 0-2.1-.9-2.1-2.1s.9-2.1 2.1-2.1h4.3l-3.1-2.3c-1.3-.9-1.5-2.7-.5-3.9z"/>',faith:'<path d="M12 3v18 M6.5 8h11"/>',notes:'<path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6"/>'};return '<svg class="collection-icon'+(key==="prayer"?" collection-icon-prayer":"")+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[key]||"")+'</svg>';}
function profileActionIcon(name){var paths={edit:'<path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8Z"/>',remove:'<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7"/>',log:'<path d="M12 5v14M5 12h14"/>',view:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chart:'<path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/>'};return '<svg class="profile-action-icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||"")+'</svg>';}
function tendRhythmFrequencyLabel(r){
 if(r.freq==="selectdays"&&Array.isArray(r.weekdays)&&r.weekdays.length)return "Every "+r.weekdays.slice().sort().map(function(day){return DOW_SHORT[+day];}).join(", ");
 var label=rhythmFreqLabel(r),freq=r.freq||(r.rule&&r.rule.freq),day;
 if(freq==="weekly"){
  var days=r.rule&&Array.isArray(r.rule.days)?r.rule.days:Array.isArray(r.weekdays)?r.weekdays:r.scheduleDow!==null&&r.scheduleDow!==undefined&&r.scheduleDow!==""?[+r.scheduleDow]:[];
  days=days.map(Number).filter(function(value,index,all){return value>=0&&value<7&&all.indexOf(value)===index;}).sort(function(a,b){return a-b;});
  return days.length&& !/\bon\b/i.test(label) ? label+" on "+days.map(function(value){return DOW[value];}).join(", "):label;
 }
 if(freq==="monthly"){day=scheduleDayLabel(r);if(day){var match=day.match(/^on the (\d+)$/i);if(match){var date=+match[1],lastTwo=date%100,suffix=lastTwo>=11&&lastTwo<=13?"th":date%10===1?"st":date%10===2?"nd":date%10===3?"rd":"th";day="on the "+date+suffix;}day=day.replace(/^on\s+/i,"on ");return label.toLowerCase().indexOf(day.toLowerCase())>=0?label:label+" "+day;}}
 return label;
}
function tendRhythmMetaLabel(r,eventTs,includeDue){
 var last=Number.isFinite(eventTs)?{ts:eventTs}:rhythmLast(r),frequency=typeof window.rhythmCardFrequencyLabel==="function"?window.rhythmCardFrequencyLabel(r):tendRhythmFrequencyLabel(r),parts=[frequency];
 if(r.tod&&r.tod!=="anytime"&&TODS[r.tod])parts.push(TODS[r.tod]);
 parts.push(last?(Number.isFinite(eventTs)?"Tended ":"Last tended ")+when(last.ts)+(Number.isFinite(eventTs)&&daysSince(last.ts)===0?" "+fmtHM(last.ts):""):"Not yet tended");
 if(includeDue&&last&&rhythmDaysSince(r)!==0)parts.push(rhythmDueTxt(r));
 return parts.join(" \u00B7 ");
}
function noteKindLabel(kind){return kind==="prayernote"||kind==="prayer"||kind==="faith-note"?"Prayer":kind==="encouragement"?"Encouragement":kind==="followup"?"Follow-up":"General";}
function noteKindOptions(selected){selected=selected==="prayernote"?"prayer":selected;return [["general","General"],["encouragement","Encouragement"],["followup","Follow-up"],["prayer","Prayer"]].map(function(option){return '<option value="'+option[0]+'"'+(option[0]===selected?' selected':'')+'>'+option[1]+'</option>';}).join("");}
function profileNoteTitleText(note){return String(note.title||note.text||"");}
function profileNoteDetails(note){return String(note.details||"");}
function followupAssociationOwner(note){return note&&note.kind==="faith-note"?"faith":note&&(note.personId||"global");}
function personNoteRecords(person){return S.followups.filter(function(note){return note.personId===person.id||(Array.isArray(note.sharedWith)&&note.sharedWith.indexOf(person.id)!==-1);});}
function tendNoteCardHTML(note,person,options){
 options=options||{};var completed=!!options.completed,stamp=options.metadata||"",actionLabel=options.actionLabel||(completed?"Reopen":"Done");
 var ownerId=note.kind==="faith-note"?"faith":note.personId||person.id,badges=tendAssociationPeopleBadges(note,ownerId,person.id,"notes")+tendAssociationCategoryBadges(note);
 var edit='<button type="button" class="iconbtn person-note-edit" data-fuedit="'+esc(note.id)+'" aria-label="Edit note" title="Edit">'+profileActionIcon("edit")+'</button>';
 var done='<button type="button" class="btn mini '+(completed?"ghost":"note-done")+'" data-fudone="'+esc(note.id)+'" aria-label="'+esc(actionLabel+" note")+'">'+esc(actionLabel)+'</button>';
 return '<article class="person-note-row'+(completed?' is-done':'')+'"><div class="person-note-heading"><div class="person-note-title-line"><strong class="tend-type-title">'+esc(profileNoteTitleText(note))+'</strong>&nbsp;'+edit+'</div>'+done+'</div>'
  +(profileNoteDetails(note)?'<div class="person-note-description tend-type-description">'+esc(profileNoteDetails(note))+'</div>':"")
  +(badges?'<div class="person-note-associations">'+badges+'</div>':"")
  +'<div class="person-note-footer"><span class="person-note-type-column">'+esc(noteKindLabel(note.kind))+'</span>'+(stamp?'<span class="person-note-meta tend-type-meta">'+planMetaIcon("occurred")+'<span>'+esc(stamp)+'</span></span>':"")+'</div></article>';
}
function tendNoteEditorHTML(note,ownerId){
 var associationOwner=followupAssociationOwner(note)||ownerId;
 return '<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="note-editor-title"><div class="profile-editor-body"><h3 id="note-editor-title">Edit Note</h3>'+(note.kind==="faith-note"?'<div class="profile-note-type"><span>Type</span><strong>Prayer</strong></div>':'<label class="profile-note-type">Type<select data-fu-kind>'+noteKindOptions(note.kind==="encouragement"?"encouragement":note.kind==="followup"?"followup":note.kind==="prayernote"?"prayer":"general")+'</select></label>')+'<label class="profile-note-type">Title<input id="followupEditTitle" aria-label="Note title" value="'+esc(profileNoteTitleText(note))+'"></label><label class="profile-note-type">Details<textarea id="followupEditDetails" aria-label="Note details" placeholder="Add details (optional)">'+esc(profileNoteDetails(note))+'</textarea></label>'+tendAssociationControlsHTML("followup",associationOwner,note.id,note)+'<div class="profile-editor-actions"><button class="btn mini" data-fusave="'+esc(note.id)+'">Save Note</button><button class="btn mini ghost" data-fucancel="1" data-editor-cancel>Cancel</button><button class="btn mini danger" data-fudel="'+esc(note.id)+'">Delete Note</button></div></div></dialog>';
}
function tendNoteAddEditorHTML(ownerId,draft){
 var isFaith=ownerId==="faith";
 return '<dialog class="profile-editor-dialog" data-profile-editor="note"'+(isFaith?' data-editor-modal':'')+' aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Note</h3>'+(isFaith?'<div class="profile-note-type"><span>Type</span><strong>Prayer</strong></div>':'<label class="profile-note-type">Type<select id="profileNoteKind">'+noteKindOptions("general")+'</select></label>')+'<label class="profile-note-type">Title<input id="profileNoteTitle" placeholder="A short title"></label><label class="profile-note-type">Details<textarea id="profileNoteDetails" placeholder="Add details (optional)"></textarea></label>'+tendAssociationControlsHTML("followup",ownerId,"new",draft)+'<div class="profile-editor-actions"><button class="btn mini" data-profilenotesave="'+esc(ownerId)+'">Save Note</button><button class="btn mini ghost" data-profilenotecancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';
}
function notesChecklist(p,addAction){
 var items=personNoteRecords(p);
 function row(f){
  if(editingFollowupId===f.id)return tendNoteEditorHTML(f,p.id);
  var stamp=f.createdAt||f.ts?when(f.createdAt||f.ts):f.due?"Due "+f.due:"";
  return tendNoteCardHTML(f,p,{completed:f.done,metadata:stamp});
 }
 var active=items.filter(function(f){return !f.done;}),done=items.filter(function(f){return f.done;});
 var completedEdit=done.find(function(note){return note.id===editingFollowupId;});
 return (active.length?active.map(row).join(""):'<div class="profile-empty-state">No notes yet</div>')+(completedEdit?tendNoteEditorHTML(completedEdit,p.id):"")+(done.length?'<button type="button" class="btn mini ghost profile-rhythm-add person-note-history-button" data-note-history="'+esc(p.id)+'">Completed ('+done.length+')</button>':'')+(addAction||"");
}
function openNoteHistory(scopeId){
 var person=S.people.find(function(item){return item.id===scopeId;}),notes;
 if(scopeId==="faith")notes=faithNoteRecords().filter(function(note){return note.done;});
 else if(person)notes=personNoteRecords(person).filter(function(note){return note.done;});
 else return;
 notes.sort(function(a,b){return (b.completedDate||b.createdAt||b.ts||0)>(a.completedDate||a.createdAt||a.ts||0)?1:-1;});
 var context=person||{id:"faith"},heading=person?'<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div>':'<div class="history-person"><strong>Faith</strong></div>';
 var dialog=document.createElement("dialog");dialog.className="rhythm-history-dialog note-history-dialog";dialog.setAttribute("aria-labelledby","noteHistoryTitle");
 dialog.innerHTML='<div class="note-history-header">'+heading+'<div class="history-heading"><div><h2 id="noteHistoryTitle">Completed notes</h2><p class="history-rhythm-details">'+notes.length+' completed note'+(notes.length===1?"":"s")+'</p></div><button class="iconbtn" data-note-history-close aria-label="Close note history">✕</button></div></div><div class="notes-history-list note-history-modal-list">'+(notes.length?notes.map(function(note){return tendNoteCardHTML(note,context,{completed:true,metadata:note.completedDate?"Completed "+when(note.completedDate):"",actionLabel:"Reopen"});}).join(""):'<div class="empty">No completed notes yet.</div>')+'</div>';
 dialog.addEventListener("click",function(event){
  if(event.target.closest("[data-note-history-close]")){dialog.close();return;}
  if(event.target.closest("[data-fudone],[data-fuedit],[data-fudel]"))dialog.close();
 });
 dialog.addEventListener("close",function(){dialog.remove();});document.body.appendChild(dialog);tendShowModal(dialog);
}
function openPersonNoteHistory(personId){openNoteHistory(personId);}
function profilePanelStart(key){return '<section class="'+(key==="prayer"?"":"card ")+'profile-tab-panel" id="profile-panel-'+key+'" role="tabpanel" aria-labelledby="profile-tab-'+key+'"'+(activeProfileTab===key?'':' hidden')+'>';}
var activeProfileTab="rhythms";
function actQueueHTML(p){
 /* Show every due connection rhythm in the personal queue. */
 var allR=(p.rhythms||[]).filter(function(r){return (r.category||"connection")!=="prayer";});
 var waitR=allR.filter(function(r){return todayRhythmEligible(r);}).sort(function(a,b){return rhythmPeriod(a)-rhythmPeriod(b)||rhythmScore(a)-rhythmScore(b);});
 var visR=waitR;
 var dueSparks=sortedPersonSparks(p).filter(function(spark){return !!spark.by&&sparkLive(spark);});
 var waiting=waitR.length+dueSparks.length;
 var dayOrder=dayBlocks().map(function(block){return block.id;}),rows=[],rowOrder=0;
 function queueFrequency(item,type){
  if(type==="rhythm")return rhythmPeriod(item);
  if(type==="spark")return Number.MAX_SAFE_INTEGER;
  return Infinity;
 }
 function queueRow(html,item,type){
  var time=dayOrder.indexOf(item.tod);
  rows.push({html:html,frequency:queueFrequency(item,type),time:time<0?dayOrder.length:time,order:rowOrder++});
 }
 function rhyRowQ(r,dim){
  var metadata=window.tendRhythmCardMetadata(r),badges=tendQueuePeopleAndCategoryBadges(r,p.id,p.id,"rhythm");
  return tendRhythmCardHTML(r,{title:r.text||"(unnamed rhythm)",description:r.description,peopleBadgesHTML:badges,
   frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
   tendAttributes:{"data-tend-open":"person-rhythm","data-person-id":p.id,"data-rhythm-id":r.id},showScore:false});
 }
 function sparkRowQ(spark){
  var ownerId=spark.profileOwnerId||p.id,sub=(spark.time?fmtHM12(spark.time)+" \u00b7 ":"")+sparkDueTxt(spark),badges=tendQueuePeopleAndCategoryBadges(spark,ownerId,p.id,"spark");
  return '<div class="actrow person-queue-spark"><div class="pi-main">'+tendSparkCardContentHTML(spark,{title:spark.text||"(unnamed spark)",description:String(spark.details||"").trim(),meta:sub,peopleBadges:badges})+'</div><button type="button" class="btn mini sparkbtn" data-sparkdo="'+esc(ownerId+"|"+spark.id+"|"+p.id)+'">Do it</button></div>';
 }
 visR.forEach(function(r){queueRow(rhyRowQ(r,false),r,"rhythm");});
 dueSparks.forEach(function(spark){queueRow(sparkRowQ(spark),spark,"spark");});
 rows.sort(function(a,b){return a.frequency<b.frequency?-1:a.frequency>b.frequency?1:a.time-b.time||a.order-b.order;});
 var out=tendTodayWithPersonHTML({personName:p.name,waitingCount:waiting,itemsHTML:rows.map(function(row){return row.html;}).join("")});
 out+=tendPrayerSectionHTML("Pray for "+p.name,"", {headerClassName:"today-with-person-heading person-prayer-heading"});
 if(typeof window.personFocusedPrayerHTML==="function")out+=window.personFocusedPrayerHTML(p);
 if(typeof faithPrayerSession!=="undefined"&&faithPrayerSession&&faithPrayerSession.source==="person"&&faithPrayerSession.personId===p.id)out+=faithPrayerSessionHTML();
 out+=personFreeMomentHTML(p);
 /* one coaching nudge, at the bottom of the queue */
 var llq=p.loveLanguage||"",bdq=bdayInfo(p.birthday),nudq=[];
 if(bdq&&bdq.days<=14)nudq.push('<b>Birthday '+esc(bdq.label)+' is in '+bdq.days+' day'+(bdq.days===1?"":"s")+' - plan something.</b>');

 if(nudq.length)out+='<div class="nudge"><span aria-hidden="true">\uD83D\uDCA1</span><ul class="nudge-list">'+nudq.map(function(item){return "<li>"+item+"</li>";}).join("")+'</ul></div>';
 return out;}
function personProfile(pid){
 var p=S.people.find(function(x){return x.id===pid;});if(!p)return "";
 var sc=personScore(p),c=scoreClass(sc);
 var crs=personRhythms(p,"connection"),prs=personRhythms(p,"prayer");
 var pTouch=personTouchInfo(p),tScore=touchScoreFromDays(pTouch.days),tCls=scoreClass(tScore);
 var cInfo=personConnInfo(p),pInfo=personPrayerInfo(p);
 var cScore=connScoreFromDays(cInfo.days,personCadenceDays(p)),cCls=scoreClass(cScore);
 var pScore=prs.length?avg(prs.map(rhythmScore)):prayerScoreFromDays(pInfo.days),pCls=scoreClass(pScore);
 var evs=S.events.filter(function(e){return eventHasPerson(e,pid);}).sort(function(a,b){return b.ts-a.ts;});
 var prayers=S.prayers.filter(function(x){return x.personId===pid||(Array.isArray(x.sharedWith)&&x.sharedWith.indexOf(pid)!==-1);}).map(function(item){return Object.assign({},item,{profileOwnerId:item.personId,profileViewingId:pid});});
 var ll=p.loveLanguage||"";
 var first=esc(p.name.split(" ")[0]);
 var bd=bdayInfo(p.birthday);
 /* Keep person-specific actions together without mixing in global app controls. */
 var header='<div class="person-profile-head person-profile-header"><div class="person-identity">'+personAvatar(p,76)+'<div><h3 class="tend-type-title">'+esc(p.name)+'</h3><div class="rel">'+esc(p.relation||"")+'</div></div></div><details class="person-profile-options"><summary aria-label="Person options" title="Person options"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></summary><div class="person-profile-options-list"><button type="button" data-psettings="1">Person settings</button><button type="button" data-closeperson="1">Close profile</button></div></details></div>';
 var badges='<div class="person-profile-badges">';
 if(ll&&LL_LANGUAGES[ll])badges+='<span class="person-profile-badge">'+(typeof window.llIconHTML==="function"?window.llIconHTML(p):"")+esc(LL_LANGUAGES[ll])+'</span>';
 if(bd)badges+='<span class="person-profile-badge" aria-label="Birthday: '+esc(bd.label)+'"><span aria-hidden="true">\uD83C\uDF82</span><span>'+esc(personProfileShortDateLabel(bd.label))+'</span></span>';
 if(p.anniversary){var an2=annivInfo(p.anniversary);if(an2)badges+='<span class="person-profile-badge" aria-label="Anniversary: '+esc(an2.label)+'"><span aria-hidden="true">\u2665</span><span>'+esc(personProfileShortDateLabel(an2.label))+'</span></span>';}
 badges+='</div>';
 var scoreAvailable=sc!==null&&sc!==undefined&&Number.isFinite(Number(sc)),scoreValue=scoreAvailable?Math.max(0,Math.min(100,Number(sc))):null;
 var out='<div class="card detail open person-profile" id="personPanel">';
 out+='<div class="person-health-heading dashboard-overall-heading"><h3>Overall health</h3><span class="ov-score">'+(scoreAvailable?esc(sc):"\u2014")+'</span></div>'+personHealthMeter(scoreAvailable?scoreValue:null,p.name,true)+'<div class="meta person-profile-health-status"><span>'+esc(scoreAvailable?scoreLabel(scoreValue):"Health score unavailable")+'</span></div>';
 if(crs.length||prs.length){
  var rm=crs.length?avg(crs.map(rhythmScore)):null,rmCls=rm===null?"":scoreClass(rm);
  out+='<div class="pmeters three"><div class="pmeter"><div class="pm-lab"><span>Rhythms</span><span class="pm-val '+rmCls+'">'+(rm===null?"-":rm)+'</span></div><div class="bar"><i class="'+rmCls+'" style="width:'+(rm||0)+'%"></i></div><div class="pm-note">'+(crs.length?crs.length+" connection rhythms":"none yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+tCls+'">'+tScore+'</span></div><div class="bar"><i class="'+tCls+'" style="width:'+tScore+'%"></i></div><div class="pm-note">'+(pTouch.last?("last: "+when(pTouch.last.ts)):"no connections yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }else{
  out+='<div class="pmeters"><div class="pmeter"><div class="pm-lab"><span>Connection</span><span class="pm-val '+cCls+'">'+cScore+'</span></div><div class="bar"><i class="'+cCls+'" style="width:'+cScore+'%"></i></div><div class="pm-note">'+(cInfo.last?("last: "+when(cInfo.last.ts)):"no connections yet")+'</div></div>';
  out+='<div class="pmeter"><div class="pm-lab"><span>Prayer</span><span class="pm-val '+pCls+'">'+pScore+'</span></div><div class="bar"><i class="'+pCls+'" style="width:'+pScore+'%"></i></div><div class="pm-note">'+(pInfo.last?("last: "+when(pInfo.last.ts)):"no prayers logged")+'</div></div></div>';
 }
 out+='</div>';
 /* today: the action queue */
 out+=actQueueHTML(p);
 /* ripples: modal */
 if(window._rippleModalOpen||editingConn){
 var edEv=editingConn?(S.events.find(function(z){return z.id===editingConn;})||{}):null;
 var sparkConnection=edEv&&(edEv.origin==="spark"||edEv.note==="Spark landed"),rhythmConnection=edEv&&!!edEv.rhythmId,rhythmOwner=rhythmConnection&&connectionRhythmOwner(edEv),rhythmDraftRecord=rhythmOwner&&rhythmEditDraft&&rhythmEditDraft.id===edEv.rhythmId?rhythmEditDraft:rhythmOwner&&(rhythmOwner.rhythms||[]).find(function(item){return item.id===edEv.rhythmId;});
 var associationKey=edEv&&tendAssociationKey("connection","connection",edEv.id);
 if(edEv&&!tendItemAssociationDrafts[associationKey])tendItemAssociationDrafts[associationKey]={sharedWith:connectionParticipantIds(edEv),areas:connectionCategoryIds(edEv)};
 out+='<dialog class="ripple-dialog" id="rippleDialog" data-editor-modal aria-labelledby="rippleDialogTitle"><div class="box"><div class="subhead" id="rippleDialogTitle">'+(editingConn?'Edit Connection':'Add Connection')+'</div><p class="profile-tab-intro">Record a moment you shared with '+first+'.</p>';
 var rippleKind=edEv?(edEv.kind||edEv.type):"text";
 if(edEv&&!RIPPLE_TYPES[rippleKind])rippleKind="other";
 var rippleTime=edEv?new Date(edEv.ts||Date.now()):new Date();
 var rippleTimeValue=String(rippleTime.getHours()).padStart(2,"0")+":"+String(rippleTime.getMinutes()).padStart(2,"0");
 out+='<div class="ripple-fields">'+(edEv&&(rhythmConnection||sparkConnection)?'<div class="ripple-field"><span>Type</span><div class="ripple-type-value">'+(sparkConnection?"Spark":"Rhythm")+'</div></div>':'<label class="ripple-field">Type<select id="plogType">'+Object.keys(RIPPLE_TYPES).map(function(k){return '<option value="'+k+'"'+(rippleKind===k?' selected':'')+'>'+RIPPLE_TYPES[k]+'</option>';}).join("")+'</select></label>')+'<label class="ripple-field">Date<input type="date" id="momentDate" value="'+(edEv?fmtDate(edEv.ts||Date.now()):fmtDate(Date.now()))+'"></label><label class="ripple-field">Time<input type="time" id="momentTime" '+(edEv&&edEv.allDay?"disabled":"")+' value="'+rippleTimeValue+'"></label><label class="ripple-all-day"><input type="checkbox" id="momentAllDay" class="cb" '+(edEv&&edEv.allDay?"checked":"")+'> All Day</label></div>';
 out+='<div class="qlog" id="plogOtherRow" style="display:'+(rippleKind==="other"&&!(edEv&&(rhythmConnection||sparkConnection))?'flex':'none')+'"><input id="plogOther" aria-label="Other ripple type" value="'+esc(rippleKind==="other"&&edEv?(edEv.rippleLabel||edEv.kind||""):"")+'" placeholder="What kind of moment?" class="ripple-other"></div>';
 if(!rhythmConnection){
  out+='<div class="addrow" style="margin-top:8px"><input id="momentTitle" value="'+esc(edEv&&edEv.title&&edEv.title.indexOf("Time with")!==0?edEv.title:"")+'" placeholder="Title - e.g. Encouraging Message"></div>';
  out+='<div class="addrow" style="align-items:flex-start"><textarea id="momentNote" placeholder="Notes - what you want to remember..." style="min-height:70px;flex:1;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--canvas);font-size:15px">'+esc(edEv?(sparkConnection&&edEv.note==="Spark landed"?"":edEv.note||""):"")+'</textarea></div>';
 }
 if(edEv&&sparkConnection)out+=tendAssociationControlsHTML("connection","connection",edEv.id,edEv);
 if(edEv&&rhythmConnection){
  if(rhythmDraftRecord){
   var rhythmFieldId=rhythmOwner.id+"|"+rhythmDraftRecord.id;
   if(!rhythmEditDraft||rhythmEditDraft.id!==rhythmDraftRecord.id){rhythmEditDraft=JSON.parse(JSON.stringify(rhythmDraftRecord));editRhythmId=rhythmDraftRecord.id;rhythmDraftRecord=rhythmEditDraft;}
   out+='<div class="connection-rhythm-fields"><p class="profile-tab-intro">Rhythm details update the recurring rhythm; people and categories below apply to this logged connection.</p><label class="careplan-field">Rhythm<input data-rfield="'+esc(rhythmFieldId)+'|text" value="'+esc(rhythmDraftRecord.text||"")+'" placeholder="Rhythm name"></label><label class="careplan-field">Description (optional)<textarea data-rfield="'+esc(rhythmFieldId)+'|description" placeholder="Add context or details">'+esc(rhythmDraftRecord.description||"")+'</textarea></label>'+personRhythmScheduleHTML(rhythmDraftRecord,rhythmFieldId)+'</div>';
  }
  out+=tendAssociationControlsHTML("connection","connection",edEv.id,edEv);
 }
 out+='<div class="profile-editor-actions"><button class="btn" data-psubmit="'+pid+'">Save</button><button class="btn ghost" data-peditcancel="1" data-editor-cancel>Cancel</button>'+(editingConn?'<button class="btn mini danger" style="margin-left:auto" data-connectionundo="'+esc(editingConn)+'">'+(sparkConnection?"Restore":"Undo")+'</button>':'')+'</div>';
 out+='</div></dialog>';
 }
 activeProfileTab=profileTabs[pid]||"rhythms";
 var connections=connectionHistoryEvents(pid);
 var counts={rhythms:sortedPersonRhythms(p).length,connection:connections.length,sparks:sortedPersonSparks(p).length,prayer:prayers.filter(function(x){return !x.answered&&!x.archived;}).length,notes:personNoteRecords(p).filter(function(f){return !f.done;}).length};
 var tabHealth={rhythms:avg(sortedPersonRhythms(p).map(rhythmScore)),connection:connectionScore(p),prayer:prayerMeterScore(p)};
 out+='<div class="person-profile-divider" aria-hidden="true"></div>'+tendSectionHeaderHTML({title:"Intentional with "+p.name,className:"profile-settings-heading"})+'<div class="profile-tabs-row"><div class="profile-tabs" role="tablist" aria-label="Intentional with '+esc(p.name)+'">'+[["rhythms","Rhythms"],["sparks","Sparks"],["prayer","Prayer"],["connection","Connections"],["notes","Notes"]].map(function(item){var selected=activeProfileTab===item[0],health=tabHealth[item[0]],healthText=health===null||health===undefined||!Number.isFinite(Number(health))?"\u2014":String(health)+"%",healthTone=healthText==="\u2014"?"neutral":scoreClass(Number(health));return '<button type="button" role="tab" id="profile-tab-'+item[0]+'" aria-controls="profile-panel-'+item[0]+'" aria-selected="'+selected+'" tabindex="'+(selected?"0":"-1")+'" data-profiletab="'+item[0]+'"><span class="profile-tab-heading">'+collectionIcon(item[0])+'<span class="profile-tab-label">'+item[1]+'</span></span><span class="tab-count">'+counts[item[0]]+'</span><span class="profile-tab-mobile-details"><span class="profile-tab-item-count" aria-label="'+counts[item[0]]+' items"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r=".7"/><circle cx="4" cy="12" r=".7"/><circle cx="4" cy="18" r=".7"/></svg><span>'+counts[item[0]]+'</span></span><span class="profile-tab-health-score '+healthTone+'">'+healthText+'</span></span></button>';}).join('')+'</div></div>';
 out+=profilePanelStart("connection")+'<p class="profile-tab-intro connection-profile-intro">Shared moments that keep you connected.</p><div class="profile-panel-toolbar connection-profile-toolbar"><button type="button" class="connection-history-chart-trigger" data-connection-history="'+esc(pid)+'" aria-label="View connection chart">'+profileActionIcon("chart")+'</button><button type="button" class="btn mini ghost profile-rhythm-add connection-profile-log" data-rippleopen="1">'+profileActionIcon("log")+'<span>Log connection</span></button></div>';
 if(connections.length){
  out+='<div class="connection-list">'+connections.slice(0,5).map(function(event){return connectionCardHTML(event,pid);}).join("")+'</div>';
 }else out+='<div class="connection-list"><div class="profile-empty-state">No connections yet</div></div>';
 if(connections.length>5)out+='<button type="button" class="btn mini ghost profile-rhythm-add connection-history-view-all" data-connection-history-list="'+esc(pid)+'">View all ('+connections.length+')</button>';
 out+='</section>';
 out+=profilePanelStart("rhythms")+'<div class="profile-panel-toolbar profile-rhythm-toolbar"><p class="profile-tab-intro">Recurring practices that help you stay connected.</p><button type="button" class="btn mini ghost profile-rhythm-add" data-rhyadd="'+esc(pid)+'">'+profileActionIcon("log")+'<span>Add rhythm</span></button></div><div class="profile-rhythm-list">';
 var profileRhythms=sortedPersonRhythms(p);
 if(profileRhythms.length){profileRhythms.forEach(function(r){out+=rhythmRow(p,r,{frequencyLabel:r.freq==="yearly"?"Yearly":""});});}
 else out+='<div class="profile-empty-state">No rhythms yet</div>';
 out+='</div>';
 var dO=rhythmDraft&&rhythmDraft.pid===pid;
 if(dO)out+='<dialog class="profile-editor-dialog" data-profile-editor="rhythm" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Rhythm</h3>'+draftRow(p)+'<div class="profile-editor-actions"><button class="btn mini" data-rhyadd="'+pid+'">Save Rhythm</button><button class="btn mini ghost" data-rhycancel="1" data-editor-cancel>Cancel</button></div></div></dialog>';
 out+=rhythmPickerModalHTML();
 out+='</section>';
 out+=profilePanelStart("sparks")+'<div class="profile-panel-toolbar profile-rhythm-toolbar"><p class="profile-tab-intro">Low-pressure ideas to enjoy together.</p><button type="button" class="btn mini ghost profile-rhythm-add" data-sparkaddopen="'+esc(pid)+'">'+profileActionIcon("log")+'<span>Add spark</span></button></div><div class="profile-spark-list">';
 var sps=sortedPersonSparks(p);
 if(sps.length){sps.forEach(function(s){
  var sparkOwnerId=s.profileOwnerId||pid,personBadges=tendAssociationPeopleBadges(s,sparkOwnerId,pid,"spark"),categoryBadges=tendAssociationCategoryBadges(s),sparkDate=s.by?sparkDueTxt(s)+" · "+s.by:"Someday";
  var editAction='<button type="button" class="btn mini ghost profile-secondary-action profile-rhythm-icon-action profile-rhythm-edit-action" data-sedit="'+esc(sparkOwnerId+"|"+s.id)+'" aria-label="Edit '+esc(s.text)+'" title="Edit">'+profileActionIcon("edit")+'</button>';
  var sparkTopMeta='<div class="plan-item-top-meta">'+(personBadges?'<div class="plan-item-meta-people plan-people"><span class="plan-people-visible">'+personBadges+'</span></div>':'')+(categoryBadges?'<div class="plan-item-category-row"><span class="rhythm-area-badges plan-category-visible">'+categoryBadges.replace(/^<span class="rhythm-area-badges"[^>]*>|<\/span>$/g,"")+'</span></div>':'')+'</div>';
  var sparkAction='<button type="button" class="btn mini sparkbtn" data-sparkdo="'+esc(sparkOwnerId+"|"+s.id+"|"+pid)+'">Do it</button>';
  var sparkFooter=(s.time?'<span class="spark-card__meta-item" aria-label="Preferred time: '+esc(fmtHM12(s.time))+'">'+planMetaIcon("time")+'<span>'+esc(fmtHM12(s.time))+'</span></span>':"")
   +'<span class="spark-card__meta-item dashboard-spark-deadline" aria-label="'+(s.by?"Due "+esc(s.by)+", "+esc(sparkDueTxt(s)):"No due date")+'">'+planMetaIcon("occurred")+'<span>'+esc(sparkDate)+'</span></span>';
  out+=tendSparkCardHTML(s,{title:s.text||"(unnamed spark)",description:String(s.details||"").trim(),actionHTML:sparkAction,headingEditHTML:editAction,topMetaHTML:sparkTopMeta,footerHTML:sparkFooter,footerClass:"profile-spark-footer",className:"profile-spark-row",cardAttributes:{"data-spark-row":sparkOwnerId+"|"+s.id}});
  if(editSparkId===s.id&&sparkEditDraft&&sparkEditDraft.id===s.id){out+=tendSparkEditModalHTML(sparkOwnerId,pid);}
 });}
 else out+='<div class="profile-empty-state">No sparks yet</div>';
 out+='</div><p class="profile-spark-completion-note">Completed Sparks show under Connections.</p>';
 var addingSpark=sparkDraftOpenFor===pid;
 if(addingSpark)out+='<dialog class="profile-editor-dialog" data-profile-editor="spark" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Spark</h3><div class="addrow spark-draft"><input placeholder="Idea - a movie, a talk, a trip..." data-spnewtext="'+pid+'"><textarea placeholder="Details (optional)" data-spnewdetails="'+pid+'"></textarea><input type="date" data-spnewdate="'+pid+'" aria-label="Spark date" style="max-width:150px"><input type="time" data-spnewtime="'+pid+'" aria-label="Spark time" style="max-width:110px"></div>'+tendAssociationControlsHTML("spark",pid,"new",sparkAddDrafts[pid]||(sparkAddDrafts[pid]={sharedWith:[],areas:[]}))+'<div class="profile-editor-actions"><button class="btn mini" data-spadd="'+pid+'">Save Spark</button><button class="btn mini ghost" data-sparkaddcancel="'+pid+'" data-editor-cancel>Cancel</button></div></div></dialog>';
 out+='</section>';
 var addingPrayer=window._personPrayerDraftFor===pid;
 out+=profilePanelStart("prayer")+'<div class="profile-panel-toolbar profile-rhythm-toolbar"><p class="profile-tab-intro">Prayer requests to remember and bring before God.</p><button type="button" class="btn mini ghost profile-rhythm-add profile-prayer-add" data-personprayeropen="'+esc(pid)+'">'+profileActionIcon("log")+'<span>Add prayer</span></button></div>'+prayerList(prayers,true);
 if(addingPrayer)out+='<dialog class="profile-editor-dialog" data-profile-editor="prayer" aria-labelledby="profile-editor-title"><div class="profile-editor-body"><h3 id="profile-editor-title">Add Prayer</h3>'+personPrayerAddFields(pid)+'</div></dialog>';
 out+='</section>';
 out+=profilePanelStart("notes")+'<div class="profile-panel-toolbar profile-rhythm-toolbar"><p class="profile-tab-intro">Thoughts, encouragement, and follow-ups to remember.</p><button type="button" class="btn mini ghost profile-rhythm-add" data-profilenoteopen="'+esc(pid)+'">'+profileActionIcon("log")+'<span>Add note</span></button></div>';
 out+='<div class="person-notes person-note-list">'+notesChecklist(p,"")+'</div>';
 if(noteDraftOpenFor===pid){var noteDraft=noteAddDrafts[pid]||(noteAddDrafts[pid]={personId:pid,sharedWith:[],areas:[]});out+=tendNoteAddEditorHTML(pid,noteDraft);}
 out+='</section>';
 /* person settings: gear in the header opens this modal */
 var relIn=REL_OPTIONS.indexOf(p.relation);
 var m='<div class="modal'+(window._psModalOpen?" open":"")+'" id="personSettingsModal"><div class="box person-settings-box" role="dialog" aria-modal="true" aria-labelledby="personSettingsTitle"><div class="settings-head"><h3 id="personSettingsTitle">Person settings - '+esc(p.name)+'</h3><button type="button" class="iconbtn" data-psettingsclose="1" title="Done" aria-label="Close person settings">\u2715</button></div><div class="person-settings-content">';
 m+='<section class="person-settings-section"><h4 class="settings-section-title">Person</h4>';
 m+='<div class="field person-photo-field"><label>Photo</label><div class="person-photo-controls">'+personAvatar(p,56)+'<input type="file" accept="image/*" data-pphoto="'+pid+'" aria-label="Upload photo for '+esc(p.name)+'">'+(p.photo?'<button type="button" class="btn mini danger" data-pphorm="'+pid+'">Remove photo</button>':'')+'</div><div class="hint person-photo-help">Crops to a circle for their card.</div>'+(p.photo?'':'<label for="personAvatarStyle-'+esc(pid)+'">Illustration style</label><select id="personAvatarStyle-'+esc(pid)+'" data-pfield="avatarStyle" data-pid="'+esc(pid)+'">'+[["neutral","Neutral"],["masculine","Masculine"],["feminine","Feminine"]].map(function(o){return '<option value="'+o[0]+'"'+((p.avatarStyle||"neutral")===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select><div class="hint person-photo-help">Used only when no photo is uploaded.</div>')+'</div>';
 m+='<div class="field"><label for="personRelation-'+esc(pid)+'">Relationship</label><select id="personRelation-'+esc(pid)+'" data-pfield="relation" data-pid="'+pid+'"><option value="">- not set -</option>';
 if(p.relation&&relIn<0)m+='<option value="'+esc(p.relation)+'" selected>'+esc(p.relation)+' (custom)</option>';
 m+=REL_OPTIONS.map(function(o){return '<option value="'+o+'"'+(relIn>=0&&REL_OPTIONS[relIn]===o?" selected":"")+'>'+o+'</option>';}).join("");
 m+='<option value="__custom"'+(p.relation&&relIn<0?" selected":"")+'>Custom...</option></select>';
 if(p.relation&&relIn<0)m+='<div class="addrow"><input id="personCustomRelation-'+esc(pid)+'" aria-label="Custom relationship" data-pfield="relation" data-pid="'+pid+'" value="'+esc(p.relation)+'" placeholder="Type the custom relationship"></div>';
 m+='</div>';
 m+='<div class="grid2 settings-grid-two"><div class="field"><label for="personBirthday-'+esc(pid)+'">Birthday</label><input id="personBirthday-'+esc(pid)+'" type="date" data-pfield="birthday" data-pid="'+pid+'" value="'+esc(p.birthday||"")+'"></div><div class="field"><label for="personAnniversary-'+esc(pid)+'">Anniversary</label><input id="personAnniversary-'+esc(pid)+'" type="date" data-pfield="anniversary" data-pid="'+pid+'" value="'+esc(p.anniversary||"")+'"></div></div>';
 m+='</section>';
 m+='<section class="person-settings-section"><h4 class="settings-section-title">Connection</h4><div class="settings-connection-grid">';
 m+='<div class="field connection-cadence-field"><div class="person-settings-label-row"><label for="personConnectionCadence">Connection cadence</label><span class="settings-tooltip-wrap"><button type="button" class="settings-tooltip-trigger" aria-label="About connection cadence" aria-describedby="connectionCadenceHelp"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M7.9 7.5a2.2 2.2 0 1 1 3.8 1.5c-1 .9-1.7 1.1-1.7 2.5 M10 14.3v.1"/></svg></button><span class="settings-tooltip" id="connectionCadenceHelp" role="tooltip">The Connection meter stays at 100% until this cadence is due, then loses 10 points per day without a new interaction. Tend a rhythm, complete a spark, or log a connection to reset it.</span></span></div><select id="personConnectionCadence" data-pfield="connectCadence" data-pid="'+pid+'">'+[["daily","Daily"],["twicewk","Twice weekly"],["weekly","Weekly"],["biweekly","Every 2 weeks"],["monthly","Monthly"]].map(function(o){return '<option value="'+o[0]+'"'+((p.connectCadence||"weekly")===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select></div>';
 m+='<div class="field"><div class="person-settings-label-row"><label for="personLoveLanguage-'+esc(pid)+'">Love language</label><a class="ll-quiz" href="https://5lovelanguages.com/quizzes/love-language" target="_blank" rel="noopener" aria-label="Take the Love Language quiz (opens in a new tab)" title="Take the Love Language quiz"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5h10a1.5 1.5 0 0 1 1.5 1.5v12H3.5V5A1.5 1.5 0 0 1 5 3.5Z M7 7h6 M7 10h6 M7 13h3 M6 2v3 M14 2v3"/></svg></a></div><select id="personLoveLanguage-'+esc(pid)+'" data-pfield="loveLanguage" data-pid="'+pid+'"><option value="">- not set -</option>'+Object.keys(LL_LANGUAGES).map(function(k){return '<option value="'+k+'"'+(ll===k?" selected":"")+'>'+LL_LANGUAGES[k]+'</option>';}).join("")+'</select></div>';
 m+='</div></section>';
 m+='</div></div>';
 out+=m;
 return '<div class="person-profile-page">'+header+badges+out+'</div>';}
function renderChecklists(){
 if(!S.checklists||!S.checklists.length)return "";
 var out="";
 S.checklists.forEach(function(cl){
  var done=cl.items.filter(function(i){return i.done;}).length;
  out+='<details class="card cl-card" style="margin-bottom:12px;padding:16px 20px" id="cl-'+cl.id+'"'+(checklistDraftId===cl.id?' open':'')+'><summary style="cursor:pointer;font-weight:600;font-size:15px">'+esc(cl.title)+' <span style="font-weight:400;color:var(--ink-faint);font-size:12.5px">'+done+'/'+cl.items.length+'</span></summary><ul class="tasks" style="margin-top:10px">';
  cl.items.forEach(function(it){out+='<li class="'+(it.done?"done":"")+'"><input type="checkbox" class="cb" data-clitem="'+cl.id+'|'+it.id+'"'+(it.done?" checked":"")+'><span class="txt">'+esc(it.text)+'</span><button class="del" data-cldel="'+cl.id+'|'+it.id+'">\u00D7</button></li>';});
  out+='</ul><button type="button" class="btn mini ghost" data-clopen="'+cl.id+'">+ Add item</button></details>';
  if(checklistDraftId===cl.id)out+='<dialog class="profile-editor-dialog" data-editor-modal aria-labelledby="checklist-item-title"><div class="profile-editor-body"><h3 id="checklist-item-title">Add Checklist Item</h3><label class="profile-note-type">Item<input placeholder="What needs to be done?" data-clnew="'+cl.id+'"></label><div class="profile-editor-actions"><button class="btn mini" data-cladd="'+cl.id+'">Save Item</button><button class="btn mini ghost" data-clcancel data-editor-cancel>Cancel</button></div></div></dialog>';
 });
 return out;}
/* ============ rhythm done prompt + ripples ============ */
function rhyDoneBtn(key){var ids=String(key).split("|");return '<button type="button" class="btn mini" data-tend-open="person-rhythm" data-person-id="'+esc(ids[0])+'" data-rhythm-id="'+esc(ids[1]||"")+'" title="Record a moment of care">Tend</button>';}
function connectionRhythm(e){
 var rhythm=null;
 if(e.personId){var person=S.people.find(function(item){return item.id===e.personId;});rhythm=person&&(person.rhythms||[]).find(function(item){return item.id===e.rhythmId;});}
 if(!rhythm)S.people.some(function(person){rhythm=(person.rhythms||[]).find(function(item){return item.id===e.rhythmId;});return !!rhythm;});
 if(!rhythm&&S.rhythms)rhythm=S.rhythms.find(function(item){return item.id===e.rhythmId;});
 if(!rhythm&&S.areaRhythms)rhythm=S.areaRhythms.find(function(item){return item.id===e.rhythmId;});
 return rhythm;
}
function connectionRhythmOwner(e){
var owner=null;if(e&&e.rhythmId)S.people.some(function(person){if((person.rhythms||[]).some(function(item){return item.id===e.rhythmId;})){owner=person;return true;}return false;});return owner;
}
function connectionSpark(e){
 var owner=S.people.find(function(person){return person.id===(e.sparkOwnerId||e.personId);}),spark=owner&&(owner.sparks||[]).find(function(item){return e.sparkId?item.id===e.sparkId:item.done&&item.text===e.title&&Number.isFinite(item.doneTs)&&Math.abs(item.doneTs-e.ts)<60000;});
 if(!spark&&!e.sparkId)S.people.some(function(person){var match=(person.sparks||[]).find(function(item){return item.done&&item.text===e.title&&Number.isFinite(item.doneTs)&&Math.abs(item.doneTs-e.ts)<60000;});if(match){owner=person;spark=match;return true;}return false;});
 return {owner:owner,spark:spark};
}
function connectionParticipantIds(e){
 var ids=Array.isArray(e.personIds)?e.personIds.slice():(e.personId?[e.personId]:[]);
 if(e.origin==="spark"||e.note==="Spark landed"){var sparkData=connectionSpark(e);if(sparkData.spark&&sparkData.owner)[sparkData.owner.id].concat(sparkData.spark.sharedWith||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});}
 else if(e.rhythmId&&!Array.isArray(e.personIds)){var rhythm=connectionRhythm(e);if(rhythm)(rhythm.sharedWith||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});}
 return ids.filter(function(id,index){return id&&ids.indexOf(id)===index&&S.people.some(function(person){return person.id===id;});});
}
function connectionCategoryIds(e){
 if(Array.isArray(e.areas))return e.areas;
 if(e.origin==="spark"||e.note==="Spark landed"){var sparkData=connectionSpark(e);return sparkData.spark&&Array.isArray(sparkData.spark.areas)?sparkData.spark.areas:[];}
 var rhythm=e.rhythmId&&connectionRhythm(e);return rhythm&&typeof window.tendRhythmCategoryIds==="function"?window.tendRhythmCategoryIds(rhythm):[];
}
function connectionCardLastTended(event){
 var last={ts:Number(event.ts)};
 return typeof window.tendRhythmCardLastTended==="function"?window.tendRhythmCardLastTended(last):{full:when(last.ts),label:when(last.ts)};
}
function connectionCardHTML(event,personId){
 var isSpark=event.origin==="spark"||event.note==="Spark landed",rhythm=event.rhythmId&&connectionRhythm(event);
 var title=event.rhythmId?(rhythm&&rhythm.text||event.title||"Connection"):(event.title&&event.title.indexOf("Time with")!==0?event.title.replace(/^Prayer: /,""):"Connection");
 var details=event.note&&event.note!=="Spark landed"?event.note:rhythm&&rhythm.description||"";
 var typeBadge=event.rhythmId?'<span class="pill rhy">'+collectionIcon("rhythms")+' Rhythm</span>':(isSpark?'<span class="pill spk">'+collectionIcon("sparks")+' Spark</span>':'<span class="pill touch">'+esc(typeLabel(event))+'</span>');
 var schedule= rhythm&&typeof window.tendRhythmCardMetadata==="function"?window.tendRhythmCardMetadata(rhythm):null;
 var people=connectionParticipantIds(event).filter(function(id,index,ids){return id&&id!==(personId||event.personId)&&ids.indexOf(id)===index;}).map(function(id){var person=S.people.find(function(item){return item.id===id;});return person?'<button type="button" class="prayer-person person-badge-clickable" data-personbadge="'+esc(person.id)+'|connection" aria-label="Open '+esc(person.name)+' connection">'+personAvatar(person,24)+esc(person.name)+'</button>':"";}).join("");
 var categories=people+(typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges({areas:connectionCategoryIds(event)}):"");
 var timestamp=new Date(Number(event.ts)),datetime=Number.isFinite(timestamp.getTime())?timestamp.toISOString():"",last=connectionCardLastTended(event);
 function scheduleItem(kind,value,full,narrow){
  if(!value)return "";
  var icon=kind==="frequency"?planMetaIcon("frequency"):planMetaIcon("time"),aria=kind==="frequency"?"Frequency: ":"Preferred time: ";
  return '<span class="rhythm-card__meta-item" aria-label="'+esc(aria+(full||value))+'">'+icon+'<span class="rhythm-card__meta-text"><span class="rhythm-card__meta-wide">'+esc(value)+'</span><span class="rhythm-card__meta-narrow">'+esc(narrow||value)+'</span></span></span>';
 }
 var footer=(schedule?scheduleItem("frequency",schedule.frequency.label,schedule.frequency.full,schedule.frequency.narrow)+scheduleItem("time",schedule.time.label,schedule.time.full,schedule.time.narrow):"")
  +'<span class="rhythm-card__meta-item rhythm-card__last" aria-label="'+esc(last.full||last.label)+'">'+planMetaIcon("occurred")+'<time'+(datetime?' datetime="'+datetime+'"':"")+'>'+esc(last.label||"Never")+'</time></span>';
 return '<article class="connection-card" data-connection-card="'+esc(event.id)+'"><div class="connection-card__heading rhythm-card__title-line"><strong class="tend-type-title">'+esc(title||"Connection")+'</strong><button type="button" class="rhythm-card__edit" data-evedit="'+esc(event.id)+'" aria-label="Edit '+esc(title||"Connection")+'" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8Z"/></svg></button><div class="connection-card__type">'+typeBadge+'</div></div>'+(details?'<p class="connection-card__description tend-type-description">'+esc(details)+'</p>':"")+(categories?'<div class="connection-card__associations">'+categories+'</div>':"")+'<footer class="connection-card__footer rhythm-card__meta" aria-label="Connection schedule and history">'+footer+'</footer></article>';
}
/* ============ free moment + spark chip ============ */
function sparkChip(p){var s=sortedPersonSparks(p)[0];if(!s)return "";return '<div class="pf-next" style="color:var(--forest)">\u2726 '+esc(s.text)+' \u00b7 '+esc(sparkDueTxt(s))+'</div>';}
function dashboardSparkAddedLabel(spark){
 var value=spark.createdAt||spark.createdTs||spark.addedAt||spark.dateAdded||spark.createdDate;
 if(!value)return "Added date unavailable";
 var date=null,text=String(value);
 if(typeof value==="number"||/^\d{10,13}$/.test(text)){var timestamp=Number(value);date=new Date(text.length===10?timestamp*1000:timestamp);}
 else if(/^\d{4}-\d{2}-\d{2}$/.test(text)){var parts=text.split("-").map(Number);date=new Date(parts[0],parts[1]-1,parts[2]);}
 else date=new Date(value);
 if(!Number.isFinite(date.getTime()))return "Added date unavailable";
 return "Added "+date.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function dashboardSparkDeadlineLabel(spark){
 if(!spark.by)return "Someday";
 return "Due "+sparkDueTxt(spark)+(spark.time?" · "+fmtHM12(spark.time):"");
}
function dashboardFreeMomentSparkQueue(){
 var sparks=[],seen=Object.create(null);
 S.people.forEach(function(person){sortedPersonSparks(person).forEach(function(spark){if(!sparkLive(spark))return;var key=(spark.profileOwnerId||person.id)+"|"+spark.id;if(seen[key])return;seen[key]=true;sparks.push({spark:key+"|"+person.id,personId:person.id,label:spark.text,description:spark.details||"",deadline:dashboardSparkDeadlineLabel(spark)});});});
 return sparks;
}
function personFreeMomentSparkQueue(person){
 var seen=Object.create(null);
 return sortedPersonSparks(person).filter(function(spark){var key=(spark.profileOwnerId||person.id)+"|"+spark.id;if(spark.by||!sparkLive(spark)||seen[key])return false;seen[key]=true;return true;}).map(function(spark){return {spark:(spark.profileOwnerId||person.id)+"|"+spark.id+"|"+person.id,personId:person.id,label:spark.text,description:spark.details||"",deadline:dashboardSparkDeadlineLabel(spark)};});
}
function personFreeMomentHTML(person){
 var sparkQueue=personFreeMomentSparkQueue(person),personId=person.id;
 if(!sparkQueue.length){personSparkCarouselIndexes[personId]=0;personSparkCarouselAnimating[personId]=false;return "";}
 var index=Math.max(0,Math.min(sparkQueue.length-1,personSparkCarouselIndexes[personId]||0));
 personSparkCarouselIndexes[personId]=index;
 var current=sparkQueue[index],
     action='<button type="button" class="btn mini sparkbtn" data-sparkdo="'+esc(current.spark)+'">Do it</button>',
     footerHTML='<span class="dashboard-spark-deadline">'+esc(current.deadline)+'</span>',
     card=freeMomentSparkCardHTML(current,{actionHTML:action,footerHTML:footerHTML,className:"dashboard-free-moment-card person-free-moment-card",cardAttributes:{"data-person-free-spark-card":personId}});
 return tendSectionHeaderHTML({title:"Free moment with "+person.name+"?",className:"dashboard-free-moment-heading person-free-moment-heading"})+'<div class="dashboard-free-moment dashboard-free-moment-carousel person-free-moment"><div class="dashboard-free-moment-stage">'+card+'</div><nav class="dashboard-free-moment-controls" aria-label="'+esc(person.name)+' Spark carousel"><button type="button" class="dashboard-free-moment-arrow" data-person-spark-carousel-person="'+esc(personId)+'" data-person-spark-carousel-step="-1" aria-label="Previous Spark"'+(index===0?" disabled":"")+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6 9 12 15 18"/></svg></button><span class="dashboard-spark-carousel-count" aria-live="polite">'+(index+1)+' of '+sparkQueue.length+'</span><button type="button" class="dashboard-free-moment-arrow" data-person-spark-carousel-person="'+esc(personId)+'" data-person-spark-carousel-step="1" aria-label="Next Spark"'+(index===sparkQueue.length-1?" disabled":"")+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 15 12 9 18"/></svg></button></nav></div>';
}
function freeMomentHTML(){
 var sparkQueue=dashboardFreeMomentSparkQueue();
 if(!sparkQueue.length){dashboardSparkCarouselIndex=0;dashboardSparkCarouselAnimating=false;return "";}
 dashboardSparkCarouselIndex=Math.max(0,Math.min(sparkQueue.length-1,dashboardSparkCarouselIndex));
 dashboardInitSparkCarousel();
 var current=sparkQueue[dashboardSparkCarouselIndex],
     action='<button type="button" class="btn mini sparkbtn" data-sparkdo="'+esc(current.spark)+'" data-dashboard-free-spark>Do it</button>',
     footerHTML='<span class="dashboard-spark-deadline">'+esc(current.deadline)+'</span>',
     card=freeMomentSparkCardHTML(current,{actionHTML:action,footerHTML:footerHTML,className:"dashboard-free-moment-card",cardAttributes:{"data-dashboard-free-spark-card":""}}),
     out=tendSectionHeaderHTML({title:"Free moment?",className:"dashboard-free-moment-heading"})+'<div class="dashboard-free-moment dashboard-free-moment-carousel"><div class="dashboard-free-moment-stage">'+card+'</div><nav class="dashboard-free-moment-controls" aria-label="Spark carousel"><button type="button" class="dashboard-free-moment-arrow" data-dashboard-spark-carousel-step="-1" aria-label="Previous Spark"'+(!dashboardSparkCarouselReady||dashboardSparkCarouselIndex===0?" disabled":"")+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6 9 12 15 18"/></svg></button><span class="dashboard-spark-carousel-count" aria-live="polite">'+(dashboardSparkCarouselIndex+1)+' of '+sparkQueue.length+'</span><button type="button" class="dashboard-free-moment-arrow" data-dashboard-spark-carousel-step="1" aria-label="Next Spark"'+(!dashboardSparkCarouselReady||dashboardSparkCarouselIndex===sparkQueue.length-1?" disabled":"")+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 15 12 9 18"/></svg></button></nav></div>';
 return out;
}
/* ============ area subpages ============ */
function renderArea(id){
 if(id==="health"&&typeof renderFitnessPage==="function")return renderFitnessPage();
 var v=areaScore(id),c=scoreClass(v);
 var kids=S.people.filter(function(p){return p.area===id;});
 var out=tendSectionHeaderHTML({title:S.areas[id].name,metadata:scoreLabel(v),style:"margin-top:2px"});
 out+='<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:17px;font-weight:500">Health meter</h3><span class="score '+c+'">'+v+'</span></div>'+meterBar(v,c);
 if(kids.length)out+='<div class="people-row">'+kids.map(personChip).join("")+'</div>';
 out+='</div>';
 out+='<div class="card" style="margin-bottom:14px"><div class="subhead">Tasks</div><ul class="tasks">';
 S.tasks.filter(function(t){return t.areaId===id;}).forEach(function(t){out+='<li class="'+(t.done?"done":"")+'"><input type="checkbox" class="cb" data-task="'+t.id+'"'+(t.done?" checked":"")+'><span class="txt">'+esc(t.text)+'</span><button class="del" data-taskdel="'+t.id+'">\u00D7</button></li>';});
 out+='</ul><div class="addrow"><input placeholder="Add a task..." data-tasknew="'+id+'"><button class="btn mini" data-taskadd="'+id+'">Add</button></div></div>';
 var areaActivityType=editingEvent?(editingEvent.type||editingEvent.kind||"quality"):"quality";
 if(areaActivityType==="inperson")areaActivityType="quality";
 out+='<div class="card" style="margin-bottom:14px" id="logformcard"><div class="subhead">'+(editingId?"Edit entry":"Log an activity")+'</div>'+
 '<div class="addrow" style="margin-top:0"><input type="date" id="logDate" value="'+(editingEvent?fmtDate(editingEvent.ts):fmtDate(Date.now()))+'"><select id="logPersonSel"><option value="">- person (optional) -</option>'+S.people.filter(function(p){return p.area===id;}).map(function(p){return '<option value="'+p.id+'"'+((editingEvent&&editingEvent.personId===p.id)?" selected":"")+'>'+esc(p.name)+'</option>';}).join("")+'</select><select id="logTypeSel">'+Object.keys(RIPPLE_TYPES).map(function(t){return '<option value="'+t+'"'+(areaActivityType===t?" selected":"")+'>'+RIPPLE_TYPES[t]+'</option>';}).join("")+(RIPPLE_TYPES[areaActivityType]?'':'<option value="'+esc(areaActivityType)+'" selected>'+esc(typeLabel(editingEvent))+'</option>')+'</select></div>'+
 '<div class="addrow"><input id="logTitle" placeholder="What did you do?" value="'+(editingEvent?esc(editingEvent.title||""):"")+'"></div>'+
 '<div class="addrow"><textarea id="logTalk" placeholder="What did you talk about?">'+(editingEvent?esc(editingEvent.note||""):"")+'</textarea></div>'+
 '<div style="display:flex;gap:8px"><button class="btn" id="logSubmit">'+(editingId?"Update":"Log it")+'</button>'+(editingId?'<button class="btn ghost" id="logCancel">Cancel</button>':'')+'</div></div>';
 out+='<div class="card"><div class="subhead">History</div>';
 var evs=eventsFor(id,true).sort(function(a,b){return b.ts-a.ts;});
 if(evs.length){evs.slice(0,30).forEach(function(e){
  out+='<div class="entry"><div class="entry-main"><div class="entry-head"><span class="entry-date">'+new Date(e.ts).toLocaleDateString()+'</span><span class="badge">'+typeLabel(e)+'</span>'+(e.personId?'<span class="gr-person">'+esc(personName(e.personId))+'</span>':'')+'</div>'+(e.title?'<div class="entry-title">'+esc(e.title)+'</div>':'')+(e.note?'<div class="entry-note">'+esc(e.note)+'</div>':'')+'</div><div class="entry-actions"><button class="iconbtn" data-eedit="'+e.id+'" title="edit">\u270E</button><button class="iconbtn" data-edel="'+e.id+'" title="delete">\uD83D\uDDD1</button></div></div>';
 });}else out+='<div class="empty">Nothing logged yet.</div>';
 out+='</div>';
 return out;}
function fmtDate(ts){var d=new Date(ts);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
var editingId=null,editingEvent=null,activityComposerOpen=false,taskDraftArea=null,checklistDraftId=null,echoDraftOpen=false,echoItemDraftId=null,ideaDraftOpen=false;
/* nav state */
var TODS={anytime:"Anytime",allday:"All day"};
DEFAULT_DAY_BLOCKS.forEach(function(block){Object.defineProperty(TODS,block.id,{enumerable:true,get:function(){return dayBlocks().find(function(b){return b.id===block.id;}).name;}});});
var LL_LANGUAGES={qt:"Quality Time",wa:"Words of Affirmation",as:"Acts of Service",gf:"Gifts",pt:"Physical Touch"};
var REL_OPTIONS=["Spouse","Son","Daughter","Bonus son","Bonus daughter","Son-in-law","Daughter-in-law","Father","Mother","Brother","Sister","Friend","Mentor","Coworker"];
var LL_NUDGES={qt:"time together - a walk, an errand, a shared meal - speaks louder than a text.",wa:"a specific, spoken affirmation lands deeper than any gift. Send the text. Make the call.",as:"doing a chore or errand for them preaches louder than words.",gf:"small, thoughtful gifts say 'I was thinking of you' - keep a running list.",pt:"presence in person - a hug, a hand on the shoulder - matters most."};
function personProfileShortDateLabel(label){return String(label||"").replace(/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/,function(month){return month.slice(0,3);});}
function bdayInfo(b){if(!b)return null;var parts=String(b).split("-");if(parts.length<3)return null;var m=+parts[1],d=+parts[2];if(!m||!d)return null;var t=new Date();var today=new Date(t.getFullYear(),t.getMonth(),t.getDate());var next=new Date(t.getFullYear(),m-1,d);if(next<today)next=new Date(t.getFullYear()+1,m-1,d);var du=Math.round((next-today)/86400000);var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];return {label:mos[m-1]+" "+d,days:du};}
var editingConn=null,editingFollowupId=null;
var editSparkId=null,sparkEditOwnerId=null,sparkEditDraft=null,sparkDraftOpenFor=null,noteDraftOpenFor=null;
var editRhythmId=null, rhythmEditDraft=null;
var rhythmDraft=null;
var tab="today",openDetail=null,currentArea=null,currentPerson=null,profileBadgePerson=null,rhythmPickerDraft=null;
window._actDone={};window._psModalOpen=false;

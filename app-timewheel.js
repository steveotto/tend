"use strict";

window.TimeWheelPicker = (function(){
 var ROW_HEIGHT=42, reducedMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 function parseTime(value){
  var match=String(value||"").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if(!match)return {hour:12,minute:0,period:"AM"};
  var hour=+match[1];
  return {hour:hour%12||12,minute:+match[2],period:hour<12?"AM":"PM"};
 }
 function timeString(value){
  var hour=value.hour%12+(value.period==="PM"?12:0);
  return String(hour).padStart(2,"0")+":"+String(value.minute).padStart(2,"0");
 }
 function wheelClickDirection(y,center){
  return y<center?-1:y>center?1:0;
 }
 function wheelStepIndex(index,direction,length){
  return (index+direction+length)%length;
 }
 function mount(root,options){
  options=options||{};
  var minuteStep=Math.max(1,Math.min(60,Math.floor(Number(options.minuteStep)||1))),minuteValues=[];
  for(var minute=0;minute<60;minute+=minuteStep)minuteValues.push(minute);
  var values={hour:1,minute:0,period:"AM"},wheels={},viewports={},settleTimers={},programmaticTimers={},scrollFrames={},programmatic={},pendingHaptics={},lastHapticTime=0,drag=null,pointerGesture=null,suppressClickWheel=null,suppressClickTimer=null,destroyed=false,resizeObserver=null,windowResizeHandler=null;
  var labels={hour:"Hour",minute:"Minute",period:"AM / PM"};
  var minuteShortcuts=[0,15,30,45];
  var listValues={hour:Array.from({length:12},function(_,index){return index+1;}),minute:minuteValues,period:["AM","PM"]};
  var live=document.createElement("span");live.className="time-wheel-live";live.setAttribute("aria-live","polite");live.setAttribute("aria-atomic","true");
  var markup='<div class="time-wheel-columns" role="group" aria-label="Time"><div class="time-wheel-labels">'+["hour","minute","period"].map(function(name){return '<span class="time-wheel-label">'+labels[name]+'</span>';}).join("")+'</div><div class="time-wheel-viewports">'+
   ["hour","minute","period"].map(function(name){
   return '<div class="time-wheel-viewport"><div class="time-wheel-selection-band" aria-hidden="true"></div><div class="time-wheel-column" data-wheel="'+name+'" role="spinbutton" tabindex="0" aria-label="'+labels[name]+'" aria-valuemin="'+(name==="hour"?1:name==="minute"?0:1)+'" aria-valuemax="'+(name==="hour"?12:name==="minute"?59:2)+'"><div class="time-wheel-options">'+listValues[name].map(function(value){return '<div class="time-wheel-option" data-value="'+value+'">'+(name==="period"?value:String(value).padStart(2,"0"))+'</div>';}).join("")+'</div></div></div>';
  }).join("")+'</div><div class="time-wheel-shortcut-columns"><span aria-hidden="true"></span><div class="time-wheel-shortcuts" role="group" aria-label="Minute shortcuts">'+minuteShortcuts.map(function(minute){var label=String(minute).padStart(2,"0");return '<button type="button" class="time-wheel-shortcut" data-minute="'+minute+'" aria-label="Set minutes to '+label+'" aria-pressed="false">'+label+'</button>';}).join("")+'</div><span aria-hidden="true"></span></div></div>';
  root.innerHTML=markup;
  root.appendChild(live);
  if(options.accent)root.setAttribute("data-accent",options.accent);
  root.querySelectorAll("[data-wheel]").forEach(function(wheel){
   var name=wheel.getAttribute("data-wheel");
   wheels[name]=wheel;
   viewports[name]=wheel.parentNode;
   wheel._timeWheelName=name;
   wheel.addEventListener("scroll",function(){
    if(destroyed)return;
    if(programmatic[name])return;
    if(scrollFrames[name])cancelAnimationFrame(scrollFrames[name]);
    scrollFrames[name]=requestAnimationFrame(function(){updateFromScroll(name);});
    clearTimeout(settleTimers[name]);
    settleTimers[name]=setTimeout(function(){settle(name);},160);
   },{passive:true});
   wheel.addEventListener("scrollend",function(){
    if(programmatic[name]){
     if(nearestIndex(name)!==listValues[name].indexOf(values[name]))return;
     clearTimeout(programmaticTimers[name]);programmatic[name]=false;
    }
    settle(name);
   });
   wheel.addEventListener("wheel",function(){releaseProgrammatic(name);},{passive:true});
   wheel.addEventListener("click",function(event){
    if(suppressClickWheel===wheel){suppressClickWheel=null;clearTimeout(suppressClickTimer);return;}
    if(event.detail===0)return;
    var viewport=viewports[name],bounds=viewport.getBoundingClientRect(),center=bounds.top+bounds.height/2,direction=wheelClickDirection(event.clientY,center);
    if(!direction)return;
    select(name,wheelStepIndex(listValues[name].indexOf(values[name]),direction,listValues[name].length),true,true);
    wheel.focus({preventScroll:true});
   });
   wheel.addEventListener("keydown",function(event){
    var current=listValues[name].indexOf(values[name]);
    if(event.key==="ArrowUp"||event.key==="ArrowDown"||event.key==="PageUp"||event.key==="PageDown"){
     event.preventDefault();
     var direction=event.key==="ArrowUp"||event.key==="PageUp"?-1:1,amount=event.key.indexOf("Page")===0?5:1;
     select(name,current+direction*amount,true,true);
    }else if(event.key==="Home"){event.preventDefault();select(name,0,true,true);}
    else if(event.key==="End"){event.preventDefault();select(name,listValues[name].length-1,true,true);}
   });
   wheel.addEventListener("pointerdown",function(event){
    if(!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
    pointerGesture={wheel:wheel,pointerId:event.pointerId,startY:event.clientY,startTop:wheel.scrollTop,moved:false};
    if(event.pointerType==="mouse"){
     drag={wheel:wheel,startY:event.clientY,startTop:wheel.scrollTop,moved:false};
     wheel.setPointerCapture(event.pointerId);
    }
   });
   wheel.addEventListener("pointermove",function(event){
    if(pointerGesture&&pointerGesture.wheel===wheel&&pointerGesture.pointerId===event.pointerId&&Math.abs(event.clientY-pointerGesture.startY)>5){pointerGesture.moved=true;releaseProgrammatic(name);}
    if(!drag||drag.wheel!==wheel)return;
    var distance=event.clientY-drag.startY;
    if(Math.abs(distance)>4){drag.moved=true;releaseProgrammatic(name);}
    if(drag.moved){wheel.scrollTop=drag.startTop-distance;event.preventDefault();}
   });
   ["pointerup","pointercancel","lostpointercapture"].forEach(function(type){
    wheel.addEventListener(type,function(event){
     if(pointerGesture&&pointerGesture.wheel===wheel&&pointerGesture.pointerId===event.pointerId){
      if(pointerGesture.moved||Math.abs(wheel.scrollTop-pointerGesture.startTop)>5){
       suppressClickWheel=wheel;clearTimeout(suppressClickTimer);
       suppressClickTimer=setTimeout(function(){if(suppressClickWheel===wheel)suppressClickWheel=null;},250);
      }
      pointerGesture=null;
     }
     if(drag&&drag.wheel===wheel){drag=null;}
    });
   });
  });
  root.querySelectorAll(".time-wheel-shortcut").forEach(function(button){
   button.addEventListener("click",function(){
    var minute=Number(button.getAttribute("data-minute")),index=listValues.minute.indexOf(minute);
    if(index>=0)select("minute",index,true,true);
   });
  });
  function announce(){
   live.textContent="Selected time "+timeString(values)+" "+values.period;
  }
  function emit(previous){
   var next=timeString(values);
   if(previous===next)return;
   if(typeof options.onChange==="function")options.onChange(next);
   clearTimeout(settleTimers.announce);
   settleTimers.announce=setTimeout(announce,180);
  }
  function updateVisual(name){
   var wheel=wheels[name],selected=values[name],index=listValues[name].indexOf(selected);
   wheel.querySelectorAll(".time-wheel-option").forEach(function(option,optionIndex){var optionValue=name==="period"?option.getAttribute("data-value"):Number(option.getAttribute("data-value"));option.setAttribute("data-selected",String(optionValue===selected));option.setAttribute("data-distance",String(Math.abs(index-optionIndex)));});
   if(name==="minute")root.querySelectorAll(".time-wheel-shortcut").forEach(function(button){
    var isSelected=Number(button.getAttribute("data-minute"))===selected;
    button.setAttribute("aria-pressed",String(isSelected));
    button.setAttribute("data-selected",String(isSelected));
   });
  }
  function updateAria(name){
   var wheel=wheels[name],selected=values[name],index=listValues[name].indexOf(selected);
   wheel.setAttribute("aria-valuenow",String(name==="period"?index+1:selected));
   wheel.setAttribute("aria-valuetext",name==="period"?selected:name==="hour"?String(selected):String(selected).padStart(2,"0"));
   updateVisual(name);
  }
  function nearestIndex(name){
   var wheel=wheels[name],viewport=viewports[name],list=listValues[name];
   if(!wheel||!viewport||!viewport.clientHeight)return list.indexOf(values[name]);
   var center=viewport.getBoundingClientRect().top+viewport.clientHeight/2,nearest=0,distance=Infinity;
   wheel.querySelectorAll(".time-wheel-option").forEach(function(option,index){
    var rect=option.getBoundingClientRect(),optionCenter=rect.top+rect.height/2,nextDistance=Math.abs(optionCenter-center);
    if(nextDistance<distance){distance=nextDistance;nearest=index;}
   });
   return nearest;
  }
  function updateFromScroll(name){
   var list=listValues[name],index=nearestIndex(name),selected=list[index];
   if(selected===values[name])return;
   var previous=timeString(values);
   values[name]=selected;updateAria(name);pendingHaptics[name]=true;emit(previous);
  }
  function centerOption(name,index,behavior){
   var viewport=viewports[name],wheel=wheels[name],option=wheel.querySelectorAll(".time-wheel-option")[index];
   if(!viewport||!viewport.clientHeight||!option)return false;
   var viewportRect=viewport.getBoundingClientRect(),optionRect=option.getBoundingClientRect(),delta=optionRect.top+optionRect.height/2-(viewportRect.top+viewport.clientHeight/2);
   if(Math.abs(delta)>0.5)wheel.scrollTo({top:wheel.scrollTop+delta,behavior:behavior||"auto"});
   return true;
  }
  function refresh(){
   if(destroyed)return;
   Object.keys(wheels).forEach(function(name){
    var viewport=viewports[name],wheel=wheels[name],height=viewport.clientHeight;
    if(!height)return;
    var edge=Math.max(0,(height-ROW_HEIGHT)/2);
    wheel.querySelector(".time-wheel-options").style.paddingBlock=edge+"px";
    centerOption(name,listValues[name].indexOf(values[name]),"auto");
   });
  }
  function settle(name){
   if(destroyed||!wheels[name])return;
   if(programmatic[name])return;
   clearTimeout(settleTimers[name]);
   updateFromScroll(name);
   updateAria(name);
   centerOption(name,listValues[name].indexOf(values[name]),"auto");
   if(pendingHaptics[name]&&typeof options.onHaptic==="function"&&!reducedMotion){options.onHaptic();pendingHaptics[name]=false;}
   else if(pendingHaptics[name]&&!reducedMotion&&navigator.vibrate&&Date.now()-lastHapticTime>80){navigator.vibrate(5);lastHapticTime=Date.now();pendingHaptics[name]=false;}
   else pendingHaptics[name]=false;
   announce();
  }
  function releaseProgrammatic(name){
   if(!programmatic[name])return;
   clearTimeout(programmaticTimers[name]);
   programmatic[name]=false;
  }
  function select(name,index,smooth,fromUser){
   var list=listValues[name];
   index=(index%list.length+list.length)%list.length;
   var previous=timeString(values);
   values[name]=list[index];updateAria(name);
   var animate=smooth&&!reducedMotion;
   clearTimeout(settleTimers[name]);clearTimeout(programmaticTimers[name]);
   programmatic[name]=animate||fromUser;
   centerOption(name,index,animate?"smooth":"auto");
   if(programmatic[name]){
    var settleAttempts=0,finishProgrammatic=function(){
     centerOption(name,listValues[name].indexOf(values[name]),"auto");
     if(nearestIndex(name)!==listValues[name].indexOf(values[name])&&settleAttempts<8){
      settleAttempts++;
      programmaticTimers[name]=setTimeout(finishProgrammatic,50);
      return;
     }
     if(nearestIndex(name)!==listValues[name].indexOf(values[name]))return;
     programmatic[name]=false;
     settle(name);
    };
    programmaticTimers[name]=setTimeout(finishProgrammatic,400);
   }else{
    programmatic[name]=false;
    if(fromUser)settleTimers[name]=setTimeout(function(){settle(name);},0);
   }
   if(fromUser&&previous!==timeString(values))pendingHaptics[name]=true;
   emit(previous);
  }
  function setValue(value){
   var parsed=parseTime(value);
   values.hour=parsed.hour;values.minute=minuteValues.reduce(function(closest,item){return Math.abs(item-parsed.minute)<Math.abs(closest-parsed.minute)?item:closest;},minuteValues[0]);values.period=parsed.period;
   Object.keys(values).forEach(function(name){updateAria(name);});
   announce();
   refresh();
  }
  if(typeof ResizeObserver==="function"){
   resizeObserver=new ResizeObserver(refresh);
   Object.keys(viewports).forEach(function(name){resizeObserver.observe(viewports[name]);});
  }else if(typeof window!=="undefined"&&window.addEventListener){
   windowResizeHandler=refresh;window.addEventListener("resize",windowResizeHandler);
  }
  setValue(options.value||"12:00");
  requestAnimationFrame(refresh);
  return {
   getValue:function(){Object.keys(values).forEach(function(name){if(!programmatic[name])updateFromScroll(name);updateAria(name);});return timeString(values);},
   setValue:setValue,
   refresh:refresh,
   destroy:function(){destroyed=true;if(resizeObserver)resizeObserver.disconnect();if(windowResizeHandler)window.removeEventListener("resize",windowResizeHandler);clearTimeout(suppressClickTimer);Object.keys(settleTimers).forEach(function(key){clearTimeout(settleTimers[key]);});Object.keys(programmaticTimers).forEach(function(key){clearTimeout(programmaticTimers[key]);});Object.keys(scrollFrames).forEach(function(key){cancelAnimationFrame(scrollFrames[key]);});root.innerHTML="";}
  };
 }
 return {mount:mount};
})();

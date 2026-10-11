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
 function mount(root,options){
  options=options||{};
  var minuteStep=Math.max(1,Math.min(60,Math.floor(Number(options.minuteStep)||1))),minuteValues=[];
  for(var minute=0;minute<60;minute+=minuteStep)minuteValues.push(minute);
  var values={hour:1,minute:0,period:"AM"},wheels={},settleTimers={},scrollFrames={},pendingHaptics={},lastHapticTime=0,drag=null,suppressClick=false,destroyed=false;
  var labels={hour:"Hour",minute:"Minute",period:"AM / PM"};
  var listValues={hour:Array.from({length:12},function(_,index){return index+1;}),minute:minuteValues,period:["AM","PM"]};
  var live=document.createElement("span");live.className="time-wheel-live";live.setAttribute("aria-live","polite");live.setAttribute("aria-atomic","true");
  var markup='<div class="time-wheel-columns" role="group" aria-label="Time">'+["hour","minute","period"].map(function(name){
   return '<div class="time-wheel-column-wrap"><span class="time-wheel-label">'+labels[name]+'</span><div class="time-wheel-column" data-wheel="'+name+'" role="spinbutton" tabindex="0" aria-label="'+labels[name]+'" aria-valuemin="'+(name==="hour"?1:name==="minute"?0:1)+'" aria-valuemax="'+(name==="hour"?12:name==="minute"?59:2)+'"><div class="time-wheel-options">'+listValues[name].map(function(value){return '<div class="time-wheel-option" data-value="'+value+'">'+(name==="period"?value:String(value).padStart(2,"0"))+'</div>';}).join("")+'</div></div></div>';
  }).join("")+'</div>';
  root.innerHTML=markup;
  root.appendChild(live);
  if(options.accent)root.setAttribute("data-accent",options.accent);
  root.querySelectorAll("[data-wheel]").forEach(function(wheel){
   var name=wheel.getAttribute("data-wheel");
   wheels[name]=wheel;
   wheel._timeWheelName=name;
   wheel.addEventListener("scroll",function(){
    if(destroyed)return;
    if(scrollFrames[name])cancelAnimationFrame(scrollFrames[name]);
    scrollFrames[name]=requestAnimationFrame(function(){updateFromScroll(name,true);});
    clearTimeout(settleTimers[name]);
    settleTimers[name]=setTimeout(function(){settle(name);},160);
   },{passive:true});
   wheel.addEventListener("scrollend",function(){settle(name);});
   wheel.addEventListener("click",function(event){
    if(suppressClick){suppressClick=false;return;}
    var option=event.target.closest&&event.target.closest(".time-wheel-option");
    if(!option)return;
    var clickedValue=name==="period"?option.getAttribute("data-value"):Number(option.getAttribute("data-value"));
    select(name,listValues[name].indexOf(clickedValue),true,true);
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
    if(event.pointerType!=="mouse"||event.button!==0)return;
    drag={wheel:wheel,startY:event.clientY,startTop:wheel.scrollTop,moved:false};
    wheel.setPointerCapture(event.pointerId);
   });
   wheel.addEventListener("pointermove",function(event){
    if(!drag||drag.wheel!==wheel)return;
    var distance=event.clientY-drag.startY;
    if(Math.abs(distance)>4)drag.moved=true;
    if(drag.moved){wheel.scrollTop=drag.startTop-distance;event.preventDefault();}
   });
   ["pointerup","pointercancel","lostpointercapture"].forEach(function(type){
    wheel.addEventListener(type,function(){
     if(!drag||drag.wheel!==wheel)return;
     suppressClick=drag.moved;drag=null;
     if(suppressClick)setTimeout(function(){suppressClick=false;},0);
    });
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
  }
  function updateAria(name){
   var wheel=wheels[name],selected=values[name],index=listValues[name].indexOf(selected);
   wheel.setAttribute("aria-valuenow",String(name==="period"?index+1:selected));
   wheel.setAttribute("aria-valuetext",name==="period"?selected:String(selected));
   updateVisual(name);
  }
  function updateFromScroll(name,deferAria){
   var wheel=wheels[name],list=listValues[name],index=Math.max(0,Math.min(list.length-1,Math.round(wheel.scrollTop/ROW_HEIGHT))),selected=list[index];
   if(selected===values[name])return;
   var previous=timeString(values);
   values[name]=selected;if(deferAria)updateVisual(name);else updateAria(name);pendingHaptics[name]=true;emit(previous);
  }
  function settle(name){
   if(destroyed||!wheels[name])return;
   clearTimeout(settleTimers[name]);
   updateFromScroll(name);
   updateAria(name);
   var wheel=wheels[name],index=listValues[name].indexOf(values[name]),top=index*ROW_HEIGHT;
   if(Math.abs(wheel.scrollTop-top)>1)wheel.scrollTo({top:top,behavior:reducedMotion?"auto":"smooth"});
   if(pendingHaptics[name]&&typeof options.onHaptic==="function"&&!reducedMotion){options.onHaptic();pendingHaptics[name]=false;}
   else if(pendingHaptics[name]&&!reducedMotion&&navigator.vibrate&&Date.now()-lastHapticTime>80){navigator.vibrate(5);lastHapticTime=Date.now();pendingHaptics[name]=false;}
   else pendingHaptics[name]=false;
   announce();
  }
  function select(name,index,smooth,fromUser){
   var list=listValues[name];
   index=(index%list.length+list.length)%list.length;
   var previous=timeString(values);
   values[name]=list[index];updateAria(name);
   wheels[name].scrollTo({top:index*ROW_HEIGHT,behavior:smooth&&!reducedMotion?"smooth":"auto"});
   if(fromUser&&previous!==timeString(values))pendingHaptics[name]=true;
   emit(previous);
   if(fromUser){clearTimeout(settleTimers[name]);settleTimers[name]=setTimeout(function(){settle(name);},160);}
  }
  function setValue(value){
   var parsed=parseTime(value);
   values.hour=parsed.hour;values.minute=minuteValues.reduce(function(closest,item){return Math.abs(item-parsed.minute)<Math.abs(closest-parsed.minute)?item:closest;},minuteValues[0]);values.period=parsed.period;
   Object.keys(values).forEach(function(name){updateAria(name);wheels[name].scrollTop=listValues[name].indexOf(values[name])*ROW_HEIGHT;});
   announce();
   requestAnimationFrame(function(){if(!destroyed)Object.keys(values).forEach(function(name){wheels[name].scrollTop=listValues[name].indexOf(values[name])*ROW_HEIGHT;});});
  }
  setValue(options.value||"12:00");
  return {
   getValue:function(){return timeString(values);},
   setValue:setValue,
   destroy:function(){destroyed=true;Object.keys(settleTimers).forEach(function(key){clearTimeout(settleTimers[key]);});Object.keys(scrollFrames).forEach(function(key){cancelAnimationFrame(scrollFrames[key]);});root.innerHTML="";}
  };
 }
 return {mount:mount};
})();

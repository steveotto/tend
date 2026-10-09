"use strict";

var nowWeather={status:"idle",position:null,report:null,requestId:0};
function weatherIcon(code,isDay){
 if(code===0)return isDay
  ?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
  :'<path d="M19.5 15.5A8 8 0 0 1 8.5 4.5 8.5 8.5 0 1 0 19.5 15.5Z"/><path d="m17 3 .5 1.5L19 5l-1.5.5L17 7l-.5-1.5L15 5l1.5-.5L17 3Z"/>';
 if(code===1||code===2)return '<path d="M20 16.2a4.1 4.1 0 0 0-1.7-7.8A6.3 6.3 0 0 0 6 9.8a3.5 3.5 0 0 0 .5 7h13.1Z"/><path d="M15 3v2m4 0 1.4-1.4"/>';
 if(code===3||code===45||code===48)return '<path d="M20 16.2a4.1 4.1 0 0 0-1.7-7.8A6.3 6.3 0 0 0 6 9.8a3.5 3.5 0 0 0 .5 7h13.1Z"/>'+(code>=45?'<path d="M5 20h14M8 22h8"/>':'');
 if(code>=51&&code<=67||code>=80&&code<=82)return '<path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z"/><path d="m9 19-1 2m6-2-1 2m6-2-1 2"/>';
 if(code>=71&&code<=77||code>=85&&code<=86)return '<path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z"/><path d="M7 19v4m-2-2h4m3-2v4m-2-2h4m3-2v4m-2-2h4"/>';
 if(code>=95)return '<path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z"/><path d="m13 17-3 4h3l-1 3 4-5h-3l1-2Z"/>';
 return '<circle cx="12" cy="12" r="4"/>';
}
function weatherDescription(code,isDay){
 if(code===0)return isDay?"Clear":"Clear night";
 if(code===1)return "Mostly clear";
 if(code===2)return "Partly cloudy";
 if(code===3)return "Cloudy";
 if(code===45||code===48)return "Fog";
 if(code>=51&&code<=57)return "Drizzle";
 if(code>=61&&code<=67||code>=80&&code<=82)return "Rain";
 if(code>=71&&code<=77||code>=85&&code<=86)return "Snow";
 if(code>=95)return "Thunderstorms";
 return "Current weather";
}
function weatherTheme(code,isDay){
 if(!isDay)return "night";
 if(code===0)return "sunny";
 if(code===1)return "clear";
 if(code===2)return "partly";
 if(code===3||code===45||code===48)return "cloudy";
 if(code>=51&&code<=67||code>=80&&code<=82)return "rain";
 if(code>=71&&code<=77||code>=85&&code<=86)return "snow";
 if(code>=95)return "storm";
 return "partly";
}
function weatherCardHTML(report){
 var description=report.description||weatherDescription(report.code,report.isDay);
 return '<span class="weather-card '+weatherTheme(report.code,report.isDay)+'" role="img" aria-label="'+esc(description)+', '+Math.round(report.temperature)+' degrees"><svg viewBox="0 0 24 24" aria-hidden="true">'+weatherIcon(report.code,report.isDay)+'</svg><span class="weather-card-reading"><strong>'+Math.round(report.temperature)+'<sup>°</sup></strong><span>'+esc(description)+'</span></span></span>';
}
function weatherPromptHTML(){
 var label=nowWeather.status==="loading"?"Loading weather":nowWeather.status==="error"?"Weather unavailable":"Weather";
 return '<button type="button" class="weather-card weather-card-prompt" data-weather-retry'+(nowWeather.status==="loading"?' disabled':'')+'><span class="now-weather-prompt-icon" aria-hidden="true">☼</span><span>'+label+(nowWeather.status==="error"?' · Retry':'')+'</span></button>';
}
function nowWeatherHTML(){
 if(nowWeather.status==="ready"&&nowWeather.report){
  return weatherCardHTML(nowWeather.report);
 }
 return nowWeather.status==="error"?weatherPromptHTML():"";
}
function renderNowWeather(){
 var widget=document.getElementById("nowWeather");
 if(widget){var time=widget.getAttribute("data-plan-weather-time");widget.innerHTML=time?planWeatherHTML(time):nowWeatherHTML();widget.closest(".current-plan-summary").classList.toggle("has-weather",!!widget.innerHTML);}
 renderPlanWeather();
}
function weatherForTime(time){
 var hours=nowWeather.report&&nowWeather.report.hours;
 if(!hours||!hours.length)return null;
 var parts=(time||"").split(":");
 if(parts.length!==2)return null;
 var targetMinutes=+parts[0]*60+(+parts[1]),best=null,bestDistance=Infinity;
 hours.forEach(function(hour){
  if(hour.date!==nowWeather.report.localDate)return;
  var distance=Math.abs(hour.minutes-targetMinutes);
  if(distance<bestDistance||(distance===bestDistance&&hour.minutes>=targetMinutes)){best=hour;bestDistance=distance;}
 });
 if(!best||bestDistance>60)return null;
 return best;
}
function planWeatherHTML(time){
 if(nowWeather.status==="idle"||nowWeather.status==="loading")return "";
 var forecast=weatherForTime(time);
 if(!forecast)return nowWeather.status==="error"?weatherPromptHTML():"";
 return weatherCardHTML(forecast);
}
function renderPlanWeather(){
 document.querySelectorAll("[data-plan-weather]").forEach(function(widget){
  widget.innerHTML=planWeatherHTML(widget.getAttribute("data-plan-weather"));
 });
}
function loadNowWeather(){
 var widget=document.getElementById("nowWeather");
 if(!widget)return;
 if(nowWeather.status==="ready"&&Date.now()-nowWeather.report.fetchedAt<900000){renderNowWeather();return;}
 if(nowWeather.status==="error"){renderNowWeather();return;}
 if(nowWeather.status==="loading")return;
 nowWeather.status="loading";nowWeather.requestId++;var requestId=nowWeather.requestId;renderNowWeather();
 function fetchWeather(latitude,longitude,allowFallback){
  var url="https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(latitude)+"&longitude="+encodeURIComponent(longitude)+"&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=auto";
  fetch(url).then(function(response){
   if(!response.ok)throw new Error("Weather service returned "+response.status);
   return response.json();
  }).then(function(data){
   if(requestId!==nowWeather.requestId)return;
   if(!data.current||!Number.isFinite(data.current.temperature_2m)||!Number.isFinite(data.current.weather_code))throw new Error("Weather service returned incomplete data");
   var hourly=data.hourly&&Array.isArray(data.hourly.time)&&Array.isArray(data.hourly.temperature_2m)&&Array.isArray(data.hourly.weather_code)&&Array.isArray(data.hourly.is_day)?data.hourly.time.map(function(time,index){return {date:time.slice(0,10),minutes:+time.slice(11,13)*60+(+time.slice(14,16)),temperature:data.hourly.temperature_2m[index],code:data.hourly.weather_code[index],isDay:!!data.hourly.is_day[index]};}).filter(function(hour){return Number.isFinite(hour.minutes)&&Number.isFinite(hour.temperature)&&Number.isFinite(hour.code);}):[];
   nowWeather.report={temperature:data.current.temperature_2m,code:data.current.weather_code,isDay:!!data.current.is_day,description:weatherDescription(data.current.weather_code,!!data.current.is_day),localDate:String(data.current.time||"").slice(0,10),hours:hourly,fetchedAt:Date.now()};
   nowWeather.status="ready";renderNowWeather();
  }).catch(function(error){
   if(requestId!==nowWeather.requestId)return;
   if(allowFallback){console.warn("Could not load weather for the current location; trying the fallback location:",error);loadWeatherFallback(requestId);}
   else{console.error("Could not load current weather:",error);nowWeather.status="error";renderNowWeather();}
  });
 }
 function loadWeatherFallback(id){
  var fallback=String(settings().weatherFallbackLocation||"").trim();
  if(!fallback){nowWeather.status="error";renderNowWeather();return;}
  var geocodeUrl="https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(fallback)+"&count=1&language=en&format=json";
  fetch(geocodeUrl).then(function(response){if(!response.ok)throw new Error("Location search returned "+response.status);return response.json();}).then(function(data){
   if(id!==nowWeather.requestId)return;
   var place=data.results&&data.results[0];
   if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))throw new Error("No matching location found for "+fallback);
   fetchWeather(place.latitude,place.longitude,false);
  }).catch(function(error){
   if(id!==nowWeather.requestId)return;
   console.error("Could not load weather for fallback location "+fallback+":",error);nowWeather.status="error";renderNowWeather();
  });
 }
 function useFallback(error){
  if(error)console.warn("Weather location is unavailable:",error.message);
  loadWeatherFallback(requestId);
 }
 if(nowWeather.position){fetchWeather(nowWeather.position.coords.latitude,nowWeather.position.coords.longitude,true);return;}
 if(!navigator.geolocation){useFallback(new Error("Location access is unavailable in this browser"));return;}
 try{
  navigator.geolocation.getCurrentPosition(function(position){
   if(requestId!==nowWeather.requestId)return;
   nowWeather.position=position;fetchWeather(position.coords.latitude,position.coords.longitude,true);
  },useFallback,{enableHighAccuracy:false,maximumAge:900000,timeout:10000});
 }catch(error){useFallback(error);}
}
document.addEventListener("click",function(event){
 if(event.target.closest("[data-weather-retry]")){nowWeather.status="idle";nowWeather.report=null;loadNowWeather();}
});

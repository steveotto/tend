"use strict";

var nowWeather={status:"idle",position:null,report:null};
function weatherIcon(code,isDay){
 if(code===0)return isDay
  ?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
  :'<path d="M19.5 15.5A8 8 0 0 1 8.5 4.5 8.5 8.5 0 1 0 19.5 15.5Z"/><path d="m17 3 .5 1.5L19 5l-1.5.5L17 7l-.5-1.5L15 5l1.5-.5L17 3Z"/>';
 if(code===1||code===2)return '<path d="M20 16.2a4.1 4.1 0 0 0-1.7-7.8A6.3 6.3 0 0 0 6 9.8a3.5 3.5 0 0 0 .5 7h13.1Z"/><path d="M15 3v2m4 0 1.4-1.4"/>';
 if(code===3||code===45||code===48)return '<path d="M20 16.2a4.1 4.1 0 0 0-1.7-7.8A6.3 6.3 0 0 0 6 9.8a3.5 3.5 0 0 0 .5 7h13.1Z"/>'+(code>=45?'<path d="M5 20h14M8 22h8"/>':'');
 if(code>=51&&code<=67||code>=80&&code<=82)return '<path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z"/><path d="m9 19-1 2m6-2-1 2m6-2-1 2"/>';
 if(code>=71&&code<=77||code>=85)return '<path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z"/><path d="M9 19v2m6-2v2m-3 1v1"/>';
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
 if(code===0)return isDay?"clear":"night";
 if(code===1||code===2)return "partly";
 if(code===3||code===45||code===48)return "cloudy";
 if(code>=51&&code<=67||code>=80&&code<=82)return "rain";
 if(code>=71&&code<=77||code>=85&&code<=86)return "snow";
 if(code>=95)return "storm";
 return "partly";
}
function nowWeatherHTML(){
 if(nowWeather.status==="ready"&&nowWeather.report){
  var current=nowWeather.report;
  return '<div class="now-weather '+weatherTheme(current.code,current.isDay)+'" role="img" aria-label="'+esc(current.description)+', '+Math.round(current.temperature)+' degrees"><svg viewBox="0 0 24 24" aria-hidden="true">'+weatherIcon(current.code,current.isDay)+'</svg><div class="now-weather-reading"><strong>'+Math.round(current.temperature)+'°</strong><span>'+esc(current.description)+'</span></div></div>';
 }
 var label=nowWeather.status==="loading"?"Loading weather":nowWeather.status==="error"?"Weather unavailable":"Weather";
 return '<button type="button" class="now-weather now-weather-prompt" data-weather-retry'+(nowWeather.status==="loading"?' disabled':'')+'><span class="now-weather-prompt-icon" aria-hidden="true">☼</span><span>'+label+(nowWeather.status==="error"?' · Retry':'')+'</span></button>';
}
function renderNowWeather(){
 var widget=document.getElementById("nowWeather");
 if(widget)widget.innerHTML=nowWeatherHTML();
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
 var forecast=weatherForTime(time);
 if(!forecast)return "";
 var description=weatherDescription(forecast.code,forecast.isDay);
 return '<span class="plan-weather '+weatherTheme(forecast.code,forecast.isDay)+'" role="img" aria-label="'+esc(description)+', '+Math.round(forecast.temperature)+' degrees"><svg viewBox="0 0 24 24" aria-hidden="true">'+weatherIcon(forecast.code,forecast.isDay)+'</svg><strong>'+Math.round(forecast.temperature)+'°</strong><span>'+esc(description)+'</span></span>';
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
 if(!navigator.geolocation){nowWeather.status="error";renderNowWeather();return;}
 nowWeather.status="loading";renderNowWeather();
 function fetchWeather(position){
  nowWeather.position=position;
  var latitude=position.coords.latitude,longitude=position.coords.longitude;
  var url="https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(latitude)+"&longitude="+encodeURIComponent(longitude)+"&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=auto";
  fetch(url).then(function(response){
   if(!response.ok)throw new Error("Weather service returned "+response.status);
   return response.json();
  }).then(function(data){
   if(!data.current||!Number.isFinite(data.current.temperature_2m)||!Number.isFinite(data.current.weather_code))throw new Error("Weather service returned incomplete data");
   var hourly=data.hourly&&Array.isArray(data.hourly.time)&&Array.isArray(data.hourly.temperature_2m)&&Array.isArray(data.hourly.weather_code)&&Array.isArray(data.hourly.is_day)?data.hourly.time.map(function(time,index){return {date:time.slice(0,10),minutes:+time.slice(11,13)*60+(+time.slice(14,16)),temperature:data.hourly.temperature_2m[index],code:data.hourly.weather_code[index],isDay:!!data.hourly.is_day[index]};}).filter(function(hour){return Number.isFinite(hour.minutes)&&Number.isFinite(hour.temperature)&&Number.isFinite(hour.code);}):[];
   nowWeather.report={temperature:data.current.temperature_2m,code:data.current.weather_code,isDay:!!data.current.is_day,description:weatherDescription(data.current.weather_code,!!data.current.is_day),localDate:String(data.current.time||"").slice(0,10),hours:hourly,fetchedAt:Date.now()};
   nowWeather.status="ready";renderNowWeather();
  }).catch(function(error){
   console.error("Could not load current weather:",error);
   nowWeather.status="error";renderNowWeather();
  });
 }
 if(nowWeather.position){fetchWeather(nowWeather.position);return;}
 navigator.geolocation.getCurrentPosition(fetchWeather,function(error){
  console.warn("Weather location is unavailable:",error.message);
  nowWeather.status="error";renderNowWeather();
 },{enableHighAccuracy:false,maximumAge:900000,timeout:10000});
}
document.addEventListener("click",function(event){
 if(event.target.closest("[data-weather-retry]")){nowWeather.status="idle";loadNowWeather();}
});

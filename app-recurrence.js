"use strict";
/* app-recurrence.js - flexible recurrence engine + editor for rhythm schedules.
   Rule shape (stored on rhythm as r.rule; legacy rhythms without .rule are
   translated from freq/scheduleDow/customType/customDow/customOrd):
   { freq:"daily"|"weekly"|"monthly"|"quarterly"|"yearly"|"custom",
     days:[0..6],                     // weekly (+ custom weeks)
     mode:"date"|"weekday",           // monthly/quarterly/yearly/custom-months|years
     dom:1..31|"last",                // date-of-month mode
     weeks:[1,2,3,4,-1], dow:0..6,    // weekday pattern mode
     month:0..11,                     // yearly month (or month-in-quarter offset for quarterly)
     every:N, unit:"days"|"weeks"|"months"|"years", // custom
     start:"YYYY-MM-DD", end:null|"YYYY-MM-DD" }
   Overlay: safe to delete; falls back to legacy scheduling. */
function recNormRule(r){
 var rule=(r&&typeof r.rule==="object"&&r.rule)?JSON.parse(JSON.stringify(r.rule)):null;
 if(!rule){
  rule={freq:(r&&r.freq)||"weekly",start:(r&&r.start)||(r&&r.added)||null,end:null};
  var f=rule.freq;
  if(f==="weekly"){rule.days=[(r&&r.scheduleDow!=null)?+r.scheduleDow:1];}
  else if(f==="custom"){var ct=(r&&r.customType)||"weekly";if(ct==="weekly"){rule.freq="weekly";rule.days=[(r&&r.customDow!=null)?+r.customDow:1];}
   else if(ct==="monthly"){rule.freq="monthly";rule.mode="weekday";rule.weeks=[(r&&r.customOrd)||1];rule.dow=(r&&r.customDow)!=null?+r.customDow:5;}
   else{rule.freq="monthly";rule.mode="date";rule.dom=15;}}
  else if(f==="monthly"){rule.mode="date";rule.dom=1;}
  else if(f==="quarterly"){rule.mode="date";rule.dom=1;rule.month=0;}
  else if(f==="yearly"){rule.mode="date";rule.dom=1;rule.month=0;}
 }
 if(!rule.days)rule.days=[1];
 if(rule.freq==="weekly"&&!rule.days.length)rule.days=[1];
 return rule;
}
function recD2(d){return d.toISOString().slice(0,10);}
function recParse(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2]);}
function recDaysIn(y,m){return new Date(y,m+1,0).getDate();}
function recWOM(d){return Math.floor((d-1)/7)+1;}
function recIsLast(d,y,m){return d+7>recDaysIn(y,m);}
function recOccursOn(rule,dateStr){
 var dt=recParse(dateStr),y=dt.getFullYear(),m=dt.getMonth(),d=dt.getDate(),dow=dt.getDay();
 if(rule.end){if(dateStr>rule.end)return false;}
 if(rule.start){if(dateStr<rule.start)return false;}
 var f=rule.freq;
 if(f==="daily")return true;
 if(f==="weekly")return rule.days.indexOf(dow)>=0;
 if(f==="monthly")return recMonthHit(rule,y,m,d,dow)&&d<=recDaysIn(y,m)&&recDomHit(rule,y,m,d);
 if(f==="quarterly"){if(m%3!==(rule.month||0))return false;return recMonthHit(rule,y,m,d,dow)&&recDomHit(rule,y,m,d);}
 if(f==="yearly"){if(m!==(rule.month||0))return false;return recMonthHit(rule,y,m,d,dow)&&recDomHit(rule,y,m,d);}
 if(f==="custom"){
  var ev=Math.max(1,rule.every||1),u=rule.unit||"days",st=rule.start?recParse(rule.start):null;
  if(!st)return true;
  if(u==="days"){var dd=Math.round((dt-st)/864e5);return dd>=0&&dd%ev===0;}
  if(u==="weeks"){var ws=st.getDate()-st.getDay();var s0=new Date(st.getFullYear(),st.getMonth(),ws);var wd=dt.getDate()-dow;var w0=new Date(y,m,wd);var wk=Math.round((w0-s0)/6048e5);return wk>=0&&wk%ev===0&&rule.days.indexOf(dow)>=0;}
  if(u==="months"){var md=(y-st.getFullYear())*12+(m-st.getMonth());return md>=0&&md%ev===0&&recMonthHit(rule,y,m,d,dow)&&recDomHit(rule,y,m,d);}
  if(u==="years"){var yd=y-st.getFullYear();return yd>=0&&yd%ev===0&&m===(rule.month||0)&&recMonthHit(rule,y,m,d,dow)&&recDomHit(rule,y,m,d);}
 }
 return false;
}
function recDomHit(rule,y,m,d){
 if(rule.mode!=="date")return true;
 if(rule.dom==="last")return d===recDaysIn(y,m);
 return d===rule.dom&&d<=recDaysIn(y,m);
}
function recMonthHit(rule,y,m,d,dow){
 if(!rule.mode||rule.mode==="date")return true;
 if(rule.dow!==dow)return false;
 var want=rule.weeks||[1];
 for(var i=0;i<want.length;i++){var w=want[i];
  if(w===-1){if(recIsLast(d,y,m))return true;}
  else if(recWOM(d)===w&&d<=recDaysIn(y,m))return true;}
 return false;
}
function recNext(rule,afterStr,count){
 var out=[],d=rule.start?recParse(rule.start):recParse(afterStr),after=recParse(afterStr),guard=0;
 d.setDate(d.getDate()-1);
 while(out.length<(count||1)&&guard<3000){guard++;
  d.setDate(d.getDate()+1);var ds=recD2(d);
  if(rule.end&&ds>rule.end)break;
  if(recOccursOn(rule,ds)&&ds>=afterStr)out.push(ds);}
 return out;
}
function recDescribe(rule){
 var r=rule,parts=[];
 var DOWS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],MON=["January","February","March","April","May","June","July","August","September","October","November","December"];
 function wkTxt(){var w=(r.weeks||[1]).slice().sort(function(a,b){return a===-1?1:b===-1?-1:a-b;});
  var names={1:"1st",2:"2nd",3:"3rd",4:"4th","-1":"last"};
  var ds=w.map(function(x){return names[x];}).join(", ");
  return "on the "+ds+" "+DOWS[r.dow]+" of the month";}
 function domTxt(){return r.dom==="last"?"on the last day of the month":"on the "+r.dom+(r.dom===1?"st":r.dom===2?"nd":r.dom===3?"rd":"th");}
 function dayList(){return r.days.slice().sort().map(function(d){return DOWS[d];}).join(" and ");}
 if(r.freq==="daily")parts.push("Every day");
 else if(r.freq==="weekly")parts.push("Every week on "+dayList());
 else if(r.freq==="monthly")parts.push("Every month "+(r.mode==="date"?domTxt():wkTxt()));
 else if(r.freq==="quarterly")parts.push("Every quarter in the "+["first","second","third"][(r.month||0)]+" month "+(r.mode==="date"?domTxt()+" of that month":wkTxt().replace("of the month","of that month")));
 else if(r.freq==="yearly")parts.push("Every year on "+MON[r.month||0]+" "+(r.mode==="date"?(r.dom==="last"?"last day":r.dom):"the "+(r.weeks||[1]).map(function(x){return {1:"1st",2:"2nd",3:"3rd",4:"4th","-1":"last"}[x];}).join(", ")+" "+DOWS[r.dow]));
 else if(r.freq==="custom"){var ev=Math.max(1,r.every||1),u=r.unit||"days";
  if(u==="days")parts.push("Every "+ev+" day"+(ev>1?"s":""));
  else if(u==="weeks")parts.push("Every "+ev+" week"+(ev>1?"s":"")+" on "+dayList());
  else if(u==="months")parts.push("Every "+ev+" month"+(ev>1?"s":"")+" "+(r.mode==="date"?domTxt():wkTxt()));
  else parts.push("Every "+ev+" year"+(ev>1?"s":"")+" on "+MON[r.month||0]+" "+(r.mode==="date"?(r.dom==="last"?"last day":r.dom):"the "+(r.weeks||[1]).map(function(x){return {1:"1st",2:"2nd",3:"3rd",4:"4th","-1":"last"}[x];}).join(", ")+" "+DOWS[r.dow]));}
 if(r.end)parts.push("until "+r.end);
 return parts.join(" ");
}
/* ---- draft plumbing ---- */
window.recDraftFor=function(idf){var rid=idf.split("|")[1];
 if(window.rhythmEditDraft&&rhythmEditDraft.id===rid)return window.rhythmEditDraft;
 return window.rhythmDraft;};
function recEnsureRule(d){
 if(!d.rule){d.rule=recNormRule(d);}
 if(!d.rule.start)d.rule.start=todayStr();
 if(!d.rule.days||!d.rule.days.length)d.rule.days=[new Date().getDay()];
 return d.rule;
}
/* ---- editor HTML (replaces personRhythmScheduleHTML everywhere it is used) ---- */
window.personRhythmScheduleHTML=function(r,idf){
 var d=recDraftFor(idf);
 if(!d)return (window.__origPrsh||function(){return "";})(r,idf);
 var rule=recEnsureRule(d),f=rule.freq;
 var DOWL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 function sel(id,arr,cur){return arr.map(function(o){return '<option value="'+o[0]+'"'+(String(cur)===String(o[0])?" selected":"")+'>'+o[1]+'</option>';}).join("");}
 function dayBtns(){return [0,1,2,3,4,5,6].map(function(i){var on=rule.days.indexOf(i)>=0;return '<button type="button" class="btn mini" data-rec-day="'+i+'" data-idf="'+esc(idf)+'" aria-pressed="'+on+'" style="'+(on?"background:var(--forest);color:#fff;border-color:var(--forest)":"")+'">'+DOWL[i].slice(0,3)+'</button>';}).join(" ");}
 function weekBtns(){return [1,2,3,4,-1].map(function(w){var on=(rule.weeks||[1]).indexOf(w)>=0;var lbl={1:"1st",2:"2nd",3:"3rd",4:"4th","-1":"Last"}[w];return '<button type="button" class="btn mini" data-rec-week="'+w+'" data-idf="'+esc(idf)+'" aria-pressed="'+on+'" style="'+(on?"background:var(--forest);color:#fff;border-color:var(--forest)":"")+'">'+lbl+'</button>';}).join(" ");}
 var domOpts=[[1,"1st"],[2,"2nd"],[3,"3rd"]];for(var i=4;i<=31;i++)domOpts.push([i,i+"th"]);domOpts.push(["last","Last day"]);
 var out="";
 out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Frequency</label><select data-rec="freq" data-idf="'+esc(idf)+'">'+sel(0,[["daily","Daily"],["weekly","Weekly"],["monthly","Monthly"],["quarterly","Quarterly"],["yearly","Yearly"],["custom","Custom"]],f)+'</select></div>';
 out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Time of day</label><select data-rfield="'+esc(idf)+'|tod">'+sel(0,Object.keys(TODS).map(function(k){return [k,TODS[k]];}),d.tod||"anytime")+'</select></div>';
 if(f==="weekly")out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">On</label><span>'+dayBtns()+'</span></div>';
 if(f==="monthly"||f==="quarterly"||f==="yearly"||(f==="custom"&&(rule.unit==="months"||rule.unit==="years"))){
  out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Pattern</label><select data-rec="mode" data-idf="'+esc(idf)+'">'+sel(0,[["date","Date of month"],["weekday","Weekday pattern"]],rule.mode||"date")+'</select></div>';
  if((rule.mode||"date")==="date")out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Day</label><select data-rec="dom" data-idf="'+esc(idf)+'">'+sel(0,domOpts,rule.dom||1)+'</select></div>';
  else out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Weeks</label><span>'+weekBtns()+'</span></div><div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Weekday</label><select data-rec="dow" data-idf="'+esc(idf)+'">'+sel(0,DOW.map(function(n,i){return [i,n];}),rule.dow!=null?rule.dow:5)+'</select></div>';
  if(f==="quarterly")out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Month</label><select data-rec="month" data-idf="'+esc(idf)+'">'+sel(0,[[0,"First of the quarter"],[1,"Second of the quarter"],[2,"Third of the quarter"]],rule.month||0)+'</select></div>';
  if(f==="yearly"||(f==="custom"&&rule.unit==="years"))out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Month</label><select data-rec="month" data-idf="'+esc(idf)+'">'+sel(0,["January","February","March","April","May","June","July","August","September","October","November","December"].map(function(mn,i){return [i,mn];}),rule.month||0)+'</select></div>';
 }
 if(f==="custom")out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Repeat every</label><input type="number" min="1" max="365" data-rec="every" data-idf="'+esc(idf)+'" value="'+(rule.every||1)+'" style="width:70px"><select data-rec="unit" data-idf="'+esc(idf)+'">'+sel(0,[["days","days"],["weeks","weeks"],["months","months"],["years","years"]],rule.unit||"days")+'</select></div>';
 if(f==="custom"&&rule.unit==="weeks")out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">On</label><span>'+dayBtns()+'</span></div>';
 out+='<div class="addrow"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Starts</label><input type="date" data-rec="start" data-idf="'+esc(idf)+'" value="'+(rule.start||"")+'"></div>';
 out+='<details class="rec-more" style="margin:2px 0 6px"><summary style="font-size:12px;color:var(--ink-soft);cursor:pointer">More options</summary><div class="addrow" style="margin-top:6px"><label style="font-size:12px;color:var(--ink-soft);min-width:92px">Ends</label><select data-rec="endmode" data-idf="'+esc(idf)+'">'+sel(0,[["never","Never"],["on","On date"]],rule.end?"on":"never")+'</select><input type="date" data-rec="end" data-idf="'+esc(idf)+'" value="'+(rule.end||"")+""+'"'+(rule.end?"":" disabled")+'></div></details>';
 out+='<div class="rec-preview" style="font-size:12.5px;color:var(--ink-soft);font-style:italic;margin:2px 0 8px">'+esc(recDescribe(rule)+(d.tod&&TODS[d.tod]?" \u00B7 "+TODS[d.tod]:""))+'</div>';
 return out;
};
/* ---- event wiring ---- */
document.addEventListener("change",function(e){var t=e.target;if(!t||!t.getAttribute||!t.getAttribute("data-rec"))return;
 var idf=t.getAttribute("data-idf"),d=recDraftFor(idf);if(!d)return;var rule=recEnsureRule(d);var k=t.getAttribute("data-rec"),v=t.value;
 if(k==="freq"){rule.freq=v;if(v==="weekly"&&(!rule.days||!rule.days.length))rule.days=[new Date().getDay()];if(v==="monthly"){rule.mode="date";rule.dom=rule.dom||1;}if(v==="quarterly"){rule.mode="date";rule.dom=rule.dom||1;rule.month=rule.month||0;}if(v==="yearly"){rule.mode="date";rule.dom=rule.dom||1;rule.month=rule.month||0;}if(v==="custom"){rule.every=rule.every||1;rule.unit=rule.unit||"days";}}
 else if(k==="mode")rule.mode=v;
 else if(k==="dom")rule.dom=v==="last"?"last":+v;
 else if(k==="dow")rule.dow=+v;
 else if(k==="month")rule.month=+v;
 else if(k==="every")rule.every=Math.max(1,+v||1);
 else if(k==="unit")rule.unit=v;
 else if(k==="start")rule.start=v||todayStr();
 else if(k==="endmode"){if(v==="never")rule.end=null;else rule.end=rule.end||todayStr();}
 else if(k==="end")rule.end=v||null;
 d.rule=rule;d.freq=rule.freq;render();});
document.addEventListener("click",function(e){
 var dk=e.target.closest&&e.target.closest("[data-rec-day]");
 if(dk){var d=recDraftFor(dk.getAttribute("data-idf"));if(!d)return;var rule=recEnsureRule(d);var day=+dk.getAttribute("data-rec-day");var i=rule.days.indexOf(day);
  if(i>=0){if(rule.days.length>1)rule.days.splice(i,1);else return;}else rule.days.push(day);
  d.rule=rule;d.freq=rule.freq;render();return;}
 var wk=e.target.closest&&e.target.closest("[data-rec-week]");
 if(wk){var d2=recDraftFor(wk.getAttribute("data-idf"));if(!d2)return;var r2=recEnsureRule(d2);var w=+wk.getAttribute("data-rec-week");r2.weeks=r2.weeks||[1];var j=r2.weeks.indexOf(w);
  if(j>=0){if(r2.weeks.length>1)r2.weeks.splice(j,1);else return;}else r2.weeks.push(w);
  d2.rule=r2;d2.freq=r2.freq;render();return;}
});
/* ---- occurrence-based overrides (legacy fallback inside recNormRule) ---- */
window.todayRhythmEligible=function(r){try{var rule=recNormRule(r);return recOccursOn(rule,todayStr())&&rhythmDaysSince(r)!==0;}catch(err){return window.__origTre?window.__origTre(r):true;}};
window.scheduleDayMatches=function(item,date){try{var d=date||new Date();var ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");return recOccursOn(recNormRule(item),ds);}catch(err){return window.__origSdm?window.__origSdm(item,date):true;}};
window.__recShort=function(rule){
 var DOWS=DOW;
 if(rule.freq==="daily")return "";
 if(rule.freq==="weekly")return rule.days.slice().sort().map(function(d){return DOWS[d];}).join("+");
 if(rule.freq==="monthly")return rule.mode==="date"?(rule.dom==="last"?"last day":"on the "+rule.dom):"on the "+(rule.weeks||[1]).slice().sort(function(a,b){return a===-1?1:b===-1?-1:a-b;}).map(function(x){return {1:"1st",2:"2nd",3:"3rd",4:"4th","-1":"last"}[x];}).join("/")+DOWS[rule.dow||0];
 if(rule.freq==="quarterly")return "quarterly";
 if(rule.freq==="yearly")return "yearly";
 if(rule.freq==="custom"){var ev=Math.max(1,rule.every||1);if(rule.unit==="days")return "every "+ev+"d";if(rule.unit==="weeks")return "every "+ev+"wk";if(rule.unit==="months")return "every "+ev+"mo";return "every "+ev+"yrs";}
 return "";};
window.scheduleDayLabel=function(item){try{var rule=recNormRule(item);return window.__recShort(rule);}catch(err){return window.__origSdl?window.__origSdl(item):"";}};
window.rhythmFreqLabel=function(r){try{var rule=recNormRule(r);var m={daily:"Daily",weekly:"Weekly",monthly:"Monthly",quarterly:"Quarterly",yearly:"Yearly"};return m[rule.freq]||("Every "+Math.max(1,rule.every||1)+" "+(rule.unit||"days"));}catch(err){return window.__origRfl?window.__origRfl(r):"";}};
/* ---- health scoring: -10% per missed occurrence, today is never penalized ---- */
window.rhythmScore=function(r){
 try{
  var rule=recNormRule(r);
  var last=rhythmLast(r);
  function mid(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  var fromD;
  if(last)fromD=new Date(last.ts);
  else if(rule.start)fromD=recParse(rule.start);
  else if(r&&r.added)fromD=new Date(r.added);
  else return 0;
  var cur=mid(fromD);cur.setDate(cur.getDate()+1);
  var t=mid(new Date());
  var missed=0;
  while(cur<t&&missed<10){
   var ds=cur.getFullYear()+"-"+String(cur.getMonth()+1).padStart(2,"0")+"-"+String(cur.getDate()).padStart(2,"0");
   if(recOccursOn(rule,ds))missed++;
   cur.setDate(cur.getDate()+1);
  }
  return Math.max(0,100-10*missed);
 }catch(err){
  var d=rhythmDaysSince(r);if(d===999)return 0;var per=rhythmPeriod(r);
  if(d<per)return 100;return Math.max(0,100-10*(d-per+1));
 }
};

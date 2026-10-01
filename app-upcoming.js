"use strict";
/* ============ key-date helpers (multi-person) ============ */
window.kdPeopleIds=function(k){if(!k)return[];var a=Array.isArray(k.personIds)?k.personIds.filter(Boolean):[];if(k.personId&&a.indexOf(k.personId)<0)a.push(k.personId);return a;};
window.kdPeopleChkHTML=function(k,lockedPid){return '<div class="kd-people">'+S.people.map(function(np){var on=kdPeopleIds(k).indexOf(np.id)>=0;return '<label class="kd-person"><input type="checkbox" data-kdperson="'+k.id+'|'+np.id+'"'+(on?' checked':'')+(np.id===lockedPid?' disabled':'')+'> '+esc(np.name)+'</label>';}).join('')+'</div>';};
window.kdLogLineHTML=function(k){return '<div class="logline"><span class="kind">'+esc(k.label)+'</span><span class="txt">'+(daysUntil(k)===0?"today":"in "+daysUntil(k)+" days")+'</span><span class="entry-actions"><button class="iconbtn" data-kddel="'+k.id+'" title="delete">\uD83D\uDDD1</button></span></div>';};
(S.keyDates||[]).forEach(function(k){if(!Array.isArray(k.personIds))k.personIds=k.personId?[k.personId]:[];});
/* ============ Coming up: calendar-icon rows + hide dashboard checklists ============
   Overrides upcomingDates/upcomingHTML/renderChecklists from app-views1.js.
   Load order matters: this file must come after app-views1.js.
   To restore the old behavior, remove this file and its script tag in index.html. */
(function(){
 var style=document.createElement("style");
 style.textContent=
  ".upitem{gap:11px}"+
  ".cal-ic{width:34px;height:37px;border-radius:8px;overflow:hidden;flex:none;display:flex;flex-direction:column;background:#FDFDFD;border:1px solid rgba(32,39,35,.14);box-shadow:0 1px 3px rgba(32,39,35,.18)}"+
  ".cal-ic-top{background:#F04531;color:#fff;font-size:8.5px;font-weight:700;letter-spacing:.08em;text-align:center;line-height:12px;height:12px;font-family:var(--sans)}"+
  ".cal-ic-day{flex:1;display:grid;place-items:center;font-size:18px;line-height:1;color:#202723;font-variant-numeric:tabular-nums}"+
  ".upmain{display:flex;flex-direction:column;min-width:0;flex:1}"+
  ".upmain .uplabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
  ".update{font-size:11.5px;color:var(--ink-faint);font-weight:500}"+
  ".updays{margin-left:auto;flex:none;align-self:center}";
 document.head.appendChild(style);
})();
var MOS_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var DOW_SHORT=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function upcomingDates(now){
 var today=new Date(now||Date.now());today.setHours(0,0,0,0);var rows=[];
 function add(label,month,day,attrs){
  if(!(month>=1&&month<=12&&day>=1&&day<=31))return;
  var date=new Date(today.getFullYear(),month-1,day);if(date<today)date=new Date(today.getFullYear()+1,month-1,day);
  var days=Math.round((date-today)/86400000);if(days<=30)rows.push({label:label,days:days,date:date,attrs:attrs||""});
 }
 S.people.forEach(function(p){[['birthday','Birthday'],['anniversary','Anniversary']].forEach(function(pair){var v=String(p[pair[0]]||'').split('-');if(v.length===3)add(p.name+' \u00b7 '+pair[1],+v[1],+v[2],' data-openperson="'+esc(p.id)+'"');});});
 S.keyDates.forEach(function(k){var who=kdPeopleIds(k).map(function(id){var p=S.people.find(function(q){return q.id===id;});return p?p.name:null;}).filter(Boolean);add((who.length?who.join(' + ')+' \u00b7 ':'')+k.label,+k.month,+k.day,' data-upitem="'+esc(k.id)+'"');});
 majorHolidays.forEach(function(h){if(!holidayEnabled(h.id))return;[today.getFullYear(),today.getFullYear()+1].forEach(function(y){var date=h.date(y),days=Math.round((date-today)/86400000);if(days>=0&&days<=30)rows.push({label:h.name,days:days,date:date,attrs:''});});});
 return rows.sort(function(a,b){return a.days-b.days||a.label.localeCompare(b.label);});
}
function calIconHTML(date){
 return '<span class="cal-ic" aria-hidden="true"><span class="cal-ic-top">'+MOS_SHORT[date.getMonth()].toUpperCase()+'</span><span class="cal-ic-day">'+date.getDate()+'</span></span>';
}
function upcomingHTML(){
 var rows=upcomingDates();
 return '<div class="sectiontitle"><h2>Coming up</h2><span class="hint">next 30 days</span></div><div class="uprow">'+(rows.length?rows.map(function(x){
  var dtxt=DOW_SHORT[x.date.getDay()]+' \u00b7 '+MOS_SHORT[x.date.getMonth()]+' '+x.date.getDate();
  return '<div class="upitem"'+x.attrs+'>'+calIconHTML(x.date)+'<span class="upmain"><span class="uplabel">'+esc(x.label)+'</span><span class="update">'+dtxt+'</span></span><span class="updays '+(x.days<=7?'soon':x.days<=21?'mid':'far')+'">'+(x.days===0?'today':'in '+x.days+'d')+'</span></div>';
 }).join(''):'<div class="empty">No personal dates or selected holidays in the next 30 days.</div>')+'</div>';
}
/* Hide the three checklist cards (wedding, Christmas, Thanksgiving) on the dashboard for now. */
function renderChecklists(){return "";}

/* ============ key dates: tab, modal wiring, handlers ============ */
var KD_STYLE=".kd-people{display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0}.kd-person{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--ink-soft);font-weight:400}.kd-person input{margin:0}.kd-row{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}.kd-when{flex:1;min-width:170px}.kd-md{display:flex;gap:6px;margin-top:4px;align-items:center}.kd-text{flex:1;min-width:140px}";
(function(){var s=document.createElement("style");s.textContent=KD_STYLE;document.head.appendChild(s);})();
nextDateLine=function(pid){var kds=S.keyDates.filter(function(k){return kdPeopleIds(k).indexOf(pid)>=0;});if(!kds.length)return "";var best=null;kds.forEach(function(k){var d=daysUntil(k);if(best===null||d<best.d)best={k:k,d:d};});if(!best)return "";return '<div class="pf-next">'+esc(best.k.label)+' \u00B7 '+(best.d===0?"TODAY":"in "+best.d+" days")+'</div>';};
(function(){
 var _pp=personProfile;
 personProfile=function(pid){
  var html=_pp(pid);
  var p=S.people.find(function(q){return q.id===pid;});if(!p)return html;
  var mark='Key dates</div>';
  var start=html.indexOf(mark);if(start<0)return html;
  var end=html.indexOf('connection-cadence-field',start);if(end<0)return html;
  var sec=html.slice(start,end);
  var kds=S.keyDates.filter(function(k){return kdPeopleIds(k).indexOf(pid)>=0;});
  var have={};
  sec=sec.replace(/data-kddel="([^"]+)" title="delete">[^<]*<\/button><\/span><\/div>/g,function(all,id){have[id]=true;var k=S.keyDates.find(function(x){return x.id===id;});return all+(k?kdPeopleChkHTML(k,pid):"");});
  var missing=kds.filter(function(k){return !have[k.id];});
  if(missing.length){
   sec=sec.replace('<div class="empty">None yet.</div>','');
   var inject=missing.map(function(k){return kdLogLineHTML(k)+kdPeopleChkHTML(k,pid);}).join('');
   var ar=sec.indexOf('<div class="addrow"><input placeholder="Add key date');
   if(ar>=0)sec=sec.slice(0,ar)+inject+sec.slice(ar);else sec+=inject;
  }
  sec=sec.replace(/(<div class="addrow"><input placeholder="Add key date \(label\)" data-kdlabel="[^"]*"><button class="btn mini" data-kdadd="[^"]*">Add<\/button><\/div>)/,'$1<div class="kd-people">'+S.people.map(function(np){return '<label class="kd-person"><input type="checkbox" data-kdnewperson="'+pid+'|'+np.id+'"'+(np.id===pid?' checked disabled':'')+'> '+esc(np.name)+'</label>';}).join('')+'</div>');
  return html.slice(0,start)+sec+html.slice(end);
 };
})();
document.addEventListener("click",function(e){
 var t=e.target;if(!t||!t.closest)return;var b;
 if(b=t.closest("#kdAddGlobal")){e.stopImmediatePropagation();e.preventDefault();
  var ginp=document.getElementById("kdNewLabel");
  if(ginp&&ginp.value.trim()){
   var gp=[];document.querySelectorAll("[data-kdnewglobal]").forEach(function(c){if(c.checked)gp.push(c.getAttribute("data-kdnewglobal"));});
   var gm=document.getElementById("kdNewMonth"),gd=document.getElementById("kdNewDay");
   S.keyDates.push({id:uid(),label:ginp.value.trim(),month:+(gm&&gm.value)||1,day:Math.min(31,Math.max(1,+(gd&&gd.value)||1)),personIds:gp,personId:gp[0]||""});
   save();render();flash("Key date added");
  }return;}
 if(b=t.closest("[data-kdadd]")){e.stopImmediatePropagation();e.preventDefault();
  var pid=b.getAttribute("data-kdadd");var inp=document.querySelector('[data-kdlabel="'+pid+'"]');
  if(inp&&inp.value.trim()){
   var others=[];document.querySelectorAll('[data-kdnewperson^="'+pid+'|"]').forEach(function(c){if(c.checked&&!c.disabled)others.push(c.getAttribute("data-kdnewperson").split("|")[1]);});
   S.keyDates.push({id:uid(),personId:pid,personIds:[pid].concat(others),label:inp.value.trim(),month:1,day:1});
   save();render();flash("Added - set month and day in Settings, Key dates tab");
  }return;}
});
document.addEventListener("change",function(e){
 var t=e.target;if(!t||!t.matches)return;
 if(t.matches("[data-kdperson]")){var kp=t.getAttribute("data-kdperson").split("|"),kd=S.keyDates.find(function(k){return k.id===kp[0];});if(kd){kd.personIds=kdPeopleIds(kd);if(t.checked){if(kd.personIds.indexOf(kp[1])<0)kd.personIds.push(kp[1]);}else kd.personIds=kd.personIds.filter(function(x){return x!==kp[1];});kd.personId=kd.personIds[0]||"";save();}return;}
 if(t.matches("[data-kdtext]")){var kd3=S.keyDates.find(function(k){return k.id===t.getAttribute("data-kdtext");});if(kd3&&t.value.trim()){kd3.label=t.value.trim();save();}return;}
 if(t.matches("[data-kdmonth]")){var kd4=S.keyDates.find(function(k){return k.id===t.getAttribute("data-kdmonth");});if(kd4){kd4.month=+t.value||1;save();render();}return;}
 if(t.matches("[data-kdday]")){var kd5=S.keyDates.find(function(k){return k.id===t.getAttribute("data-kdday");});if(kd5){kd5.day=Math.min(31,Math.max(1,+t.value||1));save();render();}return;}
});

/* ============ love language icons ============ */
var LL_ICONS={
 wa:{t:"Words of affirmation",svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M12 3C6.9 3 3 6.4 3 10.6c0 2.3 1.2 4.3 3.1 5.7-.1.9-.6 2.3-1.8 3.7 2.2-.3 3.9-1.1 5-1.9.9.2 1.8.3 2.7.3 5.1 0 9-3.4 9-7.8S17.1 3 12 3z"/><path d="M8 9h8M8 12.5h5.5" stroke="#fff" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>'},
 gf:{t:"Receiving gifts",svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.8C10.6 6.8 7.8 6.4 7.8 4.4c0-1.3 1.1-2.1 2.2-1.7 1.4.5 2 2.6 2 4.1zm0 0c1.4 0 4.2-.4 4.2-2.4 0-1.3-1.1-2.1-2.2-1.7-1.4.5-2 2.6-2 4.1z" fill="none" stroke="#B2383C" stroke-width="1.5"/><rect x="3.5" y="7" width="17" height="4.2" rx="1" fill="#E5484D"/><rect x="5" y="12.2" width="14" height="9" rx="1.5" fill="#E5484D"/><rect x="10.7" y="7" width="2.6" height="14.2" fill="#B2383C"/></svg>'},
 pt:{t:"Physical touch",svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F0762B" d="M9 21.5c-2 0-3.6-1.3-4.6-3.2l-1.8-3.5c-.3-.6-.1-1.4.5-1.7.6-.3 1.3-.2 1.7.3L6.5 15V4.9c0-.7.6-1.3 1.3-1.3s1.3.6 1.3 1.3v6h.7V2.9c0-.7.6-1.3 1.3-1.3s1.3.6 1.3 1.3v8h.7V4.4c0-.7.6-1.3 1.3-1.3s1.3.6 1.3 1.3v6.5h.7V7c0-.7.6-1.3 1.3-1.3s1.3.6 1.3 1.3v8.5c0 3.3-2.7 6-6 6H9z"/></svg>'},
 as:{t:"Acts of service",svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4" fill="#3B82C4"/><path fill="#3B82C4" d="M12 8.2c-4.2 0-7.7 3.2-8.2 7.3h16.4C19.7 11.4 16.2 8.2 12 8.2z"/><rect x="2.8" y="16.8" width="18.4" height="2.3" rx="1.15" fill="#3B82C4"/></svg>'},
 qt:{t:"Quality time",svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="#F2B01E"/><path d="M12 7.4V12l3.2 1.9" stroke="#fff" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>'}
};
window.llIconHTML=function(p){
 var code=p&&p.loveLanguage;if(!code||!LL_ICONS[code])return "";
 var ic=LL_ICONS[code];
 return '<span class="ll-ic" title="'+ic.t+'" aria-label="'+ic.t+'">'+ic.svg+'</span>';
};
(function(){
 var s=document.createElement("style");
 s.textContent=".ll-ic{display:inline-flex;width:17px;height:17px;vertical-align:-3px;margin-left:6px}.ll-ic svg{width:100%;height:100%;display:block}.chip .ll-ic{margin-left:0;margin-right:5px;vertical-align:-3px}";
 document.head.appendChild(s);
})();
/* inject icons next to person names (people cards + profile header) */
(function(){
 function inject(html){
  S.people.forEach(function(p){
   var ic=llIconHTML(p);if(!ic)return;
   var nm=esc(p.name);
   html=html.split('<h3 style="margin:0">'+nm+'</h3>').join('<h3 style="margin:0">'+nm+ic+'</h3>');
   html=html.split('<h3>'+nm+'</h3>').join('<h3>'+nm+ic+'</h3>');
  });
  return html;
 }
 var _rp=renderPeople;
 renderPeople=function(){return inject(_rp());};
 var _pp2=personProfile;
 personProfile=function(pid){return inject(_pp2(pid));};
})();

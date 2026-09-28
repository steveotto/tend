"use strict";
/* ================= state ================= */
var LS_STATE="tend:state", LS_SYNC="tend:sync";
var KINDS={coffee:{label:"Coffee / one-on-one",w:8},meal:{label:"Meal together",w:7},date:{label:"Date night",w:9},call:{label:"Call / FaceTime",w:4},text:{label:"Text / note",w:2},quality:{label:"Quality time",w:7},workout:{label:"Workout",w:5},outdoors:{label:"Walk / outdoors",w:4},prayer:{label:"Prayer",w:4},scripture:{label:"Scripture",w:3},rest:{label:"Rest / sabbath",w:5},actservice:{label:"Act of service",w:6},note:{label:"Note / journal",w:2}};

function defaultState(){
  return {
    version:1,
    people:[
      {id:"amy",name:"Amy",relation:"wife",area:"marriage"},
      {id:"hannah",name:"Hannah",relation:"daughter",area:"parenting"},
      {id:"jacob",name:"Jacob",relation:"son",area:"parenting"},
      {id:"leah",name:"Leah",relation:"daughter",area:"parenting"}
    ],
    events:[],
    tasks:[],
    goals:[],
    followups:[],
    prayers:[],
    teachings:[],
    areas:{
      faith:{name:"Faith"},
      marriage:{name:"Marriage"},
      parenting:{name:"Parenting"},
      health:{name:"Health"},
      fitness:{name:"Fitness"},
      finances:{name:"Finances"},
      friendships:{name:"Friendships"}
    }
  };
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function load(){ try{ var s=localStorage.getItem(LS_STATE); return s?JSON.parse(s):defaultState(); }catch(e){ return defaultState(); } }
var S=load();
if(!S.areas.finances){ S.areas.finances={name:"Finances"}; }
(function(){
  var want=[{id:"amy",name:"Amy",relation:"wife",area:"marriage"},{id:"hannah",name:"Hannah",relation:"daughter",area:"parenting"},{id:"jacob",name:"Jacob",relation:"son",area:"parenting"},{id:"leah",name:"Leah",relation:"daughter",area:"parenting"}];
  var changed=false;
  want.forEach(function(p){ if(!S.people.some(function(x){return x.id===p.id;})){ S.people.push(p); changed=true; } });
  if(changed){ try{localStorage.setItem(LS_STATE,JSON.stringify(S));}catch(e){} }
})();
var saveTimer=null, pushTimer=null;
function save(){
  localStorage.setItem(LS_STATE, JSON.stringify(S));
  clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){ flash("Saved"); },150);
  if(window.SYNCcfg && SYNCcfg.auto && SYNCcfg.token && typeof schedulePush==="function") schedulePush();
}
function flash(msg){
  var f=document.getElementById("flash"); f.textContent=msg||"Saved";
  f.classList.add("show"); clearTimeout(flash._t);
  flash._t=setTimeout(function(){f.classList.remove("show");},1200);
}

/* ================= meters ================= */
function daysSince(ts){ return Math.floor((Date.now()-ts)/86400000); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function rawScore(evs, base){
  base = (base===undefined)?70:base;
  if(!evs.length){ return clamp(base - 14, 0, 100); }
  var last=0, bonus=0;
  evs.forEach(function(e){
    var d=daysSince(e.ts);
    if(d>90) return;
    var decay=clamp(1-d/45,0,1);
    bonus += (e.weight||3)*decay;
    if(d>last) last=d;
  });
  var staleness = clamp(last,0,30)*1.4;
  return clamp(Math.round(base - staleness + bonus), 0, 100);
}
function eventsFor(areaId, personId){
  return S.events.filter(function(e){
    return e.areaId===areaId && (personId? e.personId===personId : !e.personId);
  });
}
function personScore(p){ return rawScore(eventsFor(p.area,p.id), 70); }
function areaScore(id){
  var kids=S.people.filter(function(p){return p.area===id;});
  if(kids.length && id==="parenting"){
    var sum=0; kids.forEach(function(k){ sum+=personScore(k); });
    var own=rawScore(eventsFor(id), 70);
    return Math.round((sum/kids.length)*0.75 + own*0.25);
  }
  return rawScore(eventsFor(id), 70);
}
function trend(id, personId){
  function at(days){
    var cutoff=Date.now()-days*86400000;
    var evs=(personId?eventsFor(id,personId):eventsFor(id)).filter(function(e){return e.ts<=cutoff;});
    return rawScore(evs,70);
  }
  var now=personId?personScore(S.people.find(function(p){return p.id===personId})):areaScore(id);
  var past=at(7);
  if(now-past>=4) return {cls:"up",arrow:"\u25B2"};
  if(past-now>=4) return {cls:"down",arrow:"\u25BC"};
  return {cls:"flat",arrow:"\u25AC"};
}
function scoreClass(v){ return v>=70?"good":(v>=40?"mid":"low"); }
function scoreLabel(v){ return v>=70?"Well tended":(v>=40?"Worth tending this week":"Quiet a while - worth a visit"); }

/* ================= render ================= */
var AREA_IDS=["faith","marriage","parenting","health","fitness","finances","friendships"];
var tab="today", openDetail=null;
function el(id){ return document.getElementById(id); }
function when(ts){
  var d=daysSince(ts);
  if(d===0) return "today";
  if(d===1) return "yesterday";
  if(d<7) return d+" days ago";
  if(d<30) return Math.floor(d/7)+" wk ago";
  return Math.floor(d/30)+" mo ago";
}
function renderTabs(){
  var btns=document.querySelectorAll("#tabs button");
  btns.forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-tab")===tab); });
}
function render(){
  renderTabs();
  var v=el("view");
  if(tab==="today") v.innerHTML=renderToday();
  else if(tab==="prayer") v.innerHTML=renderPrayer();
  else if(tab==="free") v.innerHTML=renderFree();
  else if(tab==="teach") v.innerHTML=renderTeach();
  else if(tab==="sync") v.innerHTML=renderSync();
  if(typeof bind==="function") bind();
}

/* ---------- Today ---------- */
function introHTML(){
  try{ if(localStorage.getItem("tend:introSeen")) return ""; }catch(e){}
  return '<div class="card" id="introCard" style="margin-bottom:16px"><div class="serif" style="font-size:26px;line-height:1.35">Structure beats good intention.</div><div style="color:var(--ink-soft);margin-top:8px">Care for what matters. Tend gives your commitments a small daily rhythm - a nudge, not a grade.</div><button class="btn" id="introOk" style="margin-top:12px">Begin</button></div>';
}
function renderToday(){
  var d=new Date();
  var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var mos=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var out=introHTML()+'<div class="sectiontitle" style="margin-top:6px"><h2>'+days[d.getDay()]+", "+mos[d.getMonth()]+" "+d.getDate()+'</h2><span class="hint">a nudge, not a grade</span></div>';
  var fus=S.followups.filter(function(f){return !f.done;}).sort(function(a,b){return (a.due||"")<(b.due||"")?-1:1;});
  if(fus.length){
    out+='<div class="followups"><div class="subhead">Follow up</div>';
    fus.slice(0,4).forEach(function(f){
      var over=f.due && f.due < new Date().toISOString().slice(0,10);
      out+='<div class="fu'+(over?" overdue":"")+'"><input type="checkbox" class="cb" data-fudone="'+f.id+'"><span class="txt">'+esc(f.text)+'</span><span class="due">'+(f.due?("by "+f.due):"")+'</span><button class="del" data-fudel="'+f.id+'">\u00D7</button></div>';
    });
    out+='</div>';
  }
  out+='<div class="grid">';
  AREA_IDS.forEach(function(id){
    var v=areaScore(id);
    var t=trend(id);
    var kids=S.people.filter(function(p){return p.area===id;});
    var chips="";
    if(kids.length){
      chips='<div class="people-row">'+kids.map(function(k){
        var ps=personScore(k);
        return '<span class="submeter" data-person="'+k.id+'"><span class="sm-name">'+esc(k.name)+'</span><span class="sm-bar"><i style="width:'+ps+'%"></i></span><span class="sm-num">'+ps+'</span></span>';
      }).join("")+'</div>';
    }
    var evs=eventsFor(id).sort(function(a,b){return b.ts-a.ts;});
    var meta=evs.length? "last tended "+when(evs[0].ts) : "not tended yet";
    out+='<div class="card metercard" data-area="'+id+'">'+
      '<div class="top"><h3>'+S.areas[id].name+'</h3><div><span class="score '+scoreClass(v)+'">'+v+'</span><span class="trend '+t.cls+'">'+t.arrow+'</span></div></div>'+
      '<div class="bar"><i class="'+scoreClass(v)+'" style="width:'+v+'%"></i></div>'+
      '<div class="meta"><span style="color:'+(v>=70?"var(--forest)":"var(--ink-faint)")+'">\u25CF</span> '+scoreLabel(v)+' \u00B7 '+meta+'</div>'+chips+'</div>';
    if(openDetail===id){
      out+='<div class="card detail open" id="detail-'+id+'">'+detailHTML(id)+'</div>';
    }
  });
  out+='</div>';
  return out;
}
function detailHTML(id){
  var evs=eventsFor(id,true).sort(function(a,b){return b.ts-a.ts;}).slice(0,6);
  var tasks=S.tasks.filter(function(t){return t.areaId===id;});
  var goals=S.goals.filter(function(g){return g.areaId===id;});
  var out='<h3>'+S.areas[id].name+' - details</h3>';
  out+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 2px"><button class="btn mini" data-quicklog="'+id+'">+ Log activity</button><button class="btn mini ghost" data-closedetail="'+id+'">Close</button></div>';
  out+='<div class="cols">';
  out+='<div><div class="subhead">Recent activity</div>';
  if(evs.length){ evs.forEach(function(e){
    out+='<div class="logline"><span class="when">'+when(e.ts)+'</span><span class="kind">'+(KINDS[e.kind]?KINDS[e.kind].label:e.kind)+(e.personId?(" - "+esc(personName(e.personId))):"")+'</span><span class="txt">'+esc(e.note||"")+'</span></div>';
  }); } else out+='<div class="empty">Nothing logged yet - tap + Log activity.</div>';
  out+='</div>';
  out+='<div>';
  out+='<div class="subhead">Habits / tasks</div><ul class="tasks">';
  tasks.forEach(function(t){
    out+='<li class="'+(t.done?"done":"")+'"><input type="checkbox" class="cb" data-task="'+t.id+'"'+(t.done?" checked":"")+'><span class="txt">'+esc(t.text)+'</span><button class="del" data-taskdel="'+t.id+'">\u00D7</button></li>';
  });
  out+='</ul><div class="addrow"><input placeholder="Add a habit or task..." data-tasknew="'+id+'"><button class="btn mini" data-taskadd="'+id+'">Add</button></div>';
  out+='<div class="subhead" style="margin-top:16px">Goals</div>';
  goals.forEach(function(g){
    out+='<div class="logline"><span class="txt">'+esc(g.text)+'</span><button class="del" data-goaldel="'+g.id+'">\u00D7</button></div>';
  });
  out+='<div class="addrow"><input placeholder="Add a goal..." data-goalnew="'+id+'"><button class="btn mini" data-goaladd="'+id+'">Add</button></div>';
  out+='</div></div></div>';
  return out;
}

/* ---------- Prayer ---------- */
var PRAYER_CATS=["Family","Marriage","Kids","Friends","Work & Ministry","Church & Pastors","World & Others"];
function renderPrayer(){
  var out='<div class="sectiontitle" style="margin-top:6px"><h2>Prayer</h2><span class="hint">carry these people before God</span></div>';
  out+='<div class="addrow" style="margin-bottom:8px"><select id="prayerCat" style="border:1px solid var(--line);border-radius:12px;padding:8px 11px;background:var(--card)">'+PRAYER_CATS.map(function(c){return '<option>'+c+'</option>';}).join("")+'</select><input id="prayerNew" placeholder="New prayer request..." style="flex:1;border:1px solid var(--line);border-radius:12px;padding:8px 11px;background:var(--card)"><button class="btn" id="prayerAdd">Add</button></div>';
  PRAYER_CATS.forEach(function(cat){
    var items=S.prayers.filter(function(p){return p.category===cat && !p.answered;});
    var ans=S.prayers.filter(function(p){return p.category===cat && p.answered;});
    if(!items.length && !ans.length) return;
    out+='<div class="card prayer-cat"><div class="subhead">'+cat+'</div>';
    items.forEach(function(p){
      out+='<div class="preq"><input type="checkbox" class="cb" data-praymark="'+p.id+'" title="mark prayed"><div class="ptext">'+esc(p.text)+'<div style="font-size:11px;color:var(--ink-faint);margin-top:2px">added '+p.added+' \u00B7 prayed '+(p.prayed?p.prayed:0)+'x</div></div><button class="btn mini ghost" data-prayerics="'+p.id+'" title="download calendar reminder">remind</button><button class="del" data-prayerans="'+p.id+'" title="mark answered">\u2713</button><button class="del" data-prayerdel="'+p.id+'">\u00D7</button></div>';
    });
    if(ans.length){
      out+='<div class="subhead" style="margin-top:12px;color:var(--forest)">Answered \u2713</div>';
      ans.forEach(function(p){
        out+='<div class="preq answered"><div class="ptext">'+esc(p.text)+'<div style="font-size:11px;color:var(--forest);margin-top:2px">answered '+p.answeredDate+'</div></div><button class="del" data-prayerunans="'+p.id+'" title="restore">\u21BA</button></div>';
      });
    }
    out+='</div>';
  });
  if(!S.prayers.length) out+='<div class="empty" style="text-align:center;padding:40px 0">No requests yet. Add the first one above.</div>';
  return out;
}

/* ---------- Free Time ---------- */
var CATALOG=[
  {area:"faith",min:10,text:"Pray slowly through your prayer list",kind:"prayer"},
  {area:"faith",min:15,text:"Read Scripture and write one takeaway",kind:"scripture"},
  {area:"faith",min:5,text:"Silent prayer - no words, just listen",kind:"prayer"},
  {area:"marriage",min:3,text:"Text Amy one specific thing you appreciate",kind:"text",person:"amy"},
  {area:"marriage",min:15,text:"Plan the next date night - actually put it on the calendar",kind:"date",person:"amy"},
  {area:"marriage",min:25,text:"20-minute porch talk with Amy, phones inside",kind:"quality",person:"amy"},
  {area:"parenting",min:10,text:"10-minute check-in with {kid}, no phones",kind:"quality",kid:true},
  {area:"parenting",min:5,text:"Pray over {kid} - out loud, today",kind:"prayer",kid:true},
  {area:"parenting",min:20,text:"Do something {kid} loves, together",kind:"quality",kid:true},
  {area:"health",min:15,text:"Prep a real-food meal or batch-cook protein",kind:"actservice"},
  {area:"health",min:10,text:"Drink a big glass of water, step outside, breathe",kind:"rest"},
  {area:"fitness",min:15,text:"50 push-ups + 50 air squats, broken into sets",kind:"workout"},
  {area:"fitness",min:25,text:"1.5-mile walk or run - outside, not treadmill",kind:"outdoors"},
  {area:"fitness",min:10,text:"Stretch + 2 min plank",kind:"workout"},
  {area:"friendships",min:20,text:"Call a friend you have not talked to in a month",kind:"call"},
  {area:"friendships",min:5,text:"Text a friend a genuine encouragement",kind:"text"},
  {area:"friendships",min:25,text:"Invite a friend for coffee this week",kind:"coffee"}
];
var sliderMin=25;
function targetScore(a){ return 100-areaScore(a); }
function pickSuggestions(){
  var opts=CATALOG.filter(function(c){return c.min<=sliderMin;}).map(function(c){
    var copy={area:c.area,min:c.min,text:c.text,kind:c.kind,person:c.person};
    if(c.kid){
      var kids=S.people.filter(function(p){return p.area==="parenting";});
      var lowest=kids.sort(function(a,b){return personScore(a)-personScore(b);})[0];
      if(!lowest) return null;
      copy.text=c.text.replace("{kid}",lowest.name); copy.person=lowest.id;
      copy._urg=100-personScore(lowest);
    } else {
      copy._urg=targetScore(c.area);
    }
    return copy;
  }).filter(Boolean);
  opts.sort(function(a,b){return (b._urg+(b.min||0)*0.1)-(a._urg+(a.min||0)*0.1);});
  return opts.slice(0,3);
}
function suggHTML(){
  var picks=pickSuggestions();
  if(!picks.length) return '<div class="empty" style="margin-top:16px">Set a bigger window for suggestions.</div>';
  var html='<div class="sugg">';
  picks.forEach(function(c){
    var areaName=S.areas[c.area].name;
    html+='<div class="s"><div><span class="a">'+areaName.toUpperCase()+'</span><div class="t">'+esc(c.text)+'</div></div><span class="why">'+c.min+' min \u00B7 '+areaName+' needs it</span><button class="btn mini" data-dosugg="'+c.text+"|"+c.area+"|"+(c.person||"")+"|"+c.kind+'" >Done it</button></div>';
  });
  return html+'</div>';
}
function renderFree(){
  var out='<div class="sectiontitle" style="margin-top:6px"><h2>Found a gap?</h2><span class="hint">what should I do with it</span></div>';
  out+='<div class="card sliderbox"><div class="bigtime">'+sliderMin+' min</div><input type="range" id="freeSlider" min="5" max="90" step="5" value="'+sliderMin+'"><div style="font-size:12px;color:var(--ink-faint)">drag to set your time - suggestions fit the gap and lean toward your lowest areas</div>';
  out+='<div id="suggBox">'+suggHTML()+'</div>';
  out+='</div>';
  return out;
}

/* ---------- Teach ---------- */
function renderTeach(){
  var out='<div class="sectiontitle" style="margin-top:6px"><h2>Teach &amp; Shepherd</h2><span class="hint">ideas for tending the souls in your house</span></div>';
  out+='<div class="addrow"><input id="teachNew" placeholder="Idea: family night on Healing, a book of the Bible, a question they asked..."><button class="btn" id="teachAdd">Add</button></div>';
  out+='<div style="margin-top:14px">';
  if(!S.teachings.length) out+='<div class="empty">No ideas yet. Capture the first spark above.</div>';
  S.teachings.forEach(function(t){
    out+='<div class="idea"><h4><span class="status '+t.status.toLowerCase()+'">'+t.status+'</span>'+esc(t.topic)+'</h4>'+
    '<div style="font-size:12px"><button class="btn mini ghost" data-teachstatus="'+t.id+'">cycle status</button><button class="btn mini ghost" data-teachlb="'+t.id+'">copy for Littlebird</button><button class="del" data-teachdel="'+t.id+'">\u00D7</button></div>'+
    '<textarea data-teachnotes="'+t.id+'" placeholder="notes, scriptures, questions...">'+esc(t.notes||"")+'</textarea></div>';
  });
  out+='</div>';
  out+='<div class="card" style="margin-top:16px;font-size:13px;color:var(--ink-soft)"><b>Working with Littlebird:</b> jot the topic, tap <b>copy for Littlebird</b>, then paste it into your Littlebird chat. Or just describe the idea in chat - Littlebird can see your Tend data directly now.</div>';
  return out;
}

/* ---------- Sync ---------- */
function renderSync(){
  var c=window.SYNCcfg||{auto:true};
  var out='<div class="sectiontitle" style="margin-top:6px"><h2>Sync &amp; Settings</h2></div>';
  out+='<div class="grid"><div class="card syncbox" style="grid-column:1/-1">';
  out+='<div class="status">'+syncStatusHTML()+'</div>';
  out+='<div class="field"><label>GitHub username</label><input id="syncOwner" value="'+esc(c.owner||"")+'"></div>';
  out+='<div class="field"><label>Data repo (private, e.g. tend-data)</label><input id="syncRepo" value="'+esc(c.repo||"")+'"></div>';
  out+='<div class="field"><label>Fine-grained personal access token (Contents: read &amp; write, only for the data repo)</label><input id="syncToken" type="password" value="'+esc(c.token||"")+'" placeholder="github_pat_..."></div>';
  out+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn" id="syncSave">Save settings</button><button class="btn ghost" id="syncPull">Pull now</button><button class="btn ghost" id="syncPush">Push now</button><button class="btn danger" id="syncExport">Download backup</button></div>';
  out+='<div class="howto" style="margin-top:18px"><b>One-time setup</b><ol>'+
  '<li>Create a <b>private</b> repo (e.g. <code>tend-data</code>) on GitHub.</li>'+
  '<li>GitHub \u2192 Settings \u2192 Developer settings \u2192 <b>Fine-grained tokens</b> \u2192 Generate new. Give it <b>Contents: Read and write</b> on that repo only.</li>'+
  '<li>Paste the token above and hit <b>Save settings</b>, then <b>Push now</b>.</li>'+
  '<li>Repeat on your phone (same token). Both devices now share one live copy.</li></ol>'+
  '<p style="margin-top:8px">Private repo + your own token = prayer requests and family notes stay between you and GitHub.</p></div>';
  out+='</div></div>';
  return out;
}

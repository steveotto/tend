"use strict";
/* app-todaychip.js - adds the rhythm-health chip (color-coded rounded-square
   dot + %) at the END of every rhythm row in the "Today with ..." queue on
   person profiles. The queue's rhyRowQ is nested inside actQueueHTML (not
   reachable from window), so we wrap the global actQueueHTML and inject the
   chip into the rendered rows. Chip styling is fully inline so it cannot be
   broken by list-specific CSS. Overlay: safe to delete. */
(function(){
 var ORIG=window.actQueueHTML;
 if(!ORIG)return;
 window.actQueueHTML=function(p){
  var html=ORIG.apply(this,arguments);
  try{
   var parts=html.split('<div class="actrow');
   for(var i=1;i<parts.length;i++){
    var seg=parts[i];
    if(seg.indexOf('pill rhy')<0)continue;
    var m=seg.match(/data-(?:rhydone|rhydate|rhyconfirm)="([^"]+)"/);
    if(!m)continue;
    var rid=m[1].split("|")[1];
    var r=(p.rhythms||[]).find(function(x){return x.id===rid;});
    if(!r)continue;
    var sc=rhythmScore(r);
    var chip='<span title="Rhythm health" style="display:inline-flex;align-items:center;gap:5px;margin-left:8px;flex-shrink:0;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap"><span style="width:10px;height:10px;border-radius:3px;flex:none;background:'+personHealthColor(sc)+'"></span><span>'+sc+'%</span></span>';
    var depth=1,idx=0,done=false,replaced="";
    while(!done){
     var nd=seg.indexOf("<div",idx),cd=seg.indexOf("</div>",idx);
     if(cd<0)break;
     if(nd>=0&&nd<cd){depth++;idx=nd+4;}
     else{depth--;if(depth<=0){replaced=seg.slice(0,cd)+chip+seg.slice(cd);done=true;}else{idx=cd+6;}}
    }
    if(done)parts[i]=replaced;
   }
   html=parts.join('<div class="actrow');
  }catch(e){console.error("todaychip",e);}
  return html;
 };
})();

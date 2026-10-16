"use strict";
var tendRhythmArrangeContext=null,tendRhythmDragItem=null,tendRhythmOrderSavePending=false;
function tendRhythmOrderEntries(context){
 var all=S.rhythmOrder&&typeof S.rhythmOrder==="object"?S.rhythmOrder:{};
 return Array.isArray(all[context])?all[context]:[];
}
function tendRhythmOrderSort(context,items,idOf){
 var ranks=Object.create(null);
 tendRhythmOrderEntries(context).forEach(function(id,index){if(!Object.prototype.hasOwnProperty.call(ranks,id))ranks[id]=index;});
 return items.map(function(item,index){var id=idOf(item);return {item:item,index:index,rank:Object.prototype.hasOwnProperty.call(ranks,id)?ranks[id]:Infinity};}).sort(function(a,b){return a.rank===b.rank?a.index-b.index:a.rank-b.rank;}).map(function(entry){return entry.item;});
}
function tendRhythmOrderMode(context){return tendRhythmArrangeContext===context;}
function tendRhythmOrderToolbar(context,count,className){
 var arranging=tendRhythmOrderMode(context);
 if(!arranging&&count<2)return "";
 return '<div class="rhythm-order-toolbar '+(className||"")+'"><button type="button" class="rhythm-order-mode" data-rhythm-order-action="toggle" data-rhythm-order-context="'+esc(context)+'" aria-pressed="'+arranging+'">'+(arranging?"Done":"Arrange")+'</button>'+
  (arranging?'<button type="button" class="rhythm-order-reset" data-rhythm-order-action="reset" data-rhythm-order-context="'+esc(context)+'">Reset order</button>':"")+
  '<span class="rhythm-order-live" data-rhythm-order-status="'+esc(context)+'" role="status" aria-live="polite" aria-atomic="true"></span></div>';
}
function tendRhythmOrderListAttributes(context,allIds,modeContext){
 if(!tendRhythmOrderMode(modeContext||context))return "";
 return ' data-rhythm-order-list data-rhythm-order-context="'+esc(context)+'" data-rhythm-order-mode-context="'+esc(modeContext||context)+'" data-rhythm-order-all-ids="'+esc(JSON.stringify(allIds||[]))+'"';
}
function tendRhythmOrderItemHTML(context,modeContext,id,title,index,count,content){
 if(!tendRhythmOrderMode(modeContext))return content;
 var upDisabled=index===0?" disabled":"",downDisabled=index===count-1?" disabled":"";
 return '<div class="rhythm-order-item" data-rhythm-order-item data-rhythm-order-id="'+esc(id)+'" data-rhythm-order-context="'+esc(context)+'" data-rhythm-order-title="'+esc(title||"Rhythm")+'"><div class="rhythm-order-controls">'+
  '<button type="button" class="rhythm-order-handle" draggable="true" data-rhythm-order-handle aria-label="Drag to reorder '+esc(title||"rhythm")+'" title="Drag to reorder">⠿</button>'+
  '<span class="rhythm-order-move-controls"><button type="button" data-rhythm-order-action="move-up" data-rhythm-order-context="'+esc(context)+'" data-rhythm-order-id="'+esc(id)+'" aria-label="Move '+esc(title||"rhythm")+' up"'+upDisabled+'>Move up</button><button type="button" data-rhythm-order-action="move-down" data-rhythm-order-context="'+esc(context)+'" data-rhythm-order-id="'+esc(id)+'" aria-label="Move '+esc(title||"rhythm")+' down"'+downDisabled+'>Move down</button></span></div>'+content+'</div>';
}
function tendRhythmOrderStatus(context,message){
 var status=Array.prototype.find.call(document.querySelectorAll("[data-rhythm-order-status]"),function(node){return node.getAttribute("data-rhythm-order-status")===context;});
 if(status)status.textContent=message;
}
function tendRhythmOrderFocus(context,id){
 requestAnimationFrame(function(){
  var selector='[data-rhythm-order-context="'+CSS.escape(context)+'"][data-rhythm-order-item][data-rhythm-order-id="'+CSS.escape(id)+'"] [data-rhythm-order-handle]';
  var handle=document.querySelector(selector);
  if(handle)handle.focus({preventScroll:true});
  else{
   var done=document.querySelector('[data-rhythm-order-action="toggle"][data-rhythm-order-context="'+CSS.escape(context)+'"]');
   if(done)done.focus({preventScroll:true});
  }
 });
}
function tendRhythmOrderPersist(context,allIds,visibleIds,nextVisibleIds){
 var existing=tendRhythmOrderEntries(context),valid=existing.filter(function(id,index){return typeof id==="string"&&existing.indexOf(id)===index;}),combined=valid.slice();
 (allIds||[]).forEach(function(id){if(typeof id==="string"&&combined.indexOf(id)<0)combined.push(id);});
 visibleIds.forEach(function(id){if(combined.indexOf(id)<0)combined.push(id);});
 var visibleSet=Object.create(null);visibleIds.forEach(function(id){visibleSet[id]=true;});
 var nextIndex=0;
 combined=combined.map(function(id){return visibleSet[id]?nextVisibleIds[nextIndex++]:id;});
 if(!S.rhythmOrder||typeof S.rhythmOrder!=="object"||Array.isArray(S.rhythmOrder))S.rhythmOrder={};
 var previous=S.rhythmOrder[context];
 S.rhythmOrder[context]=combined;
 try{
  if(window.TEND_CLOUD_MODE&&(!window.TendCloudPersistence||!window.TendCloudPersistence.isReady()))throw new Error("Your account is still loading.");
  save();
 }catch(error){
  if(previous===undefined)delete S.rhythmOrder[context];else S.rhythmOrder[context]=previous;
  if(!Object.keys(S.rhythmOrder).length)delete S.rhythmOrder;
  tendRhythmOrderSavePending=false;
  flash("Could not save rhythm order. "+(error&&error.message||"Try again."));
  return false;
 }
 if(window.TEND_CLOUD_MODE){tendRhythmOrderSavePending=true;flash("Saving rhythm order…");}
 else flash("Rhythm order saved");
 return true;
}
function tendRhythmOrderMove(context,list,fromIndex,toIndex){
 var rows=Array.prototype.filter.call(list.children,function(child){return child.hasAttribute("data-rhythm-order-item");});
 if(fromIndex<0||toIndex<0||fromIndex>=rows.length||toIndex>=rows.length||fromIndex===toIndex)return false;
 var visibleIds=rows.map(function(row){return row.getAttribute("data-rhythm-order-id");}),next=visibleIds.slice(),moved=next.splice(fromIndex,1)[0];
 next.splice(toIndex,0,moved);
 var allIds=[];
 try{allIds=JSON.parse(list.getAttribute("data-rhythm-order-all-ids")||"[]");}catch(error){}
 if(!tendRhythmOrderPersist(context,allIds,visibleIds,next))return false;
 var title=rows[fromIndex].getAttribute("data-rhythm-order-title")||"Rhythm",direction=toIndex<fromIndex?"up":"down";
 tendRhythmArrangeContext=list.getAttribute("data-rhythm-order-mode-context")||tendRhythmArrangeContext;
 render();
 tendRhythmOrderStatus(tendRhythmArrangeContext,title+" moved "+direction+".");
 tendRhythmOrderFocus(tendRhythmArrangeContext,moved);
 return true;
}
function tendRhythmOrderReset(context){
 if(!S.rhythmOrder||typeof S.rhythmOrder!=="object")return false;
 var keys=context==="today"?Object.keys(S.rhythmOrder).filter(function(key){return key.indexOf("today:")===0;}):[context],previous={};
 keys.forEach(function(key){if(Object.prototype.hasOwnProperty.call(S.rhythmOrder,key)){previous[key]=S.rhythmOrder[key];delete S.rhythmOrder[key];}});
 if(!Object.keys(previous).length)return false;
 if(!Object.keys(S.rhythmOrder).length)delete S.rhythmOrder;
 try{
  if(window.TEND_CLOUD_MODE&&(!window.TendCloudPersistence||!window.TendCloudPersistence.isReady()))throw new Error("Your account is still loading.");
  save();
 }catch(error){
  if(!S.rhythmOrder||typeof S.rhythmOrder!=="object")S.rhythmOrder={};
  Object.keys(previous).forEach(function(key){S.rhythmOrder[key]=previous[key];});
  flash("Could not reset rhythm order. "+(error&&error.message||"Try again."));
  return false;
 }
 if(window.TEND_CLOUD_MODE){tendRhythmOrderSavePending=true;flash("Saving rhythm order reset…");}else flash("Rhythm order reset");
 return true;
}
function tendRhythmOrderRowAction(button){
 var context=button.getAttribute("data-rhythm-order-context"),list=button.closest("[data-rhythm-order-list]");
 if(!list||list.getAttribute("data-rhythm-order-context")!==context)return false;
 var rows=Array.prototype.filter.call(list.children,function(child){return child.hasAttribute("data-rhythm-order-item");}),index=rows.findIndex(function(row){return row.getAttribute("data-rhythm-order-id")===button.getAttribute("data-rhythm-order-id");});
 return tendRhythmOrderMove(context,list,index,index+(button.getAttribute("data-rhythm-order-action")==="move-up"?-1:1));
}
document.addEventListener("click",function(event){
 var button=event.target&&event.target.closest&&event.target.closest("[data-rhythm-order-action]");
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 var action=button.getAttribute("data-rhythm-order-action"),context=button.getAttribute("data-rhythm-order-context");
 if(action==="toggle"){
  if(tendRhythmDragItem)tendRhythmDragItem.classList.remove("is-dragging");
  tendRhythmDragItem=null;
  tendRhythmArrangeContext=tendRhythmOrderMode(context)?null:context;
  render();
  requestAnimationFrame(function(){var next=document.querySelector('[data-rhythm-order-action="toggle"][data-rhythm-order-context="'+CSS.escape(context)+'"]');if(next)next.focus({preventScroll:true});});
  return;
 }
 if(action==="reset"){
  tendRhythmOrderReset(context);
  render();requestAnimationFrame(function(){var next=document.querySelector('[data-rhythm-order-action="toggle"][data-rhythm-order-context="'+CSS.escape(context)+'"]');if(next)next.focus({preventScroll:true});});return;
 }
 if(action==="move-up"||action==="move-down")tendRhythmOrderRowAction(button);
},true);
window.addEventListener("blur",function(){
 if(tendRhythmDragItem)tendRhythmDragItem.classList.remove("is-dragging");
 tendRhythmDragItem=null;
});
document.addEventListener("dragstart",function(event){
 var handle=event.target&&event.target.closest&&event.target.closest("[data-rhythm-order-handle]"),row=handle&&handle.closest("[data-rhythm-order-item]");
 if(!row||!tendRhythmOrderMode(row.closest("[data-rhythm-order-list]")&&row.closest("[data-rhythm-order-list]").getAttribute("data-rhythm-order-mode-context")))return;
 tendRhythmDragItem=row;
 if(event.dataTransfer){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",row.getAttribute("data-rhythm-order-id"));}
 row.classList.add("is-dragging");
},true);
document.addEventListener("dragover",function(event){
 var target=event.target&&event.target.closest&&event.target.closest("[data-rhythm-order-item]"),list=target&&target.closest("[data-rhythm-order-list]");
 if(!tendRhythmDragItem||!target||!list||target.parentNode!==tendRhythmDragItem.parentNode)return;
 event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="move";
},true);
document.addEventListener("drop",function(event){
 var target=event.target&&event.target.closest&&event.target.closest("[data-rhythm-order-item]"),list=target&&target.closest("[data-rhythm-order-list]");
 if(!tendRhythmDragItem||!target||!list||target.parentNode!==tendRhythmDragItem.parentNode)return;
 event.preventDefault();
 var rows=Array.prototype.filter.call(list.children,function(child){return child.hasAttribute("data-rhythm-order-item");}),from=rows.indexOf(tendRhythmDragItem),to=rows.indexOf(target),context=list.getAttribute("data-rhythm-order-context");
 tendRhythmDragItem.classList.remove("is-dragging");tendRhythmDragItem=null;
 tendRhythmOrderMove(context,list,from,to);
},true);
document.addEventListener("dragend",function(){
 if(tendRhythmDragItem)tendRhythmDragItem.classList.remove("is-dragging");
 tendRhythmDragItem=null;
},true);
if(typeof window!=="undefined")window.addEventListener("tend-cloud-status",function(event){
 if(!tendRhythmOrderSavePending)return;
 var status=event.detail&&event.detail.status;
 if(status==="Saved"){tendRhythmOrderSavePending=false;flash("Rhythm order saved");}
 else if(status==="Needs attention"){tendRhythmOrderSavePending=false;flash("Rhythm order could not sync. Check your connection.");}
 else if(status==="Offline"){tendRhythmOrderSavePending=false;flash("Rhythm order saved on this device; sync when online.");}
});
window.tendRhythmOrderSort=tendRhythmOrderSort;
window.tendRhythmOrderMode=tendRhythmOrderMode;
window.tendRhythmOrderToolbar=tendRhythmOrderToolbar;
window.tendRhythmOrderListAttributes=tendRhythmOrderListAttributes;
window.tendRhythmOrderItemHTML=tendRhythmOrderItemHTML;

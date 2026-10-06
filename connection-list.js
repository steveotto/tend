"use strict";
function openConnectionList(personId){
 var person=S.people.find(function(item){return item.id===personId;});if(!person)return;
 var events=S.events.filter(function(event){return eventHasPerson(event,personId)&&connectionEvent(event);}).sort(function(a,b){return b.ts-a.ts;});
 var dialog=document.createElement("dialog");dialog.className="rhythm-history-dialog connection-list-dialog";dialog.setAttribute("aria-labelledby","connectionListTitle");
 dialog.innerHTML='<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="connectionListTitle">All connections</h2><p class="history-rhythm-details">'+events.length+' logged connection'+(events.length===1?"":"s")+'</p></div><button class="iconbtn" data-connection-list-close aria-label="Close all connections">✕</button></div><div class="connection-list connection-list-modal">'+events.map(function(event){return rippleLine(event);}).join("")+'</div>';
 dialog.addEventListener("click",function(event){if(event.target.closest("[data-connection-list-close]"))dialog.close();});
 dialog.addEventListener("close",function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();
}

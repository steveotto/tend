"use strict";
function openConnectionList(personId){
 var person=S.people.find(function(item){return item.id===personId;});if(!person)return;
 var events=S.events.filter(function(event){return eventHasPerson(event,personId)&&connectionEvent(event);}).sort(function(a,b){return b.ts-a.ts;});
 var dialog=document.createElement("dialog");dialog.className="rhythm-history-dialog connection-list-dialog";dialog.setAttribute("data-connection-list-person",personId);dialog.setAttribute("aria-labelledby","connectionListTitle");
 dialog.innerHTML='<div class="history-person"><span class="history-person-avatar">'+personAvatar(person,42)+'</span><strong>'+esc(person.name)+'</strong></div><div class="history-heading"><div><h2 id="connectionListTitle">All connections</h2><p class="history-rhythm-details">'+events.length+' logged connection'+(events.length===1?"":"s")+'</p></div><button class="iconbtn" data-connection-list-close aria-label="Close all connections">✕</button></div><div class="connection-list connection-list-modal">'+events.map(function(event){return rippleLine(event);}).join("")+'</div>';
 dialog.addEventListener("click",function(event){if(event.target.closest("[data-connection-list-close]"))dialog.close();});
 dialog.addEventListener("close",function(){dialog.remove();});document.body.appendChild(dialog);tendShowModal(dialog);
}
function refreshConnectionListDialog(){
 var dialog=document.querySelector(".connection-list-dialog[data-connection-list-person]");if(!dialog)return;
 var personId=dialog.getAttribute("data-connection-list-person"),events=S.events.filter(function(event){return eventHasPerson(event,personId)&&connectionEvent(event);}).sort(function(a,b){return b.ts-a.ts;}),person=S.people.find(function(item){return item.id===personId;});
 var count=dialog.querySelector(".history-rhythm-details"),list=dialog.querySelector(".connection-list-modal");
 if(count)count.textContent=events.length+" logged connection"+(events.length===1?"":"s");
 if(list)list.innerHTML=events.map(function(event){return rippleLine(event);}).join("");
 if(!person)dialog.close();
}

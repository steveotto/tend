"use strict";
/* ============ chip navigation: person chips on area tabs open the profile ============ */
(function(){
var css=document.createElement("style");css.textContent=".person-card{padding-top:34px}.submeter[data-person]{cursor:pointer}.submeter[data-person]:hover{background:rgba(32,39,35,.05)}";document.head.appendChild(css);
document.addEventListener("click",function(e){
 var t=e.target;if(!t||!t.closest)return;
 var sm=t.closest(".submeter[data-person]");
 if(!sm)return;
 if(t.closest("[data-openperson]"))return; /* the whole card already handles it */
 var pid=sm.getAttribute("data-person");
 if(window.openPersonTab&&S.people.some(function(x){return x.id===pid;})){openPersonTab(pid);}
});
})();

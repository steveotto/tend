"use strict";
/* ============ person links: EVERY avatar/badge opens that person's profile ============ */
(function(){
var css=document.createElement("style");
css.textContent="[data-person]{cursor:pointer}.avatar[data-person]:hover{box-shadow:0 0 0 2px rgba(36,107,82,.25)}";
document.head.appendChild(css);
/* stamp a data-person id onto every avatar rendered through the central helper */
var _pa=personAvatar;
window.personAvatar=personAvatar=function(p,sz){
 var html=_pa(p,sz);
 if(p&&p.id&&typeof html==="string")html=html.replace('class="avatar','data-person="'+p.id+'" class="avatar');
 return html;
};
/* one delegated handler: click a person badge (or a chip that contains one) */
document.addEventListener("click",function(e){
 var t=e.target;if(!t||!t.closest)return;
 /* yield to existing interactive controls that already handle their own clicks */
 if(t.closest("button, a, select, input, textarea, label, .submeter, [data-openperson], [data-personrhythms]"))return;
 var chip=t.closest(".prayer-person");
 var hit=t.closest("[data-person]")||(chip&&chip.querySelector("[data-person]"));
 if(!hit)return;
 var pid=hit.getAttribute("data-person");
 if(pid&&window.openPersonTab&&S.people.some(function(x){return x.id===pid;})){openPersonTab(pid);}
});
})();

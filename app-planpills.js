"use strict";
/* ============ Today plan pills: show ALL people on multi-person items ============ */
(function(){
var css=document.createElement("style");css.textContent=".plan-pills{flex-wrap:wrap}";document.head.appendChild(css);
window.planPills=function(it){
 var rhythmKey=it.rhythm||it.rkey,kind=rhythmKey||it.faithRhythm?"rhythm":it.spark||it.sparky?"spark":it.prayer?"prayer":"";
 var person=it.personId&&S.people.find(function(p){return p.id===it.personId;}),personBadge=person&&person.id!==currentPerson&&kind!=="spark"&&kind!=="prayer"?'<button type="button" class="prayer-person person-badge-clickable" data-personbadge="'+esc(person.id)+'|'+(kind||"")+'" aria-label="Open '+esc(person.name)+' '+esc(kind?kind+"s":"profile")+'">'+personAvatar(person,24)+esc(person.name)+'</button>':"";
 var typeBadge=kind?'<button type="button" class="pill person-section-badge plan-kind-'+(kind==="rhythm"?"rhythm":kind==="spark"?"spark":"prayer")+'"'+(person?' data-personbadge="'+esc(person.id+"|"+kind)+'" aria-label="Open '+esc(person.name)+' '+esc(kind+"s")+'"':' disabled')+'>'+collectionIcon(kind==="rhythm"?"rhythms":kind==="spark"?"sparks":"prayer")+' '+(kind==="rhythm"?"Rhythm":kind==="spark"?"Spark":"Prayer")+'</button>':"";
 var record=null;
 if(rhythmKey){var ids=String(rhythmKey).split("|"),owner=S.people.find(function(p){return p.id===ids[0];});record=owner&&(owner.rhythms||[]).find(function(r){return r.id===ids[1];});}
 else if(it.faithRhythm)record=typeof faithFindRhythm==="function"?faithFindRhythm(it.faithRhythm):null;
 else if(it.spark){var sparkIds=String(it.spark).split("|"),sparkOwner=S.people.find(function(p){return p.id===sparkIds[0];});record=sparkOwner&&(sparkOwner.sparks||[]).find(function(spark){return spark.id===sparkIds[1];});}
 else if(it.prayer){var prayer=(S.prayers||[]).find(function(p){return p.id===it.prayer;});if(prayer){var areas={Marriage:"marriage",Kids:"parenting",Friends:"friendships",Faith:"faith"};record=Object.assign({},prayer,{areas:(prayer.areas||[]).slice(),faithGroup:prayer.faithSection||prayer.faithGroup});if(areas[prayer.category]&&record.areas.indexOf(areas[prayer.category])===-1)record.areas.unshift(areas[prayer.category]);}}
 var area=it.area||(it.log&&it.log.area);
 if(!record&&area)record={areas:[area]};
 var categories=record&&typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(record):"";
 var associationBadges=record&&kind==="spark"&&typeof tendAssociationPeopleBadges==="function"?tendAssociationPeopleBadges(record,String(it.spark).split("|")[0],currentPerson,"spark"):"";
 if(record&&kind==="prayer"&&typeof tendAssociationPeopleBadges==="function")associationBadges=tendAssociationPeopleBadges(record,record.personId||"global",currentPerson,"prayer");
 var ownerBadge=record&&kind==="prayer"&&record.faithOwner==="me"&&!record.personId?'<span class="prayer-person">'+personAvatar({name:"Me",photo:settings().profilePhoto},24)+'Me</span>':"";
 var areaPill=!person&&!kind&&area&&S.areas[area]?'<span class="plan-kind">'+esc(S.areas[area].name)+'</span>':"";
 return personBadge+ownerBadge+associationBadges+typeBadge+categories+areaPill;
};
})();
var DEFAULT_BADGE_COLORS={rhythm:"#246B52",spark:"#67C5A3",prayer:"#5E6B63",faith:"#202723"};
function badgeColorSettings(){
 var stored=settings().badgeColors||{},colors={};
 Object.keys(DEFAULT_BADGE_COLORS).forEach(function(key){colors[key]=/^#[0-9a-fA-F]{6}$/.test(stored[key]||"")?stored[key]:DEFAULT_BADGE_COLORS[key];});
 return colors;
}
function applyBadgeColors(){
 var colors=badgeColorSettings(),root=document.documentElement;
 Object.keys(colors).forEach(function(key){root.style.setProperty("--badge-"+key+"-color",colors[key]);});
}
applyBadgeColors();

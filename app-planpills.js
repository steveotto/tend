"use strict";
/* ============ Today plan pills: show ALL people on multi-person items ============ */
(function(){
var css=document.createElement("style");css.textContent=".plan-pills{flex-wrap:wrap}";document.head.appendChild(css);
window.planPills=function(it){
 var rhythmKey=it.rhythm||it.rkey,kind=rhythmKey||it.faithRhythm?"rhythm":it.spark||it.sparky?"spark":it.prayer?"prayer":"";
 var person=it.personId&&S.people.find(function(p){return p.id===it.personId;}),personBadge=person&&person.id!==currentPerson&&kind!=="spark"&&kind!=="prayer"?'<button type="button" class="prayer-person person-badge-clickable" data-personbadge="'+esc(person.id)+'|'+(kind||"")+'" aria-label="Open '+esc(person.name)+' '+esc(kind?kind+"s":"profile")+'">'+personAvatar(person,24)+esc(person.name)+'</button>':"";
 var typeBadge=kind&&!it.hideTypeBadge?'<button type="button" class="pill person-section-badge plan-kind-'+(kind==="rhythm"?"rhythm":kind==="spark"?"spark":"prayer")+'"'+(person?' data-personbadge="'+esc(person.id+"|"+kind)+'" aria-label="Open '+esc(person.name)+' '+esc(kind+"s")+'"':' disabled')+'>'+collectionIcon(kind==="rhythm"?"rhythms":kind==="spark"?"sparks":"prayer")+' '+(kind==="rhythm"?"Rhythm":kind==="spark"?"Spark":"Prayer")+'</button>':"";
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
var DEFAULT_ACTION_COLORS={rhythm:"#246B52",spark:"#D4A43A",prayer:"#8B78A6"};
var LEGACY_ACTION_PALETTE_COLORS={rhythm:"#246B52",spark:"#67C5A3",prayer:"#5E6B63"};
var CALIBRATED_ACTION_PALETTES={
 rhythm:{background:"#E3F6ED",border:"#B8E1CA",text:"#1C5844",hover:"#D2EEDD",active:"#C4E8D4",focus:"#1C5844"},
 spark:{background:"#FFF3C4",border:"#E8CF74",text:"#735B16",hover:"#FCE9A2",active:"#F7DF82",focus:"#735B16"},
 prayer:{background:"#F0EAF5",border:"#D2C5DF",text:"#705A8D",hover:"#E6DCEE",active:"#DCCEE8",focus:"#705A8D"}
};
function actionColorSettings(){
 var stored=settings().actionColors||{},legacy=settings().badgeColors||{},colors={};
 Object.keys(DEFAULT_ACTION_COLORS).forEach(function(key){
  var value=stored[key],old=legacy[key];
  if(!/^#[0-9a-fA-F]{6}$/.test(value||""))value=/^#[0-9a-fA-F]{6}$/.test(old||"")&&old.toLowerCase()!==LEGACY_ACTION_PALETTE_COLORS[key].toLowerCase()?old:DEFAULT_ACTION_COLORS[key];
  colors[key]=value.toUpperCase();
 });
 return colors;
}
function actionHexRgb(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
function actionRgbHex(rgb){return "#"+rgb.map(function(channel){return Math.round(channel).toString(16).padStart(2,"0");}).join("").toUpperCase();}
function actionMix(a,b,amount){var ca=actionHexRgb(a),cb=actionHexRgb(b);return actionRgbHex(ca.map(function(channel,index){return channel+(cb[index]-channel)*amount;}));}
function actionLuminance(hex){return actionHexRgb(hex).map(function(channel){var value=channel/255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);}).reduce(function(sum,value,index){return sum+value*[.2126,.7152,.0722][index];},0);}
function actionContrast(a,b){var values=[actionLuminance(a),actionLuminance(b)].sort(function(x,y){return y-x;});return (values[0]+.05)/(values[1]+.05);}
function generatedActionPalette(key,color){
 var calibrated=CALIBRATED_ACTION_PALETTES[key];
 if(color.toLowerCase()===DEFAULT_ACTION_COLORS[key].toLowerCase())return calibrated;
 var background=actionMix(color,"#FFFFFF",.88),text=color;
 for(var i=0;i<20&&actionContrast(text,background)<4.5;i++)text=actionMix(text,"#000000",.08);
 if(actionContrast(text,background)<4.5)text="#000000";
 return {background:background,border:actionMix(color,"#FFFFFF",.54),text:text,hover:actionMix(color,"#FFFFFF",.80),active:actionMix(color,"#FFFFFF",.70),focus:text};
}
function applyActionColors(){
 var colors=actionColorSettings(),root=document.documentElement;
 Object.keys(colors).forEach(function(key){
  var palette=generatedActionPalette(key,colors[key]),prefix="--action-"+key+"-";
  root.style.setProperty(prefix+"base",colors[key]);
  root.style.setProperty(prefix+"background",palette.background);
  root.style.setProperty(prefix+"border",palette.border);
  root.style.setProperty(prefix+"text",palette.text);
  root.style.setProperty(prefix+"hover",palette.hover);
  root.style.setProperty(prefix+"active",palette.active);
  root.style.setProperty(prefix+"focus",palette.focus);
 });
}
applyBadgeColors();
applyActionColors();

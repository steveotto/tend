"use strict";
/* ============ typeLabel: preserve connection labels in activity history ============ */
window.typeLabel=function(e){
 if(e&&e.rippleLabel)return e.rippleLabel==="One-on-One"?"In Person":e.rippleLabel;
 return e&&e.type&&ETYPES[e.type]?ETYPES[e.type].label:(KINDS[e.kind]?KINDS[e.kind].label:e.kind);
};

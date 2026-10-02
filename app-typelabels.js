"use strict";
/* ============ typeLabel: goal completions show clock time, not "Handwritten Note" ============ */
window.typeLabel=function(e){
 if(e&&e.goalId)return (typeof fmtHM==="function")?fmtHM(e.ts):"Goal"; /* a goal check-off is not a handwritten note */
 if(e&&e.rippleLabel)return e.rippleLabel==="One-on-One"?"In Person":e.rippleLabel;
 return e&&e.type&&ETYPES[e.type]?ETYPES[e.type].label:(KINDS[e.kind]?KINDS[e.kind].label:e.kind);
};

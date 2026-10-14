"use strict";
/* Fitness persistence adapter: records remain part of Tend's regular state and save/sync lifecycle. */
function fitnessStoreSnapshot(){
 var data=ensureFitnessShape({fitness:S.fitness||{}}).fitness;
 return JSON.parse(JSON.stringify(data));
}
function fitnessStoreUpdateSettings(patch){
 var data=ensureFitnessShape({fitness:S.fitness||{}}).fitness;
 Object.keys(patch||{}).forEach(function(key){data.settings[key]=patch[key];});
 S.fitness=data;save();
}
function fitnessSyncRhythmCompletion(record){
 if(!Array.isArray(S.events))S.events=[];
 S.events=S.events.filter(function(event){return event.fitnessLogId!==record.id;});
 if(!record.rhythmId)return;
 var rhythm=(S.fitness.rhythms||[]).find(function(item){return item.id===record.rhythmId;});
 if(!rhythm||!fitnessValidDate(record.rhythmOccurrence))return;
 var time=new Date(record.rhythmOccurrence+"T12:00:00").getTime();
 S.events.push({id:"fitness-rhythm-"+record.id,ts:time,areaId:"health",personId:null,type:"quality",kind:"quality",title:rhythm.text,note:"Fitness log",rhythmId:rhythm.id,fitnessLogId:record.id,rhythmOccurrence:record.rhythmOccurrence,fitnessType:record.fitnessType||"workout",weight:3});
}
function fitnessStoreUpsert(collection,record){
 if(["savedWorkouts","workouts","runs","weighIns","rhythms"].indexOf(collection)<0)throw new Error("Unknown fitness record collection");
 var data=ensureFitnessShape({fitness:S.fitness||{}}).fitness,records=data[collection],index=records.findIndex(function(item){return item.id===record.id;});
 if(index<0)records.push(record);else records[index]=record;
 if(["workouts","runs","weighIns"].indexOf(collection)>=0)fitnessSyncRhythmCompletion(record);
 S.fitness=data;save();
}
function fitnessStoreDelete(collection,id){
 if(["savedWorkouts","workouts","runs","weighIns","rhythms"].indexOf(collection)<0)throw new Error("Unknown fitness record collection");
 var data=ensureFitnessShape({fitness:S.fitness||{}}).fitness,before=data[collection].length;
 data[collection]=data[collection].filter(function(item){return item.id!==id;});
 if(before===data[collection].length)return false;
 if(["workouts","runs","weighIns"].indexOf(collection)>=0)S.events=S.events.filter(function(event){return event.fitnessLogId!==id;});
 S.fitness=data;save();return true;
}
function fitnessStoreReplaceState(state){
 if(!state||typeof state!=="object"||Array.isArray(state))throw new Error("Backup must contain a Tend state object");
 S=ensureShape(state);save();
}
document.addEventListener("click",function(event){
 var button=event.target&&event.target.closest&&event.target.closest("#syncImport");
 if(!button)return;
 var input=document.getElementById("syncImportFile");
 if(input)input.click();
});
document.addEventListener("change",function(event){
 var input=event.target&&event.target.closest&&event.target.closest("#syncImportFile"),file=input&&input.files&&input.files[0];
 if(!file)return;
 var reader=new FileReader();
 reader.onerror=function(){flash("Could not read that backup file");input.value="";};
 reader.onload=function(){
  var imported;
  try{imported=JSON.parse(String(reader.result||""));}catch(error){flash("That backup file is not valid JSON");input.value="";return;}
  if(!window.confirm("Replace all Tend data on this device with the backup?")){input.value="";return;}
  try{fitnessStoreReplaceState(imported);flash("Backup imported");render();}
  catch(error){console.error(error);flash(error.message||"Could not import that backup");}
  input.value="";
 };
 reader.readAsText(file);
});

"use strict";
/* Pure Health & Fitness calendar, consistency, and goal-progress calculations. */
var FITNESS_MUSCLES=[
 {id:"chest",name:"Chest",group:"Upper body",front:true,back:false},
 {id:"back",name:"Back",group:"Upper body",front:false,back:true},
 {id:"biceps",name:"Biceps",group:"Upper body",front:true,back:false},
 {id:"triceps",name:"Triceps",group:"Upper body",front:false,back:true},
 {id:"shoulders",name:"Shoulders",group:"Upper body",front:true,back:true},
 {id:"abs",name:"Abs",group:"Core",front:true,back:false},
 {id:"quads",name:"Quads",group:"Lower body",front:true,back:false},
 {id:"hamstrings",name:"Hamstrings",group:"Lower body",front:false,back:true},
 {id:"calves",name:"Calves",group:"Lower body",front:true,back:true}
];
function fitnessValidDate(value){
 var match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
 if(!match)return false;
 var year=+match[1],month=+match[2],day=+match[3],date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
function fitnessDayNumber(value){
 if(!fitnessValidDate(value))return null;
 var parts=String(value).split("-").map(Number);
 return Math.floor(Date.UTC(parts[0],parts[1]-1,parts[2])/86400000);
}
function fitnessDateDifference(fromDate,toDate){
 var from=fitnessDayNumber(fromDate),to=fitnessDayNumber(toDate);
 return from===null||to===null?null:to-from;
}
function fitnessLocalDate(date){
 return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function fitnessShiftDate(value,days){
 if(!fitnessValidDate(value))return "";
 var parts=String(value).split("-").map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);
 date.setDate(date.getDate()+days);return fitnessLocalDate(date);
}
function fitnessWeekStart(today){
 if(!fitnessValidDate(today))return "";
 var day=fitnessDayNumber(today),weekday=new Date(day*86400000).getUTCDay();
 return fitnessShiftDate(today,-((weekday+6)%7));
}
function fitnessMuscleScores(data,today){
 var settings=data&&data.settings||{},intervals=settings.muscleIntervals||{},restDays=settings.preferredRestDays||{},workouts=data&&Array.isArray(data.workouts)?data.workouts:[];
 return FITNESS_MUSCLES.map(function(muscle){
  var trainedDates=workouts.filter(function(workout){return fitnessValidDate(workout.date)&&workout.date<=today&&Array.isArray(workout.muscleIds)&&workout.muscleIds.indexOf(muscle.id)>=0;}).map(function(workout){return workout.date;}).sort();
  var lastTrained=trainedDates.length?trainedDates[trainedDates.length-1]:null,interval=Number(intervals[muscle.id]),intervalDays=Number.isInteger(interval)&&interval>0?interval:null,rest=Number(restDays[muscle.id]),preferredRestDays=Number.isInteger(rest)&&rest>=0?rest:muscle.id==="abs"?0:1;
  if(!lastTrained||intervalDays===null)return {id:muscle.id,name:muscle.name,group:muscle.group,intervalDays:intervalDays,preferredRestDays:preferredRestDays,lastTrained:lastTrained,daysSince:null,daysUntilDue:null,restDaysRemaining:0,eligible:true,score:null,status:"Not logged yet.",consistencyStatus:"Not logged yet."};
  var daysSince=Math.max(0,fitnessDateDifference(lastTrained,today)),daysUntilDue=intervalDays-daysSince,score=Math.max(0,100-10*Math.max(0,daysSince-intervalDays)),restDaysRemaining=preferredRestDays===0?0:Math.max(0,preferredRestDays+1-daysSince),eligible=restDaysRemaining===0,consistencyStatus=daysUntilDue>0?"Due in "+daysUntilDue+" "+(daysUntilDue===1?"day.":"days."):daysUntilDue===0?"Due today.":Math.abs(daysUntilDue)+" "+(Math.abs(daysUntilDue)===1?"day":"days")+" overdue.";
  return {id:muscle.id,name:muscle.name,group:muscle.group,intervalDays:intervalDays,preferredRestDays:preferredRestDays,lastTrained:lastTrained,daysSince:daysSince,daysUntilDue:daysUntilDue,restDaysRemaining:restDaysRemaining,eligible:eligible,score:score,status:eligible?consistencyStatus:"Resting · ready in "+restDaysRemaining+" "+(restDaysRemaining===1?"day.":"days."),consistencyStatus:consistencyStatus};
 });
}
function fitnessStrengthScore(scores){
 var valid=(scores||[]).map(function(item){return item.score;}).filter(Number.isFinite);
 return valid.length?Math.round(valid.reduce(function(total,value){return total+value;},0)/valid.length):null;
}
function fitnessOverallScore(strength,cardio,weight){
 var available=[strength,cardio,weight].filter(Number.isFinite);
 return available.length?Math.round(available.reduce(function(total,value){return total+value;},0)/available.length):null;
}
function fitnessRankSavedWorkouts(scores,savedWorkouts){
 var tracked=(scores||[]).filter(function(item){return Number.isFinite(item.score);}),totalDeficit=tracked.reduce(function(total,item){return total+100-item.score;},0);
 if(!totalDeficit)return [];
 return (savedWorkouts||[]).map(function(workout){
  var muscleIds=Array.isArray(workout.muscleIds)?Array.from(new Set(workout.muscleIds)):[],muscles=muscleIds.map(function(id){return (scores||[]).find(function(item){return item.id===id;});}).filter(Boolean);
  if(!muscles.length||muscles.some(function(item){return !item.eligible;}))return null;
  var overdue=muscles.filter(function(item){return Number.isFinite(item.score)&&item.score<100;}),coveredDeficit=overdue.reduce(function(total,item){return total+100-item.score;},0);
  if(!coveredDeficit)return null;
  var focusRatio=overdue.length/muscles.length,priorityImpact=100*(coveredDeficit/totalDeficit)*focusRatio;
  return {id:workout.id,name:workout.name,muscleIds:muscleIds,overdue:overdue.map(function(item){return {id:item.id,name:item.name,daysOverdue:Math.max(0,item.daysSince-item.intervalDays)};}),priorityImpact:priorityImpact,expectedStrengthIncrease:coveredDeficit/tracked.length};
 }).filter(Boolean).sort(function(a,b){return b.priorityImpact-a.priorityImpact||a.name.localeCompare(b.name);}).slice(0,2);
}
function fitnessCardioProgress(data,today){
 var settings=data&&data.settings||{},runs=data&&Array.isArray(data.runs)?data.runs:[],weekStart=fitnessWeekStart(today),weekEnd=fitnessShiftDate(weekStart,6);
 var current=runs.filter(function(run){return fitnessValidDate(run.date)&&run.date>=weekStart&&run.date<=today;});
 var completedRuns=current.length,completedMiles=current.reduce(function(total,run){var distance=Number(run.distance);return total+(Number.isFinite(distance)&&distance>0?distance:0);},0);
 var targetRuns=Number(settings.weeklyRunTarget),targetMiles=Number(settings.weeklyMileTarget);
 var validRunTarget=Number.isInteger(targetRuns)&&targetRuns>0?targetRuns:null,validMileTarget=Number.isFinite(targetMiles)&&targetMiles>0?targetMiles:null;
 var runProgress=validRunTarget===null?null:Math.min(100,completedRuns/validRunTarget*100),mileageProgress=validMileTarget===null?null:Math.min(100,completedMiles/validMileTarget*100);
 var score=runProgress===null||mileageProgress===null?null:Math.round(Math.min(runProgress,mileageProgress));
 var days=Array.from({length:7},function(_,index){var date=fitnessShiftDate(weekStart,index);return {date:date,count:current.filter(function(run){return run.date===date;}).length,miles:current.filter(function(run){return run.date===date;}).reduce(function(total,run){return total+(Number(run.distance)||0);},0)};});
 return {weekStart:weekStart,weekEnd:weekEnd,runs:completedRuns,miles:completedMiles,targetRuns:validRunTarget,targetMiles:validMileTarget,runProgress:runProgress,mileageProgress:mileageProgress,score:score,remainingRuns:validRunTarget===null?null:Math.max(0,validRunTarget-completedRuns),remainingMiles:validMileTarget===null?null:Math.max(0,validMileTarget-completedMiles),days:days};
}
function fitnessWeightProgress(settings,weighIns,today){
 settings=settings||{};weighIns=Array.isArray(weighIns)?weighIns:[];
 var validEntries=weighIns.filter(function(entry){return fitnessValidDate(entry.date)&&Number.isFinite(Number(entry.weight))&&Number(entry.weight)>0&&entry.date<=today;}).slice().sort(function(a,b){return a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id));});
 var latest=validEntries.length?validEntries[validEntries.length-1]:null,startWeight=Number(settings.startWeight),targetWeight=Number(settings.targetWeight),startDate=settings.startDate,goalDate=settings.goalDate;
 var complete=Number.isFinite(startWeight)&&startWeight>0&&Number.isFinite(targetWeight)&&targetWeight>0&&fitnessValidDate(startDate)&&fitnessValidDate(goalDate)&&goalDate>startDate;
 if(!latest){
  var noLogStatus="Add your first weigh-in",noLogExpected=null,noLogMaintenance=complete&&startWeight===targetWeight;
  if(complete){
   var noLogElapsed=fitnessDateDifference(startDate,today),noLogDuration=fitnessDateDifference(startDate,goalDate);
   if(noLogMaintenance){noLogStatus="Maintenance";noLogExpected=startWeight;}
   else if(noLogElapsed<=0){noLogStatus=noLogElapsed<0?"Goal starts "+startDate:"Just started";noLogExpected=startWeight;}
   else{noLogExpected=startWeight+Math.sign(targetWeight-startWeight)*Math.abs(targetWeight-startWeight)*Math.max(0,Math.min(1,noLogElapsed/noLogDuration));if(today>goalDate)noLogStatus="Goal date passed";}
  }
  return {latest:null,score:null,daysAhead:null,weightAhead:null,status:noLogStatus,expectedWeight:noLogExpected,remaining:null,maintenance:noLogMaintenance};
 }
 if(!complete)return {latest:latest,score:null,daysAhead:null,weightAhead:null,status:"Set a starting weight and goal date",expectedWeight:null,remaining:null,maintenance:false};
 if(startWeight===targetWeight)return {latest:latest,score:null,daysAhead:null,weightAhead:null,status:"Maintenance",expectedWeight:startWeight,remaining:0,maintenance:true};
 var elapsed=fitnessDateDifference(startDate,today),duration=fitnessDateDifference(startDate,goalDate),direction=Math.sign(targetWeight-startWeight),totalChange=Math.abs(targetWeight-startWeight),latestWeight=Number(latest.weight);
 var latestAge=Math.max(0,fitnessDateDifference(latest.date,today));
 if(elapsed<=0)return {latest:latest,score:null,daysAhead:null,weightAhead:null,status:elapsed<0?"Goal starts "+startDate:"Just started",expectedWeight:startWeight,remaining:Math.abs(targetWeight-latestWeight),maintenance:false,latestAge:latestAge};
 var elapsedDays=Math.max(0,Math.min(duration,elapsed)),dailyChange=totalChange/duration,expectedWeight=startWeight+direction*dailyChange*elapsedDays,daysAhead=(latestWeight-expectedWeight)*direction/dailyChange,daysBehind=Math.max(0,-daysAhead),score=Math.max(0,Math.min(100,100-5*daysBehind)),weightAhead=Math.abs(daysAhead*dailyChange);
 var reached=direction>0?latestWeight>=targetWeight:latestWeight<=targetWeight;
 var displayedDays=Math.round(Math.abs(daysAhead)*10)/10,dayUnit=displayedDays===1?"day":"days",status=daysAhead>0?displayedDays+" "+dayUnit+" ahead":daysAhead<0?displayedDays+" "+dayUnit+" behind":"On today's target",goalStatus=today>goalDate?(reached?"Goal reached":"Goal date passed"):today===goalDate?(reached?"Goal reached":"Goal date"):null;
 return {latest:latest,score:score,daysAhead:daysAhead,daysBehind:daysBehind,weightAhead:weightAhead,status:status,goalStatus:goalStatus,expectedWeight:expectedWeight,remaining:Math.abs(targetWeight-latestWeight),maintenance:false,latestAge:latestAge,dailyChange:dailyChange};
}
function fitnessSuggestedFocus(scores){
 var tracked=(scores||[]).filter(function(item){return Number.isFinite(item.score);});
 if(!tracked.length)return {muscleIds:[],message:"Log your first workout to start tracking muscle consistency."};
 var companions={shoulders:["chest","triceps"],chest:["shoulders","triceps"],back:["biceps"],biceps:["back"],triceps:["chest","shoulders"],quads:["hamstrings","calves"],hamstrings:["quads","calves"],calves:["quads","hamstrings"],abs:[]};
 var sorted=tracked.slice().sort(function(a,b){return a.score-b.score||(a.daysUntilDue===null?Infinity:a.daysUntilDue)-(b.daysUntilDue===null?Infinity:b.daysUntilDue)||a.name.localeCompare(b.name);});
 var candidate=sorted[0];
 if(candidate.score===100){
  sorted.sort(function(a,b){return (a.daysUntilDue===null?Infinity:a.daysUntilDue)-(b.daysUntilDue===null?Infinity:b.daysUntilDue)||a.name.localeCompare(b.name);});
  candidate=sorted[0];
  return {muscleIds:candidate?[candidate.id]:[],message:candidate?candidate.name+" is next approaching its training interval.":"All tracked groups are on schedule."};
 }
 var selected=[candidate.id],possible=companions[candidate.id]||[];
 possible.forEach(function(id){var companion=tracked.find(function(item){return item.id===id;});if(companion&&selected.length<2)selected.push(companion.id);});
 var names=selected.map(function(id){return FITNESS_MUSCLES.find(function(muscle){return muscle.id===id;}).name;});
 var mainMessage=candidate.daysUntilDue<0?candidate.name+" is "+Math.abs(candidate.daysUntilDue)+" "+(Math.abs(candidate.daysUntilDue)===1?"day":"days")+" overdue.":candidate.name+" is due today.";
 return {muscleIds:selected,message:mainMessage+(names.length>1?" "+names.join(" and ")+" would be a good next focus.":"")};
}

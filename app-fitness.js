"use strict";
/* Health & Fitness presentation and interactions. Data writes go through app-fitness-data.js. */
var fitnessCurrentTab="strength",fitnessStrengthSubtab="training",fitnessCardioSubtab="progress",fitnessWeightSubtab="progress",fitnessBodyView="front",fitnessSelectedMuscleId="chest",fitnessEditingInterval=false,fitnessDialog=null,fitnessGoalsReturnFocus=null,fitnessRhythmEditor=null,fitnessRhythmEditorSuspended=false;
var FITNESS_TABS=[["strength","Strength"],["cardio","Cardio"],["weight","Body Weight"]];
function fitnessTone(score){var tone=Number.isFinite(score)?scoreClass(score):"neutral";return tone==="yellow"?"amber":tone==="red"?"coral":tone;}
function fitnessPercent(score){return Number.isFinite(score)?String(Math.round(score+1e-10)):"—";}
function fitnessDateLabel(value,options){
 if(!fitnessValidDate(value))return "—";
 var parts=String(value).split("-").map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);
 return date.toLocaleDateString(undefined,options||{month:"short",day:"numeric",year:"numeric"});
}
function fitnessPageScores(data,today){
 var muscles=fitnessMuscleScores(data,today),strength=fitnessStrengthScore(muscles),cardio=fitnessCardioProgress(data,today),weight=fitnessWeightProgress(data.settings,data.weighIns,today),overallWeight=Number.isFinite(weight.score)?Math.min(100,weight.score):null,available=[strength,cardio.score,overallWeight].filter(Number.isFinite);
 return {muscles:muscles,strength:strength,trackedMuscles:muscles.filter(function(item){return Number.isFinite(item.score);}).length,cardio:cardio,weight:weight,overall:fitnessOverallScore(strength,cardio.score,overallWeight),availableScores:available.length};
}
function fitnessMeterHTML(label,value,detail){
 var percent=Number.isFinite(value)?Math.max(0,Math.min(100,value)):0,tone=fitnessTone(value);
 return '<div class="fitness-meter"><div class="fitness-meter-label"><span>'+esc(label)+'</span><strong class="fitness-score-text '+tone+'">'+fitnessPercent(value)+'</strong></div><div class="fitness-meter-track" role="meter" aria-label="'+esc(label)+'" aria-valuemin="0" aria-valuemax="100"'+(Number.isFinite(value)?' aria-valuenow="'+percent+'" aria-valuetext="'+percent+' out of 100"':' aria-valuetext="No score available"')+'><span class="'+tone+'" style="width:'+percent+'%"></span></div>'+(detail?'<small>'+esc(detail)+'</small>':"")+'</div>';
}
function fitnessCardHTML(title,content,options){
 options=options||{};
 return '<section class="card fitness-card '+esc(options.className||"")+'"'+(options.labelledby?' aria-labelledby="'+esc(options.labelledby)+'"':"")+'><div class="fitness-card-heading"><h2'+(options.titleId?' id="'+esc(options.titleId)+'"':"")+'>'+esc(title)+'</h2>'+(options.actionHTML||"")+'</div>'+content+'</section>';
}
function fitnessRhythmCompletionToday(rhythm,date){
 return (S.events||[]).some(function(event){return event.rhythmId===rhythm.id&&event.rhythmOccurrence===date;});
}
function fitnessRhythmIsDue(rhythm,date){
 return !rhythm.paused&&fitnessRhythmScheduled(rhythm,date)&&!fitnessRhythmCompletionToday(rhythm,date);
}
function fitnessRhythmScheduled(rhythm,date){
 var parts=String(date||todayStr()).split("-").map(Number),day=new Date(parts[0],parts[1]-1,parts[2]);
 return typeof window.scheduleDayMatches==="function"?window.scheduleDayMatches(rhythm,day):false;
}
function fitnessRhythmMuscles(workout){
 return workout&&Array.isArray(workout.muscleIds)?workout.muscleIds.map(function(id){var item=FITNESS_MUSCLES.find(function(muscle){return muscle.id===id;});return item?item.name:id;}):[];
}
function fitnessRhythmDetails(rhythm,data,scores){
 rhythm=Object.assign({},rhythm,{type:rhythm.type||rhythm.fitnessType});
 if(rhythm.type==="weighin"){
  var latest=data.weighIns.slice().sort(function(a,b){return b.date.localeCompare(a.date);})[0];
  return latest?"Latest: "+fitnessNumber(latest.weight)+" "+(data.settings.weightUnit||"lb")+" · "+fitnessDateLabel(latest.date):"No weigh-in recorded.";
 }
 if(rhythm.type==="cardio"){
  var progress=fitnessCardioProgress(data,todayStr());
  return "This week: "+(progress.remainingRuns===null?"—":progress.remainingRuns+" runs")+" and "+(progress.remainingMiles===null?"—":fitnessNumber(progress.remainingMiles)+" mi")+" remaining.";
 }
 if(rhythm.strengthMode==="specific"){
  var workout=data.savedWorkouts.find(function(item){return item.id===rhythm.workoutId;});
  return workout?workout.name+" · "+fitnessRhythmMuscles(workout).join(", "):"Workout unavailable";
 }
 if(rhythm.strengthMode==="recommended"){
  var best=fitnessRankSavedWorkouts(scores.muscles,data.savedWorkouts)[0];
  return best?"Best eligible: "+best.name+" · "+best.reason:"No saved workout is eligible right now; you can still log a custom workout.";
 }
 return "Custom workout · choose muscle groups when logging.";
}
function fitnessActivityIcon(type){
 var paths={weighin:'<path d="M5 4h14l2 16H3L5 4Z"/><path d="M8 8a4 4 0 0 1 8 0m-4 0 2-2"/>',cardio:'<circle cx="15" cy="5" r="2"/><path d="m12 9 3 2 3 4m-6-6-3 4-4 1m7-1-1 5m-2-7-3 5m7 2 4 2"/>',workout:'<path d="M6 9v6m12-6v6M3 10v4m18-4v4M6 12h12"/>',done:'<path d="m5 12 4 4L19 6"/>'};
 return '<svg class="fitness-today-rhythm-icon" viewBox="0 0 24 24" aria-hidden="true">'+paths[type||"workout"]+'</svg>';
}
function fitnessRhythmSummaryHTML(rhythm,data,scores){
 var message=fitnessRhythmSummaryText(rhythm,data,scores);
 if(!message)return "";
 var missing=(rhythm.strengthMode||"custom")==="specific"&&!(data.savedWorkouts||[]).some(function(item){return item.id===rhythm.workoutId;});
 return '<div class="rhythm-card__extension fitness-rhythm-summary">'+esc(message)+(missing?' <button type="button" class="fitness-inline-link" data-fitness-rhythm-edit="'+esc(rhythm.id)+'">Edit Rhythm</button>':"")+'</div>';
}
function fitnessRhythmSummaryText(rhythm,data,scores){
 var type=rhythm.type||rhythm.fitnessType;
 if(type!=="workout")return "";
 var mode=rhythm.strengthMode||"custom",workout=mode==="specific"?(data.savedWorkouts||[]).find(function(item){return item.id===rhythm.workoutId;}):null,recommendation=mode==="recommended"?fitnessRankSavedWorkouts(scores.muscles,data.savedWorkouts||[])[0]:null,blocked=workout?fitnessWorkoutBlockedMuscles(workout,scores.muscles):[],label=mode==="specific"?"Planned workout: ":mode==="recommended"?"Recommended: ":"",name=workout?workout.name:recommendation?recommendation.name:"";
 return mode==="custom"?"Custom workout · choose muscle groups when logging.":mode==="specific"?(workout?label+name+(blocked.length?" · Unavailable today: "+blocked.map(function(item){return item.name;}).join(", "):" · "+fitnessRhythmMuscles(workout).join(", ")):"Workout unavailable."):recommendation?label+name+" · "+recommendation.reason:"No saved workout is eligible right now. You can still log a custom workout.";
}
function fitnessRhythmCompactText(rhythm,data,scores){
 if(rhythm.type!=="workout")return rhythm.type==="cardio"?"Cardio activity":"Weight check-in";
 var mode=rhythm.strengthMode||"custom";
 if(mode==="specific"){
  var workout=(data.savedWorkouts||[]).find(function(item){return item.id===rhythm.workoutId;});
  return workout?"Planned: "+workout.name:"Workout unavailable";
 }
 if(mode==="recommended"){
  var recommendation=fitnessRankSavedWorkouts(scores.muscles,data.savedWorkouts||[])[0];
  return recommendation?"Recommended: "+recommendation.name:"No eligible workout";
 }
 return "Custom workout";
}
function fitnessTodayRhythmCardHTML(rhythm,completed){
 return fitnessSharedRhythmCardHTML(rhythm,{completed:completed,todayCompact:true});
}
function fitnessSharedRhythmCardHTML(source,options){
 options=options||{};
 var rhythm=Object.assign({},source,{type:source.type||source.fitnessType}),type=rhythm.type,data=fitnessStoreSnapshot(),scores=fitnessPageScores(data,todayStr()),metadata=window.tendRhythmCardMetadata(rhythm),completed=options.completed!==undefined?options.completed:fitnessRhythmCompletionToday(rhythm,todayStr()),actionLabel=completed?"✓ Logged":type==="workout"?"Log workout":type==="cardio"?"Log cardio":"Log weight",actionData={"data-tend-open":"fitness-rhythm","data-rhythm-id":rhythm.id},editData={"data-fitness-rhythm-edit":rhythm.id},historyData={"data-rhyhistory":"fitness|"+rhythm.id},pickerId="fitness|"+rhythm.id,people=(typeof tendAssociationPeopleBadges==="function"?tendAssociationPeopleBadges(rhythm,"fitness",null,"rhythm"):"")+'<button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="people|'+esc(pickerId)+'">+ Add Person</button>',categories=(typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(rhythm):"")+'<button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="categories|'+esc(pickerId)+'">+ Add Category</button>',detailPeople=typeof tendAssociationPeopleBadges==="function"?tendAssociationPeopleBadges(rhythm,"fitness",null,"rhythm"):"",detailCategories=typeof window.tendCategoryBadges==="function"?window.tendCategoryBadges(rhythm):"",extension=fitnessRhythmSummaryHTML(rhythm,data,scores),support=fitnessRhythmCompactText(rhythm,data,scores),detailsId="today-rhythm-details-fitness-"+String(rhythm.id).replace(/[^a-z0-9_-]/gi,"-"),compactStatus=completed?"Logged today":rhythm.paused?"Paused":metadata.lastTended.full==="Never tended"?"Not yet tended":typeof rhythmDueTxt==="function"?rhythmDueTxt(rhythm):"Scheduled today";
 if(compactStatus==="ready to tend again")compactStatus="Overdue";
 if(compactStatus)compactStatus=compactStatus.charAt(0).toUpperCase()+compactStatus.slice(1);
 var card=tendRhythmCardHTML(rhythm,{title:rhythm.text||"(unnamed rhythm)",description:rhythm.description,score:rhythmScore(rhythm),scoreClass:scoreClass(rhythmScore(rhythm)),peopleBadgesHTML:people,categoryBadgesHTML:categories,
  frequency:metadata.frequency,time:metadata.time,lastTended:metadata.lastTended,frequencyIconHTML:metadata.frequencyIconHTML,timeIconHTML:metadata.timeIconHTML,lastIconHTML:metadata.lastIconHTML,
  actionLabel:actionLabel,actionTitle:type==="workout"?"Log a workout":type==="cardio"?"Log a run":"Log a weigh-in",actionClassName:"fitness-action-color",actionDisabled:completed||!!rhythm.paused,
  todayCompact:options.todayCompact===true,detailsLabel:"Open",detailsId:detailsId,compactStatus:options.todayCompact===true?compactStatus:"",compactSupportingText:support,
  todayDetails:{peopleHTML:detailPeople,categoryHTML:detailCategories},
  cardClassName:"rhythm-card--fitness",extensionHTML:extension,tendAttributes:actionData,editAttributes:editData,historyAttributes:historyData
 });
 var picker=typeof rhythmPickerDraft!=="undefined"&&rhythmPickerDraft&&rhythmPickerDraft.ownerId==="fitness"&&rhythmPickerDraft.rhythmId===String(rhythm.id)&&typeof rhythmPickerModalHTML==="function"?rhythmPickerModalHTML():"";
 return card+picker;
}
if(typeof window!=="undefined")window.fitnessSharedRhythmCardHTML=fitnessSharedRhythmCardHTML;
if(typeof window!=="undefined")window.fitnessTodayRhythmCardHTML=fitnessTodayRhythmCardHTML;
function fitnessRhythmListHTML(data,type){
 var scores=fitnessPageScores(data,todayStr()),rhythms=(data.rhythms||[]).filter(function(rhythm){return rhythm.type===type;}),empty={workout:"No strength rhythms yet. Add a strength rhythm.",cardio:"No cardio rhythms yet. Add a cardio rhythm.",weighin:"No weigh-in rhythms yet. Add a weigh-in rhythm."},labels={workout:"Strength rhythms",cardio:"Cardio rhythms",weighin:"Weigh-in rhythms"};
 return '<section class="fitness-rhythm-list-section"><div class="fitness-rhythm-list-heading"><div><h2>'+labels[type]+'</h2><p>Rhythms appear in Today when scheduled and complete after a fitness log is saved.</p></div><button type="button" class="btn mini ghost" data-fitness-rhythm-new="'+type+'">+ Add Rhythm</button></div>'+(rhythms.length?'<div class="fitness-rhythm-list">'+rhythms.map(function(rhythm){
  return '<div class="fitness-rhythm-managed-card">'+fitnessSharedRhythmCardHTML(rhythm)+'<div class="fitness-rhythm-entry-actions"><span class="fitness-rhythm-status">'+(rhythm.paused?"Paused":"Active")+'</span><button type="button" class="btn mini ghost" data-fitness-rhythm-pause="'+esc(rhythm.id)+'">'+(rhythm.paused?"Resume":"Pause")+'</button><button type="button" class="btn mini ghost" data-fitness-rhythm-delete="'+esc(rhythm.id)+'">Delete Rhythm</button></div></div>';
 }).join("")+'</div>':'<p class="fitness-empty">'+empty[type]+'</p>')+'</section>';
}
function fitnessRhythmTiming(rhythm){
 var dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],frequency=rhythm.freq==="daily"?"Daily":rhythm.freq==="weekly"&&Array.isArray(rhythm.weekdays)&&rhythm.weekdays.length?rhythm.weekdays.map(function(day){return dayNames[Number(day)];}).filter(Boolean).join(", "):(typeof rhythmFreqLabel==="function"?rhythmFreqLabel(rhythm):rhythm.freq||"Daily");
 return frequency+" · "+(TODS[rhythm.tod]||"Any time");
}
function fitnessRhythmScheduleHTML(record,idf){
 var html=window.personRhythmScheduleHTML(record,idf),dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],index=0;
 return html.replace(/<label class="dow-pill">([\s\S]*?)<span>[^<]*<\/span><\/label>/g,function(match,inside){var day=dayNames[index++];return match.replace(/<span>[^<]*<\/span>/,'<span aria-label="'+day+'">'+day+'</span>');});
}
function fitnessRhythmDialogHTML(){
 if(!fitnessRhythmEditor||fitnessRhythmEditorSuspended)return "";
 var record=fitnessRhythmEditor.record,id=record.id||"draft",idf="fitness-rhythm|"+id,workouts=fitnessStoreSnapshot().savedWorkouts;
 var workoutOptions=workouts.map(function(item){return '<option value="'+esc(item.id)+'"'+(record.workoutId===item.id?" selected":"")+'>'+esc(item.name)+' · '+esc(fitnessRhythmMuscles(item).join(", "))+'</option>';}).join("");
 var modeFields=record.type==="workout"?'<label>Workout mode<select name="strengthMode"><option value="specific"'+(record.strengthMode==="specific"?" selected":"")+'>Specific Workout</option><option value="recommended"'+(record.strengthMode==="recommended"?" selected":"")+'>Recommended Workout</option><option value="custom"'+(record.strengthMode==="custom"?" selected":"")+'>Custom Workout</option></select></label>'+(record.strengthMode==="specific"?'<label>Saved workout<select name="workoutId"><option value="">Select a workout</option>'+workoutOptions+'</select></label>'+(workouts.length?"":'<p class="fitness-dialog-intro">No saved workouts yet. <button type="button" class="btn mini ghost" data-fitness-go-workouts>Go to Strength → Workouts</button> Your rhythm settings will be saved while you create one.</p>')+'<p class="fitness-dialog-intro">Specific workouts use a stable saved-workout ID, so edits carry through. Daily Abs requires Abs to have 0 preferred rest days.</p>':""):"";
 return '<dialog class="profile-editor-dialog fitness-dialog fitness-rhythm-editor" data-editor-modal aria-labelledby="fitnessRhythmTitle"><div class="profile-editor-body"><h2 id="fitnessRhythmTitle">'+(id==="draft"?"Add Rhythm":"Edit Rhythm")+'</h2><form data-fitness-rhythm-form data-rhythm-id="'+esc(id)+'"><label>Rhythm name<input type="text" name="text" maxlength="80" value="'+esc(record.text||"")+'" required></label><label>Description (optional)<textarea name="description" rows="2" maxlength="500">'+esc(record.description||"")+'</textarea></label>'+fitnessRhythmScheduleHTML(record,idf)+rhythmPickerControlsHTML("fitness",record,"fitness|"+id)+'<label>Fitness activity<select name="type"><option value="weighin"'+(record.type==="weighin"?" selected":"")+'>Weigh-In</option><option value="workout"'+(record.type==="workout"?" selected":"")+'>Strength Workout</option><option value="cardio"'+(record.type==="cardio"?" selected":"")+'>Cardio</option></select></label>'+modeFields+'<div class="fitness-form-error" aria-live="polite"></div><div class="profile-editor-actions"><button type="submit" class="btn mini">Save Rhythm</button><button type="button" class="btn mini ghost" data-fitness-rhythm-close data-editor-cancel>Cancel</button>'+(id==="draft"?"":'<button type="button" class="btn mini danger" data-fitness-rhythm-delete="'+esc(id)+'">Delete Rhythm</button>')+'</div></form></div></dialog>';
}
function fitnessSummaryHTML(scores){
 var score=Number.isFinite(scores.overall)?Math.max(0,Math.min(100,scores.overall)):null,status=score===null?"No active fitness scores":scoreLabel(score);
 var breakdown=tendScoreBreakdownHTML([
  {label:"Strength",score:scores.strength,detail:scores.trackedMuscles+" of 9 muscle groups tracked",actionAttributes:{"data-fitness-tab":"strength"},ariaLabel:"View Strength details, health score "+fitnessPercent(scores.strength)+(Number.isFinite(scores.strength)?" out of 100":" unavailable")},
  {label:"Cardio",score:scores.cardio.score,detail:"Weekly goal completion",actionAttributes:{"data-fitness-tab":"cardio"},ariaLabel:"View Cardio details, health score "+fitnessPercent(scores.cardio.score)+(Number.isFinite(scores.cardio.score)?" out of 100":" unavailable")},
  {label:"Weight",score:scores.weight.score,detail:"Progress toward goal date",actionAttributes:{"data-fitness-tab":"weight"},ariaLabel:"View Weight details, health score "+fitnessPercent(scores.weight.score)+(Number.isFinite(scores.weight.score)?" out of 100":" unavailable")}
 ],{columns:3,label:"Fitness health summaries"});
 return tendCategoryHealthSummaryHTML({title:"Overall Health & Fitness consistency",titleId:"fitnessSummaryTitle",score:score,status:status,className:"fitness-summary-card",breakdownHTML:breakdown});
}
function fitnessPanelHTML(name,content){
 return '<section class="fitness-panel" role="region" aria-label="'+(name==="weight"?"Body Weight":name.charAt(0).toUpperCase()+name.slice(1))+'" id="fitness-panel-'+name+'"'+(fitnessCurrentTab===name?"":" hidden")+'>'+content+'</section>';
}
function fitnessStrengthTabsHTML(){
 return fitnessSectionTabsHTML("strength",fitnessStrengthSubtab,[["training","Training"],["workouts","Workouts"],["rhythms","Rhythms"]]);
}
function fitnessWorkoutRecommendations(data,scores){
 var savedWorkouts=Array.isArray(data.savedWorkouts)?data.savedWorkouts:[],recommendations=fitnessRankSavedWorkouts(scores.muscles,savedWorkouts);
 if(!recommendations.length){
  var workouts=savedWorkouts,resting=workouts.some(function(workout){return fitnessWorkoutBlockedMuscles(workout,scores.muscles).length>0;}),invalid=workouts.some(function(workout){return !workout||workout.invalidMuscleIds===true||!Array.isArray(workout.muscleIds)||!workout.muscleIds.length||workout.muscleIds.some(function(id){return !FITNESS_MUSCLES.some(function(muscle){return muscle.id===id;});});});
  var message=!workouts.length?"Save a workout to get recommendations, or log a custom workout.":invalid?"A saved workout has incomplete muscle-group data and cannot be recommended. Edit it or log a custom workout.":resting?"No saved workout is eligible right now because an included muscle is resting or its training history needs review. You can still log a custom workout.":"No saved workout currently targets muscle groups that need training. You can still log a custom workout.";
  return '<div class="fitness-recommendation-empty">'+message+'</div><button type="button" class="btn mini ghost" data-fitness-custom-workout>Custom Workout</button>';
 }
 return '<div class="fitness-recommendation-list">'+recommendations.map(function(item){
  return '<article class="fitness-recommendation"><div><h3>'+esc(item.name)+'</h3><p>'+esc(item.reason)+'</p></div><button type="button" class="btn mini" data-fitness-log-saved-workout="'+esc(item.id)+'">Workout</button></article>';
 }).join("")+'</div><button type="button" class="btn mini ghost" data-fitness-custom-workout>Custom Workout</button>';
}
function fitnessSavedWorkoutsHTML(data,scores){
 var workouts=data.savedWorkouts||[];
 return '<section class="card fitness-card fitness-workout-library"><div class="fitness-card-heading"><h2>Saved workouts</h2><div><button type="button" class="btn mini ghost" data-fitness-open="savedWorkout">+ Add Workout</button></div></div>'+(fitnessRhythmEditorSuspended?'<p class="fitness-rhythm-resume-note">Your new rhythm settings are saved while you make a workout. <button type="button" class="btn mini" data-fitness-resume-rhythm>Continue editing rhythm</button></p>':"")+(workouts.length?'<div class="fitness-saved-workouts">'+workouts.map(function(workout){
  var muscleIds=Array.isArray(workout.muscleIds)?workout.muscleIds:[],names=muscleIds.map(function(id){var muscle=FITNESS_MUSCLES.find(function(item){return item.id===id;});return muscle?muscle.name:id;}),blocked=fitnessWorkoutBlockedMuscles(workout,scores.muscles).length>0,invalid=workout.invalidMuscleIds===true||!muscleIds.length||muscleIds.some(function(id){return !FITNESS_MUSCLES.some(function(muscle){return muscle.id===id;});});
  var people=typeof tendAssociationPeopleBadges==="function"?tendAssociationPeopleBadges(workout,"",null,"saved-workout"):"";
  return '<article class="fitness-saved-workout"><div><h3>'+esc(workout.name)+'</h3><p>'+esc(names.join(", "))+'</p>'+(invalid?'<p class="fitness-workout-rest-note">This workout has unknown or incomplete muscle-group data and cannot be logged as saved.</p>':blocked?'<p class="fitness-workout-rest-note">Some groups are recovering; you can still log a workout you completed.</p>':"")+(people?'<div class="fitness-workout-people">'+people+'</div>':"")+'</div><div class="fitness-saved-workout-actions"><button type="button" class="btn mini" data-fitness-log-saved-workout="'+esc(workout.id)+'"'+(invalid?' disabled title="This workout has invalid muscle-group data."':"")+'>Workout</button><button type="button" class="btn mini ghost" data-fitness-edit-saved-workout="'+esc(workout.id)+'">Edit</button><button type="button" class="btn mini ghost" data-fitness-delete-saved-workout="'+esc(workout.id)+'">Delete</button></div></article>';
 }).join("")+'</div>':'<p class="fitness-empty">No saved workouts yet. Create one to quickly log your usual muscle groups.</p>')+'</section>';
}
function fitnessMuscleMarkup(muscle,score,selected){
 var scoreText=fitnessPercent(score.score),tone=fitnessMuscleTone(score.score),percent=Number.isFinite(score.score)?Math.max(0,Math.min(100,score.score)):0,status=!score.eligible?score.status:score.status;
 return '<button type="button" class="fitness-muscle-row'+(selected?" is-selected":"")+'" data-fitness-muscle="'+muscle.id+'" aria-pressed="'+selected+'" aria-label="'+esc(muscle.name)+", "+(Number.isFinite(score.score)?scoreText+" out of 100":"score unavailable")+", "+status+'"><span class="fitness-muscle-row-heading"><strong>'+esc(muscle.name)+'</strong><strong class="fitness-muscle-value '+tone+'">'+scoreText+'</strong></span><span class="fitness-muscle-status">'+esc(status)+'</span><span class="fitness-muscle-progress" aria-hidden="true"><span class="'+tone+'" style="width:'+percent+'%"></span></span></button>';
}
function fitnessMuscleTone(score){
 return fitnessTone(score);
}
var FITNESS_BODY_FRONT_SVG='<svg viewBox="0 0 220 350" role="img" aria-label="Front muscle consistency map" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" width="220" height="350"><style>.muscle{stroke:#fff;stroke-width:2;cursor:pointer}.muscle:hover{filter:brightness(.9)}text{fill:#183b2d;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:800;text-anchor:middle;pointer-events:none}</style><g id="frontMuscles"><path class="muscle" data-muscle="shoulders" d="M93 79Q65 74 54 98L53 114L74 107L80 86Z M127 79Q155 74 166 98L167 114L146 107L140 86Z" fill="#81b296" tabindex="0" role="button" aria-label="shoulders 100 out of 100" /><path class="muscle" data-muscle="chest" d="M81 89Q96 80 108 87L107 129Q86 137 76 122Z M139 89Q124 80 112 87L113 129Q134 137 144 122Z" fill="#d88f77" tabindex="0" role="button" aria-label="chest 70 out of 100" /><path class="muscle" data-muscle="biceps" d="M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z" fill="#81b296" tabindex="0" role="button" aria-label="biceps 100 out of 100" /><path class="muscle" data-muscle="abs" d="M89 139L107 137L107 190L90 197L83 163Z M131 139L113 137L113 190L130 197L137 163Z" fill="#81b296" tabindex="0" role="button" aria-label="abs 100 out of 100" /><path class="muscle" data-muscle="quads" d="M73 206L105 205L101 265L83 272L74 259Z M147 206L115 205L119 265L137 272L146 259Z" fill="#81b296" tabindex="0" role="button" aria-label="quads 100 out of 100" /><path class="muscle" data-muscle="calves" d="M79 284L100 279L95 317L82 318Z M141 284L120 279L125 317L138 318Z" fill="#81b296" tabindex="0" role="button" aria-label="calves 100 out of 100" /><text x="110" y="108" data-label="chest">70</text><text x="110" y="164" data-label="abs">100</text><text x="89" y="239" data-label="quads">100</text><text x="132" y="300" data-label="calves">100</text></g><g fill="#e1e7dd"><ellipse cx="110" cy="36" rx="23" ry="28" /><path d="M98 60L97 73Q57 72 48 99L30 181L23 207Q22 218 34 220L47 202L64 139L72 162L69 210L74 294L78 335L99 335L107 244L113 244L121 335L142 335L146 294L151 210L148 162L156 139L173 202L186 220Q198 218 197 207L190 181L172 99Q163 72 123 73L122 60Z" /></g></svg>';
var FITNESS_BODY_BACK_SVG='<svg viewBox="0 0 220 350" role="img" aria-label="Back muscle consistency map" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" width="220" height="350"><style>.muscle{stroke:#fff;stroke-width:2;cursor:pointer}.muscle:hover{filter:brightness(.9)}text{fill:#183b2d;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:800;text-anchor:middle;pointer-events:none}</style><g fill="#e1e7dd"><ellipse cx="110" cy="36" rx="23" ry="28" /><path d="M98 60L97 73Q57 72 48 99L30 181L23 207Q22 218 34 220L47 202L64 139L72 162L69 210L74 294L78 335L99 335L107 244L113 244L121 335L142 335L146 294L151 210L148 162L156 139L173 202L186 220Q198 218 197 207L190 181L172 99Q163 72 123 73L122 60Z" /></g><g id="backMuscles"><path class="muscle" data-muscle="shoulders" d="M93 79Q65 74 54 98L53 114L74 107L80 86Z M127 79Q155 74 166 98L167 114L146 107L140 86Z" fill="#81b296" tabindex="0" role="button" aria-label="shoulders 100 out of 100" /><path class="muscle" data-muscle="back" d="M81 89L107 81L107 193L91 195L81 158L76 117Z M139 89L113 81L113 193L129 195L139 158L144 117Z" fill="#81b296" tabindex="0" role="button" aria-label="back 100 out of 100" /><path class="muscle" data-muscle="triceps" d="M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z" fill="#e4c184" tabindex="0" role="button" aria-label="triceps 80 out of 100" /><path class="muscle" data-muscle="hamstrings" d="M73 213L105 214L101 265L83 272L74 259Z M147 213L115 214L119 265L137 272L146 259Z" fill="#e4c184" tabindex="0" role="button" aria-label="hamstrings 80 out of 100" /><path class="muscle" data-muscle="calves" d="M79 284L100 279L95 317L82 318Z M141 284L120 279L125 317L138 318Z" fill="#81b296" tabindex="0" role="button" aria-label="calves 100 out of 100" /><text x="110" y="142" data-label="back">100</text><text x="88" y="243" data-label="hamstrings">80</text><text x="132" y="300" data-label="calves">100</text></g></svg>';
function fitnessMapSVG(view,muscles){
 var source=view==="front"?FITNESS_BODY_FRONT_SVG:FITNESS_BODY_BACK_SVG,byId={};
 (muscles||[]).forEach(function(result){byId[result.id]=result;});
 // The supplied front SVG puts its opaque base silhouette after the muscle group.
 if(view==="front")source=source.replace(/(<g id="frontMuscles">[\s\S]*?<\/g>)(<g fill="#e1e7dd">[\s\S]*?<\/g>)/,"$2$1");
 source=source.replace(/<style>[\s\S]*?<\/style>/,"").replace(/<svg viewBox=/,'<svg class="fitness-body-svg '+view+'" viewBox=').replace('role="img"','role="group"');
 source=source.replace(/<path class="muscle" data-muscle="([^"]+)" d="([^"]+)" fill="[^"]+" tabindex="0" role="button" aria-label="[^"]+" \/>/g,function(match,id,path){
  var result=byId[id],muscle=FITNESS_MUSCLES.find(function(item){return item.id===id;}),text=fitnessPercent(result&&result.score),score=Number.isFinite(result&&result.score)?result.score:null;
  return '<path class="muscle" data-muscle="'+id+'" data-fitness-muscle="'+id+'" d="'+path+'" fill="'+fitnessMuscleFill(score)+'" tabindex="0" role="button" aria-pressed="'+(fitnessSelectedMuscleId===id)+'" aria-label="'+esc(muscle?muscle.name:id)+", "+(score===null?"score unavailable":text+" out of 100")+(result&&result.lastTrained?", last trained "+fitnessDateLabel(result.lastTrained):", not logged yet")+'" />';
 });
 return source.replace(/(<text x="[^"]+" y="[^"]+" data-label="([^"]+)">)[^<]*(<\/text>)/g,function(match,start,id,end){var result=byId[id];return start+fitnessPercent(result&&result.score)+end;});
}
function fitnessMuscleFill(score){
 return !Number.isFinite(score)?"#e1e7dd":scoreClass(score)==="green"?"#12B76A":scoreClass(score)==="yellow"?"#FFC133":"#FF5A45";
}
function fitnessBodyMapHTML(scores,instance){
 var ordered=["chest","back","biceps","triceps","shoulders","abs","quads","hamstrings","calves"],muscles=ordered.map(function(id){return FITNESS_MUSCLES.find(function(item){return item.id===id;});}).filter(Boolean),selected=scores.muscles.find(function(item){return item.id===fitnessSelectedMuscleId;}),muscle=selected&&FITNESS_MUSCLES.find(function(item){return item.id===selected.id;}),interval=selected&&selected.intervalDays||7,tone=fitnessMuscleTone(selected&&selected.score),headingId="fitnessStrengthTitle"+(instance||"");
 var selectedDetails=!selected?'<p class="fitness-muscle-empty-selection">Select a muscle to see its training settings.</p>':fitnessEditingInterval?'<div class="fitness-interval-editor"><label>Train every <span><input type="number" min="1" max="365" step="1" value="'+interval+'" data-fitness-interval="'+muscle.id+'"> days</span></label><label>Preferred rest <span><input type="number" min="'+(muscle.id==="abs"?0:1)+'" max="364" step="1" value="'+selected.preferredRestDays+'" data-fitness-rest-days="'+muscle.id+'"> full days</span></label></div>':'<div class="fitness-muscle-schedule"><span>Train every '+interval+' days</span><span>Preferred rest: '+selected.preferredRestDays+' full days</span><span>Last trained: '+(selected.lastTrained?esc(fitnessDateLabel(selected.lastTrained)):"Not logged yet")+'</span><span class="fitness-muscle-current-status">'+esc(selected.status.replace(/\.$/,""))+'</span></div>';
 return '<section class="card fitness-card fitness-strength-card" aria-labelledby="'+headingId+'"><header class="fitness-strength-heading"><div><h2 id="'+headingId+'">Your body, at a glance</h2><p>Tap a muscle to see its training settings.</p></div>'+fitnessGoalsButtonHTML("strength")+'</header><div class="fitness-map-and-list"><div class="fitness-body-panel"><div class="fitness-map-toolbar" role="group" aria-label="Body map view"><button type="button" data-fitness-body-view="front" aria-pressed="'+(fitnessBodyView==="front")+'">Front</button><button type="button" data-fitness-body-view="back" aria-pressed="'+(fitnessBodyView==="back")+'">Back</button></div><div class="fitness-map-wrap">'+fitnessMapSVG(fitnessBodyView,scores.muscles)+'</div><p class="fitness-map-caption">Consistency with your chosen schedule</p></div><div class="fitness-muscle-list" aria-label="Muscle consistency by group">'+muscles.map(function(item){return fitnessMuscleMarkup(item,scores.muscles.find(function(row){return row.id===item.id;}),item.id===fitnessSelectedMuscleId);}).join("")+'</div></div><div class="fitness-muscle-legend" aria-label="Muscle consistency legend"><span><i class="green"></i>100 · on schedule</span><span><i class="amber"></i>80–90 · overdue</span><span><i class="coral"></i>Below 80 · needs attention</span></div><div class="fitness-muscle-detail" aria-live="polite"><div class="fitness-muscle-detail-copy">'+(selected?'<h3>'+esc(muscle.name)+' <strong class="'+tone+'">'+fitnessPercent(selected.score)+'</strong></h3>':"")+selectedDetails+'</div>'+(selected?'<button type="button" class="btn mini ghost fitness-edit-rhythm" data-fitness-edit-interval aria-expanded="'+fitnessEditingInterval+'">'+(fitnessEditingInterval?"Done":"Edit training settings")+'</button>':'')+'</div></section>';
}
function fitnessSelectMuscle(id){
 var muscle=FITNESS_MUSCLES.find(function(item){return item.id===id;});
 if(!muscle)return false;
 fitnessSelectedMuscleId=id;
 fitnessEditingInterval=false;
 if(!muscle[fitnessBodyView])fitnessBodyView=muscle.front?"front":"back";
 return true;
}
function fitnessSetBodyView(view){
 if(view!=="front"&&view!=="back")return false;
 var activeMuscle=FITNESS_MUSCLES.find(function(item){return item.id===fitnessSelectedMuscleId;});
 fitnessBodyView=view;
 if(activeMuscle&&!activeMuscle[view]){fitnessSelectedMuscleId=null;fitnessEditingInterval=false;}
 return true;
}
function fitnessCardioContent(data,scores,today){
 var cardio=scores.cardio,targetText=cardio.targetRuns===null||cardio.targetMiles===null?"Set both weekly targets to track goal completion.":cardio.runs+" of "+cardio.targetRuns+" runs · "+fitnessNumber(cardio.miles)+" of "+fitnessNumber(cardio.targetMiles)+" mi";
 var strip='<div class="fitness-week-strip" aria-label="Run activity Monday through Sunday">'+cardio.days.map(function(day,index){var dateParts=day.date.split("-").map(Number),date=new Date(dateParts[0],dateParts[1]-1,dateParts[2]),isToday=day.date===today;return '<div class="fitness-week-day'+(day.count?" has-run":"")+(isToday?" is-today":"")+'" aria-label="'+date.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})+': '+day.count+' runs"><span>'+date.toLocaleDateString(undefined,{weekday:"short"}).slice(0,1)+'</span><i aria-hidden="true">'+(day.count?"●":"")+'</i><small>'+date.getDate()+'</small></div>';}).join("")+'</div>';
 var detail=cardio.targetRuns!==null&&cardio.targetMiles!==null?'<div class="fitness-cardio-numbers"><div><strong>'+cardio.runs+'<small> / '+cardio.targetRuns+'</small></strong><span>Runs this week</span><em>'+cardio.remainingRuns+' remaining</em></div><div><strong>'+fitnessNumber(cardio.miles)+'<small> / '+fitnessNumber(cardio.targetMiles)+' mi</small></strong><span>Miles this week</span><em>'+fitnessNumber(cardio.remainingMiles)+' mi remaining</em></div></div>'+fitnessMeterHTML("Weekly goal completion",cardio.score,targetText):'<p class="fitness-empty">Add weekly run and mileage targets in Goals to track weekly goal completion.</p>';
 var runs=(data.runs||[]).slice().filter(function(run){return run.date>=cardio.weekStart&&run.date<=today;}).sort(function(a,b){return b.date.localeCompare(a.date);});
 return '<div class="fitness-cardio-week-label">'+esc(fitnessDateLabel(cardio.weekStart,{month:"short",day:"numeric"}))+' – '+esc(fitnessDateLabel(cardio.weekEnd,{month:"short",day:"numeric"}))+' · Monday–Sunday</div>'+detail+strip+(runs.length?'<div class="fitness-recent-runs">'+runs.slice(0,3).map(function(run){return '<div><span>'+esc(fitnessDateLabel(run.date))+'</span><strong>'+fitnessNumber(run.distance)+' mi</strong></div>';}).join("")+'</div>':'<p class="fitness-muted">No runs logged this week yet.</p>');
}
function fitnessNumber(value){
 var number=Number(value);return Number.isFinite(number)?String(Math.round(number*10)/10):"0";
}
function fitnessWeightChartHTML(data,scores,today){
 var settings=data.settings||{},goalDate=settings.goalDate,startDate=settings.startDate,startWeight=Number(settings.startWeight),targetWeight=Number(settings.targetWeight),entries=(data.weighIns||[]).filter(function(entry){return fitnessValidDate(entry.date)&&Number.isFinite(Number(entry.weight));}).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
 var ready=fitnessValidDate(startDate)&&fitnessValidDate(goalDate)&&goalDate>startDate&&Number.isFinite(startWeight)&&startWeight>0&&Number.isFinite(targetWeight)&&targetWeight>0;
 if(!ready&&!entries.length)return '<div class="fitness-chart-empty">Set a starting and target weight in Goals to see your goal path. Your logged weigh-ins will appear here.</div>';
 var first=ready?startDate:entries[0].date,last=ready?(goalDate>today?goalDate:today):(entries[entries.length-1].date>today?entries[entries.length-1].date:today),startNumber=fitnessDayNumber(first),endNumber=fitnessDayNumber(last);
 if(endNumber<=startNumber)endNumber=startNumber+1;
 var lowValues=entries.map(function(entry){return Number(entry.weight);});if(ready){lowValues.push(startWeight,targetWeight);}var min=Math.min.apply(Math,lowValues),max=Math.max.apply(Math,lowValues),padding=Math.max((max-min)*.18,1),minValue=min-padding,maxValue=max+padding;
 function x(date){return 38+(fitnessDayNumber(date)-startNumber)/(endNumber-startNumber)*324;}
 function y(value){return 18+(maxValue-value)/(maxValue-minValue)*174;}
 var path=entries.map(function(entry,index){return (index?"L":"M")+x(entry.date).toFixed(1)+" "+y(Number(entry.weight)).toFixed(1);}).join(" ");
 var goalPath=ready?'M'+x(startDate).toFixed(1)+' '+y(startWeight).toFixed(1)+' L'+x(goalDate).toFixed(1)+' '+y(targetWeight).toFixed(1):"";
 var todayMarker=ready&&today>=startDate&&today<=goalDate&&Number.isFinite(scores.weight.expectedWeight)?'<circle class="fitness-chart-expected" cx="'+x(today).toFixed(1)+'" cy="'+y(scores.weight.expectedWeight).toFixed(1)+'" r="5"><title>Expected today: '+fitnessNumber(scores.weight.expectedWeight)+'</title></circle>':"";
 var svg='<svg class="fitness-weight-chart" viewBox="0 0 380 230" role="img" aria-label="Weight progress chart. Solid line shows logged weigh-ins; dashed line shows the linear goal path.">'+[0,1,2,3].map(function(index){var value=maxValue-(maxValue-minValue)*index/3,py=18+174*index/3;return '<line x1="38" y1="'+py+'" x2="362" y2="'+py+'" class="fitness-chart-grid"/><text x="31" y="'+(py+4)+'" text-anchor="end">'+fitnessNumber(value)+'</text>';}).join("")+(goalPath?'<path class="fitness-chart-goal" d="'+goalPath+'"><title>Linear goal path</title></path>':"")+(path?'<path class="fitness-chart-actual" d="'+path+'"></path>'+entries.map(function(entry){return '<circle class="fitness-chart-point" cx="'+x(entry.date).toFixed(1)+'" cy="'+y(Number(entry.weight)).toFixed(1)+'" r="4"><title>'+fitnessDateLabel(entry.date)+': '+fitnessNumber(entry.weight)+'</title></circle>';}).join(""):"")+todayMarker+'<text x="38" y="218">'+esc(fitnessDateLabel(first,{month:"short",day:"numeric"}))+'</text><text x="362" y="218" text-anchor="end">'+esc(fitnessDateLabel(last,{month:"short",day:"numeric"}))+'</text></svg>';
 return svg+'<div class="fitness-chart-legend"><span><i class="actual"></i>Logged weight</span><span><i class="goal"></i>Goal path</span>'+(todayMarker?'<span><i class="expected"></i>Expected today</span>':"")+'</div>';
}
function fitnessWeightContent(data,scores,today){
 var progress=scores.weight,latest=progress.latest?fitnessNumber(progress.latest.weight):"—",unit=esc(data.settings.weightUnit||"lb");
 var completeGoal=Number.isFinite(Number(data.settings.startWeight))&&Number(data.settings.startWeight)>0&&Number.isFinite(Number(data.settings.targetWeight))&&Number(data.settings.targetWeight)>0&&fitnessValidDate(data.settings.startDate)&&fitnessValidDate(data.settings.goalDate)&&data.settings.goalDate>data.settings.startDate;
 var pace="";
 if(Number.isFinite(progress.score)){
  var behind=progress.daysAhead<0, ahead=progress.daysAhead>0,displayedDays=Number(fitnessNumber(behind?progress.daysBehind:Math.abs(progress.daysAhead))),dayUnit=displayedDays===1?"day":"days",headline=behind?fitnessNumber(progress.daysBehind)+" "+dayUnit+" behind":ahead?"Ahead of today's target":"On today's target",support=behind?fitnessNumber(progress.weightAhead)+" "+unit+" behind today's target":ahead?fitnessNumber(progress.weightAhead)+" "+unit+" ahead of today's target":"";
  pace='<div class="fitness-weight-pace"><strong aria-label="On-track score '+fitnessPercent(progress.score)+' out of 100">'+fitnessPercent(progress.score)+'</strong><span>'+esc(headline)+'</span>'+(support?'<small>'+esc(support)+'</small>':"")+'</div>';
 }
 var stale=progress.latest&&progress.latestAge>0?'<p class="fitness-muted">Estimate uses your last recorded weigh-in from '+esc(fitnessDateLabel(progress.latest.date))+'.</p>':"";
 var duration=completeGoal?fitnessDateDifference(data.settings.startDate,data.settings.goalDate):null,elapsed=completeGoal?Math.max(0,Math.min(duration,fitnessDateDifference(data.settings.startDate,today))):null,remainingDays=completeGoal?Math.max(0,duration-elapsed):null;
 var metrics='<div class="fitness-weight-metrics"><div><span>Today’s Target</span><strong>'+(Number.isFinite(progress.expectedWeight)?fitnessNumber(progress.expectedWeight)+' <small>'+unit+'</small>':"—")+'</strong><em>'+(completeGoal?"Goal path":"Set a goal in Goals")+'</em></div><div><span>Latest Weight</span><strong>'+latest+(progress.latest?' <small>'+unit+'</small>':"")+'</strong><em>'+(progress.latest?esc(fitnessDateLabel(progress.latest.date)):"No weigh-in recorded")+'</em></div><div><span>Goal Weight</span><strong>'+(Number.isFinite(Number(data.settings.targetWeight))&&Number(data.settings.targetWeight)>0?fitnessNumber(data.settings.targetWeight)+' <small>'+unit+'</small>':"—")+'</strong></div></div>';
 var timeline=completeGoal?'<div class="fitness-weight-timeline"><div><span>Elapsed</span><strong>'+elapsed+' of '+duration+' days</strong></div><div><span>Days remaining</span><strong>'+remainingDays+'</strong></div><div><span>Goal date</span><strong>'+esc(fitnessDateLabel(data.settings.goalDate))+'</strong></div></div>':"";
 var detail=metrics+timeline+pace+stale+(!progress.latest?'<p class="fitness-empty">Add your first weigh-in to start tracking weight progress. Your score stays unset until a weigh-in is logged.</p>':"");
 return detail+fitnessWeightChartHTML(data,scores,today)+(data.settings.startWeight&&data.settings.targetWeight?'<p class="fitness-weight-goal-caption">Starting '+fitnessNumber(data.settings.startWeight)+' '+unit+' · Target '+fitnessNumber(data.settings.targetWeight)+' '+unit+'</p>':'');
}
function fitnessSectionTabsHTML(section,selected,tabs){
 return '<div class="fitness-strength-tabs fitness-section-tabs" role="tablist" aria-label="'+esc(section)+' views">'+tabs.map(function(item){var active=item[0]===selected;return '<button type="button" role="tab" id="fitness-'+section+'-tab-'+item[0]+'" aria-controls="fitness-'+section+'-view-'+item[0]+'" aria-selected="'+active+'" tabindex="'+(active?"0":"-1")+'" data-fitness-section-tab="'+section+'" data-fitness-subtab="'+item[0]+'">'+esc(item[1])+'</button>';}).join("")+'</div>';
}
function fitnessStrengthPanel(scores){
 var data=fitnessStoreSnapshot();
 var tabs=fitnessSectionTabsHTML("strength",fitnessStrengthSubtab,[["training","Training"],["workouts","Workouts"],["rhythms","Rhythms"]]),content;
 if(fitnessStrengthSubtab==="workouts")content='<div id="fitness-strength-view-workouts" role="tabpanel" aria-labelledby="fitness-strength-tab-workouts">'+fitnessSavedWorkoutsHTML(data,scores)+'</div>';
 else if(fitnessStrengthSubtab==="rhythms")content='<div id="fitness-strength-view-rhythms" role="tabpanel" aria-labelledby="fitness-strength-tab-rhythms">'+fitnessRhythmListHTML(data,"workout")+'</div>';
 else content='<div id="fitness-strength-view-training" role="tabpanel" aria-labelledby="fitness-strength-tab-training"><div class="fitness-strength-layout">'+fitnessBodyMapHTML(scores,"Strength")+'<div class="fitness-strength-actions">'+fitnessCardHTML("Recommended workouts",fitnessWorkoutRecommendations(data,scores),{className:"fitness-recommendations-card"})+fitnessHistoryList("workouts",data.workouts,"Recent workouts")+'</div></div></div>';
 return fitnessPanelHTML("strength",tabs+content);
}
function fitnessGoalsButtonHTML(section){
 return '<button type="button" class="btn mini ghost" data-fitness-open="goals" data-fitness-goal-section="'+section+'" aria-label="'+section.charAt(0).toUpperCase()+section.slice(1)+' goals">Goals</button>';
}
function fitnessCardioPanel(data,scores,today){
 var tabs=fitnessSectionTabsHTML("cardio",fitnessCardioSubtab,[["progress","Progress"],["rhythms","Rhythms"]]);
 var content=fitnessCardioSubtab==="rhythms"?'<div id="fitness-cardio-view-rhythms" role="tabpanel" aria-labelledby="fitness-cardio-tab-rhythms">'+fitnessRhythmListHTML(data,"cardio")+'</div>':'<div id="fitness-cardio-view-progress" role="tabpanel" aria-labelledby="fitness-cardio-tab-progress"><div class="fitness-detail-layout">'+fitnessCardHTML("Weekly cardio",fitnessCardioContent(data,scores,today),{actionHTML:fitnessGoalsButtonHTML("cardio")})+fitnessCardHTML("Run history",fitnessHistoryList("runs",data.runs,""),{className:"fitness-history-card"})+'</div><div class="fitness-section-bottom-action"><button type="button" class="btn mini" data-fitness-open="run">Log Run</button></div></div>';
 return fitnessPanelHTML("cardio",tabs+content);
}
function fitnessWeightPanel(data,scores,today){
 var tabs=fitnessSectionTabsHTML("weight",fitnessWeightSubtab,[["progress","Progress"],["rhythms","Rhythms"]]);
 var content=fitnessWeightSubtab==="rhythms"?'<div id="fitness-weight-view-rhythms" role="tabpanel" aria-labelledby="fitness-weight-tab-rhythms">'+fitnessRhythmListHTML(data,"weighin")+'</div>':'<div id="fitness-weight-view-progress" role="tabpanel" aria-labelledby="fitness-weight-tab-progress"><div class="fitness-detail-layout">'+fitnessCardHTML("Body weight progress",fitnessWeightContent(data,scores,today),{actionHTML:fitnessGoalsButtonHTML("weight")})+fitnessHistoryList("weighIns",data.weighIns,"Weigh-in history")+'</div><div class="fitness-section-bottom-action"><button type="button" class="btn mini" data-fitness-open="weighin">Weigh-In</button></div></div>';
 return fitnessPanelHTML("weight",tabs+content);
}
function fitnessHistoryList(collection,records,title){
 var sorted=(records||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id));});
 var names={workouts:"Workout history",runs:"Run history",weighIns:"Weigh-in history"};
 return '<div class="fitness-history-list">'+(title?'<h3>'+esc(title)+'</h3>':"")+(sorted.length?sorted.map(function(record){
  var summary=collection==="workouts"?(record.workoutName?record.workoutName+" · ":"")+record.muscleIds.map(function(id){var muscle=FITNESS_MUSCLES.find(function(item){return item.id===id;});return muscle?muscle.name:id;}).join(", "):collection==="runs"?fitnessNumber(record.distance)+" mi":" "+fitnessNumber(record.weight)+" "+esc(fitnessStoreSnapshot().settings.weightUnit||"lb");
  var label=collection==="runs"?"Run":collection==="weighIns"?"Weigh-in":"Workout";
  return '<article class="fitness-history-entry"><div><strong>'+esc(summary)+'</strong><span>'+esc(fitnessDateLabel(record.date))+' · '+label+'</span>'+(record.notes?'<p>'+esc(record.notes)+'</p>':"")+'</div><div><button type="button" class="btn mini ghost" data-fitness-edit="'+collection+'" data-fitness-id="'+esc(record.id)+'">Edit</button><button type="button" class="btn mini ghost" data-fitness-delete="'+collection+'" data-fitness-id="'+esc(record.id)+'">Delete</button></div></article>';
 }).join(""):'<p class="fitness-empty">No '+(collection==="weighIns"?"weigh-ins":collection)+" logged yet.</p>")+'</div>';
}
function fitnessGoalsDialog(data,section){
 var settings=data.settings||{},intervals=settings.muscleIntervals||{},rests=settings.preferredRestDays||{},title,intro,content;
 if(section==="strength"){
  title="Strength goals";intro="Set how often you train each muscle and its preferred rest days.";
  var order=["shoulders","chest","back","biceps","triceps","abs","quads","hamstrings","calves"];
  content='<details class="fitness-rest-help"><summary>How rest days work</summary><p>Rest days are full days between workouts. One rest day means training Monday allows the next workout Wednesday. Abs may use zero rest days.</p></details><div class="fitness-strength-table" role="table" aria-label="Muscle training goals"><div class="fitness-strength-table-head" role="row"><span role="columnheader">Muscle</span><span role="columnheader">Train every (days)</span><span role="columnheader">Rest days</span></div>'+order.map(function(id){var muscle=FITNESS_MUSCLES.find(function(item){return item.id===id;}),interval=Number.isInteger(intervals[id])?intervals[id]:7,rest=Number.isInteger(rests[id])?rests[id]:id==="abs"?0:1,errorId="fitness-strength-error-"+id;return '<div class="fitness-strength-row" role="row" data-strength-goal-row="'+id+'"><span class="fitness-strength-muscle" role="rowheader">'+esc(muscle.name)+'</span><label role="cell"><span class="sr-only">'+esc(muscle.name)+' training interval in days</span><input type="number" min="1" max="365" step="1" name="interval-'+id+'" value="'+esc(interval)+'" aria-describedby="'+errorId+'" required></label><label role="cell"><span class="sr-only">'+esc(muscle.name)+' preferred rest days</span><input type="number" min="'+(id==="abs"?0:1)+'" max="364" step="1" name="rest-'+id+'" value="'+esc(rest)+'" aria-describedby="'+errorId+'" required></label><p class="fitness-strength-row-error" id="'+errorId+'" role="cell" aria-colspan="3" aria-live="polite"></p></div>';}).join("")+'</div>';
  return '<dialog class="profile-editor-dialog fitness-dialog fitness-goals-dialog fitness-strength-goals-dialog" data-goal-section="strength" data-editor-modal aria-labelledby="fitnessGoalsTitle"><div class="fitness-goals-layout"><header class="fitness-goals-header"><div><h2 id="fitnessGoalsTitle" tabindex="-1">'+title+'</h2><p class="fitness-dialog-intro">'+intro+'</p></div><button type="button" class="fitness-goals-close" data-fitness-close data-editor-cancel aria-label="Close Strength goals">×</button></header><form data-fitness-form="goals" data-goal-section="strength" novalidate><div class="fitness-goals-settings">'+content+'</div><footer class="profile-editor-actions fitness-goals-actions"><button type="button" class="btn mini ghost" data-fitness-close data-editor-cancel>Cancel</button><button type="submit" class="btn mini">Save goals</button></footer></form></div></dialog>';
 }else if(section==="cardio"){
  title="Cardio goals";intro="Set weekly run and mileage targets. Both targets are needed to calculate progress.";
  content='<fieldset class="fitness-goal-fieldset"><legend>Weekly targets</legend><label>Runs per week<input type="number" min="1" max="21" step="1" name="weeklyRunTarget" value="'+esc(settings.weeklyRunTarget||"")+'" placeholder="Set a target"></label><label>Miles per week<input type="number" min="0.1" max="1000" step="0.1" name="weeklyMileTarget" value="'+esc(settings.weeklyMileTarget||"")+'" placeholder="Set a target"></label></fieldset>';
 }else{
  title="Weight goals";intro="Set your starting and target weights, dates, and preferred unit.";
  content='<fieldset class="fitness-goal-fieldset"><legend>Body weight goal</legend><div class="fitness-weight-goal-fields"><label>Starting weight<input type="number" min="0.1" max="2000" step="0.1" name="startWeight" value="'+esc(settings.startWeight||"")+'" placeholder="Weight"></label><label>Starting date<input type="date" name="startDate" value="'+esc(settings.startDate||"")+'"></label><label>Target weight<input type="number" min="0.1" max="2000" step="0.1" name="targetWeight" value="'+esc(settings.targetWeight||"")+'" placeholder="Weight"></label><label>Goal date<input type="date" name="goalDate" value="'+esc(settings.goalDate||"")+'"></label></div><label>Weight unit<select name="weightUnit"><option value="lb"'+((settings.weightUnit||"lb")==="lb"?" selected":"")+'>Pounds (lb)</option><option value="kg"'+(settings.weightUnit==="kg"?" selected":"")+'>Kilograms (kg)</option></select></label></fieldset>';
 }
 return '<dialog class="profile-editor-dialog fitness-dialog fitness-goals-dialog" data-goal-section="'+section+'" data-editor-modal aria-labelledby="fitnessGoalsTitle"><div class="profile-editor-body"><h2 id="fitnessGoalsTitle">'+title+'</h2><p class="fitness-dialog-intro">'+intro+'</p><form data-fitness-form="goals" data-goal-section="'+section+'">'+content+'<div class="fitness-form-error" aria-live="polite"></div><div class="profile-editor-actions"><button type="submit" class="btn mini">Save goals</button><button type="button" class="btn mini ghost" data-fitness-close data-editor-cancel>Cancel</button></div></form></div></dialog>';
}
function fitnessMuscleCheckboxes(selectedIds,scores){
 scores=scores||[];
 return '<div class="fitness-muscle-checks">'+["Upper body","Core","Lower body"].map(function(group){return '<fieldset><legend>'+group+'</legend>'+FITNESS_MUSCLES.filter(function(muscle){return muscle.group===group;}).map(function(muscle){var score=scores.find(function(item){return item.id===muscle.id;}),blocked=!!(score&&!score.eligible),restText=blocked?score.status:"";return '<label class="'+(blocked?"is-resting":"")+'"><input type="checkbox" name="muscleIds" value="'+muscle.id+'"'+(selectedIds.indexOf(muscle.id)>=0?" checked":"")+'><span>'+esc(muscle.name)+(blocked?'<small>'+esc(restText)+' · Still selectable when logging an actual workout</small>':"")+'</span></label>';}).join("")+'</fieldset>';}).join("")+'</div>';
}
function fitnessWorkoutBlockedMuscles(workout,scores){
 var muscleIds=workout&&Array.isArray(workout.muscleIds)?Array.from(new Set(workout.muscleIds)):[],unknown=!!(workout&&workout.invalidMuscleIds===true)||!muscleIds.length||muscleIds.some(function(id){return typeof id!=="string"||!FITNESS_MUSCLES.some(function(muscle){return muscle.id===id;});});
 if(unknown)return [null];
 return muscleIds.map(function(id){return (scores||[]).find(function(item){return item.id===id;});}).filter(function(item){return !item||!item.eligible;});
}
function fitnessWorkoutLogFields(data,scores){
 var context=fitnessDialog.rhythmContext||{},recommendations=fitnessRankSavedWorkouts(scores,data.savedWorkouts||[]),best=recommendations[0],selectedId=fitnessDialog.workoutChoiceId||context.initialWorkoutId||fitnessDialog.initialWorkoutId||"custom";
 if(selectedId!=="custom"&&!data.savedWorkouts.some(function(item){return item.id===selectedId;}))selectedId="custom";
 var recommended=best?'<option value="'+esc(best.id)+'"'+(selectedId===best.id?" selected":"")+'> '+esc(best.name)+' · Recommended</option>':"",options=(data.savedWorkouts||[]).filter(function(item){return !best||item.id!==best.id;}).map(function(workout){var blocked=fitnessWorkoutBlockedMuscles(workout,scores),invalid=!!(workout.invalidMuscleIds)||blocked.some(function(item){return !item;}) ,reason=blocked.map(function(item){return item?item.name+" "+item.status.toLowerCase():"Unavailable";}).join(", ");return '<option value="'+esc(workout.id)+'"'+(selectedId===workout.id?" selected":"")+(invalid?' disabled title="This saved workout has invalid muscle-group data."':"")+'>'+esc(workout.name)+(blocked.length?" · "+esc(reason)+(invalid?" (edit workout)":" (log actual workout)"):"")+'</option>';}).join("");
 var selected=selectedId!=="custom"?(data.savedWorkouts||[]).find(function(item){return item.id===selectedId;}):null,configured=(data.savedWorkouts||[]).find(function(item){return item.id===context.configuredWorkoutId;}),unavailable=context.configuredWorkoutId&&!configured,configuredBlocked=configured&&fitnessWorkoutBlockedMuscles(configured,scores),muscles=selected?'<div class="fitness-workout-selected"><strong>'+esc(selected.name)+' includes</strong><div class="fitness-saved-muscle-summary">'+fitnessRhythmMuscles(selected).map(function(name,index){return '<span>'+esc(name)+'</span><input type="hidden" name="muscleIds" value="'+esc(selected.muscleIds[index])+'">';}).join("")+'</div><input type="hidden" name="savedWorkoutId" value="'+esc(selected.id)+'"><input type="hidden" name="workoutName" value="'+esc(selected.name)+'"></div>':fitnessMuscleCheckboxes(fitnessDialog.muscleIds||[],scores)+'<label>Workout name (optional)<input type="text" name="workoutName" maxlength="80" value="'+esc(fitnessDialog.workoutName||"")+'" placeholder="Name this custom workout"></label>';
 var unavailableNotice=unavailable?'<p class="fitness-dialog-intro">The configured workout is unavailable. Choose another workout or custom muscles, or <button type="button" class="fitness-inline-link" data-fitness-rhythm-edit="'+esc(context.rhythmId)+'">Edit Rhythm</button>.</p>':configuredBlocked&&configuredBlocked.length?'<p class="fitness-dialog-intro">Some planned muscle groups are recovering. You can still log the workout you completed.</p>':"";
 return '<label class="fitness-workout-select-label">Workout<select name="workoutChoice">'+recommended+options+'<option value="custom"'+(selectedId==="custom"?" selected":"")+' >Custom workout</option></select></label>'+unavailableNotice+muscles;
}
function fitnessWorkoutPeopleControlsHTML(workout){
 var people=typeof tendAssociationPeopleBadges==="function"?tendAssociationPeopleBadges(workout,"",null,"saved-workout"):"",pickerId="fitness-workout|"+workout.id;
 return '<div class="fitness-workout-people">'+people+'<button type="button" class="rhythm-picker-trigger" data-rhythm-picker-open="people|'+esc(pickerId)+'">+ Add Person</button></div>';
}
function fitnessRecordDialog(data){
 if(!fitnessDialog)return "";
 var kind=fitnessDialog.kind,id=fitnessDialog.id,collection=kind==="workout"?"workouts":kind==="run"?"runs":kind==="weighin"?"weighIns":"savedWorkouts",record=id?(data[collection]||[]).find(function(item){return item.id===id;}):null,date=record?record.date:fitnessDialog.date||todayStr(),notes=record?record.notes||"":fitnessDialog.notes||"",heading=kind==="savedWorkout"?(record?"Edit saved workout":"Create workout"):kind==="workout"?(record?"Edit workout":"Log a workout"):kind==="run"?(record?"Edit run":"Log a run"):(record?"Edit weigh-in":"Add a weigh-in"),fields="";
 if(kind==="savedWorkout"){if(!record)record=fitnessDialog.workoutDraft||(fitnessDialog.workoutDraft={id:"draft",name:"",muscleIds:[],sharedWith:[]});if(!Array.isArray(record.sharedWith))record.sharedWith=[];fields='<label>Workout name<input type="text" name="name" maxlength="80" value="'+esc(record.name||"")+'" required></label>'+fitnessMuscleCheckboxes(record.muscleIds||[],[])+fitnessWorkoutPeopleControlsHTML(record);}
 if(kind==="workout"){if(record){fitnessDialog.initialWorkoutId=record.savedWorkoutId||"custom";fitnessDialog.muscleIds=record.muscleIds||[];fitnessDialog.workoutName=record.workoutName||"";}var workoutData=JSON.parse(JSON.stringify(data));if(record)workoutData.workouts=workoutData.workouts.filter(function(item){return item.id!==record.id;});var available=fitnessMuscleScores(workoutData,fitnessDialog.date||todayStr());fields=fitnessWorkoutLogFields(workoutData,available);}
 if(kind==="run")fields+='<label>Distance (miles)<input type="number" name="distance" min="0.1" max="1000" step="0.1" value="'+esc(record?record.distance:"")+'" required></label>';
 if(kind==="weighin")fields+='<label>Weight ('+esc(data.settings.weightUnit||"lb")+')<input type="number" name="weight" min="0.1" max="2000" step="0.1" value="'+esc(record?record.weight:"")+'" required></label>';
 var context=fitnessDialog.rhythmContext,linkedRhythmId=context&&context.rhythmId||"",formAttrs=' data-fitness-rhythm-id="'+esc(linkedRhythmId)+'" data-fitness-occurrence="'+esc(context&&context.occurrence||"")+'"';
 var picker=kind==="savedWorkout"&&typeof rhythmPickerDraft!=="undefined"&&rhythmPickerDraft&&rhythmPickerDraft.ownerId==="fitness-workout"&&rhythmPickerDraft.rhythmId===String(record&&record.id||"draft")&&typeof rhythmPickerModalHTML==="function"?rhythmPickerModalHTML():"";
 return '<dialog class="profile-editor-dialog fitness-dialog" data-editor-modal aria-labelledby="fitnessRecordTitle"><div class="profile-editor-body"><h2 id="fitnessRecordTitle">'+(context&&kind==="workout"?"Log your workout":heading)+'</h2><form data-fitness-form="'+kind+'" data-fitness-id="'+esc(id||"")+'"'+(kind==="savedWorkout"?"":formAttrs)+'>'+(kind==="savedWorkout"?"":'<label>Date<input type="date" name="date" value="'+esc(date)+'" max="'+todayStr()+'" required></label>')+fields+(kind==="savedWorkout"?"":'<label>Notes (optional)<textarea name="notes" rows="3" maxlength="1000">'+esc(notes)+'</textarea></label>')+(kind==="savedWorkout"||context?"":fitnessRhythmAssociationOptions(kind,data,record))+'<div class="fitness-form-error" aria-live="polite"></div><div class="profile-editor-actions"><button type="submit" class="btn mini">'+(record?"Save changes":context&&kind==="workout"?"Save Log":"Save")+'</button><button type="button" class="btn mini ghost" data-fitness-close data-editor-cancel>Cancel</button></div></form></div></dialog>'+picker;
}
function fitnessSettingsDialogHTML(data){
 return fitnessDialog?(fitnessDialog.kind==="goals"?fitnessGoalsDialog(data,fitnessDialog.id||"strength"):fitnessRecordDialog(data)):fitnessRhythmDialogHTML();
}
function fitnessRenderDialogPortal(){
 var portal=document.getElementById("fitness-dialog-portal");
 if(!portal){portal=document.createElement("div");portal.id="fitness-dialog-portal";document.body.appendChild(portal);}
 var html=fitnessSettingsDialogHTML(fitnessStoreSnapshot());
 portal.innerHTML=html;
 var dialog=portal.querySelector(".fitness-dialog");
 if(!dialog)return;
 dialog.addEventListener("cancel",function(event){var cancel=dialog.querySelector("[data-editor-cancel]");if(cancel){event.preventDefault();cancel.click();}});
 if(!dialog.open){if(typeof tendShowModal==="function")tendShowModal(dialog);else dialog.showModal();}
 var picker=portal.querySelector("dialog[data-rhythm-picker-dialog]");
 if(picker&&!picker.open){if(typeof tendShowModal==="function")tendShowModal(picker);else picker.showModal();}
}
function renderFitnessPage(){
 var data=fitnessStoreSnapshot(),today=todayStr(),scores=fitnessPageScores(data,today),out='<main class="fitness-page">'+tendCategoryPageHeaderHTML("Health & Fitness","fitness-page-heading")+fitnessSummaryHTML(scores);
 out+=fitnessStrengthPanel(scores)+fitnessCardioPanel(data,scores,today)+fitnessWeightPanel(data,scores,today)+'</main>';
 return out;
}
function fitnessShowTab(id,button){
 if(id==="schedules"||id==="rhythms"){fitnessCurrentTab="strength";fitnessStrengthSubtab="rhythms";render();var rhythmTab=document.querySelector('[data-fitness-section-tab="strength"][data-fitness-subtab="rhythms"]');if(rhythmTab)rhythmTab.focus({preventScroll:true});return;}
 if(FITNESS_TABS.every(function(tab){return tab[0]!==id;}))return;
 fitnessCurrentTab=id;render();
 var next=document.querySelector('[data-fitness-tab="'+id+'"]');if(next)next.focus({preventScroll:true});
}
function fitnessOpen(kind,id,muscles,context,initialWorkoutId){
 if(kind==="goals")fitnessGoalsReturnFocus={target:document.activeElement,section:id||"strength"};
 if(!fitnessRhythmEditorSuspended)fitnessRhythmEditor=null;
 fitnessDialog={kind:kind,id:id||null,muscleIds:Array.isArray(muscles)?muscles:[],rhythmContext:context||null,initialWorkoutId:initialWorkoutId||null};if(kind==="savedWorkout"&&!id)fitnessDialog.workoutDraft={id:"draft",name:"",muscleIds:[],sharedWith:[]};render();
 var heading=document.getElementById(kind==="goals"?"fitnessGoalsTitle":"fitnessRecordTitle");if(heading)heading.focus({preventScroll:true});
}
function fitnessRestoreGoalsFocus(){
 if(!fitnessGoalsReturnFocus)return;
 var previous=fitnessGoalsReturnFocus,target=previous.target&&previous.target.isConnected?previous.target:document.querySelector('.fitness-page [data-fitness-goal-section="'+previous.section+'"]');
 fitnessGoalsReturnFocus=null;if(target)requestAnimationFrame(function(){if(target.isConnected)target.focus({preventScroll:true});});
}
function fitnessClose(){
 var dialog=document.querySelector(".fitness-dialog[open]");fitnessDialog=null;if(!fitnessRhythmEditorSuspended)fitnessRhythmEditor=null;if(dialog)dialog.close();render();fitnessRestoreGoalsFocus();
}
function fitnessOpenRhythm(id){
 var rhythm=(fitnessStoreSnapshot().rhythms||[]).find(function(item){return item.id===id;});
 if(!rhythm){flash("This Fitness rhythm is no longer available");return;}
 if(rhythm.paused){flash("Resume this rhythm before logging it.");return;}
 if(fitnessRhythmCompletionToday(rhythm,todayStr())){flash("This Fitness rhythm is already logged today.");return;}
 var context={rhythmId:rhythm.id,occurrence:todayStr()};
 if(rhythm.type==="weighin"){fitnessOpen("weighin",null,[],context);return;}
 if(rhythm.type==="cardio"){fitnessOpen("run",null,[],context);return;}
 var data=fitnessStoreSnapshot(),scores=fitnessPageScores(data,todayStr()),recommendations=fitnessRankSavedWorkouts(scores.muscles,data.savedWorkouts||[]),configured=rhythm.strengthMode==="specific"&&data.savedWorkouts.find(function(item){return item.id===rhythm.workoutId;}),initial=null;
 if(configured)initial=configured;
 else if(rhythm.strengthMode==="recommended"&&recommendations.length)initial=data.savedWorkouts.find(function(item){return item.id===recommendations[0].id;})||null;
 context.strengthMode=rhythm.strengthMode||"custom";context.configuredWorkoutId=rhythm.strengthMode==="specific"?rhythm.workoutId:"";context.initialWorkoutId=initial?initial.id:"custom";
 fitnessOpen("workout",null,[],context);
}
function fitnessRhythmAssociationOptions(kind,data,record){
 var type=kind==="workout"?"workout":kind==="run"?"cardio":"weighin",current=record&&record.rhythmId||"";
 var choices=(data.rhythms||[]).filter(function(rhythm){return rhythm.type===type&&(fitnessRhythmIsDue(rhythm,todayStr())||rhythm.id===current);});
 return '<label>Associate with a Fitness rhythm (optional)<select name="rhythmId"><option value="">Do not associate</option>'+choices.map(function(rhythm){return '<option value="'+esc(rhythm.id)+'"'+(rhythm.id===current?" selected":"")+'>'+esc(rhythm.text)+'</option>';}).join("")+'</select><small>Only a matching rhythm set for today can be completed by this log.</small></label>';
}
function fitnessRhythmDraft(type,record){
 type=type||record&&record.fitnessType||record&&record.type||"weighin";
 var subcategory=type==="workout"?"strength":type==="cardio"?"cardio":"weight";
 return Object.assign({id:record&&record.id||"draft",text:"",description:"",type:type,areas:["health"],healthSubcategory:subcategory,freq:"weekly",weekdays:[new Date().getDay()],tod:"anytime",every:1,unit:"weeks",strengthMode:"recommended",workoutId:"",paused:false,sharedWith:[]},record||{});
}
function fitnessOpenRhythmEditor(id,type){
 if(id&&window.tendCaptureRhythmEditOrigin)window.tendCaptureRhythmEditOrigin(document.activeElement);
 var data=fitnessStoreSnapshot(),record=id&&(data.rhythms||[]).find(function(item){return item.id===id;});
 if(id&&!record){flash("This Fitness rhythm is no longer available");return;}
 type=record?record.type:type||"weighin";
 tab="areas";currentArea="health";currentPerson=null;openDetail=null;
 fitnessCurrentTab=type==="workout"?"strength":type==="cardio"?"cardio":"weight";
 if(fitnessCurrentTab==="strength")fitnessStrengthSubtab="rhythms";
 if(fitnessCurrentTab==="cardio")fitnessCardioSubtab="rhythms";
 if(fitnessCurrentTab==="weight")fitnessWeightSubtab="rhythms";
 fitnessDialog=null;fitnessRhythmEditorSuspended=false;fitnessRhythmEditor={record:fitnessRhythmDraft(type,record)};render();
 var title=document.getElementById("fitnessRhythmTitle");if(title)title.focus({preventScroll:true});
}
function fitnessSetRhythmError(form,message){
 var error=form.querySelector(".fitness-form-error");if(error)error.textContent=message;
}
function fitnessSaveRhythm(form){
 var id=form.getAttribute("data-rhythm-id"),original=(fitnessStoreSnapshot().rhythms||[]).find(function(item){return item.id===id;}),record=fitnessRhythmEditor&&fitnessRhythmEditor.record;
 if(!record)return;
 record.text=form.elements.text.value.trim();record.description=form.elements.description.value.trim();record.type=form.elements.type.value;
 if(!record.text){fitnessSetRhythmError(form,"Enter a name for this rhythm.");return;}
 if(["weighin","workout","cardio"].indexOf(record.type)<0){fitnessSetRhythmError(form,"Choose a supported Fitness activity.");return;}
 record.areas=Array.isArray(record.areas)?Array.from(new Set(record.areas.concat("health"))):["health"];
 if(["strength","cardio","weight"].indexOf(record.healthSubcategory)<0)record.healthSubcategory=record.type==="workout"?"strength":record.type==="cardio"?"cardio":"weight";
 record.fitnessType=record.type;
 if(record.type==="workout"){
  record.strengthMode=form.elements.strengthMode.value;
  if(["specific","recommended","custom"].indexOf(record.strengthMode)<0){fitnessSetRhythmError(form,"Choose a workout mode.");return;}
  record.workoutId=record.strengthMode==="specific"?form.elements.workoutId.value:"";
  if(record.strengthMode==="specific"&&!fitnessStoreSnapshot().savedWorkouts.some(function(item){return item.id===record.workoutId;})){fitnessSetRhythmError(form,"Select an available saved workout. Daily Abs requires Abs to have 0 preferred rest days.");return;}
 }else{delete record.strengthMode;delete record.workoutId;}
 if(record.freq==="weekly"&&(!Array.isArray(record.weekdays)||!record.weekdays.length)){fitnessSetRhythmError(form,"Select at least one weekday.");return;}
 if(record.freq==="custom"&&(!Number.isInteger(+record.every)||+record.every<1)){fitnessSetRhythmError(form,"Choose a valid repeat interval.");return;}
 if(id==="draft")record.id=uid();
 record.freq=record.freq||"weekly";record.tod=record.tod||"anytime";
 S.events.forEach(function(event){if(event.rhythmId===record.id)event.title=record.text;});
 if(original)Object.assign(original,record);else fitnessStoreUpsert("rhythms",record);
 if(original)fitnessStoreUpsert("rhythms",original);
 fitnessRhythmEditor=null;fitnessRhythmEditorSuspended=false;if(!window.tendFinishRhythmEdit||!window.tendFinishRhythmEdit())render();flash("Fitness rhythm saved");
}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("change",function(event){
 var field=event.target&&event.target.getAttribute&&event.target.getAttribute("data-rfield");
 if(!field||field.indexOf("fitness-rhythm|")!==0||!fitnessRhythmEditor)return;
 var parts=field.split("|"),record=fitnessRhythmEditor.record,name=parts[2],target=event.target;
 if(parts[1]!==record.id)return;
 if(name==="weekdays")record.weekdays=Array.prototype.slice.call(target.closest(".rhy-recur").querySelectorAll('[data-rfield$="|weekdays"]:checked')).map(function(input){return Number(input.value);});
 else if(name==="freq"){record.freq=target.value;if(target.value==="custom"){record.every=record.every||1;record.unit=record.unit||"weeks";record.start=record.start||todayStr();}if(target.value==="weekly"&&!record.weekdays.length)record.weekdays=[new Date().getDay()];}
 else if(name==="unit")record.unit=target.value;
 else if(name==="monthlyMode")record.monthlyMode=target.value;
 else if(["every","dayOfMonth","ord","ordWeekday","month","monthDay"].indexOf(name)>=0)record[name]=Number(target.value)||1;
 else if(name==="until")record.until=target.value||null;
 else if(name==="endDateEnabled"){record.endDateEnabled=target.checked;if(!target.checked)record.until=null;}
 else if(name==="tod")record.tod=target.value;
 else record[name]=target.value;
 event.stopImmediatePropagation();render();
},true);
document.addEventListener("input",function(event){
 var form=event.target&&event.target.closest&&event.target.closest("[data-fitness-rhythm-form]");
 if(!form||!fitnessRhythmEditor)return;
 if(event.target.name==="text"||event.target.name==="description")fitnessRhythmEditor.record[event.target.name]=event.target.value;
});
document.addEventListener("change",function(event){
 var form=event.target&&event.target.closest&&event.target.closest("[data-fitness-rhythm-form]");
 if(!fitnessRhythmEditor)return;
 var subcategory=event.target&&event.target.closest&&event.target.closest("[data-rhythm-health-subcategory]");
 if(subcategory){fitnessRhythmEditor.record.healthSubcategory=subcategory.value;return;}
 if(!form)return;
 if(event.target.name==="type"){
  fitnessRhythmEditor.record.type=event.target.value;
  if(event.target.value==="workout"&&!fitnessRhythmEditor.record.strengthMode)fitnessRhythmEditor.record.strengthMode="recommended";
  render();
  var activity=document.querySelector('[data-fitness-rhythm-form] select[name="type"]');if(activity)activity.focus({preventScroll:true});
 }else if(event.target.name==="strengthMode"){
  fitnessRhythmEditor.record.strengthMode=event.target.value;
  render();
  var mode=document.querySelector('[data-fitness-rhythm-form] select[name="strengthMode"]');if(mode)mode.focus({preventScroll:true});
 }else if(event.target.name==="workoutId")fitnessRhythmEditor.record.workoutId=event.target.value;
});
function fitnessSetError(form,message){
 var error=form.querySelector(".fitness-form-error");if(error)error.textContent=message;
}
function fitnessHandleGoals(form){
 var fields=form.elements,section=form.getAttribute("data-goal-section"),patch={};
 if(section==="strength"){
  var intervals={},restDays={};
  FITNESS_MUSCLES.forEach(function(muscle){intervals[muscle.id]=Number(fields["interval-"+muscle.id].value);restDays[muscle.id]=Number(fields["rest-"+muscle.id].value);});
  var hasInvalid=false;
  FITNESS_MUSCLES.forEach(function(muscle){if(!fitnessValidateStrengthGoalRow(form,muscle))hasInvalid=true;});
  if(hasInvalid){var firstInvalid=form.querySelector(".fitness-strength-row [aria-invalid='true']");if(firstInvalid)firstInvalid.focus();return;}
  patch.muscleIntervals=intervals;patch.preferredRestDays=restDays;
 }else if(section==="cardio"){
  var runValue=fields.weeklyRunTarget.value?Number(fields.weeklyRunTarget.value):null,mileValue=fields.weeklyMileTarget.value?Number(fields.weeklyMileTarget.value):null;
  if((runValue!==null&&(!Number.isInteger(runValue)||runValue<1||runValue>21))||(mileValue!==null&&(!Number.isFinite(mileValue)||mileValue<=0||mileValue>1000))){fitnessSetError(form,"Enter a positive weekly target within the listed limits.");return;}
  if((runValue===null)!==(mileValue===null)){fitnessSetError(form,"Set both weekly run and mileage targets, or leave both blank.");return;}
  patch.weeklyRunTarget=runValue;patch.weeklyMileTarget=mileValue;
 }else{
  var startWeight=fields.startWeight.value?Number(fields.startWeight.value):null,targetWeight=fields.targetWeight.value?Number(fields.targetWeight.value):null,startDate=fields.startDate.value,goalDate=fields.goalDate.value,hasWeightGoal=startWeight!==null||targetWeight!==null||!!startDate||!!goalDate;
  if(hasWeightGoal&&(!Number.isFinite(startWeight)||startWeight<=0||!Number.isFinite(targetWeight)||targetWeight<=0||!fitnessValidDate(startDate)||!fitnessValidDate(goalDate))){fitnessSetError(form,"Enter starting and target weights plus both dates to set a weight goal.");return;}
  if(hasWeightGoal&&goalDate<=startDate){fitnessSetError(form,"Goal date must be after the starting date.");fields.goalDate.focus();return;}
  patch.startWeight=startWeight;patch.startDate=startDate;patch.targetWeight=targetWeight;patch.goalDate=goalDate;patch.weightUnit=fields.weightUnit.value;
 }
 fitnessStoreUpdateSettings(patch);
 fitnessDialog=null;render();fitnessRestoreGoalsFocus();flash("Fitness goals saved");
}
function fitnessValidateStrengthGoalRow(form,muscle){
 var fields=form.elements,intervalValue=String(fields["interval-"+muscle.id].value).trim(),restValue=String(fields["rest-"+muscle.id].value).trim(),interval=Number(intervalValue),rest=Number(restValue),message="";
 if(!intervalValue||!Number.isInteger(interval)||interval<1||interval>365)message="Enter a whole number from 1 to 365.";
 else if(!restValue||!Number.isInteger(rest)||rest<(muscle.id==="abs"?0:1)||rest>364)message=muscle.id==="abs"?"Enter 0 to 364 rest days.":"Enter 1 to 364 rest days.";
 else if(interval<=rest)message="Training interval must exceed preferred rest days.";
 var row=form.querySelector('[data-strength-goal-row="'+muscle.id+'"]'),error=row&&row.querySelector(".fitness-strength-row-error");
 if(error)error.textContent=message;
 ["interval-","rest-"].forEach(function(prefix){var input=fields[prefix+muscle.id];if(message)input.setAttribute("aria-invalid","true");else input.removeAttribute("aria-invalid");});
 return !message;
}
function fitnessHandleRecord(form,kind){
 if(form.dataset.submitting==="true")return;
 var fields=form.elements,date=fields.date?fields.date.value:"",notes=fields.notes?fields.notes.value.trim():"",today=todayStr(),data=fitnessStoreSnapshot(),id=form.getAttribute("data-fitness-id")||uid();
 if(kind==="savedWorkout"){
  var name=fields.name.value.trim(),muscleIds=Array.from(form.querySelectorAll('input[name="muscleIds"]:checked')).map(function(input){return input.value;});
  if(!name){fitnessSetError(form,"Enter a name for this workout.");return;}
  muscleIds=Array.from(new Set(muscleIds)).filter(function(value){return FITNESS_MUSCLES.some(function(item){return item.id===value;});});
  if(!muscleIds.length){fitnessSetError(form,"Choose at least one muscle group.");return;}
  var existingWorkout=data.savedWorkouts.find(function(item){return item.id===id;}),sharedWith=existingWorkout&&existingWorkout.sharedWith||fitnessDialog.workoutDraft&&fitnessDialog.workoutDraft.sharedWith||[];
  fitnessStoreUpsert("savedWorkouts",{id:id,name:name,muscleIds:muscleIds,sharedWith:sharedWith});fitnessDialog=null;render();flash("Workout saved");return;
 }
 if(!fitnessValidDate(date)||date>today){fitnessSetError(form,"Choose a valid date that is today or earlier.");return;}
 var collection=kind==="workout"?"workouts":kind==="run"?"runs":"weighIns",previous=(data[collection]||[]).find(function(item){return item.id===id;}),record=Object.assign({},previous||{},{id:id,date:date,notes:notes}),contextRhythmId=form.getAttribute("data-fitness-rhythm-id")||"",associationField=fields.rhythmId,associationId=contextRhythmId||associationField&&associationField.value||"",occurrence=contextRhythmId?form.getAttribute("data-fitness-occurrence"):associationId?(previous&&previous.rhythmId===associationId&&previous.rhythmOccurrence||today):null;
 if(kind==="workout"){
  record.muscleIds=Array.from(form.querySelectorAll('input[name="muscleIds"]')).filter(function(input){return input.type==="hidden"||input.checked;}).map(function(input){return input.value;}).filter(function(value){return FITNESS_MUSCLES.some(function(item){return item.id===value;});});
  if(!record.muscleIds.length){fitnessSetError(form,"Choose at least one muscle group.");return;}
  var choice=fields.workoutChoice&&fields.workoutChoice.value,savedWorkoutId=choice&&choice!=="custom"?choice:fields.savedWorkoutId&&fields.savedWorkoutId.value||"",selectedWorkout=savedWorkoutId&&data.savedWorkouts.find(function(item){return item.id===savedWorkoutId;}),selectedMusclesMatch=selectedWorkout&&record.muscleIds.length===selectedWorkout.muscleIds.length&&selectedWorkout.muscleIds.every(function(muscleId){return record.muscleIds.indexOf(muscleId)>=0;});
  if(choice&&choice!=="custom"&&!selectedWorkout){fitnessSetError(form,"That saved workout is no longer available. Choose another workout or Custom workout.");return;}
  if(choice&&choice!=="custom"){
   if(!selectedMusclesMatch){fitnessSetError(form,"Choose the complete muscle group list for "+selectedWorkout.name+".");return;}
   record.savedWorkoutId=selectedWorkout.id;record.workoutName=selectedWorkout.name;
  }else if(selectedMusclesMatch){record.savedWorkoutId=selectedWorkout.id;record.workoutName=selectedWorkout.name;}
  else{delete record.savedWorkoutId;var customWorkoutName=fields.workoutName?fields.workoutName.value.trim():"";if(customWorkoutName)record.workoutName=customWorkoutName;else delete record.workoutName;}
 }else if(kind==="run"){
  record.distance=Number(fields.distance.value);if(!Number.isFinite(record.distance)||record.distance<=0){fitnessSetError(form,"Enter a distance greater than zero.");return;}
 }else{
  record.weight=Number(fields.weight.value);if(!Number.isFinite(record.weight)||record.weight<=0){fitnessSetError(form,"Enter a weight greater than zero.");return;}
 }
 if(associationId){
  var rhythm=(data.rhythms||[]).find(function(item){return item.id===associationId;}),expectedType=kind==="workout"?"workout":kind==="run"?"cardio":"weighin";
  if(!rhythm||rhythm.type!==expectedType){fitnessSetError(form,"This Fitness rhythm is no longer available or does not match this log.");return;}
  if(rhythm.paused){fitnessSetError(form,"This Fitness rhythm is paused and cannot be completed.");return;}
  if(date!==occurrence){fitnessSetError(form,"The fitness log date must match its scheduled rhythm occurrence.");return;}
  if(!fitnessValidDate(occurrence)||!fitnessRhythmScheduled(rhythm,occurrence)){fitnessSetError(form,"This Fitness rhythm is not set for this occurrence.");return;}
  var linkedEvent=(S.events||[]).find(function(event){return event.fitnessLogId===id&&event.rhythmId===associationId&&event.rhythmOccurrence===occurrence;});
  if(fitnessRhythmCompletionToday(rhythm,occurrence)&&!linkedEvent){fitnessSetError(form,"This Fitness rhythm occurrence has already been completed.");return;}
  var duplicate=(data[collection]||[]).some(function(item){return item.id!==id&&item.rhythmId===associationId&&item.rhythmOccurrence===occurrence;});
  if(duplicate){fitnessSetError(form,"A fitness log is already linked to this scheduled occurrence.");return;}
  record.rhythmId=associationId;record.rhythmOccurrence=occurrence;record.fitnessType=kind;
 }else{delete record.rhythmId;delete record.rhythmOccurrence;delete record.fitnessType;}
 form.dataset.submitting="true";fitnessStoreUpsert(collection,record);
 fitnessDialog=null;render();flash(kind==="workout"?"Workout saved":kind==="run"?"Run saved":"Weigh-in saved");
}
document.addEventListener("input",function(event){
 var input=event.target&&event.target.closest&&event.target.closest('.fitness-strength-goals-dialog input[name^="interval-"],.fitness-strength-goals-dialog input[name^="rest-"]');
 if(!input)return;
 var row=input.closest("[data-strength-goal-row]"),error=row&&row.querySelector(".fitness-strength-row-error");
 if(error&&error.textContent){var muscle=FITNESS_MUSCLES.find(function(item){return item.id===row.getAttribute("data-strength-goal-row");});if(muscle)fitnessValidateStrengthGoalRow(input.form,muscle);}
});
document.addEventListener("click",function(event){
 var target=event.target,button=target&&target.closest&&target.closest("[data-fitness-tab],[data-fitness-strength-tab],[data-fitness-section-tab],[data-fitness-section-nav],[data-fitness-muscle],[data-fitness-body-view],[data-fitness-edit-interval],[data-fitness-open],[data-fitness-close],[data-fitness-edit],[data-fitness-delete],[data-fitness-custom-workout],[data-fitness-log-saved-workout],[data-fitness-edit-saved-workout],[data-fitness-delete-saved-workout],[data-fitness-rhythm-new],[data-fitness-rhythm-edit],[data-fitness-rhythm-delete],[data-fitness-rhythm-pause],[data-fitness-rhythm-close],[data-fitness-go-workouts],[data-fitness-resume-rhythm]");
 if(!button)return;
 if(button.hasAttribute("data-fitness-rhythm-new")){fitnessOpenRhythmEditor(null,button.getAttribute("data-fitness-rhythm-new")||"weighin");return;}
 if(button.hasAttribute("data-fitness-rhythm-edit")){fitnessOpenRhythmEditor(button.getAttribute("data-fitness-rhythm-edit"));return;}
 if(button.hasAttribute("data-fitness-rhythm-delete")){var rhythmDeleteId=button.getAttribute("data-fitness-rhythm-delete");if(!window.confirm("Delete this Fitness rhythm?"))return;fitnessStoreDelete("rhythms",rhythmDeleteId);fitnessRhythmEditor=null;fitnessRhythmEditorSuspended=false;fitnessDialog=null;render();flash("Fitness rhythm deleted");return;}
 if(button.hasAttribute("data-fitness-rhythm-pause")){var rhythmToggle=(fitnessStoreSnapshot().rhythms||[]).find(function(item){return item.id===button.getAttribute("data-fitness-rhythm-pause");});if(!rhythmToggle)return;rhythmToggle.paused=!rhythmToggle.paused;fitnessStoreUpsert("rhythms",rhythmToggle);render();flash(rhythmToggle.paused?"Fitness rhythm paused":"Fitness rhythm resumed");return;}
 if(button.hasAttribute("data-fitness-rhythm-close")){fitnessRhythmEditor=null;fitnessRhythmEditorSuspended=false;if(!window.tendFinishRhythmEdit||!window.tendFinishRhythmEdit())render();return;}
 if(button.hasAttribute("data-fitness-tab")){event.preventDefault();fitnessShowTab(button.getAttribute("data-fitness-tab"),button);return;}
 if(button.hasAttribute("data-fitness-section-nav")){var section=button.getAttribute("data-fitness-section-nav");fitnessCurrentTab=section;if(section==="strength")fitnessStrengthSubtab="rhythms";else if(section==="cardio")fitnessCardioSubtab="rhythms";else if(section==="weight")fitnessWeightSubtab="rhythms";render();var sectionTarget=document.querySelector('[data-fitness-section-tab="'+section+'"][data-fitness-subtab="rhythms"]');if(sectionTarget)sectionTarget.focus({preventScroll:true});return;}
 if(button.hasAttribute("data-fitness-section-tab")){var selectedSection=button.getAttribute("data-fitness-section-tab"),selectedSubtab=button.getAttribute("data-fitness-subtab");if(selectedSection==="strength")fitnessStrengthSubtab=selectedSubtab;else if(selectedSection==="cardio")fitnessCardioSubtab=selectedSubtab;else if(selectedSection==="weight")fitnessWeightSubtab=selectedSubtab;render();var activeSubtab=document.querySelector('[data-fitness-section-tab="'+selectedSection+'"][data-fitness-subtab="'+selectedSubtab+'"]');if(activeSubtab)activeSubtab.focus({preventScroll:true});return;}
 if(button.hasAttribute("data-fitness-go-workouts")){fitnessRhythmEditorSuspended=true;fitnessCurrentTab="strength";fitnessStrengthSubtab="workouts";render();var workoutsTab=document.querySelector('[data-fitness-section-tab="strength"][data-fitness-subtab="workouts"]');if(workoutsTab)workoutsTab.focus({preventScroll:true});return;}
 if(button.hasAttribute("data-fitness-resume-rhythm")){fitnessRhythmEditorSuspended=false;fitnessCurrentTab="strength";fitnessStrengthSubtab="rhythms";render();var rhythmEditorTitle=document.getElementById("fitnessRhythmTitle");if(rhythmEditorTitle)rhythmEditorTitle.focus({preventScroll:true});return;}
 if(button.hasAttribute("data-fitness-strength-tab")){fitnessStrengthSubtab=button.getAttribute("data-fitness-strength-tab")==="workouts"?"workouts":button.getAttribute("data-fitness-strength-tab")==="rhythms"?"rhythms":"training";render();var strengthTab=document.querySelector('[data-fitness-section-tab="strength"][data-fitness-subtab="'+fitnessStrengthSubtab+'"]');if(strengthTab)strengthTab.focus({preventScroll:true});return;}
 if(button.hasAttribute("data-fitness-muscle")){var id=button.getAttribute("data-fitness-muscle"),fromMap=button.classList.contains("muscle"),sourcePanel=button.closest(".fitness-panel"),sourcePanelId=sourcePanel&&sourcePanel.id;if(!fitnessSelectMuscle(id))return;render();requestAnimationFrame(function(){var focusPanel=sourcePanelId?document.getElementById(sourcePanelId):document,selected=focusPanel&&focusPanel.querySelector((fromMap?".fitness-body-svg .muscle":".fitness-muscle-row")+'[data-fitness-muscle="'+id+'"]');if(selected)selected.focus({preventScroll:true});});return;}
 if(button.hasAttribute("data-fitness-body-view")){var bodyPanel=button.closest(".fitness-panel"),bodyPanelId=bodyPanel&&bodyPanel.id;fitnessSetBodyView(button.getAttribute("data-fitness-body-view"));render();requestAnimationFrame(function(){var bodyRoot=bodyPanelId?document.getElementById(bodyPanelId):document,control=bodyRoot&&bodyRoot.querySelector('[data-fitness-body-view="'+fitnessBodyView+'"]');if(control)control.focus({preventScroll:true});});return;}
 if(button.hasAttribute("data-fitness-edit-interval")){var editPanel=button.closest(".fitness-panel"),editPanelId=editPanel&&editPanel.id;fitnessEditingInterval=!fitnessEditingInterval;render();requestAnimationFrame(function(){var editRoot=editPanelId?document.getElementById(editPanelId):document,editor=editRoot&&(fitnessEditingInterval?editRoot.querySelector("[data-fitness-interval]"):editRoot.querySelector("[data-fitness-edit-interval]"));if(editor)editor.focus({preventScroll:true});});return;}
 if(button.hasAttribute("data-fitness-open")){var openKind=button.getAttribute("data-fitness-open"),muscles=(button.getAttribute("data-fitness-muscles")||"").split(",").filter(Boolean),recordId=openKind==="goals"?button.getAttribute("data-fitness-goal-section"):openKind==="savedWorkout"?button.getAttribute("data-fitness-id"):null;fitnessOpen(openKind,recordId,muscles);return;}
 if(button.hasAttribute("data-fitness-custom-workout")){fitnessOpen("workout");return;}
 if(button.hasAttribute("data-fitness-log-saved-workout")){var saved=fitnessStoreSnapshot().savedWorkouts.find(function(item){return item.id===button.getAttribute("data-fitness-log-saved-workout");});if(saved)fitnessOpen("workout",null,saved.muscleIds,null,saved.id);return;}
 if(button.hasAttribute("data-fitness-edit-saved-workout")){fitnessOpen("savedWorkout",button.getAttribute("data-fitness-edit-saved-workout"));return;}
 if(button.hasAttribute("data-fitness-delete-saved-workout")){if(!window.confirm("Delete this saved workout?"))return;fitnessStoreDelete("savedWorkouts",button.getAttribute("data-fitness-delete-saved-workout"));render();flash("Saved workout deleted");return;}
 if(button.hasAttribute("data-fitness-close")){fitnessClose();return;}
 if(button.hasAttribute("data-fitness-edit")){fitnessOpen(button.getAttribute("data-fitness-edit")==="weighIns"?"weighin":button.getAttribute("data-fitness-edit")==="workouts"?"workout":"run",button.getAttribute("data-fitness-id"));return;}
 if(button.hasAttribute("data-fitness-delete")){
  var collection=button.getAttribute("data-fitness-delete"),recordId=button.getAttribute("data-fitness-id");
  if(!window.confirm("Delete this "+(collection==="weighIns"?"weigh-in":collection==="runs"?"run":"workout")+"?"))return;
  fitnessStoreDelete(collection,recordId);render();flash("Fitness entry deleted");return;
 }
});
document.addEventListener("keydown",function(event){
 var region=event.target&&event.target.closest&&event.target.closest(".fitness-body-svg .muscle[data-fitness-muscle]");
 if(region&&(event.key==="Enter"||event.key===" ")){event.preventDefault();region.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));return;}
 var sectionTab=event.target&&event.target.closest&&event.target.closest('[role="tab"][data-fitness-section-tab]');
 if(sectionTab){var sectionTabs=Array.from(sectionTab.closest('[role="tablist"]').querySelectorAll('[role="tab"][data-fitness-section-tab]')),currentIndex=sectionTabs.indexOf(sectionTab),nextIndex=event.key==="ArrowRight"?(currentIndex+1)%sectionTabs.length:event.key==="ArrowLeft"?(currentIndex+sectionTabs.length-1)%sectionTabs.length:event.key==="Home"?0:event.key==="End"?sectionTabs.length-1:currentIndex;if(nextIndex!==currentIndex){event.preventDefault();sectionTabs[nextIndex].click();return;}}
 var tab=event.target&&event.target.closest&&event.target.closest('[role="tab"][data-fitness-tab]');
 if(!tab)return;
 var tabs=Array.from(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"][data-fitness-tab]')),index=tabs.indexOf(tab),next;
 if(event.key==="ArrowRight")next=(index+1)%tabs.length;else if(event.key==="ArrowLeft")next=(index+tabs.length-1)%tabs.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=tabs.length-1;else return;
 event.preventDefault();tabs[next].click();
});
document.addEventListener("change",function(event){
 var workoutChoice=event.target&&event.target.closest&&event.target.closest('.fitness-dialog select[name="workoutChoice"]');
 if(workoutChoice&&fitnessDialog&&fitnessDialog.kind==="workout"){
  var workoutForm=workoutChoice.form,previousChoice=fitnessDialog.workoutChoiceId||fitnessDialog.rhythmContext&&fitnessDialog.rhythmContext.initialWorkoutId||fitnessDialog.initialWorkoutId||"custom";fitnessDialog.date=workoutForm.elements.date.value;fitnessDialog.notes=workoutForm.elements.notes.value;fitnessDialog.workoutName=workoutForm.elements.workoutName&&workoutForm.elements.workoutName.value||fitnessDialog.workoutName||"";
  if(previousChoice==="custom"){fitnessDialog.muscleIds=Array.from(workoutForm.querySelectorAll('input[name="muscleIds"]:checked')).map(function(input){return input.value;});}
  else if(workoutChoice.value==="custom"){fitnessDialog.muscleIds=[];fitnessDialog.workoutName="";}
  else fitnessDialog.workoutName="";
  fitnessDialog.workoutChoiceId=workoutChoice.value;
  render();var updatedChoice=document.querySelector('.fitness-dialog select[name="workoutChoice"]');if(updatedChoice)updatedChoice.focus({preventScroll:true});return;
 }
 var dateInput=event.target&&event.target.closest&&event.target.closest('.fitness-dialog input[name="date"]');
 if(dateInput&&fitnessDialog&&fitnessDialog.kind==="workout"){
  var openForm=dateInput.form;
  fitnessDialog.date=dateInput.value;
  if((fitnessDialog.workoutChoiceId||fitnessDialog.rhythmContext&&fitnessDialog.rhythmContext.initialWorkoutId||fitnessDialog.initialWorkoutId||"custom")==="custom"){fitnessDialog.muscleIds=Array.from(openForm.querySelectorAll('input[name="muscleIds"]:checked')).map(function(checkbox){return checkbox.value;});fitnessDialog.workoutName=openForm.elements.workoutName&&openForm.elements.workoutName.value||"";}
  render();var updatedDate=document.querySelector('.fitness-dialog input[name="date"]');if(updatedDate)updatedDate.focus({preventScroll:true});return;
 }
 var input=event.target&&event.target.closest&&event.target.closest("[data-fitness-interval],[data-fitness-rest-days]");
 if(!input)return;
 var days=Number(input.value),muscleId=input.getAttribute("data-fitness-interval")||input.getAttribute("data-fitness-rest-days"),settings=fitnessStoreSnapshot().settings,restDays=Object.assign({},settings.preferredRestDays),intervals=Object.assign({},settings.muscleIntervals),isRest=input.hasAttribute("data-fitness-rest-days");
 if(isRest){if(!Number.isInteger(days)||days<(muscleId==="abs"?0:1)||days>364||Number(intervals[muscleId])<=days){input.setCustomValidity(muscleId==="abs"?"Abs rest days must be 0 or more, and less than its training interval.":"Rest days must be at least 1 and less than the training interval.");input.reportValidity();return;}input.setCustomValidity("");restDays[muscleId]=days;fitnessStoreUpdateSettings({preferredRestDays:restDays});}
 else{if(!Number.isInteger(days)||days<=Number(restDays[muscleId])||days>365){input.setCustomValidity("Training interval must be a whole number greater than preferred rest days and no more than 365.");input.reportValidity();return;}input.setCustomValidity("");intervals[muscleId]=days;fitnessStoreUpdateSettings({muscleIntervals:intervals});}
 fitnessEditingInterval=false;render();
});
document.addEventListener("submit",function(event){
 var rhythmForm=event.target&&event.target.closest&&event.target.closest("[data-fitness-rhythm-form]");
 if(rhythmForm){event.preventDefault();fitnessSaveRhythm(rhythmForm);return;}
 var form=event.target&&event.target.closest&&event.target.closest("[data-fitness-form]");
 if(!form)return;
 event.preventDefault();
 var kind=form.getAttribute("data-fitness-form");
 if(kind==="goals")fitnessHandleGoals(form);else fitnessHandleRecord(form,kind);
});
document.addEventListener("cancel",function(event){
 if(!event.target.matches||!event.target.matches(".fitness-dialog"))return;
 fitnessDialog=null;
});

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const scoringSource = fs.readFileSync(path.join(root, "app-fitness-scoring.js"), "utf8");
const dataSource = fs.readFileSync(path.join(root, "app-fitness-data.js"), "utf8");
const fitnessAppSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
const sharedSource = fs.readFileSync(path.join(root, "app-shared-components.js"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const viewSource = fs.readFileSync(path.join(root, "app-views1.js"), "utf8");
const categorySource = fs.readFileSync(path.join(root, "app-categoryrhythms.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "app-settingstabs.js"), "utf8");
const authSource = fs.readFileSync(path.join(root, "app-auth.js"), "utf8");
const actionColorsSource = fs.readFileSync(path.join(root, "app-planpills.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "tend.css"), "utf8");

function scoringContext() {
  const context = {
    settings: () => ({ greenAt: 80, yellowAt: 50 }),
    scoreClass: score => score >= 80 ? "green" : score >= 50 ? "yellow" : "red"
  };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  return context;
}

function runScore(context, name, ...args) {
  context.__args = args;
  return JSON.parse(JSON.stringify(vm.runInContext(`${name}.apply(null,__args)`, context)));
}

test("fitness muscle consistency follows the four-day chest interval and floors at zero", () => {
  const context = scoringContext();
  const base = {
    settings: { muscleIntervals: { chest: 4 } },
    workouts: [{ id: "w", date: "2026-10-13", muscleIds: ["chest"] }]
  };
  for (const [date, expected] of [
    ["2026-10-13", 100],
    ["2026-10-17", 100],
    ["2026-10-18", 90],
    ["2026-10-19", 80],
    ["2026-10-20", 70],
    ["2026-11-27", 0]
  ]) {
    const result = runScore(context, "fitnessMuscleScores", base, date).find(item => item.id === "chest");
    assert.equal(result.score, expected, `score on ${date}`);
  }
});

test("muscle dates are derived from workout history and unset groups stay unset", () => {
  const context = scoringContext();
  const data = { settings: { muscleIntervals: { chest: 4 } }, workouts: [
    { id: "old", date: "2026-10-01", muscleIds: ["chest"] },
    { id: "new", date: "2026-10-10", muscleIds: ["chest"] },
    { id: "future", date: "2026-10-15", muscleIds: ["chest"] }
  ] };
  let scores = runScore(context, "fitnessMuscleScores", data, "2026-10-13");
  assert.equal(scores.find(item => item.id === "chest").lastTrained, "2026-10-10");
  assert.equal(scores.find(item => item.id === "chest").score, 100);
  assert.equal(scores.find(item => item.id === "abs").score, null);
  assert.equal(scores.find(item => item.id === "abs").lastTrained, null);
  data.workouts = data.workouts.filter(item => item.id !== "new");
  scores = runScore(context, "fitnessMuscleScores", data, "2026-10-13");
  assert.equal(scores.find(item => item.id === "chest").lastTrained, "2026-10-01");
  data.workouts = [];
  assert.equal(runScore(context, "fitnessMuscleScores", data, "2026-10-13").find(item => item.id === "chest").score, null);
});

test("preferred rest days use calendar boundaries independently of consistency scores", () => {
  const context = scoringContext();
  const data = {
    settings: {
      muscleIntervals: { chest: 4, biceps: 3, abs: 3 },
      preferredRestDays: { chest: 2, biceps: 1, abs: 0 }
    },
    workouts: [{ id: "mon", date: "2026-10-12", muscleIds: ["chest", "biceps", "abs"] }]
  };
  for (const [date, readyIn] of [["2026-10-12", 3], ["2026-10-13", 2], ["2026-10-14", 1], ["2026-10-15", 0]]) {
    const scores = runScore(context, "fitnessMuscleScores", data, date);
    const chest = scores.find(item => item.id === "chest");
    assert.equal(chest.restDaysRemaining, readyIn);
    assert.equal(chest.eligible, readyIn === 0);
    assert.equal(chest.score, Math.max(0, 100 - 10 * Math.max(0, fitnessDateDiff("2026-10-12", date) - 4)));
  }
  const bicepsTuesday = runScore(context, "fitnessMuscleScores", data, "2026-10-13").find(item => item.id === "biceps");
  assert.equal(bicepsTuesday.eligible, false);
  assert.match(bicepsTuesday.status, /Resting · ready in 1 day/);
  assert.equal(runScore(context, "fitnessMuscleScores", data, "2026-10-14").find(item => item.id === "biceps").eligible, true);
  assert.equal(runScore(context, "fitnessMuscleScores", data, "2026-10-12").find(item => item.id === "abs").eligible, true);
  assert.equal(runScore(context, "fitnessMuscleScores", data, "2026-10-13").find(item => item.id === "abs").eligible, true);
  assert.equal(runScore(context, "fitnessMuscleScores", { settings: {}, workouts: [] }, "2026-10-13").find(item => item.id === "chest").eligible, true);
  const invalidNonAbsRest = runScore(context, "fitnessMuscleScores", {
    settings: { preferredRestDays: { chest: 0 } },
    workouts: [{ id: "chest", date: "2026-10-12", muscleIds: ["chest"] }]
  }, "2026-10-13").find(item => item.id === "chest");
  assert.equal(invalidNonAbsRest.preferredRestDays, 1);
  assert.equal(invalidNonAbsRest.eligible, false);
});
function fitnessDateDiff(from, to) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

test("calendar-day math stays correct across DST and year boundaries", () => {
  const context = scoringContext();
  assert.equal(vm.runInContext('fitnessDateDifference("2026-03-08","2026-03-09")', context), 1);
  assert.equal(vm.runInContext('fitnessDateDifference("2026-12-31","2027-01-01")', context), 1);
  assert.equal(vm.runInContext('fitnessWeekStart("2027-01-03")', context), "2026-12-28");
  assert.equal(vm.runInContext('fitnessValidDate("2026-02-29")', context), false);
  assert.equal(vm.runInContext('fitnessValidDate("2028-02-29")', context), true);
});

test("cardio progress uses Monday-to-Sunday local calendar weeks and the lower goal ratio", () => {
  const context = scoringContext();
  const data = {
    settings: { weeklyRunTarget: 2, weeklyMileTarget: 10 },
    runs: [
      { id: "prior-sunday", date: "2026-10-11", distance: 10 },
      { id: "monday", date: "2026-10-12", distance: 4 },
      { id: "tuesday", date: "2026-10-13", distance: 2 }
    ]
  };
  const progress = runScore(context, "fitnessCardioProgress", data, "2026-10-13");
  assert.equal(progress.weekStart, "2026-10-12");
  assert.equal(progress.runs, 2);
  assert.equal(progress.miles, 6);
  assert.equal(progress.runProgress, 100);
  assert.equal(progress.mileageProgress, 60);
  assert.equal(progress.score, 60);
  assert.equal(progress.remainingRuns, 0);
  assert.equal(progress.remainingMiles, 4);
  assert.deepEqual(progress.days.map(day => day.count), [1, 1, 0, 0, 0, 0, 0]);
  assert.equal(runScore(context, "fitnessCardioProgress", { settings: {}, runs: [] }, "2026-10-13").score, null);
});

test("weight trajectory supports loss, gain, passed goals, maintenance, and missing data", () => {
  const context = scoringContext();
  const lossSettings = { startWeight: 200, startDate: "2026-10-01", targetWeight: 180, goalDate: "2026-10-21" };
  const loss = runScore(context, "fitnessWeightProgress", lossSettings, [{ id: "loss", date: "2026-10-11", weight: 192 }], "2026-10-11");
  assert.equal(loss.expectedWeight, 190);
  assert.equal(loss.score, 90);
  assert.equal(loss.remaining, 12);
  const gain = runScore(context, "fitnessWeightProgress", { startWeight: 100, startDate: "2026-10-01", targetWeight: 120, goalDate: "2026-10-21" }, [{ id: "gain", date: "2026-10-11", weight: 110 }], "2026-10-11");
  assert.equal(gain.score, 100);
  const invalidRange = runScore(context, "fitnessWeightProgress", { ...lossSettings, goalDate: "2026-10-01" }, [{ id: "invalid", date: "2026-10-11", weight: 190 }], "2026-10-11");
  assert.equal(invalidRange.score, null);
  const maintenanceRange = runScore(context, "fitnessWeightProgress", { ...lossSettings, goalDate: "2026-10-01", targetWeight: 200 }, [{ id: "steady", date: "2026-10-11", weight: 200 }], "2026-10-11");
  assert.equal(maintenanceRange.score, null);
  const beforeStart = runScore(context, "fitnessWeightProgress", lossSettings, [{ id: "early", date: "2026-09-30", weight: 200 }], "2026-09-30");
  assert.equal(beforeStart.score, null);
  assert.equal(beforeStart.status, "Goal starts 2026-10-01");
  const onStart = runScore(context, "fitnessWeightProgress", lossSettings, [{ id: "today", date: "2026-10-01", weight: 200 }], "2026-10-01");
  assert.equal(onStart.score, null);
  assert.equal(onStart.status, "Just started");
  const reached = runScore(context, "fitnessWeightProgress", lossSettings, [{ id: "target", date: "2026-10-22", weight: 180 }], "2026-10-22");
  assert.equal(reached.score, 100);
  assert.equal(reached.goalStatus, "Goal reached");
  const passed = runScore(context, "fitnessWeightProgress", lossSettings, [{ id: "late", date: "2026-10-22", weight: 190 }], "2026-10-22");
  assert.equal(passed.goalStatus, "Goal date passed");
  const maintenance = runScore(context, "fitnessWeightProgress", { ...lossSettings, targetWeight: 200 }, [{ id: "steady", date: "2026-10-11", weight: 200 }], "2026-10-11");
  assert.equal(maintenance.score, null);
  assert.equal(maintenance.status, "Maintenance");
  const missing = runScore(context, "fitnessWeightProgress", lossSettings, [], "2026-10-11");
  assert.equal(missing.score, null);
  assert.equal(missing.status, "Add your first weigh-in");
  assert.equal(missing.expectedWeight, 190);
  const missingBeforeStart = runScore(context, "fitnessWeightProgress", lossSettings, [], "2026-09-30");
  assert.equal(missingBeforeStart.status, "Goal starts 2026-10-01");
  assert.equal(missingBeforeStart.expectedWeight, 200);
});

test("overall score averages only available component scores and suggestions handle empty data", () => {
  const context = scoringContext();
  assert.equal(vm.runInContext("fitnessOverallScore(80,100,null)", context), 90);
  assert.equal(vm.runInContext("fitnessOverallScore(null,null,null)", context), null);
  const emptyScores = runScore(context, "fitnessMuscleScores", { settings: {}, workouts: [] }, "2026-10-13");
  assert.deepEqual(runScore(context, "fitnessSuggestedFocus", emptyScores), {
    muscleIds: [],
    message: "Log your first workout to start tracking muscle consistency."
  });
});

test("saved-workout recommendations rank average normalized need and include never-trained muscles", () => {
  const context = scoringContext();
  const intervals = { shoulders: 7, chest: 7, back: 7, biceps: 7, triceps: 7, abs: 7, quads: 7, hamstrings: 7, calves: 7 };
  const restDays = { shoulders: 1, chest: 1, back: 1, biceps: 1, triceps: 1, abs: 0, quads: 1, hamstrings: 1, calves: 1 };
  const plans = [
    { id: "arms", name: "Arms", muscleIds: ["biceps", "triceps"] },
    { id: "legs", name: "Legs", muscleIds: ["quads", "hamstrings", "calves"] }
  ];
  const history = ["biceps", "triceps"].map(muscleId => ({ id: muscleId, date: "2026-10-13", muscleIds: [muscleId] }));
  const data = { settings: { muscleIntervals: intervals, preferredRestDays: restDays }, workouts: history };
  const scores = runScore(context, "fitnessMuscleScores", data, "2026-10-28");
  assert.equal(scores.find(item => item.id === "biceps").score, 20);
  assert.equal(scores.find(item => item.id === "quads").historyState, "never-trained");
  assert.deepEqual(runScore(context, "fitnessRankSavedWorkouts", scores, plans).map(item => item.name), ["Legs", "Arms"]);
  assert.match(runScore(context, "fitnessRankSavedWorkouts", scores, plans)[0].reason, /three muscle groups that haven't been trained yet/);

  const neverTrained = runScore(context, "fitnessMuscleScores", { settings: { muscleIntervals: intervals, preferredRestDays: restDays }, workouts: [] }, "2026-10-28");
  assert.deepEqual(runScore(context, "fitnessRankSavedWorkouts", neverTrained, plans).map(item => item.name), ["Arms", "Legs"]);

  const averageScores = [
    { id: "quads", name: "Quads", score: 50, eligible: true, historyState: "trained" },
    { id: "hamstrings", name: "Hamstrings", score: 50, eligible: true, historyState: "trained" },
    { id: "calves", name: "Calves", score: 50, eligible: true, historyState: "trained" },
    { id: "chest", name: "Chest", score: 10, eligible: true, historyState: "trained" }
  ];
  assert.deepEqual(runScore(context, "fitnessRankSavedWorkouts", averageScores, [
    { id: "legs", name: "Legs", muscleIds: ["quads", "hamstrings", "calves"] },
    { id: "chest", name: "Chest", muscleIds: ["chest"] }
  ]).map(item => item.name), ["Chest", "Legs"]);
});

test("recommendations exclude any resting target and keep calendar-day recovery boundaries", () => {
  const context = scoringContext();
  const settings = { muscleIntervals: { back: 7, biceps: 7, triceps: 7 }, preferredRestDays: { back: 1, biceps: 1, triceps: 1 } };
  const scores = runScore(context, "fitnessMuscleScores", { settings, workouts: [{ id: "back", date: "2026-10-13", muscleIds: ["back"] }] }, "2026-10-14");
  const plans = [
    { id: "arms", name: "Arms", muscleIds: ["biceps", "triceps"] },
    { id: "back-biceps", name: "Back & Biceps", muscleIds: ["back", "biceps"] },
    { id: "upper", name: "Upper Body", muscleIds: ["back", "biceps", "triceps"] }
  ];
  assert.equal(scores.find(item => item.id === "back").eligible, false);
  assert.deepEqual(runScore(context, "fitnessRankSavedWorkouts", scores, plans).map(item => item.name), ["Arms"]);
  const rested = runScore(context, "fitnessMuscleScores", { settings, workouts: [{ id: "back", date: "2026-10-12", muscleIds: ["back"] }] }, "2026-10-13").find(item => item.id === "back");
  const recovered = runScore(context, "fitnessMuscleScores", { settings, workouts: [{ id: "back", date: "2026-10-12", muscleIds: ["back"] }] }, "2026-10-14").find(item => item.id === "back");
  assert.equal(rested.eligible, false);
  assert.equal(rested.restDaysRemaining, 1);
  assert.equal(recovered.eligible, true);
  assert.equal(recovered.restDaysRemaining, 0);
});

test("a resting muscle remains selectable and can be saved in an actual manual workout", () => {
  let storedWorkout = null;
  const context = {
    S: { events: [] },
    document: { addEventListener() {} },
    window: {},
    esc: value => String(value),
    fitnessStoreSnapshot: () => ({
      settings: { muscleIntervals: { back: 7 }, preferredRestDays: { back: 1 } },
      workouts: [{ id: "yesterday", date: "2026-10-13", muscleIds: ["back"] }],
      savedWorkouts: []
    }),
    fitnessStoreUpsert(collection, record) { assert.equal(collection, "workouts"); storedWorkout = record; },
    todayStr: () => "2026-10-14",
    uid: () => "manual-log",
    render() {},
    flash() {},
    fitnessSetError(_form, message) { throw new Error(message); }
  };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  vm.runInContext(fitnessAppSource, context);
  const form = {
    dataset: {},
    elements: { date: { value: "2026-10-14" }, notes: { value: "" }, workoutChoice: { value: "custom" }, workoutName: { value: "Back Day" } },
    getAttribute: () => null,
    querySelectorAll: () => [{ type: "checkbox", checked: true, value: "back" }]
  };
  vm.runInContext('fitnessHandleRecord(__form,"workout")', Object.assign(context, { __form: form }));
  assert.deepEqual(Array.from(storedWorkout.muscleIds), ["back"]);
  assert.equal(storedWorkout.workoutName, "Back Day");
  const library = vm.runInContext('fitnessSavedWorkoutsHTML({savedWorkouts:[{id:"back-day",name:"Back Day",muscleIds:["back"]}]},{muscles:[{id:"back",name:"Back",eligible:false,status:"Resting"}]})', context);
  assert.match(library, /data-fitness-log-saved-workout="back-day"/);
  assert.doesNotMatch(library, /data-fitness-log-saved-workout="back-day" disabled/);
  assert.match(library, /you can still log a workout you completed/);
  const emptyState = vm.runInContext('fitnessWorkoutRecommendations({savedWorkouts:[{id:"back-day",name:"Back Day",muscleIds:["back"]}]},{muscles:[{id:"back",name:"Back",eligible:false,status:"Resting"}]})', context);
  assert.match(emptyState, /No saved workout is eligible right now because an included muscle is resting/);
  assert.match(emptyState, /data-fitness-custom-workout>Custom Workout/);
});

test("recommendation ranking uses stable ties without another cadence penalty", () => {
  const context = scoringContext();
  const scores = runScore(context, "fitnessMuscleScores", {
    settings: {
      muscleIntervals: { chest: 3, shoulders: 10 },
      preferredRestDays: { chest: 1, shoulders: 3 }
    },
    workouts: [
      { id: "chest-history", date: "2026-10-23", muscleIds: ["chest"] },
      { id: "shoulders-history", date: "2026-10-16", muscleIds: ["shoulders"] }
    ]
  }, "2026-10-28").filter(item => item.id === "chest" || item.id === "shoulders");
  assert.deepEqual(scores.map(item => item.score), [80, 80]);
  assert.deepEqual(scores.map(item => item.eligible), [true, true]);
  const ranked = runScore(context, "fitnessRankSavedWorkouts", scores, [
    { id: "zeta", name: "Zeta", muscleIds: ["chest"] },
    { id: "alpha", name: "Alpha", muscleIds: ["shoulders"] }
  ]);
  assert.deepEqual(ranked.map(item => item.name), ["Alpha", "Zeta"]);
});

test("invalid, duplicate, unknown, empty, and identical workout data is handled safely", () => {
  const context = scoringContext();
  const scores = runScore(context, "fitnessMuscleScores", { settings: {}, workouts: [{ id: "bad", date: "not-a-date", muscleIds: ["chest"] }] }, "2026-10-14");
  const chest = scores.find(item => item.id === "chest");
  assert.equal(chest.historyState, "invalid");
  assert.equal(chest.eligible, false);
  assert.equal(runScore(context, "fitnessRankSavedWorkouts", scores, [{ id: "corrupt", name: "Corrupt", muscleIds: ["chest"] }]).length, 0);

  const available = scores.map(item => item.id === "chest" ? { ...item, historyState: "never-trained", eligible: true } : item);
  const ranked = runScore(context, "fitnessRankSavedWorkouts", available, [
    { id: "same", name: "Chest", muscleIds: ["chest", "chest"] },
    { id: "copy", name: "Chest copy", muscleIds: ["chest"] },
    { id: "unknown", name: "Unknown", muscleIds: ["mystery"] },
    { id: "empty", name: "Empty", muscleIds: [] },
    { id: "bad-shape", name: "Bad shape", muscleIds: "chest" }
  ]);
  assert.deepEqual(ranked.map(item => item.id), ["same"]);
  assert.deepEqual(ranked[0].muscleIds, ["chest"]);
});

test("weight pace score is capped and deducts five percentage points per day behind", () => {
  const context = scoringContext();
  const settings = { startWeight: 200, startDate: "2026-10-01", targetWeight: 180, goalDate: "2026-10-21" };
  const weighIn = weight => [{ id: "today", date: "2026-10-11", weight }];
  const ahead = runScore(context, "fitnessWeightProgress", settings, weighIn(189), "2026-10-11");
  const onTrack = runScore(context, "fitnessWeightProgress", settings, weighIn(190), "2026-10-11");
  const behind = runScore(context, "fitnessWeightProgress", settings, weighIn(191), "2026-10-11");
  assert.equal(ahead.expectedWeight, 190);
  assert.equal(ahead.score, 100);
  assert.equal(ahead.daysAhead, 1);
  assert.equal(ahead.weightAhead, 1);
  assert.equal(ahead.status, "1 day ahead");
  assert.equal(onTrack.score, 100);
  assert.equal(onTrack.status, "On today's target");
  assert.equal(behind.score, 95);
  assert.equal(behind.daysBehind, 1);
  const gainSettings = { startWeight: 100, startDate: "2026-10-01", targetWeight: 120, goalDate: "2026-10-21" };
  assert.equal(runScore(context, "fitnessWeightProgress", gainSettings, weighIn(111), "2026-10-11").score, 100);
  assert.equal(runScore(context, "fitnessWeightProgress", gainSettings, weighIn(109), "2026-10-11").score, 95);
  assert.equal(runScore(context, "fitnessWeightProgress", gainSettings, weighIn(110.5), "2026-10-11").score, 100);
  const fractionalGainBehind = runScore(context, "fitnessWeightProgress", gainSettings, weighIn(109.5), "2026-10-11");
  assert.ok(Math.abs(fractionalGainBehind.daysBehind-0.5)<1e-10);
  assert.ok(Math.abs(fractionalGainBehind.score-97.5)<1e-10);
  assert.equal(runScore(context, "fitnessWeightProgress", settings, weighIn(210), "2026-10-11").score, 0);
  const exampleSettings = { startWeight: 185, startDate: "2026-10-01", targetWeight: 165, goalDate: "2026-12-31" };
  const resultFor = weight => runScore(context, "fitnessWeightProgress", exampleSettings, weighIn(weight), "2026-10-14");
  const threePointNineBehind = resultFor(183);
  assert.equal(threePointNineBehind.expectedWeight, 185-20/91*13);
  assert.ok(Math.abs(threePointNineBehind.daysBehind-3.9)<1e-10);
  assert.ok(Math.abs(threePointNineBehind.score-80.5)<1e-10);
  const onePointSixBehind = resultFor(182.5);
  assert.ok(Math.abs(onePointSixBehind.daysBehind-1.625)<1e-10);
  assert.ok(Math.abs(onePointSixBehind.score-91.875)<1e-10);
  assert.equal(resultFor(185-20/91*13).score, 100);
  const aheadWeight = resultFor(180);
  assert.equal(aheadWeight.score, 100);
  assert.ok(Math.abs(aheadWeight.weightAhead-2.142857142857143)<1e-10);
  const fractionalBehind = resultFor(185-20/91*13+0.5*(20/91));
  assert.ok(Math.abs(fractionalBehind.daysBehind-0.5)<1e-10);
  assert.ok(Math.abs(fractionalBehind.score-97.5)<1e-10);
  const veryBehind = resultFor(210);
  assert.equal(veryBehind.score, 0);
  assert.ok(veryBehind.score>=0&&veryBehind.score<=100);
  const stale = runScore(context, "fitnessWeightProgress", settings, [{ id: "old", date: "2026-10-09", weight: 192 }], "2026-10-11");
  assert.equal(stale.expectedWeight, 190);
  assert.equal(stale.latestAge, 2);
  assert.equal(stale.latest.date, "2026-10-09");
  const afterGoalAhead = runScore(context, "fitnessWeightProgress", settings, [{ id: "after-ahead", date: "2026-10-22", weight: 179 }], "2026-10-22");
  const afterGoalBehind = runScore(context, "fitnessWeightProgress", settings, [{ id: "after-behind", date: "2026-10-22", weight: 181 }], "2026-10-22");
  assert.equal(afterGoalAhead.expectedWeight, 180);
  assert.equal(afterGoalAhead.score, 100);
  assert.equal(afterGoalAhead.goalStatus, "Goal reached");
  assert.equal(afterGoalBehind.score, 95);
  assert.equal(afterGoalBehind.goalStatus, "Goal date passed");

  const appContext = {
    document: { addEventListener() {} },
    window: { confirm() { return false; } },
    esc(value) { return String(value); }
  };
  vm.createContext(appContext);
  vm.runInContext(scoringSource, appContext);
  vm.runInContext(fs.readFileSync(path.join(root, "app-fitness.js"), "utf8"), appContext);
  appContext.fitnessWeightChartHTML = () => "";
  appContext.__weightData = {
    settings: { ...exampleSettings, weightUnit: "lb" },
    weighIns: [{ id: "today", date: "2026-10-14", weight: 183 }],
    workouts: [],
    runs: []
  };
  const contentFor = today => vm.runInContext(`fitnessWeightContent(__weightData,{weight:fitnessWeightProgress(__weightData.settings,__weightData.weighIns,"${today}")},"${today}")`, appContext);
  const content = contentFor("2026-10-14");
  assert.match(content, /<strong aria-label="On-track score 81 out of 100">81<\/strong><span>3\.9 days behind<\/span>/);
  assert.match(content, /0\.9 lb behind today's target/);
  assert.match(content, /Today’s Target/);
  assert.match(content, /Latest Weight/);
  assert.match(content, /Goal Weight/);
  assert.ok(content.indexOf("Today’s Target")<content.indexOf("Latest Weight"));
  assert.ok(content.indexOf("Latest Weight")<content.indexOf("Goal Weight"));
  assert.ok(content.indexOf("Goal Weight")<content.indexOf("fitness-weight-timeline"));
  assert.match(content, /13 of 91 days/);
  assert.match(content, /78<\/strong>/);
  appContext.__weightData.weighIns = [{ id: "target", date: "2026-10-14", weight: 185-20/91*13 }];
  assert.match(contentFor("2026-10-14"), /<strong aria-label="On-track score 100 out of 100">100<\/strong><span>On today's target<\/span>/);
  appContext.__weightData.weighIns = [{ id: "ahead", date: "2026-10-14", weight: 180 }];
  assert.match(contentFor("2026-10-14"), /<strong aria-label="On-track score 100 out of 100">100<\/strong><span>Ahead of today's target<\/span>/);
  assert.match(contentFor("2026-10-14"), /2\.1 lb ahead of today's target/);
  appContext.__weightData.weighIns = [{ id: "stale", date: "2026-10-13", weight: 183 }];
  assert.match(contentFor("2026-10-14"), /Estimate uses your last recorded weigh-in from Oct 13, 2026/);
  assert.match(contentFor("2026-10-14"), /Oct 13, 2026/);
  assert.equal(runScore(context, "fitnessOverallScore", 100, 100, ahead.score), 100);
  const pageAppContext = { document: { addEventListener() {} }, window: { confirm() { return false; } } };
  vm.createContext(pageAppContext);
  vm.runInContext(scoringSource, pageAppContext);
  vm.runInContext(fs.readFileSync(path.join(root, "app-fitness.js"), "utf8"), pageAppContext);
  pageAppContext.__data = { settings, weighIns: weighIn(189), workouts: [], runs: [] };
  const pageScores = JSON.parse(JSON.stringify(vm.runInContext('fitnessPageScores(__data,"2026-10-11")', pageAppContext)));
  assert.equal(pageScores.weight.score, 100);
  assert.equal(pageScores.overall, 100, "weight contributes no more than 100% to the overall score");
});

test("legacy Tend states gain fitness defaults without changing existing state or imported fitness records", () => {
  const getFunction = name => name === "ensureFitnessShape" ? coreSource.match(/function ensureFitnessShape\(st\)\{[\s\S]*?^\}/m)[0] : coreSource.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^\\n]*\\}`))[0];
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${getFunction("defaultFitnessState")};${getFunction("ensureFitnessShape")}`, context);
  const legacy = { events: [{ id: "keep" }], people: [{ id: "person" }] };
  vm.runInContext("ensureFitnessShape(__state)", Object.assign(context, { __state: legacy }));
  assert.equal(legacy.events[0].id, "keep");
  assert.equal(legacy.people[0].id, "person");
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.fitness.workouts)), []);
  assert.equal(legacy.fitness.settings.muscleIntervals.chest, 7);
  const saved = {
    fitness: { version: 1, settings: { weeklyRunTarget: 4 }, rhythms: [{ id: "early-abs", text: "Early morning Abs", type: "workout", strengthMode: "specific", workoutId: "abs-id", freq: "daily", tod: "early" }], workouts: [{ id: "saved" }], runs: [], weighIns: [] }
  };
  vm.runInContext("ensureFitnessShape(__state)", Object.assign(context, { __state: saved }));
  assert.equal(saved.fitness.workouts[0].id, "saved");
  assert.equal(saved.fitness.settings.weeklyRunTarget, 4);
  assert.equal(saved.fitness.settings.muscleIntervals.chest, 7);
  assert.equal(saved.fitness.rhythms[0].workoutId, "abs-id");
});

test("legacy Fitness rhythms migrate once into shared rhythms without losing settings or history", () => {
  let saveCount = 0;
  const legacyWorkout = {
    id: "sunday-strength",
    text: "Sunday workout",
    type: "workout",
    description: "Evening session",
    freq: "weekly",
    weekdays: [0],
    tod: "evening",
    strengthMode: "specific",
    workoutId: "push-pull",
    sharedWith: ["person-1"]
  };
  const existing = {
    id: "sunday-strength",
    areas: ["marriage"],
    history: [{ date: "2026-10-11" }]
  };
  const context = {
    S: {
      areaRhythms: [existing],
      fitness: { rhythms: [legacyWorkout, { id: "unrelated", type: "other" }] },
      events: [{ id: "completion", rhythmId: "sunday-strength", fitnessLogId: "log-1" }],
      people: []
    },
    window: {
      ensureShape(state) { return state; },
      personRhythmScheduleHTML() {},
      faithRhythmRowHTML() {},
      rhythmRow() {},
      areaScore() {},
      tendSearchMatches() { return { rhythms: [] }; },
      addEventListener() {}
    },
    document: {
      createElement() { return { textContent: "" }; },
      head: { appendChild() {} }
    },
    save() { saveCount += 1; }
  };
  vm.createContext(context);
  vm.runInContext(categorySource, context);
  const migrated = context.S.areaRhythms.filter(item => item.id === "sunday-strength");
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].fitnessType, "workout");
  assert.equal(Object.hasOwn(migrated[0], "type"), false);
  assert.equal(migrated[0].strengthMode, "specific");
  assert.equal(migrated[0].workoutId, "push-pull");
  assert.equal(migrated[0].freq, "weekly");
  assert.deepEqual(Array.from(migrated[0].weekdays), [0]);
  assert.equal(migrated[0].tod, "evening");
  assert.deepEqual(Array.from(migrated[0].sharedWith), ["person-1"]);
  assert.deepEqual(Array.from(migrated[0].areas), ["marriage", "health"]);
  assert.equal(migrated[0].history[0].date, "2026-10-11");
  assert.equal(context.S.events[0].fitnessLogId, "log-1");
  assert.deepEqual(context.S.fitness.rhythms.map(item => item.id), ["unrelated"]);
  assert.equal(saveCount, 1);
});

test("fitness persistence adapter upserts, edits, deletes, imports, and saves through Tend state", () => {
  const getFunction = name => name === "ensureFitnessShape" ? coreSource.match(/function ensureFitnessShape\(st\)\{[\s\S]*?^\}/m)[0] : coreSource.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^\\n]*\\}`))[0];
  let saveCount = 0;
  const context = {
    S: { fitness: { workouts: [], runs: [], weighIns: [] } },
    save() { saveCount += 1; },
    document: { addEventListener() {} },
    window: { confirm() { return false; } },
    console
  };
  vm.createContext(context);
  vm.runInContext(`${getFunction("defaultFitnessState")};${getFunction("ensureFitnessShape")};function ensureShape(value){return ensureFitnessShape(value)};${dataSource}`, context);
  vm.runInContext('fitnessStoreUpdateSettings({weeklyRunTarget:3,preferredRestDays:{chest:2,abs:0}});fitnessStoreUpsert("savedWorkouts",{id:"plan1",name:"Upper body",muscleIds:["chest","triceps","chest"]});fitnessStoreUpsert("workouts",{id:"w1",date:"2026-10-12",muscleIds:["chest"]});fitnessStoreUpsert("workouts",{id:"w1",date:"2026-10-13",muscleIds:["chest","triceps"]});', context);
  let snapshot = JSON.parse(JSON.stringify(vm.runInContext("fitnessStoreSnapshot()", context)));
  assert.equal(snapshot.settings.weeklyRunTarget, 3);
  assert.equal(snapshot.workouts.length, 1);
  assert.equal(snapshot.workouts[0].date, "2026-10-13");
  assert.deepEqual(snapshot.savedWorkouts[0].muscleIds, ["chest", "triceps"]);
  assert.equal(snapshot.settings.preferredRestDays.chest, 2);
  assert.equal(snapshot.settings.preferredRestDays.abs, 0);
  vm.runInContext('fitnessStoreDelete("savedWorkouts","plan1")', context);
  assert.equal(vm.runInContext('fitnessStoreDelete("workouts","w1")', context), true);
  assert.equal(vm.runInContext('fitnessStoreDelete("workouts","missing")', context), false);
  vm.runInContext('fitnessStoreReplaceState({events:[],people:[]})', context);
  snapshot = JSON.parse(JSON.stringify(vm.runInContext("fitnessStoreSnapshot()", context)));
  assert.deepEqual(snapshot.workouts, []);
  assert.equal(snapshot.settings.muscleIntervals.chest, 7);
  assert.equal(saveCount, 7);
});

test("fitness rhythm logs link one scheduled occurrence and edits or deletes stay synchronized", () => {
  let saveCount = 0;
  const context = {
    S: {
      events: [],
      areaRhythms: [{ id: "abs-morning", text: "Early morning Abs", fitnessType: "workout", areas: ["health"], strengthMode: "specific", workoutId: "abs-id" }],
      fitness: {
        rhythms: [],
        workouts: [], runs: [], weighIns: [], savedWorkouts: []
      }
    },
    fitnessValidDate(value) { return /^\d{4}-\d\d-\d\d$/.test(value); },
    save() { saveCount += 1; },
    document: { addEventListener() {} },
    window: { confirm() { return false; } },
    console
  };
  vm.createContext(context);
  const getFunction = name => name === "ensureFitnessShape" ? coreSource.match(/function ensureFitnessShape\(st\)\{[\s\S]*?^\}/m)[0] : coreSource.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^\\n]*\\}`))[0];
  vm.runInContext(`${getFunction("defaultFitnessState")};${getFunction("ensureFitnessShape")};function ensureShape(value){return ensureFitnessShape(value)};${dataSource}`, context);
  vm.runInContext('fitnessStoreUpsert("workouts",{id:"log-1",date:"2026-10-15",muscleIds:["abs"],rhythmId:"abs-morning",rhythmOccurrence:"2026-10-15",fitnessType:"workout"});', context);
  let state = JSON.parse(JSON.stringify(context.S));
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].rhythmId, "abs-morning");
  assert.equal(state.events[0].rhythmOccurrence, "2026-10-15");
  assert.equal(state.events[0].fitnessLogId, "log-1");
  vm.runInContext('fitnessStoreUpsert("workouts",{id:"log-1",date:"2026-10-15",notes:"edited",muscleIds:["abs"],rhythmId:"abs-morning",rhythmOccurrence:"2026-10-15",fitnessType:"workout"});', context);
  state = JSON.parse(JSON.stringify(context.S));
  assert.equal(state.events.length, 1, "re-saving the same fitness log does not duplicate completion");
  assert.equal(state.events[0].title, "Early morning Abs");
  assert.equal(vm.runInContext('fitnessStoreDelete("workouts","log-1")', context), true);
  assert.equal(context.S.events.length, 0, "deleting a linked log removes its occurrence completion");
  assert.equal(saveCount, 3);
});

test("fitness rhythms reuse shared recurrence, Today cards, and occurrence history paths", () => {
  const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
  const historySource = fs.readFileSync(path.join(root, "rhythm-history.js"), "utf8");
  assert.ok(appSource.includes("personRhythmScheduleHTML(record,idf)"));
  assert.ok(appSource.includes('idf="fitness-rhythm|"+id'));
  assert.match(appSource, /data-fitness-occurrence/);
  assert.match(appSource, /A fitness log is already linked to this scheduled occurrence/);
  assert.match(viewSource, /fitnessRhythm:r\.id/);
  assert.ok(viewSource.includes('if(item.fitnessRhythm)return "fitness-rhythm:"+item.fitnessRhythm;'));
  assert.match(appSource, /Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday/);
  assert.ok(historySource.includes('isFitness?fitnessRhythmRecords().find'));
});

test("Fitness rhythm weekdays use explicit local weekday labels and occurrence keys", () => {
  const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
  const historySource = fs.readFileSync(path.join(root, "rhythm-history.js"), "utf8");
  const context = {
    document: { addEventListener() {} },
    window: {
      confirm() { return false; },
      addEventListener() {},
      scheduleDayMatches(rhythm, date) { return rhythm.weekdays.includes(date.getDay()); },
      personRhythmScheduleHTML() {
        return '<div class="dow-pills">' + [0, 1, 2, 3, 4, 5, 6].map(day => `<label class="dow-pill"><input data-rfield="x|weekdays" value="${day}"><span>${day}</span></label>`).join("") + '</div>';
      }
    },
    S: { events: [] }
  };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  vm.runInContext(appSource, context);
  context.__rhythm = { id: "evening", weekdays: [1, 2, 4, 5], freq: "weekly" };
  assert.equal(vm.runInContext('fitnessRhythmScheduled(__rhythm,"2026-10-12")', context), true, "Monday is scheduled");
  assert.equal(vm.runInContext('fitnessRhythmScheduled(__rhythm,"2026-10-13")', context), true, "Tuesday is scheduled");
  assert.equal(vm.runInContext('fitnessRhythmScheduled(__rhythm,"2026-10-14")', context), false, "Wednesday is not scheduled");
  assert.equal(vm.runInContext('fitnessRhythmScheduled(__rhythm,"2026-10-15")', context), true, "Thursday is scheduled separately from Tuesday");
  context.S.events.push({ rhythmId: "evening", rhythmOccurrence: "2026-10-15" });
  assert.equal(vm.runInContext('fitnessRhythmIsDue(__rhythm,"2026-10-15")', context), false, "one linked completion hides only its occurrence");
  const labels = vm.runInContext('fitnessRhythmScheduleHTML(__rhythm,"fitness-rhythm|evening")', context);
  assert.match(labels, /aria-label="Tuesday">Tuesday/);
  assert.match(labels, /aria-label="Thursday">Thursday/);
  assert.match(historySource, /fitnessLogId/);
});

test("Fitness Today cards extend the shared rhythm card with current strength guidance", () => {
  let fitnessData;
  const window = {
    addEventListener() {},
    scheduleDayMatches() { return true; },
    tendRhythmCardMetadata() { return { frequency: { full: "Daily", label: "Daily", narrow: "Daily" }, time: { full: "Evening", label: "Evening", narrow: "PM" }, lastTended: { full: "Never tended", label: "Never" }, frequencyIconHTML: "", timeIconHTML: "", lastIconHTML: "" }; },
    tendCategoryBadges() { return ""; }
  };
  const context = {
    document: { addEventListener() {} },
    window,
    S: { events: [] },
    todayStr() { return "2026-10-14"; },
    esc(value) { return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); },
    fitnessStoreSnapshot() { return JSON.parse(JSON.stringify(fitnessData)); },
    rhythmScore() { return 100; },
    scoreClass() { return "green"; },
    tendAssociationPeopleBadges() { return ""; }
  };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  vm.runInContext(sharedSource, context);
  vm.runInContext(fitnessAppSource, context);
  const data = {
    settings: {
      muscleIntervals: { biceps: 3, triceps: 3, back: 7 },
      preferredRestDays: { abs: 0, biceps: 1, triceps: 1, back: 1 }
    },
    workouts: [
      { id: "arms-old", date: "2026-10-01", muscleIds: ["biceps", "triceps"] },
      { id: "back-yesterday", date: "2026-10-13", muscleIds: ["back"] }
    ],
    runs: [],
    weighIns: [],
    savedWorkouts: [
      { id: "arms", name: "Arms", muscleIds: ["biceps", "triceps"] },
      { id: "back-day", name: "Back Day", muscleIds: ["back"] }
    ],
    rhythms: []
  };
  context.S.fitness = data;
  fitnessData = data;
  const weigh = vm.runInContext('fitnessTodayRhythmCardHTML({id:"weigh",type:"weighin",text:"Morning weight"},false)', context);
  assert.match(weigh, /class="rhythm-card card today-rhythm-card rhythm-card--fitness"/);
  assert.match(weigh, /Morning weight/);
  assert.match(weigh, />Log weight<\/button>/);
  assert.match(weigh, /today-rhythm-card__details-toggle/);
  assert.match(weigh, /aria-expanded="false"/);
  assert.match(weigh, /<dialog class="today-rhythm-details-dialog" id="today-rhythm-details-fitness-weigh-dialog"/);
  assert.match(weigh, /Last tended|Not yet tended/);
  assert.doesNotMatch(weigh, /<dialog[^>]* open/);
  const cardio = vm.runInContext('fitnessTodayRhythmCardHTML({id:"run",type:"cardio",text:"Run"},false)', context);
  assert.match(cardio, /class="rhythm-card card today-rhythm-card rhythm-card--fitness"/);
  assert.match(cardio, /Run/);
  assert.match(cardio, />Log cardio<\/button>/);
  const recommended = vm.runInContext('fitnessTodayRhythmCardHTML({id:"strength",type:"workout",text:"Evening workout",strengthMode:"recommended"},false)', context);
  assert.match(recommended, /Arms/);
  assert.match(recommended, /Recommended: Arms/);
  assert.match(recommended, /<p class="today-rhythm-card__support">Recommended: Arms<\/p>/);
  assert.match(recommended, />Log workout<\/button>/);
  assert.doesNotMatch(recommended, /Back Day/);
  assert.match(recommended, /<dialog class="today-rhythm-details-dialog" id="today-rhythm-details-fitness-strength-dialog"/);
  assert.match(recommended, /class="rhythm-card__edit" data-fitness-rhythm-edit="strength" aria-label="Edit Evening workout"/);
  const planned = vm.runInContext('fitnessTodayRhythmCardHTML({id:"specific",type:"workout",text:"Early morning Abs",strengthMode:"specific",workoutId:"arms"},false)', context);
  assert.match(planned, /<p class="today-rhythm-card__support">Planned: Arms<\/p>/);
  assert.match(planned, /Biceps, Triceps/);
  assert.doesNotMatch(planned, /Recommended:/);
  const completed = vm.runInContext('fitnessTodayRhythmCardHTML({id:"weigh",type:"weighin",text:"Morning weight"},true)', context);
  assert.match(completed, /✓ Logged/);
  assert.match(completed, /disabled aria-disabled="true"/);

  context.fitnessDialog = {
    kind: "workout",
    muscleIds: [],
    rhythmContext: { rhythmId: "strength", occurrence: "2026-10-14", strengthMode: "recommended", initialWorkoutId: "arms" }
  };
  const modal = vm.runInContext("fitnessRecordDialog(__data)", Object.assign(context, { __data: data }));
  assert.match(modal, /Log your workout/);
  assert.match(modal, /name="workoutChoice"/);
  assert.match(modal, /Arms · Recommended/);
  assert.match(modal, /Back Day · Back resting/);
  assert.doesNotMatch(modal, /option value="back-day"[^>]*disabled/);
  assert.match(modal, /Custom workout/);
  assert.match(modal, /Save Log/);
  context.fitnessDialog.workoutChoiceId = "custom";
  const customModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  for (const muscle of ["Shoulders", "Chest", "Back", "Biceps", "Triceps", "Abs", "Quads", "Hamstrings", "Calves"]) {
    assert.match(customModal, new RegExp(muscle));
  }
  assert.match(customModal, /Resting · ready in 1 day/);
  assert.match(customModal, /name="muscleIds" value="back"[^>]*>/);
  assert.match(customModal, /Still selectable when logging an actual workout/);
  assert.doesNotMatch(customModal, /name="muscleIds" value="back"[^>]*disabled/);
  assert.match(customModal, /Workout name \(optional\)/);
  assert.match(customModal, /placeholder="Name this custom workout"/);
  context.fitnessDialog.rhythmContext = null;
  context.fitnessDialog.workoutChoiceId = null;
  const directCustomModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.ok(directCustomModal.indexOf('name="date"') < directCustomModal.indexOf('name="workoutChoice"'));
  assert.match(directCustomModal, /name="workoutChoice"/);
  assert.match(directCustomModal, /name="muscleIds" value="shoulders"/);
  assert.match(directCustomModal, /name="workoutName"/);
  context.fitnessDialog.workoutChoiceId = "arms";
  const savedChoiceModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.match(savedChoiceModal, /value="arms" selected/);
  assert.match(savedChoiceModal, /Arms includes/);
  assert.doesNotMatch(savedChoiceModal, /name="muscleIds" value="shoulders"/);
  context.fitnessDialog.kind = "savedWorkout";
  context.fitnessDialog.workoutDraft = { id: "draft", name: "", muscleIds: [], sharedWith: [] };
  const savedWorkoutEditor = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.match(savedWorkoutEditor, /\+ Add Person/);
  context.fitnessDialog.kind = "workout";
  context.fitnessDialog.workoutChoiceId = null;
  data.workouts.push({ id: "custom-log", date: "2026-10-14", muscleIds: ["chest"], workoutName: "Push Day" });
  context.fitnessDialog.id = "custom-log";
  const editCustomModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.match(editCustomModal, /name="workoutName"[^>]*value="Push Day"/);
  context.fitnessDialog.workoutChoiceId = null;
  context.fitnessDialog.id = null;
  context.fitnessDialog.rhythmContext = { rhythmId: "specific", occurrence: "2026-10-14", strengthMode: "specific", configuredWorkoutId: "arms", initialWorkoutId: "arms" };
  const specificModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.match(specificModal, /value="arms" selected/);
  context.fitnessDialog.rhythmContext = { rhythmId: "specific", occurrence: "2026-10-14", strengthMode: "specific", configuredWorkoutId: "back-day", initialWorkoutId: "back-day" };
  const restingSpecificModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.match(restingSpecificModal, /Some planned muscle groups are recovering. You can still log the workout you completed/);
  assert.match(restingSpecificModal, /<option value="back-day" selected/);
  context.fitnessDialog.rhythmContext = { rhythmId: "specific", occurrence: "2026-10-14", strengthMode: "specific", configuredWorkoutId: "deleted", initialWorkoutId: "custom" };
  const unavailableModal = vm.runInContext("fitnessRecordDialog(__data)", context);
  assert.match(unavailableModal, /configured workout is unavailable/);
  assert.match(unavailableModal, /data-fitness-rhythm-edit="specific"/);
});

test("opening a Fitness rhythm keeps the current Today route and opens only its linked log", () => {
  const openRhythm = fitnessAppSource.match(/function fitnessOpenRhythm\(id\)\{[\s\S]*?\n\}/)[0];
  const rhythms = [
    { id: "weighin", type: "weighin" },
    { id: "run", type: "cardio" },
    { id: "workout", type: "workout", strengthMode: "recommended" }
  ];
  const context = {
    S: { fitness: { rhythms } },
    fitnessStoreSnapshot: () => ({ rhythms, savedWorkouts: [] }),
    fitnessRhythmCompletionToday: () => false,
    fitnessPageScores: () => ({ muscles: [] }),
    fitnessRankSavedWorkouts: () => [],
    todayStr: () => "2026-10-14",
    fitnessOpen: (...args) => { context.opened = args; },
    flash() {},
    tab: "today",
    currentArea: null,
    currentPerson: null,
    openDetail: null
  };
  vm.createContext(context);
  vm.runInContext(openRhythm, context);
  for (const [rhythmId, kind] of [["weighin", "weighin"], ["run", "run"], ["workout", "workout"]]) {
    context.__rhythmId = rhythmId;
    vm.runInContext("fitnessOpenRhythm(__rhythmId)", context);
    assert.equal(context.tab, "today");
    assert.equal(context.currentArea, null);
    assert.equal(context.opened[0], kind);
    assert.equal(context.opened[1], null);
    assert.deepEqual(Array.from(context.opened[2]), []);
    assert.deepEqual(JSON.parse(JSON.stringify(context.opened[3])).rhythmId, rhythmId);
  }
  assert.match(fitnessAppSource, /function fitnessRenderDialogPortal\(\)[\s\S]*portal\.innerHTML=html/);
  assert.match(viewSource, /fitnessRenderDialogPortal\(\)/);
});

test("Fitness rhythms are managed in type-filtered section subtabs", () => {
  assert.doesNotMatch(fitnessAppSource, /\["schedules","Schedules"\]/);
  assert.match(fitnessAppSource, /\["training","Training"\],\["workouts","Workouts"\],\["rhythms","Rhythms"\]/);
  assert.match(fitnessAppSource, /\["progress","Progress"\],\["rhythms","Rhythms"\]/);
  assert.match(fitnessAppSource, /fitnessRhythmListHTML\(data,"workout"\)/);
  assert.match(fitnessAppSource, /fitnessRhythmListHTML\(data,"cardio"\)/);
  assert.match(fitnessAppSource, /fitnessRhythmListHTML\(data,"weighin"\)/);
  assert.match(fitnessAppSource, /function fitnessRhythmListHTML\(data,type\)[\s\S]*rhythm\.type===type/);
  assert.match(fitnessAppSource, />Edit Rhythm<\/button>/);
  assert.match(fitnessAppSource, />Delete<\/button>/);
  assert.match(fitnessAppSource, /data-fitness-rhythm-pause/);
  assert.match(fitnessAppSource, /id==="schedules"\|\|id==="rhythms"/);
  assert.match(viewSource, /if\(r\.paused\|\|/);
  assert.match(fitnessAppSource, /data-fitness-custom-workout>Custom Workout<\/button>/);
  assert.match(fitnessAppSource, /Add Rhythm/);
  assert.match(fitnessAppSource, /Go to Strength → Workouts/);
  assert.match(fitnessAppSource, /Continue editing rhythm/);
  assert.match(fitnessAppSource, /Edit Rhythm/);
  assert.match(fitnessAppSource, /<label>Rhythm name/);
});

test("Fitness rhythm lists filter by structured type and show explicit weekday timing", () => {
  let currentData;
  const window = {
    addEventListener() {},
    tendRhythmCardMetadata(rhythm) {
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const selected = (rhythm.weekdays || []).map(day => weekdays[day]).join(", ");
      const frequency = rhythm.freq === "daily" ? "Daily" : selected ? "Weekly · " + selected : "Weekly";
      const time = rhythm.tod === "anytime" ? "Anytime" : "Evening";
      return { frequency: { full: frequency, label: frequency, narrow: frequency }, time: { full: time, label: time, narrow: time === "Evening" ? "PM" : time }, lastTended: { full: "Never tended", label: "Never" }, frequencyIconHTML: "", timeIconHTML: "", lastIconHTML: "" };
    },
    tendCategoryBadges() { return ""; }
  };
  const context = {
    document: { addEventListener() {} },
    window,
    S: { events: [] },
    TODS: { evening: "Evening" },
    todayStr() { return "2026-10-12"; },
    esc(value) { return String(value); },
    fitnessStoreSnapshot() { return currentData; },
    rhythmScore() { return 100; },
    scoreClass() { return "green"; },
    tendAssociationPeopleBadges() { return ""; }
  };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  vm.runInContext(sharedSource, context);
  vm.runInContext(fitnessAppSource, context);
  context.__data = {
    rhythms: [
      { id: "strength", type: "workout", text: "Weekday workout", freq: "weekly", weekdays: [1, 2, 4, 5], tod: "evening", strengthMode: "recommended" },
      { id: "run", type: "cardio", text: "Run", freq: "weekly", weekdays: [0], tod: "evening", paused: true },
      { id: "weight", type: "weighin", text: "Weigh-In", freq: "daily", tod: "anytime" }
    ],
    savedWorkouts: [],
    settings: {},
    workouts: [],
    runs: [],
    weighIns: []
  };
  currentData = context.__data;
  const strength = vm.runInContext('fitnessRhythmListHTML(__data,"workout")', context);
  const cardio = vm.runInContext('fitnessRhythmListHTML(__data,"cardio")', context);
  const weight = vm.runInContext('fitnessRhythmListHTML(__data,"weighin")', context);
  assert.match(strength, /Weekly · Mon, Tue, Thu, Fri/);
  assert.match(strength, /Preferred time: Evening/);
  assert.match(strength, /No saved workout is eligible right now\. You can still log a custom workout/);
  assert.doesNotMatch(strength, />Run</);
  assert.match(cardio, />Paused</);
  assert.match(cardio, />Resume</);
  assert.doesNotMatch(cardio, />Weigh-In</);
  assert.match(weight, /Daily/);
  assert.match(weight, /Preferred time: Anytime/);
  assert.doesNotMatch(weight, /Weekday workout/);
});

test("Health & Fitness is the existing Health area and its goals, forms, and data use Tend persistence", () => {
  const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
  assert.match(viewSource, /if\(id==="health"&&typeof renderFitnessPage==="function"\)return renderFitnessPage\(\)/);
  assert.match(categorySource, /if\(id==="health"&&typeof renderFitnessPage==="function"\)return renderFitnessPage\(\)/);
  assert.match(indexSource, /app-fitness-data\.js/);
  assert.match(indexSource, /app-fitness-scoring\.js/);
  assert.match(indexSource, /app-fitness\.js/);
  assert.match(appSource, /FITNESS_TABS=\[\["strength","Strength"\],\["cardio","Cardio"\],\["weight","Body Weight"\]\]/);
  assert.match(appSource, /function fitnessPanelHTML\(name,content\)\{[\s\S]*?role="region"/);
  assert.match(appSource, /data-fitness-form="goals"/);
  assert.match(appSource, /data-fitness-form="'\+kind\+'/);
  assert.match(appSource, /kind==="workout"/);
  assert.match(appSource, /class="muscle" data-muscle=/);
  assert.match(dataSource, /S\.fitness=data;save\(\)/);
  assert.match(authSource, /id="syncExport"/);
  assert.match(authSource, /id="syncImport"/);
  assert.match(dataSource, /fitnessStoreReplaceState\(imported\)/);
});

test("Fitness summary follows Faith health styling and section navigation has no duplicate tabs", () => {
  const context = {
    document: { addEventListener() {}, querySelector() { return { focus() {} }; } },
    window: { addEventListener() {} },
    S: { events: [] },
    render() {},
    scoreClass(score) { return score >= 80 ? "green" : score >= 50 ? "yellow" : "red"; },
    scoreLabel(score) { return score >= 80 ? "Healthy" : score >= 50 ? "Slipping - tend it soon" : "Needs attention now"; },
    personHealthColor(score) { return score === null ? "#CBD5D0" : "rgb(255,90,69)"; },
    todayStr() { return "2026-10-15"; },
    esc(value) { return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }
  };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  vm.runInContext(sharedSource, context);
  vm.runInContext(fitnessAppSource, context);
  const data = {
    settings: { muscleIntervals: { chest: 7 }, weeklyRunTarget: 2, weeklyMileTarget: 10, weightUnit: "lb" },
    workouts: [{ id: "old-chest", date: "2026-10-01", muscleIds: ["chest"] }],
    savedWorkouts: [{ id: "chest-day", name: "Chest Day", muscleIds: ["chest"] }],
    runs: [{ id: "run", date: "2026-10-14", distance: 3 }],
    weighIns: []
  };
  context.__data = data;
  const scores = vm.runInContext('fitnessPageScores(__data,"2026-10-15")', context);
  context.__scores = scores;
  const summary = vm.runInContext("fitnessSummaryHTML(__scores)", context);
  context.__strengthGoals = vm.runInContext('fitnessGoalsDialog(__data,"strength")', context);
  context.__cardioGoals = vm.runInContext('fitnessGoalsDialog(__data,"cardio")', context);
  context.__weightGoals = vm.runInContext('fitnessGoalsDialog(__data,"weight")', context);
  const activePanel = vm.runInContext('fitnessPanelHTML("strength","Training content")', context);
  const inactivePanel = vm.runInContext('fitnessPanelHTML("cardio","Cardio content")', context);
  assert.match(fitnessAppSource, /tendCategoryPageHeaderHTML\("Health & Fitness","fitness-page-heading"\)/);
  assert.match(summary, /Overall Health &amp; Fitness consistency/);
  assert.match(summary, /category-health-card fitness-summary-card/);
  assert.match(summary, /health-summary-breakdown/);
  assert.match(summary, /health-summary-score red/);
  assert.match(summary, /class="health-summary-item is-action"/);
  assert.match(summary, /aria-label="View Strength details/);
  assert.match(summary, /data-fitness-tab="strength"/);
  assert.match(summary, /data-fitness-tab="cardio"/);
  assert.match(summary, /data-fitness-tab="weight"/);
  assert.match(summary, /Weekly goal completion/);
  assert.match(summary, /class="category-health-score red"/);
  assert.doesNotMatch(summary, /How scores work/);
  assert.match(context.__strengthGoals, /Strength goals/);
  assert.match(context.__strengthGoals, /Set how often you train each muscle and its preferred rest days\./);
  assert.match(context.__strengthGoals, /How rest days work/);
  assert.match(context.__strengthGoals, /Rest days are full days between workouts\. One rest day means training Monday allows the next workout Wednesday\. Abs may use zero rest days\./);
  assert.match(context.__strengthGoals, /name="interval-chest"[^>]*aria-describedby="fitness-strength-error-chest"/);
  assert.match(context.__strengthGoals, /name="rest-chest"[^>]*aria-describedby="fitness-strength-error-chest"/);
  assert.match(context.__strengthGoals, /Chest training interval in days/);
  assert.match(context.__strengthGoals, /Chest preferred rest days/);
  assert.match(context.__strengthGoals, /aria-label="Close Strength goals"/);
  assert.match(context.__strengthGoals, /data-editor-cancel/);
  const muscleOrder = ["Shoulders", "Chest", "Back", "Biceps", "Triceps", "Abs", "Quads", "Hamstrings", "Calves"];
  const rowPositions = muscleOrder.map(name => context.__strengthGoals.indexOf(`role="rowheader">${name}</span>`));
  assert.ok(rowPositions.every(position => position >= 0));
  assert.deepEqual(rowPositions, [...rowPositions].sort((a, b) => a - b));
  assert.match(stylesSource, /\.fitness-strength-table-head,\.fitness-strength-row\{display:grid;grid-template-columns:minmax\(100px,1\.15fr\) minmax\(100px,1fr\) minmax\(100px,1fr\)/);
  assert.match(stylesSource, /\.fitness-strength-goals-dialog \.fitness-goals-settings\{min-height:0;overflow:auto/);
  assert.match(stylesSource, /\.fitness-strength-goals-dialog \.fitness-goals-actions\{[^}]*border-top:1px solid/);
  assert.doesNotMatch(context.__strengthGoals, /weeklyRunTarget|startWeight/);
  assert.match(context.__cardioGoals, /name="weeklyRunTarget"/);
  assert.doesNotMatch(context.__cardioGoals, /interval-chest|startWeight/);
  assert.match(context.__weightGoals, /name="startWeight"/);
  assert.doesNotMatch(context.__weightGoals, /interval-chest|weeklyRunTarget/);
  assert.match(summary, /class="category-health-fill red"/);
  assert.match(stylesSource, /\.category-health-fill\.red\{background:#FF5A45\}/);
  assert.match(activePanel, /role="region" aria-label="Strength" id="fitness-panel-strength"/);
  assert.doesNotMatch(activePanel, / hidden/);
  assert.match(inactivePanel, /id="fitness-panel-cardio" hidden/);
  vm.runInContext('fitnessShowTab("cardio")', context);
  assert.equal(context.fitnessCurrentTab, "cardio");
  assert.doesNotMatch(summary, /Your progress|Consistency &amp; goal progress|physical health/);
  assert.doesNotMatch(fitnessAppSource, /fitnessTabsHTML|fitnessOverview|fitnessHistoryPanel|fitnessPanelHTML\("(overview|history)"/);
  assert.match(fitnessAppSource, /function fitnessPanelHTML\(name,content\)\{[\s\S]*?role="region"/);
  assert.doesNotMatch(fitnessAppSource.match(/function renderFitnessPage\(\)\{[\s\S]*?\n\}/)[0], /fitnessTabsHTML/);
  assert.match(fitnessAppSource, /function fitnessGoalsButtonHTML\(section\)[\s\S]*data-fitness-goal-section=/);
  assert.match(fitnessAppSource.match(/function fitnessBodyMapHTML\(scores,instance\)\{[\s\S]*?\n\}/)[0], /fitnessGoalsButtonHTML\("strength"\)/);
  assert.match(fitnessAppSource.match(/function fitnessCardioPanel\(data,scores,today\)\{[\s\S]*?\n\}/)[0], /fitnessCardHTML\("Weekly cardio"[\s\S]*actionHTML:fitnessGoalsButtonHTML\("cardio"\)/);
  assert.match(fitnessAppSource.match(/function fitnessWeightPanel\(data,scores,today\)\{[\s\S]*?\n\}/)[0], /fitnessCardHTML\("Body weight progress"[\s\S]*actionHTML:fitnessGoalsButtonHTML\("weight"\)/);
  assert.doesNotMatch(fitnessAppSource.match(/function fitnessStrengthPanel\(scores\)\{[\s\S]*?\n\}/)[0], /fitnessGoalsButtonHTML/);
  assert.doesNotMatch(fitnessAppSource.match(/function fitnessCardioPanel\(data,scores,today\)\{[\s\S]*?\n\}/)[0], /tabs\+fitnessGoalsButtonHTML/);
  assert.doesNotMatch(fitnessAppSource.match(/function fitnessWeightPanel\(data,scores,today\)\{[\s\S]*?\n\}/)[0], /tabs\+fitnessGoalsButtonHTML/);
  assert.match(stylesSource, /\.fitness-strength-heading h2\{[^}]*font-size:var\(--tend-type-card-title,16px\)/);
  assert.match(fitnessAppSource, /function fitnessGoalsDialog\(data,section\)[\s\S]*if\(section==="strength"\)[\s\S]*else if\(section==="cardio"\)[\s\S]*title="Weight goals"/);
  assert.match(fitnessAppSource, /fitness-section-bottom-action[\s\S]*data-fitness-open="run"/);
  assert.match(fitnessAppSource, /fitness-section-bottom-action[\s\S]*data-fitness-open="weighin"/);
  assert.doesNotMatch(fitnessAppSource.match(/function renderFitnessPage\(\)\{[\s\S]*?\n\}/)[0], /fitness-goals-button|data-fitness-open="goals"/);
});

test("Strength goals validate each muscle row and save only valid interval and rest settings", () => {
  const context = { document: { addEventListener() {} }, render() {}, flash() {} };
  vm.createContext(context);
  vm.runInContext(scoringSource, context);
  vm.runInContext(fitnessAppSource, context);
  const rows = {};
  const elements = {};
  for (const { id } of vm.runInContext("FITNESS_MUSCLES", context)) {
    elements[`interval-${id}`] = { value: "7", setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; }, focus() { this.focused = true; } };
    elements[`rest-${id}`] = { value: id === "abs" ? "0" : "1", setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; }, focus() {} };
    const error = { textContent: "" };
    rows[id] = { querySelector() { return error; }, error };
  }
  const form = {
    elements,
    getAttribute() { return "strength"; },
    querySelector(selector) {
      const match = selector.match(/data-strength-goal-row="([^"]+)"/);
      if (match) return rows[match[1]];
      return Object.values(elements).find(input => input["aria-invalid"] === "true") || null;
    }
  };
  context.__form = form;
  let savedPatch = null;
  context.fitnessStoreUpdateSettings = patch => { savedPatch = patch; };
  elements["interval-chest"].value = "1";
  elements["rest-chest"].value = "1";
  vm.runInContext("fitnessHandleGoals(__form)", context);
  assert.equal(savedPatch, null);
  assert.equal(rows.chest.error.textContent, "Training interval must exceed preferred rest days.");
  assert.equal(elements["interval-chest"]["aria-invalid"], "true");

  elements["interval-chest"].value = "4";
  elements["rest-abs"].value = "";
  vm.runInContext("fitnessHandleGoals(__form)", context);
  assert.equal(savedPatch, null);
  assert.equal(rows.abs.error.textContent, "Enter 0 to 364 rest days.");
  elements["rest-abs"].value = "0";
  vm.runInContext("fitnessHandleGoals(__form)", context);
  assert.equal(savedPatch.muscleIntervals.chest, 4);
  assert.equal(savedPatch.preferredRestDays.abs, 0);
  assert.equal(rows.chest.error.textContent, "");
  assert.equal(context.fitnessDialog, null);
});

test("Health & Fitness action color drives fitness cards and matching Log buttons", () => {
  const properties = {};
  const context = {
    settings: () => ({ actionColors: { fitness: "#4A8060" } }),
    document: {
      createElement: () => ({ style: {}, setAttribute() {} }),
      head: { appendChild() {} },
      documentElement: { style: { setProperty: (name, value) => { properties[name] = value; } } }
    },
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(actionColorsSource, context);
  assert.equal(vm.runInContext('actionColorSettings().fitness', context), "#4A8060");
  assert.equal(properties["--action-fitness-base"], "#4A8060");
  assert.ok(properties["--action-fitness-background"]);
  assert.ok(properties["--action-fitness-border"]);
  assert.match(settingsSource, /fitness:\["Health & Fitness","Log"\]/);
  assert.match(stylesSource, /\.rhythm-card--fitness \.rhythm-card__tend\.fitness-action-color\{border-color:var\(--action-fitness-border/);
  assert.match(stylesSource, /\.rhythm-card--fitness \.fitness-rhythm-summary/);
});

  test("strength map always shows all nine ordered muscles while anatomical regions switch views", () => {
    const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
    const context = {
      document: { addEventListener() {} },
      window: { confirm() { return false; } },
      settings: () => ({ greenAt: 80, yellowAt: 50 }),
      scoreClass: score => score >= 80 ? "green" : score >= 50 ? "yellow" : "red",
      esc(value) {
        return String(value).replace(/[&<>"']/g, char => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[char]);
      }
    };
    vm.createContext(context);
    vm.runInContext(scoringSource, context);
    vm.runInContext(appSource, context);
    context.__scores = { muscles: runScore(context, "fitnessMuscleScores", {
      settings: { muscleIntervals: { chest: 1 } },
      workouts: [{ id: "recent", date: "2026-10-11", muscleIds: ["chest"] }]
    }, "2026-10-13") };

    const listIds = html => {
      const start = html.indexOf('class="fitness-muscle-list"');
      const end = html.indexOf('<div class="fitness-muscle-legend"', start);
      return Array.from(html.slice(start, end).matchAll(/data-fitness-muscle="([^"]+)"/g), match => match[1]);
    };
    const regionIds = html => Array.from(html.matchAll(/<path class="muscle" data-muscle="([^"]+)"/g), match => match[1]);
    const expectedList = ["chest", "back", "biceps", "triceps", "shoulders", "abs", "quads", "hamstrings", "calves"];

    const front = vm.runInContext('fitnessBodyMapHTML(__scores,"Preview")', context);
    assert.deepEqual(listIds(front), expectedList);
    assert.deepEqual(regionIds(front), ["shoulders", "chest", "biceps", "abs", "quads", "calves"]);
    assert.match(front, /Tap a muscle to see its training settings\./);
    assert.match(front, /data-fitness-muscle="chest" aria-pressed="true"/);

    const back = vm.runInContext('fitnessBodyView="back";fitnessBodyMapHTML(__scores,"Preview")', context);
    assert.deepEqual(listIds(back), expectedList);
    assert.deepEqual(regionIds(back), ["shoulders", "back", "triceps", "hamstrings", "calves"]);

    const mapped = vm.runInContext('fitnessMapSVG("front",__scores.muscles)', context);
    assert.match(mapped, /viewBox="0 0 220 350"/);
    assert.match(mapped, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(mapped, /data-muscle="chest" data-fitness-muscle="chest" d="M81 89Q96 80 108 87L107 129Q86 137 76 122Z M139 89Q124 80 112 87L113 129Q134 137 144 122Z" fill="#(?:12B76A|FFC133|FF5A45)"/);
    assert.match(mapped, /data-muscle="biceps" data-fitness-muscle="biceps" d="M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z" fill="#e1e7dd"/);
    assert.match(mapped, /<text x="110" y="108" data-label="chest">90<\/text>/);
  });

  test("muscle selection outlines the matching map regions and keeps score fills intact", () => {
    const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
    const context = {
      document: { addEventListener() {} },
      window: { confirm() { return false; } },
      settings: () => ({ greenAt: 80, yellowAt: 50 }),
      scoreClass: score => score >= 80 ? "green" : score >= 50 ? "yellow" : "red",
      esc(value) {
        return String(value).replace(/[&<>"']/g, char => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[char]);
      }
    };
    vm.createContext(context);
    vm.runInContext(scoringSource, context);
    vm.runInContext(appSource, context);
    context.__scores = { muscles: runScore(context, "fitnessMuscleScores", {
      settings: { muscleIntervals: { chest: 1 } },
      workouts: [{ id: "recent", date: "2026-10-11", muscleIds: ["chest"] }]
    }, "2026-10-13") };

    const mapping = {
      shoulders: "front", chest: "front", back: "back", biceps: "front",
      triceps: "back", abs: "front", quads: "front", hamstrings: "back", calves: "front"
    };
    const names = {
      shoulders: "Shoulders", chest: "Chest", back: "Back", biceps: "Biceps",
      triceps: "Triceps", abs: "Abs", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves"
    };
    for (const [id, view] of Object.entries(mapping)) {
      vm.runInContext(`fitnessSelectedMuscleId="${id}";fitnessBodyView="${view}"`, context);
      const html = vm.runInContext('fitnessBodyMapHTML(__scores,"Selection")', context);
      const selectedRegions = Array.from(html.matchAll(/<path class="muscle" data-muscle="([^"]+)"[^>]*aria-pressed="true"/g), match => match[1]);
      const selectedRows = Array.from(html.matchAll(/<button type="button" class="fitness-muscle-row is-selected" data-fitness-muscle="([^"]+)"/g), match => match[1]);
      assert.deepEqual(selectedRegions, [id], `${id} should outline its matching SVG path in ${view}`);
      assert.deepEqual(selectedRows, [id], `${id} should be the only selected list row`);
      assert.match(html, new RegExp(`<h3>${names[id]} <strong`), `${id} should match the detail panel`);
      assert.match(html, /Train every \d+ days/);
      assert.match(html, /Preferred rest: \d+ full days/);
      assert.match(html, /Last trained:/);
      assert.match(html, /Edit training settings/);
      assert.doesNotMatch(html, /Selected muscle|Edit schedule/);

      const svg = vm.runInContext(`fitnessMapSVG("${view}",__scores.muscles)`, context);
      const region = svg.match(new RegExp(`<path class="muscle" data-muscle="${id}"[^>]+`))[0];
      assert.match(region, /aria-pressed="true"/);
      if (id === "chest") assert.match(region, /fill="#(?:12B76A|FFC133|FF5A45)"/);
      if (id !== "chest") assert.match(region, /fill="#e1e7dd"/);

      vm.runInContext("fitnessEditingInterval=true", context);
      const editingHTML = vm.runInContext('fitnessBodyMapHTML(__scores,"Selection")', context);
      assert.match(editingHTML, new RegExp(`data-fitness-interval="${id}"`));
      vm.runInContext("fitnessEditingInterval=false", context);
    }
  });

  test("muscle and view changes preserve only valid selections", () => {
    const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
    const context = {
      document: { addEventListener() {} },
      esc(value) { return String(value); }
    };
    vm.createContext(context);
    vm.runInContext(scoringSource, context);
    vm.runInContext(appSource, context);
    const select = id => vm.runInContext(`fitnessSelectMuscle("${id}")`, context);
    const setView = view => vm.runInContext(`fitnessSetBodyView("${view}")`, context);

    for (const [id, expectedView] of [["chest", "front"], ["biceps", "front"], ["abs", "front"], ["quads", "front"], ["back", "back"], ["triceps", "back"], ["hamstrings", "back"]]) {
      setView(expectedView === "front" ? "back" : "front");
      assert.equal(select(id), true);
      assert.equal(context.fitnessBodyView, expectedView, `${id} opens its anatomical view`);
      assert.equal(context.fitnessSelectedMuscleId, id);
    }
    for (const id of ["shoulders", "calves"]) {
      setView("front");
      select(id);
      assert.equal(setView("back"), true);
      assert.equal(context.fitnessSelectedMuscleId, id, `${id} is present in both views`);
      assert.equal(setView("front"), true);
      assert.equal(context.fitnessSelectedMuscleId, id, `${id} remains selected when returning`);
    }

    select("biceps");
    assert.equal(setView("back"), true);
    assert.equal(context.fitnessSelectedMuscleId, null);
    const scores = { muscles: runScore(context, "fitnessMuscleScores", { settings: {}, workouts: [] }, "2026-10-13") };
    const emptySelection = vm.runInContext('fitnessBodyMapHTML(__scores,"Empty")', Object.assign(context, { __scores: scores }));
    assert.match(emptySelection, /Select a muscle to see its training settings\./);
    assert.doesNotMatch(emptySelection, /class="fitness-muscle-row is-selected"/);
    assert.doesNotMatch(emptySelection, /data-fitness-interval=/);
    assert.equal(select("triceps"), true);
    assert.equal(context.fitnessBodyView, "back", "triceps must not be confused with front-view biceps");
    select("quads");
    assert.equal(context.fitnessBodyView, "front");
    select("hamstrings");
    assert.equal(context.fitnessBodyView, "back", "hamstrings must not be confused with front-view quads");
    assert.equal(setView("side"), false);
  });

  test("body-map SVG keeps the supplied geometry, viewBox, and label coordinates intact", () => {
    const appSource = fs.readFileSync(path.join(root, "app-fitness.js"), "utf8");
    const readSource = name => appSource.match(new RegExp(`var ${name}='([^']*)';`))[1];
    const dHash = svg => crypto.createHash("sha256")
      .update(Array.from(svg.matchAll(/<path[^>]* d="([^"]+)"/g), match => match[1]).sort().join("\n"))
      .digest("hex");
    const front = readSource("FITNESS_BODY_FRONT_SVG");
    const back = readSource("FITNESS_BODY_BACK_SVG");

    assert.equal(dHash(front), "c027c5d8fd27d6fd55b49d172feae47a9107cf6083234545ec4642a18db1e11b");
    assert.equal(dHash(back), "7c3b993dde1fae16c1ba893acc98679ec2446a2cf5217a63e9c22c686f1479c2");
    for (const svg of [front, back]) {
      assert.match(svg, /viewBox="0 0 220 350"/);
      assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
      assert.match(svg, /<ellipse cx="110" cy="36" rx="23" ry="28" \/>/);
      assert.match(svg, /stroke:#fff;stroke-width:2/);
    }
    assert.match(front, /<text x="110" y="108" data-label="chest">70<\/text>/);
    assert.match(front, /<text x="89" y="239" data-label="quads">100<\/text>/);
    assert.match(back, /<text x="110" y="142" data-label="back">100<\/text>/);
    assert.match(back, /<text x="88" y="243" data-label="hamstrings">80<\/text>/);
  });

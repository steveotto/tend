"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const viewSource = fs.readFileSync(path.join(root, "app-views1.js"), "utf8");
const upcomingSource = fs.readFileSync(path.join(root, "app-upcoming.js"), "utf8");
const categoryRhythmSource = fs.readFileSync(path.join(root, "app-categoryrhythms.js"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "app-dashboard.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "tend.css"), "utf8");

function makeStorage(initialState) {
  const values = new Map();
  if (initialState !== undefined) values.set("tend:state", JSON.stringify(initialState));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function coreHarness(initialState) {
  const localStorage = makeStorage(initialState);
  const context = {
    window: { TEND_CLOUD_MODE: false },
    localStorage,
    setTimeout,
    clearTimeout,
    console,
    Date,
    Math
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  return context;
}

test("a new local account has no seeded personal records or connected calendar", () => {
  const context = coreHarness();
  const state = JSON.parse(JSON.stringify(context.S));
  for (const key of ["people", "events", "tasks", "followups", "prayers", "ideas", "echoes", "keyDates", "checklists", "rhythms", "calendars"]) {
    assert.deepEqual(state[key], [], `${key} should start empty`);
  }
  assert.equal(state.areas.health.name, "Health & Fitness");
  for (const key of ["rhythms", "savedWorkouts", "workouts", "runs", "weighIns"]) {
    assert.deepEqual(state.fitness[key], [], `fitness.${key} should start empty`);
  }
  assert.equal(context.areaScore("marriage"), 50, "the scoring baseline remains available internally");
  assert.equal(context.displayAreaScore("marriage"), null, "an inactive area's score is unset in the UI");
  context.S.fitness.runs.push({ id: "run-1" });
  assert.equal(context.areaHasActivity("health"), true, "fitness logs count as Health & Fitness activity");
});

test("saved workout normalization preserves invalid muscle data for safe recommendation rejection", () => {
  const context = coreHarness({
    fitness: {
      savedWorkouts: [
        { id: "unknown", name: "Unknown group", muscleIds: ["chest", "mystery"] },
        { id: "malformed", name: "Malformed group", muscleIds: ["back", null] }
      ]
    }
  });
  const workouts = JSON.parse(JSON.stringify(context.S.fitness.savedWorkouts));
  assert.equal(workouts[0].invalidMuscleIds, true);
  assert.deepEqual(workouts[0].muscleIds, ["chest", "mystery"]);
  assert.equal(workouts[1].invalidMuscleIds, true);
  assert.deepEqual(workouts[1].muscleIds, ["back"]);
  context.__state = context.S;
  vm.runInContext("ensureFitnessShape(__state)", context);
  assert.equal(context.S.fitness.savedWorkouts[1].invalidMuscleIds, true, "invalid markers survive subsequent state normalization");
});

test("normalizing an empty or existing local state does not add people, dates, or calendars", () => {
  const context = coreHarness();
  const empty = context.ensureShape({ people: [], calendars: [], keyDates: [], rhythms: [] });
  assert.equal(empty.people.length, 0);
  assert.equal(empty.calendars.length, 0);
  assert.equal(empty.keyDates.length, 0);
  assert.equal(empty.rhythms.length, 0);

  const existing = coreHarness({
    people: [{ id: "saved-person", name: "Saved Person" }],
    calendars: [{ id: "saved-calendar", name: "Personal", url: "https://example.test/calendar.ics" }],
    keyDates: [{ id: "saved-date", label: "Saved date", month: 4, day: 5 }],
    rhythms: []
  });
  assert.equal(existing.S.people.length, 1);
  assert.equal(existing.S.people[0].id, "saved-person");
  assert.equal(existing.S.calendars.length, 1);
  assert.equal(existing.S.keyDates.length, 1);
});

test("dashboard greets without a name and includes an escaped saved display name", () => {
  const match = viewSource.match(/function dashboardGreeting\(greeting\)\{[^}]*\}/);
  assert.ok(match, "dashboard greeting helper should exist");
  const context = {
    window: { TendAuth: { displayName() { return ""; } } },
    esc(value) { return String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
  };
  vm.createContext(context);
  vm.runInContext(match[0], context);
  assert.equal(context.dashboardGreeting("Good afternoon"), "Good afternoon");
  context.window.TendAuth.displayName = () => "<Steve>";
  assert.equal(context.dashboardGreeting("Good afternoon"), "Good afternoon, &lt;Steve&gt;");
});

test("overall score stays unset until an area has activity, then retains the existing average", () => {
  const match = viewSource.match(/function overallScore\(\)\{[^}]+\}/);
  assert.ok(match, "overall score helper should exist");
  const state = { active: false };
  const context = {
    AREA_IDS: ["faith", "health"],
    areaHasActivity() { return state.active; },
    areaScore(id) { return id === "faith" ? 80 : 50; },
    avg(values) { return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length); }
  };
  vm.createContext(context);
  vm.runInContext(match[0], context);
  assert.equal(context.overallScore(), null);
  state.active = true;
  assert.equal(context.overallScore(), 65);
});

test("Health & Fitness area score uses the Fitness page's overall score", () => {
  const areaFunctions = [
    coreSource.match(/function areaScore\(id\)\{[\s\S]*?\n\}/)[0],
    coreSource.match(/function areaHasActivity\(id\)\{[\s\S]*?\n\}/)[0],
    coreSource.match(/function displayAreaScore\(id\)\{[^}]+\}/)[0]
  ].join("\n");
  const context = {
    S: {
      events: [{ areaId: "health", title: "Legacy health activity" }],
      rhythms: [{ category: "health", text: "Fitness rhythm" }],
      fitness: { workouts: [{ id: "workout" }] }
    },
    fitnessStoreSnapshot: () => ({ marker: "fitness-data" }),
    fitnessPageScores: (data, today) => {
      assert.equal(data.marker, "fitness-data");
      assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
      return { overall: context.fitnessScore };
    },
    todayStr: () => "2026-10-14",
    areaHasActivity: () => true,
    avg: () => 50,
    rhythmScore: () => 25,
    rawScore: () => 50,
    eventsFor: () => [],
    fitnessScore: 60
  };
  vm.createContext(context);
  vm.runInContext(areaFunctions, context);
  assert.equal(context.areaScore("health"), 60);
  assert.equal(context.displayAreaScore("health"), 60);
  context.fitnessScore = null;
  assert.equal(context.displayAreaScore("health"), null, "an unavailable fitness score remains unset");
  assert.equal(context.areaScore("marriage"), 50, "other category scoring remains unchanged");
});

test("category rhythm overrides preserve the unified Health & Fitness score", () => {
  const override = categoryRhythmSource.match(/var baseAreaScore=window\.areaScore;[\s\S]*?\n };/);
  assert.ok(override, "category score override should exist");
  const context = {
    CATEGORY_AREA_SET: { health: true },
    window: { areaScore: id => id === "health" ? 60 : 50 }
  };
  vm.createContext(context);
  vm.runInContext(override[0], context);
  assert.equal(context.window.areaScore("health"), 60, "Health & Fitness must use the Fitness page score");
});

test("the public iCloud feed is gone while optional user-configured calendars remain supported", () => {
  for (const source of [coreSource, upcomingSource, dashboardSource, indexSource]) {
    assert.doesNotMatch(source, /events\.json|tend-events\.json|TEND_EVENTS|ICAL_URL|p106-caldav\.icloud/);
  }
  assert.match(dashboardSource, /fetchICS\(calUrl\(ca\.url\)\)/);
  assert.equal(fs.existsSync(path.join(root, "events.json")), false);
  assert.equal(fs.existsSync(path.join(root, "tend-events.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".github/workflows/calendar.yml")), false);
});

test("Friendship area cards show first names and share the Parenting page width", () => {
  const renderer = upcomingSource.match(/function renderArea\(id\)\{[\s\S]*?return out\+'<\/main>';\}/);
  assert.ok(renderer, "area renderer should exist");
  const context = {
    S: {
      areas: { friendships: { name: "Friendship" } },
      people: [
        { id: "amy", name: "Amy Johnson", area: "friendships" },
        { id: "sam", name: "Sam Lee", area: "friendships" }
      ],
      tasks: []
    },
    areaHasActivity: () => false,
    esc: value => String(value),
    tendCategoryPageHeaderHTML: () => "",
    tendCategoryHealthSummaryHTML: options => options.contentHTML,
    personScore: () => 80,
    scoreClass: () => "green",
    personAvatar: () => "",
    areaHistoryHTML: () => "",
    taskDraftArea: null,
    editingId: null,
    activityComposerOpen: false
  };
  vm.createContext(context);
  vm.runInContext(renderer[0], context);
  const markup = context.renderArea("friendships");
  assert.match(markup, /class="category-page area-page area-page--friendships"/);
  assert.match(markup, />Amy<\/span>/);
  assert.match(markup, />Sam<\/span>/);
  assert.doesNotMatch(markup, /Amy Johnson|Sam Lee/);
  assert.equal(context.S.people[0].name, "Amy Johnson", "the stored full name remains unchanged");
  assert.equal(context.S.people[1].name, "Sam Lee", "the stored full name remains unchanged");
  assert.match(stylesSource, /\.area-page\{[^}]*max-width:760px/);
  assert.match(stylesSource, /\.area-page \.area-people-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

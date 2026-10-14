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
const dashboardSource = fs.readFileSync(path.join(root, "app-dashboard.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

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

test("the public iCloud feed is gone while optional user-configured calendars remain supported", () => {
  for (const source of [coreSource, upcomingSource, dashboardSource, indexSource]) {
    assert.doesNotMatch(source, /events\.json|tend-events\.json|TEND_EVENTS|ICAL_URL|p106-caldav\.icloud/);
  }
  assert.match(dashboardSource, /fetchICS\(calUrl\(ca\.url\)\)/);
  assert.equal(fs.existsSync(path.join(root, "events.json")), false);
  assert.equal(fs.existsSync(path.join(root, "tend-events.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".github/workflows/calendar.yml")), false);
});

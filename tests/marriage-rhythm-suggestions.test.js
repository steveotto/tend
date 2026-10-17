"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const categorySource = fs.readFileSync(path.join(root, "app-categoryrhythms.js"), "utf8");
const rhythmSource = fs.readFileSync(path.join(root, "app-rhythms3.js"), "utf8");

function createContext(state = {}) {
  let saves = 0;
  const context = {
    S: state,
    save() { saves += 1; },
    flash() {},
    render() {},
    renderPreservingScroll() {},
    rhythmEnded(record) { return !!record.ended; },
    todayStr() { return "2026-10-17"; },
    esc(value) { return String(value == null ? "" : value); },
    window: {
      ensureShape(value) {
        if (!Array.isArray(value.people)) value.people = [];
        if (!Array.isArray(value.areaRhythms)) value.areaRhythms = [];
        return value;
      },
      personRhythmScheduleHTML() { return ""; },
      faithRhythmRowHTML() {},
      rhythmRow() {},
      areaScore() {},
      renderArea() { return ""; },
      tendSearchMatches() { return { rhythms: [] }; },
      addEventListener() {}
    },
    document: {
      createElement() { return { textContent: "" }; },
      head: { appendChild() {} },
      addEventListener() {}
    }
  };
  vm.createContext(context);
  vm.runInContext(categorySource, context);
  return { context, get saves() { return saves; } };
}

function createRecurrenceContext() {
  const context = {
    S: { people: [] },
    save() {},
    todayStr() { return "2026-10-17"; },
    esc(value) { return String(value == null ? "" : value); },
    DOW: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    TODS: { anytime: "Flexible", evening: "Evening" },
    scheduleOptions(options, current) {
      return options.map(option => `<option value="${option[0]}"${String(current) === String(option[0]) ? " selected" : ""}>${option[1]}</option>`).join("");
    },
    scheduleWeekdayPills(selected, attribute) {
      return selected.map(day => `<input ${attribute} value="${day}" checked>`).join("");
    },
    scheduleEndDate() { return ""; },
    window: {
      personRhythmScheduleHTML() {},
      addEventListener() {}
    },
    document: {
      createElement() { return { textContent: "" }; },
      head: { appendChild() {} },
      addEventListener() {}
    }
  };
  vm.createContext(context);
  vm.runInContext(rhythmSource, context);
  return context;
}

test("the Marriage catalog has nine stable, title-independent suggestions", () => {
  const { context } = createContext();
  const catalog = JSON.parse(JSON.stringify(context.window.tendMarriageSuggestionCatalog()));

  assert.deepEqual(catalog.map(item => item.title), [
    "Daily Connection",
    "Pray Together",
    "Date Night",
    "Marriage Check-In",
    "Thoughtful Act of Love",
    "Dream Together",
    "Overnight Away",
    "Marriage Enrichment",
    "Week Away Together"
  ]);
  assert.deepEqual(catalog.map(item => item.freq), [
    "custom", "daily", "weekly", "weekly", "weekly", "quarterly", "quarterly", "yearly", "yearly"
  ]);
  assert.equal(catalog[0].id, "marriage.daily-connection");
  assert.equal(catalog[2].id, "marriage.date-night");
  assert.equal(catalog[7].id, "marriage.marriage-enrichment");
  assert.equal(context.S.areaRhythms.length, 0, "opening the catalog does not seed rhythms");
});

test("Daily Connection drafts are spouse-owned daily rhythms with a stable source identity", () => {
  const { context } = createContext({
    people: [{ id: "spouse-1", relation: "Spouse" }]
  });

  const draft = context.window.tendMarriageTemplateDraft("marriage.daily-connection");
  assert.equal(draft.id, "draft");
  assert.equal(draft.sourceTemplateId, "marriage.daily-connection");
  assert.equal(draft.marriageDailyConnection, true);
  assert.equal(draft.freq, "custom");
  assert.equal(draft.start, "2026-10-17");
  assert.equal(draft.personId, "spouse-1");
});

test("suggestion drafts keep flexible time and require chosen dates and weekly days", () => {
  const { context } = createContext({
    people: [{ id: "spouse-1", relation: "Spouse" }]
  });
  const draft = context.window.tendMarriageTemplateDraft("marriage.date-night");
  const quarterly = context.window.tendMarriageTemplateDraft("marriage.dream-together");

  assert.equal(draft.tod, "evening");
  assert.equal(draft.start, null);
  assert.deepEqual(Array.from(draft.weekdays), []);
  assert.equal(draft.personId, "spouse-1");
  assert.equal(quarterly.tod, "anytime");
  assert.equal(quarterly.start, null);
  assert.equal(quarterly.qmonth, null);
  assert.equal(quarterly.dayOfMonth, null);

  const ambiguous = createContext({
    people: [
      { id: "one", relation: "Spouse" },
      { id: "two", relation: "Partner" }
    ]
  }).context;
  assert.equal(ambiguous.window.tendMarriageTemplateDraft("marriage.date-night").personId, "");
});

test("quarterly and yearly template editors require selected calendar patterns instead of guessed dates", () => {
  const context = createRecurrenceContext();
  const quarterly = context.window.personRhythmScheduleHTML({
    id: "draft",
    sourceTemplateId: "marriage.dream-together",
    freq: "quarterly",
    monthlyMode: "onDay",
    qmonth: null,
    dayOfMonth: null,
    tod: "anytime"
  }, "area-marriage|draft");
  const yearly = context.window.personRhythmScheduleHTML({
    id: "draft",
    sourceTemplateId: "marriage.week-away-together",
    freq: "yearly",
    monthlyMode: "onDay",
    month: null,
    monthDay: null,
    tod: "anytime"
  }, "area-marriage|draft");

  assert.match(quarterly, /Choose a month in the quarter/);
  assert.match(quarterly, /Choose a day/);
  assert.doesNotMatch(quarterly, /<option value="1" selected>/);
  assert.match(yearly, /Choose a month/);
  assert.match(yearly, /Choose a day/);
  assert.doesNotMatch(yearly, /<option value="1" selected>/);
});

test("linking an existing rhythm preserves its identity and history; unlink only clears template metadata", () => {
  const rhythm = {
    id: "existing-1",
    text: "Our walk",
    freq: "weekly",
    weekdays: [2],
    areas: ["faith"],
    personal: true
  };
  const completion = { id: "event-1", rhythmId: rhythm.id, ts: 12 };
  const harness = createContext({
    areaRhythms: [],
    people: [{ id: "person-1", relation: "Spouse", rhythms: [rhythm] }],
    events: [completion]
  });
  const { context } = harness;

  assert.equal(context.window.tendMarriageLinkExistingRhythm("marriage.date-night", rhythm.id, true), true);
  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.date-night"], rhythm.id);
  assert.equal(rhythm.sourceTemplateId, "marriage.date-night");
  assert.deepEqual(Array.from(rhythm.areas), ["faith", "marriage"]);
  assert.equal(rhythm.text, "Our walk");
  assert.deepEqual(Array.from(rhythm.weekdays), [2]);
  assert.equal(context.S.events[0], completion);
  rhythm.text = "Walk together";
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.date-night").record.text, "Walk together");
  rhythm.disabled = true;
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.date-night").status, "inactive");
  delete rhythm.disabled;

  assert.equal(context.window.tendMarriageUnlinkTemplate("marriage.date-night"), true);
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.date-night").status, "available");
  assert.equal(Object.hasOwn(rhythm, "sourceTemplateId"), false);
  assert.deepEqual(Array.from(rhythm.areas), ["faith", "marriage"]);
  assert.equal(context.S.events[0], completion);
  assert.equal(harness.saves, 2);
});

test("links retain deleted status until explicitly cleared or replaced", () => {
  const record = { id: "area-1", text: "Conversation", areas: ["marriage"] };
  const { context } = createContext({ areaRhythms: [record], people: [], events: [] });

  assert.equal(context.window.tendMarriageLinkExistingRhythm("marriage.marriage-check-in", record.id, false), true);
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.marriage-check-in").status, "linked");
  context.S.areaRhythms = [];
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.marriage-check-in").status, "deleted");
  assert.equal(context.window.tendMarriageUnlinkTemplate("marriage.marriage-check-in"), true);
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.marriage-check-in").status, "available");
});

test("normalizing account state recovers stable template IDs from existing rhythm records", () => {
  const record = { id: "existing-1", text: "Renamed", sourceTemplateId: "marriage.date-night", areas: ["marriage"] };
  const { context } = createContext({
    areaRhythms: [record],
    people: [],
    events: []
  });

  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.date-night"], "existing-1");
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.date-night").status, "linked");
  assert.equal(context.window.tendMarriageTemplateStatus("marriage.date-night").record.text, "Renamed");
});

test("linked rhythms cannot be linked twice or assigned to another suggestion", () => {
  const record = { id: "area-1", text: "Check-in", areas: ["marriage"] };
  const { context } = createContext({ areaRhythms: [record], people: [], events: [] });

  assert.equal(context.window.tendMarriageLinkExistingRhythm("marriage.marriage-check-in", record.id, false), true);
  assert.equal(context.window.tendMarriageLinkExistingRhythm("marriage.date-night", record.id, false), false);
  assert.equal(context.window.tendMarriageLinkExistingRhythm("marriage.marriage-check-in", record.id, false), false);
});

test("template identity is included in rhythm draft persistence and the catalog is reachable from Marriage", () => {
  assert.match(rhythmSource, /"sourceTemplateId"/);
  assert.match(categorySource, /data-marriage-suggestions-open/);
  assert.match(categorySource, /data-marriage-link-confirm/);
  assert.match(categorySource, /data-marriage-template-unlink/);
  assert.match(categorySource, /data-rfield=.*\|start/);
  assert.doesNotMatch(categorySource, /Amy/);
});

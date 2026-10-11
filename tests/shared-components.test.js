"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-shared-components.js"), "utf8");
const faithSource = fs.readFileSync(path.join(__dirname, "..", "app-faith.js"), "utf8");
const homeRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-views1.js"), "utf8");
const personRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-rhythms2.js"), "utf8");
const categoryRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-categoryrhythms.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "tend.css"), "utf8");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function loadComponents(normalize = record => record) {
  const context = {
    esc: escapeHTML,
    window: { tendNormalizeRhythmEditRecord: normalize }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function fakeForm(fields, checkedWeekdays = []) {
  return {
    querySelector(selector) {
      return fields[selector] || null;
    },
    querySelectorAll(selector) {
      return selector.includes("weekdays") ? checkedWeekdays : [];
    }
  };
}

test("Home, Person, and category rhythm cards share one renderer and card structure", () => {
  const components = loadComponents();
  const record = { id: "shared-walk", text: "<Evening walk>", description: "Talk & reconnect" };
  const card = components.tendRhythmCardHTML(record, {
    score: null,
    scoreClass: "neutral",
    peopleBadgesHTML: '<button class="person-badge">Amy</button>',
    categoryBadgesHTML: '<span class="category-icon">Marriage</span>',
    frequency: { full: "Weekly on Friday", label: "Weekly · Fri", narrow: "Wk · Fri" },
    time: { full: "Evening", label: "Evening", narrow: "PM" },
    lastTended: { full: "Never tended", label: "Never" },
    editAttributes: { "data-rhyedit": "amy|shared-walk" },
    tendAttributes: { "data-tend-open": "person-rhythm", "data-person-id": "amy", "data-rhythm-id": "shared-walk" },
    historyAttributes: { "data-rhyhistory": "amy|shared-walk" }
  });

  assert.match(card, /class="rhythm-card card"/);
  assert.match(card, /&lt;Evening walk&gt;/);
  assert.match(card, /Talk &amp; reconnect/);
  assert.match(card, /class="rhythm-card__edit" data-rhyedit="amy\|shared-walk"/);
  assert.match(card, /class="btn mini rhythm-card__tend" data-tend-open="person-rhythm"/);
  assert.match(card, /class="rhythm-card__score neutral" data-rhyhistory="amy\|shared-walk"/);
  assert.match(card, /<span>—<\/span>/);
  assert.doesNotMatch(card, /0%/);
  assert.match(card, /Amy/);
  assert.match(card, /Marriage/);
  assert.match(card, /Weekly · Fri/);
  assert.match(card, /Evening/);
  assert.match(card, /Never/);
  assert.match(source, /function tendRhythmCardHTML\(/);
  assert.equal((source.match(/<article class="rhythm-card card">/g) || []).length, 1);
  assert.match(homeRhythmSource, /function planRhythmCardHTML\(it\)/);
  assert.match(homeRhythmSource, /return tendRhythmCardHTML\(record,/);
  assert.match(personRhythmSource, /return tendRhythmCardHTML\(r,/);
  assert.match(faithSource, /return tendRhythmCardHTML\(r,/);
  assert.match(categoryRhythmSource, /return tendRhythmCardHTML\(record,/);
  assert.match(categoryRhythmSource, /if\(arguments\.length>2\)options\.additionalPeopleBadgesHTML/);
  assert.doesNotMatch(personRhythmSource, /profile-rhythm-row card/);
  assert.doesNotMatch(faithSource, /faith-rhythm-row/);
  assert.doesNotMatch(categoryRhythmSource, /class="rhyrow"/);
  assert.match(styles, /\.rhythm-card\{/);
  assert.match(styles, /\.rhythm-card__meta[^}]*var\(--tend-type-metadata\)/);
  assert.match(styles, /\.rhythm-card__tend[^}]*var\(--tend-type-button-label\)/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\]\s*\{\s*--tend-type-section-header/);
  assert.match(styles, /\.rhythm-card \.rhythm-card__badges \.prayer-person/);
  assert.match(styles, /\.rhythm-card \.rhythm-card__badges \.rhythm-area-badge/);
  assert.doesNotMatch(styles, /\.person-profile-page \.profile-rhythm-row/);
});

test("shared section and card components escape text and preserve semantic layouts", () => {
  const components = loadComponents();
  const header = components.tendSectionHeaderHTML({
    title: "<People>",
    subtitle: "Subtitle",
    metadata: "Metadata",
    trailingHTML: '<button aria-label="Add">Add</button>'
  });
  assert.match(header, /<h2>&lt;People&gt;<\/h2>/);
  assert.match(header, /Subtitle/);
  assert.match(header, /Metadata/);
  assert.match(header, /aria-label="Add"/);
  const todayWithPerson = components.tendTodayWithPersonHTML({
    personName: "<Jake>",
    waitingCount: 2,
    itemsHTML: '<article class="actrow">Queue item</article>'
  });
  assert.match(todayWithPerson, /Today with &lt;Jake&gt;/);
  assert.match(todayWithPerson, /2 in queue/);
  assert.match(todayWithPerson, /Queue item/);
  assert.doesNotMatch(todayWithPerson, /Nothing waiting/);
  const emptyTodayWithPerson = components.tendTodayWithPersonHTML({
    personName: "Alex",
    waitingCount: 0,
    emptyMessage: "Nothing waiting"
  });
  assert.match(emptyTodayWithPerson, /all tended/);
  assert.match(emptyTodayWithPerson, /Nothing waiting/);

  const rhythm = components.tendRhythmCardContentHTML(
    { text: "<Walk>", description: "A & B" },
    { layout: "profile", meta: "Weekly", showNoDetails: true }
  );
  const spark = components.tendSparkCardContentHTML(
    { text: "Movie", details: "A short break" },
    { layout: "plan", actionHTML: '<button>Tend</button>' }
  );
  const prayer = components.tendPrayerCardContentHTML(
    { text: "Family", details: "Remember them" },
    { meta: "Last prayed today", badges: '<span>Prayer</span>' }
  );
  const missingDetails = components.tendRhythmCardContentHTML(
    { text: "A very long rhythm title that should wrap", description: "" },
    { showNoDetails: true }
  );
  const carePlan = components.tendSparkCardContentHTML(
    { text: "Movie", details: "A short break" },
    { layout: "careplan", meta: "Someday", peopleBadges: '<button class="careplan-person">Alex</button>' }
  );

  assert.match(rhythm, /profile-rhythm-heading/);
  assert.match(rhythm, /&lt;Walk&gt;/);
  assert.match(rhythm, /A &amp; B/);
  assert.match(spark, /plan-item-copy/);
  assert.match(spark, /<button>Tend<\/button>/);
  assert.match(spark, /A short break/);
  assert.match(prayer, /Last prayed today/);
  assert.match(prayer, /<span>Prayer<\/span>/);
  assert.match(missingDetails, /A very long rhythm title that should wrap/);
  assert.match(missingDetails, /No details\.\.\./);
  assert.match(carePlan, /careplan-title/);
  assert.match(carePlan, /tend-type-title/);
  assert.match(carePlan, /careplan-meta tend-type-meta/);
  assert.match(carePlan, /careplan-details tend-type-description/);
  assert.match(carePlan, /Alex/);
});

test("Homepage and Person prayer timeframe dropdowns use the same shared renderer", () => {
  const components = loadComponents();
  const options = [
    { id: "now", label: "Morning", timeDescription: "9:00am – 11:30am", count: 2, isCurrent: true },
    { id: "lunch", label: "<Lunch>", timeDescription: "11:30am – 1:30pm", count: 0 },
    { id: "evening", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 9 }
  ];
  const dashboardState = components.tendPrayerTimeframePickerState("now", options, 2);
  const personState = components.tendPrayerTimeframePickerState("now", options.map(option => ({ ...option, count: option.id === "now" ? 1 : 7 })), 5);
  const dashboard = components.tendPrayerTimeframePickerHTML({
    label: dashboardState.label,
    options: dashboardState.options,
    selectedTimeframeId: dashboardState.selectedTimeframeId,
    allDayCount: dashboardState.allDayCount
  });
  const person = components.tendPrayerTimeframePickerHTML({
    personId: "person-1",
    label: personState.label,
    options: personState.options,
    selectedTimeframeId: personState.selectedTimeframeId,
    allDayCount: personState.allDayCount
  });

  assert.match(dashboard, /data-prayer-time-option="now"/);
  assert.match(person, /data-prayer-time-option="now" data-prayer-time-person="person-1"/);
  assert.match(dashboard, /class="prayer-timeframe-picker__option is-current is-selected"/);
  assert.match(person, /class="prayer-timeframe-picker__option is-current is-selected"/);
  assert.match(dashboard, /&lt;Lunch&gt;/);
  assert.match(person, /Any time today/);
  const layoutOnly = html => html
    .replace(/ data-prayer-time-option="[^"]+"(?: data-prayer-time-person="[^"]+")?/g, "")
    .replace(/<span class="prayer-timeframe-picker__count">.*?<\/span>/g, '<span class="prayer-timeframe-picker__count">COUNT</span>');
  assert.equal(layoutOnly(dashboard), layoutOnly(person));
  assert.equal(dashboardState.selectedCount, 2);
  assert.equal(personState.selectedCount, 1);
  assert.equal(dashboardState.label, "Now");
  assert.equal(personState.label, "Now");
  assert.match(dashboard, /class="prayer-timeframe-picker__option" data-prayer-time-option="allday"/);
  const eveningState = components.tendPrayerTimeframePickerState("evening", options, 2);
  assert.equal(eveningState.label, "Evening");
  assert.equal(eveningState.selectedCount, 9);
  const allDayState = components.tendPrayerTimeframePickerState("allday", options, 4);
  assert.equal(allDayState.label, "All Day");
  assert.equal(allDayState.selectedCount, 4);
  assert.equal((faithSource.match(/tendPrayerTimeframePickerHTML\(/g) || []).length, 2);
  assert.equal((faithSource.match(/if\(b\.matches\("\[data-prayer-time-option\]"\)\)/g) || []).length, 1);
  assert.doesNotMatch(faithSource, /data-(?:person-)?dashboard-prayer-time-option/);
  assert.doesNotMatch(faithSource, /current-plan-time-option|prayer-timeframe-picker__(?:option|label|description|count)/);
  assert.doesNotMatch(styles, /\.dashboard-prayer-people-dialog\s+\.current-plan-time|\.person-dashboard-prayer-dialog\s+\.current-plan-time/);
  assert.match(styles, /\.prayer-timeframe-picker__option\{/);
});

test("Homepage and Person prayer filters use the same shared dialog component", () => {
  const components = loadComponents();
  const sharedLayout = {
    timeframeHTML: components.tendPrayerTimeframePickerHTML({
      label: "Now",
      selectedTimeframeId: "now",
      options: [{ id: "now", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 3 }],
      allDayCount: 4
    }),
    count: 3,
    timeLabel: "Now"
  };
  const dashboard = components.tendPrayerFilterDialogHTML({
    ...sharedLayout,
    title: "People for focused prayer",
    intro: "Choose whose prayer requests to include.",
    selectionHTML: '<div class="dashboard-prayer-people-options">People</div>',
    primaryActionHTML: '<button data-dashboard-prayer-people-pray>Pray</button>',
    closeActionHTML: '<button data-dashboard-prayer-people-close>Done</button>'
  });
  const person = components.tendPrayerFilterDialogHTML({
    ...sharedLayout,
    id: "person-dashboard-prayer-dialog",
    titleId: "person-dashboard-prayer-title",
    title: "Prayer timeframe for Amy",
    closeActionHTML: '<button data-person-dashboard-prayer-close="amy">Done</button>'
  });

  for (const dialog of [dashboard, person]) {
    assert.match(dialog, /class="profile-editor-dialog rhythm-picker-dialog dashboard-prayer-people-dialog/);
    assert.match(dialog, /class="prayer-timeframe-picker"/);
    assert.match(dialog, /Focused Prayer will include <strong>3 prayer requests<\/strong> · Now/);
    assert.match(dialog, /profile-editor-actions dashboard-prayer-people-actions/);
  }
  assert.match(dashboard, /Choose whose prayer requests to include/);
  assert.match(dashboard, /dashboard-prayer-people-options/);
  assert.match(dashboard, /data-dashboard-prayer-people-pray/);
  assert.match(person, /id="person-dashboard-prayer-dialog"/);
  assert.match(person, /Prayer timeframe for Amy/);
  assert.match(person, /data-person-dashboard-prayer-close="amy"/);
  assert.doesNotMatch(person, /dashboard-prayer-people-options/);
  assert.equal((faithSource.match(/tendPrayerFilterDialogHTML\(/g) || []).length, 2);
  assert.doesNotMatch(faithSource, /<dialog class="profile-editor-dialog rhythm-picker-dialog dashboard-prayer-people-dialog/);
});

test("shared Rhythm form validation covers title and enabled end-date requirements", () => {
  const components = loadComponents();
  const profileTitle = { value: "  " };
  const profileEndDateEnabled = { checked: true };
  const profileUntil = { value: "" };
  const profileForm = fakeForm({
    '[data-rfield$="|text"]': profileTitle,
    '[data-rfield$="|endDateEnabled"]': profileEndDateEnabled,
    '[data-rfield$="|until"]': profileUntil
  });

  assert.equal(components.tendValidateRhythmEditForm(profileForm, "profile").message, "title");
  profileTitle.value = "Walk";
  assert.equal(components.tendValidateRhythmEditForm(profileForm, "profile").message, "endDate");
  profileUntil.value = "2026-11-01";
  assert.equal(components.tendValidateRhythmEditForm(profileForm, "profile"), null);

  const carePlanTitle = { value: " Rhythm " };
  const carePlanForm = fakeForm({
    '[data-cpf="title"]': carePlanTitle,
    '[data-cpf="endDateEnabled"]': { checked: true },
    '[data-cpf="until"]': { value: "" }
  });
  assert.equal(components.tendValidateRhythmEditForm(carePlanForm, "careplan").message, "endDate");
});

test("shared Rhythm form conversion preserves identity and assignments in both contexts", () => {
  const normalized = [];
  const components = loadComponents(record => normalized.push(record.id));
  const original = {
    id: "rhythm-1",
    sharedWith: ["person-b", "person-c"],
    areas: ["marriage"],
    customField: "preserved",
    weekdays: [1, 3]
  };
  const fields = {
    '[data-rfield$="|text"]': { value: "  Evening walk  " },
    '[data-rfield$="|description"]': { value: "  Talk together  " },
    '[data-rfield$="|freq"]': { value: "selectdays" },
    '[data-rfield$="|tod"]': { value: "evening" },
    '[data-rfield$="|endDateEnabled"]': { checked: false },
    '[data-rfield$="|until"]': { value: "" }
  };
  const updated = components.tendApplyRhythmEditForm(
    original,
    fakeForm(fields, [{ value: "1" }, { value: "3" }]),
    "profile"
  );

  assert.strictEqual(updated, original);
  assert.equal(updated.text, "Evening walk");
  assert.equal(updated.description, "Talk together");
  assert.equal(updated.freq, "selectdays");
  assert.equal(updated.tod, "evening");
  assert.deepEqual(Array.from(updated.weekdays), [1, 3]);
  assert.deepEqual(Array.from(updated.sharedWith), ["person-b", "person-c"]);
  assert.deepEqual(Array.from(updated.areas), ["marriage"]);
  assert.equal(updated.customField, "preserved");
  assert.equal(updated.until, null);
  assert.deepEqual(normalized, ["rhythm-1"]);

  const carePlan = {
    id: "rhythm-2",
    sharedWith: ["person-a"],
    text: "Old"
  };
  const carePlanFields = {
    '[data-cpf="title"]': { value: "Updated" },
    '[data-cpf="description"]': { value: "Details" },
    '[data-cpf="frequency"]': { value: "weekly" },
    '[data-cpf="tod"]': { value: "morning" },
    '[data-cpf="endDateEnabled"]': { checked: true },
    '[data-cpf="until"]': { value: "2026-12-31" }
  };
  components.tendApplyRhythmEditForm(carePlan, fakeForm(carePlanFields, [{ value: "2" }]), "careplan");
  assert.equal(carePlan.text, "Updated");
  assert.equal(carePlan.until, "2026-12-31");
  assert.deepEqual(Array.from(carePlan.weekdays), [2]);
  assert.deepEqual(Array.from(carePlan.sharedWith), ["person-a"]);
  assert.deepEqual(normalized, ["rhythm-1", "rhythm-2"]);
});

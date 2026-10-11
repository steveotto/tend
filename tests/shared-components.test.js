"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-shared-components.js"), "utf8");
const faithSource = fs.readFileSync(path.join(__dirname, "..", "app-faith.js"), "utf8");
const homeRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-views1.js"), "utf8");
const prayerSource = fs.readFileSync(path.join(__dirname, "..", "app-prayers.js"), "utf8");
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

test("Home and Person Spark cards use one shared renderer and preserve card actions", () => {
  const components = loadComponents();
  const spark = {
    id: "movie-night",
    text: "Movie night",
    details: "Pick a film together",
    by: "2026-10-25",
    time: "19:30"
  };
  const homeCard = components.tendSparkCardHTML(spark, {
    title: spark.text,
    description: spark.details,
    actionHTML: '<button class="btn sparkbtn" data-sparkdo="amy|movie-night|amy">Do it</button>',
    headingEditHTML: '<button class="plan-item-edit-trigger" data-sedit="amy|movie-night" aria-label="Edit Movie night">Edit</button>',
    topMetaHTML: '<div class="plan-item-top-meta"><div class="plan-people-visible">Amy and Leah</div></div>',
    footerHTML: '<span class="dashboard-spark-deadline">Due Oct 25</span>',
    className: "dashboard-free-moment-card",
    cardAttributes: { "data-dashboard-free-spark-card": "" }
  });
  const personCard = components.tendSparkCardHTML(spark, {
    title: spark.text,
    description: spark.details,
    actionHTML: '<button class="btn sparkbtn" data-sparkdo="amy|movie-night|leah">Do it</button>',
    headingEditHTML: '<button class="profile-rhythm-edit-action" data-sedit="amy|movie-night" aria-label="Edit Movie night">Edit</button>',
    topMetaHTML: '<div class="plan-item-top-meta"><button data-personbadge="amy|spark">Amy</button></div>',
    footerHTML: '<span class="spark-card__meta-item">7:30pm</span><span class="dashboard-spark-deadline">Due Oct 25</span>',
    className: "profile-spark-row",
    cardAttributes: { "data-spark-row": "amy|movie-night" }
  });

  for (const card of [homeCard, personCard]) {
    assert.match(card, /^<div class="spark-card planitem /);
    assert.match(card, /class="plan-item-copy"/);
    assert.match(card, /class="spark-card__title-line"[\s\S]*class="spark-card__title-edit"[\s\S]*data-sedit=/);
    assert.match(card, /class="plan-item-top-meta"/);
    assert.match(card, /class="plan-item-footer dashboard-spark-footer/);
    assert.match(card, /Movie night/);
    assert.match(card, /Pick a film together/);
    assert.match(card, /data-sparkdo=/);
    assert.match(card, /Due Oct 25/);
  }
  assert.match(homeCard, /data-dashboard-free-spark-card=""/);
  assert.match(personCard, /data-spark-row="amy\|movie-night"/);
  assert.match(personCard, /data-sedit="amy\|movie-night"/);
  assert.doesNotMatch(personCard.match(/class="plan-item-top-meta"[\s\S]*?<\/div>/)[0], /data-sedit=/);
  assert.equal((source.match(/function tendSparkCardHTML\(/g) || []).length, 1);
  assert.match(homeRhythmSource, /function freeMomentSparkCardHTML\(item,options\)/);
  assert.match(homeRhythmSource, /return tendSparkCardHTML\(item,/);
  assert.match(homeRhythmSource, /headingEditHTML:planItemEditAction\(item\)/);
  assert.match(homeRhythmSource, /topMetaHTML:planItemTopRow\(item,false\)/);
  assert.equal((homeRhythmSource.match(/freeMomentSparkCardHTML\(current,/g) || []).length, 2);
  assert.match(homeRhythmSource, /out\+=tendSparkCardHTML\(s,/);
  assert.match(homeRhythmSource, /headingEditHTML:editAction/);
  assert.doesNotMatch(homeRhythmSource, /<div class="spark-card/);
  assert.doesNotMatch(homeRhythmSource, /class="profile-spark-top"/);
  assert.doesNotMatch(homeRhythmSource, /class="planitem dashboard-free-moment-card"/);
  assert.match(styles, /\.spark-card\{/);
  assert.match(styles, /\.spark-card \.sparkbtn\{border:1px solid/);
  assert.match(styles, /\.spark-card \.spark-card__title-line\{display:block;flex:0 1 auto/);
  assert.match(styles, /\.spark-card \.plan-item-copy \.plan-item-heading \.spark-card__title-line \.tend-type-title\{display:inline/);
  assert.match(styles, /\.spark-card \.plan-people\{display:flex;align-items:center;gap:6px;min-width:0;width:auto\}/);
  assert.match(styles, /\.spark-card \.plan-item-category-row\{display:flex;align-items:center;gap:6px;flex:none;min-width:0;margin-left:0\}/);
  assert.match(styles, /\.home-dashboard \.spark-card \.plan-item-category-row \.rhythm-area-badge\{[\s\S]*?width:20px!important;[\s\S]*?height:20px!important/);
  assert.match(styles, /\.home-dashboard \.spark-card \.plan-item-category-row \.rhythm-area-badge svg\{[\s\S]*?width:12px!important;[\s\S]*?height:12px!important/);
  assert.match(styles, /\.home-dashboard \.current-plan-items>\.rhythm-card\{margin-bottom:14px\}/);
  assert.doesNotMatch(styles, /\.person-profile-page \.profile-spark-row\.card/);
  assert.doesNotMatch(styles, /\.person-profile-page \.person-free-moment-card \.tend-type-title/);
});

test("Person prayer section follows the profile card treatment with a shared-style metadata footer", () => {
  assert.match(homeRhythmSource, /function profilePanelStart\(key\)\{return '<section class=\"'\+\(key===\"prayer\"\?\"\":\"card \"\)\+'profile-tab-panel\"/);
  assert.match(homeRhythmSource, /class=\"profile-panel-toolbar profile-rhythm-toolbar\"[^>]*>.*?class=\"btn mini ghost profile-rhythm-add profile-prayer-add\" data-personprayeropen=/);
  assert.match(prayerSource, /function prayerProfileMetaHTML\(p\)/);
  assert.match(prayerSource, /class=\"rhythm-card__meta profile-prayer-meta\" aria-label=\"Prayer schedule and history\"/);
  assert.match(prayerSource, /planMetaIcon\(\"frequency\"\)[\s\S]*?planMetaIcon\(\"time\"\)[\s\S]*?planMetaIcon\(\"occurred\"\)/);
  assert.match(prayerSource, /rhythm-card__meta-item rhythm-card__last/);
  assert.match(prayerSource, /window\.tendRhythmCardTime\(\{tod:key\}\)/);
  assert.match(prayerSource, /window\.tendRhythmCardLastTended\(last\)/);
  assert.match(personRhythmSource, /window\.tendRhythmCardTime=function\(r\)\{return rhythmCardTime\(r\);\}/);
  assert.match(personRhythmSource, /window\.tendRhythmCardLastTended=function\(last\)\{return rhythmCardLastTended\(last\);\}/);
  assert.doesNotMatch(prayerSource.match(/function prayerProfileMetaHTML\(p\)\{([\s\S]*?)\n\}/)[1], /Prayed .* times|Added /);
  assert.match(prayerSource, /class=\"rhythm-card__edit prayer-edit-trigger\" data-prayeredit=/);
  assert.match(prayerSource, /prayerProfileMetaHTML\(p\)/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row\{[^}]*grid-template-areas:\"content actions\" \"meta meta\"/);
  assert.match(styles, /#profile-panel-prayer \.profile-prayer-add\{border-color:var\(--forest\);background:transparent;color:var\(--forest\)\}/);
});

test("Prayer action dropdown options are unshaded until hovered", () => {
  assert.match(styles, /\.prayer-action-options button\{background:transparent;color:var\(--action-prayer-text,#705A8D\)\}/);
  assert.match(styles, /\.prayer-action-options button:hover[\s\S]*?background:var\(--action-prayer-hover,#E6DCEE\)/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row \.prayer-action-options button\{border:0;background:transparent/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row \.prayer-action-options button:hover,[\s\S]*?background:var\(--action-prayer-hover,#E6DCEE\)/);
  assert.doesNotMatch(styles, /\.prayer-action-options button\{border:1px solid/);
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

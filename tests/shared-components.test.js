"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-shared-components.js"), "utf8");
const faithSource = fs.readFileSync(path.join(__dirname, "..", "app-faith.js"), "utf8");
const focusSource = fs.readFileSync(path.join(__dirname, "..", "app-focus.js"), "utf8");
const peopleSource = fs.readFileSync(path.join(__dirname, "..", "app-people.js"), "utf8");
const homeRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-views1.js"), "utf8");
const actionsSource = fs.readFileSync(path.join(__dirname, "..", "app-actions.js"), "utf8");
const connectionHistorySource = fs.readFileSync(path.join(__dirname, "..", "connection-history.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const prayerSource = fs.readFileSync(path.join(__dirname, "..", "app-prayers.js"), "utf8");
const personRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-rhythms2.js"), "utf8");
const personOverviewSource = fs.readFileSync(path.join(__dirname, "..", "app-rhythms3.js"), "utf8");
const categoryRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-categoryrhythms.js"), "utf8");
const weatherSource = fs.readFileSync(path.join(__dirname, "..", "app-weather.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "tend.css"), "utf8");

test("People cards use one column until cards have room to fit side by side", () => {
  assert.match(peopleSource, /\.pc-grid\{grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,320px\),1fr\)\)\}/);
  assert.match(peopleSource, /out\+='<div class="grid pc-grid">/);
});

test("Person plan cards hide the active person's own people badge", () => {
  const peopleRenderer = homeRhythmSource.match(/function planItemPeople\(it\)\{[\s\S]*?\n\}/)[0];
  const context = {
    currentPerson: "jacob",
    S: { people: [
      { id: "jacob", name: "Jake" },
      { id: "amy", name: "Amy", sparks: [{ id: "s1", sharedWith: ["jacob"] }] }
    ] },
    planItemKind: () => "spark",
    personAvatar: () => "",
    esc: value => String(value),
    it: { spark: "amy|s1|jacob", personId: "jacob" }
  };
  vm.createContext(context);
  const markup = vm.runInContext(`${peopleRenderer}; planItemPeople(it)`, context);
  assert.match(markup, /Amy/);
  assert.doesNotMatch(markup, /Jake|jacob/);
});

test("Person health detail card is a full-area keyboard-accessible navigation target", () => {
  assert.match(personOverviewSource, /class="person-health-detail-link" aria-label="View section"/);
  assert.match(actionsSource, /detailLink\.setAttribute\("data-meter-tab",key\)/);
  assert.match(actionsSource, /detailLink\.removeAttribute\("data-meter-tab"\)/);
  assert.match(personOverviewSource, /<span class="person-health-detail-icon" aria-hidden="true">/);
  assert.match(styles, /\.person-profile-page \.person-health-detail\{position:relative\}/);
  assert.match(styles, /\.person-profile-page \.person-health-detail-link\{position:absolute;z-index:2;inset:0;width:100%;height:100%/);
  assert.match(indexSource, /app-actions\.js\?v=20261012-faith-standalone-prayer-requests/);
  assert.match(styles, /\.today-with-person\{display:grid;gap:12px/);
});

test("Unavailable weather leaves current and forecast weather spaces blank", () => {
  const nowWeatherHTML = weatherSource.match(/function nowWeatherHTML\(\)\{[\s\S]*?\n\}/)[0];
  const planWeatherHTML = weatherSource.match(/function planWeatherHTML\(time\)\{[\s\S]*?\n\}/)[0];
  const context = {
    nowWeather: { status: "error", report: null },
    weatherCardHTML: () => "<span>weather</span>",
    weatherForTime: () => null
  };
  vm.createContext(context);
  assert.equal(vm.runInContext(`${nowWeatherHTML};nowWeatherHTML()`, context), "");
  assert.equal(vm.runInContext(`${planWeatherHTML};planWeatherHTML("12:00")`, context), "");
  assert.doesNotMatch(weatherSource, /Weather unavailable|weatherPromptHTML/);
});

test("Home time views separate Anytime rhythms from stored time blocks", () => {
  const functionNames = [
    "dayTimeMinutes", "validateDayBlocks", "dayBlocks", "dayBlockAt", "planBlockName",
    "dashboardRhythmEligible", "prioritizePlanItems", "planCandidates",
    "planAnytimeCandidates", "planItemKind", "planNowItems", "planItemStableKey",
    "planUniqueItems", "planViewGroups", "planViewItemCount", "planViewCountLabel",
    "blocksViewId", "planNormalizeFocusState", "planNormalizeItemType", "planHomeSelection", "planFocusMenuHTML"
  ];
  const extracted = functionNames.map(name => homeRhythmSource.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^]*?\\n\\}`, "m"))[0]).join("\n");
  const blocks = [
    { id: "early", name: "Early morning", start: "05:30", range: "5:30am – 9:00am" },
    { id: "morning", name: "Midday focus", start: "09:00", range: "9:00am – 11:30am" },
    { id: "lunch", name: "Lunch", start: "11:30", range: "11:30am – 1:30pm" },
    { id: "afternoon", name: "Afternoon", start: "13:30", range: "1:30pm – 4:30pm" },
    { id: "commute", name: "Way home", start: "16:30", range: "4:30pm – 6:00pm" },
    { id: "evening", name: "Evening", start: "18:00", range: "6:00pm – 9:30pm" },
    { id: "bedtime", name: "Bedtime", start: "21:30", range: "9:30pm – 5:30am" }
  ];
  const person = {
    id: "amy",
    rhythms: [
      { id: "early-rhythm", text: "Early", tod: "early", eligible: true },
      { id: "morning-rhythm", text: "Morning", tod: "morning", eligible: true },
      { id: "afternoon-rhythm", text: "Afternoon", tod: "afternoon", eligible: true },
      { id: "anytime-rhythm", text: "Anytime", tod: "anytime", eligible: true },
      { id: "legacy-anytime-rhythm", text: "Flexible", eligible: true },
      { id: "completed-anytime-rhythm", text: "Completed", tod: "anytime", eligible: false },
      { id: "all-day-rhythm", text: "All day", tod: "allday", eligible: true }
    ],
    sparks: [
      { id: "early-spark", text: "Early spark", tod: "early", by: "2026-10-13" },
      { id: "unassigned-spark", text: "Unassigned spark", tod: "anytime", by: "2026-10-13" },
      { id: "all-day-spark", text: "All day spark", tod: "allday", by: "2026-10-13" }
    ]
  };
  const context = {
    DEFAULT_DAY_BLOCKS: blocks.map(({ id, name, start }) => ({ id, name, start })),
    save() {},
    S: {
      tasks: [
        { id: "morning-task", text: "Morning task", tod: "morning", areaId: "home" },
        { id: "all-day-task", text: "All-day task", tod: "allday", areaId: "home" },
        { id: "anytime-task", text: "Anytime task", tod: "anytime", areaId: "home" },
        { id: "legacy-task", text: "Legacy task", areaId: "home" }
      ],
      people: [person],
      areas: { home: { name: "Home" } }
    },
    esc: value => String(value),
    dayBlocks: () => blocks,
    taskItem: task => ({ taskId: task.id, label: task.text, sub: task.areaId }),
    sortedPersonSparks: owner => owner.sparks,
    sparkLive: () => true,
    sparkBlock: spark => spark.tod && spark.tod !== "anytime" ? spark.tod : null,
    sparkDueTxt: () => "due today",
    fmtHM12: () => "",
    rhythmDaysSince: rhythm => rhythm.eligible ? 7 : 0,
    rhythmPeriod: () => 7,
    scheduleDayMatches: () => true,
    tendRhythmMetaLabel: () => "Weekly",
    faithActiveRhythms: () => [
      { id: "faith-lunch", text: "Faith lunch", tod: "lunch", eligible: true },
      { id: "faith-anytime", text: "Faith anytime", tod: "anytime", eligible: true },
      { id: "faith-all-day", text: "Faith all day", tod: "allday", eligible: true },
      { id: "faith-ineligible", text: "Not eligible", tod: "lunch", eligible: false }
    ],
    rhythmScheduledToday: rhythm => rhythm.eligible,
    planItemKind: item => item.rhythm || item.rkey || item.faithRhythm ? "rhythm" : item.spark || item.sparky ? "spark" : item.prayer ? "prayer" : ""
  };
  vm.createContext(context);
  vm.runInContext(`var planFocusState="now",planItemTypeState="scheduled",planHomeSelectionInitialized=false;${extracted};`, context);
  const nowGroups = vm.runInContext('planViewGroups("now", "morning", dayBlocks())', context);
  assert.equal(nowGroups.length, 1);
  assert.equal(nowGroups[0].items.length, 4);
  assert.equal(vm.runInContext('planViewCountLabel("now", planViewGroups("now", "morning", dayBlocks()))', context), "4 items");
  assert.equal(vm.runInContext('planViewCountLabel("now", [{id:"scheduled",items:[{}]}])', context), "1 item");
  assert.equal(vm.runInContext('planViewCountLabel("now", [{id:"scheduled",items:[]}])', context), "No items");

  const afternoonGroups = vm.runInContext('planViewGroups("afternoon", "morning", dayBlocks())', context);
  assert.deepEqual(Array.from(afternoonGroups[0].items, item => item.label), ["Afternoon"]);

  const todayGroups = vm.runInContext('planViewGroups("everything-today", "morning", dayBlocks())', context);
  assert.deepEqual(Array.from(todayGroups, group => group.id), ["early", "morning", "lunch", "afternoon"]);
  const todayItems = todayGroups.flatMap(group => Array.from(group.items, item => item));
  const keys = todayItems.map(item => vm.runInContext(`planItemStableKey(${JSON.stringify(item)})`, context));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(todayGroups.reduce((total, group) => total + group.items.length, 0), todayItems.length);
  assert.deepEqual(
    todayItems.map(item => item.label).filter(label => ["Anytime", "Faith anytime", "All day", "All-day task"].includes(label)),
    []
  );

  const anytimeGroups = vm.runInContext('planViewGroups("now", "morning", dayBlocks(), "anytime")', context);
  assert.deepEqual(Array.from(anytimeGroups[0].items, item => item.label), ["Anytime", "Faith anytime"]);
  const allDayGroups = vm.runInContext('planViewGroups("now", "morning", dayBlocks(), "all-day")', context);
  assert.deepEqual(Array.from(allDayGroups[0].items, item => item.label).sort(), ["All-day task", "All day", "All day spark", "Faith all day"].sort());
  const timeframeMenu = vm.runInContext('planFocusMenuHTML(dayBlocks(), "morning", "now")', context);
  assert.deepEqual(Array.from(timeframeMenu.matchAll(/data-plan-focus="([^"]+)"/g), match => match[1]), [
    "now", "everything-today", "early", "morning", "lunch", "afternoon", "commute", "evening", "bedtime"
  ]);
  assert.match(timeframeMenu, /4 items/);
  const todayCount = vm.runInContext('planViewCountLabel("everything-today", planViewGroups("everything-today", "morning", dayBlocks()))', context);
  assert.ok(timeframeMenu.includes(`Everything today</span><span class="current-plan-time-option-range">Across every time block</span><span class="current-plan-time-option-count">${todayCount}</span>`));
  assert.equal(vm.runInContext('planHomeSelectionInitialized=false;S.homePlanSelection={view:"anytime"};planHomeSelection(dayBlocks()).itemType', context), "anytime");
  assert.equal(vm.runInContext('planHomeSelectionInitialized=false;S.homePlanSelection={view:"anytime"};planHomeSelection(dayBlocks()).timeframe', context), "now");
  assert.equal(vm.runInContext('planHomeSelectionInitialized=false;S.homePlanSelection={view:"allday"};planHomeSelection(dayBlocks()).itemType', context), "all-day");
  assert.equal(vm.runInContext('planHomeSelectionInitialized=false;S.homePlanSelection={view:"all-day-items"};planHomeSelection(dayBlocks()).itemType', context), "all-day");
  assert.equal(vm.runInContext('planHomeSelectionInitialized=false;S.homePlanSelection={view:"everything-today"};planHomeSelection(dayBlocks()).itemType', context), "scheduled");
  assert.equal(vm.runInContext('planHomeSelectionInitialized=false;S.homePlanSelection={timeframe:"evening",itemType:"scheduled"};planHomeSelection(dayBlocks()).timeframe', context), "evening");
  assert.equal(vm.runInContext('planNormalizeFocusState("allday", dayBlocks())', context), "all-day-items");
  assert.equal(vm.runInContext('planNormalizeFocusState("everything-today", dayBlocks())', context), "everything-today");
  assert.equal(vm.runInContext('planNormalizeFocusState("morning", dayBlocks())', context), "morning");
  assert.equal(vm.runInContext('dayBlockAt(new Date(2026, 9, 13, 5, 29))', context), "bedtime");
  assert.equal(vm.runInContext('dayBlockAt(new Date(2026, 9, 13, 5, 30))', context), "early");
  assert.equal(vm.runInContext('dayBlockAt(new Date(2026, 9, 13, 9, 0))', context), "morning");
  assert.equal(vm.runInContext('dayBlockAt(new Date(2026, 9, 13, 23, 59))', context), "bedtime");
  assert.match(homeRhythmSource, /option\("everything-today","Everything today","Across every time block"\)/);
  assert.doesNotMatch(homeRhythmSource.match(/function planFocusMenuHTML[\s\S]*?\n\}/)[0], /Anytime|All-day items|Flexible \/ All-day/);
  assert.match(homeRhythmSource, /\[\["scheduled","Scheduled"\],\["anytime","Anytime"\],\["all-day","All-day"\]\]/);
  assert.match(homeRhythmSource, /function planSaveHomeSelection\(\)\{S\.homePlanSelection=\{timeframe:planFocusState,itemType:planItemTypeState\};save\(\);\}/);
  assert.match(homeRhythmSource, /function planHomeSelection\(blocks\)[\s\S]*legacyView==="anytime"[\s\S]*legacyView==="allday"\|\|legacyView==="all-day-items"/);
  assert.match(homeRhythmSource, /home-plan-context/);
  assert.match(homeRhythmSource, /heading=itemType==="scheduled"\?timeframe:'<h2 class="home-plan-view-heading">'\+esc\(title\)/);
  assert.match(homeRhythmSource, /role="group" aria-label="View"/);
  assert.match(homeRhythmSource, /role="group" aria-label="Specific time"/);
  assert.doesNotMatch(homeRhythmSource, /role="group" aria-label="Flexible \/ All-day"/);
  assert.match(homeRhythmSource, /planFocusState=planNormalizeFocusState\(planFocusState,blocks\)/);
  assert.match(actionsSource, /planFocusState=planNormalizeFocusState\(selected,blocks\);planSaveHomeSelection\(\)/);
  assert.match(actionsSource, /planItemTypeState=itemType;planSaveHomeSelection\(\)/);
  assert.match(actionsSource, /ArrowRight[\s\S]*ArrowLeft[\s\S]*tabs\[next\]\.click\(\)/);
  assert.match(styles, /\.home-dashboard \.current-plan-time-group\+\.current-plan-time-group\{[^}]*border-top:1px solid var\(--line\)/);
  assert.match(styles, /\.home-dashboard \.current-plan-time-option-range,.home-dashboard \.current-plan-time-option-count\{[^}]*white-space:normal;overflow-wrap:anywhere/);
  assert.match(styles, /\.home-dashboard \.current-plan-item-group-items\{display:grid;gap:14px/);
  assert.match(styles, /\.home-dashboard \.home-plan-type-tabs\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)[^}]*gap:5px[^}]*margin:0 auto 14px[^}]*padding:5px[^}]*border:1px solid #D8E1DA[^}]*border-radius:15px[^}]*background:#E7ECE8/);
  assert.match(styles, /\.home-dashboard \.home-plan-type-tabs button\{[^}]*min-height:48px[^}]*border-radius:10px[^}]*color:#526259[^}]*font-size:var\(--tend-type-button-label\)[^}]*font-weight:600/);
  assert.match(styles, /\.home-dashboard \.home-plan-type-tabs button\[aria-selected=true\]\{[^}]*background:var\(--tend-forest,#246B52\)[^}]*color:#fff/);
  assert.match(styles, /\.home-dashboard \.home-plan-type-tabs button:focus-visible\{[^}]*outline:2px solid var\(--tend-forest,#246B52\)/);
  assert.match(styles, /\.home-dashboard \.home-plan-view-heading\{display:flex;align-items:center;box-sizing:border-box;min-width:0;min-height:44px/);
  assert.match(homeRhythmSource, /home-plan-context-row[\s\S]*class="home-plan-context"[\s\S]*current-plan-item-count/);
  assert.match(styles, /\.home-dashboard \.home-plan-context-row\{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0;margin:0 0 14px\}/);
  assert.match(styles, /\.home-dashboard \.planblock \.current-plan-time-picker\{[^}]*min-width:max-content[^}]*white-space:nowrap/);
  assert.match(styles, /\.home-dashboard \.home-plan-context\{[^}]*margin:0 0 14px/);
  assert.doesNotMatch(styles, /@media\(max-width:360px\)\{\.home-dashboard \.current-plan-time-option[\s\S]*?font-size:10px/);
  assert.match(source, /data-prayer-time-option/);
});

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
  const todayCard = components.tendRhythmCardHTML(record, {
    showScore: false,
    frequency: { full: "Weekly on Friday", label: "Weekly · Fri", narrow: "Wk · Fri" },
    time: { full: "Evening", label: "Evening", narrow: "PM" },
    lastTended: { full: "Never tended", label: "Never" },
    tendAttributes: { "data-tend-open": "person-rhythm", "data-person-id": "amy", "data-rhythm-id": "shared-walk" }
  });
  assert.match(todayCard, /class="rhythm-card card"/);
  assert.match(todayCard, /class="btn mini rhythm-card__tend" data-tend-open="person-rhythm"/);
  assert.doesNotMatch(todayCard, /rhythm-card__edit|rhythm-card__score/);
  assert.match(source, /function tendRhythmCardHTML\(/);
  assert.match(source, /var chartAction=options\.showScore===false\?"":/);
  assert.equal((source.match(/<article class="rhythm-card card">/g) || []).length, 1);
  assert.match(homeRhythmSource, /function planRhythmCardHTML\(it\)/);
  assert.match(homeRhythmSource, /return tendRhythmCardHTML\(record,/);
  const todayRhythmSource = homeRhythmSource.match(/function rhyRowQ\(r,dim\)\{[\s\S]*?\n \}/)[0];
  assert.match(todayRhythmSource, /var metadata=window\.tendRhythmCardMetadata\(r\),badges=tendQueuePeopleAndCategoryBadges\(r,p\.id,p\.id,"rhythm"\)/);
  assert.match(todayRhythmSource, /return tendRhythmCardHTML\(r,\{/);
  assert.match(todayRhythmSource, /peopleBadgesHTML:badges/);
  assert.match(todayRhythmSource, /showScore:false/);
  assert.match(personRhythmSource, /return tendRhythmCardHTML\(r,/);
  assert.match(personRhythmSource, /var metadata=window\.tendRhythmCardMetadata\(r\),frequency=Object\.assign\(\{\},metadata\.frequency\)/);
  assert.match(personRhythmSource, /if\(cardOptions\.frequencyLabel\)\{frequency\.label=cardOptions\.frequencyLabel;frequency\.narrow=cardOptions\.frequencyLabel;\}/);
  assert.match(personRhythmSource, /frequency:frequency,time:metadata\.time/);
  assert.match(homeRhythmSource, /out\+=rhythmRow\(p,r,\{frequencyLabel:r\.freq==="yearly"\?"Yearly":""\}\)/);
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
  assert.match(homeRhythmSource, /profile-spark-completion-note">Completed Sparks show under Connections\.<\/p>/);
  assert.doesNotMatch(homeRhythmSource, /<div class="spark-card/);
  assert.doesNotMatch(homeRhythmSource, /class="profile-spark-top"/);
  assert.doesNotMatch(homeRhythmSource, /class="planitem dashboard-free-moment-card"/);
  assert.match(styles, /\.spark-card\{/);
  assert.match(styles, /\.spark-card \.sparkbtn\{border:1px solid/);
  assert.match(styles, /\.spark-card \.spark-card__title-line\{display:block;flex:0 1 auto/);
  assert.match(styles, /\.spark-card \.plan-item-copy \.plan-item-heading \.spark-card__title-line \.tend-type-title\{display:inline/);
  assert.match(styles, /\.spark-card \.plan-item-heading>\.plan-item-action\{grid-column:2;grid-row:1;align-self:start;height:max-content\}/);
  assert.match(styles, /\.spark-card \.plan-item-heading>\.plan-item-action>\.btn\{align-self:flex-start;height:auto\}/);
  assert.match(styles, /\.spark-card \.plan-people\{display:flex;align-items:center;gap:6px;min-width:0;width:auto\}/);
  assert.match(styles, /\.spark-card \.plan-item-category-row\{display:flex;align-items:center;gap:6px;flex:none;min-width:0;margin-left:0\}/);
  assert.match(styles, /\.home-dashboard \.spark-card \.plan-item-category-row \.rhythm-area-badge\{[\s\S]*?width:20px!important;[\s\S]*?height:20px!important/);
  assert.match(styles, /\.home-dashboard \.spark-card \.plan-item-category-row \.rhythm-area-badge svg\{[\s\S]*?width:12px!important;[\s\S]*?height:12px!important/);
  assert.match(styles, /\.home-dashboard \.current-plan-items>\.rhythm-card\{margin-bottom:14px\}/);
  assert.doesNotMatch(styles, /\.person-profile-page \.profile-spark-row\.card/);
  assert.match(styles, /\.person-profile-page \.profile-spark-completion-note\{margin:12px 0 0;color:var\(--ink-faint\);font-size:12px;line-height:1\.4;text-align:center\}/);
  assert.doesNotMatch(styles, /\.person-profile-page \.person-free-moment-card \.tend-type-title/);
});

test("Person prayer section follows the profile card treatment with a shared-style metadata footer", () => {
  assert.match(prayerSource, /window\.renderPrayer=function\(\)\{var out=tendPrayerSectionHTML\("Prayer","",\{subtitle:"carry these people before God"\}\)/);
  assert.match(homeRhythmSource, /tendPrayerSectionHTML\("Pray for "\+p\.name/);
  assert.match(homeRhythmSource, /function profilePanelStart\(key\)\{return '<section class=\"'\+\(key===\"prayer\"\?\"\":\"card \"\)\+'profile-tab-panel\"/);
  assert.match(homeRhythmSource, /class=\"profile-panel-toolbar profile-rhythm-toolbar\"[^>]*>.*?class=\"btn mini ghost profile-rhythm-add profile-prayer-add\" data-personprayeropen=/);
  assert.match(prayerSource, /function prayerProfileMetaHTML\(p,includeCounts\)/);
  assert.match(prayerSource, /class=\"rhythm-card__meta profile-prayer-meta\" aria-label=\"Prayer schedule and history\"/);
  assert.match(prayerSource, /planMetaIcon\(\"frequency\"\)[\s\S]*?planMetaIcon\(\"time\"\)[\s\S]*?planMetaIcon\(\"occurred\"\)/);
  assert.match(prayerSource, /rhythm-card__meta-item rhythm-card__last/);
  assert.match(prayerSource, /window\.tendRhythmCardTime\(\{tod:key\}\)/);
  assert.match(prayerSource, /window\.tendRhythmCardLastTended\(last\)/);
  assert.match(personRhythmSource, /window\.tendRhythmCardTime=function\(r\)\{return rhythmCardTime\(r\);\}/);
  assert.match(personRhythmSource, /window\.tendRhythmCardLastTended=function\(last\)\{return rhythmCardLastTended\(last\);\}/);
  assert.match(prayerSource.match(/function prayerProfileMetaHTML\(p,includeCounts\)\{([\s\S]*?)\n\}/)[1], /includeCounts\?/);
  assert.match(prayerSource, /prayerProfileMetaHTML\(p\)/);
  assert.match(prayerSource, /prayerProfileMetaHTML\(p,true\)/);
  assert.match(prayerSource, /faith-profile-prayer-row/);
  assert.match(faithSource, /prayerItemHTML\(p,"faith",\{hidePrayerBadge:hidePrayerBadge\}\)/);
  assert.match(prayerSource, /hidePrayerBadge=!!\(options&&options\.hidePrayerBadge\)/);
  assert.match(prayerSource, /!profile\|\|faith&&!hidePrayerBadge/);
  assert.match(styles, /\.faith-prayer-hub \.faith-prayer-row \.faith-profile-prayer-row\{[^}]*grid-template-areas:"content actions" "meta meta"/);
  assert.match(prayerSource, /class=\"rhythm-card__edit prayer-edit-trigger\" data-prayeredit=/);
  assert.match(prayerSource, /class=\"prayer-history-section profile-prayer-history\"><div class=\"prayer-history-links\">/);
  assert.match(prayerSource, /class=\"btn mini ghost profile-rhythm-add\" data-prayer-past-view=/);
  assert.match(prayerSource, />Answered \('\+answered\.length\+'\)/);
  assert.match(prayerSource, />Archived \('\+archived\.length\+'\)/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer \.profile-prayer-history\{margin-top:16px;padding-top:0;border-top:0\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer \.profile-prayer-history \.prayer-history-links\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:center;justify-items:center;gap:12px\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer \.profile-prayer-history \.profile-rhythm-add\{margin:0\}/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row\{[^}]*grid-template-areas:\"content actions\" \"meta meta\"/);
  assert.match(styles, /#profile-panel-prayer \.profile-prayer-add\{border-color:var\(--forest\);background:transparent;color:var\(--forest\)\}/);
  assert.match(prayerSource, /profile\?'<div class="profile-empty-state">No active prayer requests<\/div>'/);
  assert.match(prayerSource, /if\(profile\)out='<div class="profile-prayer-list">'\+out\+'<\/div>'/);
});

test("Person Notes section uses the shared toolbar and card-row treatment", () => {
  assert.match(homeRhythmSource, /profilePanelStart\("notes"\)\+'<div class="profile-panel-toolbar profile-rhythm-toolbar"/);
  assert.match(homeRhythmSource, /Thoughts, encouragement, and follow-ups to remember\./);
  assert.match(homeRhythmSource, /class="btn mini ghost profile-rhythm-add" data-profilenoteopen=/);
  assert.match(homeRhythmSource, /<span>Add note<\/span>/);
  assert.match(homeRhythmSource, /function tendNoteCardHTML\(note,person,options\)/);
  assert.match(homeRhythmSource, /var edit='<button type="button" class="iconbtn person-note-edit" data-fuedit=/);
  assert.match(homeRhythmSource, /class="person-note-title-line"><strong class="tend-type-title">'\+esc\(profileNoteTitleText\(note\)\)\+'<\/strong>&nbsp;'\+edit/);
  assert.match(homeRhythmSource, /class="btn mini '\+\(completed\?"ghost":"note-done"\)[\s\S]*?class="person-note-associations"/);
  assert.match(homeRhythmSource, /class="person-note-footer"><span class="person-note-type-column"/);
  assert.match(homeRhythmSource, /class="person-note-meta tend-type-meta">'\+planMetaIcon\("occurred"\)/);
  assert.match(homeRhythmSource, /var stamp=f\.createdAt\|\|f\.ts\?when\(f\.createdAt\|\|f\.ts\):f\.due\?"Due "\+f\.due:""/);
  assert.match(homeRhythmSource, /class="btn mini ghost profile-rhythm-add person-note-history-button" data-note-history="'\+esc\(p\.id\)\+'">Completed \('\+done\.length\+'\)/);
  assert.match(homeRhythmSource, /'<div class="profile-empty-state">No notes yet<\/div>'/);
  assert.doesNotMatch(homeRhythmSource, /"Added "\+when\(f\.createdAt/);
  assert.doesNotMatch(homeRhythmSource.match(/function tendNoteCardHTML\([\s\S]*?\n\}/)[0], /data-fudel=/);
  assert.match(styles, /#profile-panel-notes\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /#profile-panel-notes \.person-note-heading\{display:flex;align-items:flex-start;justify-content:space-between/);
  assert.match(styles, /#profile-panel-notes \.person-note-title-line\{display:block/);
  assert.match(styles, /#profile-panel-notes \.person-note-associations\{display:flex;flex-wrap:wrap/);
  assert.match(styles, /#profile-panel-notes \.person-note-row\{[^}]*border:1px solid var\(--line\)[^}]*border-radius:16px/);
  assert.match(styles, /#profile-panel-notes \.person-note-footer\{[^}]*border-top:1px solid var\(--line\)/);
  assert.match(styles, /#profile-panel-notes \.person-note-footer\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(styles, /\.person-profile-page #profile-panel-notes \.person-note-history-button\{display:flex;width:max-content;margin:16px auto 4px\}/);
});

test("Faith Notes are consolidated, scoped, deduplicated, and reuse shared note components", () => {
  const selector = faithSource.match(/function faithNoteRecords\(\)\{[\s\S]*?\n\}/)[0];
  const associationValues = homeRhythmSource.match(/function tendAssociationValues\(type,ownerId,itemId,record\)\{[\s\S]*?\n\}/)[0];
  const associationCommit = homeRhythmSource.match(/function tendAssociationCommit\(type,ownerId,itemId,record\)\{[\s\S]*?\n\}/)[0];
  const doneHandler = actionsSource.match(/if\(b=t\.closest\("button\[data-fudone\]"\)\)\{[\s\S]*?return;\}/)[0];
  const context = {
    FAITH_GROUPS: ["Sabbath", "Prayer", "Fasting", "Solitude", "Generosity", "Community", "Service", "Witness", "Scripture", "Other"],
    tendItemAssociationDrafts: {
      "followup|faith|n1": { areas: ["faith"], faithGroup: null },
      "followup|faith|new": { sharedWith: [], areas: ["faith"], faithGroup: null }
    },
    tendAssociationKey: (type, ownerId, itemId) => `${type}|${ownerId}|${itemId}`,
    tendFollowupHasFaith: () => true,
    todayStr: () => "2026-10-12",
    save: () => {},
    render: () => {},
    S: { people: [{ id: "amy" }], followups: [
      { id: "f1", kind: "faith-note", faithSection: "Sabbath" },
      { id: "f1", kind: "general", areas: ["faith"], faithSection: "Prayer" },
      { id: "f2", kind: "general", areas: ["faith"] },
      { id: "f3", kind: "followup", faithGroup: "Prayer" },
      { id: "f4", kind: "faith-note", done: true },
      { id: "p1", kind: "general", personId: "amy", areas: ["parenting"] },
      { id: "p2", kind: "general", personId: "amy" }
    ] }
  };
  vm.createContext(context);
  assert.deepEqual(Array.from(vm.runInContext(`${selector}; faithNoteRecords().map(note => note.id)`, context)), ["f1", "f2", "f3", "f4"]);
  assert.equal(vm.runInContext(`${associationValues}; tendAssociationValues("followup", "faith", "n1", { faithSection: "Sabbath" }).faithGroup`, context), null);
  context.t = { closest: () => ({ getAttribute: () => "f1" }) };
  assert.equal(vm.runInContext(`function toggleNote(){${doneHandler}}; toggleNote(); S.followups[0].done`, context), true);
  assert.equal(vm.runInContext(`S.followups[0].completedDate`, context), "2026-10-12");
  assert.equal(vm.runInContext(`faithNoteRecords().filter(note => note.done).some(note => note.id === "f1")`, context), true);
  assert.equal(vm.runInContext(`toggleNote(); S.followups[0].done`, context), false);
  assert.equal(vm.runInContext(`S.followups[0].completedDate`, context), null);
  const addedFaithNote = { id: "new", kind: "faith-note", personId: null, areas: ["faith"] };
  context.S.followups.push(addedFaithNote);
  vm.runInContext(`${associationCommit}; tendAssociationCommit("followup", "faith", "new", S.followups[S.followups.length - 1])`, context);
  assert.equal(addedFaithNote.personId, null);
  assert.deepEqual(Array.from(addedFaithNote.areas), ["faith"]);
  assert.equal(addedFaithNote.faithSection, undefined);
  context.tendItemAssociationDrafts["followup|faith|f1"] = { sharedWith: ["amy"], areas: ["faith", "parenting"], faithGroup: "Prayer" };
  vm.runInContext(`tendAssociationCommit("followup", "faith", "f1", S.followups[0])`, context);
  assert.deepEqual(Array.from(context.S.followups[0].sharedWith), ["amy"]);
  assert.deepEqual(Array.from(context.S.followups[0].areas), ["faith", "parenting"]);
  assert.equal(context.S.followups[0].faithSection, "Prayer");
  assert.match(faithSource, /var tabs=\["rhythms","sparks"\]/);
  assert.match(faithSource, /tab==="notes"\|\|tab==="prayer"\)return "rhythms"/);
  assert.doesNotMatch(faithSource, /faithNoteRowHTML|faith-note-(?:edit|save|done|reopen|delete)/);
  assert.match(faithSource, /visible=showAll\?active:active\.slice\(0,3\)/);
  assert.match(faithSource, /View all notes \("\+active\.length\+"\)/);
  assert.match(faithSource, /data-note-history="faith"/);
  assert.match(faithSource, /faith-settings-notes[\s\S]*faithNotesHTML\(\)/);
  assert.doesNotMatch(faithSource, /faithViewPanelHTML\("notes"/);
  assert.match(faithSource, /tendNoteCardHTML\(note,context/);
  assert.match(faithSource, /tendNoteEditorHTML\(note,"faith"\)/);
  assert.match(faithSource, /tendNoteAddEditorHTML\("faith"/);
  assert.match(homeRhythmSource.match(/function tendNoteAddEditorHTML\(ownerId,draft\)\{([\s\S]*?)\n\}/)[1], /data-profile-editor="note"'\+\(isFaith\?' data-editor-modal':''\)/);
  assert.match(styles, /\.faith-notes-toolbar \.profile-rhythm-add\{display:inline-flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;white-space:nowrap\}/);
  assert.match(styles, /\.faith-notes-toolbar \.profile-rhythm-add \.profile-action-icon\{flex:none\}/);
  assert.match(homeRhythmSource, /return tendNoteCardHTML\(f,p,/);
  assert.match(homeRhythmSource, /out\+=tendNoteAddEditorHTML\(pid,noteDraft\)/);
  assert.match(homeRhythmSource, /function openNoteHistory\(scopeId\)/);
  assert.match(homeRhythmSource, /tendNoteCardHTML\(note,context,\{completed:true/);
  assert.match(actionsSource, /isFaithNote\?"faith-note"/);
  assert.match(actionsSource, /areas:noteDraftOpenFor==="faith"\?\["faith"\]:\[\]/);
  assert.match(styles, /\.faith-notes-section \.person-note-row\{[^}]*border:1px solid var\(--line\)[^}]*border-radius:16px/);
  assert.match(styles, /\.faith-notes-expand\{display:flex;width:max-content;max-width:100%;margin:16px auto 4px\}/);
});

test("Faith Prayer requests use shared selection for cards, counts, and sessions", () => {
  const practiceContent = faithSource.match(/function faithPracticeContent\(group\)\{([\s\S]*?)\n\}/)[1];
  const requestSection = faithSource.match(/function faithPrayerRequestsHTML\(\)\{([\s\S]*?)\n\}/)[1];
  const focusedPrayerModule = faithSource.match(/function faithFocusedPrayerButtonHTML\(view\)\{([\s\S]*?)\n\}/)[1];
  const sessionSort = faithSource.match(/function faithPrayerSessionSort\(view\)\{([\s\S]*?)\n\}/)[0];
  const settingsHTML = faithSource.match(/function faithSettingsHTML\(\)\{([\s\S]*?)\n\}/)[1];

  assert.match(practiceContent, /var tabs=\["rhythms","sparks"\]/);
  assert.doesNotMatch(practiceContent, /faithPrayerHub|faithPrayerTodayHTML|faithPrayerAllHTML/);
  assert.match(requestSection, /faithViewHeaderHTML\("Prayer","","","faithPrayerTitle"/);
  assert.match(requestSection, /faithViewHeaderHTML\("Prayer requests","People and needs to bring before God\."/);
  assert.match(requestSection, /faithFocusedPrayerButtonHTML\(\)/);
  assert.match(requestSection, /faithPrayerRequestContentHTML\(items\)[\s\S]*faithPrayerHistoryHTML\(true\)/);
  assert.match(faithSource, /function faithPrayerRequestContentHTML\(items\)\{[\s\S]*faithPrayerSelectionMode\("faith-requests"\)==="allrequests"[\s\S]*faithPrayerTodayHTML\(visible,true\)/);
  assert.match(faithSource, /function faithPrayerRows\(items,hidePrayerBadge\)\{[\s\S]*prayerItemHTML\(p,"faith",\{hidePrayerBadge:hidePrayerBadge\}\)/);
  assert.match(faithSource, /faithPrayerRows\(closed,hidePrayerBadge\)/);
  assert.match(requestSection, /faithViewHeaderHTML\("Prayer","","","faithPrayerTitle"[\s\S]*faithFocusedPrayerButtonHTML\(\)[\s\S]*faithViewHeaderHTML\("Prayer requests","People and needs to bring before God\."/);
  assert.match(requestSection, /faithPrayerTitle[\s\S]*faith-prayer-entry-section[\s\S]*faithFocusedPrayerButtonHTML\(\)[\s\S]*faith-prayer-list-section[\s\S]*faithPrayerRequestsTitle[\s\S]*faith-prayer-hub[\s\S]*addToolbar[\s\S]*faith-prayer-content[\s\S]*faithPrayerHistoryHTML\(true\)/);
  assert.equal((requestSection.match(/faithViewHeaderHTML\("Prayer"/g) || []).length, 1);
  assert.equal((requestSection.match(/faithViewHeaderHTML\("Prayer requests"/g) || []).length, 1);
  assert.doesNotMatch(requestSection, /faithPrayerRequestHealthHTML/);
  assert.match(faithSource, /function faithPrayerRequestHealthHTML\(\)/);
  assert.doesNotMatch(requestSection, /faith-prayer-filters|Timeframe:|faithPrayerPeopleFilterHTML|faith-prayer-matching-count|faith-prayer-actions/);
  assert.doesNotMatch(faithSource, /faithPrayerPeopleFilterHTML|faithPrayerFilterRender|data-faith-prayer-filter-action|data-faith-prayer-view/);
  assert.match(requestSection, /data-faith-prayer-add/);
  assert.match(focusedPrayerModule, /window\.faithPrayerEntryHTML\("faith-requests"\)/);
  assert.doesNotMatch(faithSource, /data-faith-session-start|faithDashboardPrayerPeopleDialogHTML/);
  assert.match(faithSource, /function faithPrayerSelectionIds\(context,mode,selectedPeople,groups\)/);
  assert.match(faithSource, /function faithPrayerSessionBegin\(context,draft\)[\s\S]*if\(!ids\.length\)return false/);
  assert.match(faithSource, /snapshot:snapshot,index:0/);
  assert.match(faithSource, /faithPrayerSessionSort\(view\)[\s\S]*faithPrayerViewRecords\(view\)/);
  assert.match(faithSource, /function faithPrayerViewRecords\(\)\{[\s\S]*faithPrayerSelectionMode\("faith-requests"\)[\s\S]*faithPrayerSelectionIds\("faith-requests",mode,selection\.selected,selection\.groups\)/);
  assert.match(faithSource, /return view==="today"\?"today":"all"/);
  assert.match(faithSource, /if\(context==="faith-requests"\)return faithRequestPrayerTimeMode\|\|\(faithSelectedPrayerView\(\)==="today"\?"allday":"allrequests"\)/);
  assert.match(faithSource, /timeframe:context==="faith-requests"&&mode==="allrequests"\?"All":faithPrayerSelectionLabel\(mode\)/);
  assert.match(faithSource, /dashboardPrayerTimeMode="now"/);
  assert.match(faithSource, /Prayer health '\+\(score===null\?"unavailable":score\+" percent"\)\+'\, '\+count\+' active prayer/);
  assert.match(faithSource, /var visible=faithPrayerExpanded\?items:items\.slice\(0,3\)/);
  assert.match(faithSource, /View all prayers \("\+items\.length\+"\)/);
  assert.match(faithSource, /faithPrayerSession\.prayedIds\.indexOf\(prayer\.id\)<0/);
  assert.match(faithSource, /Only Prayed records a prayer\./);
  assert.match(faithSource, /Request '\+\(faithPrayerSession\.index\+1\)\+' of '\+ids\.length/);
  assert.match(faithSource, /faithViewPanelHTML\("prayer",faithPrayerRequestsHTML\(\)\)[\s\S]*faithViewPanelHTML\("practices",faithPracticeOverviewHTML\(selected\)\+\(faithShowAllRhythms\?faithAllRhythmsHTML\(\):faithPracticeContent\(selected\)\)\)/);
  assert.match(faithSource, /function faithPrayerAllMatches\(p\)\{[\s\S]*?faithPrayerPeopleMatch\(p,selectedPeople,groups\)/);
  assert.doesNotMatch(faithSource.match(/function faithPrayerAllMatches\(p\)\{([\s\S]*?)\n\}/)[1], /faithSelectedGroup/);
  assert.match(faithSource, /function faithPracticeHealthParts\(\)\{[\s\S]*?avg\(faithActivePrayers\(\)\.map\(function\(p\)\{return prayerScore\(p\);\}\)\)/);
  assert.match(faithSource, /var FAITH_MAIN_VIEWS=\["today","prayer","practices"\]/);
  assert.match(faithSource, /faithMainView="today",faithMainViewInitialized=false/);
  assert.match(faithSource, /legacyTab==="prayer"\|\|legacyTab==="requests"\?"prayer":legacyTab==="practices"\?"practices":"today"/);
  assert.match(faithSource, /faithSetMainView\(FAITH_MAIN_VIEWS\[nextViewIndex\],true\)/);
  assert.match(faithSource, /function faithViewPanelHTML\(view,content\)[\s\S]*?data-faith-view-panel/);
  assert.match(faithSource, /function faithPracticeOverviewHTML\(selected\)[\s\S]*faithSectionNavHTML\(selected\)/);
  assert.match(faithSource, /faithPracticeOverviewHTML\(selected\)/);
  assert.match(faithSource, /faithViewPanelHTML\("today",faithTodayHTML\(\)\)/);
  assert.match(faithSource, /faithSetMainView\("prayer",false\)/);
  assert.match(settingsHTML, /FAITH_GROUPS\.map/);
  assert.doesNotMatch(settingsHTML, /Prayer requests/);
  assert.match(styles, /\.faith-prayer-expand\{display:flex;align-items:center;justify-content:center;width:max-content/);
  assert.match(styles, /\.faith-prayer-hub\{height:auto;min-height:0;padding:0\}/);
  assert.match(styles, /\.faith-prayer-content,.faith-prayer-row,.faith-prayer-hub \.faith-profile-prayer-row\{box-sizing:border-box;width:100%;min-width:0\}/);
  assert.match(styles, /\.faith-prayer-requests\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:2rem;min-width:0/);
  assert.match(styles, /\.faith-prayer-entry-section,.faith-prayer-list-section\{display:grid;gap:\.875rem;min-width:0\}/);
  assert.match(styles, /\.faith-prayer-list-section\{gap:\.75rem\}/);
  assert.match(styles, /\.faith-prayer-hub\{display:grid;gap:\.75rem;min-width:0\}/);
  assert.match(styles, /\.faith-prayer-add-toolbar\{display:flex;justify-content:flex-end/);
  assert.match(styles, /\.faith-view-nav\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.faith-prayer-request-health-meter\{display:block;height:6px/);
  assert.doesNotMatch(requestSection, /faith-request-focused-prayer|tendFocusedPrayerSectionHTML/);
});

test("Completed Note history reuses NoteCard with completion metadata and a scrollable list", () => {
  assert.match(homeRhythmSource, /tendNoteCardHTML\(note,context,\{completed:true,metadata:note\.completedDate\?"Completed "\+when\(note\.completedDate\):"",actionLabel:"Reopen"\}\)/);
  assert.match(homeRhythmSource, /class="note-history-header"/);
  assert.match(homeRhythmSource, /notes\.map\(function\(note\)\{return tendNoteCardHTML\(note,context,/);
  assert.match(homeRhythmSource, /data-fudone="'\+esc\(note\.id\)\+'/);
  assert.match(homeRhythmSource, /data-fuedit="'\+esc\(note\.id\)\+'/);
  assert.match(styles, /\.note-history-dialog\{display:flex;flex-direction:column;[^}]*overflow:hidden/);
  assert.match(styles, /\.rhythm-history-dialog\.note-history-dialog\{display:flex;flex-direction:column;overflow:hidden;padding:0\}/);
  assert.match(styles, /\.note-history-header\{flex:none/);
  assert.match(styles, /\.note-history-modal-list\{display:flex;flex:1 1 auto;flex-direction:column;gap:12px;min-height:0;max-height:none;overflow-y:auto/);
  assert.match(styles, /\.note-history-modal-list>\.person-note-row\{[^}]*display:flex;flex:none;flex-direction:column/);
  assert.match(styles, /\.note-history-modal-list \.person-note-title-line \.tend-type-title\{[^}]*overflow-wrap:anywhere;white-space:normal/);
  assert.match(styles, /\.note-history-modal-list \.person-note-footer\{display:flex;align-items:center;justify-content:space-between/);
});

test("Person profile panels fit their content and keep the clicked control in place", () => {
  assert.match(homeRhythmSource, /function sizeProfileTabPanels\(root\)\{[\s\S]*?panel\.style\.minHeight="";panel\.style\.marginBottom="";[\s\S]*?\}/);
  assert.doesNotMatch(homeRhythmSource.match(/function sizeProfileTabPanels\(root\)\{([\s\S]*?)\n\}/)[1], /maxHeight|offsetHeight|marginBottom=spare/);
  assert.match(homeRhythmSource, /function tendCaptureProfileScrollAnchor\(target\)/);
  assert.match(homeRhythmSource, /function tendRestoreProfileScrollAnchor\(anchor\)/);
  assert.match(homeRhythmSource, /window\.scrollBy\(0,target\.getBoundingClientRect\(\)\.top-anchor\.top\)/);
  assert.match(homeRhythmSource, /else window\.scrollTo\(anchor\.position\.x,anchor\.position\.y\)/);
  assert.match(actionsSource, /else if\(profileAnchor\)\{requestAnimationFrame\(function\(\)\{requestAnimationFrame\(function\(\)\{tendRestoreProfileScrollAnchor\(profileAnchor\)/);
});

test("Person management tabs prioritize health categories with mobile item and score rows", () => {
  assert.match(homeRhythmSource, /\[\["rhythms","Rhythms"\],\["sparks","Sparks"\],\["prayer","Prayer"\],\["connection","Connections"\],\["notes","Notes"\]\]/);
  assert.match(homeRhythmSource, /var tabHealth=\{rhythms:avg\(sortedPersonRhythms\(p\)\.map\(rhythmScore\)\),connection:connectionScore\(p\),prayer:prayerMeterScore\(p\)\}/);
  assert.match(homeRhythmSource, /class="profile-tab-mobile-details"><span class="profile-tab-item-count" aria-label="'\+counts\[item\[0\]\]\+' items"/);
  assert.ok(homeRhythmSource.includes('class="profile-tab-health-score \'+healthTone+\'">\'+healthText'));
  assert.match(styles, /grid-template-areas:"rhythms rhythms connection connection prayer prayer" "sparks sparks sparks notes notes notes"/);
  assert.match(styles, /\.person-profile-page \.profile-tabs button\[data-profiletab="rhythms"\],\s*\.person-profile-page \.profile-tabs button\[data-profiletab="connection"\],\s*\.person-profile-page \.profile-tabs button\[data-profiletab="prayer"\]\{display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:1fr 1fr;justify-items:stretch;min-height:96px/);
  assert.match(styles, /\.person-profile-page \.profile-tabs \.profile-tab-health-score\.green\{color:#12B76A\}/);
  assert.match(styles, /\.person-profile-page \.profile-tabs \.profile-tab-health-score\.yellow\{color:#F08C00\}/);
  assert.match(styles, /\.person-profile-page \.profile-tabs \.profile-tab-health-score\.red\{color:#F04531\}/);
});

test("Person profile overview keeps health details accessible and scoped above Today", () => {
  assert.match(homeRhythmSource, /personAvatar\(p,76\)/);
  assert.match(styles, /\.person-profile-page \.person-profile-header \.person-identity h3\{[^}]*font-size:calc\(var\(--tend-type-section-header\) \+ \.25rem\)!important/);
  assert.match(styles, /\.person-profile-page \.person-profile-header \.person-identity \.rel\{[^}]*font-size:calc\(var\(--tend-type-description\) \+ \.05rem\)!important;font-weight:600/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\] \.person-profile-page\{--person-profile-avatar-size:108px\}/);
  assert.match(homeRhythmSource, /person-profile-options-list[\s\S]*?data-psettings="1"[\s\S]*?data-closeperson="1"/);
  assert.match(homeRhythmSource, /person-profile-badges/);
  assert.match(homeRhythmSource, /aria-label="Birthday: '\+esc\(bd\.label\)\+'"/);
  assert.match(homeRhythmSource, /aria-label="Anniversary: '\+esc\(an2\.label\)\+'"/);
  assert.match(homeRhythmSource, /<span aria-hidden="true">\\uD83C\\uDF82<\/span><span>'\+esc\(personProfileShortDateLabel\(bd\.label\)\)/);
  assert.match(homeRhythmSource, /<span aria-hidden="true">\\u2665<\/span><span>'\+esc\(personProfileShortDateLabel\(an2\.label\)\)/);
  assert.match(homeRhythmSource, /function personProfileShortDateLabel\(label\)/);
  assert.match(styles, /\.person-profile-page \.person-profile-badges\{display:grid;grid-template-columns:repeat\(3,minmax\(0,max-content\)\)/);
  assert.match(homeRhythmSource, /personHealthMeter\(scoreAvailable\?scoreValue:null,p\.name,true\)/);
  assert.ok(homeRhythmSource.indexOf("out+=actQueueHTML(p)") > homeRhythmSource.indexOf("personHealthMeter(scoreAvailable?scoreValue:null,p.name,true)"));
  assert.match(personOverviewSource, /var rs=sortedPersonRhythms\(p\)/);
  assert.match(personOverviewSource, /var latestRhythmEvent=null;[\s\S]*?rs\.forEach\(function\(rhythm\)\{[\s\S]*?var event=rhythmLast\(rhythm\)/);
  assert.match(personOverviewSource, /var latestRhythmText=latestRhythmEvent\?"Last tended: "\+when\(latestRhythmEvent\.event\.ts\):"Last tended: Never"/);
  assert.ok(personOverviewSource.indexOf("esc(latestRhythmText)") < personOverviewSource.indexOf("rs.length?rs.length"));
  assert.match(personOverviewSource, /person-health-summaries/);
  assert.match(personOverviewSource, /var tone=display==="\\u2014"\?"neutral":scoreClass\(Number\(value\)\)/);
  assert.match(personOverviewSource, /person-health-summary-score '\+tone/);
  assert.match(styles, /\.person-profile-page \.person-health-summary-score\.green\{color:#12B76A\}/);
  assert.match(styles, /\.person-profile-page \.person-health-summary-score\.yellow\{color:#F08C00\}/);
  assert.match(styles, /\.person-profile-page \.person-health-summary-score\.red\{color:#F04531\}/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\] \.person-profile-page \.person-health-summary\{padding-right:4px;padding-left:4px\}/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\] \.person-profile-page \.person-health-summary-label\{font-size:14px;letter-spacing:-\.03em;white-space:nowrap\}/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable\{[^}]*gap:\.5em;padding:\.33em \.83em \.33em \.33em;font-size:var\(--tend-type-person-badge\)!important/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable \.avatar\{width:1\.6em!important;height:1\.6em!important/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable,\s*\.person-free-moment \.prayer-person\.person-badge-clickable,\s*\.profile-tab-panel \.prayer-person\.person-badge-clickable\{[^}]*padding:\.33em \.83em \.33em \.33em;border:0;font-size:var\(--tend-type-person-badge\)!important;line-height:1\.2\}/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable \.avatar,\s*\.person-free-moment \.prayer-person\.person-badge-clickable \.avatar,\s*\.profile-tab-panel \.prayer-person\.person-badge-clickable \.avatar\{width:1\.6em!important;height:1\.6em!important/);
  assert.match(styles, /\.person-free-moment \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable,\s*\.profile-tab-panel \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable\{gap:\.5em;padding:\.33em \.83em \.33em \.33em\}/);
  assert.match(styles, /\.person-free-moment \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable \.avatar,\s*\.profile-tab-panel \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable \.avatar\{width:1\.6em!important;height:1\.6em!important/);
  assert.match(personOverviewSource, /aria-expanded="false"/);
  assert.match(personOverviewSource, /data-person-health-detail="rhythms"/);
  assert.match(personOverviewSource, /data-person-health-detail="connection"/);
  assert.match(personOverviewSource, /data-person-health-detail="prayer"/);
  assert.match(personOverviewSource, /id="person-health-detail" hidden aria-live="polite"/);
  assert.match(personOverviewSource, /id="person-health-detail-title-rhythms">Rhythms<\/h4>[\s\S]*?person-health-detail-icon" aria-hidden="true">'\+collectionIcon\("rhythms"\)/);
  assert.doesNotMatch(personOverviewSource.match(/data-person-health-detail="rhythms"[\s\S]*?<\/section>/)[0], /data-meter-tab=/);
  assert.match(personOverviewSource, /data-person-health-detail="connection"[\s\S]*?esc\(lastConnection\)[\s\S]*?esc\(connectionTarget\)[\s\S]*?person-health-detail-icon" aria-hidden="true"/);
  assert.match(personOverviewSource, /var lastConnection=pTouch\.last\?"Last connection: "\+when\(pTouch\.last\.ts\)/);
  assert.match(personOverviewSource, /data-person-health-detail="connection"[\s\S]*?person-health-detail-icon" aria-hidden="true">'\+collectionIcon\("connection"\)/);
  assert.match(personOverviewSource, /id="person-health-detail-title-prayer">Prayer<\/h4>[\s\S]*?person-health-detail-icon" aria-hidden="true">'\+collectionIcon\("prayer"\)/);
  assert.doesNotMatch(personOverviewSource.match(/data-person-health-detail="connection"[\s\S]*?<\/section>/)[0], /data-meter-tab=/);
  assert.doesNotMatch(personOverviewSource.match(/data-person-health-detail="prayer"[\s\S]*?<\/section>/)[0], />View prayers<\/button>/);
  assert.match(actionsSource, /detailLink\.setAttribute\("data-meter-tab",key\)/);
  assert.match(actionsSource, /detailLink\.removeAttribute\("data-meter-tab"\)/);
  assert.match(actionsSource, /data-person-health-summary[\s\S]*?data-active-summary/);
  assert.match(styles, /\.person-profile-page \.person-profile \.person-health-bar\.solid\{height:8px;margin:20px 0 12px;box-shadow:none;background:#E9EFEB;overflow:hidden\}/);
  assert.match(homeRhythmSource, /tendPrayerSectionHTML\("Pray for "\+p\.name,"", \{headerClassName:"today-with-person-heading person-prayer-heading"\}\)/);
  const personFreeMomentSource = homeRhythmSource.match(/function personFreeMomentHTML\(person\)\{[\s\S]*?\n\}/)[0];
  assert.ok(personFreeMomentSource.includes('footerHTML=\'<span class="dashboard-spark-deadline">\'+esc(current.deadline)+\'</span>\''));
  assert.ok(personFreeMomentSource.includes('class="dashboard-spark-carousel-count" aria-live="polite">\'+(index+1)+\' of \'+sparkQueue.length'));
  assert.doesNotMatch(personFreeMomentSource, /footerHTML='<span>'\+\(index\+1\)\+' of '\+sparkQueue\.length/);
  assert.doesNotMatch(personFreeMomentSource, /profile-view-all-sparks|data-person-sparks-view-all/);
  assert.match(styles, /\.home-dashboard \.dashboard-spark-carousel-count,\s*\.person-profile-page \.dashboard-spark-carousel-count\{/);
  assert.match(homeRhythmSource, /class="person-profile-divider" aria-hidden="true"><\/div>'\+tendSectionHeaderHTML\(\{title:"Intentional with "\+p\.name/);
  assert.match(styles, /html \.person-profile-page \.person-prayer-heading h2,[\s\S]*?html \.person-profile-page \.person-free-moment-heading h2\{font-size:var\(--tend-type-description\)!important/);
  assert.match(styles, /\.person-profile-page \.person-profile-divider\{width:100%;height:1px;margin:20px 0 0;background:var\(--line\)\}/);
  assert.match(styles, /\.person-profile-page \.person-profile-divider\+\.profile-settings-heading\{margin-top:24px\}/);
  assert.match(styles, /\.person-profile-page \.person-health-summary\{[^}]*border-left:1px solid var\(--line\)/);
  assert.match(styles, /@media\(max-width:580px\)\{[\s\S]*?\.person-profile-page \.person-health-summaries\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Person Connections preview and both history views share ConnectionCard", () => {
  assert.equal((homeRhythmSource.match(/function connectionCardHTML\(/g) || []).length, 1);
  assert.match(homeRhythmSource, /var connections=connectionHistoryEvents\(pid\)/);
  assert.match(homeRhythmSource, /connections\.slice\(0,5\)\.map\(function\(event\)\{return connectionCardHTML\(event,pid\);\}\)/);
  assert.match(homeRhythmSource, /<div class="connection-list"><div class="profile-empty-state">No connections yet<\/div><\/div>/);
  assert.match(homeRhythmSource, /class="profile-panel-toolbar connection-profile-toolbar"/);
  assert.match(homeRhythmSource, /connection-profile-intro">Shared moments that keep you connected\.<\/p><div class="profile-panel-toolbar connection-profile-toolbar"/);
  assert.match(homeRhythmSource, /class="connection-history-chart-trigger" data-connection-history=/);
  assert.match(homeRhythmSource, /aria-label="View connection chart"/);
  assert.match(homeRhythmSource, /class="profile-tab-intro connection-profile-intro">Shared moments that keep you connected\.<\/p>/);
  assert.match(homeRhythmSource, /profileActionIcon\("chart"\)/);
  assert.match(homeRhythmSource, /class="btn mini ghost profile-rhythm-add connection-profile-log" data-rippleopen="1"/);
  assert.match(homeRhythmSource, /<span>Log connection<\/span>/);
  assert.match(homeRhythmSource, /if\(connections\.length>5\)/);
  assert.match(homeRhythmSource, /connection-history-view-all/);
  assert.match(homeRhythmSource, /View all \('\+connections\.length\+'\)/);
  assert.match(connectionHistorySource, /visible\.map\(function\(event\)\{return connectionCardHTML\(event,personId\);\}\)/);
  assert.match(connectionHistorySource, /dayEvents\.map\(function\(event\)\{return connectionCardHTML\(event,personId\);\}\)/);
  assert.match(homeRhythmSource, /function connectionCardLastTended\(event\)[\s\S]*?var last=\{ts:Number\(event\.ts\)\}/);
  assert.doesNotMatch(homeRhythmSource.match(/function connectionCardHTML\([\s\S]*?\n\}/)[0], /tendRhythmMetaLabel/);
  assert.match(connectionHistorySource, /function openConnectionHistory\(personId,initialView\)/);
  assert.match(actionsSource, /openConnectionHistory\(b\.getAttribute\("data-connection-history"\),"chart"\)/);
  assert.match(actionsSource, /openConnectionHistory\(b\.getAttribute\("data-connection-history-list"\),"list"\)/);
  assert.doesNotMatch(connectionHistorySource, /function openConnectionList\(/);
  assert.match(connectionHistorySource, /data-connection-history-view="list"/);
  assert.match(connectionHistorySource, /data-connection-history-view="chart"/);
  assert.match(connectionHistorySource, /data-connection-history-load-more/);
  assert.match(connectionHistorySource, /No connections on this date\./);
  assert.doesNotMatch(homeRhythmSource, /function rippleLine\(/);
  assert.doesNotMatch(indexSource, /connection-list\.js/);
  assert.match(styles, /\.connection-card\{[^}]*display:flex;flex-direction:column/);
  assert.match(styles, /\.connection-card__heading\.rhythm-card__title-line\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(styles, /\.connection-card__heading>\.tend-type-title\{grid-column:1;grid-row:1;min-width:0;overflow-wrap:anywhere/);
  assert.match(styles, /\.connection-card__type\{grid-column:3;grid-row:1;display:flex;align-items:flex-start;justify-self:end/);
  assert.match(styles, /\.connection-history-view\{display:flex;flex:1 1 auto;flex-direction:column;gap:14px;min-height:0;overflow-y:auto/);
  assert.match(styles, /\.connection-history-chart-view \.history-scroll\{flex:none;max-width:100%;overflow-x:auto;overflow-y:hidden;margin:0;padding:8px 8px 16px 0/);
  assert.match(styles, /\.connection-history-chart-view \.connection-history-column\.is-selected\{background:var\(--mist\);box-shadow:0 0 0 2px var\(--forest\)\}/);
  assert.match(actionsSource, /function logEvent\([\s\S]*?refreshConnectionDialogs\(\);render\(\)/);
  assert.match(actionsSource, /function deleteEvent\([\s\S]*?refreshConnectionDialogs\(\)/);
  assert.match(connectionHistorySource, /No connections yet\. Log a shared moment to start your history\./);
  assert.match(homeRhythmSource, /function connectionCardLastTended\(event\)[\s\S]*?tendRhythmCardLastTended\(last\)/);
  const connectionCard = homeRhythmSource.match(/function connectionCardHTML\([\s\S]*?\n\}/)[0];
  assert.match(connectionCard, /class="connection-card__heading rhythm-card__title-line"/);
  assert.match(connectionCard, /class="rhythm-card__edit" data-evedit=/);
  assert.doesNotMatch(connectionCard, /data-evdel=/);
  assert.ok(connectionCard.includes('class="connection-card__type">\'+typeBadge+\'</div></div>'));
  assert.match(connectionCard, /class="connection-card__footer rhythm-card__meta"/);
  assert.match(connectionCard, /scheduleItem\("frequency"/);
  assert.match(connectionCard, /scheduleItem\("time"/);
  assert.match(connectionCard, /rhythm-card__meta-item rhythm-card__last/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-profile-intro\{margin:0 0 10px;color:var\(--ink-faint\);font-size:13px;line-height:1\.45\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-profile-toolbar\{align-items:center;flex-direction:row;justify-content:space-between/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-history-chart-trigger\{[^}]*width:44px;height:44px;min-width:44px;min-height:44px/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-history-chart-trigger:focus-visible\{outline:2px solid var\(--forest\);outline-offset:2px\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-history-view-all\{display:flex;width:max-content;margin:16px auto 4px\}/);
});

test("Person empty sections use centered card placeholders", () => {
  assert.match(homeRhythmSource, /else out\+='<div class="profile-empty-state">No rhythms yet<\/div>'/);
  assert.match(homeRhythmSource, /else out\+='<div class="profile-empty-state">No sparks yet<\/div>'/);
  assert.match(styles, /\.person-profile-page \.profile-tab-panel \.profile-empty-state,\.person-profile-page \.today-with-person \.profile-empty-state\{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:112px;margin:0;padding:16px;border:1px solid var\(--line\);border-radius:16px;background:var\(--card\);box-shadow:/);
  assert.match(styles, /\.person-profile-page #profile-panel-rhythms \.profile-empty-state,\.person-profile-page #profile-panel-prayer \.profile-empty-state\{border-radius:20px\}/);
});

test("Focus rhythm rows reuse the shared card and include the owning person badge", () => {
  const rhythmRow = focusSource.match(/if\(item\.type==='rhythm'\)\{[\s\S]*?\n   return;\n  \}/)[0];
  assert.match(rhythmRow, /tendQueuePeopleAndCategoryBadges\(rhythm,person\.id,"","rhythm"\)/);
  assert.match(rhythmRow, /tendRhythmCardHTML\(rhythm,\{/);
  assert.match(rhythmRow, /peopleBadgesHTML:badges/);
  assert.match(rhythmRow, /tendAttributes:\{"data-tend-open":"person-rhythm","data-person-id":person\.id,"data-rhythm-id":rhythm\.id\}/);
  assert.match(rhythmRow, /showScore:false/);
  assert.doesNotMatch(rhythmRow, /todayQueueMetaBar|tendRhythmCardContentHTML/);
  assert.match(styles, /\.focus-dialog \.focus-rhythm-item\{margin:14px 0\}/);
  assert.match(peopleSource, /class="btn mini ghost pc-add-person" data-addperson>\+ Add person/);
  assert.match(peopleSource, /"\.btn\.mini\.pc-add-person\{box-sizing:border-box;justify-self:end;width:max-content;height:44px;min-height:44px;padding:8px 13px;font-size:14px;line-height:1\.2\}"/);
  assert.match(peopleSource, /className:"people-section-title"[\s\S]*?trailingHTML:'<button type="button" class="btn mini ghost pc-add-person" data-addperson>\+ Add person<\/button>'/);
  assert.match(peopleSource, /out\+='<div class="pc-toolbar"><div class="pc-toggles"/);
  assert.match(peopleSource, /var CAT_LABEL=\{marriage:"Marriage",parenting:"Parenting",friendships:"Friends"\}/);
  assert.match(peopleSource, /"\.pc-toolbar\{display:flex;justify-content:center/);
  assert.match(peopleSource, /"\.pc-toggles\{display:flex;justify-content:center/);
  assert.match(peopleSource, /"\.pc-add-person\{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 13px;border:1px solid var\(--forest\);border-radius:10px;background:transparent;color:var\(--forest\);font-size:14px;font-weight:600;white-space:nowrap\}"/);
  assert.match(styles, /\.people-section-title h2\{grid-column:1;grid-row:1\}/);
  assert.match(styles, /\.people-section-title \.pc-add-person\{grid-column:2;grid-row:1;justify-self:end\}/);
  assert.match(styles, /\.people-section-title \.hint\{grid-column:1\/-1;grid-row:2\}/);
  assert.match(styles, /\.people-section-title\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;align-items:center;gap:2px 12px;margin-bottom:20px\}/);
  assert.match(styles, /\.faith-page-heading\{justify-content:flex-start;align-items:baseline;gap:12px;margin:2px 0 8px\}/);
});

test("Connection history source keeps repeated events and scopes people using existing rules", () => {
  const events = [
    { id: "older", personId: "amy", ts: new Date(2026, 9, 10, 10).getTime(), isConnection: true },
    { id: "repeat-a", personId: "amy", ts: new Date(2026, 9, 12, 8).getTime(), rhythmId: "walk", isConnection: true },
    { id: "other-person", personId: "hannah", ts: new Date(2026, 9, 12, 9).getTime(), isConnection: true },
    { id: "repeat-b", personId: "amy", ts: new Date(2026, 9, 12, 11).getTime(), rhythmId: "walk", isConnection: true },
    { id: "shared", personId: "hannah", personIds: ["amy"], ts: new Date(2026, 9, 11, 11).getTime(), isConnection: true },
    { id: "middle", personId: "amy", ts: new Date(2026, 9, 11, 9).getTime(), isConnection: true },
    { id: "latest", personId: "amy", ts: new Date(2026, 9, 12, 12).getTime(), isConnection: true }
  ];
  const context = {
    S: { events },
    eventHasPerson: (event, personId) => event.personId === personId || event.personIds?.includes(personId),
    connectionEvent: event => event.isConnection,
    personCadenceDays: () => 7
  };
  vm.createContext(context);
  vm.runInContext(connectionHistorySource, context);
  const recent = context.connectionHistoryEvents("amy");
  assert.deepEqual(Array.from(recent, event => event.id), ["latest", "repeat-b", "repeat-a", "shared", "middle", "older"]);
  assert.deepEqual(Array.from(recent.slice(0, 5), event => event.id), ["latest", "repeat-b", "repeat-a", "shared", "middle"]);
  const data = context.connectionHistoryData({ id: "amy", connectCadence: "weekly" }, new Date(2026, 9, 12, 12));
  assert.equal(data.events.length, 6);
  assert.equal(data.total, 6);
  assert.equal(data.bins.reduce((sum, bin) => sum + bin.count, 0), 6);
});

test("Prayer action dropdown options are unshaded until hovered", () => {
  assert.match(styles, /\.prayer-action-options button\{background:transparent;color:var\(--action-prayer-text,#705A8D\)\}/);
  assert.match(styles, /\.prayer-action-options button:hover[\s\S]*?background:var\(--action-prayer-hover,#E6DCEE\)/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row \.prayer-action-options button\{border:0;background:transparent/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row \.prayer-action-options button:hover,[\s\S]*?background:var\(--action-prayer-hover,#E6DCEE\)/);
  assert.doesNotMatch(styles, /\.prayer-action-options button\{border:1px solid/);
});

test("Shared Focused Prayer entry labels selection and starts only eligible queues", () => {
  const components = loadComponents();
  const entry = components.tendPrayerEntryHTML({ id: "dashboard", count: 4, peopleCount: 2, timeframe: "Now" });
  const emptyEntry = components.tendPrayerEntryHTML({ id: "person:amy", count: 0, peopleCount: 1, timeframe: "Morning" });
  assert.match(entry, /4 requests · Now/);
  assert.match(entry, /2 people selected/);
  assert.match(entry, />Customize<\/button>/);
  assert.match(entry, /data-prayer-session-start="dashboard"/);
  assert.doesNotMatch(entry, /aria-label="[^"]*filter[^"]*"[^>]*><svg/);
  assert.match(emptyEntry, /No active requests match this selection/);
  assert.match(emptyEntry, /data-prayer-session-start="person:amy"[^>]*disabled/);
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
  assert.match(todayWithPerson, /<div class="today-with-person" style="margin-bottom:14px">/);
  assert.doesNotMatch(todayWithPerson, /class="card act today-with-person"/);
  assert.doesNotMatch(styles, /\.card\.act\.today-with-person\{/);
  assert.doesNotMatch(todayWithPerson, /Nothing waiting/);
  const emptyTodayWithPerson = components.tendTodayWithPersonHTML({
    personName: "Alex",
    waitingCount: 0,
    emptyMessage: "Nothing waiting"
  });
  assert.match(emptyTodayWithPerson, /all tended/);
  assert.match(emptyTodayWithPerson, /Nothing waiting/);
  assert.match(emptyTodayWithPerson, /<div class="today-with-person" style="margin-bottom:14px"><div class="profile-empty-state">Nothing waiting<\/div><\/div>/);
  assert.match(styles, /\.person-profile-page \.profile-tab-panel \.profile-empty-state,\.person-profile-page \.today-with-person \.profile-empty-state\{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:112px/);

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

test("Prayer selection uses one shared timeframe option renderer with resolved summaries", () => {
  const components = loadComponents();
  const options = [
    { id: "now", label: "Morning", timeDescription: "9:00am – 11:30am", count: 2, isCurrent: true },
    { id: "lunch", label: "<Lunch>", timeDescription: "11:30am – 1:30pm", count: 0 },
    { id: "evening", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 9 }
  ];
  const dashboardState = components.tendPrayerTimeframePickerState("now", options, 2);
  const personState = components.tendPrayerTimeframePickerState("now", options.map(option => ({ ...option, count: option.id === "now" ? 1 : 7 })), 5);
  const dashboard = components.tendPrayerTimeframePickerHTML({
    mode: "options",
    options: dashboardState.options,
    selectedTimeframeId: dashboardState.selectedTimeframeId,
    allDayCount: dashboardState.allDayCount
  });
  const person = components.tendPrayerTimeframePickerHTML({
    mode: "options",
    options: personState.options,
    selectedTimeframeId: personState.selectedTimeframeId,
    allDayCount: personState.allDayCount
  });
  const summary = components.tendPrayerTimeframePickerHTML({
    label: "Now",
    resolvedLabel: "Evening · 4:30pm – 9:30pm"
  });

  assert.match(dashboard, /data-prayer-time-option="now"/);
  assert.match(dashboard, /class="prayer-timeframe-picker__option is-current is-selected"/);
  assert.match(person, /class="prayer-timeframe-picker__option is-current is-selected"/);
  assert.match(dashboard, /&lt;Lunch&gt;/);
  assert.match(dashboard, /class="prayer-timeframe-picker__option" data-prayer-time-option="allday"/);
  assert.match(summary, /Change timeframe, currently Now\. Evening · 4:30pm – 9:30pm/);
  assert.match(summary, /data-prayer-selection-time-open/);
  assert.equal(dashboardState.selectedCount, 2);
  assert.equal(personState.selectedCount, 1);
  assert.equal(dashboardState.label, "Now");
  assert.equal(personState.label, "Now");
  assert.match(dashboard, /2 requests<\/span>/);
  const eveningState = components.tendPrayerTimeframePickerState("evening", options, 2);
  assert.equal(eveningState.label, "Evening");
  assert.equal(eveningState.selectedCount, 9);
  const allDayState = components.tendPrayerTimeframePickerState("allday", options, 4);
  assert.equal(allDayState.label, "All Day");
  assert.equal(allDayState.selectedCount, 4);
  const allRequestsState = components.tendPrayerTimeframePickerState("allrequests", options, 4, 8);
  assert.equal(allRequestsState.label, "All requests");
  assert.equal(allRequestsState.selectedCount, 8);
  assert.equal((source.match(/function tendPrayerTimeframePickerHTML\(/g) || []).length, 1);
  assert.match(faithSource, /tendPrayerTimeframePickerHTML\(\{label:faithPrayerSelectionLabel/);
  assert.match(faithSource, /data-prayer-time-option/);
  assert.doesNotMatch(faithSource, /current-plan-time-option|data-(?:person-)?dashboard-prayer-time-option/);
  assert.match(styles, /\.prayer-timeframe-picker__option\{/);
  assert.match(styles, /\.prayer-timeframe-picker__option\{/);
});

test("Home, Faith, Prayer, and Person use one shared prayer-selection dialog", () => {
  const components = loadComponents();
  const sharedLayout = {
    view: "people",
    timeframeHTML: components.tendPrayerTimeframePickerHTML({ label: "Now", resolvedLabel: "Evening · 4:30pm – 9:30pm" }),
    count: 3,
    groupsHTML: '<button role="checkbox" aria-checked="mixed">Friends</button>',
    peopleHTML: '<button aria-pressed="true">Amy</button>'
  };
  const dashboard = components.tendPrayerSelectionDialogHTML({
    ...sharedLayout,
    timeOptions: [{ id: "now", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 3 }],
    allDayCount: 4,
    peopleHTML: '<button aria-pressed="true">Amy</button>'
  });

  const timeframe = components.tendPrayerSelectionDialogHTML({
    ...sharedLayout,
    view: "timeframe",
    timeOptions: [{ id: "now", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 3 }],
    selectedTimeframeId: "now",
    allDayCount: 4,
    includeAllRequests: true,
    allRequestsCount: 8
  });

  for (const dialog of [dashboard, timeframe]) {
    assert.match(dialog, /class="profile-editor-dialog prayer-selection-dialog"/);
    assert.match(dialog, /data-prayer-selection-body/);
    assert.match(dialog, /prayer-selection-footer/);
    assert.match(dialog, /3 requests selected/);
    assert.match(dialog, /data-prayer-selection-done/);
    assert.match(dialog, /data-prayer-selection-start/);
  }
  assert.match(dashboard, /Prayer selection/);
  assert.match(dashboard, /Timeframe/);
  assert.match(dashboard, /People/);
  assert.match(dashboard, /Select all/);
  assert.match(dashboard, /Clear/);
  assert.match(dashboard, /aria-checked="mixed"/);
  assert.match(dashboard, /aria-pressed="true"/);
  assert.match(timeframe, /data-prayer-selection-back/);
  assert.match(timeframe, /data-prayer-time-option="allrequests"/);
  assert.match(faithSource, /function faithPrayerSelectionDialogHTML\(context\)/);
  assert.match(faithSource, /class="prayer-selection-groups" role="group" aria-label="People categories"/);
  assert.match(faithSource, /var firstName=isMe\?"Me":String\(person\.name\|\|""\)\.trim\(\)\.split\(\/\\s\+\/\)\[0\]/);
  assert.match(faithSource, /active\?"Deselect ":"Select "/);
  assert.match(faithSource, /class="prayer-selection-group'\+\(state==="true"\?" is-selected":state==="mixed"\?" is-mixed":""\)/);
  assert.match(homeRhythmSource, /window\.faithPrayerEntryHTML\("dashboard"\)/);
  assert.match(prayerSource, /faithPrayerEntryHTML\("prayer"\)/);
  assert.match(faithSource, /window\.faithPrayerEntryHTML\("person:"\+person\.id\)/);
  assert.equal((faithSource.match(/tendPrayerSelectionDialogHTML\(/g) || []).length, 1);
  assert.match(styles, /\.prayer-selection-groups\{display:grid/);
  assert.match(styles, /\.prayer-selection-group\{[^}]*background:#F1F3F1/);
  assert.match(styles, /\.prayer-selection-people\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.prayer-selection-person\.is-selected \.prayer-selection-check\{[^}]*color:#fff/);
});

test("shared prayer flow uses scoped purple actions and neutral selected-name text", () => {
  assert.match(styles, /\.prayer-entry-module,[\s\S]*?\.prayer-selection-dialog,[\s\S]*?\.faith-prayer-session\{[\s\S]*?--prayer-primary:#735990/);
  assert.match(styles, /--prayer-lavender:#F0EAF7/);
  assert.match(styles, /--prayer-purple-border:#D9CBE9/);
  assert.match(styles, /--prayer-canvas:#F7F9F7/);
  assert.match(styles, /--prayer-neutral-border:#DEE7E1/);
  assert.match(styles, /\.prayer-entry-actions>\[data-prayer-session-start\],[\s\S]*?background:var\(--prayer-primary\);[\s\S]*?color:#fff/);
  assert.match(styles, /\.faith-prayer-session \.faith-session-actions \.faith-session-prayed\{border-color:var\(--prayer-primary\);background:var\(--prayer-primary\);color:#fff\}/);
  assert.match(styles, /\.prayer-selection-person\.is-selected\{border-color:var\(--prayer-purple-border\);background:var\(--prayer-lavender\);color:var\(--prayer-ink\)\}/);
  assert.match(styles, /\.prayer-timeframe-picker__option\.is-selected \.prayer-timeframe-picker__label[\s\S]*?color:var\(--prayer-ink\)/);
  assert.match(styles, /\.faith-prayer-session \.faith-session-track\{background:var\(--prayer-lavender\)\}/);
});

test("larger-text Today prayer sessions keep the full-screen mobile bounds", () => {
  assert.doesNotMatch(styles, /html\[data-mobile-text-size-level="larger"\]\s+\.home-dashboard\s+\.faith-prayer-session\{[^}]*width:\s*86\.9vw/);
  assert.match(styles, /@media\(max-width:600px\)\{[\s\S]*?\.faith-prayer-session\{inset:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh/);
});

test("Focused Prayer counts honor caller scope, draft people, and timeframe semantics", () => {
  const functionSource = name => faithSource.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^]*?\\n\\}`, "m"))[0];
  const context = {
    S: { people: [{ id: "amy", group: "marriage" }, { id: "lee", group: "friendships" }] },
    active: [
      { id: "mine", mine: true, scheduled: true, tod: "morning", score: 70 },
      { id: "amy-morning", personId: "amy", scheduled: true, tod: "morning", score: 30 },
      { id: "amy-evening", personId: "amy", scheduled: true, tod: "evening", score: 20 },
      { id: "lee-evening", personId: "lee", scheduled: true, tod: "evening", score: 40 },
      { id: "unassigned", scheduled: true, tod: "morning", score: 10 },
      { id: "amy-unscheduled", personId: "amy", scheduled: false, tod: "morning", score: 5 }
    ],
    faithActivePrayers: () => context.active,
    faithPrayerPersonGroup: person => person.group,
    faithPrayerIsMine: prayer => prayer.mine === true,
    faithPrayerScheduledToday: prayer => prayer.scheduled,
    faithPrayerScoreOrder: (a, b) => a.score - b.score,
    faithDashboardPrayerTimeBlock: mode => mode === "now" ? "morning" : mode === "allday" || mode === "allrequests" ? "all" : mode,
    dayBlocks: () => [{ id: "morning" }, { id: "evening" }],
    String,
    Number
  };
  vm.createContext(context);
  vm.runInContext([
    functionSource("faithPrayerPeopleMatch"),
    functionSource("faithDashboardPrayerMatches"),
    functionSource("faithDashboardPrayerSessionSort"),
    functionSource("faithPrayerSelectionIds")
  ].join("\n"), context);
  assert.deepEqual(Array.from(vm.runInContext('faithPrayerSelectionIds("dashboard","now",["me","amy","lee"],{})', context)), [
    "unassigned", "amy-morning", "mine"
  ]);
  assert.deepEqual(Array.from(vm.runInContext('faithPrayerSelectionIds("person:amy","allday",["amy"],{})', context)), [
    "amy-unscheduled", "amy-evening", "amy-morning"
  ]);
  assert.deepEqual(Array.from(vm.runInContext('faithPrayerSelectionIds("faith-requests","allrequests",["amy"],{marriage:true})', context)), [
    "amy-unscheduled", "amy-evening", "amy-morning"
  ]);
  assert.deepEqual(Array.from(vm.runInContext('faithPrayerSelectionIds("faith-requests","allday",["amy"],{marriage:false})', context)), []);
});

test("Faith health shows bright-score navigation areas and an all-rhythm destination", () => {
  const faithHealth = faithSource.match(/function faithHealthHTML\(\)\{([\s\S]*?)\n\}/)[1];
  assert.match(faithHealth, /class="person-health-summaries" role="group" aria-label="Faith health summaries"/);
  assert.match(faithHealth, /summaryButton\("rhythms","Rhythms",rhythmScoreValue\)\+summaryButton\("prayer","Prayer",prayerScoreValue\)/);
  assert.doesNotMatch(faithHealth, /summaryButton\("connection"/);
  assert.ok(faithHealth.includes(`data-faith-health-nav="'+key+'"`));
  assert.ok(faithHealth.includes(`person-health-summary-score '+tone+'`));
  assert.match(faithHealth, /faithScoreClass\(value\)/);
  assert.match(faithHealth, /person-health-summary-detail"><span>'\+activityIcon\+'<span>'\+esc\(count\+" active"\)[\s\S]*?calendarIcon\+'<span>'\+esc\(lastDate\)/);
  assert.match(styles, /\.faith-health-card \.person-health-summary-detail svg\{width:13px;height:13px/);
  assert.doesNotMatch(faithHealth, /person-health-detail|person-health-detail-icon|Faith rhythms and prayers, tended together/);
  assert.match(faithHealth, /class="bar-ov person-health-bar solid"/);
  assert.match(faithHealth, /faith-health-overview-copy[\s\S]*?class="person-health-status statusword/);
  assert.match(faithSource, /function faithAllRhythmsHTML\(\)[\s\S]*faithPracticeGroups\(\)\.filter\(function\(group\)\{return faithPracticeRhythmRecords\(group\)\.length>0;\}\)[\s\S]*faithRhythmsHTML\(group\)/);
  const practiceOverview = faithSource.match(/function faithPracticeOverviewHTML\(selected\)\{([\s\S]*?)\n\}/)[1];
  const practiceContent = faithSource.match(/function faithPracticeContent\(group\)\{([\s\S]*?)\n\}/)[1];
  const allRhythmsContent = faithSource.match(/function faithAllRhythmsHTML\(\)\{([\s\S]*?)\n\}/)[1];
  assert.doesNotMatch(practiceOverview, /faith-all-rhythms|data-faith-all-rhythms/);
  assert.match(practiceContent, /faithPracticeHeadingHTML\(group,description,[\s\S]*data-faith-all-rhythms-open[\s\S]*"faithPracticeTitle"\)/);
  assert.match(practiceContent, /faith-practice-toolbar[\s\S]*?faith-practice-tabs[\s\S]*?\+addAction/);
  assert.match(allRhythmsContent, /faithPracticeHeadingHTML\("All Faith rhythms","Rhythms across every Faith practice\.",[\s\S]*Back to '\+esc\(selected\)[\s\S]*"faithAllRhythmsTitle"\)/);
  assert.match(allRhythmsContent, /faithRhythmsHTML\(group\)/);
  assert.match(allRhythmsContent, /data-faith-all-rhythm-add[\s\S]*?faith-all-rhythms-toolbar/);
  assert.doesNotMatch(allRhythmsContent, /role="tablist"/);
  assert.match(faithSource, /aggregateCategoryRequired&&isNew[\s\S]*?Choose a practice[\s\S]*?FAITH_GROUPS\.map/);
  assert.match(faithSource, /aggregateCategoryRequired&&FAITH_GROUPS\.indexOf\(draft\.faithGroup\)<0/);
  assert.match(faithSource, /data-faith-all-rhythm-add[\s\S]*?faithGroup:"",aggregateCategoryRequired:true/);
  assert.match(faithSource, /data-faith-rhythm-group[\s\S]{0,100}faithRhythmDraft\.faithGroup=t\.value/);
  assert.match(styles, /\.faith-practice-link-row\{display:flex;justify-content:flex-end;[^}]*margin:0 0 24px/);
  assert.match(styles, /\.faith-practice-divider\{width:100%;height:1px;background:var\(--line\)\}/);
  assert.match(styles, /\.faith-practice-heading\{display:grid;justify-items:center;gap:8px;[^}]*padding-top:30px;text-align:center\}/);
  assert.match(styles, /\.faith-all-rhythms-link\{[^}]*text-align:right;overflow-wrap:anywhere/);
  assert.match(styles, /\.faith-all-rhythms-toolbar\{justify-content:flex-end\}/);
  assert.match(faithSource, /if\(b\.matches\("\[data-faith-all-rhythms-open\]"\)\)\{faithShowPracticeView\(true,null,"faithAllRhythmsTitle"\)/);
  assert.match(faithSource, /function faithShowPracticeView\(showAll,group,headingId\)\{[\s\S]*faithMainView="practices"[\s\S]*faithScrollToHeading\(document\.getElementById\(headingId\|\|\(faithShowAllRhythms\?"faithAllRhythmsTitle":"faithPracticeTitle"\)\)\)/);
  assert.match(faithSource, /faithSetMainView\("prayer",false\)[\s\S]*faithPrayerTitle/);
  assert.match(faithSource, /faithViewHeaderHTML\("Prayer","","","faithPrayerTitle",true\)/);
  assert.match(faithSource, /function faithScrollToHeading\(target\)[\s\S]*prefers-reduced-motion: reduce[\s\S]*target\.focus\(\{preventScroll:true\}\)[\s\S]*target\.scrollIntoView/);
  assert.match(styles, /\.faith-view-header-title#faithPrayerTitle\{scroll-margin-top:160px\}/);
  assert.match(faithSource, /function faithPracticeHealthParts\(\)[\s\S]*avg\(faithPracticeRhythmRecords\("Prayer"\)\.map/);
  assert.match(styles, /\.faith-health-card \.person-health-summaries\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.faith-health-card \.person-health-summary-score\.green\{color:#12B76A\}/);
  assert.match(styles, /\.faith-health-card \.person-health-summary-score\.yellow\{color:#F08C00\}/);
  assert.match(styles, /\.faith-health-card \.person-health-summary-score\.red\{color:#F04531\}/);
  assert.match(styles, /\.faith-health-card \.person-health-summaries\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(styles, /\.faith-view-nav \[role=tab\]\[aria-selected=true\]/);
  assert.match(styles, /\.faith-view-panel\[hidden\]\{display:none\}/);
  assert.match(styles, /\.faith-views-content\{display:grid;gap:1\.5rem/);
  assert.match(styles, /\.faith-view-header-title\{[^}]*font-size:var\(--tend-type-section-header\)/);
  assert.match(styles, /\.faith-view-header-description\{[^}]*font-size:var\(--tend-type-metadata\)/);
  assert.equal((faithSource.match(/faithViewHeaderHTML\(/g) || []).length, 5);
  assert.match(faithSource, /'<div class="faith-views-content">'\+faithViewNavHTML\(\)/);
  assert.match(actionsSource, /data-person-health-summary[\s\S]*?data-active-summary/);
  assert.match(homeRhythmSource, /faithMainView=type==="prayers"\|\|type==="requests"\?"prayer":type==="rhythms"\?"practices":"today";faithMainViewInitialized=true/);
  assert.match(categoryRhythmSource, /faithMainView="practices";faithMainViewInitialized=true;faithShowAllRhythms=false/);
});

test("Faith Today keeps scheduled rhythms and Sparks without its Prayer entry widget", () => {
  const today = faithSource.match(/function faithTodayHTML\(\)\{([\s\S]*?)\n\}/)[1];
  const practiceContent = faithSource.match(/function faithPracticeContent\(group\)\{([\s\S]*?)\n\}/)[1];
  assert.match(today, /return tendRhythmCardHTML\(r,/);
  assert.match(today, /categoryBadgesHTML:tendAssociationCategoryBadges\(r\)/);
  assert.match(today, /return tendSparkCardHTML\(s,/);
  assert.match(today, /data-faith-sparkdone=.*>Do it<\/button>/);
  assert.match(today, /class="profile-empty-state faith-today-empty">No Sparks waiting\./);
  assert.match(today, /faithViewHeaderHTML\("Today in Faith","",'<span class="qpill/);
  assert.match(today, /visibleRhythms=faithTodayExpanded\?rhythms:rhythms\.slice\(0,3\)/);
  assert.match(today, /View all for today \("\+scheduledCount\+"\)/);
  assert.doesNotMatch(today, /faith-today-controls/);
  assert.doesNotMatch(today, /faithActivePrayers\(\)\.filter\(prayerIsDue\)|tendPrayerCardContentHTML/);
  assert.doesNotMatch(today, /planKindTogglesHTML|planKindVisibilityFor|items hidden by the type filters/);
  assert.doesNotMatch(today, /dashboardFocusedPrayerHTML|faithPrayerEntryHTML|title:"Pray"/);
  assert.ok(today.indexOf('title:"Today in Faith"') < today.indexOf('title:"Sparks"'));
  assert.match(homeRhythmSource, /function dashboardFocusedPrayerHTML\(\)\{[\s\S]*window\.faithPrayerEntryHTML\("dashboard"\)/);
  assert.doesNotMatch(homeRhythmSource, /faithDashboardPrayerPeopleDialogHTML/);
  assert.match(faithSource, /faithViewHeaderHTML\("Your practices","Choose an area to tend\."/);
  assert.match(faithSource, /function faithPracticeOverviewHTML\(selected\)[\s\S]*faithSectionNavHTML\(selected\)/);
  assert.match(faithSource, /faithViewPanelHTML\("today",faithTodayHTML\(\)\)/);
  assert.match(faithSource, /faith-nav-score '\+level/);
  assert.match(faithSource, /aria-label="Health score '\+score\+' percent"[\s\S]*?<span>'\+score\+'<\/span>/);
  assert.match(faithSource, /class="faith-practice-panel" id="faith-practice-panel"/);
  assert.doesNotMatch(faithSource, /faithPracticeMetersHTML|faith-practice-meters|faith-practice-meter/);
  assert.match(faithSource, /function faithPracticeHealthParts\(\)/);
  assert.match(faithSource, /function faithPracticeHealth\(group\)/);
  assert.doesNotMatch(faithSource, /class="card faith-practice-card" id="faith-practice-panel"/);
  assert.doesNotMatch(faithSource, /faith-practice-focus-label/);
  assert.match(faithSource, /'\+labels\[tab\]\+'<\/button>/);
  assert.match(faithSource, /function faithSparksHTML\(group\)[\s\S]*?tendSparkCardHTML\(item/);
  assert.match(faithSource, /faith-practice-spark-list/);
  assert.match(faithSource, /data-faith-sparkdone=.*>Do it<\/button>/);
  assert.match(faithSource, /function faithRhythmsHTML\(group\)[\s\S]*?faith-practice-rhythm-list/);
  assert.doesNotMatch(faithSource.match(/function faithRhythmsHTML\(group\)\{([\s\S]*?)\n\}/)[1], /data-faith-rhythm-add/);
  assert.match(faithSource, /function faithSparksHTML\(group\)[\s\S]*?faith-practice-spark-list/);
  assert.doesNotMatch(faithSource.match(/function faithSparksHTML\(group\)\{([\s\S]*?)\n\}/)[1], /data-faith-spark-add/);
  assert.match(practiceContent, /faithRhythmsHTML\(group\):faithSparksHTML\(group\)/);
  assert.match(practiceContent, /data-faith-rhythm-add=.*\+ Add rhythm/);
  assert.match(practiceContent, /data-faith-spark-add=.*\+ Add spark/);
  assert.match(practiceContent, /role="tablist"[\s\S]*role="tab"[\s\S]*aria-selected="'\+\(tab===selected\)[\s\S]*tabindex="'\+\(tab===selected\?"0":"-1"\)/);
  assert.match(faithSource, /faithSection:sparkGroup/);
  assert.match(faithSource, /tabs\[nextIndex\]\.click\(\)/);
  assert.match(faithSource, /aria-label="Health score unavailable"/);
  assert.match(styles, /\.faith-practice-toolbar\{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap/);
  assert.match(styles, /\.faith-practice-tabs button\[aria-selected=true\]\{[^}]*background:var\(--card\)/);
  assert.match(styles, /\.faith-practice-rhythm-list\{display:grid;gap:14px/);
  assert.match(styles, /\.faith-practice-panel\{min-width:0;padding:0;scroll-margin-top:160px\}/);
  assert.match(styles, /\.faith-practice-heading \.faith-selected-practice-title\{[^}]*font-family:var\(--tend-font-editorial,Newsreader,Georgia,serif\)[^}]*font-size:calc\(var\(--tend-type-section-header,1\.35rem\)\*1\.1\)[^}]*font-weight:500/);
  assert.match(styles, /\.faith-practice-heading\{[^}]*text-align:center/);
  assert.match(styles, /\.faith-practice-panel>\.faith-practice-heading\{width:100%;grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(styles, /\.faith-page\{display:grid;gap:16px;padding-top:1\.5rem\}/);
  assert.match(styles, /\.faith-practice-focus\{width:min\(100%,360px\);min-width:0;margin:0 auto\}/);
  assert.match(styles, /\.faith-practice-focus p\{margin:0;color:var\(--ink-soft\);font-size:var\(--tend-type-description,1\.032rem\);font-weight:400/);
  assert.match(styles, /\.faith-practice-toolbar\{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:24px 0 14px\}/);
  assert.match(styles, /\.faith-nav-score-unavailable\{background:transparent;color:var\(--ink-soft\)/);
  assert.match(indexSource, /Newsreader:ital,opsz,wght@0,6\.\.72,400;0,6\.\.72,500/);
  assert.match(indexSource, /faith-practice-hierarchy/);
  assert.match(styles, /\.faith-prayer-time-group\{display:grid;gap:10px/);
  assert.match(styles, /\.faith-prayer-content,.faith-prayer-row,.faith-prayer-hub \.faith-profile-prayer-row\{box-sizing:border-box;width:100%;min-width:0\}/);
  assert.match(styles, /\.faith-today-subheading\{margin:28px 0 12px\}/);
  assert.match(styles, /\.faith-page \.dashboard-focused-prayer\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(styles, /\.faith-section-nav\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,190px\),1fr\)\)/);
  assert.match(styles, /\.faith-nav-score\.green\{background:#12B76A/);
  assert.match(homeRhythmSource, /function tendCaptureFaithScrollAnchor/);
  assert.match(homeRhythmSource, /function tendRestoreFaithScrollAnchor/);
  assert.match(homeRhythmSource, /tendFaithScrollBuffer\+=extra/);
  assert.match(homeRhythmSource, /faithScrollAnchor&&currentArea==="faith"/);
});

test("Faith overview keeps practice content inline in the Practices tab", () => {
  const extractFunction = name => faithSource.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^]*?\\n\\}`, "m"))[0];
  const groupContext = {
    FAITH_GROUPS: ["Sabbath", "Prayer", "Fasting", "Solitude", "Generosity", "Community", "Service", "Witness", "Scripture", "Other"],
    faithPracticeHealth: () => null,
    faithNavScoreHTML: () => "",
    faithPracticeCount: () => 0,
    esc: value => String(value)
  };
  vm.createContext(groupContext);
  const navHTML = vm.runInContext(`${extractFunction("faithSectionNavHTML")};faithSectionNavHTML("Prayer")`, groupContext);
  const practiceHeadingHTML = vm.runInContext(`${extractFunction("faithPracticeHeadingHTML")};faithPracticeHeadingHTML("Other","","<button>All Faith rhythms →</button>","faithPracticeTitle")`, groupContext);
  assert.equal((navHTML.match(/data-faith-select=/g) || []).length, 10);
  assert.match(navHTML, /data-faith-select="Prayer" aria-pressed="true"/);
  assert.match(practiceHeadingHTML, /faith-practice-link-row[\s\S]*faith-practice-divider[\s\S]*faith-practice-heading[\s\S]*faithPracticeTitle/);
  assert.doesNotMatch(practiceHeadingHTML, /faith-practice-focus/);
  const faithRender = extractFunction("renderFaithPage");
  assert.ok(faithRender.includes('out+=faithSettingsHTML()+faithHealthHTML()+\'<div class="faith-views-content">\'+faithViewNavHTML();'));
  assert.match(faithSource, /var FAITH_MAIN_VIEWS=\["today","prayer","practices"\]/);
  assert.match(faithSource, /faithViewPanelHTML\("today",faithTodayHTML\(\)\)[\s\S]*faithViewPanelHTML\("prayer",faithPrayerRequestsHTML\(\)\)[\s\S]*faithViewPanelHTML\("practices",faithPracticeOverviewHTML\(selected\)\+\(faithShowAllRhythms\?faithAllRhythmsHTML\(\):faithPracticeContent\(selected\)\)\)/);
  assert.equal((faithRender.match(/faithPracticeOverviewHTML\(selected\)/g) || []).length, 1);
  assert.ok(faithRender.indexOf("faithHealthHTML()") < faithRender.indexOf("faithViewNavHTML()"));
  assert.ok(faithRender.indexOf("faithViewNavHTML()") < faithRender.indexOf('faithViewPanelHTML("practices"'));
  assert.doesNotMatch(faithSource, /faithViewPanelHTML\("notes"/);
  assert.doesNotMatch(faithSource, /faith-practice-detail-sheet|data-faith-practice-sheet/);
  assert.match(faithSource, /faith-settings-notes[\s\S]*faithNotesHTML\(\)/);
  assert.match(faithSource, /tendRhythmCardHTML\(r/);
  assert.match(faithSource, /tendSparkCardHTML\(item/);

  const initialView = extractFunction("faithInitialMainView");
  for (const [legacy, expected] of [["requests", "prayer"], ["prayer", "prayer"], ["practices", "practices"], ["notes", "today"], ["rhythms", "today"], [undefined, "today"]]) {
    const config = { selectedGroup: "Witness", practiceTabs: legacy === undefined ? {} : { Witness: legacy } };
    const context = { FAITH_GROUPS: groupContext.FAITH_GROUPS, faithMainViewInitialized: false, faithMainView: "today", faithConfig: () => config };
    vm.createContext(context);
    vm.runInContext(`${initialView};faithInitialMainView("Witness")`, context);
    assert.equal(context.faithMainView, expected);
    assert.equal(config.selectedGroup, "Witness");
  }

  const selectedGroups = groupContext.FAITH_GROUPS;
  const practiceContext = {
    FAITH_GROUPS: selectedGroups,
    config: { selectedGroup: "Sabbath" },
    faithMainView: "today",
    faithMainViewInitialized: false,
    faithShowAllRhythms: false,
    tendPendingFaithScrollAnchor: {},
    faithConfig: () => practiceContext.config,
    render() {},
    requestAnimationFrame(callback) { callback(); },
    document: { getElementById: id => ({ id }) },
    faithScrollToHeading: target => { practiceContext.scrolledTo = target.id; }
  };
  vm.createContext(practiceContext);
  vm.runInContext(extractFunction("faithShowPracticeView"), practiceContext);
  for (const group of selectedGroups) {
    practiceContext.scrolledTo = null;
    vm.runInContext(`faithShowPracticeView(false, ${JSON.stringify(group)})`, practiceContext);
    assert.equal(practiceContext.config.selectedGroup, group);
    assert.equal(practiceContext.faithMainView, "practices");
    assert.equal(practiceContext.faithShowAllRhythms, false);
    assert.equal(practiceContext.scrolledTo, "faithPracticeTitle");
  }
  vm.runInContext('faithShowPracticeView(true, null, "faithAllRhythmsTitle")', practiceContext);
  assert.equal(practiceContext.faithMainView, "practices");
  assert.equal(practiceContext.faithShowAllRhythms, true);
  assert.equal(practiceContext.scrolledTo, "faithAllRhythmsTitle");
  practiceContext.config.selectedGroup = "Fasting";
  practiceContext.config.practiceTabs = { Fasting: "sparks" };
  vm.runInContext('faithShowPracticeView(false, "Fasting")', practiceContext);
  vm.runInContext('faithShowPracticeView(true, null, "faithAllRhythmsTitle")', practiceContext);
  vm.runInContext('faithShowPracticeView(false, null, "faithPracticeTitle")', practiceContext);
  assert.equal(practiceContext.config.selectedGroup, "Fasting");
  assert.equal(practiceContext.config.practiceTabs.Fasting, "sparks");
  assert.equal(practiceContext.faithShowAllRhythms, false);
  assert.match(styles, /\.faith-practice-heading \.faith-selected-practice-title\{[^}]*scroll-margin-top:160px/);
  assert.match(styles, /@media\(max-width:600px\)\{[\s\S]*?\.faith-section-nav\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:540px\)\{\.faith-practice-tabs button\{min-width:0;white-space:normal\}\}/);
  assert.doesNotMatch(homeRhythmSource, /faithConfig\(\)\.selectedGroup="Sabbath"/);
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

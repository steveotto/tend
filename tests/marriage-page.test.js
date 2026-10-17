"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-categoryrhythms.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "tend.css"), "utf8");
const iconManifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets", "tend-marriage-icons", "icons.json"), "utf8"));

function createContext(state = {}) {
  const windowListeners = {};
  let currentDate = "2026-10-16";
  let saves = 0;
  let renders = 0;
  const flashes = [];
  const focused = [];
  const scrolled = [];
  const focusNodes = new Map();
  function focusNode(selector) {
    if (!focusNodes.has(selector)) focusNodes.set(selector, { focus() { focused.push(selector); }, scrollIntoView() { scrolled.push(selector); } });
    return focusNodes.get(selector);
  }
  const tabs = ["today", "rhythms", "foundations"].map(id => ({
    id,
    getAttribute(name) {
      return name === "data-marriage-tab" ? id : null;
    },
    focus() {},
    click() {
      const event = {
        target: { closest(selector) { return selector.includes("data-marriage-tab") ? thisTab : null; } },
        preventDefault() {},
        stopImmediatePropagation() {}
      };
      const thisTab = tabs.find(tab => tab.id === id);
      windowListeners.click.forEach(listener => listener(event));
    }
  }));
  const document = {
    createElement() { return { textContent: "" }; },
    head: { appendChild() {} },
    querySelector(selector) {
      const match = selector.match(/data-marriage-tab="([^"]+)"/);
      if (match) return tabs.find(tab => tab.id === match[1]);
      if (selector.includes("data-marriage-suggestions-open") || selector.includes("data-marriage-suggestion-add") || selector.includes("data-marriage-template-unlink") || selector.includes("data-marriage-link-select") || selector.includes("data-marriage-link-confirm") || selector.includes("data-marriage-health-nav")) return focusNode(selector);
      return null;
    },
    querySelectorAll(selector) {
      return selector.includes("data-marriage-tab") ? tabs : [];
    },
    getElementById(id) { return ["marriage-rhythm-suggestions-title", "marriage-link-panel-title", "marriage-rhythms-heading", "marriage-foundations-heading", "marriage-prayer-heading", "marriage-rhythm-detail-title", "marriage-custom-rhythm-title"].includes(id) ? focusNode(`#${id}`) : null; }
  };
  const window = {
    ensureShape(value) {
      if (!Array.isArray(value.people)) value.people = [];
      if (!Array.isArray(value.areaRhythms)) value.areaRhythms = [];
      if (!Array.isArray(value.prayers)) value.prayers = [];
      if (!Array.isArray(value.tasks)) value.tasks = [];
      if (!Array.isArray(value.events)) value.events = [];
      if (!value.marriageRhythmTemplateLinks) value.marriageRhythmTemplateLinks = {};
      return value;
    },
    renderArea() { return ""; },
    areaScore() { return 72; },
    displayAreaScore() { return 72; },
    personRhythmScheduleHTML() { return ""; },
    tendRenderAreaSections() {
      return { health: "<header>Marriage health meter</header>", tasks: "<section>Marriage tasks</section>", activity: "<section>Activity log</section>", history: "<section>Marriage history</section>" };
    },
    rhythmRow(person, record, options = {}) { return `<article class="test-person-rhythm">${options.leadingHTML || ""}<strong>${record.text || ""}</strong><p>${record.description || ""}</p>Person rhythm ${record.id}${options.historyAttributes ? `<button data-rhyhistory="${options.historyAttributes["data-rhyhistory"]}" data-marriage-history="${options.historyAttributes["data-marriage-history"]}">History score</button>` : ""}${options.detailsAttributes ? `<button data-marriage-custom-rhythm="${record.id}">Details</button>` : ""}</article>`; },
    tendRhythmCardMetadata() { return {}; },
    prayerList(prayers) { return `<div>Prayers ${prayers.map(prayer => prayer.id).join(",")}</div>`; },
    tendCategoryBadges() { return '<span class="rhythm-area-badges"><span>Marriage</span></span>'; },
    tendScoreBreakdownHTML(items) {
      return '<div class="health-summary-breakdown">' + items.map(item => `<button type="button" class="health-summary-item is-action" ${Object.entries(item.actionAttributes || {}).map(([name, value]) => `${name}="${value}"`).join(" ")} aria-label="${item.ariaLabel}"><span class="health-summary-score">${Number.isFinite(item.score) ? item.score : "—"}</span><span class="health-summary-label">${item.label} ›</span><span class="health-summary-detail">${item.detailHTML}</span></button>`).join("") + "</div>";
    },
    tendAssociationPeopleBadges() { return ""; },
    tendAssociationCategoryBadges() { return ""; },
    tendSearchMatches() { return { rhythms: [] }; },
    tendPersonRelationshipGroup(person) {
      return /^(spouse|wife|husband|partner)$/i.test(String(person && person.relation || "")) ? "marriage" : "";
    },
    addEventListener(name, listener) {
      (windowListeners[name] || (windowListeners[name] = [])).push(listener);
    }
  };
  const context = {
    S: Object.assign({ people: [], areaRhythms: [], prayers: [], tasks: [], events: [], settings: {}, areas: { marriage: { name: "Marriage" } } }, state),
    window,
    document,
    currentArea: "marriage",
    AREA_ICONS: {},
    TODS: { evening: "Evening" },
    esc(value) { return String(value == null ? "" : value); },
    areaIds(record) { return Array.isArray(record.areas) ? record.areas : []; },
    rhythmEnded(record) { return !!record.ended; },
    recNormRule(record) { return record.rule ? Object.assign({}, record.rule) : { freq: record.freq || "weekly", weekdays: record.weekdays || [5], start: record.start || record.added || null, unit: record.unit, every: record.every, dom: record.dayOfMonth || 1, month: Number(record.qmonth || record.month || 1) - 1 }; },
    recOccursOn(rule, date) {
      const day = new Date(`${date}T12:00:00`);
      if (rule.start && date < rule.start) return false;
      if (rule.freq === "daily") return true;
      if (rule.freq === "weekly") return (rule.weekdays || [5]).includes(day.getDay());
      if (rule.freq === "monthly") return day.getDate() === rule.dom;
      if (rule.freq === "quarterly") return day.getDate() === rule.dom && day.getMonth() % 3 === rule.month;
      if (rule.freq === "yearly") return day.getMonth() === rule.month && (rule.mode === "weekday" ? day.getDay() === rule.dow && Math.floor((day.getDate() - 1) / 7) + 1 === (rule.weeks || [1])[0] : day.getDate() === rule.dom);
      return false;
    },
    todayRhythmEligible(record) { return !!record.due; },
    rhythmScore(record) { return Number.isFinite(record.score) ? record.score : 72; },
    rhythmLast(record) {
      const events = state.events || [];
      return events.filter(event => event.rhythmId === record.id).sort((a, b) => Number(b.ts) - Number(a.ts))[0] || null;
    },
    prayerScore(prayer) { return Number.isFinite(prayer.score) ? prayer.score : null; },
    prayerLogsFor(prayer) { return Array.isArray(prayer.prayerLogs) ? prayer.prayerLogs : []; },
    prayerLastPrayedLabel(prayer) { return prayer.prayerLogs && prayer.prayerLogs.length ? "today" : "not yet prayed"; },
    when(ts) { return Number.isFinite(Number(ts)) ? "Oct 16, 2026" : "Never"; },
    personRhythms(person) { return (person.rhythms || []).filter(record => !record.ended); },
    personScore(person) { return Object.prototype.hasOwnProperty.call(person, "healthScore") ? person.healthScore : 72; },
    connectionScore() { return 64; },
    prayerMeterScore() { return null; },
    personAvatar(person, size) { return person.photo ? `<img class="avatar" src="${person.photo}" width="${size}" alt="">` : `<span class="avatar-fallback" data-size="${size}">${person.initials || person.id}</span>`; },
    scoreClass() { return "good"; },
    avg(values) {
      const scores = values.filter(Number.isFinite);
      return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
    },
    todayStr() { return currentDate; },
    save() { saves += 1; },
    requestAnimationFrame(callback) { callback(); },
    render() { renders += 1; },
    uid() { return "daily-generated"; },
    flash(message) { flashes.push(message); },
    tendRhythmOrderToolbar(_context, count) { return count > 1 ? '<div class="arrange">Arrange</div>' : ""; },
    tendRhythmOrderSort(_context, rows) { return rows; },
    tendRhythmOrderListAttributes() { return ""; },
    tendRhythmOrderItemHTML(_context, _list, _id, _title, _index, _count, html) { return html; },
    tendRhythmCardHTML(record, options = {}) { return `<article class="test-area-rhythm">${options.leadingHTML || ""}<strong>${record.text || ""}</strong><p>${record.description || ""}</p>Area rhythm ${record.id}${options.detailsAttributes ? `<button data-marriage-custom-rhythm="${record.id}">Details</button>` : ""}${options.tendAttributes ? `<button data-marriage-suggestion-add="${options.tendAttributes["data-marriage-suggestion-add"]}">${options.actionLabel || "Tend"}</button>` : ""}</article>`; },
    tendRhythmCardMetadata() { return {}; },
    planRhythmCardHTML(item) { return `<article class="compact-today">Today ${item.rhythm || item.areaRhythm}</article>`; },
    tendSparkCardHTML(spark) { return `<article>Spark ${spark.id}</article>`; },
    tendAssociationCategoryBadges() { return ""; },
    tendCategoryBadges() { return ""; },
    tendPrayerCardContentHTML() { return ""; },
    tendScoreBreakdownHTML(items) { return window.tendScoreBreakdownHTML(items); },
    tendSectionHeaderHTML(options) { return `<header class="${options.className}"><h2>${options.title}</h2><span class="hint">${options.subtitle}</span>${options.trailingHTML || ""}</header>`; },
    tendCategoryPageHeaderHTML(title, className) { return `<header class="category-page-heading ${className}"><h2>${title}</h2><span>Structure beats good intentions</span></header>`; },
    tendCategoryHealthSummaryHTML(options) { return `<section class="card category-health-card ${options.className || ""}"><h3>${options.title}</h3><strong>${Number.isFinite(options.score) ? options.score : "—"}</strong><p>${options.status}</p>${options.breakdownHTML || options.contentHTML || ""}</section>`; },
    scoreLabel() { return "Healthy"; },
    tendCaptureRhythmEditOrigin() {},
    tendFinishRhythmEdit() { return false; },
    faithScrollToHeading(target) { target.focus({ preventScroll: true }); target.scrollIntoView(); },
    document
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context,
    windowListeners,
    tabs,
    setToday(value) { currentDate = value; },
    get saves() { return saves; },
    get renders() { return renders; },
    get flashes() { return flashes.slice(); },
    get focused() { return focused.slice(); },
    get scrolled() { return scrolled.slice(); }
  };
}

function clickMarriageAction(windowListeners, attribute, dialog = null, value = null) {
  const action = {
    hasAttribute(name) { return name === attribute; },
    getAttribute(name) { return name === attribute ? value : null; },
    closest(selector) {
      if (selector === "dialog" || selector === "[data-area-rhythm-form]" || selector === ".marriage-link-review") return dialog;
      return new RegExp("\\[" + attribute + "(?:\\]|=)").test(selector) ? action : null;
    }
  };
  const listener = windowListeners.click.find(candidate => candidate.toString().includes("data-marriage-open-people"));
  assert.ok(listener, "Marriage click handler is installed");
  listener({
    target: { closest(selector) { return new RegExp("\\[" + attribute + "(?:\\]|=)").test(selector) ? action : null; } },
    preventDefault() {},
    stopImmediatePropagation() {}
  });
}

function changeMarriageSetting(windowListeners, attribute, value) {
  const listener = windowListeners.change.find(candidate => candidate.toString().includes(attribute));
  assert.ok(listener, `${attribute} change handler is installed`);
  listener({
    target: {
      value,
      matches(selector) { return selector.includes(attribute); }
    }
  });
}

function dailyConnectionState(overrides = {}) {
  const spouse = { id: "partner", name: "Partner", relation: "Spouse", rhythms: [] };
  return Object.assign({
    people: [spouse],
    areaRhythms: [],
    settings: { marriageSpouseId: spouse.id },
    events: []
  }, overrides);
}

test("Marriage page keeps categorized content and shared activity sections in three accessible tabs", () => {
  const { context } = createContext({
    people: [{
      id: "partner",
      name: "Partner",
      relation: "Spouse",
      area: "marriage",
      rhythms: [
        { id: "shared-marriage", text: "Walk together", areas: ["marriage"], due: true },
        { id: "other-category", text: "Other practice", areas: ["parenting"], due: true }
      ],
      sparks: [
        { id: "marriage-spark", text: "Cook together", areas: ["marriage"] },
        { id: "completed-marriage-spark", text: "Past date night", areas: ["marriage"], done: true, doneTs: 1792200000000 },
        { id: "parenting-spark", text: "School project", areas: ["parenting"] }
      ]
    }],
    areaRhythms: [
      { id: "marriage-owned", text: "Check in", areas: ["marriage"], due: true },
      { id: "unrelated", text: "Unrelated", areas: ["friendships"], due: true }
    ],
    prayers: [
      { id: "legacy-marriage-prayer", category: "Marriage" },
      { id: "marriage-area-prayer", areas: ["marriage"] },
      { id: "faith-prayer", category: "Faith" }
    ],
    events: [{ id: "marriage-event", rhythmId: "shared-marriage", ts: new Date(2026, 9, 16, 12).getTime() }]
  });

  const html = context.window.renderArea("marriage");
  assert.match(html, /Overall Marriage health/);
  assert.match(html, /How Marriage scores work/);
  assert.match(html, /Rhythm Score<\/dt><dd>How consistently am I maintaining this commitment, accounting for how overdue I am and how I have followed through/);
  assert.match(html, /Foundation Score<\/dt><dd>A frequency-weighted score for the active Rhythms associated with this Foundation, including primary and secondary associations/);
  assert.match(html, /Marriage Health<\/dt><dd>The average of the scored Foundation scores/);
  assert.match(html, /Foundations without eligible Rhythm data remain unscored and are excluded from the average/);
  assert.match(html, /Marriage<\/h2><span class="hint">Structure beats good intentions\./);
  assert.match(html, /<h3>Overall Marriage health<\/h3><strong>—<\/strong>/);
  assert.match(html, /data-marriage-health-nav="rhythms"/);
  assert.match(html, /data-marriage-health-nav="foundations"/);
  assert.match(html, /health-summary-breakdown/);
  assert.doesNotMatch(html, /Overall Marriage health[^<]*72%/);
  assert.ok(html.indexOf("marriage-spouse-shortcut") < html.indexOf("Overall Marriage health"));
  assert.match(html, /<header class="category-page-heading marriage-page-heading"><h2>Marriage<\/h2><span class="hint">Structure beats good intentions\.<\/span><button type="button" class="marriage-spouse-shortcut" data-openperson="partner" aria-label="View Partner's profile">/);
  assert.doesNotMatch(html, /marriage-spouse-card|Relationship health|Shown separately|Not included in Marriage health/);
  assert.match(html, /Today together/);
  assert.match(html, /Today partner\|shared-marriage/);
  assert.match(html, /Today marriage-owned/);
  assert.doesNotMatch(html, /Today partner\|other-category|Today unrelated/);
  assert.match(html, /id="marriage-tab-today"[^>]*aria-selected="true"/);
  assert.match(html, /role="tablist" aria-label="Marriage content"/);
  assert.match(html, /Marriage tasks/);
  assert.match(html, /Activity log/);
  assert.match(html, /Marriage history/);
  assert.match(html, /Spark marriage-spark/);
  assert.doesNotMatch(html, /Spark parenting-spark/);
  assert.match(html, /Completed Sparks \(1\)/);
  assert.match(html, /Past date night/);
  assert.doesNotMatch(html, /Arrange/);
  assert.match(html, /Prayers legacy-marriage-prayer,marriage-area-prayer/);
  assert.match(html, /Prayer requests connected to Marriage or Partner/);
  assert.doesNotMatch(html, /faith-prayer/);
  for (const id of ["today", "rhythms", "foundations"]) {
    assert.match(html, new RegExp(`id="marriage-tab-${id}"[^>]*aria-controls="marriage-panel-${id}"`));
    assert.match(html, new RegExp(`id="marriage-panel-${id}"[^>]*aria-labelledby="marriage-tab-${id}"`));
  }
});

test("Marriage health summaries use active Marriage rhythms and preserve prayer scope without scoring unrelated prayers", () => {
  const events = [{ rhythmId: "marriage-active", ts: new Date(2026, 9, 16, 12).getTime() }];
  const { context } = createContext({
    people: [{
      id: "partner",
      name: "Partner",
      relation: "Spouse",
      rhythms: [
        { id: "marriage-active", sourceTemplateId: "marriage.date-night", freq: "weekly", weekdays: [5], areas: ["marriage"] },
        { id: "marriage-disabled", score: 10, disabled: true, areas: ["marriage"] },
        { id: "not-marriage", score: 1, areas: ["faith"] }
      ]
    }],
    settings: { marriageSpouseId: "partner" },
    areaRhythms: [{ id: "daily", sourceTemplateId: "marriage.pray-together", freq: "daily", areas: ["marriage"] }],
    prayers: [
      { id: "marriage-prayer", category: "Marriage", score: 40, prayerLogs: [Date.now()] },
      { id: "spouse-prayer", personId: "partner", score: 20 },
      { id: "shared-spouse-prayer", personId: "other", sharedWith: ["partner"], score: 30 },
      { id: "unrelated-prayer", category: "Faith", personId: "other", score: 100 }
    ],
    events
  });

  const html = context.window.renderArea("marriage");
  assert.match(html, /Rhythms ›/);
  assert.match(html, /2 active ·/);
  assert.match(html, /3 of 6 scored/);
  assert.match(html, /Prayers marriage-prayer,spouse-prayer,shared-spouse-prayer/);
  assert.doesNotMatch(html, /unrelated-prayer/);
  assert.doesNotMatch(html, /Prayer[^<]*health score/);
  assert.doesNotMatch(html, /faith-prayer|unrelated-prayer/);
});

test("Marriage health summary reports unavailable scores for empty data and navigates through existing tabs", () => {
  const testContext = createContext();
  const { context, windowListeners } = testContext;
  const html = context.window.renderArea("marriage");
  assert.match(html, /0 of 6 Marriage foundations scored/);
  assert.match(html, /0 active/);

  clickMarriageAction(windowListeners, "data-marriage-health-nav", null, "foundations");
  assert.equal(context.window.renderArea("marriage").includes('id="marriage-tab-foundations" aria-controls="marriage-panel-foundations" aria-selected="true"'), true);
  assert.deepEqual(testContext.scrolled, ["#marriage-foundations-heading"]);

  clickMarriageAction(windowListeners, "data-marriage-health-nav", null, "rhythms");
  assert.equal(context.window.renderArea("marriage").includes('id="marriage-tab-rhythms" aria-controls="marriage-panel-rhythms" aria-selected="true"'), true);
  assert.deepEqual(testContext.scrolled, ["#marriage-foundations-heading", "#marriage-rhythms-heading"]);
});

test("Marriage omits an empty Today list and offers the suggestion catalog when no active rhythms exist", () => {
  const testContext = createContext({
    people: [{ id: "partner", rhythms: [{ id: "not-marriage", areas: ["parenting"], due: true }] }],
    areaRhythms: []
  });
  const { context, windowListeners } = testContext;
  const html = context.window.renderArea("marriage");

  assert.doesNotMatch(html, /Today together/);
  assert.match(html, /Start with a shared practice/);
  assert.match(html, />Explore suggested rhythms</);
  assert.match(html, /marriage\.date-night/);
  clickMarriageAction(windowListeners, "data-marriage-explore-empty");
  assert.match(context.window.renderArea("marriage"), /id="marriage-tab-rhythms"[^>]*aria-selected="true"/);
  assert.deepEqual(testContext.scrolled, ["#marriage-rhythms-heading"]);
});

test("Marriage tabs respond to activation and arrow-key navigation while preserving selection", () => {
  const { context, windowListeners, tabs } = createContext();
  const activate = id => {
    const tab = tabs.find(item => item.id === id);
    const event = {
      target: { closest(selector) { return selector.includes("data-marriage-tab") ? tab : null; } },
      preventDefault() {},
      stopImmediatePropagation() {}
    };
    windowListeners.click[0](event);
  };
  activate("rhythms");
  assert.match(context.window.renderArea("marriage"), /id="marriage-tab-rhythms"[^>]*aria-selected="true"/);

  const rhythmsTab = tabs.find(item => item.id === "rhythms");
  windowListeners.keydown[0]({
    target: { closest(selector) { return selector.includes("data-marriage-tab") ? rhythmsTab : null; } },
    key: "ArrowRight",
    preventDefault() {}
  });
  assert.match(context.window.renderArea("marriage"), /id="marriage-tab-foundations"[^>]*aria-selected="true"/);
});

test("all Marriage Foundation and Rhythm icons use the mapped theme-aware SVG assets", () => {
  const { context, windowListeners } = createContext();
  const foundations = Array.from(context.window.tendMarriageFoundations(), item => item.id);
  const rhythms = Array.from(context.window.tendMarriageSuggestionCatalog(), item => item.id.replace(/^marriage\./, ""));
  const mappedFoundations = iconManifest.filter(item => item.group === "foundations").map(item => item.id);
  const mappedRhythms = iconManifest.filter(item => item.group === "rhythms").map(item => item.id);

  assert.equal(iconManifest.length, 15);
  assert.deepEqual(mappedFoundations, foundations);
  assert.deepEqual(mappedRhythms.sort(), rhythms.sort());
  for (const icon of iconManifest) {
    const asset = path.join(__dirname, "..", "assets", "tend-marriage-icons", icon.path);
    assert.equal(icon.color, "currentColor");
    assert.match(fs.readFileSync(asset, "utf8"), /stroke="currentColor"/);
  }

  clickMarriageAction(windowListeners, "data-marriage-tab", null, "foundations");
  let html = context.window.renderArea("marriage");
  for (const icon of iconManifest.filter(item => item.group === "foundations")) {
    assert.match(html, new RegExp(`foundations/${icon.id}\\.svg\\?v=`));
  }
  clickMarriageAction(windowListeners, "data-marriage-foundation", null, "connection");
  assert.match(context.window.renderArea("marriage"), /foundations\/connection\.svg\?v=/);
  clickMarriageAction(windowListeners, "data-marriage-tab", null, "rhythms");
  html = context.window.renderArea("marriage");
  for (const icon of iconManifest.filter(item => item.group === "rhythms")) {
    assert.match(html, new RegExp(`rhythms/${icon.id}\\.svg\\?v=`));
  }
  clickMarriageAction(windowListeners, "data-marriage-rhythm-details", null, "marriage.daily-connection");
  assert.match(context.window.renderArea("marriage"), /rhythms\/daily-connection\.svg\?v=/);
  assert.match(styles, /background:currentColor;-webkit-mask:var\(--marriage-icon-mask\)/);
  assert.match(styles, /background:color-mix\(in srgb,var\(--forest\) 8%,var\(--canvas\)\)/);
});

test("Marriage Rhythm details keep one shared card, icon, and clickable Foundation section", () => {
  const record = {
    id: "date-night",
    text: "Date Night",
    description: "Our own date-night description.",
    sourceTemplateId: "marriage.date-night",
    marriagePrimaryFoundation: "fun-adventure",
    marriageSecondaryFoundations: ["connection"],
    areas: ["marriage"],
    freq: "weekly",
    weekdays: [5],
    added: "2026-10-01"
  };
  const { context, windowListeners } = createContext({
    people: [{ id: "partner", name: "Partner", relation: "Spouse", rhythms: [record] }],
    settings: { marriageSpouseId: "partner" }
  });

  clickMarriageAction(windowListeners, "data-marriage-rhythm-details", null, "marriage.date-night");
  const html = context.window.renderArea("marriage");
  assert.match(html, /‹ All Rhythms/);
  assert.match(html, /marriage-detail-rhythm-icon/);
  assert.match(html, /data-rhyhistory="partner\|date-night" data-marriage-history="partner\|date-night"/);
  assert.match(html, /class="marriage-foundation-badge" data-marriage-foundation="fun-adventure"/);
  assert.match(html, /class="marriage-foundation-badge" data-marriage-foundation="connection"/);
  assert.equal((html.match(/Our own date-night description\./g) || []).length, 1);
  assert.doesNotMatch(html, /marriage-detail-heading|This Rhythm is active|Consistency uses|Consistency:|Also supports/);
  assert.match(html, /data-rhyhistory="partner\|date-night" data-marriage-history="partner\|date-night">History &amp; Consistency/);

  clickMarriageAction(windowListeners, "data-marriage-foundation", null, "fun-adventure");
  assert.match(context.window.renderArea("marriage"), /id="marriage-foundation-detail-title"[^>]*>Fun & Adventure/);
});

test("unadded Marriage recommendation details show an Add card and no active Rhythm card", () => {
  const { context, windowListeners } = createContext();
  clickMarriageAction(windowListeners, "data-marriage-rhythm-details", null, "marriage.date-night");
  const html = context.window.renderArea("marriage");

  assert.match(html, /marriage-detail-rhythm-icon/);
  assert.match(html, /<strong>Date Night<\/strong>/);
  assert.match(html, /Enjoy intentional time together beyond responsibilities and logistics\./);
  assert.match(html, /data-marriage-suggestion-add="marriage\.date-night">Add<\/button>/);
  assert.doesNotMatch(html, /data-rhyhistory|View history|data-area-rhythm-edit|data-rhyedit/);
  assert.match(html, /Primary/);
  assert.match(html, /Fun & Adventure/);
  assert.match(html, /Connection/);
});

test("custom Marriage Rhythms open details and omit unassigned Foundation rows", () => {
  const record = { id: "custom-check-in", text: "Our check-in", description: "Talk on Sundays.", areas: ["marriage"], freq: "weekly" };
  const { context, windowListeners } = createContext({ areaRhythms: [record] });
  const list = context.window.renderArea("marriage");
  assert.match(list, /data-marriage-custom-rhythm="custom-check-in">Details/);

  clickMarriageAction(windowListeners, "data-marriage-custom-rhythm", null, "custom-check-in");
  const detail = context.window.renderArea("marriage");
  assert.match(detail, /‹ All Rhythms/);
  assert.match(detail, /Our check-in/);
  assert.match(detail, /Talk on Sundays\./);
  assert.match(detail, /History &amp; Consistency/);
  assert.doesNotMatch(detail, /marriage-detail-foundations|Primary|Secondary/);
});

test("historical Date Night records are linked without moving events or changing their schedule", () => {
  const historical = {
    id: "date-night-original",
    text: "Date night",
    areas: ["marriage"],
    freq: "weekly",
    weekdays: [5],
    added: "2026-10-03",
    personId: "amy",
    personal: true,
    notes: "Keep this metadata."
  };
  const emptyTemplateCopy = {
    id: "date-night-template-copy",
    text: "Date Night",
    sourceTemplateId: "marriage.date-night",
    marriagePrimaryFoundation: "fun-adventure",
    marriageSecondaryFoundations: ["connection"],
    areas: ["marriage"],
    freq: "weekly",
    weekdays: [5],
    added: "2026-10-03",
    personId: "amy"
  };
  const completions = [
    { id: "date-night-event-1", rhythmId: historical.id, ts: new Date(2026, 8, 25, 17).getTime(), note: "First" },
    { id: "date-night-event-2", rhythmId: historical.id, ts: new Date(2026, 9, 2, 17).getTime(), note: "Second" },
    { id: "date-night-event-3", rhythmId: historical.id, ts: new Date(2026, 9, 9, 17).getTime(), note: "Third" }
  ];
  const testContext = createContext({
    people: [{ id: "amy", name: "Amy", relation: "Spouse", rhythms: [historical, emptyTemplateCopy] }],
    settings: { marriageSpouseId: "amy" },
    events: completions,
    marriageRhythmTemplateLinks: { "marriage.date-night": emptyTemplateCopy.id }
  });
  const { context } = testContext;
  const scores = context.window.tendMarriageFoundationScores();
  const fun = scores.foundations.find(item => item.id === "fun-adventure");
  const connection = scores.foundations.find(item => item.id === "connection");

  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.date-night"], historical.id);
  assert.equal(historical.sourceTemplateId, "marriage.date-night");
  assert.equal(historical.marriagePrimaryFoundation, "fun-adventure");
  assert.deepEqual(Array.from(historical.marriageSecondaryFoundations), ["connection"]);
  assert.deepEqual(Array.from(historical.areas), ["marriage"]);
  assert.equal(historical.freq, "weekly");
  assert.deepEqual(Array.from(historical.weekdays), [5]);
  assert.equal(historical.added, "2026-10-03");
  assert.equal(historical.personId, "amy");
  assert.equal(historical.personal, true);
  assert.equal(historical.notes, "Keep this metadata.");
  assert.equal(emptyTemplateCopy.marriageDuplicateOf, historical.id);
  assert.equal(emptyTemplateCopy.sourceTemplateId, undefined);
  assert.deepEqual(context.S.events, completions);
  assert.equal(context.S.events.length, 3);
  assert.equal(fun.score, 90);
  assert.equal(fun.eligibleRhythms[0].consistency.completed, 3);
  assert.equal(fun.eligibleRhythms[0].consistency.expected, 3);
  assert.equal(fun.eligibleRhythms[0].consistency.score, 100);
  assert.equal(connection.score, 90);
  assert.equal(testContext.saves, 1);

  const html = context.window.renderArea("marriage");
  assert.doesNotMatch(html, /Person rhythm date-night-template-copy/);
  assert.match(html, /data-marriage-rhythm-details="marriage\.date-night">Details/);
});

test("three completed Friday evenings score fully and today's Friday is not overdue", () => {
  const rhythm = { id: "date-night", text: "Date Night", areas: ["marriage"], freq: "weekly", weekdays: [5], added: "2026-09-25", marriagePrimaryFoundation: "fun-adventure" };
  const events = ["2026-09-25T20:00:00", "2026-10-02T20:00:00", "2026-10-09T20:00:00"].map((date, index) => ({
    id: "date-" + index, rhythmId: rhythm.id, ts: new Date(date).getTime(), completionNote: index === 0 ? "Dinner together" : undefined
  }));
  const { context } = createContext({ areaRhythms: [rhythm], events });
  const score = context.window.tendMarriageRhythmConsistency(rhythm);

  assert.equal(score.window.label, "Last 12 weeks");
  assert.equal(score.consistency, 100);
  assert.equal(score.score, 100);
  assert.equal(score.expected, 3);
  assert.equal(score.completed, 3);
  assert.equal(score.missed, 0);
  assert.equal(score.overdueAdjustment, 0);
  assert.equal(events[0].completionNote, "Dinner together");
});

test("Date Night includes its three completed Fridays but excludes tonight until due", () => {
  const rhythm = { id: "date-night", text: "Date Night", areas: ["marriage"], freq: "weekly", weekdays: [5], added: "2026-10-03", marriagePrimaryFoundation: "fun-adventure" };
  const events = ["2026-09-25T20:00:00", "2026-10-02T20:00:00", "2026-10-09T20:00:00"].map((date, index) => ({
    id: "date-" + index, rhythmId: rhythm.id, ts: new Date(date).getTime()
  }));
  const { context } = createContext({ areaRhythms: [rhythm], events });
  const score = context.window.tendMarriageRhythmConsistency(rhythm);

  assert.equal(score.score, 100);
  assert.equal(score.consistency, 100);
  assert.equal(score.expected, 3);
  assert.equal(score.completed, 3);
  assert.equal(score.missed, 0);
  assert.equal(score.overdueAdjustment, 0);
  assert.equal(events.length, 3, "scoring must retain all historical completions");
});

test("pre-activation yearly completion counts for its next-day scheduled occurrence", () => {
  const rhythm = {
    id: "yearly-getaway",
    text: "Yearly Week Long Getaway",
    areas: ["marriage"],
    freq: "yearly",
    added: "2026-10-03",
    rule: { freq: "yearly", start: "2026-10-03", month: 5, mode: "weekday", weeks: [2], dow: 6 }
  };
  const events = [{ id: "june-getaway", rhythmId: rhythm.id, ts: new Date(2026, 5, 12, 17, 22).getTime() }];
  const { context } = createContext({ areaRhythms: [rhythm], events });
  const score = context.window.tendMarriageRhythmConsistency(rhythm);

  assert.equal(score.score, 100);
  assert.equal(score.expected, 1);
  assert.equal(score.completed, 1);
  assert.equal(score.missed, 0);
  assert.ok(score.occurrences.some(item => item.date === "2026-06-13" && item.status === "completed"));
  assert.equal(events[0].ts, new Date(2026, 5, 12, 17, 22).getTime(), "the historical event timestamp must stay unchanged");
});

test("overdue Marriage Rhythms count missed occurrences and keep the miss streak adjustment", () => {
  const rhythm = { id: "date-night", text: "Date Night", areas: ["marriage"], freq: "weekly", weekdays: [5], added: "2026-09-25", marriagePrimaryFoundation: "fun-adventure" };
  const events = ["2026-09-25T20:00:00", "2026-10-02T20:00:00"].map((date, index) => ({ id: "date-" + index, rhythmId: rhythm.id, ts: new Date(date).getTime() }));
  const { context } = createContext({ areaRhythms: [rhythm], events });
  const score = context.window.tendMarriageRhythmConsistency(rhythm);

  assert.equal(score.expected, 3);
  assert.equal(score.completed, 2);
  assert.equal(score.missed, 1);
  assert.equal(score.consistency, 200 / 3);
  assert.equal(score.overdueDate, "2026-10-09");
  assert.equal(score.overdueAdjustment, 10);
  assert.equal(score.score, 200 / 3 - 10);

  const continuing = createContext({ areaRhythms: [rhythm], events });
  continuing.setToday("2026-10-17");
  const continuedScore = continuing.context.window.tendMarriageRhythmConsistency(rhythm);
  assert.equal(continuedScore.expected, 4);
  assert.equal(continuedScore.completed, 2);
  assert.equal(continuedScore.missed, 2);
  assert.equal(continuedScore.overdueDate, "2026-10-09");
  assert.equal(continuedScore.overdueAdjustment, 10, "the overdue streak must not reset on another missed scheduled day");
});

test("overdue adjustment uses recurrence cadence and caps at 30 points", () => {
  const cases = [
    { rhythm: { id: "daily", freq: "daily", added: "2026-10-01" }, today: "2026-10-16", adjustment: 30, expected: 15 },
    { rhythm: { id: "monthly", freq: "monthly", dayOfMonth: 1, added: "2026-10-01" }, today: "2026-12-02", adjustment: 20, expected: 3 },
    { rhythm: { id: "quarterly", freq: "quarterly", qmonth: 1, dayOfMonth: 1, added: "2026-01-01" }, today: "2026-10-16", adjustment: 30, expected: 4 },
    { rhythm: { id: "yearly", freq: "yearly", month: 10, dayOfMonth: 1, added: "2024-10-01" }, today: "2026-10-16", adjustment: 10, expected: 2 }
  ];

  for (const item of cases) {
    const { context, setToday } = createContext({ areaRhythms: [Object.assign({ areas: ["marriage"] }, item.rhythm)] });
    setToday(item.today);
    const score = context.window.tendMarriageRhythmConsistency(item.rhythm);
    assert.equal(score.overdueAdjustment, item.adjustment, item.rhythm.freq);
    assert.equal(score.expected, item.expected, item.rhythm.freq);
    assert.equal(score.missed, item.expected, item.rhythm.freq);
  }
});

test("a Daily Rhythm with one recent Tend remains low-scoring", () => {
  const rhythm = { id: "daily", text: "Daily Connection", areas: ["marriage"], freq: "daily", added: "2026-07-01", marriagePrimaryFoundation: "connection" };
  const events = [{ id: "today", rhythmId: rhythm.id, ts: new Date("2026-10-16T19:00:00").getTime(), completionNote: "We talked" }];
  const { context } = createContext({ areaRhythms: [rhythm], events });
  const before = JSON.stringify(events);
  const score = context.window.tendMarriageRhythmConsistency(rhythm);

  assert.equal(score.window.label, "Last 30 days");
  assert.ok(score.score < 10, "a single Tend must not restore consistency");
  assert.equal(score.expected, 30);
  assert.equal(score.completed, 1);
  assert.equal(score.missed, 29);
  assert.equal(score.overdueAdjustment, 0, "a completed current-day occurrence ends the overdue streak");
  assert.equal(JSON.stringify(events), before, "scoring must preserve completion timestamp and note");
});

test("a quarterly Rhythm with its next occurrence in the future is not overdue or scored", () => {
  const rhythm = { id: "quarterly", text: "Quarterly plans", areas: ["marriage"], freq: "quarterly", qmonth: 1, dayOfMonth: 1, added: "2026-10-03" };
  const { context } = createContext({ areaRhythms: [rhythm] });
  const score = context.window.tendMarriageRhythmConsistency(rhythm);

  assert.equal(score.score, null);
  assert.equal(score.expected, 0);
  assert.equal(score.overdueAdjustment, 0);
  assert.equal(score.eligible, false);
  assert.ok(score.occurrences.some(item => item.date === "2027-01-01" && item.status === "upcoming"));
});

test("Foundation momentum includes primary and secondary Rhythms with frequency weights", () => {
  const daily = { id: "daily", text: "Daily", areas: ["marriage"], freq: "daily", added: "2026-09-17", marriagePrimaryFoundation: "connection" };
  const weekly = { id: "weekly", text: "Date Night", areas: ["marriage"], freq: "weekly", weekdays: [5], added: "2026-09-25", marriagePrimaryFoundation: "fun-adventure", marriageSecondaryFoundations: ["connection"] };
  const quarterly = { id: "quarterly", text: "Overnight Away", areas: ["marriage"], freq: "quarterly", qmonth: 2, dayOfMonth: 1, added: "2026-01-01", marriagePrimaryFoundation: "fun-adventure", marriageSecondaryFoundations: ["connection"] };
  const events = [];
  for (let day = new Date("2026-09-17T12:00:00"); day <= new Date("2026-10-16T12:00:00"); day.setDate(day.getDate() + 1)) {
    events.push({ id: "daily-" + day.toISOString().slice(0, 10), rhythmId: daily.id, ts: new Date(day).setHours(19) });
  }
  for (const date of ["2026-09-25T20:00:00", "2026-10-02T20:00:00", "2026-10-09T20:00:00"]) events.push({ id: "weekly-" + date, rhythmId: weekly.id, ts: new Date(date).getTime() });
  const state = { areaRhythms: [daily, weekly, quarterly], events };
  const { context } = createContext(state);
  const scores = context.window.tendMarriageFoundationScores();
  const connection = scores.foundations.find(item => item.id === "connection");
  const contributionScores = connection.eligibleRhythms.map(item => [item.weight, item.consistency.score]);

  assert.deepEqual(Array.from(contributionScores.map(item => item[0]).sort()), [1, 3, 5]);
  assert.equal(connection.eligibleRhythms.length, 3);
  assert.equal(connection.weightedConsistency, (contributionScores[0][0] * contributionScores[0][1] + contributionScores[1][0] * contributionScores[1][1] + contributionScores[2][0] * contributionScores[2][1]) / 9);
  assert.equal(connection.score, connection.weightedConsistency);
  assert.equal(weekly.marriageSecondaryFoundations.includes("connection"), true);
  assert.ok(connection.eligibleRhythms.some(item => item.item.record.id === weekly.id), "secondary association contributes numerically");
});

test("Foundation breadth is 90 for one perfect Rhythm and 100 for two", () => {
  const one = { id: "one", text: "One", areas: ["marriage"], freq: "daily", added: "2026-10-01", marriagePrimaryFoundation: "connection" };
  const two = { id: "two", text: "Two", areas: ["marriage"], freq: "daily", added: "2026-10-01", marriagePrimaryFoundation: "connection" };
  const events = [];
  for (const rhythm of [one, two]) {
    for (let day = new Date("2026-10-01T12:00:00"); day <= new Date("2026-10-16T12:00:00"); day.setDate(day.getDate() + 1)) {
      events.push({ id: rhythm.id + "-" + day.toISOString().slice(0, 10), rhythmId: rhythm.id, ts: new Date(day).setHours(18) });
    }
  }
  const testContext = createContext({ areaRhythms: [one], events });
  let connection = testContext.context.window.tendMarriageFoundationScores().foundations.find(item => item.id === "connection");
  assert.equal(connection.score, 90);
  assert.equal(connection.breadthFactor, 0.9);
  testContext.context.S.areaRhythms.push(two);
  connection = testContext.context.window.tendMarriageFoundationScores().foundations.find(item => item.id === "connection");
  assert.equal(connection.score, 100);
  assert.equal(connection.breadthFactor, 1);
});

test("paused and future Rhythms stay unscored and only scored Foundations enter provisional health", () => {
  const active = { id: "active", text: "Active", areas: ["marriage"], freq: "daily", added: "2026-10-01", marriagePrimaryFoundation: "connection" };
  const paused = { id: "paused", text: "Paused", areas: ["marriage"], freq: "daily", added: "2026-10-01", paused: true, marriagePrimaryFoundation: "communication" };
  const future = { id: "future", text: "Future", areas: ["marriage"], freq: "daily", added: "2026-10-20", marriagePrimaryFoundation: "intimacy" };
  const events = [];
  for (let day = new Date("2026-10-01T12:00:00"); day <= new Date("2026-10-16T12:00:00"); day.setDate(day.getDate() + 1)) events.push({ id: "active-" + day.toISOString().slice(0, 10), rhythmId: active.id, ts: new Date(day).setHours(18) });
  const { context } = createContext({ areaRhythms: [active, paused, future], events });
  const scores = context.window.tendMarriageFoundationScores();

  const pausedScore = context.window.tendMarriageRhythmConsistency(paused);
  assert.equal(pausedScore.score, null);
  assert.equal(pausedScore.consistency, null);
  assert.equal(pausedScore.missed, 0);
  assert.equal(pausedScore.overdueAdjustment, 0);
  assert.equal(context.window.tendMarriageRhythmConsistency(future).score, null);
  assert.equal(scores.scoredCount, 1);
  assert.equal(scores.overall, 90);
  const html = context.window.renderArea("marriage");
  assert.match(html, /Provisional · 1 of 6 foundations scored/);
});

test("cloud-prepared Date Night state is saved only after cloud activation", async () => {
  const testContext = createContext();
  testContext.context.window.TEND_CLOUD_MODE = true;
  const historical = {
    id: "cloud-date-night-original",
    text: "Date Night",
    areas: ["marriage"],
    freq: "weekly",
    weekdays: [5],
    personId: "amy"
  };
  const templateCopy = {
    id: "cloud-date-night-copy",
    text: "Date Night",
    sourceTemplateId: "marriage.date-night",
    areas: ["marriage"],
    freq: "weekly",
    weekdays: [5],
    personId: "amy"
  };
  const state = {
    people: [{ id: "amy", name: "Amy", relation: "Spouse", rhythms: [historical, templateCopy] }],
    settings: { marriageSpouseId: "amy" },
    events: [{ id: "event", rhythmId: historical.id, ts: 1000 }],
    marriageRhythmTemplateLinks: { "marriage.date-night": templateCopy.id }
  };

  const prepared = testContext.context.window.ensureShape(state);
  assert.equal(testContext.saves, 0);
  assert.equal(prepared.marriageRhythmTemplateLinks["marriage.date-night"], historical.id);
  assert.equal(prepared.__tendMarriageDateNightLinkPending, true);
  assert.equal(prepared.people[0].rhythms[0].sourceTemplateId, "marriage.date-night");
  assert.equal(prepared.people[0].rhythms[1].marriageDuplicateOf, historical.id);

  testContext.context.S = prepared;
  testContext.context.window.TendCloudPersistence = { isReady: () => true };
  testContext.windowListeners["tend-cloud-status"].forEach(listener => listener({ detail: { status: "Saved" } }));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(testContext.saves, 1);
  assert.equal(testContext.context.S.__tendMarriageDateNightLinkPending, undefined);
  assert.equal(testContext.context.S.events[0].rhythmId, historical.id);
});

test("including a linked Rhythm preserves its record and history while categorizing it for Marriage", () => {
  const record = { id: "linked-date-night", text: "Our evening", sourceTemplateId: "marriage.date-night", freq: "weekly", areas: ["faith"] };
  const completion = { id: "completion", rhythmId: record.id, ts: 1000 };
  const spouse = { id: "partner", name: "Partner", relation: "Spouse", rhythms: [record] };
  const testContext = createContext({
    people: [spouse],
    settings: { marriageSpouseId: spouse.id },
    events: [completion]
  });

  clickMarriageAction(testContext.windowListeners, "data-marriage-include", null, "marriage.date-night");

  assert.deepEqual(Array.from(record.areas), ["faith", "marriage"]);
  assert.equal(record.marriagePrimaryFoundation, "fun-adventure");
  assert.equal(testContext.context.S.people[0].rhythms.length, 1);
  assert.equal(testContext.context.S.events[0], completion);
  assert.equal(testContext.saves, 1);
  assert.ok(testContext.flashes.includes("Existing Rhythm included in Marriage"));
});

test("Daily Connection progress counts distinct completed local dates within the Sunday week", () => {
  const rhythm = { id: "daily", text: "Daily Connection", marriageDailyConnection: true, areas: ["marriage"] };
  const timestamp = day => new Date(2026, 9, day, 12).getTime();
  const { context } = createContext(dailyConnectionState({
    areaRhythms: [rhythm],
    events: [10, 12, 12, 14, 16, 17].map(day => ({ rhythmId: rhythm.id, ts: timestamp(day) }))
  }));

  const friday = context.window.tendMarriageDailyConnectionProgress("2026-10-16");
  assert.equal(friday.goal, 5);
  assert.equal(friday.count, 3);
  assert.equal(friday.score, 60);
  assert.deepEqual(Array.from(friday.dayKeys), ["2026-10-12", "2026-10-14", "2026-10-16"]);

  const sunday = context.window.tendMarriageDailyConnectionProgress("2026-10-18");
  assert.equal(sunday.weekStart, "2026-10-18");
  assert.equal(sunday.count, 0);
});

test("Daily Connection goal changes are explicit-save, cancelable, and effective next Sunday", () => {
  const testContext = createContext(dailyConnectionState({
    settings: {
      marriageSpouseId: "partner",
      marriageDailyConnectionGoal: { active: 5, pending: null, effectiveDate: null },
      marriageWeeklyFocus: { enabled: false, startsOn: null }
    },
    areaRhythms: [{ id: "daily", text: "Daily Connection", marriageDailyConnection: true, areas: ["marriage"] }]
  }));
  const { context, windowListeners } = testContext;
  const before = JSON.stringify(context.S.settings);

  clickMarriageAction(windowListeners, "data-marriage-daily-settings-open");
  assert.equal(JSON.stringify(context.S.settings), before, "opening the dialog does not mutate settings");
  clickMarriageAction(windowListeners, "data-marriage-daily-settings-cancel");
  assert.equal(JSON.stringify(context.S.settings), before, "cancel discards the dialog draft");
  assert.equal(testContext.saves, 0);

  clickMarriageAction(windowListeners, "data-marriage-daily-settings-open");
  const dialog = {
    querySelector(selector) {
      if (selector === "[data-marriage-daily-goal]") return { value: "4" };
      if (selector === "[data-marriage-weekly-focus]") return { checked: true };
      return null;
    }
  };
  clickMarriageAction(windowListeners, "data-marriage-daily-settings-save", dialog);

  assert.deepEqual(JSON.parse(JSON.stringify(context.S.settings.marriageDailyConnectionGoal)), {
    active: 5,
    pending: 4,
    effectiveDate: "2026-10-18"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.S.settings.marriageWeeklyFocus)), { enabled: true, startsOn: "2026-10-18" });
  assert.equal(testContext.saves, 1);
  assert.equal(context.window.tendMarriageDailyConnectionProgress("2026-10-17").goal, 5);
  assert.equal(context.window.tendMarriageDailyConnectionProgress("2026-10-18").goal, 4);
  assert.equal(context.window.tendMarriageWeeklyFocus("2026-10-17"), null);
  assert.equal(context.window.tendMarriageWeeklyFocus("2026-10-18"), "be-curious");
  assert.equal(context.window.tendMarriageWeeklyFocus("2026-10-25"), "show-affection");
});

test("prompt category and prompt changes persist, while the default selection stays deterministic", () => {
  const testContext = createContext(dailyConnectionState());
  const { context, windowListeners } = testContext;
  const first = context.window.tendMarriageDailyConnectionSelection("2026-10-16", "partner");
  const repeated = context.window.tendMarriageDailyConnectionSelection("2026-10-16", "partner");
  assert.equal(first.categoryId, repeated.categoryId);
  assert.equal(first.promptIndex, repeated.promptIndex);

  changeMarriageSetting(windowListeners, "data-marriage-prompt-category", "unhurried-conversation");
  const changed = context.window.tendMarriageDailyConnectionSelection("2026-10-16", "partner");
  assert.equal(changed.categoryId, "unhurried-conversation");
  assert.equal(testContext.saves, 1);

  const promptCategory = changed.category;
  clickMarriageAction(windowListeners, "data-marriage-prompt-next");
  const advanced = context.window.tendMarriageDailyConnectionSelection("2026-10-16", "partner");
  assert.equal(advanced.categoryId, "unhurried-conversation");
  assert.equal(advanced.promptIndex, (changed.promptIndex + 1) % promptCategory.prompts.length);

  const restored = createContext(JSON.parse(JSON.stringify(context.S))).context;
  const afterReload = restored.window.tendMarriageDailyConnectionSelection("2026-10-16", "partner");
  assert.equal(afterReload.categoryId, advanced.categoryId);
  assert.equal(afterReload.promptIndex, advanced.promptIndex);
});

test("Marriage header shortcut uses the configured spouse ID without displaying person health", () => {
  const spouse = {
    id: "partner-b",
    name: "Partner B",
    relation: "Spouse",
    rhythms: [{ id: "disabled", text: "Paused practice", disabled: true }],
    healthScore: 42
  };
  const testContext = createContext({
    people: [{ id: "partner-a", relation: "Spouse" }, spouse],
    settings: { marriageSpouseId: spouse.id }
  });
  const { context } = testContext;

  assert.equal(context.window.tendMarriageSelectedSpouse().id, spouse.id);

  const html = context.window.renderArea("marriage");
  assert.match(html, /data-openperson="partner-b" aria-label="View Partner B's profile"/);
  assert.match(html, /<span>Partner B<\/span><span class="marriage-spouse-shortcut-chevron" aria-hidden="true">›<\/span>/);
  assert.doesNotMatch(html, /marriage-spouse-card|Relationship health|>42</);
});

test("an assigned Daily Connection owner takes precedence over a stale featured-contact setting", () => {
  const daily = { id: "daily", text: "Daily Connection", marriageDailyConnection: true, areas: ["marriage"] };
  const assignedSpouse = { id: "partner-b", name: "Partner B", relation: "Spouse", rhythms: [daily] };
  const { context } = createContext({
    people: [{ id: "partner-a", name: "Partner A", relation: "Spouse" }, assignedSpouse],
    settings: { marriageSpouseId: "partner-a" }
  });

  assert.equal(context.window.tendMarriageSelectedSpouse().id, "partner-b");
  const html = context.window.renderArea("marriage");
  assert.match(html, /data-openperson="partner-b" aria-label="View Partner B's profile"/);
  assert.doesNotMatch(html, /The featured contact is set by the person assigned to Daily Connection/);
  assert.doesNotMatch(html, /marriage-spouse-card/);
});

test("Marriage header shortcut uses the real avatar or initials fallback and handles long names", () => {
  const { context } = createContext({
    people: [
      { id: "partner", name: "A Very Long Spouse Name That Should Wrap", relation: "Spouse", healthScore: NaN, initials: "VL", photo: "" }
    ],
    settings: { marriageSpouseId: "partner" }
  });
  const html = context.window.renderArea("marriage");

  assert.match(html, /avatar-fallback" data-size="30">VL/);
  assert.match(html, /A Very Long Spouse Name That Should Wrap/);
  assert.match(html, /aria-label="View A Very Long Spouse Name That Should Wrap's profile"/);
  assert.doesNotMatch(html, /marriage-spouse-card|Relationship health|class="marriage-spouse-meter"/);

  context.S.people[0].photo = "profile-photo";
  const photoHtml = context.window.renderArea("marriage");
  assert.match(photoHtml, /<img class="avatar" src="profile-photo" width="30"/);
});

test("Marriage header omits the spouse shortcut if no spouse is configured", () => {
  const { context } = createContext({
    people: [
      { id: "partner-a", name: "Partner A", relation: "Spouse" },
      { id: "partner-b", name: "Partner B", relation: "Spouse" }
    ]
  });

  const html = context.window.renderArea("marriage");
  assert.doesNotMatch(html, /marriage-spouse-shortcut|data-openperson="partner-[ab]"/);
  assert.doesNotMatch(html, /marriage-spouse-card/);
});

test("Marriage spouse shortcut keeps its accessible touch target and narrow-screen header layout", () => {
  assert.match(styles, /\.marriage-spouse-shortcut\{[^}]*min-height:44px/);
  assert.match(styles, /\.marriage-spouse-shortcut:focus-visible\{outline:2px solid var\(--forest\)/);
  assert.match(styles, /@media\(max-width:380px\)\{\.marriage-page>\.marriage-page-heading\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto auto auto\}/);
  assert.match(styles, /\.marriage-spouse-shortcut\{grid-column:1;grid-row:3;justify-self:end;max-width:100%\}/);
});

test("Daily Connection creation keeps an invalid draft retryable and saves it to the selected spouse", () => {
  const testContext = createContext(dailyConnectionState());
  const { context, windowListeners } = testContext;
  let personId = "";
  const form = {
    querySelector(selector) {
      if (selector === '[data-crf="text"]') return { value: "Daily Connection", focus() {} };
      if (selector === '[data-crf="description"]') return { value: "A daily check-in" };
      if (selector === '[data-crf="personal"]') return { checked: false };
      if (selector === '[data-crf="personId"]') return { value: personId };
      if (selector.includes("|start")) return { value: "2026-10-16", focus() {} };
      return null;
    },
    querySelectorAll() { return []; }
  };

  clickMarriageAction(windowListeners, "data-marriage-suggestion-add", null, "marriage.daily-connection");
  clickMarriageAction(windowListeners, "data-area-rhythm-save", form, "marriage|draft");
  assert.equal(testContext.saves, 0, "an unassigned draft is not persisted");
  assert.ok(testContext.flashes.includes("Choose a spouse in the featured card for Daily Connection"));

  const spouse = context.S.people[0];
  personId = spouse.id;
  clickMarriageAction(windowListeners, "data-area-rhythm-save", form, "marriage|draft");

  assert.equal(testContext.saves, 1);
  assert.equal(context.S.areaRhythms.length, 0);
  assert.equal(spouse.rhythms.length, 1);
  assert.equal(spouse.rhythms[0].id, "daily-generated");
  assert.equal(spouse.rhythms[0].freq, "custom");
  assert.equal(spouse.rhythms[0].sourceTemplateId, "marriage.daily-connection");
  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.daily-connection"], "daily-generated");
  assert.equal(context.S.settings.marriageSpouseId, spouse.id);
});

test("Daily Connection delegates completion to the existing rhythm action", () => {
  const rhythm = { id: "daily", text: "Daily Connection", marriageDailyConnection: true, areas: ["marriage"], freq: "daily" };
  const spouse = { id: "partner", name: "Partner", relation: "Spouse", rhythms: [rhythm] };
  const { context } = createContext(dailyConnectionState({
    people: [spouse],
    events: []
  }));

  const html = context.window.renderArea("marriage");
  assert.match(html, /data-tend-open="person-rhythm" data-person-id="partner" data-rhythm-id="daily"/);
  assert.match(html, />I connected today<\/button>/);
  assert.match(html, /Weekly goal/);
  assert.match(html, /0 of 5 days connected/);
  assert.equal((html.match(/class="marriage-weekday(?:\s|")/g) || []).length, 7);
});

test("Daily Connection undo removes today's completion records without changing prior days", () => {
  const rhythm = { id: "daily", text: "Daily Connection", marriageDailyConnection: true, areas: ["marriage"] };
  const timestamp = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
  const testContext = createContext(dailyConnectionState({
    areaRhythms: [rhythm],
    events: [
      { id: "prior", rhythmId: rhythm.id, ts: timestamp(15) },
      { id: "today-1", rhythmId: rhythm.id, ts: timestamp(16, 9) },
      { id: "today-2", rhythmId: rhythm.id, ts: timestamp(16, 18) },
      { id: "other", rhythmId: "unrelated", ts: timestamp(16) }
    ]
  }));

  const html = testContext.context.window.renderArea("marriage");
  assert.match(html, /data-marriage-daily-undo="daily">Undo today/);
  clickMarriageAction(testContext.windowListeners, "data-marriage-daily-undo", null, "daily");

  assert.deepEqual(testContext.context.S.events.map(event => event.id), ["prior", "other"]);
  assert.equal(testContext.saves, 1);
  assert.ok(testContext.flashes.includes("Today's connection undone"));
  assert.equal(testContext.context.window.tendMarriageDailyConnectionProgress("2026-10-16").count, 1);
});

test("Daily Connection topic, weekly goal, and four-week focus render as separate supporting sections", () => {
  const rhythm = { id: "daily", text: "Daily Connection", marriageDailyConnection: true, areas: ["marriage"] };
  const { context } = createContext(dailyConnectionState({
    areaRhythms: [rhythm],
    settings: {
      marriageSpouseId: "partner",
      marriageWeeklyFocus: { enabled: true, startsOn: "2026-10-11" }
    },
    events: [{ rhythmId: rhythm.id, ts: new Date(2026, 9, 16, 12).getTime() }]
  }));
  const html = context.window.renderArea("marriage");
  const dailyCard = html.slice(html.indexOf('class="marriage-daily-card"'), html.indexOf('class="marriage-weekly-goal"'));

  assert.match(dailyCard, /Today’s topic/);
  assert.match(dailyCard, /Another idea/);
  assert.doesNotMatch(dailyCard, /This week’s focus/);
  assert.match(html, /1 of 5 days connected/);
  assert.match(html, /This week’s focus/);
  assert.match(html, /Be Curious/);
  assert.ok(html.indexOf('class="marriage-weekly-goal"') < html.indexOf('class="marriage-weekly-focus-card"'));
  assert.equal(context.window.tendMarriageWeeklyFocus("2026-10-19"), "show-affection");
});

test("Explore suggestions Close and Escape dismiss, preserve drafts, and restore the launch button", () => {
  const testContext = createContext();
  const { context, windowListeners } = testContext;
  clickMarriageAction(windowListeners, "data-marriage-suggestions-open", null, "empty-state");
  let html = context.window.renderArea("marriage");
  assert.match(html, /data-marriage-suggestions-close[^>]*aria-label="Close suggestions"/);
  assert.match(html, /＋ Create a new Date Night rhythm/);
  assert.match(html, /Use an existing rhythm/);

  clickMarriageAction(windowListeners, "data-marriage-suggestions-close");
  html = context.window.renderArea("marriage");
  assert.doesNotMatch(html, /marriage-rhythm-suggestions-dialog/);
  assert.ok(testContext.focused.some(selector => selector.includes('data-marriage-suggestions-open="empty-state"')));
  assert.equal(testContext.saves, 0);

  clickMarriageAction(windowListeners, "data-marriage-suggestions-open", null, "rhythm-list");
  const cancelListener = windowListeners.cancel.find(listener => listener.toString().includes("marriage-rhythm-suggestions-dialog"));
  assert.ok(cancelListener, "Escape cancel handling is installed");
  const closeAction = { click() { clickMarriageAction(windowListeners, "data-marriage-suggestions-close"); } };
  let prevented = false, stopped = false;
  cancelListener({
    target: { matches(selector) { return selector === ".marriage-rhythm-suggestions-dialog"; }, querySelector() { return closeAction; } },
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.doesNotMatch(context.window.renderArea("marriage"), /marriage-rhythm-suggestions-dialog/);
  assert.equal(testContext.saves, 0);
});

test("Adding from the suggestions catalog skips its modal and cancel returns to Marriage Rhythms", () => {
  const testContext = createContext();
  const { context, windowListeners } = testContext;
  clickMarriageAction(windowListeners, "data-marriage-suggestions-open", null, "empty-state");
  clickMarriageAction(windowListeners, "data-marriage-suggestion-add", null, "marriage.date-night");
  const editor = context.window.renderArea("marriage");
  assert.match(editor, /<h3 id="area-rhythm-editor-title">Create Rhythm<\/h3>/);
  assert.match(editor, /Create a separate rhythm with your own timing and details/);
  assert.match(editor, /data-area-rhythm-cancel="1"[^>]*aria-label="Close Rhythm editor"/);
  assert.match(editor, /data-area-rhythm-cancel="1"[^>]*>Back to Rhythms</);
  assert.doesNotMatch(editor, /marriage-rhythm-suggestions-dialog|Show in categories|rhythm-area-checks/);

  clickMarriageAction(windowListeners, "data-area-rhythm-cancel");
  const closed = context.window.renderArea("marriage");
  assert.doesNotMatch(closed, /marriage-rhythm-suggestions-dialog|data-area-rhythm-form="marriage\|draft"/);
  assert.match(closed, /id="marriage-tab-rhythms"[^>]*aria-selected="true"/);
  assert.equal(context.S.areaRhythms.length, 0);
  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.date-night"], undefined);
  assert.equal(testContext.saves, 0);
});

test("recommended Marriage rows are compact and render each of the nine templates exactly once", () => {
  const { context } = createContext();
  const html = context.window.renderArea("marriage");
  const catalog = Array.from(context.window.tendMarriageSuggestionCatalog());

  assert.equal((html.match(/class="marriage-template-row"/g) || []).length, 9);
  for (const template of catalog) {
    assert.equal((html.match(new RegExp(`data-marriage-rhythm-details="${template.id}"`, "g")) || []).length, 1);
    assert.equal((html.match(new RegExp(`data-marriage-suggestion-add="${template.id}"`, "g")) || []).length, 1);
  }
  assert.equal((html.match(/Overnight Away/g) || []).length, 1);
  assert.doesNotMatch(html, /marriage-template-status|marriage-foundation-tags/);
  assert.match(styles, /\.marriage-template-row\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
});

test("Marriage form keeps other existing category associations when category controls are hidden", () => {
  const rhythm = { id: "multi-category", text: "Shared practice", areas: ["marriage", "faith", "parenting"], freq: "weekly" };
  const { context, windowListeners } = createContext({ areaRhythms: [rhythm] });

  clickMarriageAction(windowListeners, "data-area-rhythm-edit", null, "marriage|multi-category");
  const editor = context.window.renderArea("marriage");
  assert.match(editor, /data-area-rhythm-form="marriage\|multi-category"/);
  assert.doesNotMatch(editor, /Show in categories|rhythm-area-checks|value="faith"/);

  clickMarriageAction(windowListeners, "data-area-rhythm-cancel");
  assert.deepEqual(Array.from(context.S.areaRhythms[0].areas), ["marriage", "faith", "parenting"]);
});

test("recommended Rhythm Add prefills its template, spouse, and locked Marriage category", () => {
  const testContext = createContext(dailyConnectionState());
  const { context, windowListeners } = testContext;
  const yearly = context.window.tendMarriageTemplateDraft("marriage.week-away-together");
  assert.equal(yearly.text, "Week Away Together");
  assert.equal(yearly.description, "Protect extended time together for rest, enjoyment, and connection.");
  assert.equal(yearly.freq, "yearly");
  assert.equal(yearly.personId, "partner");
  assert.deepEqual(Array.from(yearly.areas), ["marriage"]);

  clickMarriageAction(windowListeners, "data-marriage-suggestion-add", null, "marriage.daily-connection");
  const editor = context.window.renderArea("marriage");
  assert.match(editor, /value="Daily Connection"/);
  assert.match(editor, /Make a little room each day to connect in a way that fits your life/);
  assert.match(editor, /<option value="partner" selected>Partner<\/option>/);
  assert.doesNotMatch(editor, /Show in categories|rhythm-area-checks|value="faith"/);
  assert.doesNotMatch(editor, /marriage-rhythm-suggestions-dialog/);
});

test("successful Marriage Rhythm save returns to Rhythms with updated status and health", () => {
  const testContext = createContext(dailyConnectionState());
  const { context, windowListeners } = testContext;
  const form = {
    querySelector(selector) {
      if (selector === '[data-crf="text"]') return { value: "Daily Connection", focus() {} };
      if (selector === '[data-crf="description"]') return { value: "A little room each day to connect" };
      if (selector === '[data-crf="personal"]') return { checked: false };
      if (selector === '[data-crf="personId"]') return { value: "partner" };
      if (selector.includes("|start")) return { value: "2026-10-16", focus() {} };
      return null;
    },
    querySelectorAll() { return []; }
  };

  clickMarriageAction(windowListeners, "data-marriage-suggestion-add", null, "marriage.daily-connection");
  clickMarriageAction(windowListeners, "data-area-rhythm-save", form, "marriage|draft");
  const html = context.window.renderArea("marriage");

  assert.equal(testContext.saves, 1);
  assert.equal(context.S.people[0].rhythms.length, 1);
  assert.deepEqual(Array.from(context.S.people[0].rhythms[0].areas), ["marriage"]);
  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.daily-connection"], "daily-generated");
  assert.match(html, /data-marriage-rhythm-details="marriage.daily-connection">Details/);
  assert.match(html, /1 active ·/);
  assert.match(html, /id="marriage-tab-rhythms"[^>]*aria-selected="true"/);
  assert.doesNotMatch(html, /marriage-rhythm-suggestions-dialog|data-area-rhythm-form="marriage\|draft"/);
});

test("failed Marriage Rhythm save keeps the populated editor open and rolls back persistence state", () => {
  const testContext = createContext(dailyConnectionState());
  const { context, windowListeners } = testContext;
  context.save = function() { throw new Error("storage unavailable"); };
  const form = {
    querySelector(selector) {
      if (selector === '[data-crf="text"]') return { value: "Daily Connection" };
      if (selector === '[data-crf="description"]') return { value: "Keep this entered text" };
      if (selector === '[data-crf="personal"]') return { checked: false };
      if (selector === '[data-crf="personId"]') return { value: "partner" };
      if (selector.includes("|start")) return { value: "2026-10-16" };
      return null;
    },
    querySelectorAll() { return []; }
  };

  clickMarriageAction(windowListeners, "data-marriage-suggestion-add", null, "marriage.daily-connection");
  clickMarriageAction(windowListeners, "data-area-rhythm-save", form, "marriage|draft");
  const html = context.window.renderArea("marriage");

  assert.equal(context.S.people[0].rhythms.length, 0);
  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.daily-connection"], undefined);
  assert.match(html, /data-area-rhythm-form="marriage\|draft"/);
  assert.match(html, /Keep this entered text/);
  assert.ok(testContext.flashes.includes("Rhythm could not be saved. Your changes are still in the form; please try again."));
});

test("existing-rhythm suggestions rank likely matches among the selected spouse's rhythms and provide Back", () => {
  const selected = { id: "selected", text: "Date Night", areas: ["faith"], freq: "weekly" };
  const unmatched = { id: "unmatched", text: "Our walk", areas: ["faith"], freq: "weekly" };
  const other = { id: "other", text: "Other person's rhythm", areas: ["marriage"] };
  const testContext = createContext({
    people: [
      { id: "partner", name: "Partner", relation: "Spouse", rhythms: [unmatched, selected] },
      { id: "other-partner", name: "Other Partner", relation: "Spouse", rhythms: [other] }
    ],
    areaRhythms: [{ id: "area", text: "Area rhythm", areas: ["marriage"] }],
    settings: { marriageSpouseId: "partner" }
  });
  const { context, windowListeners } = testContext;
  assert.equal(testContext.saves, 0);
  clickMarriageAction(windowListeners, "data-marriage-suggestions-open", null, "rhythm-list");
  assert.equal(testContext.saves, 0);
  clickMarriageAction(windowListeners, "data-marriage-link-select", null, "marriage.date-night");
  assert.equal(testContext.saves, 0);
  let html = context.window.renderArea("marriage");
  const candidatePanel = html.split('class="marriage-link-panel">')[1].split("</div></section>")[0];
  assert.match(candidatePanel, /Likely match/);
  assert.ok(candidatePanel.indexOf("Date Night") < candidatePanel.indexOf("Our walk"));
  assert.match(candidatePanel, /Our walk/);
  assert.doesNotMatch(candidatePanel, /Other person's rhythm|Area rhythm/);
  assert.match(html, /data-marriage-link-back="marriage.date-night">Back to suggestions/);
  clickMarriageAction(windowListeners, "data-marriage-link-candidate", null, "marriage.date-night|selected");
  assert.equal(testContext.saves, 0);
  html = context.window.renderArea("marriage");
  assert.match(html, /Use this rhythm/);
  const review = { querySelector(selector) { return selector === "[data-marriage-link-show]" ? { checked: true } : null; } };
  clickMarriageAction(windowListeners, "data-marriage-link-confirm", review, "marriage.date-night|selected");
  assert.equal(context.S.marriageRhythmTemplateLinks["marriage.date-night"], "selected");
  assert.equal(selected.sourceTemplateId, "marriage.date-night");
  assert.deepEqual(Array.from(selected.areas), ["faith", "marriage"]);
  assert.equal(context.S.areaRhythms.length, 1);
  assert.equal(context.S.people[0].rhythms.length, 2);
  assert.equal(context.S.events.length, 0);
  assert.ok(testContext.saves > 0);

  clickMarriageAction(windowListeners, "data-marriage-suggestions-open", null, "rhythm-list");
  clickMarriageAction(windowListeners, "data-marriage-link-select", null, "marriage.marriage-check-in");
  html = context.window.renderArea("marriage");
  assert.match(html, /data-marriage-suggestions-close[^>]*aria-label="Close suggestions"/);
  clickMarriageAction(windowListeners, "data-marriage-link-back", null, "marriage.marriage-check-in");
  html = context.window.renderArea("marriage");
  assert.doesNotMatch(html, /marriage-link-panel/);
  assert.ok(html.includes("Use an existing rhythm"));
});

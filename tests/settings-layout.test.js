"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const settingsSource = fs.readFileSync(path.join(root, "app-settingstabs.js"), "utf8");
const authSource = fs.readFileSync(path.join(root, "app-auth.js"), "utf8");
const actionsSource = fs.readFileSync(path.join(root, "app-actions.js"), "utf8");

function settingsContext() {
  const saved = { mobileTextSize: "larger", greenAt: 84, yellowAt: 47, baseline: 53, profilePhoto: null, focusBlocks: ["morning", "evening"] };
  const handlers = { click: [], change: [], input: [], keydown: [] };
  let savedCount = 0;
  const context = {
    S: { settings: saved, calendars: [], keyDates: [], people: [] },
    window: {
      clearTendCalendarCache() {},
      TEND_LOAD_CALENDAR() {},
      TendAuth: { displayName() { return "Steve Otto"; } }
    },
    document: {
      documentElement: { setAttribute() {} },
      addEventListener(type, handler) { if (handlers[type]) handlers[type].push(handler); },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    handlers,
    settings() { return saved; },
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); },
    save() { savedCount += 1; },
    getSavedCount() { return savedCount; },
    flash() {},
    nowWeather: { requestId: 0, status: "loaded", position: null, report: null },
    esc(value) { return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); },
    tendSectionHeaderHTML(options) { return '<header><h1>' + options.title + '</h1></header>'; },
    personAvatar() { return '<span>Me</span>'; },
    actionColorSettings() { return { rhythm: "#246B52", spark: "#D4A43A", prayer: "#8B78A6", fitness: "#3D7357" }; },
    badgeColorSettings() { return { faith: "#7865A0" }; },
    DEFAULT_ACTION_COLORS: { rhythm: "#246B52", spark: "#D4A43A", prayer: "#8B78A6", fitness: "#3D7357" },
    collectionIcon() { return ""; },
    applyActionColors() {},
    applyBadgeColors() {},
    peopleColorsSettingsHTML() { return '<div class="card settings-card"><input type="color" data-catcolor="marriage"><button id="catColorReset">Reset</button></div>'; },
    faithSettingsHTML() { return '<section><input type="checkbox" data-faith-enabled="Prayer">Faith preferences</section>'; },
    focusSettingsHTML() { return '<div class="card settings-card" id="focusSettings">Focus settings</div>'; },
    focusBlocks() { return saved.focusBlocks; },
    dayBlockSettingsHTML() { return '<div class="card settings-card"><button id="saveDayBlocks">Save time sections</button></div>'; },
    keyDatesSettingsHTML(includeEditor) { return '<div class="card settings-card"><button data-kd-editor-add>Add key date</button>' + (includeEditor === false ? "" : '<dialog data-editor-modal></dialog>') + '</div>'; },
    holidaySettingsHTML() { return '<div class="card settings-card"><input data-holiday="new-year"></div>'; },
    holidayEnabled(id) { return id === "new-year"; },
    majorHolidays: [{ id: "new-year" }, { id: "christmas" }],
    calendarEditorHTML() { return ""; },
    calendarColor(value) { return value || "#4C9AFF"; },
    tendAccountSettingsHTML() { return '<div class="settings-row-static"><button data-account-sign-out>Sign out</button></div>'; },
    tendAccountDataSettingsHTML(mode) {
      return mode === "recovery" ? "" : '<div class="settings-row-static"><button id="syncExport">Export</button><button id="syncImport">Import</button><input id="syncImportFile" type="file" hidden></div>';
    },
    tendLegacyRecoverySettingsHTML() { return ""; },
    meterThresholdPreviewHTML() { return ""; },
    dayBlocks() { return []; },
    render() { context.lastHTML = context.renderSettings(); }
  };
  vm.createContext(context);
  vm.runInContext(settingsSource, context);
  return context;
}

function click(context, selector, key) {
  const target = {
    closest(candidate) { return candidate === selector ? this : null; },
    getAttribute(name) { return name === "data-settings-open" || name === "data-settings-tab" ? key : null; },
    hasAttribute() { return false; }
  };
  context.handlers.click.forEach(handler => handler({ target }));
}

test("Settings exposes four accessible tabs and keeps every control in its intended group", () => {
  const context = settingsContext();
  const html = context.renderSettings();

  assert.equal((html.match(/role="tab" /g) || []).length, 4);
  for (const tab of ["general", "appearance", "connections", "data"]) {
    assert.match(html, new RegExp('id="settings-tab-' + tab + '"[^>]*aria-controls="settings-panel-' + tab + '"'));
    assert.match(html, new RegExp('id="settings-panel-' + tab + '"[^>]*role="tabpanel"'));
  }
  assert.match(html, /aria-label="Settings sections"/);
  assert.match(html, /data-me-open><span><strong>Profile<\/strong><small>Steve Otto<\/small>/);
  assert.match(html, /data-settings-open="general-focus"/);
  assert.match(html, /data-settings-open="general-time"/);
  assert.match(html, /id="mobileTextSize"[^>]*>[\s\S]*<option value="larger" selected/);
  assert.match(html, /data-settings-open="appearance-colors"/);
  assert.match(html, /data-settings-open="appearance-meters"/);
  assert.match(html, /data-settings-open="connections-calendars"/);
  assert.match(html, /data-settings-open="connections-weather"/);
  assert.match(html, /data-settings-open="connections-keydates"/);
  assert.match(html, /data-settings-open="connections-holidays"/);
  for (const action of ["syncExport", "syncImport", "syncImportFile"]) assert.ok(html.includes(action));
  assert.match(html, /data-account-sign-out/);
  assert.match(html, /data-utilnav="careplan"/);
  assert.match(html, /data-utilnav="offload"/);
  assert.doesNotMatch(html, /data-account-profile-save|tendDisplayName/);
  assert.equal(context.settings().mobileTextSize, "larger");
  assert.equal(context.settings().greenAt, 84);
  assert.equal(context.settings().yellowAt, 47);
  assert.equal(context.settings().baseline, 53);
});

test("Settings tab selection and keyboard navigation retain accessible state", () => {
  const context = settingsContext();
  click(context, "[data-settings-tab]", "connections");
  assert.equal(context.settingsTab, "connections");
  assert.match(context.lastHTML, /id="settings-tab-connections"[^>]*aria-selected="true" tabindex="0"/);
  assert.match(context.lastHTML, /id="settings-panel-connections"[^>]*role="tabpanel"/);

  let prevented = false;
  const target = { closest(selector) { return selector === '[role="tab"][data-settings-tab]' ? this : null; } };
  context.handlers.keydown.forEach(handler => handler({ target, key: "ArrowRight", preventDefault() { prevented = true; } }));
  assert.equal(prevented, true);
  assert.equal(context.settingsTab, "data");
});

test("Settings dialogs open without mutation and Cancel closes explicit-save forms", () => {
  const context = settingsContext();
  click(context, "[data-settings-open]", "appearance-meters");
  assert.equal(context.settingsDialogOpen, "appearance-meters");
  assert.match(context.lastHTML, /<dialog class="profile-editor-dialog settings-dialog"[^>]*Meters/);
  assert.match(context.lastHTML, /id="setGreen"[^>]*value="84"/);
  assert.match(context.lastHTML, /id="setYellow"[^>]*value="47"/);
  assert.match(context.lastHTML, /id="setBase"[^>]*value="53"/);
  assert.equal(context.getSavedCount(), 0);

  click(context, "[data-settings-dialog-close]");
  assert.equal(context.settingsDialogOpen, null);
  assert.equal(context.settings().greenAt, 84);
  assert.equal(context.settings().yellowAt, 47);
  assert.equal(context.settings().baseline, 53);
  assert.equal(context.getSavedCount(), 0);
});

test("calendar editors return to the originating settings dialog after cancel", () => {
  const context = settingsContext();
  context.settingsTab = "connections";
  context.settingsDialogOpen = "connections-calendars";
  const dispatch = attribute => {
    const target = {
      closest(selector) { return selector === "[data-calendar-editor-add],[data-calendar-editor-edit],[data-calendar-editor-save],[data-calendar-editor-cancel],[data-calendar-editor-delete]" ? this : null; },
      hasAttribute(name) { return name === attribute; },
      getAttribute() { return null; }
    };
    context.handlers.click.forEach(handler => handler({ target }));
  };
  dispatch("data-calendar-editor-add");
  assert.equal(context.settingsDialogOpen, null);
  assert.equal(context.settingsDialogReturn, "connections-calendars");
  assert.match(context.lastHTML, /aria-label="Add calendar"/);

  dispatch("data-calendar-editor-cancel");
  assert.equal(context.settingsDialogOpen, "connections-calendars");
  assert.equal(context.settingsDialogReturn, null);
  assert.match(context.lastHTML, /aria-label="Calendar feeds"/);
  assert.equal(context.getSavedCount(), 0);
});

test("moved preferences preserve their immediate-save behavior and modal save closes cleanly", () => {
  const context = settingsContext();
  const textSize = {
    value: "large",
    closest(selector) { return selector === "[data-mobile-text-size]" ? this : null; }
  };
  context.handlers.change.forEach(handler => handler({ target: textSize }));
  assert.equal(context.settings().mobileTextSize, "large");
  assert.equal(context.getSavedCount(), 1);

  click(context, "[data-settings-open]", "connections-weather");
  const saveButton = {
    closest(selector) { return selector === "[data-weather-settings-save]" ? this : null; }
  };
  context.document.getElementById = id => id === "weatherFallbackLocation" ? { value: "Portland" } : null;
  context.handlers.click.forEach(handler => handler({ target: saveButton }));
  assert.equal(context.settings().weatherFallbackLocation, "Portland");
  assert.equal(context.getSavedCount(), 2);
  assert.equal(context.settingsDialogOpen, null);
});

test("account profile, backup, and optional recovery retain their existing handlers", () => {
  assert.match(authSource, /data-account-sign-out/);
  assert.match(authSource, /data-account-retry-save/);
  assert.match(authSource, /window\.tendAccountDataSettingsHTML = function \(mode\)/);
  assert.match(authSource, /id="syncExport"/);
  assert.match(authSource, /id="syncImport"/);
  assert.match(authSource, /data-account-import-legacy/);
  assert.match(authSource, /window\.tendLegacyRecoverySettingsHTML/);
  assert.match(authSource, /id="syncToken" type="password" autocomplete="off"/);
  assert.match(actionsSource, /#saveDayBlocks[\s\S]*tendCloseSettingsDialog/);
  assert.match(actionsSource, /#setSave[\s\S]*tendCloseSettingsDialog/);
});

test("Me remains the sole display-name editing destination", () => {
  assert.match(settingsSource, /data-me-open><span><strong>Profile/);
  assert.doesNotMatch(authSource, /tendDisplayName|data-account-profile-save|function saveProfile/);
});

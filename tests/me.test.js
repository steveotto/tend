"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-me.js"), "utf8");

function createContext(state, displayNameUpdater) {
  let renderCount = 0;
  const handlers = { click: [], submit: [] };
  const window = {
    addEventListener() {},
    TendAuth: {
      displayName() { return "Current name"; },
      updateDisplayName: displayNameUpdater
    }
  };
  const context = {
    S: state,
    window,
    handlers,
    getRenderCount() { return renderCount; },
    flashMessages: [],
    render() { renderCount += 1; },
    flash(message) { this.flashMessages.push(message); },
    document: {
      addEventListener(type, handler) { if (handlers[type]) handlers[type].push(handler); },
      querySelector() { return null; }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("Me includes only explicitly personal rhythms from their existing owners", () => {
  const context = createContext({
    people: [{ id: "amy", rhythms: [
      { id: "person-personal", text: "Walk", personal: true },
      { id: "person-legacy", text: "Legacy", areas: [] }
    ] }],
    rhythms: [
      { id: "faith-personal", text: "Read", personal: true },
      { id: "faith-default", text: "Default faith" }
    ],
    areaRhythms: [
      { id: "area-personal", text: "Stretch", personal: true, areas: ["health"] },
      { id: "area-legacy", text: "Unlinked legacy", areas: [] },
      { id: "area-personal", text: "Duplicate copy", personal: true, areas: ["health"] }
    ]
  });

  const entries = Array.from(context.window.tendMeRhythmRecords(), item => [item.kind, item.id, item.record.text]);
  assert.deepEqual(entries, [
    ["person", "person:amy:person-personal", "Walk"],
    ["faith", "faith:faith-personal", "Read"],
    ["area", "area:area-personal", "Stretch"]
  ]);
});

test("Me sorting is requested through its own stable ordering context", () => {
  const context = createContext({
    people: [],
    rhythms: [],
    areaRhythms: [
      { id: "walk", text: "Walk", personal: true, areas: ["health"] },
      { id: "read", text: "Read", personal: true, areas: ["faith"] }
    ]
  });
  context.esc = value => String(value);
  context.settings = () => ({});
  context.tendSectionHeaderHTML = () => "";
  context.personAvatar = () => "";
  context.tendRhythmOrderSort = (scope, entries, getId) => {
    assert.equal(scope, "me");
    return entries.slice().sort((a, b) => getId(a).localeCompare(getId(b)));
  };
  context.tendRhythmOrderToolbar = (scope, count) => {
    assert.equal(scope, "me");
    return String(count);
  };
  context.tendRhythmOrderListAttributes = (scope, ids) => {
    assert.equal(scope, "me");
    return ` data-rhythm-order-all-ids="${ids.join(",")}"`;
  };
  context.tendRhythmOrderItemHTML = (_scope, _mode, id, _title, _index, _count, html) => `<div data-id="${id}">${html}</div>`;
  context.tendMeRhythmEditorHTML = () => "";
  context.rhythmScore = () => null;
  context.scoreClass = () => "";
  context.window.tendRhythmCardMetadata = () => ({});
  context.window.tendCategoryBadges = () => "";
  context.window.tendMeRhythmEditorHTML = () => "";
  context.window.tendRhythmOrderToolbar = context.tendRhythmOrderToolbar;
  context.window.tendRhythmOrderSort = context.tendRhythmOrderSort;
  context.window.tendRhythmOrderListAttributes = context.tendRhythmOrderListAttributes;
  context.window.tendRhythmOrderItemHTML = context.tendRhythmOrderItemHTML;
  context.tendRhythmCardHTML = () => "<article></article>";
  context.rhythmDaysSince = () => 1;
  vm.runInContext("", context);
  assert.match(context.meRhythmListHTML(), /data-rhythm-order-all-ids="area:read,area:walk"/);
});

test("profile editor rejects an empty name and Cancel closes without saving", () => {
  let saveCalls = 0;
  const context = createContext({ people: [], rhythms: [], areaRhythms: [] }, async () => { saveCalls += 1; });
  const clickHandler = context.handlers.click[0];
  const click = attribute => clickHandler({ target: {
    closest() { return this; },
    hasAttribute(name) { return name === attribute; }
  } });
  click("data-me-profile-edit");
  assert.equal(context.meProfileEditOpen, true);
  click("data-me-profile-cancel");
  assert.equal(context.meProfileEditOpen, false);
  assert.equal(saveCalls, 0);

  let message = { textContent: "" };
  const field = { value: "   ", focusCalled: false, focus() { this.focusCalled = true; } };
  const form = {
    elements: { displayName: field },
    querySelector(selector) { return selector === ".me-profile-message" ? message : null; },
    closest(selector) { return selector === "[data-me-profile-form]" ? this : null; }
  };
  context.handlers.submit[0]({ target: form, preventDefault() {} });
  assert.equal(message.textContent, "Enter a display name.");
  assert.equal(field.focusCalled, true);
  assert.equal(saveCalls, 0);
});

test("profile editor prevents duplicate saves and retains entered text after a persistence failure", async () => {
  let rejectSave;
  let saveCalls = 0;
  const context = createContext({ people: [], rhythms: [], areaRhythms: [] }, () => {
    saveCalls += 1;
    return new Promise((_resolve, reject) => { rejectSave = reject; });
  });
  const field = { value: "Retry this name" };
  const message = { textContent: "" };
  const submit = { disabled: false };
  const form = {
    elements: { displayName: field },
    querySelector(selector) { return selector === ".me-profile-message" ? message : selector === '[type="submit"]' ? submit : null; },
    closest(selector) { return selector === "[data-me-profile-form]" ? this : null; }
  };
  const event = { target: form, preventDefault() {} };
  context.handlers.submit[0](event);
  context.handlers.submit[0](event);
  assert.equal(saveCalls, 1);
  assert.equal(submit.disabled, true);

  rejectSave(new Error("permission denied"));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(field.value, "Retry this name");
  assert.equal(submit.disabled, false);
  assert.match(message.textContent, /Could not save your display name\. permission denied/);
  assert.equal(context.meProfileEditOpen, false);
});

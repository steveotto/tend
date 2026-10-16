"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const actionsSource = fs.readFileSync(path.join(root, "app-actions.js"), "utf8");
const viewsSource = fs.readFileSync(path.join(root, "app-views1.js"), "utf8");

function extract(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} is present`);
  return match[0];
}

function button(attributes) {
  return {
    type: "button",
    attributes,
    focused: false,
    closest(selector) {
      const name = selector.slice(1, -1);
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this : null;
    },
    getAttribute(name) { return this.attributes[name] ?? null; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    classList: { toggle() {} },
    focus() { this.focused = true; }
  };
}

function createPickerContext() {
  const rhythm = {
    id: "rhythm-1",
    text: "Date Night",
    description: "Intentional time together",
    freq: "weekly",
    tod: "evening",
    personal: false,
    sourceTemplateId: "marriage.date-night",
    areas: ["marriage"],
    sharedWith: []
  };
  const persistedRhythm = JSON.parse(JSON.stringify(rhythm));
  const documentListeners = {};
  const renderedButtons = [];
  const view = {
    html: "",
    querySelector(selector) { return selector === "dialog[data-rhythm-picker-dialog]" && this.html.includes("data-rhythm-picker-dialog") ? {} : null; },
    insertAdjacentHTML(position, markup) { this.html += markup; }
  };
  const context = {
    S: { people: [{ id: "amy", name: "Amy", rhythms: [persistedRhythm] }, { id: "bob", name: "Bob", rhythms: [] }] },
    rhythmEditDraft: rhythm,
    editRhythmId: rhythm.id,
    rhythmPickerDraft: null,
    AREA_ICONS: {},
    esc(value) { return String(value == null ? "" : value); },
    personAvatar() { return ""; },
    tendPeopleGroupToggleBar() { return ""; },
    tendRefreshPeoplePicker() {},
    tendApplyPeopleGroupToggle(selected) { return selected; },
    requestAnimationFrame(callback) { callback(); },
    tendFinishRhythmEdit() { return false; },
    document: {
      addEventListener(type, listener) {
        (documentListeners[type] ||= []).push(listener);
      },
      querySelectorAll(selector) {
        return selector === "[data-rhythm-picker-open]" ? renderedButtons : [];
      },
      querySelector() { return null; }
    },
    window: {
      _tendDelegated: false,
      tendRhythmCategoryIds(record) { return record.areas; }
    }
  };
  vm.createContext(context);
  vm.runInContext(extract(viewsSource, /function rhythmPickerRecord\(ownerId,rid\)\{[\s\S]*?\n\}/, "picker record resolver"), context);
  vm.runInContext(extract(viewsSource, /function rhythmPickerControlsHTML\(ownerId,r,idf,excludeFaith\)\{[\s\S]*?\n\}/, "picker controls renderer"), context);
  vm.runInContext(extract(viewsSource, /function rhythmPickerModalHTML\(\)\{[\s\S]*?\n\}/, "picker dialog renderer"), context);
  vm.runInContext(extract(viewsSource, /function tendEnsureRhythmPickerDialog\(container\)\{[\s\S]*?\n\}/, "picker dialog route fallback"), context);
  context.render = function() {
    view.html = "";
    context.tendEnsureRhythmPickerDialog(view);
    context.lastCategoryPicker = view.html;
  };
  context.renderPreservingScroll = context.render;
  vm.runInContext(extract(actionsSource, /function tendRestoreRhythmPickerFocus\(picker\)\{[\s\S]*?\n\}/, "picker focus restoration"), context);
  vm.runInContext(extract(actionsSource, /function bind\(\)\{[\s\S]*?\n\}/, "delegated action handler"), context);
  context.bind();

  const controlsHTML = context.rhythmPickerControlsHTML("amy", rhythm, "amy|rhythm-1");
  const values = Array.from(controlsHTML.matchAll(/<button type="button"[^>]*data-rhythm-picker-open="([^"]+)"/g), match => match[1]);
  values.forEach(value => renderedButtons.push(button({ "data-rhythm-picker-open": value })));
  const click = target => documentListeners.click.forEach(listener => listener({ target, preventDefault() {} }));
  return { context, rhythm, persistedRhythm, controlsHTML, renderedButtons, click };
}

test("Marriage rhythm picker buttons open, save, cancel, and restore focus without losing the editor draft", () => {
  const { context, rhythm, persistedRhythm, controlsHTML, renderedButtons, click } = createPickerContext();
  const initialFields = {
    text: rhythm.text,
    description: rhythm.description,
    freq: rhythm.freq,
    tod: rhythm.tod,
    personal: rhythm.personal,
    sourceTemplateId: rhythm.sourceTemplateId
  };
  assert.equal(renderedButtons.length, 2);
  assert.match(controlsHTML, /type="button"[^>]*aria-haspopup="dialog"/);

  const peopleButton = renderedButtons.find(item => item.getAttribute("data-rhythm-picker-open").startsWith("people|"));
  click(peopleButton);
  assert.equal(context.rhythmPickerDraft.type, "people");
  assert.match(context.lastCategoryPicker, /data-rhythm-picker-dialog/);
  assert.match(context.lastCategoryPicker, /People for this rhythm/);

  click(button({ "data-rhythm-picker-toggle": "people|amy|rhythm-1|bob" }));
  click(button({ "data-rhythm-picker-cancel": "" }));
  assert.deepEqual(Array.from(rhythm.sharedWith), [], "picker cancel leaves saved draft associations unchanged");
  assert.equal(peopleButton.focused, true, "picker cancel restores focus to Add people");

  peopleButton.focused = false;
  click(peopleButton);
  click(button({ "data-rhythm-picker-toggle": "people|amy|rhythm-1|bob" }));
  click(button({ "data-rhythm-picker-save": "" }));
  assert.deepEqual(Array.from(rhythm.sharedWith), ["bob"]);
  assert.equal(peopleButton.focused, true, "picker save restores focus to Add people");

  const categoriesButton = renderedButtons.find(item => item.getAttribute("data-rhythm-picker-open").startsWith("categories|"));
  click(categoriesButton);
  assert.equal(context.rhythmPickerDraft.type, "categories");
  assert.match(context.lastCategoryPicker, /Categories for this rhythm/);
  click(button({ "data-rhythm-picker-toggle": "categories|amy|rhythm-1|faith" }));
  click(button({ "data-rhythm-picker-save": "" }));
  assert.deepEqual(Array.from(rhythm.areas), ["marriage", "faith"]);
  assert.equal(categoriesButton.focused, true, "picker save restores focus to Add categories");

  for (const [field, value] of Object.entries(initialFields)) assert.equal(rhythm[field], value, `${field} remains in the editor draft`);
  click(button({ "data-rhyeditcancel": "" }));
  assert.equal(context.rhythmEditDraft, null);
  assert.deepEqual(JSON.parse(JSON.stringify(persistedRhythm)), {
    id: "rhythm-1",
    text: "Date Night",
    description: "Intentional time together",
    freq: "weekly",
    tod: "evening",
    personal: false,
    sourceTemplateId: "marriage.date-night",
    areas: ["marriage"],
    sharedWith: []
  }, "canceling the main editor persists no association changes");
  assert.match(viewsSource, /tendEnsureRhythmPickerDialog\(v\)/, "all routes ensure the active picker dialog is rendered");
});

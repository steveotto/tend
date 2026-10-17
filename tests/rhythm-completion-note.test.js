"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const actionsSource = fs.readFileSync(path.join(__dirname, "..", "app-actions.js"), "utf8");
const fitnessDataSource = fs.readFileSync(path.join(__dirname, "..", "app-fitness-data.js"), "utf8");

function actionsContext({ cloud = null } = {}) {
  const context = {
    S: { events: [], people: [], followups: [] },
    ETYPES: { quality: { w: 3 } },
    window: { TEND_CLOUD_MODE: !!cloud, TendCloudPersistence: cloud },
    document: { addEventListener() {} },
    save() {},
    render() {},
    uid() { return "completion-1"; },
    flash() {}
  };
  vm.createContext(context);
  vm.runInContext(actionsSource, context);
  return context;
}

test("adding, editing, and clearing a completion note does not create or retime an event", () => {
  const context = actionsContext();
  const event = vm.runInContext('logEvent("marriage","amy","quality","Date Night","",123456789,"rhythm-1")', context);
  assert.equal(context.S.events.length, 1);
  assert.equal(event.ts, 123456789);

  let savedNote;
  context.tendSaveRhythmCompletionNote(event.id, "  Dinner by the lake  ", note => { savedNote = note; }, error => { throw error; });
  assert.equal(savedNote, "Dinner by the lake");
  assert.equal(event.completionNote, "Dinner by the lake");
  assert.equal(context.S.events.length, 1);
  assert.equal(event.ts, 123456789);

  context.tendSaveRhythmCompletionNote(event.id, "", note => { savedNote = note; }, error => { throw error; });
  assert.equal(savedNote, "");
  assert.equal(Object.hasOwn(event, "completionNote"), false);
  assert.equal(context.S.events.length, 1);
  assert.equal(event.ts, 123456789);
});

test("cloud save failure retains the previous note and reports the error", async () => {
  const cloud = {
    isReady() { return true; },
    flush() { return Promise.resolve(); },
    getStatus() { return "Needs attention"; }
  };
  const context = actionsContext({ cloud });
  const event = { id: "event-1", ts: 1234, rhythmId: "rhythm-1", completionNote: "Original" };
  context.S.events.push(event);
  let failure;
  await new Promise(resolve => {
    context.tendSaveRhythmCompletionNote(event.id, "Edited", () => resolve(), error => { failure = error; resolve(); });
  });
  assert.match(failure.message, /could not save/i);
  assert.equal(event.completionNote, "Original");
  assert.equal(event.ts, 1234);
  assert.equal(context.S.events.length, 1);
});

test("fitness completion regeneration preserves its event-specific memory", () => {
  const context = {
    S: {
      events: [{ id: "fitness-rhythm-log-1", fitnessLogId: "log-1", rhythmId: "fit-1", completionNote: "Long walk" }],
      areaRhythms: [{ id: "fit-1", fitnessType: "workout", text: "Strength" }]
    },
    document: { addEventListener() {} },
    fitnessValidDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
  };
  vm.createContext(context);
  vm.runInContext(fitnessDataSource, context);
  vm.runInContext('fitnessSyncRhythmCompletion({id:"log-1",rhythmId:"fit-1",rhythmOccurrence:"2026-10-09",fitnessType:"workout"})', context);
  assert.equal(context.S.events.length, 1);
  assert.equal(context.S.events[0].completionNote, "Long walk");
  assert.equal(context.S.events[0].ts, new Date("2026-10-09T12:00:00").getTime());
});

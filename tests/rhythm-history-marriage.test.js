"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const historySource = fs.readFileSync(path.join(__dirname, "..", "rhythm-history.js"), "utf8");

test("Marriage Rhythm history shows frequency-aware consistency while retaining all completion records", () => {
  const rhythm = {
    id: "date-night",
    text: "Date Night",
    description: "Intentional time together.",
    areas: ["marriage"],
    freq: "weekly",
    weekdays: [5],
    added: "2026-10-03"
  };
  const events = [
    { id: "event-1", rhythmId: rhythm.id, ts: new Date(2026, 8, 25, 17).getTime(), note: "First" },
    { id: "event-2", rhythmId: rhythm.id, ts: new Date(2026, 9, 2, 17).getTime(), note: "Second", completionNote: "A walk together" },
    { id: "event-3", rhythmId: rhythm.id, ts: new Date(2026, 9, 9, 17).getTime(), note: "Third", completionNote: "Tea < & talk" },
    { id: "event-4", rhythmId: rhythm.id, ts: new Date(2026, 9, 9, 18).getTime(), completionNote: "A second moment that day" }
  ];
  const person = { id: "amy", name: "Amy", rhythms: [rhythm] };
  const scroll = { scrollWidth: 0, clientWidth: 0, scrollLeft: 0 };
  const hint = { hidden: false };
  const dialog = {
    innerHTML: "",
    setAttribute() {},
    addEventListener() {},
    insertAdjacentHTML(_position, html) { this.innerHTML += html; },
    querySelector(selector) { return selector === ".history-scroll" ? scroll : selector === ".history-scroll-hint" ? hint : null; }
  };
  const context = {
    S: { events, people: [person], rhythms: [], areaRhythms: [] },
    window: {
      tendMarriageRhythmConsistency() {
        return {
          score: 50,
          consistency: 50,
          completed: 1,
          expected: 2,
          missed: 1,
          overdueAdjustment: 0,
          window: { label: "Last 12 weeks" },
          occurrences: [
            { date: "2026-10-02", status: "completed" },
            { date: "2026-10-09", status: "missed" },
            { date: "2026-10-16", status: "upcoming" }
          ],
          eligible: true
        };
      }
    },
    document: { getElementById() { return null; }, createElement() { return dialog; }, body: { appendChild() {} } },
    personAvatar() { return '<span class="avatar">A</span>'; },
    rhythmFreqLabel() { return "Weekly · Friday"; },
    rhythmPeriod() { return 7; },
    todayStr() { return "2026-10-16"; },
    recNormRule(record) { return { freq: record.freq, weekdays: record.weekdays }; },
    scheduleHealthScore() { return 100; },
    recDayString(date) { return date.toISOString().slice(0, 10); },
    TODS: {},
    DOW_SHORT: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    esc(value) { return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
    tendShowModal() {}
  };
  vm.createContext(context);
  vm.runInContext(historySource, context);

  context.openRhythmHistory("amy|date-night");

  assert.match(dialog.innerHTML, /Your Momentum/);
  assert.match(dialog.innerHTML, /aria-label="50 out of 100"/);
  assert.match(dialog.innerHTML, /Let's build momentum\./);
  assert.match(dialog.innerHTML, /You've completed 1 of your last 2 scheduled Date Nights\./);
  assert.match(dialog.innerHTML, /Last 12 weeks · 1 of 2 completed/);
  assert.match(dialog.innerHTML, /data-momentum-info/);
  assert.match(dialog.innerHTML, /How Momentum Works/);
  assert.match(dialog.innerHTML, /One completion won't automatically erase a long period of missed commitments/);
  assert.match(dialog.innerHTML, /See the numbers/);
  assert.match(dialog.innerHTML, /Expected occurrences<\/dt><dd>2<\/dd>/);
  assert.match(dialog.innerHTML, /Completed occurrences<\/dt><dd>1<\/dd>/);
  assert.match(dialog.innerHTML, /Missed occurrences<\/dt><dd>1<\/dd>/);
  assert.match(dialog.innerHTML, /Historical consistency<\/dt><dd>50%<\/dd>/);
  assert.match(dialog.innerHTML, /Overdue adjustment<\/dt><dd>−0 points<\/dd>/);
  assert.match(dialog.innerHTML, /Final Momentum Score<\/dt><dd>50%<\/dd>/);
  assert.match(dialog.innerHTML, /Your last 2 date nights/);
  assert.match(dialog.innerHTML, /is-completed/);
  assert.match(dialog.innerHTML, /is-missed/);
  assert.match(dialog.innerHTML, /is-upcoming/);
  assert.match(dialog.innerHTML, /All completion history/);
  assert.match(dialog.innerHTML, /Logged moments \(4\)/);
  assert.match(dialog.innerHTML, /2 memories/);
  assert.match(dialog.innerHTML, /Tea &lt; &amp; talk/);
  assert.match(dialog.innerHTML, /data-history-event="event-3"/);
  assert.match(dialog.innerHTML, /data-history-note-save="event-4"/);
  for (const event of events) assert.ok(dialog.innerHTML.includes(event.id) || dialog.innerHTML.includes(event.note));
});

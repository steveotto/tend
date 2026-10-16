"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dashboardSource = fs.readFileSync(path.join(__dirname, "..", "app-dashboard.js"), "utf8");
const renderStart = dashboardSource.indexOf("function renderCalStrip(evs,errs,totalSources){");
const renderEnd = dashboardSource.indexOf("\nwindow.TEND_LOAD_CALENDAR", renderStart);
const renderCalendarSource = dashboardSource.slice(renderStart, renderEnd);

function renderCalendar(events, errors, totalSources) {
  const strip = { innerHTML: "" };
  const context = {
    Date,
    window: {},
    el: id => id === "calStrip" ? strip : null,
    esc: value => String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]),
    fmtT: () => "9am",
    fmtD: () => "Today",
    rangeTxt: () => "9am – 10am"
  };
  vm.createContext(context);
  vm.runInContext(renderCalendarSource, context);
  context.renderCalStrip(events, errors, totalSources);
  return { html: strip.innerHTML, events: context.window._tendCalendarEvents };
}

test("all failed calendars show only an error and retry instead of a clear-calendar state", () => {
  const { html } = renderCalendar([], ["Work", "Personal"], 2);

  assert.match(html, /Could not load: Work, Personal/);
  assert.match(html, /data-calretry="1"/);
  assert.doesNotMatch(html, /Your calendar is clear today|A little room to breathe/);
});

test("partially loaded calendars show available events and disclose unavailable sources", () => {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const event = { t: "Team check-in", s: start.getTime(), e: start.getTime() + 3600000, cal: "Work" };
  const { html, events } = renderCalendar([event], ["Personal"], 2);

  assert.match(html, /Some calendars are unavailable: Personal/);
  assert.match(html, /Events from available calendars are shown/);
  assert.match(html, /Team check-in/);
  assert.match(html, /data-calretry="1"/);
  assert.equal(events.length, 1);
});

test("partial calendar failure without today's events is not reported as a clear calendar", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const event = { t: "Tomorrow", s: tomorrow.getTime(), e: tomorrow.getTime() + 3600000, cal: "Work" };
  const { html } = renderCalendar([event], ["Personal"], 2);

  assert.match(html, /Some calendars are unavailable: Personal/);
  assert.match(html, /data-calretry="1"/);
  assert.doesNotMatch(html, /Your calendar is clear today|A little room to breathe/);
});

test("a successfully loaded empty calendar still shows the clear-calendar state", () => {
  const { html } = renderCalendar([]);

  assert.match(html, /Your calendar is clear today/);
});

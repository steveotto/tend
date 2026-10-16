"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app-timewheel.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "tend.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("time wheel preserves midnight, noon, and 8:28 PM conversions", () => {
  const helpers = [
    source.match(/function parseTime\(value\)\{[\s\S]*?\n \}/)[0],
    source.match(/function timeString\(value\)\{[\s\S]*?\n \}/)[0]
  ].join("\n");
  const context = vm.createContext({});
  const conversions = vm.runInContext(`${helpers};({parseTime:parseTime,timeString:timeString})`, context);

  const midnight = conversions.parseTime("00:28");
  assert.equal(midnight.hour, 12);
  assert.equal(midnight.minute, 28);
  assert.equal(midnight.period, "AM");
  assert.equal(conversions.timeString(midnight), "00:28");

  const noon = conversions.parseTime("12:00");
  assert.equal(noon.hour, 12);
  assert.equal(noon.period, "PM");
  assert.equal(conversions.timeString(noon), "12:00");

  const evening = conversions.parseTime("20:28");
  assert.equal(evening.hour, 8);
  assert.equal(evening.minute, 28);
  assert.equal(evening.period, "PM");
  assert.equal(conversions.timeString(evening), "20:28");
});

test("wheel taps step one value based on center and preserve the existing wrap behavior", () => {
  const helpers = [
    source.match(/function wheelClickDirection\(y,center\)\{[\s\S]*?\n \}/)[0],
    source.match(/function wheelStepIndex\(index,direction,length\)\{[\s\S]*?\n \}/)[0]
  ].join("\n");
  const context = vm.createContext({});
  const steps = vm.runInContext(`${helpers};({direction:wheelClickDirection,step:wheelStepIndex})`, context);

  assert.equal(steps.direction(99, 100), -1);
  assert.equal(steps.direction(100, 100), 0);
  assert.equal(steps.direction(101, 100), 1);
  assert.equal(steps.step(7, steps.direction(99, 100), 12), 6);
  assert.equal(steps.step(0, -1, 12), 11);
  assert.equal(steps.step(59, 1, 60), 0);
  assert.equal(steps.step(0, 1, 2), 1);
  assert.equal(steps.step(1, -1, 2), 0);
});

test("time wheel uses separate stationary center bands and measured option centering", () => {
  assert.match(source, /time-wheel-labels[^]*time-wheel-viewports/);
  assert.match(source, /time-wheel-viewport"><div class="time-wheel-selection-band" aria-hidden="true"><\/div><div class="time-wheel-column"/);
  assert.match(source, /Math\.max\(0,\(height-ROW_HEIGHT\)\/2\)/);
  assert.match(source, /optionRect\.top\+optionRect\.height\/2-\(viewportRect\.top\+viewport\.clientHeight\/2\)/);
  assert.match(source, /wheelClickDirection\(event\.clientY,center\)/);
  assert.match(source, /wheelStepIndex\(listValues\[name\]\.indexOf\(values\[name\]\),direction,listValues\[name\]\.length\)/);
  assert.match(source, /if\(programmatic\[name\]\)return/);
  assert.match(source, /Math\.abs\(event\.clientY-pointerGesture\.startY\)>5/);
  assert.match(source, /getValue:function\(\)\{Object\.keys\(values\)\.forEach\(function\(name\)\{if\(!programmatic\[name\]\)updateFromScroll/);
  assert.match(styles, /\.time-wheel-selection-band\{[^}]*pointer-events:none/);
  assert.match(styles, /\.time-wheel-viewport\{[^}]*height:210px/);
  assert.match(styles, /\.time-wheel-viewports\{[^}]*grid-template-columns:1fr 1fr \.85fr;gap:6px/);
  assert.match(styles, /\.time-wheel-options\{padding-block:0\}/);
  assert.match(index, /app-timewheel\.js\?v=20261015-time-wheel-three-highlights-tap-step/);
  assert.match(index, /app-sync\.js\?v=0\.9\.1/);
});

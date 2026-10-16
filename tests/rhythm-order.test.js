"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-rhythm-order.js"), "utf8");

function createContext(options = {}) {
  const messages = [];
  const context = {
    S: options.state || {},
    save: options.save || (() => {}),
    flash: message => messages.push(message),
    esc: value => String(value),
    document: {
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null
    },
    window: {
      TEND_CLOUD_MODE: false,
      addEventListener() {}
    },
    messages
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("rhythm order is context-specific and leaves unranked items in their default order", () => {
  const context = createContext({
    state: {
      rhythmOrder: {
        "person:amy": ["b", "stale"],
        "person:sam": ["c"]
      }
    }
  });

  test("Me order persists independently from Today, person, and category order", () => {
    const context = createContext({
      state: {
        rhythmOrder: {
          me: ["area:walk", "person:amy:read"],
          "today:morning": ["today-id"],
          "person:amy": ["person:amy:read"],
          "category:health": ["area:walk"]
        }
      }
    });
    assert.equal(
      context.tendRhythmOrderPersist("me", ["area:walk", "person:amy:read"], ["area:walk", "person:amy:read"], ["person:amy:read", "area:walk"]),
      true
    );
    assert.deepEqual(Array.from(context.S.rhythmOrder.me), ["person:amy:read", "area:walk"]);
    assert.deepEqual(Array.from(context.S.rhythmOrder["today:morning"]), ["today-id"]);
    assert.deepEqual(Array.from(context.S.rhythmOrder["person:amy"]), ["person:amy:read"]);
    assert.deepEqual(Array.from(context.S.rhythmOrder["category:health"]), ["area:walk"]);
  });
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  assert.deepEqual(
    Array.from(context.tendRhythmOrderSort("person:amy", items, item => item.id), item => item.id),
    ["b", "a", "c"]
  );
  assert.deepEqual(
    Array.from(context.tendRhythmOrderSort("person:sam", items, item => item.id), item => item.id),
    ["c", "a", "b"]
  );
});

test("moving visible rhythms preserves hidden rhythms and their relative order", () => {
  const context = createContext({
    state: { rhythmOrder: { "category:marriage": ["a", "hidden-b", "c", "hidden-d"] } }
  });

  assert.equal(
    context.tendRhythmOrderPersist(
      "category:marriage",
      ["a", "hidden-b", "c", "hidden-d"],
      ["a", "c"],
      ["c", "a"]
    ),
    true
  );
  assert.deepEqual(
    Array.from(context.S.rhythmOrder["category:marriage"]),
    ["c", "hidden-b", "a", "hidden-d"]
  );
});

test("reset clears only the requested context and Today groups", () => {
  let saves = 0;
  const context = createContext({
    state: {
      rhythmOrder: {
        "today:morning": ["a", "b"],
        "today:anytime": ["c", "d"],
        "person:amy": ["e", "f"]
      }
    },
    save: () => { saves += 1; }
  });

  assert.equal(context.tendRhythmOrderReset("today"), true);
  assert.deepEqual(Object.keys(context.S.rhythmOrder), ["person:amy"]);
  assert.equal(context.tendRhythmOrderReset("person:amy"), true);
  assert.equal(context.S.rhythmOrder, undefined);
  assert.equal(saves, 2);
});

test("save failures restore the prior order and surface an error", () => {
  const context = createContext({
    state: { rhythmOrder: { "person:amy": ["a", "b"] } },
    save: () => { throw new Error("storage is unavailable"); }
  });

  assert.equal(
    context.tendRhythmOrderPersist("person:amy", ["a", "b"], ["a", "b"], ["b", "a"]),
    false
  );
  assert.deepEqual(Array.from(context.S.rhythmOrder["person:amy"]), ["a", "b"]);
  assert.match(context.messages[0], /Could not save rhythm order/);
});

test("a failed reset restores the previous context", () => {
  const context = createContext({
    state: { rhythmOrder: { "today:morning": ["a", "b"], "person:amy": ["c", "d"] } },
    save: () => { throw new Error("storage is unavailable"); }
  });

  assert.equal(context.tendRhythmOrderReset("today"), false);
  assert.deepEqual(Array.from(context.S.rhythmOrder["today:morning"]), ["a", "b"]);
  assert.deepEqual(Array.from(context.S.rhythmOrder["person:amy"]), ["c", "d"]);
  assert.match(context.messages[0], /Could not reset rhythm order/);
});

test("Arrange controls are absent by default and expose touch and keyboard actions when enabled", () => {
  const context = createContext();
  const card = '<article class="rhythm-card">Walk</article>';

  assert.equal(
    context.tendRhythmOrderItemHTML("person:amy", "person:amy", "person:amy:walk", "Walk", 0, 2, card),
    card
  );
  context.tendRhythmArrangeContext = "person:amy";
  const row = context.tendRhythmOrderItemHTML(
    "person:amy",
    "person:amy",
    "person:amy:walk",
    "Walk",
    0,
    2,
    card
  );

  assert.match(row, /draggable="true" data-rhythm-order-handle aria-label="Drag to reorder Walk"/);
  assert.match(row, /aria-label="Move Walk up" disabled>Move up/);
  assert.match(row, /aria-label="Move Walk down">Move down/);
  assert.match(context.tendRhythmOrderToolbar("person:amy", 2), /aria-pressed="true">Done/);
  assert.match(
    context.tendRhythmOrderListAttributes("person:amy", ["person:amy:walk"]),
    /data-rhythm-order-list/
  );
});

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const cloudSource = fs.readFileSync(path.join(root, "app-cloud.js"), "utf8");
const authSource = fs.readFileSync(path.join(root, "app-auth.js"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "supabase/migrations/202610160001_private_tend_accounts.sql"), "utf8");

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    keys() { return Array.from(values.keys()); }
  };
}

function cloudHarness() {
  const localStorage = storage();
  const rows = new Map();
  let authUserId = "user-a";
  let holdNextRpc = false;
  let releaseHeldRpc;
  const client = {
    from(table) {
      return {
        select() {
          return {
            eq(_column, requestedUserId) {
              return {
                async maybeSingle() {
                  if (table !== "tend_user_state" || requestedUserId !== authUserId) return { data: null, error: null };
                  return { data: rows.get(authUserId) || null, error: null };
                }
              };
            }
          };
        }
      };
    },
    async rpc(_name, args) {
      const owner = authUserId;
      if (holdNextRpc) {
        holdNextRpc = false;
        await new Promise(resolve => { releaseHeldRpc = resolve; });
      }
      const row = rows.get(owner);
      if (!row && args.p_expected_revision !== 0) return { data: null, error: { code: "40001", message: "Stale revision" } };
      if (row && row.revision !== args.p_expected_revision) return { data: null, error: { code: "40001", message: "Stale revision" } };
      const next = {
        state: JSON.parse(JSON.stringify(args.p_state)),
        schema_version: args.p_schema_version,
        revision: row ? row.revision + 1 : 1,
        updated_at: new Date().toISOString()
      };
      rows.set(owner, next);
      return { data: [{ revision: next.revision, updated_at: next.updated_at }], error: null };
    }
  };
  const events = [];
  const listeners = {};
  const window = {
    TEND_CLOUD_MODE: true,
    TEND_SUPABASE_CONFIG: { url: "https://example.supabase.co", publishableKey: "public-key" },
    supabase: { createClient() { return client; } },
    localStorage,
    navigator: { onLine: true },
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatchEvent(event) { events.push(event); },
    _tendDirty: false
  };
  function CustomEvent(type, options) { this.type = type; this.detail = options && options.detail; }
  const context = { window, localStorage, CustomEvent, setTimeout, clearTimeout, console };
  vm.createContext(context);
  vm.runInContext(cloudSource, context);
  return {
    cloud: window.TendCloudPersistence,
    calendarCacheKey() { return window.tendCalendarCacheKey(); },
    localStorage,
    rows,
    events,
    setOnline(value) { window.navigator.onLine = value; },
    fire(name) { if (listeners[name]) listeners[name](); },
    setUser(id) { authUserId = id; },
    pauseNextRpc() { holdNextRpc = true; return () => releaseHeldRpc(); }
  };
}

test("cloud mode starts with a private empty state and never reads or overwrites the legacy state key", () => {
  const localStorage = storage();
  const legacy = JSON.stringify({ people: [{ id: "old-person" }], rhythms: [{ id: "old-rhythm" }] });
  localStorage.setItem("tend:state", legacy);
  const window = { TEND_CLOUD_MODE: true, _tendDirty: false };
  const context = { window, localStorage, setTimeout, clearTimeout, console, Math, Date };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  assert.equal(context.S.people.length, 0);
  assert.equal(context.S.rhythms.length, 0);
  assert.equal(context.S.calendars.length, 0);
  context.save();
  assert.equal(localStorage.getItem("tend:state"), legacy);
});

test("account caches are user-scoped and RLS hides another user's row", async () => {
  const harness = cloudHarness();
  await harness.cloud.initializeState("user-a", { people: [{ id: "a" }], events: [] });
  harness.setUser("user-b");
  const result = await harness.cloud.fetchUserState("user-a");
  assert.equal(result.row, null);
  assert.equal(harness.localStorage.getItem(harness.cloud.cacheKey("user-a")) !== null, true);
  assert.equal(harness.localStorage.getItem(harness.cloud.cacheKey("user-b")), null);
});

test("calendar event caches are isolated by signed-in account", async () => {
  const harness = cloudHarness();
  await harness.cloud.initializeState("user-a", { events: [] });
  const accountAKey = harness.calendarCacheKey();
  harness.cloud.deactivate();
  harness.cloud.activate("user-b", { events: [] }, 0, false);
  assert.notEqual(accountAKey, harness.calendarCacheKey());
  assert.notEqual(harness.calendarCacheKey(), "tend:cal2");
});

test("an atomic stale-revision failure preserves the device draft and the newer cloud row", async () => {
  const harness = cloudHarness();
  await harness.cloud.initializeState("user-a", { people: [], marker: "initial" });
  harness.rows.set("user-a", {
    state: { people: [], marker: "from-device-one" },
    revision: 2,
    schema_version: 1,
    updated_at: new Date().toISOString()
  });

  test("an in-flight save cannot write one account's cache into a switched account", async () => {
    const harness = cloudHarness();
    harness.cloud.activate("user-a", { marker: "account-a" }, 0, true);
    const release = harness.pauseNextRpc();
    const saveA = harness.cloud.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    harness.setUser("user-b");
    harness.cloud.activate("user-b", { marker: "account-b" }, 0, true);
    release();
    await saveA;
    await new Promise(resolve => setTimeout(resolve, 15));
    const cacheA = harness.cloud.readCache("user-a");
    const cacheB = harness.cloud.readCache("user-b");
    assert.equal(cacheA.state.marker, "account-a");
    assert.equal(cacheB.state.marker, "account-b");
    assert.equal(harness.rows.get("user-b").state.marker, "account-b");
  });

  test("changes made during a cloud save are serialized without losing the newest draft", async () => {
    const harness = cloudHarness();
    await harness.cloud.initializeState("user-a", { marker: "initial" });
    harness.cloud.activate("user-a", { marker: "initial" }, 1, false);
    const release = harness.pauseNextRpc();
    harness.cloud.queue({ marker: "first edit" });
    const saving = harness.cloud.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    harness.cloud.queue({ marker: "newest edit" });
    release();
    await saving;
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(harness.rows.get("user-a").state.marker, "newest edit");
    assert.equal(harness.cloud.readCache("user-a").state.marker, "newest edit");
    assert.equal(harness.cloud.getStatus(), "Saved");
  });

  test("manual GitHub recovery holds account autosaves until its transfer finishes", async () => {
    const harness = cloudHarness();
    await harness.cloud.initializeState("user-a", { marker: "cloud snapshot" });
    harness.cloud.activate("user-a", { marker: "cloud snapshot" }, 1, false);
    const snapshot = await harness.cloud.beginLegacyTransfer();
    harness.cloud.queue({ marker: "newer account edit" });
    assert.equal(harness.rows.get("user-a").state.marker, "cloud snapshot");
    assert.equal(snapshot.marker, "cloud snapshot");
    harness.cloud.endLegacyTransfer();
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(harness.rows.get("user-a").state.marker, "newer account edit");
  });
  test("offline edits remain account-scoped and save with revision checks after reconnecting", async () => {
    const harness = cloudHarness();
    await harness.cloud.initializeState("user-a", { marker: "initial" });
    harness.cloud.activate("user-a", { marker: "initial" }, 1, false);
    harness.setOnline(false);
    harness.cloud.queue({ marker: "offline edit" });
    assert.equal(harness.cloud.getStatus(), "Offline");
    assert.equal(harness.cloud.readCache("user-a").state.marker, "offline edit");
    harness.setOnline(true);
    harness.fire("online");
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(harness.rows.get("user-a").state.marker, "offline edit");
    assert.equal(harness.cloud.getStatus(), "Saved");
  });
  const localDraft = { people: [], marker: "unsynced-device-two" };
  harness.cloud.activate("user-a", localDraft, 1, true);
  await harness.cloud.flush();
  harness.cloud.queue({ people: [], marker: "edited-after-conflict" });
  const cache = harness.cloud.readCache("user-a");
  assert.equal(harness.cloud.getStatus(), "Needs attention");
  assert.equal(cache.conflict.draft.marker, "edited-after-conflict");
  assert.equal(cache.conflict.cloudState.marker, "from-device-one");
  assert.equal(harness.rows.get("user-a").state.marker, "from-device-one");
});

test("exports and cloud saves strip legacy sync secrets without changing ordinary fields", async () => {
  const harness = cloudHarness();
  const state = {
    people: [{ id: "p", name: "Person" }],
    syncToken: "legacy-sync-secret",
    githubToken: "old-github-secret",
    token: "generic-secret",
    settings: { color: "green" }
  };
  const clean = harness.cloud.sanitize(state);
  assert.deepEqual(JSON.parse(JSON.stringify(clean)), {
    people: [{ id: "p", name: "Person" }],
    settings: { color: "green" }
  });
  await harness.cloud.initializeState("user-a", state);
  assert.equal(Object.hasOwn(harness.rows.get("user-a").state, "githubToken"), false);
});

test("auth UI supports email signup, login, recovery, reset, and logout with Supabase APIs", async () => {
  const handlers = {};
  const authCalls = [];
  let authListener;
  const user = { id: "user-a", email: "person@example.com", user_metadata: { display_name: "Person" } };
  let session = { user };
  const client = {
    auth: {
      onAuthStateChange(callback) { authListener = callback; },
      async getSession() { authCalls.push(["getSession"]); return { data: { session }, error: null }; },
      async signUp(args) { authCalls.push(["signUp", args]); return { data: { session: null }, error: null }; },
      async signInWithPassword(args) { authCalls.push(["signInWithPassword", args]); session = { user }; return { data: { session }, error: null }; },
      async resetPasswordForEmail(email, args) { authCalls.push(["resetPasswordForEmail", email, args]); return { data: {}, error: null }; },
      async updateUser(args) { authCalls.push(["updateUser", args]); return { data: { user }, error: null }; },
      async signOut() { authCalls.push(["signOut"]); session = null; return { error: null }; }
    },
    from() {
      return {
        select() { return { eq() { return { async maybeSingle() { return { data: { display_name: "Person" }, error: null }; } }; } }; }
      };
    }
  };
  const cloud = {
    client,
    enabled: true,
    async fetchUserState() { return { row: { state: { people: [], events: [], tasks: [], followups: [], prayers: [], ideas: [], echoes: [], keyDates: [], checklists: [], settings: {}, rhythms: [], categories: {}, faithConfig: {}, calendars: [], areas: {}, fitness: {} }, revision: 1 }, cache: null }; },
    readCache() { return null; },
    activate() { this.ready = true; },
    isReady() { return !!this.ready; },
    deactivate() { this.ready = false; },
    getStatus() { return "Saved"; },
    getConflictDraft() { return null; },
    cacheKey(id) { return "account:" + id; },
    sanitize(value) { return value; },
    clone(value) { return JSON.parse(JSON.stringify(value)); },
    async initializeState() { this.ready = true; },
    async replaceState() {},
    revision() { return 1; },
    isConflicted() { return false; },
    keepCloudState() {},
    async fetchLatestState() { return null; }
  };
  const view = { innerHTML: "" };
  const authMessage = { textContent: "", className: "" };
  const body = { classList: { toggle() {} } };
  const document = {
    body,
    visibilityState: "hidden",
    querySelector() { return { hidden: false }; },
    getElementById(id) { return id === "view" ? view : id === "tendAuthMessage" ? authMessage : null; },
    addEventListener(name, handler) { handlers[name] = handler; }
  };
  const window = {
    TEND_CLOUD_MODE: true,
    TEND_SUPABASE_CONFIG: { redirectUrl: "https://steveotto.github.io/tend/" },
    TendCloudPersistence: cloud,
    localStorage: storage(),
    location: { hostname: "steveotto.github.io", origin: "https://steveotto.github.io", pathname: "/tend/", hash: "" },
    navigator: { onLine: true },
    addEventListener() {},
    dispatchEvent() {},
    confirm() { return true; },
    prompt() { return "person@example.com"; },
    setTimeout
  };
  function FormData(form) { return { get(name) { return form.values[name]; } }; }
  const context = {
    window, document, navigator: window.navigator, FormData, setTimeout, clearTimeout, console,
    S: {}, LS_STATE: "tend:state", tab: "today", settingsTab: "account",
    ensureShape(value) { return value; },
    emptyAccountState() { return { people: [], events: [] }; },
    render() {},
    updateSyncDot() {},
    flash() {},
    esc(value) { return String(value); }
  };
  vm.createContext(context);
  vm.runInContext(authSource, context);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(cloud.ready, true, "an existing Supabase session should restore the private account before the app is shown");
  assert.equal(window.TendAuth.displayName(), "Person");
  assert.equal(authCalls.some(call => call[0] === "getSession"), true);
  const submit = async (id, values) => {
    const form = {
      id,
      values,
      isConnected: true,
      matches(selector) { return selector.includes("#" + id); },
      querySelector() { return { disabled: false, isConnected: true }; }
    };
    await handlers.submit({ target: form, preventDefault() {} });
  };
  const click = async (attribute, value) => {
    const button = {
      hasAttribute(name) { return name === attribute; },
      getAttribute(name) { return name === attribute ? value : null; },
      closest() { return this; }
    };
    handlers.click({ target: button, preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 5));
  };
  await click("data-auth-mode", "signup");
  await submit("tendAuthForm", { displayName: "Person", email: "person@example.com", password: "long-password" });
  const signup = authCalls.find(call => call[0] === "signUp");
  assert.deepEqual(JSON.parse(JSON.stringify(signup[1].options.data)), { display_name: "Person" });
  assert.equal(signup[1].options.emailRedirectTo, "https://steveotto.github.io/tend/");

  await click("data-auth-mode", "signin");
  await submit("tendAuthForm", { email: "person@example.com", password: "long-password" });
  assert.deepEqual(JSON.parse(JSON.stringify(authCalls.find(call => call[0] === "signInWithPassword").slice(1))), [{ email: "person@example.com", password: "long-password" }]);

  await click("data-auth-forgot");
  await submit("tendResetRequestForm", { email: "person@example.com" });
  assert.deepEqual(JSON.parse(JSON.stringify(authCalls.find(call => call[0] === "resetPasswordForEmail").slice(1))), ["person@example.com", { redirectTo: "https://steveotto.github.io/tend/" }]);
  authListener("PASSWORD_RECOVERY", { user });
  await new Promise(resolve => setTimeout(resolve, 5));
  await submit("tendPasswordResetForm", { password: "new-long-password" });
  assert.deepEqual(JSON.parse(JSON.stringify(authCalls.find(call => call[0] === "updateUser").slice(1))), [{ password: "new-long-password" }]);
  await click("data-account-sign-out");
  assert.equal(authCalls.some(call => call[0] === "signOut"), true);
});

test("migration grants and RLS policies enforce ownership and revision-checked writes", () => {
  assert.match(migrationSource, /enable row level security/i);
  assert.match(migrationSource, /using \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(migrationSource, /with check \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(migrationSource, /revoke all on table public\.tend_user_state from public, anon, authenticated/i);
  assert.match(migrationSource, /grant execute on function public\.tend_save_user_state\(jsonb, bigint, integer\) to authenticated/i);
  assert.match(migrationSource, /current_state\.revision = p_expected_revision/i);
  assert.match(migrationSource, /errcode = '40001'/i);
});

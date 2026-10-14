"use strict";
window.TendCloudPersistence = (function () {
  var config = window.TEND_SUPABASE_CONFIG || {};
  var enabled = !!window.TEND_CLOUD_MODE;
  var client = enabled && window.supabase
    ? window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: window.localStorage,
        storageKey: "tend:supabase-auth"
      }
    })
    : null;
  var activeUserId = null;
  var revision = 0;
  var active = false;
  var pending = false;
  var conflicted = false;
  var legacyTransfer = false;
  var generation = 0;
  var activationEpoch = 0;
  var status = "Loading";
  var timer = null;
  var inFlight = null;
  var conflictDraft = null;
  var workingState = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function cacheKey(userId) {
    return "tend:account-cache:" + encodeURIComponent(userId);
  }
  window.tendCalendarCacheKey = function () {
    if (!enabled) return "tend:cal2";
    return "tend:cal2:" + encodeURIComponent(activeUserId || "unassigned");
  };
  window.clearTendCalendarCache = function () {
    window.localStorage.removeItem(window.tendCalendarCacheKey());
  };
  function sanitize(value) {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object") return value;
    var output = {};
    Object.keys(value).forEach(function (key) {
      if (/^(?:token|sync.?token|gh.?token|github.?token|github.?pat|github.?access.?token|personal.?access.?token|access_token|refresh_token|service_role|service_role_key|secret_key)$/i.test(key)) return;
      output[key] = sanitize(value[key]);
    });
    return output;
  }
  function readCache(userId) {
    var raw;
    try {
      raw = window.localStorage.getItem(cacheKey(userId));
    } catch (error) {
      return { userId: userId, corrupt: true, error: error.message };
    }
    if (!raw) return null;
    try {
      var value = JSON.parse(raw);
      if (!value || value.userId !== userId || !value.state || typeof value.state !== "object") throw new Error("Invalid account cache");
      return value;
    } catch (error) {
      return { userId: userId, corrupt: true, error: error.message };
    }
  }
  function writeCache(extra) {
    if (!activeUserId) return false;
    var previous = readCache(activeUserId);
    if (previous && previous.corrupt) {
      try {
        var broken = window.localStorage.getItem(cacheKey(activeUserId));
        if (broken) window.localStorage.setItem("tend:recovery-cache:" + encodeURIComponent(activeUserId), broken);
      } catch (error) {
        console.error("Tend could not preserve the previous device cache", error);
        return false;
      }
    }
    var record = Object.assign({}, previous && !previous.corrupt ? previous : {}, {
      userId: activeUserId,
      revision: revision,
      schemaVersion: 1,
      pending: pending,
      state: extra && extra.state ? sanitize(extra.state) : (previous && !previous.corrupt ? previous.state : null)
    }, extra || {});
    if (!record.state) return false;
    try {
      window.localStorage.setItem(cacheKey(activeUserId), JSON.stringify(sanitize(record)));
      return true;
    } catch (error) {
      console.error("Tend could not save the local account cache", error);
      return false;
    }
  }
  function emitStatus(next) {
    status = next;
    window.dispatchEvent(new CustomEvent("tend-cloud-status", { detail: { status: status } }));
  }
  function isOnline() {
    return !window.navigator || window.navigator.onLine !== false;
  }
  function isConflictError(error) {
    return !!error && (error.code === "40001" || /revision conflict|stale revision/i.test(error.message || ""));
  }
  async function fetchUserState(userId) {
    if (!client) throw new Error("Supabase is not configured.");
    var result = await client.from("tend_user_state")
      .select("state,schema_version,revision,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data && (!result.data.state || typeof result.data.state !== "object" || Array.isArray(result.data.state))) {
      throw new Error("The cloud account data is invalid. No local data was changed.");
    }
    return { row: result.data || null, cache: readCache(userId) };
  }
  async function fetchLatestState(userId) {
    var result = await client.from("tend_user_state")
      .select("state,schema_version,revision,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }
  async function writeState(userId, state, expectedRevision) {
    var result = await client.rpc("tend_save_user_state", {
      p_state: sanitize(state),
      p_expected_revision: expectedRevision,
      p_schema_version: 1
    });
    if (result.error) throw result.error;
    var row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row || !Number.isInteger(Number(row.revision))) throw new Error("The cloud save returned no new revision.");
    return { revision: Number(row.revision), updatedAt: row.updated_at };
  }
  function activate(userId, state, serverRevision, hasPendingChanges) {
    activationEpoch++;
    activeUserId = userId;
    revision = Number(serverRevision) || 0;
    active = true;
    pending = !!hasPendingChanges;
    conflicted = false;
    conflictDraft = null;
    generation++;
    workingState = sanitize(state);
    window._tendDirty = pending;
    var cached = writeCache({ state: state, revision: revision, pending: pending, conflict: null });
    emitStatus(!cached ? "Needs attention" : pending ? (isOnline() ? "Saving" : "Offline") : (isOnline() ? "Saved" : "Offline"));
    if (pending && isOnline()) scheduleFlush(0);
  }
  function scheduleFlush(delay) {
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }
  function queue(state) {
    if (!active || !activeUserId) return;
    if (conflicted) {
      var cachedConflict = readCache(activeUserId);
      var cloudState = cachedConflict && cachedConflict.conflict && cachedConflict.conflict.cloudState;
      conflictDraft = sanitize(state);
      workingState = conflictDraft;
      window._tendDirty = false;
      writeCache({
        state: cloudState || (cachedConflict && cachedConflict.state),
        pending: false,
        conflict: { draft: conflictDraft, cloudState: cloudState || null, revision: cachedConflict && cachedConflict.revision, cloudRevision: revision }
      });
      emitStatus("Needs attention");
      return;
    }
    generation++;
    pending = true;
    workingState = sanitize(state);
    window._tendDirty = true;
    var cached = writeCache({ state: state, pending: true });
    if (!isOnline()) {
      emitStatus(cached ? "Offline" : "Needs attention");
      return;
    }
    emitStatus(cached ? "Saving" : "Needs attention");
    if (!legacyTransfer) scheduleFlush(850);
  }
  async function flush() {
    if (inFlight) return inFlight;
    if (!active || !pending || conflicted || legacyTransfer || !isOnline()) {
      if (active && pending && !isOnline()) emitStatus("Offline");
      return;
    }
    var flushEpoch = activationEpoch;
    inFlight = (async function () {
      while (active && pending && !conflicted && isOnline()) {
        var saveUserId = activeUserId;
        var saveEpoch = activationEpoch;
        var saveGeneration = generation;
        var expectedRevision = revision;
        var cached = readCache(saveUserId);
        if ((!cached || cached.corrupt || !cached.state) && workingState) {
          cached = { state: workingState, revision: revision };
        }
        if (!cached || cached.corrupt || !cached.state) {
          emitStatus("Needs attention");
          return;
        }
        try {
          var saved = await writeState(saveUserId, cached.state, expectedRevision);
          if (!active || activeUserId !== saveUserId || activationEpoch !== saveEpoch) return;
          revision = saved.revision;
          var stillCurrent = generation === saveGeneration;
          if (stillCurrent) {
            pending = false;
            workingState = sanitize(cached.state);
            window._tendDirty = false;
          }
          writeCache(stillCurrent
            ? { state: cached.state, revision: revision, pending: false, conflict: null }
            : { revision: revision, pending: true, conflict: null });
          emitStatus(pending ? "Saving" : "Saved");
        } catch (error) {
          if (isConflictError(error)) {
            var latest;
            try {
              latest = await fetchLatestState(saveUserId);
            } catch (refreshError) {
              if (!active || activeUserId !== saveUserId || activationEpoch !== saveEpoch) return;
              console.error("Tend could not read the latest cloud revision after a conflict", refreshError);
              emitStatus("Needs attention");
              return;
            }
            if (!active || activeUserId !== saveUserId || activationEpoch !== saveEpoch) return;
            var currentDraft = readCache(saveUserId);
            conflictDraft = currentDraft && !currentDraft.corrupt && currentDraft.state ? currentDraft.state : cached.state;
            workingState = sanitize(conflictDraft);
            conflicted = true;
            pending = false;
            window._tendDirty = false;
            writeCache({
              state: latest && latest.state ? latest.state : cached.state,
              revision: latest ? Number(latest.revision) : revision,
              pending: false,
              conflict: { draft: conflictDraft, cloudState: latest ? latest.state : null, revision: currentDraft && currentDraft.revision, cloudRevision: latest ? Number(latest.revision) : null }
            });
            emitStatus("Needs attention");
            window.dispatchEvent(new CustomEvent("tend-cloud-conflict", { detail: { draft: clone(conflictDraft), cloud: latest } }));
            return;
          }
          console.error("Tend cloud save failed", error);
          emitStatus(isOnline() ? "Needs attention" : "Offline");
          return;
        }
      }
    })().finally(function () {
      inFlight = null;
      if (active && pending && !conflicted && isOnline() && activationEpoch !== flushEpoch) scheduleFlush(0);
    });
    return inFlight;
  }
  function setConflictDraft(state, cloudRevision, cloudState) {
    conflictDraft = sanitize(state);
    workingState = conflictDraft;
    conflicted = true;
    revision = Number(cloudRevision) || 0;
    pending = false;
    writeCache({ state: cloudState || undefined, conflict: { draft: conflictDraft, cloudState: cloudState || null, revision: null, cloudRevision: revision }, pending: false });
    emitStatus("Needs attention");
  }
  function getConflictDraft() {
    if (conflictDraft) return clone(conflictDraft);
    var cache = activeUserId && readCache(activeUserId);
    return cache && cache.conflict && cache.conflict.draft ? clone(cache.conflict.draft) : null;
  }
  function keepCloudState(state, cloudRevision) {
    if (!activeUserId) return;
    conflicted = false;
    conflictDraft = null;
    revision = Number(cloudRevision) || 0;
    pending = false;
    workingState = sanitize(state);
    window._tendDirty = false;
    generation++;
    writeCache({ state: state, revision: revision, pending: false, conflict: null });
    emitStatus(isOnline() ? "Saved" : "Offline");
  }
  async function initializeState(userId, state) {
    activeUserId = userId;
    if (!isOnline()) {
      activate(activeUserId, state, 0, true);
      return { offline: true };
    }
    var saved = await writeState(activeUserId, state, 0);
    activate(activeUserId, state, saved.revision, false);
    return saved;
  }
  function replaceState(state) {
    if (!active) throw new Error("Your account data has not finished loading.");
    conflicted = false;
    conflictDraft = null;
    queue(state);
    return flush();
  }
  async function beginLegacyTransfer() {
    if (!active || !activeUserId || conflicted) throw new Error("Resolve account sync attention before using GitHub recovery.");
    if (!isOnline()) throw new Error("Connect to the internet before using GitHub recovery.");
    if (pending) await flush();
    if (status !== "Saved" || pending) throw new Error("Save the account data to Supabase before using GitHub recovery.");
    legacyTransfer = true;
    return clone(workingState);
  }
  function endLegacyTransfer() {
    legacyTransfer = false;
    if (active && pending && !conflicted && isOnline()) {
      emitStatus("Saving");
      scheduleFlush(0);
    } else if (active && !conflicted) emitStatus(isOnline() ? "Saved" : "Offline");
  }
  function deactivate() {
    clearTimeout(timer);
    active = false;
    activeUserId = null;
    revision = 0;
    pending = false;
    conflicted = false;
    legacyTransfer = false;
    conflictDraft = null;
    workingState = null;
    generation++;
    activationEpoch++;
    emitStatus("Loading");
  }
  window.addEventListener("online", function () {
    if (!active) return;
    if (pending && !conflicted) {
      emitStatus("Saving");
      scheduleFlush(0);
    } else if (conflicted) emitStatus("Needs attention");
    else emitStatus("Saved");
  });
  window.addEventListener("offline", function () {
    if (active) emitStatus("Offline");
  });
  return {
    enabled: enabled,
    client: client,
    sanitize: sanitize,
    clone: clone,
    cacheKey: cacheKey,
    readCache: readCache,
    fetchUserState: fetchUserState,
    fetchLatestState: fetchLatestState,
    activate: activate,
    initializeState: initializeState,
    replaceState: replaceState,
    beginLegacyTransfer: beginLegacyTransfer,
    endLegacyTransfer: endLegacyTransfer,
    queue: queue,
    flush: flush,
    setConflictDraft: setConflictDraft,
    getConflictDraft: getConflictDraft,
    keepCloudState: keepCloudState,
    deactivate: deactivate,
    isReady: function () { return active; },
    hasPendingChanges: function () { return pending; },
    activeUserId: function () { return activeUserId; },
    revision: function () { return revision; },
    isConflicted: function () { return conflicted; },
    getStatus: function () { return status; }
  };
})();

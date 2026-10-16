"use strict";
(function () {
  var cloud = window.TendCloudPersistence;
  if (!window.TEND_CLOUD_MODE) return;

  var client = cloud && cloud.client;
  var user = null;
  var profileName = "";
  var currentRecoveryUser = null;
  var loginMode = "signin";
  var statusMessage = "";
  var statusError = false;
  var conflictCloudState = null;
  var legacyCandidate = null;
  var cacheNeedsAttention = false;
  var dismissLegacyNotice = false;
  var sessionGeneration = 0;
  var authReady = false;

  function html(value) {
    return typeof esc === "function" ? esc(value == null ? "" : value) : String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function setStatus(message, isError) {
    statusMessage = message || "";
    statusError = !!isError;
  }
  function setChrome(visible) {
    var nav = document.querySelector(".sticky-nav");
    if (nav) nav.hidden = !visible;
    var footer = document.getElementById("syncDot");
    if (footer) footer.hidden = !visible;
    document.body.classList.toggle("tend-auth-open", !visible);
  }
  function renderGate(content) {
    setChrome(false);
    var view = document.getElementById("view");
    if (view) view.innerHTML = '<main class="tend-auth-shell"><section class="card tend-auth-card">' + content + '</section></main>';
    var message = document.getElementById("tendAuthMessage");
    if (message && statusMessage) {
      message.textContent = statusMessage;
      message.className = "tend-auth-message" + (statusError ? " error" : "");
    }
  }
  function errorText(error) {
    if (!error) return "Something went wrong. Please try again.";
    var text = String(error.message || error);
    if (/invalid login credentials/i.test(text)) return "Email or password is incorrect.";
    if (/email not confirmed/i.test(text)) return "Confirm your email before signing in.";
    if (/already registered/i.test(text)) return "An account already uses this email. Sign in instead.";
    return text;
  }
  function appUrl() {
    if (window.location.hostname === "steveotto.github.io" && window.TEND_SUPABASE_CONFIG.redirectUrl) {
      return window.TEND_SUPABASE_CONFIG.redirectUrl;
    }
    return window.location.origin + window.location.pathname;
  }
  function authFormHTML() {
    var signup = loginMode === "signup";
    return '<div class="tend-auth-brand"><span class="tend-auth-mark" aria-hidden="true">t</span><span>Tend</span></div>' +
      '<h1>' + (signup ? "Create your account" : "Welcome back") + '</h1>' +
      '<p class="tend-auth-copy">' + (signup ? "Your Tend data will be private to your account." : "Sign in to reach your private Tend data on any device.") + '</p>' +
      '<form id="tendAuthForm" class="tend-auth-form">' +
      (signup ? '<label>Username or display name<input name="displayName" autocomplete="name" maxlength="80" required></label>' : '') +
      '<label>Email address<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" minlength="8" required></label>' +
      '<button class="btn tend-auth-submit" type="submit">' + (signup ? "Create account" : "Sign in") + '</button></form>' +
      '<p id="tendAuthMessage" class="tend-auth-message" role="status" aria-live="polite"></p>' +
      '<div class="tend-auth-links">' +
      (signup ? '<button type="button" data-auth-mode="signin">Already have an account? Sign in</button>' : '<button type="button" data-auth-forgot>Forgot password?</button><button type="button" data-auth-mode="signup">Create an account</button>') +
      '</div>';
  }
  function resetFormHTML() {
    return '<div class="tend-auth-brand"><span class="tend-auth-mark" aria-hidden="true">t</span><span>Tend</span></div>' +
      '<h1>Choose a new password</h1><p class="tend-auth-copy">Use at least eight characters.</p>' +
      '<form id="tendPasswordResetForm" class="tend-auth-form"><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<button class="btn tend-auth-submit" type="submit">Save new password</button></form>' +
      '<p id="tendAuthMessage" class="tend-auth-message" role="status" aria-live="polite"></p>';
  }
  function resetRequestHTML() {
    return '<div class="tend-auth-brand"><span class="tend-auth-mark" aria-hidden="true">t</span><span>Tend</span></div>' +
      '<h1>Reset your password</h1><p class="tend-auth-copy">We’ll email a secure reset link if there is an account for that address.</p>' +
      '<form id="tendResetRequestForm" class="tend-auth-form"><label>Email address<input name="email" type="email" autocomplete="email" required></label>' +
      '<button class="btn tend-auth-submit" type="submit">Send reset link</button></form>' +
      '<p id="tendAuthMessage" class="tend-auth-message" role="status" aria-live="polite"></p>' +
      '<div class="tend-auth-links"><button type="button" data-auth-mode="signin">Back to sign in</button></div>';
  }
  function errorGate(message, action) {
    renderGate('<div class="tend-auth-brand"><span class="tend-auth-mark" aria-hidden="true">t</span><span>Tend</span></div>' +
      '<h1>' + html(message.title || "Could not load your account") + '</h1><p class="tend-auth-copy">' + html(message.body || "Your account data has not been changed.") + '</p>' +
      '<p id="tendAuthMessage" class="tend-auth-message error" role="alert">' + html(message.error || "") + '</p>' +
      (action || '<button type="button" class="btn" data-auth-retry>Try again</button>'));
  }
  function authScreen() {
    if (currentRecoveryUser) {
      renderGate(resetFormHTML());
      return;
    }
    if (loginMode === "reset-request") {
      renderGate(resetRequestHTML());
      return;
    }
    renderGate(authFormHTML());
  }
  function legacyState() {
    var raw;
    try { raw = window.localStorage.getItem(LS_STATE); }
    catch (error) { return { error: error.message }; }
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The saved local data is not a Tend backup.");
      return { state: cloud.sanitize(data), raw: raw };
    } catch (error) {
      return { error: error.message, raw: raw };
    }
  }
  function dataSummary(state) {
    var rhythms = (Array.isArray(state.rhythms) ? state.rhythms : []).concat(Array.isArray(state.areaRhythms) ? state.areaRhythms : []);
    var fitness = state.fitness && typeof state.fitness === "object" ? state.fitness : {};
    var fitnessCount = ["workouts", "runs", "weighIns"].reduce(function (count, key) {
      return count + (Array.isArray(fitness[key]) ? fitness[key].length : 0);
    }, 0);
    var groups = [
      ["People", state.people],
      ["Rhythms", rhythms],
      ["Fitness logs", fitnessCount],
      ["Other entries", (state.events || []).length + (state.tasks || []).length + (state.followups || []).length + (state.prayers || []).length + (state.ideas || []).length]
    ];
    return groups.map(function (item) {
      var count = Array.isArray(item[1]) ? item[1].length : Number(item[1]) || 0;
      return '<li><span>' + item[0] + '</span><strong>' + count + '</strong></li>';
    }).join("");
  }
  function prepareState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("The backup must contain a Tend state object.");
    return cloud.sanitize(ensureShape(cloud.clone(state)));
  }
  function downloadState(state, filename) {
    var content = JSON.stringify(cloud.sanitize(state), null, 2);
    var url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "tend-device-draft-" + new Date().toISOString().slice(0, 10) + ".json";
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function migrationGate(candidate, cache, title, explanation) {
    legacyCandidate = candidate && candidate.state ? candidate.state : null;
    var cacheCandidate = cache && !cache.corrupt && cache.state ? cache.state : null;
    var stateToRecover = cacheCandidate || legacyCandidate;
    var content = '<div class="tend-auth-brand"><span class="tend-auth-mark" aria-hidden="true">t</span><span>Tend</span></div>' +
      '<h1>' + html(title || "Choose how to start") + '</h1><p class="tend-auth-copy">' + html(explanation || "Choose what to do before Tend creates cloud data for this account.") + '</p>';
    if (stateToRecover) {
      content += '<h2 class="tend-auth-subtitle">' + (cacheCandidate ? "Saved device draft" : "Local data found") + '</h2><ul class="tend-auth-summary">' + dataSummary(stateToRecover) + '</ul>' +
        '<p class="tend-auth-note">The original local data remains on this device. Nothing will be imported unless you choose it.</p>';
    } else if (candidate && candidate.error) {
      content += '<p class="tend-auth-note">Local data was found but could not be read: ' + html(candidate.error) + '. The original has not been changed.</p>';
    } else {
      content += '<p class="tend-auth-note">This account does not have saved Tend data yet.</p>';
    }
    if (cache && cache.corrupt) content += '<p class="tend-auth-note">A damaged device cache was detected and was not imported. Its original data has not been changed.</p>';
    content += '<div class="tend-auth-actions">';
    if (stateToRecover) {
      content += '<button type="button" class="btn" data-migration-restore="' + (cacheCandidate ? "cache" : "legacy") + '">' + (cacheCandidate ? "Restore saved draft" : "Import local data") + '</button>' +
        '<button type="button" class="btn ghost" data-migration-download="' + (cacheCandidate ? "cache" : "legacy") + '">Download a copy</button>';
    }
    content += '<button type="button" class="btn ghost" data-migration-empty>Start with empty Tend</button></div>' +
      '<p id="tendAuthMessage" class="tend-auth-message" role="status" aria-live="polite"></p>';
    renderGate(content);
    if (cache && cache.corrupt) cacheNeedsAttention = true;
  }
  function replaceCurrentState(state) {
    var prepared = prepareState(state);
    if (cloud.revision() > 0) {
      var before = conflictCloudState || S;
      downloadState(before, "tend-before-replacement-" + new Date().toISOString().slice(0, 10) + ".json");
    }
    S = prepared;
    return cloud.replaceState(prepared).then(function () {
      if (!cloud.isConflicted()) conflictCloudState = null;
      if (typeof render === "function") render();
      return prepared;
    });
  }
  function setAccountState(state) {
    var prepared = prepareState(state);
    return cloud.initializeState(user.id, prepared).then(function () {
      S = prepared;
      authReady = true;
      conflictCloudState = null;
      setStatus("", false);
      showApplication();
      return prepared;
    });
  }
  async function importLegacy() {
    if (!legacyCandidate) throw new Error("No valid local Tend data is available to import.");
    if (!window.confirm("Replace this account's current cloud data with the local device data? Tend will download a backup of the current cloud data first. The original local data will be left untouched.")) return;
    await replaceCurrentState(legacyCandidate);
    setStatus("Local data imported into this account.", false);
    render();
  }
  function accountMigrationNotice() {
    var legacy = legacyState();
    var cache = user && cloud.readCache(user.id);
    legacyCandidate = legacy && legacy.state ? legacy.state : null;
    cacheNeedsAttention = cacheNeedsAttention || !!(cache && cache.corrupt);
    if ((!legacyCandidate || dismissLegacyNotice) && !cacheNeedsAttention) return "";
    var count = legacyCandidate ? (legacyCandidate.people || []).length + (legacyCandidate.rhythms || []).length + (legacyCandidate.events || []).length : 0;
    return '<div class="tend-account-notice"><strong>Local device data is separate from this cloud account.</strong><p>' +
      (legacyCandidate && !dismissLegacyNotice ? count + ' local items were found. Importing replaces this account’s cloud data; the local original remains on this device, and Tend downloads a cloud backup first.' : 'A local data cache needs attention. The damaged cache was not imported.') +
      '</p>' + (legacyCandidate && !dismissLegacyNotice ? '<div class="settings-actions"><button type="button" class="btn mini ghost" data-account-import-legacy>Review local data import</button><button type="button" class="btn mini ghost" data-account-dismiss-legacy>Keep cloud data</button></div>' : '') + '</div>';
  }
  function accountConflictHTML() {
    var draft = cloud.getConflictDraft();
    if (!draft) return "";
    return '<div class="tend-account-notice tend-account-conflict"><strong>Cloud and device changes conflict.</strong>' +
      '<p>Your device draft has not been uploaded. The current cloud data remains available. Download the draft, keep the cloud version, or explicitly replace cloud data with the draft.</p>' +
      '<div class="tend-auth-actions"><button type="button" class="btn mini ghost" data-account-download-draft>Download device draft</button>' +
      '<button type="button" class="btn mini ghost" data-account-use-cloud>Use cloud version</button>' +
      '<button type="button" class="btn mini danger" data-account-use-draft>Replace cloud with device draft</button></div></div>';
  }
  window.tendAccountSettingsHTML = function () {
    if (!user) return '<div class="card settings-card"><p>Sign in to manage your account.</p></div>';
    var email = user.email || "";
    var status = cloud.getStatus();
    return '<div class="settings-row-static"><span><strong>Account</strong><small>' + html(email) + '</small></span></div>' +
      '<div class="settings-row-static"><span><strong>Account sync</strong><small class="tend-cloud-status" id="cloudAccountStatus" role="status">Status: ' + html(status) + '</small></span>' +
      (status === "Needs attention" && cloud.hasPendingChanges() && !cloud.isConflicted() ? '<button type="button" class="btn mini ghost" data-account-retry-save>Retry save</button>' : '') + '</div>' +
      '<div class="settings-row-static settings-signout-row"><span><strong>Sign out</strong></span><button type="button" class="btn mini ghost" data-account-sign-out>Sign out</button></div>';
  };
  window.tendAccountDataSettingsHTML = function (mode) {
    if (!user) return '<div class="card settings-card"><p>Sign in to manage account data.</p></div>';
    var recovery = accountConflictHTML() + accountMigrationNotice();
    var actions = '<div class="settings-row-static"><span><strong>Export data</strong><small>Download an account backup.</small></span><button type="button" class="btn mini ghost" id="syncExport">Export</button></div>' +
      '<div class="settings-row-static"><span><strong>Import data</strong><small>Uses the existing validation and confirmation safeguards.</small></span><button type="button" class="btn mini ghost" id="syncImport">Import</button></div><input id="syncImportFile" type="file" accept="application/json,.json" hidden>';
    if (mode === "backup") return actions;
    if (mode === "recovery") return recovery;
    return actions + (recovery ? '<div class="settings-recovery-content">' + recovery + '</div>' : '');
  };
  window.tendLegacyRecoverySettingsHTML = function () {
    if (!user || !(window.SYNCcfg && SYNCcfg.token)) return "";
    return '<p class="settings-help">This optional GitHub recovery copy is separate from automatic Tend account sync. Use it only for manual backup or recovery.</p>' +
      '<div class="field"><label for="syncOwner">Repository owner</label><input id="syncOwner" autocomplete="off" value="' + html(SYNCcfg.owner || "") + '"></div>' +
      '<div class="field"><label for="syncRepo">Repository name</label><input id="syncRepo" autocomplete="off" value="' + html(SYNCcfg.repo || "") + '"></div>' +
      '<div class="field"><label for="syncToken">Personal access token</label><input id="syncToken" type="password" autocomplete="off" value="' + html(SYNCcfg.token || "") + '"></div>' +
      '<div class="settings-actions"><button type="button" class="btn mini ghost" id="syncSave">Save connection</button><button type="button" class="btn mini ghost" id="syncPush">Push now</button><button type="button" class="btn mini ghost" id="syncPull">Pull now</button></div>';
  };
  function showApplication() {
    if (!authReady || !user || !cloud.isReady()) return;
    currentRecoveryUser = null;
    setChrome(true);
    if (typeof updateSyncDot === "function") updateSyncDot();
    if (typeof render === "function") render();
  }
  function clearActiveApp() {
    user = null;
    profileName = "";
    conflictCloudState = null;
    cacheNeedsAttention = false;
    dismissLegacyNotice = false;
    cloud.deactivate();
    if (typeof emptyAccountState === "function") S = emptyAccountState();
    else S = {};
    if (typeof updateSyncDot === "function") updateSyncDot();
  }
  async function loadUserProfile(currentUser) {
    var result = await client.from("tend_profiles").select("display_name").eq("user_id", currentUser.id).maybeSingle();
    if (result.error) {
      console.error("Tend profile could not be loaded", result.error);
      return currentUser.user_metadata && currentUser.user_metadata.display_name || "";
    }
    return result.data && result.data.display_name || currentUser.user_metadata && currentUser.user_metadata.display_name || "";
  }
  async function activateUser(session) {
    if (!session || !session.user) {
      sessionGeneration++;
      clearActiveApp();
      authReady = true;
      currentRecoveryUser = null;
      statusMessage = "";
      authScreen();
      return;
    }
    var nextUser = session.user;
    if (user && user.id === nextUser.id && cloud.isReady()) return;
    if (user && user.id !== nextUser.id && typeof window.location.reload === "function") {
      window.location.reload();
      return;
    }
    var generationAtStart = ++sessionGeneration;
    cloud.deactivate();
    if (typeof emptyAccountState === "function") S = emptyAccountState();
    user = nextUser;
    authReady = false;
    setChrome(false);
    renderGate('<div class="tend-auth-brand"><span class="tend-auth-mark" aria-hidden="true">t</span><span>Tend</span></div><h1>Loading your Tend account</h1><p class="tend-auth-copy">Your private account data is being restored before the app opens.</p><p class="tend-cloud-status">Loading</p>');
    try {
      var result = await cloud.fetchUserState(nextUser.id);
      if (generationAtStart !== sessionGeneration) return;
      var row = result.row;
      var cache = result.cache;
      cacheNeedsAttention = !!(cache && cache.corrupt);
      dismissLegacyNotice = false;
      profileName = await loadUserProfile(nextUser);
      if (generationAtStart !== sessionGeneration) return;
      if (row) {
        var serverState = prepareState(row.state);
        var useCache = cache && !cache.corrupt && cache.pending && Number(cache.revision) === Number(row.revision);
        S = prepareState(useCache ? cache.state : serverState);
        cloud.activate(nextUser.id, S, row.revision, !!useCache);
        if (cache && !cache.corrupt && cache.conflict && cache.conflict.draft) {
          conflictCloudState = serverState;
          cloud.setConflictDraft(cache.conflict.draft, row.revision, serverState);
        } else if (cache && !cache.corrupt && cache.pending && !useCache) {
          conflictCloudState = serverState;
          cloud.setConflictDraft(cache.state, row.revision, serverState);
        }
        authReady = true;
        showApplication();
        return;
      }
      if (cache && !cache.corrupt && cache.pending && Number(cache.revision) === 0) {
        S = prepareState(cache.state);
        cloud.activate(nextUser.id, S, 0, true);
        authReady = true;
        showApplication();
        return;
      }
      var local = legacyState();
      if (cache && !cache.corrupt && cache.state) {
        migrationGate(local, cache, "Recover this device draft?", "This account has no cloud state, but an account-scoped device draft exists. Choose whether to restore it or begin empty.");
      } else {
        migrationGate(local, null, "Choose how to start", "Tend loads or creates cloud data only after you choose what to do with this device’s existing data.");
      }
      authReady = false;
    } catch (error) {
      if (generationAtStart !== sessionGeneration) return;
      var offlineCache = window.navigator && window.navigator.onLine === false ? cloud.readCache(nextUser.id) : null;
      if (offlineCache && !offlineCache.corrupt && offlineCache.state) {
        cacheNeedsAttention = false;
        profileName = nextUser.user_metadata && nextUser.user_metadata.display_name || "";
        var cachedConflict = offlineCache.conflict && offlineCache.conflict.draft ? offlineCache.conflict : null;
        var offlineState = cachedConflict ? cachedConflict.draft : offlineCache.state;
        var offlineRevision = cachedConflict ? Number(cachedConflict.cloudRevision) || Number(offlineCache.revision) || 0 : Number(offlineCache.revision) || 0;
        S = prepareState(offlineState);
        cloud.activate(nextUser.id, S, offlineRevision, !cachedConflict && !!offlineCache.pending);
        if (cachedConflict) {
          conflictCloudState = cachedConflict.cloudState ? prepareState(cachedConflict.cloudState) : null;
          cloud.setConflictDraft(cachedConflict.draft, offlineRevision, conflictCloudState);
        }
        authReady = true;
        showApplication();
        return;
      }
      authReady = false;
      errorGate({ title: "Your account data could not be loaded", body: "Tend did not initialize an empty account or overwrite cloud data. Check your connection and try again.", error: errorText(error) });
    }
  }
  async function handleSubmit(event) {
    var form = event.target;
    if (!form || !form.matches("#tendAuthForm,#tendPasswordResetForm,#tendResetRequestForm")) return;
    event.preventDefault();
    var submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    setStatus("", false);
    try {
      var values = new FormData(form);
      if (form.id === "tendResetRequestForm") {
        var resetResult = await client.auth.resetPasswordForEmail(String(values.get("email") || "").trim(), { redirectTo: appUrl() });
        if (resetResult.error) throw resetResult.error;
        loginMode = "signin";
        setStatus("If that email belongs to a Tend account, a password reset link has been sent.", false);
        authScreen();
      } else if (form.id === "tendPasswordResetForm") {
        var changed = await client.auth.updateUser({ password: String(values.get("password") || "") });
        if (changed.error) throw changed.error;
        currentRecoveryUser = null;
        setStatus("Your password has been updated. Sign in with your new password.", false);
        loginMode = "signin";
        authScreen();
      } else {
        var email = String(values.get("email") || "").trim();
        var password = String(values.get("password") || "");
        if (loginMode === "signup") {
          var displayName = String(values.get("displayName") || "").trim();
          if (!displayName) throw new Error("Enter a username or display name.");
          var signup = await client.auth.signUp({
            email: email,
            password: password,
            options: { data: { display_name: displayName }, emailRedirectTo: appUrl() }
          });
          if (signup.error) throw signup.error;
          if (signup.data.session) await activateUser(signup.data.session);
          else {
            loginMode = "signin";
            setStatus("Check your email to confirm your account, then sign in.", false);
            authScreen();
          }
        } else {
          var signin = await client.auth.signInWithPassword({ email: email, password: password });
          if (signin.error) throw signin.error;
          await activateUser(signin.data.session);
        }
      }
    } catch (error) {
      setStatus(errorText(error), true);
      authScreen();
    } finally {
      if (submit && submit.isConnected) submit.disabled = false;
    }
  }
  async function signOut() {
    var signedOut = await client.auth.signOut();
    if (signedOut.error) throw signedOut.error;
    clearActiveApp();
    authReady = false;
    authScreen();
    if (typeof window.location.reload === "function") window.location.reload();
  }
  async function restoreChoice(source) {
    var cache = user && cloud.readCache(user.id);
    var state = source === "cache" ? cache && !cache.corrupt && cache.state : legacyCandidate;
    if (!state) throw new Error("No valid saved data was found to restore.");
    if (!window.confirm("Initialize this account's cloud data from the selected device copy? The original copy will remain on this device.")) return;
    var prepared = prepareState(state);
    try {
      await setAccountState(prepared);
    } catch (error) {
      setStatus(errorText(error), true);
      renderGate('<h1>Could not initialize cloud data</h1><p class="tend-auth-copy">Your source data remains unchanged. You can retry or download a copy first.</p><button class="btn" data-auth-retry>Try again</button><p id="tendAuthMessage" class="tend-auth-message error">' + html(errorText(error)) + '</p>');
    }
  }
  async function startEmpty() {
    var message = legacyCandidate ? "Start this account empty? Your existing local data will remain on this device and will not be imported." : "Start this account with empty Tend data?";
    if (!window.confirm(message)) return;
    try {
      await setAccountState(emptyAccountState());
    } catch (error) {
      setStatus(errorText(error), true);
      errorGate({ title: "Could not create cloud data", body: "No local data was deleted or replaced.", error: errorText(error) });
    }
  }
  async function updateDisplayName(value) {
    if (!user || !cloud.isReady()) throw new Error("Your account is still loading.");
    var name = String(value === undefined ? "" : value).trim();
    if (!name) throw new Error("Enter a username or display name.");
    if (name.length > 80) throw new Error("Display names must be 80 characters or fewer.");
    var profileUpdate = await client.from("tend_profiles").update({ display_name: name }).eq("user_id", user.id).select("display_name").maybeSingle();
    if (profileUpdate.error) throw profileUpdate.error;
    var savedProfile = profileUpdate.data;
    if (!savedProfile) {
      var confirmation = await client.from("tend_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      if (confirmation.error) throw confirmation.error;
      savedProfile = confirmation.data;
    }
    if (!savedProfile) {
      var profileInsert = await client.from("tend_profiles").insert({ user_id: user.id, display_name: name }).select("display_name").maybeSingle();
      if (profileInsert.error && profileInsert.error.code !== "23505") throw profileInsert.error;
      if (profileInsert.error) {
        var retryUpdate = await client.from("tend_profiles").update({ display_name: name }).eq("user_id", user.id).select("display_name").maybeSingle();
        if (retryUpdate.error) throw retryUpdate.error;
        savedProfile = retryUpdate.data;
      } else {
        savedProfile = profileInsert.data;
      }
      if (!savedProfile) {
        var finalConfirmation = await client.from("tend_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
        if (finalConfirmation.error) throw finalConfirmation.error;
        savedProfile = finalConfirmation.data;
      }
    }
    if (!savedProfile || savedProfile.display_name !== name) throw new Error("The profile update was not confirmed by the database.");
    profileName = name;
    return name;
  }
  async function resolveConflict(useCloud) {
    if (useCloud) {
      if (!conflictCloudState) {
        var latest = await cloud.fetchLatestState(user.id);
        if (!latest) throw new Error("No cloud state is available to restore.");
        conflictCloudState = prepareState(latest.state);
        cloud.keepCloudState(conflictCloudState, latest.revision);
      }
      S = prepareState(conflictCloudState);
      cloud.keepCloudState(S, cloud.revision());
      render();
      return;
    }
    var draft = cloud.getConflictDraft();
    if (!draft) throw new Error("The device draft is no longer available.");
    if (!window.confirm("Replace the latest cloud data with this device draft? This is an explicit overwrite; Tend will download the current cloud data first.")) return;
    await replaceCurrentState(draft);
    render();
  }
  async function refreshFromCloudIfSafe() {
    if (!user || !cloud.isReady() || cloud.isConflicted() || !navigator.onLine) return;
    try {
      var latest = await cloud.fetchLatestState(user.id);
      if (!latest || Number(latest.revision) === cloud.revision()) return;
      if (window._tendDirty) {
        conflictCloudState = prepareState(latest.state);
        cloud.setConflictDraft(S, latest.revision, conflictCloudState);
        render();
        return;
      }
      S = prepareState(latest.state);
      cloud.keepCloudState(S, latest.revision);
      render();
    } catch (error) {
      console.error("Tend could not refresh account state", error);
      if (typeof flash === "function") flash("Could not refresh cloud data");
    }
  }

  window.TendAuth = {
    replaceAccountState: replaceCurrentState,
    importLegacy: importLegacy,
    refresh: refreshFromCloudIfSafe,
    displayName: function () { return profileName; },
    updateDisplayName: updateDisplayName,
    signOut: signOut
  };
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest && event.target.closest("[data-auth-mode],[data-auth-forgot],[data-auth-retry],[data-migration-restore],[data-migration-empty],[data-migration-download],[data-account-import-legacy],[data-account-dismiss-legacy],[data-account-download-draft],[data-account-use-cloud],[data-account-use-draft],[data-account-retry-save],[data-account-sign-out]");
    if (!button) return;
    event.preventDefault();
    Promise.resolve().then(async function () {
      if (button.hasAttribute("data-auth-mode")) {
        loginMode = button.getAttribute("data-auth-mode");
        setStatus("", false);
        authScreen();
      } else if (button.hasAttribute("data-auth-forgot")) {
        loginMode = "reset-request";
        setStatus("", false);
        authScreen();
      }
      else if (button.hasAttribute("data-auth-retry")) {
        var session = await client.auth.getSession();
        if (session.error) throw session.error;
        await activateUser(session.data.session);
      } else if (button.hasAttribute("data-migration-restore")) await restoreChoice(button.getAttribute("data-migration-restore"));
      else if (button.hasAttribute("data-migration-empty")) await startEmpty();
      else if (button.hasAttribute("data-migration-download")) {
        var source = button.getAttribute("data-migration-download");
        var cache = user && cloud.readCache(user.id);
        var state = source === "cache" ? cache && cache.state : legacyCandidate;
        if (state) downloadState(state);
      } else if (button.hasAttribute("data-account-import-legacy")) await importLegacy();
      else if (button.hasAttribute("data-account-dismiss-legacy")) {
        dismissLegacyNotice = true;
        render();
      }
      else if (button.hasAttribute("data-account-download-draft")) {
        var draft = cloud.getConflictDraft();
        if (draft) downloadState(draft);
      } else if (button.hasAttribute("data-account-use-cloud")) await resolveConflict(true);
      else if (button.hasAttribute("data-account-use-draft")) await resolveConflict(false);
      else if (button.hasAttribute("data-account-retry-save")) await cloud.flush();
      else if (button.hasAttribute("data-account-sign-out")) await signOut();
    }).catch(function (error) {
      console.error("Tend account action failed", error);
      setStatus(errorText(error), true);
      var message = document.getElementById("tendAuthMessage");
      if (message) {
        message.textContent = statusMessage;
        message.className = "tend-auth-message error";
      } else if (typeof flash === "function") flash(errorText(error));
    });
  });
  window.addEventListener("tend-cloud-status", function (event) {
    if (typeof updateSyncDot === "function") updateSyncDot();
    var status = document.getElementById("cloudAccountStatus");
    if (status) status.textContent = "Status: " + event.detail.status;
  });
  window.addEventListener("tend-cloud-conflict", function (event) {
    conflictCloudState = event.detail.cloud && event.detail.cloud.state ? prepareState(event.detail.cloud.state) : null;
    if (user && authReady && tab === "settings") render();
  });
  window.addEventListener("focus", refreshFromCloudIfSafe);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") refreshFromCloudIfSafe();
  });

  if (!client) {
    errorGate({ title: "Account sign-in is unavailable", body: "The Supabase browser library did not load. Your existing local data has not been changed.", error: "Check your network connection and reload." });
    return;
  }
  client.auth.onAuthStateChange(function (event, session) {
    setTimeout(function () {
      if (event === "PASSWORD_RECOVERY" && session && session.user) {
        currentRecoveryUser = session.user;
        renderGate(resetFormHTML());
      } else {
        activateUser(session).catch(function (error) {
          console.error("Tend account session could not be restored", error);
          errorGate({ error: errorText(error) });
        });
      }
    }, 0);
  });
  (async function restoreSession() {
    try {
      var result = await client.auth.getSession();
      if (result.error) throw result.error;
      if (window.location.hash.indexOf("type=recovery") !== -1 && result.data.session) {
        currentRecoveryUser = result.data.session.user;
        renderGate(resetFormHTML());
      } else await activateUser(result.data.session);
    } catch (error) {
      authReady = false;
      errorGate({ title: "Could not restore your session", body: "Tend has not loaded or saved personal data. Your per-account cache remains untouched.", error: errorText(error) });
    }
  })();
})();

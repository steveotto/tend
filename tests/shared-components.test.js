"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app-shared-components.js"), "utf8");
const faithSource = fs.readFileSync(path.join(__dirname, "..", "app-faith.js"), "utf8");
const focusSource = fs.readFileSync(path.join(__dirname, "..", "app-focus.js"), "utf8");
const peopleSource = fs.readFileSync(path.join(__dirname, "..", "app-people.js"), "utf8");
const homeRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-views1.js"), "utf8");
const actionsSource = fs.readFileSync(path.join(__dirname, "..", "app-actions.js"), "utf8");
const connectionHistorySource = fs.readFileSync(path.join(__dirname, "..", "connection-history.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const prayerSource = fs.readFileSync(path.join(__dirname, "..", "app-prayers.js"), "utf8");
const personRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-rhythms2.js"), "utf8");
const personOverviewSource = fs.readFileSync(path.join(__dirname, "..", "app-rhythms3.js"), "utf8");
const categoryRhythmSource = fs.readFileSync(path.join(__dirname, "..", "app-categoryrhythms.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "tend.css"), "utf8");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function loadComponents(normalize = record => record) {
  const context = {
    esc: escapeHTML,
    window: { tendNormalizeRhythmEditRecord: normalize }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function fakeForm(fields, checkedWeekdays = []) {
  return {
    querySelector(selector) {
      return fields[selector] || null;
    },
    querySelectorAll(selector) {
      return selector.includes("weekdays") ? checkedWeekdays : [];
    }
  };
}

test("Home, Person, and category rhythm cards share one renderer and card structure", () => {
  const components = loadComponents();
  const record = { id: "shared-walk", text: "<Evening walk>", description: "Talk & reconnect" };
  const card = components.tendRhythmCardHTML(record, {
    score: null,
    scoreClass: "neutral",
    peopleBadgesHTML: '<button class="person-badge">Amy</button>',
    categoryBadgesHTML: '<span class="category-icon">Marriage</span>',
    frequency: { full: "Weekly on Friday", label: "Weekly · Fri", narrow: "Wk · Fri" },
    time: { full: "Evening", label: "Evening", narrow: "PM" },
    lastTended: { full: "Never tended", label: "Never" },
    editAttributes: { "data-rhyedit": "amy|shared-walk" },
    tendAttributes: { "data-tend-open": "person-rhythm", "data-person-id": "amy", "data-rhythm-id": "shared-walk" },
    historyAttributes: { "data-rhyhistory": "amy|shared-walk" }
  });

  assert.match(card, /class="rhythm-card card"/);
  assert.match(card, /&lt;Evening walk&gt;/);
  assert.match(card, /Talk &amp; reconnect/);
  assert.match(card, /class="rhythm-card__edit" data-rhyedit="amy\|shared-walk"/);
  assert.match(card, /class="btn mini rhythm-card__tend" data-tend-open="person-rhythm"/);
  assert.match(card, /class="rhythm-card__score neutral" data-rhyhistory="amy\|shared-walk"/);
  assert.match(card, /<span>—<\/span>/);
  assert.doesNotMatch(card, /0%/);
  assert.match(card, /Amy/);
  assert.match(card, /Marriage/);
  assert.match(card, /Weekly · Fri/);
  assert.match(card, /Evening/);
  assert.match(card, /Never/);
  const todayCard = components.tendRhythmCardHTML(record, {
    showScore: false,
    frequency: { full: "Weekly on Friday", label: "Weekly · Fri", narrow: "Wk · Fri" },
    time: { full: "Evening", label: "Evening", narrow: "PM" },
    lastTended: { full: "Never tended", label: "Never" },
    tendAttributes: { "data-tend-open": "person-rhythm", "data-person-id": "amy", "data-rhythm-id": "shared-walk" }
  });
  assert.match(todayCard, /class="rhythm-card card"/);
  assert.match(todayCard, /class="btn mini rhythm-card__tend" data-tend-open="person-rhythm"/);
  assert.doesNotMatch(todayCard, /rhythm-card__edit|rhythm-card__score/);
  assert.match(source, /function tendRhythmCardHTML\(/);
  assert.match(source, /var chartAction=options\.showScore===false\?"":/);
  assert.equal((source.match(/<article class="rhythm-card card">/g) || []).length, 1);
  assert.match(homeRhythmSource, /function planRhythmCardHTML\(it\)/);
  assert.match(homeRhythmSource, /return tendRhythmCardHTML\(record,/);
  const todayRhythmSource = homeRhythmSource.match(/function rhyRowQ\(r,dim\)\{[\s\S]*?\n \}/)[0];
  assert.match(todayRhythmSource, /var metadata=window\.tendRhythmCardMetadata\(r\),badges=tendQueuePeopleAndCategoryBadges\(r,p\.id,p\.id,"rhythm"\)/);
  assert.match(todayRhythmSource, /return tendRhythmCardHTML\(r,\{/);
  assert.match(todayRhythmSource, /peopleBadgesHTML:badges/);
  assert.match(todayRhythmSource, /showScore:false/);
  assert.match(personRhythmSource, /return tendRhythmCardHTML\(r,/);
  assert.match(faithSource, /return tendRhythmCardHTML\(r,/);
  assert.match(categoryRhythmSource, /return tendRhythmCardHTML\(record,/);
  assert.match(categoryRhythmSource, /if\(arguments\.length>2\)options\.additionalPeopleBadgesHTML/);
  assert.doesNotMatch(personRhythmSource, /profile-rhythm-row card/);
  assert.doesNotMatch(faithSource, /faith-rhythm-row/);
  assert.doesNotMatch(categoryRhythmSource, /class="rhyrow"/);
  assert.match(styles, /\.rhythm-card\{/);
  assert.match(styles, /\.rhythm-card__meta[^}]*var\(--tend-type-metadata\)/);
  assert.match(styles, /\.rhythm-card__tend[^}]*var\(--tend-type-button-label\)/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\]\s*\{\s*--tend-type-section-header/);
  assert.match(styles, /\.rhythm-card \.rhythm-card__badges \.prayer-person/);
  assert.match(styles, /\.rhythm-card \.rhythm-card__badges \.rhythm-area-badge/);
  assert.doesNotMatch(styles, /\.person-profile-page \.profile-rhythm-row/);
});

test("Home and Person Spark cards use one shared renderer and preserve card actions", () => {
  const components = loadComponents();
  const spark = {
    id: "movie-night",
    text: "Movie night",
    details: "Pick a film together",
    by: "2026-10-25",
    time: "19:30"
  };
  const homeCard = components.tendSparkCardHTML(spark, {
    title: spark.text,
    description: spark.details,
    actionHTML: '<button class="btn sparkbtn" data-sparkdo="amy|movie-night|amy">Do it</button>',
    headingEditHTML: '<button class="plan-item-edit-trigger" data-sedit="amy|movie-night" aria-label="Edit Movie night">Edit</button>',
    topMetaHTML: '<div class="plan-item-top-meta"><div class="plan-people-visible">Amy and Leah</div></div>',
    footerHTML: '<span class="dashboard-spark-deadline">Due Oct 25</span>',
    className: "dashboard-free-moment-card",
    cardAttributes: { "data-dashboard-free-spark-card": "" }
  });
  const personCard = components.tendSparkCardHTML(spark, {
    title: spark.text,
    description: spark.details,
    actionHTML: '<button class="btn sparkbtn" data-sparkdo="amy|movie-night|leah">Do it</button>',
    headingEditHTML: '<button class="profile-rhythm-edit-action" data-sedit="amy|movie-night" aria-label="Edit Movie night">Edit</button>',
    topMetaHTML: '<div class="plan-item-top-meta"><button data-personbadge="amy|spark">Amy</button></div>',
    footerHTML: '<span class="spark-card__meta-item">7:30pm</span><span class="dashboard-spark-deadline">Due Oct 25</span>',
    className: "profile-spark-row",
    cardAttributes: { "data-spark-row": "amy|movie-night" }
  });

  for (const card of [homeCard, personCard]) {
    assert.match(card, /^<div class="spark-card planitem /);
    assert.match(card, /class="plan-item-copy"/);
    assert.match(card, /class="spark-card__title-line"[\s\S]*class="spark-card__title-edit"[\s\S]*data-sedit=/);
    assert.match(card, /class="plan-item-top-meta"/);
    assert.match(card, /class="plan-item-footer dashboard-spark-footer/);
    assert.match(card, /Movie night/);
    assert.match(card, /Pick a film together/);
    assert.match(card, /data-sparkdo=/);
    assert.match(card, /Due Oct 25/);
  }
  assert.match(homeCard, /data-dashboard-free-spark-card=""/);
  assert.match(personCard, /data-spark-row="amy\|movie-night"/);
  assert.match(personCard, /data-sedit="amy\|movie-night"/);
  assert.doesNotMatch(personCard.match(/class="plan-item-top-meta"[\s\S]*?<\/div>/)[0], /data-sedit=/);
  assert.equal((source.match(/function tendSparkCardHTML\(/g) || []).length, 1);
  assert.match(homeRhythmSource, /function freeMomentSparkCardHTML\(item,options\)/);
  assert.match(homeRhythmSource, /return tendSparkCardHTML\(item,/);
  assert.match(homeRhythmSource, /headingEditHTML:planItemEditAction\(item\)/);
  assert.match(homeRhythmSource, /topMetaHTML:planItemTopRow\(item,false\)/);
  assert.equal((homeRhythmSource.match(/freeMomentSparkCardHTML\(current,/g) || []).length, 2);
  assert.match(homeRhythmSource, /out\+=tendSparkCardHTML\(s,/);
  assert.match(homeRhythmSource, /headingEditHTML:editAction/);
  assert.match(homeRhythmSource, /profile-spark-completion-note">Completed Sparks show under Connections\.<\/p>/);
  assert.doesNotMatch(homeRhythmSource, /<div class="spark-card/);
  assert.doesNotMatch(homeRhythmSource, /class="profile-spark-top"/);
  assert.doesNotMatch(homeRhythmSource, /class="planitem dashboard-free-moment-card"/);
  assert.match(styles, /\.spark-card\{/);
  assert.match(styles, /\.spark-card \.sparkbtn\{border:1px solid/);
  assert.match(styles, /\.spark-card \.spark-card__title-line\{display:block;flex:0 1 auto/);
  assert.match(styles, /\.spark-card \.plan-item-copy \.plan-item-heading \.spark-card__title-line \.tend-type-title\{display:inline/);
  assert.match(styles, /\.spark-card \.plan-item-heading>\.plan-item-action\{grid-column:2;grid-row:1;align-self:start;height:max-content\}/);
  assert.match(styles, /\.spark-card \.plan-item-heading>\.plan-item-action>\.btn\{align-self:flex-start;height:auto\}/);
  assert.match(styles, /\.spark-card \.plan-people\{display:flex;align-items:center;gap:6px;min-width:0;width:auto\}/);
  assert.match(styles, /\.spark-card \.plan-item-category-row\{display:flex;align-items:center;gap:6px;flex:none;min-width:0;margin-left:0\}/);
  assert.match(styles, /\.home-dashboard \.spark-card \.plan-item-category-row \.rhythm-area-badge\{[\s\S]*?width:20px!important;[\s\S]*?height:20px!important/);
  assert.match(styles, /\.home-dashboard \.spark-card \.plan-item-category-row \.rhythm-area-badge svg\{[\s\S]*?width:12px!important;[\s\S]*?height:12px!important/);
  assert.match(styles, /\.home-dashboard \.current-plan-items>\.rhythm-card\{margin-bottom:14px\}/);
  assert.doesNotMatch(styles, /\.person-profile-page \.profile-spark-row\.card/);
  assert.match(styles, /\.person-profile-page \.profile-spark-completion-note\{margin:12px 0 0;color:var\(--ink-faint\);font-size:12px;line-height:1\.4;text-align:center\}/);
  assert.doesNotMatch(styles, /\.person-profile-page \.person-free-moment-card \.tend-type-title/);
});

test("Person prayer section follows the profile card treatment with a shared-style metadata footer", () => {
  assert.match(homeRhythmSource, /function profilePanelStart\(key\)\{return '<section class=\"'\+\(key===\"prayer\"\?\"\":\"card \"\)\+'profile-tab-panel\"/);
  assert.match(homeRhythmSource, /class=\"profile-panel-toolbar profile-rhythm-toolbar\"[^>]*>.*?class=\"btn mini ghost profile-rhythm-add profile-prayer-add\" data-personprayeropen=/);
  assert.match(prayerSource, /function prayerProfileMetaHTML\(p\)/);
  assert.match(prayerSource, /class=\"rhythm-card__meta profile-prayer-meta\" aria-label=\"Prayer schedule and history\"/);
  assert.match(prayerSource, /planMetaIcon\(\"frequency\"\)[\s\S]*?planMetaIcon\(\"time\"\)[\s\S]*?planMetaIcon\(\"occurred\"\)/);
  assert.match(prayerSource, /rhythm-card__meta-item rhythm-card__last/);
  assert.match(prayerSource, /window\.tendRhythmCardTime\(\{tod:key\}\)/);
  assert.match(prayerSource, /window\.tendRhythmCardLastTended\(last\)/);
  assert.match(personRhythmSource, /window\.tendRhythmCardTime=function\(r\)\{return rhythmCardTime\(r\);\}/);
  assert.match(personRhythmSource, /window\.tendRhythmCardLastTended=function\(last\)\{return rhythmCardLastTended\(last\);\}/);
  assert.doesNotMatch(prayerSource.match(/function prayerProfileMetaHTML\(p\)\{([\s\S]*?)\n\}/)[1], /Prayed .* times|Added /);
  assert.match(prayerSource, /class=\"rhythm-card__edit prayer-edit-trigger\" data-prayeredit=/);
  assert.match(prayerSource, /prayerProfileMetaHTML\(p\)/);
  assert.match(prayerSource, /class=\"prayer-history-section profile-prayer-history\"><div class=\"prayer-history-links\">/);
  assert.match(prayerSource, /class=\"btn mini ghost profile-rhythm-add\" data-prayer-past-view=/);
  assert.match(prayerSource, />Answered \('\+answered\.length\+'\)/);
  assert.match(prayerSource, />Archived \('\+archived\.length\+'\)/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer \.profile-prayer-history\{margin-top:16px;padding-top:0;border-top:0\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer \.profile-prayer-history \.prayer-history-links\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:center;justify-items:center;gap:12px\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-prayer \.profile-prayer-history \.profile-rhythm-add\{margin:0\}/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row\{[^}]*grid-template-areas:\"content actions\" \"meta meta\"/);
  assert.match(styles, /#profile-panel-prayer \.profile-prayer-add\{border-color:var\(--forest\);background:transparent;color:var\(--forest\)\}/);
  assert.match(prayerSource, /profile\?'<div class="profile-empty-state">No active prayer requests<\/div>'/);
  assert.match(prayerSource, /if\(profile\)out='<div class="profile-prayer-list">'\+out\+'<\/div>'/);
});

test("Person Notes section uses the shared toolbar and card-row treatment", () => {
  assert.match(homeRhythmSource, /profilePanelStart\("notes"\)\+'<div class="profile-panel-toolbar profile-rhythm-toolbar"/);
  assert.match(homeRhythmSource, /Thoughts, encouragement, and follow-ups to remember\./);
  assert.match(homeRhythmSource, /class="btn mini ghost profile-rhythm-add" data-profilenoteopen=/);
  assert.match(homeRhythmSource, /<span>Add note<\/span>/);
  assert.match(homeRhythmSource, /function personNoteCardHTML\(note,person,options\)/);
  assert.match(homeRhythmSource, /var edit='<button type="button" class="iconbtn person-note-edit" data-fuedit=/);
  assert.match(homeRhythmSource, /class="person-note-title-line"><strong class="tend-type-title">'\+esc\(profileNoteTitleText\(note\)\)\+'<\/strong>&nbsp;'\+edit/);
  assert.match(homeRhythmSource, /class="btn mini '\+\(completed\?"ghost":"note-done"\)[\s\S]*?class="person-note-associations"/);
  assert.match(homeRhythmSource, /class="person-note-footer"><span class="person-note-type-column"/);
  assert.match(homeRhythmSource, /class="person-note-meta tend-type-meta">'\+planMetaIcon\("occurred"\)/);
  assert.match(homeRhythmSource, /var stamp=f\.createdAt\|\|f\.ts\?when\(f\.createdAt\|\|f\.ts\):f\.due\?"Due "\+f\.due:""/);
  assert.match(homeRhythmSource, /class="btn mini ghost profile-rhythm-add person-note-history-button" data-note-history="'\+esc\(p\.id\)\+'">Completed \('\+done\.length\+'\)/);
  assert.match(homeRhythmSource, /'<div class="profile-empty-state">No notes yet<\/div>'/);
  assert.doesNotMatch(homeRhythmSource, /"Added "\+when\(f\.createdAt/);
  assert.doesNotMatch(homeRhythmSource.match(/function personNoteCardHTML\([\s\S]*?\n\}/)[0], /data-fudel=/);
  assert.match(styles, /#profile-panel-notes\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /#profile-panel-notes \.person-note-heading\{display:flex;align-items:flex-start;justify-content:space-between/);
  assert.match(styles, /#profile-panel-notes \.person-note-title-line\{display:block/);
  assert.match(styles, /#profile-panel-notes \.person-note-associations\{display:flex;flex-wrap:wrap/);
  assert.match(styles, /#profile-panel-notes \.person-note-row\{[^}]*border:1px solid var\(--line\)[^}]*border-radius:16px/);
  assert.match(styles, /#profile-panel-notes \.person-note-footer\{[^}]*border-top:1px solid var\(--line\)/);
  assert.match(styles, /#profile-panel-notes \.person-note-footer\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(styles, /\.person-profile-page #profile-panel-notes \.person-note-history-button\{display:flex;width:max-content;margin:16px auto 4px\}/);
});

test("Completed Note history reuses NoteCard with completion metadata and a scrollable list", () => {
  assert.match(homeRhythmSource, /personNoteCardHTML\(note,person,\{completed:true,metadata:note\.completedDate\?"Completed "\+when\(note\.completedDate\):"",actionLabel:"Reopen"\}\)/);
  assert.match(homeRhythmSource, /class="note-history-header"/);
  assert.match(homeRhythmSource, /notes\.map\(function\(note\)\{return personNoteCardHTML\(note,person,/);
  assert.match(homeRhythmSource, /data-fudone="'\+esc\(note\.id\)\+'/);
  assert.match(homeRhythmSource, /data-fuedit="'\+esc\(note\.id\)\+'/);
  assert.match(styles, /\.note-history-dialog\{display:flex;flex-direction:column;[^}]*overflow:hidden/);
  assert.match(styles, /\.rhythm-history-dialog\.note-history-dialog\{display:flex;flex-direction:column;overflow:hidden;padding:0\}/);
  assert.match(styles, /\.note-history-header\{flex:none/);
  assert.match(styles, /\.note-history-modal-list\{display:flex;flex:1 1 auto;flex-direction:column;gap:12px;min-height:0;max-height:none;overflow-y:auto/);
  assert.match(styles, /\.note-history-modal-list>\.person-note-row\{[^}]*display:flex;flex:none;flex-direction:column/);
  assert.match(styles, /\.note-history-modal-list \.person-note-title-line \.tend-type-title\{[^}]*overflow-wrap:anywhere;white-space:normal/);
  assert.match(styles, /\.note-history-modal-list \.person-note-footer\{display:flex;align-items:center;justify-content:space-between/);
});

test("Person profile panels fit their content and keep the clicked control in place", () => {
  assert.match(homeRhythmSource, /function sizeProfileTabPanels\(root\)\{[\s\S]*?panel\.style\.minHeight="";panel\.style\.marginBottom="";[\s\S]*?\}/);
  assert.doesNotMatch(homeRhythmSource.match(/function sizeProfileTabPanels\(root\)\{([\s\S]*?)\n\}/)[1], /maxHeight|offsetHeight|marginBottom=spare/);
  assert.match(homeRhythmSource, /function tendCaptureProfileScrollAnchor\(target\)/);
  assert.match(homeRhythmSource, /function tendRestoreProfileScrollAnchor\(anchor\)/);
  assert.match(homeRhythmSource, /window\.scrollBy\(0,target\.getBoundingClientRect\(\)\.top-anchor\.top\)/);
  assert.match(homeRhythmSource, /else window\.scrollTo\(anchor\.position\.x,anchor\.position\.y\)/);
  assert.match(actionsSource, /else if\(profileAnchor\)\{requestAnimationFrame\(function\(\)\{requestAnimationFrame\(function\(\)\{tendRestoreProfileScrollAnchor\(profileAnchor\)/);
});

test("Person management tabs prioritize health categories with mobile item and score rows", () => {
  assert.match(homeRhythmSource, /\[\["rhythms","Rhythms"\],\["sparks","Sparks"\],\["prayer","Prayer"\],\["connection","Connections"\],\["notes","Notes"\]\]/);
  assert.match(homeRhythmSource, /var tabHealth=\{rhythms:avg\(sortedPersonRhythms\(p\)\.map\(rhythmScore\)\),connection:connectionScore\(p\),prayer:prayerMeterScore\(p\)\}/);
  assert.match(homeRhythmSource, /class="profile-tab-mobile-details"><span class="profile-tab-item-count" aria-label="'\+counts\[item\[0\]\]\+' items"/);
  assert.ok(homeRhythmSource.includes('class="profile-tab-health-score \'+healthTone+\'">\'+healthText'));
  assert.match(styles, /grid-template-areas:"rhythms rhythms connection connection prayer prayer" "sparks sparks sparks notes notes notes"/);
  assert.match(styles, /\.person-profile-page \.profile-tabs button\[data-profiletab="rhythms"\],\s*\.person-profile-page \.profile-tabs button\[data-profiletab="connection"\],\s*\.person-profile-page \.profile-tabs button\[data-profiletab="prayer"\]\{display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:1fr 1fr;justify-items:stretch;min-height:96px/);
  assert.match(styles, /\.person-profile-page \.profile-tabs \.profile-tab-health-score\.green\{color:#12B76A\}/);
  assert.match(styles, /\.person-profile-page \.profile-tabs \.profile-tab-health-score\.yellow\{color:#F08C00\}/);
  assert.match(styles, /\.person-profile-page \.profile-tabs \.profile-tab-health-score\.red\{color:#F04531\}/);
});

test("Person profile overview keeps health details accessible and scoped above Today", () => {
  assert.match(homeRhythmSource, /personAvatar\(p,76\)/);
  assert.match(styles, /\.person-profile-page \.person-profile-header \.person-identity h3\{[^}]*font-size:calc\(var\(--tend-type-section-header\) \+ \.25rem\)!important/);
  assert.match(styles, /\.person-profile-page \.person-profile-header \.person-identity \.rel\{[^}]*font-size:calc\(var\(--tend-type-description\) \+ \.05rem\)!important;font-weight:600/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\] \.person-profile-page\{--person-profile-avatar-size:108px\}/);
  assert.match(homeRhythmSource, /person-profile-options-list[\s\S]*?data-psettings="1"[\s\S]*?data-closeperson="1"/);
  assert.match(homeRhythmSource, /person-profile-badges/);
  assert.match(homeRhythmSource, /aria-label="Birthday: '\+esc\(bd\.label\)\+'"/);
  assert.match(homeRhythmSource, /aria-label="Anniversary: '\+esc\(an2\.label\)\+'"/);
  assert.match(homeRhythmSource, /<span aria-hidden="true">\\uD83C\\uDF82<\/span><span>'\+esc\(personProfileShortDateLabel\(bd\.label\)\)/);
  assert.match(homeRhythmSource, /<span aria-hidden="true">\\u2665<\/span><span>'\+esc\(personProfileShortDateLabel\(an2\.label\)\)/);
  assert.match(homeRhythmSource, /function personProfileShortDateLabel\(label\)/);
  assert.match(styles, /\.person-profile-page \.person-profile-badges\{display:grid;grid-template-columns:repeat\(3,minmax\(0,max-content\)\)/);
  assert.match(homeRhythmSource, /personHealthMeter\(scoreAvailable\?scoreValue:null,p\.name,true\)/);
  assert.ok(homeRhythmSource.indexOf("out+=actQueueHTML(p)") > homeRhythmSource.indexOf("personHealthMeter(scoreAvailable?scoreValue:null,p.name,true)"));
  assert.match(personOverviewSource, /var rs=sortedPersonRhythms\(p\)/);
  assert.match(personOverviewSource, /var latestRhythmEvent=null;[\s\S]*?rs\.forEach\(function\(rhythm\)\{[\s\S]*?var event=rhythmLast\(rhythm\)/);
  assert.match(personOverviewSource, /var latestRhythmText=latestRhythmEvent\?"Last tended: "\+when\(latestRhythmEvent\.event\.ts\):"Last tended: Never"/);
  assert.ok(personOverviewSource.indexOf("esc(latestRhythmText)") < personOverviewSource.indexOf("rs.length?rs.length"));
  assert.match(personOverviewSource, /person-health-summaries/);
  assert.match(personOverviewSource, /var tone=display==="\\u2014"\?"neutral":scoreClass\(Number\(value\)\)/);
  assert.match(personOverviewSource, /person-health-summary-score '\+tone/);
  assert.match(styles, /\.person-profile-page \.person-health-summary-score\.green\{color:#12B76A\}/);
  assert.match(styles, /\.person-profile-page \.person-health-summary-score\.yellow\{color:#F08C00\}/);
  assert.match(styles, /\.person-profile-page \.person-health-summary-score\.red\{color:#F04531\}/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\] \.person-profile-page \.person-health-summary\{padding-right:4px;padding-left:4px\}/);
  assert.match(styles, /html\[data-mobile-text-size-level="larger"\] \.person-profile-page \.person-health-summary-label\{font-size:14px;letter-spacing:-\.03em;white-space:nowrap\}/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable\{[^}]*gap:\.5em;padding:\.33em \.83em \.33em \.33em;font-size:var\(--tend-type-person-badge\)!important/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable \.avatar\{width:1\.6em!important;height:1\.6em!important/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable,\s*\.person-free-moment \.prayer-person\.person-badge-clickable,\s*\.profile-tab-panel \.prayer-person\.person-badge-clickable\{[^}]*padding:\.33em \.83em \.33em \.33em;border:0;font-size:var\(--tend-type-person-badge\)!important;line-height:1\.2\}/);
  assert.match(styles, /\.person-profile-page \.prayer-person\.person-badge-clickable \.avatar,\s*\.person-free-moment \.prayer-person\.person-badge-clickable \.avatar,\s*\.profile-tab-panel \.prayer-person\.person-badge-clickable \.avatar\{width:1\.6em!important;height:1\.6em!important/);
  assert.match(styles, /\.person-free-moment \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable,\s*\.profile-tab-panel \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable\{gap:\.5em;padding:\.33em \.83em \.33em \.33em\}/);
  assert.match(styles, /\.person-free-moment \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable \.avatar,\s*\.profile-tab-panel \.spark-card \.plan-item-meta-people \.prayer-person\.person-badge-clickable \.avatar\{width:1\.6em!important;height:1\.6em!important/);
  assert.match(personOverviewSource, /aria-expanded="false"/);
  assert.match(personOverviewSource, /data-person-health-detail="rhythms"/);
  assert.match(personOverviewSource, /data-person-health-detail="connection"/);
  assert.match(personOverviewSource, /data-person-health-detail="prayer"/);
  assert.match(personOverviewSource, /class="person-health-detail-heading"[\s\S]*?data-meter-tab="rhythms" aria-label="View rhythms" title="View rhythms">'\+collectionIcon\("rhythms"\)/);
  assert.doesNotMatch(personOverviewSource.match(/data-person-health-detail="rhythms"[\s\S]*?<\/section>/)[0], />View rhythms<\/button>/);
  assert.match(personOverviewSource, /data-person-health-detail="connection"[\s\S]*?esc\(lastConnection\)[\s\S]*?esc\(connectionTarget\)[\s\S]*?data-meter-tab="connection" aria-label="View connections"/);
  assert.match(personOverviewSource, /var lastConnection=pTouch\.last\?"Last connection: "\+when\(pTouch\.last\.ts\)/);
  assert.match(personOverviewSource, /data-person-health-detail="connection"[\s\S]*?data-meter-tab="connection" aria-label="View connections" title="View connections">'\+collectionIcon\("connection"\)/);
  assert.match(personOverviewSource, /data-person-health-detail="prayer"[\s\S]*?esc\(lastPrayer\)[\s\S]*?esc\(prayerCount\)[\s\S]*?data-meter-tab="prayer" aria-label="View prayers"/);
  assert.match(personOverviewSource, /data-person-health-detail="prayer"[\s\S]*?data-meter-tab="prayer" aria-label="View prayers" title="View prayers">'\+collectionIcon\("prayer"\)/);
  assert.doesNotMatch(personOverviewSource.match(/data-person-health-detail="connection"[\s\S]*?<\/section>/)[0], />View connections<\/button>/);
  assert.doesNotMatch(personOverviewSource.match(/data-person-health-detail="prayer"[\s\S]*?<\/section>/)[0], />View prayers<\/button>/);
  assert.match(personOverviewSource, /data-meter-tab="rhythms"/);
  assert.match(personOverviewSource, /data-meter-tab="connection"/);
  assert.match(personOverviewSource, /data-meter-tab="prayer"/);
  assert.match(actionsSource, /data-person-health-summary[\s\S]*?data-active-summary/);
  assert.match(styles, /\.person-profile-page \.person-profile \.person-health-bar\.solid\{height:8px;margin:20px 0 12px;box-shadow:none;background:#E9EFEB;overflow:hidden\}/);
  assert.match(homeRhythmSource, /tendPrayerSectionHTML\("Pray for "\+p\.name,"", \{headerClassName:"today-with-person-heading person-prayer-heading"\}\)/);
  const personFreeMomentSource = homeRhythmSource.match(/function personFreeMomentHTML\(person\)\{[\s\S]*?\n\}/)[0];
  assert.ok(personFreeMomentSource.includes('footerHTML=\'<span class="dashboard-spark-deadline">\'+esc(current.deadline)+\'</span>\''));
  assert.ok(personFreeMomentSource.includes('class="dashboard-spark-carousel-count" aria-live="polite">\'+(index+1)+\' of \'+sparkQueue.length'));
  assert.doesNotMatch(personFreeMomentSource, /footerHTML='<span>'\+\(index\+1\)\+' of '\+sparkQueue\.length/);
  assert.doesNotMatch(personFreeMomentSource, /profile-view-all-sparks|data-person-sparks-view-all/);
  assert.match(styles, /\.home-dashboard \.dashboard-spark-carousel-count,\s*\.person-profile-page \.dashboard-spark-carousel-count\{/);
  assert.match(homeRhythmSource, /class="person-profile-divider" aria-hidden="true"><\/div>'\+tendSectionHeaderHTML\(\{title:"Intentional with "\+p\.name/);
  assert.match(styles, /html \.person-profile-page \.person-prayer-heading h2,[\s\S]*?html \.person-profile-page \.person-free-moment-heading h2\{font-size:var\(--tend-type-description\)!important/);
  assert.match(styles, /\.person-profile-page \.person-profile-divider\{width:100%;height:1px;margin:20px 0 0;background:var\(--line\)\}/);
  assert.match(styles, /\.person-profile-page \.person-profile-divider\+\.profile-settings-heading\{margin-top:24px\}/);
  assert.match(styles, /\.person-profile-page \.person-health-summary\{[^}]*border-left:1px solid var\(--line\)/);
  assert.match(styles, /@media\(max-width:580px\)\{[\s\S]*?\.person-profile-page \.person-health-summaries\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Person Connections preview and both history views share ConnectionCard", () => {
  assert.equal((homeRhythmSource.match(/function connectionCardHTML\(/g) || []).length, 1);
  assert.match(homeRhythmSource, /var connections=connectionHistoryEvents\(pid\)/);
  assert.match(homeRhythmSource, /connections\.slice\(0,5\)\.map\(function\(event\)\{return connectionCardHTML\(event,pid\);\}\)/);
  assert.match(homeRhythmSource, /<div class="connection-list"><div class="profile-empty-state">No connections yet<\/div><\/div>/);
  assert.match(homeRhythmSource, /class="profile-panel-toolbar connection-profile-toolbar"/);
  assert.match(homeRhythmSource, /connection-profile-intro">Shared moments that keep you connected\.<\/p><div class="profile-panel-toolbar connection-profile-toolbar"/);
  assert.match(homeRhythmSource, /class="connection-history-chart-trigger" data-connection-history=/);
  assert.match(homeRhythmSource, /aria-label="View connection chart"/);
  assert.match(homeRhythmSource, /class="profile-tab-intro connection-profile-intro">Shared moments that keep you connected\.<\/p>/);
  assert.match(homeRhythmSource, /profileActionIcon\("chart"\)/);
  assert.match(homeRhythmSource, /class="btn mini ghost profile-rhythm-add connection-profile-log" data-rippleopen="1"/);
  assert.match(homeRhythmSource, /<span>Log connection<\/span>/);
  assert.match(homeRhythmSource, /if\(connections\.length>5\)/);
  assert.match(homeRhythmSource, /connection-history-view-all/);
  assert.match(homeRhythmSource, /View all \('\+connections\.length\+'\)/);
  assert.match(connectionHistorySource, /visible\.map\(function\(event\)\{return connectionCardHTML\(event,personId\);\}\)/);
  assert.match(connectionHistorySource, /dayEvents\.map\(function\(event\)\{return connectionCardHTML\(event,personId\);\}\)/);
  assert.match(homeRhythmSource, /function connectionCardLastTended\(event\)[\s\S]*?var last=\{ts:Number\(event\.ts\)\}/);
  assert.doesNotMatch(homeRhythmSource.match(/function connectionCardHTML\([\s\S]*?\n\}/)[0], /tendRhythmMetaLabel/);
  assert.match(connectionHistorySource, /function openConnectionHistory\(personId,initialView\)/);
  assert.match(actionsSource, /openConnectionHistory\(b\.getAttribute\("data-connection-history"\),"chart"\)/);
  assert.match(actionsSource, /openConnectionHistory\(b\.getAttribute\("data-connection-history-list"\),"list"\)/);
  assert.doesNotMatch(connectionHistorySource, /function openConnectionList\(/);
  assert.match(connectionHistorySource, /data-connection-history-view="list"/);
  assert.match(connectionHistorySource, /data-connection-history-view="chart"/);
  assert.match(connectionHistorySource, /data-connection-history-load-more/);
  assert.match(connectionHistorySource, /No connections on this date\./);
  assert.doesNotMatch(homeRhythmSource, /function rippleLine\(/);
  assert.doesNotMatch(indexSource, /connection-list\.js/);
  assert.match(styles, /\.connection-card\{[^}]*display:flex;flex-direction:column/);
  assert.match(styles, /\.connection-card__heading\.rhythm-card__title-line\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(styles, /\.connection-card__heading>\.tend-type-title\{grid-column:1;grid-row:1;min-width:0;overflow-wrap:anywhere/);
  assert.match(styles, /\.connection-card__type\{grid-column:3;grid-row:1;display:flex;align-items:flex-start;justify-self:end/);
  assert.match(styles, /\.connection-history-view\{display:flex;flex:1 1 auto;flex-direction:column;gap:14px;min-height:0;overflow-y:auto/);
  assert.match(styles, /\.connection-history-chart-view \.history-scroll\{flex:none;max-width:100%;overflow-x:auto;overflow-y:hidden;margin:0;padding:8px 8px 16px 0/);
  assert.match(styles, /\.connection-history-chart-view \.connection-history-column\.is-selected\{background:var\(--mist\);box-shadow:0 0 0 2px var\(--forest\)\}/);
  assert.match(actionsSource, /function logEvent\([\s\S]*?refreshConnectionDialogs\(\);render\(\)/);
  assert.match(actionsSource, /function deleteEvent\([\s\S]*?refreshConnectionDialogs\(\)/);
  assert.match(connectionHistorySource, /No connections yet\. Log a shared moment to start your history\./);
  assert.match(homeRhythmSource, /function connectionCardLastTended\(event\)[\s\S]*?tendRhythmCardLastTended\(last\)/);
  const connectionCard = homeRhythmSource.match(/function connectionCardHTML\([\s\S]*?\n\}/)[0];
  assert.match(connectionCard, /class="connection-card__heading rhythm-card__title-line"/);
  assert.match(connectionCard, /class="rhythm-card__edit" data-evedit=/);
  assert.doesNotMatch(connectionCard, /data-evdel=/);
  assert.ok(connectionCard.includes('class="connection-card__type">\'+typeBadge+\'</div></div>'));
  assert.match(connectionCard, /class="connection-card__footer rhythm-card__meta"/);
  assert.match(connectionCard, /scheduleItem\("frequency"/);
  assert.match(connectionCard, /scheduleItem\("time"/);
  assert.match(connectionCard, /rhythm-card__meta-item rhythm-card__last/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection\{padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-profile-intro\{margin:0 0 10px;color:var\(--ink-faint\);font-size:13px;line-height:1\.45\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-profile-toolbar\{align-items:center;flex-direction:row;justify-content:space-between/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-history-chart-trigger\{[^}]*width:44px;height:44px;min-width:44px;min-height:44px/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-history-chart-trigger:focus-visible\{outline:2px solid var\(--forest\);outline-offset:2px\}/);
  assert.match(styles, /\.person-profile-page #profile-panel-connection \.connection-history-view-all\{display:flex;width:max-content;margin:16px auto 4px\}/);
});

test("Person empty sections use centered card placeholders", () => {
  assert.match(homeRhythmSource, /else out\+='<div class="profile-empty-state">No rhythms yet<\/div>'/);
  assert.match(homeRhythmSource, /else out\+='<div class="profile-empty-state">No sparks yet<\/div>'/);
  assert.match(styles, /\.person-profile-page \.profile-tab-panel \.profile-empty-state,\.person-profile-page \.today-with-person \.profile-empty-state\{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:112px;margin:0;padding:16px;border:1px solid var\(--line\);border-radius:16px;background:var\(--card\);box-shadow:/);
  assert.match(styles, /\.person-profile-page #profile-panel-rhythms \.profile-empty-state,\.person-profile-page #profile-panel-prayer \.profile-empty-state\{border-radius:20px\}/);
});

test("Focus rhythm rows reuse the shared card and include the owning person badge", () => {
  const rhythmRow = focusSource.match(/if\(item\.type==='rhythm'\)\{[\s\S]*?\n   return;\n  \}/)[0];
  assert.match(rhythmRow, /tendQueuePeopleAndCategoryBadges\(rhythm,person\.id,"","rhythm"\)/);
  assert.match(rhythmRow, /tendRhythmCardHTML\(rhythm,\{/);
  assert.match(rhythmRow, /peopleBadgesHTML:badges/);
  assert.match(rhythmRow, /tendAttributes:\{"data-tend-open":"person-rhythm","data-person-id":person\.id,"data-rhythm-id":rhythm\.id\}/);
  assert.match(rhythmRow, /showScore:false/);
  assert.doesNotMatch(rhythmRow, /todayQueueMetaBar|tendRhythmCardContentHTML/);
  assert.match(styles, /\.focus-dialog \.focus-rhythm-item\{margin:14px 0\}/);
  assert.match(peopleSource, /"\.pc-toolbar>\[data-addperson\]\{margin-left:auto\}"/);
});

test("Connection history source keeps repeated events and scopes people using existing rules", () => {
  const events = [
    { id: "older", personId: "amy", ts: new Date(2026, 9, 10, 10).getTime(), isConnection: true },
    { id: "repeat-a", personId: "amy", ts: new Date(2026, 9, 12, 8).getTime(), rhythmId: "walk", isConnection: true },
    { id: "other-person", personId: "hannah", ts: new Date(2026, 9, 12, 9).getTime(), isConnection: true },
    { id: "repeat-b", personId: "amy", ts: new Date(2026, 9, 12, 11).getTime(), rhythmId: "walk", isConnection: true },
    { id: "shared", personId: "hannah", personIds: ["amy"], ts: new Date(2026, 9, 11, 11).getTime(), isConnection: true },
    { id: "middle", personId: "amy", ts: new Date(2026, 9, 11, 9).getTime(), isConnection: true },
    { id: "latest", personId: "amy", ts: new Date(2026, 9, 12, 12).getTime(), isConnection: true }
  ];
  const context = {
    S: { events },
    eventHasPerson: (event, personId) => event.personId === personId || event.personIds?.includes(personId),
    connectionEvent: event => event.isConnection,
    personCadenceDays: () => 7
  };
  vm.createContext(context);
  vm.runInContext(connectionHistorySource, context);
  const recent = context.connectionHistoryEvents("amy");
  assert.deepEqual(Array.from(recent, event => event.id), ["latest", "repeat-b", "repeat-a", "shared", "middle", "older"]);
  assert.deepEqual(Array.from(recent.slice(0, 5), event => event.id), ["latest", "repeat-b", "repeat-a", "shared", "middle"]);
  const data = context.connectionHistoryData({ id: "amy", connectCadence: "weekly" }, new Date(2026, 9, 12, 12));
  assert.equal(data.events.length, 6);
  assert.equal(data.total, 6);
  assert.equal(data.bins.reduce((sum, bin) => sum + bin.count, 0), 6);
});

test("Prayer action dropdown options are unshaded until hovered", () => {
  assert.match(styles, /\.prayer-action-options button\{background:transparent;color:var\(--action-prayer-text,#705A8D\)\}/);
  assert.match(styles, /\.prayer-action-options button:hover[\s\S]*?background:var\(--action-prayer-hover,#E6DCEE\)/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row \.prayer-action-options button\{border:0;background:transparent/);
  assert.match(styles, /\.person-profile-page \.profile-prayer-row \.prayer-action-options button:hover,[\s\S]*?background:var\(--action-prayer-hover,#E6DCEE\)/);
  assert.doesNotMatch(styles, /\.prayer-action-options button\{border:1px solid/);
});

test("Prayer filter buttons show only the icon with an accessible name", () => {
  const filterButton = faithSource.match(/function tendFilterButtonHTML\(options\)\{[\s\S]*?\n\}/)[0];
  assert.match(filterButton, /aria-label=\"'\+esc\(options\.ariaLabel\|\|label\)\+'\"><svg/);
  assert.match(filterButton, /<\/svg><\/button>/);
  assert.doesNotMatch(filterButton, /<span>'\+esc\(label\)<\/span>/);
});

test("shared section and card components escape text and preserve semantic layouts", () => {
  const components = loadComponents();
  const header = components.tendSectionHeaderHTML({
    title: "<People>",
    subtitle: "Subtitle",
    metadata: "Metadata",
    trailingHTML: '<button aria-label="Add">Add</button>'
  });
  assert.match(header, /<h2>&lt;People&gt;<\/h2>/);
  assert.match(header, /Subtitle/);
  assert.match(header, /Metadata/);
  assert.match(header, /aria-label="Add"/);
  const todayWithPerson = components.tendTodayWithPersonHTML({
    personName: "<Jake>",
    waitingCount: 2,
    itemsHTML: '<article class="actrow">Queue item</article>'
  });
  assert.match(todayWithPerson, /Today with &lt;Jake&gt;/);
  assert.match(todayWithPerson, /2 in queue/);
  assert.match(todayWithPerson, /Queue item/);
  assert.match(todayWithPerson, /<div class="today-with-person" style="margin-bottom:14px">/);
  assert.doesNotMatch(todayWithPerson, /class="card act today-with-person"/);
  assert.doesNotMatch(styles, /\.card\.act\.today-with-person\{/);
  assert.doesNotMatch(todayWithPerson, /Nothing waiting/);
  const emptyTodayWithPerson = components.tendTodayWithPersonHTML({
    personName: "Alex",
    waitingCount: 0,
    emptyMessage: "Nothing waiting"
  });
  assert.match(emptyTodayWithPerson, /all tended/);
  assert.match(emptyTodayWithPerson, /Nothing waiting/);
  assert.match(emptyTodayWithPerson, /<div class="today-with-person" style="margin-bottom:14px"><div class="profile-empty-state">Nothing waiting<\/div><\/div>/);
  assert.match(styles, /\.person-profile-page \.profile-tab-panel \.profile-empty-state,\.person-profile-page \.today-with-person \.profile-empty-state\{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:112px/);

  const rhythm = components.tendRhythmCardContentHTML(
    { text: "<Walk>", description: "A & B" },
    { layout: "profile", meta: "Weekly", showNoDetails: true }
  );
  const spark = components.tendSparkCardContentHTML(
    { text: "Movie", details: "A short break" },
    { layout: "plan", actionHTML: '<button>Tend</button>' }
  );
  const prayer = components.tendPrayerCardContentHTML(
    { text: "Family", details: "Remember them" },
    { meta: "Last prayed today", badges: '<span>Prayer</span>' }
  );
  const missingDetails = components.tendRhythmCardContentHTML(
    { text: "A very long rhythm title that should wrap", description: "" },
    { showNoDetails: true }
  );
  const carePlan = components.tendSparkCardContentHTML(
    { text: "Movie", details: "A short break" },
    { layout: "careplan", meta: "Someday", peopleBadges: '<button class="careplan-person">Alex</button>' }
  );

  assert.match(rhythm, /profile-rhythm-heading/);
  assert.match(rhythm, /&lt;Walk&gt;/);
  assert.match(rhythm, /A &amp; B/);
  assert.match(spark, /plan-item-copy/);
  assert.match(spark, /<button>Tend<\/button>/);
  assert.match(spark, /A short break/);
  assert.match(prayer, /Last prayed today/);
  assert.match(prayer, /<span>Prayer<\/span>/);
  assert.match(missingDetails, /A very long rhythm title that should wrap/);
  assert.match(missingDetails, /No details\.\.\./);
  assert.match(carePlan, /careplan-title/);
  assert.match(carePlan, /tend-type-title/);
  assert.match(carePlan, /careplan-meta tend-type-meta/);
  assert.match(carePlan, /careplan-details tend-type-description/);
  assert.match(carePlan, /Alex/);
});

test("Homepage and Person prayer timeframe dropdowns use the same shared renderer", () => {
  const components = loadComponents();
  const options = [
    { id: "now", label: "Morning", timeDescription: "9:00am – 11:30am", count: 2, isCurrent: true },
    { id: "lunch", label: "<Lunch>", timeDescription: "11:30am – 1:30pm", count: 0 },
    { id: "evening", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 9 }
  ];
  const dashboardState = components.tendPrayerTimeframePickerState("now", options, 2);
  const personState = components.tendPrayerTimeframePickerState("now", options.map(option => ({ ...option, count: option.id === "now" ? 1 : 7 })), 5);
  const dashboard = components.tendPrayerTimeframePickerHTML({
    label: dashboardState.label,
    options: dashboardState.options,
    selectedTimeframeId: dashboardState.selectedTimeframeId,
    allDayCount: dashboardState.allDayCount
  });
  const person = components.tendPrayerTimeframePickerHTML({
    personId: "person-1",
    label: personState.label,
    options: personState.options,
    selectedTimeframeId: personState.selectedTimeframeId,
    allDayCount: personState.allDayCount
  });

  assert.match(dashboard, /data-prayer-time-option="now"/);
  assert.match(person, /data-prayer-time-option="now" data-prayer-time-person="person-1"/);
  assert.match(dashboard, /class="prayer-timeframe-picker__option is-current is-selected"/);
  assert.match(person, /class="prayer-timeframe-picker__option is-current is-selected"/);
  assert.match(dashboard, /&lt;Lunch&gt;/);
  assert.match(person, /Any time today/);
  const layoutOnly = html => html
    .replace(/ data-prayer-time-option="[^"]+"(?: data-prayer-time-person="[^"]+")?/g, "")
    .replace(/<span class="prayer-timeframe-picker__count">.*?<\/span>/g, '<span class="prayer-timeframe-picker__count">COUNT</span>');
  assert.equal(layoutOnly(dashboard), layoutOnly(person));
  assert.equal(dashboardState.selectedCount, 2);
  assert.equal(personState.selectedCount, 1);
  assert.equal(dashboardState.label, "Now");
  assert.equal(personState.label, "Now");
  assert.match(dashboard, /class="prayer-timeframe-picker__option" data-prayer-time-option="allday"/);
  const eveningState = components.tendPrayerTimeframePickerState("evening", options, 2);
  assert.equal(eveningState.label, "Evening");
  assert.equal(eveningState.selectedCount, 9);
  const allDayState = components.tendPrayerTimeframePickerState("allday", options, 4);
  assert.equal(allDayState.label, "All Day");
  assert.equal(allDayState.selectedCount, 4);
  assert.equal((faithSource.match(/tendPrayerTimeframePickerHTML\(/g) || []).length, 2);
  assert.equal((faithSource.match(/if\(b\.matches\("\[data-prayer-time-option\]"\)\)/g) || []).length, 1);
  assert.doesNotMatch(faithSource, /data-(?:person-)?dashboard-prayer-time-option/);
  assert.doesNotMatch(faithSource, /current-plan-time-option|prayer-timeframe-picker__(?:option|label|description|count)/);
  assert.doesNotMatch(styles, /\.dashboard-prayer-people-dialog\s+\.current-plan-time|\.person-dashboard-prayer-dialog\s+\.current-plan-time/);
  assert.match(styles, /\.prayer-timeframe-picker__option\{/);
});

test("Homepage and Person prayer filters use the same shared dialog component", () => {
  const components = loadComponents();
  const sharedLayout = {
    timeframeHTML: components.tendPrayerTimeframePickerHTML({
      label: "Now",
      selectedTimeframeId: "now",
      options: [{ id: "now", label: "Evening", timeDescription: "4:30pm – 9:30pm", count: 3 }],
      allDayCount: 4
    }),
    count: 3,
    timeLabel: "Now"
  };
  const dashboard = components.tendPrayerFilterDialogHTML({
    ...sharedLayout,
    title: "People for focused prayer",
    intro: "Choose whose prayer requests to include.",
    selectionHTML: '<div class="dashboard-prayer-people-options">People</div>',
    primaryActionHTML: '<button data-dashboard-prayer-people-pray>Pray</button>',
    closeActionHTML: '<button data-dashboard-prayer-people-close>Done</button>'
  });
  const person = components.tendPrayerFilterDialogHTML({
    ...sharedLayout,
    id: "person-dashboard-prayer-dialog",
    titleId: "person-dashboard-prayer-title",
    title: "Prayer timeframe for Amy",
    closeActionHTML: '<button data-person-dashboard-prayer-close="amy">Done</button>'
  });

  for (const dialog of [dashboard, person]) {
    assert.match(dialog, /class="profile-editor-dialog rhythm-picker-dialog dashboard-prayer-people-dialog/);
    assert.match(dialog, /class="prayer-timeframe-picker"/);
    assert.match(dialog, /Focused Prayer will include <strong>3 prayer requests<\/strong> · Now/);
    assert.match(dialog, /profile-editor-actions dashboard-prayer-people-actions/);
  }
  assert.match(dashboard, /Choose whose prayer requests to include/);
  assert.match(dashboard, /dashboard-prayer-people-options/);
  assert.match(dashboard, /data-dashboard-prayer-people-pray/);
  assert.match(person, /id="person-dashboard-prayer-dialog"/);
  assert.match(person, /Prayer timeframe for Amy/);
  assert.match(person, /data-person-dashboard-prayer-close="amy"/);
  assert.doesNotMatch(person, /dashboard-prayer-people-options/);
  assert.equal((faithSource.match(/tendPrayerFilterDialogHTML\(/g) || []).length, 2);
  assert.doesNotMatch(faithSource, /<dialog class="profile-editor-dialog rhythm-picker-dialog dashboard-prayer-people-dialog/);
});

test("shared Rhythm form validation covers title and enabled end-date requirements", () => {
  const components = loadComponents();
  const profileTitle = { value: "  " };
  const profileEndDateEnabled = { checked: true };
  const profileUntil = { value: "" };
  const profileForm = fakeForm({
    '[data-rfield$="|text"]': profileTitle,
    '[data-rfield$="|endDateEnabled"]': profileEndDateEnabled,
    '[data-rfield$="|until"]': profileUntil
  });

  assert.equal(components.tendValidateRhythmEditForm(profileForm, "profile").message, "title");
  profileTitle.value = "Walk";
  assert.equal(components.tendValidateRhythmEditForm(profileForm, "profile").message, "endDate");
  profileUntil.value = "2026-11-01";
  assert.equal(components.tendValidateRhythmEditForm(profileForm, "profile"), null);

  const carePlanTitle = { value: " Rhythm " };
  const carePlanForm = fakeForm({
    '[data-cpf="title"]': carePlanTitle,
    '[data-cpf="endDateEnabled"]': { checked: true },
    '[data-cpf="until"]': { value: "" }
  });
  assert.equal(components.tendValidateRhythmEditForm(carePlanForm, "careplan").message, "endDate");
});

test("shared Rhythm form conversion preserves identity and assignments in both contexts", () => {
  const normalized = [];
  const components = loadComponents(record => normalized.push(record.id));
  const original = {
    id: "rhythm-1",
    sharedWith: ["person-b", "person-c"],
    areas: ["marriage"],
    customField: "preserved",
    weekdays: [1, 3]
  };
  const fields = {
    '[data-rfield$="|text"]': { value: "  Evening walk  " },
    '[data-rfield$="|description"]': { value: "  Talk together  " },
    '[data-rfield$="|freq"]': { value: "selectdays" },
    '[data-rfield$="|tod"]': { value: "evening" },
    '[data-rfield$="|endDateEnabled"]': { checked: false },
    '[data-rfield$="|until"]': { value: "" }
  };
  const updated = components.tendApplyRhythmEditForm(
    original,
    fakeForm(fields, [{ value: "1" }, { value: "3" }]),
    "profile"
  );

  assert.strictEqual(updated, original);
  assert.equal(updated.text, "Evening walk");
  assert.equal(updated.description, "Talk together");
  assert.equal(updated.freq, "selectdays");
  assert.equal(updated.tod, "evening");
  assert.deepEqual(Array.from(updated.weekdays), [1, 3]);
  assert.deepEqual(Array.from(updated.sharedWith), ["person-b", "person-c"]);
  assert.deepEqual(Array.from(updated.areas), ["marriage"]);
  assert.equal(updated.customField, "preserved");
  assert.equal(updated.until, null);
  assert.deepEqual(normalized, ["rhythm-1"]);

  const carePlan = {
    id: "rhythm-2",
    sharedWith: ["person-a"],
    text: "Old"
  };
  const carePlanFields = {
    '[data-cpf="title"]': { value: "Updated" },
    '[data-cpf="description"]': { value: "Details" },
    '[data-cpf="frequency"]': { value: "weekly" },
    '[data-cpf="tod"]': { value: "morning" },
    '[data-cpf="endDateEnabled"]': { checked: true },
    '[data-cpf="until"]': { value: "2026-12-31" }
  };
  components.tendApplyRhythmEditForm(carePlan, fakeForm(carePlanFields, [{ value: "2" }]), "careplan");
  assert.equal(carePlan.text, "Updated");
  assert.equal(carePlan.until, "2026-12-31");
  assert.deepEqual(Array.from(carePlan.weekdays), [2]);
  assert.deepEqual(Array.from(carePlan.sharedWith), ["person-a"]);
  assert.deepEqual(normalized, ["rhythm-1", "rhythm-2"]);
});

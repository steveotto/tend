// Build-time calendar sync for GitHub Pages.
// Fetches the iCloud published feed server-side (no CORS, no public proxies),
// expands recurrences for the next 12 months, writes events.json for the site.
import ical from "node-ical";
import fs from "fs";

const raw = (process.env.ICAL_URL || "").trim();
const url = raw.replace(/^webcal:/i, "https:");
const calName = process.env.CAL_NAME || "iCloud";

if (!url) {
  console.error("ICAL_URL secret is not set. Add it: repo Settings > Secrets and variables > Actions > New repository secret > ICAL_URL");
  process.exit(0); // don't break the deploy; site keeps last good events.json
}

// All-day events have no timezone. Writing them as UTC midnight makes them
// drift into the previous evening for anyone west of UTC (e.g. EDT).
// We emit floating local-midnight strings ("2026-09-30T00:00:00") instead:
// every browser parses those as ITS OWN midnight, so "Sep 30" stays Sep 30.
const dPart = (d) => d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");

try {
  const feed = await ical.async.fromURL(url, { maxRetries: 2 });
  const text = typeof feed === "string" ? feed : null;
  if (text && !text.includes("BEGIN:VCALENDAR")) throw new Error("response is not an iCalendar feed");

  const data = typeof feed === "string" ? await ical.async.parseICS(feed) : feed;
  const now = Date.now();
  const horizon = now + 365 * 864e5; // 12 months
  const seen = new Set();
  const events = [];

  for (const v of Object.values(data)) {
    if (!v || v.type !== "VEVENT" || !v.start) continue;
    if ((v.status || "").toUpperCase() === "CANCELLED") continue;

    const isAllDay = v.datetype === "date";
    let sMs, eMs, sIso, eIso;
    if (isAllDay) {
      const a = v.start;
      const b = v.end || v.start;
      sIso = dPart(a) + "T00:00:00";
      eIso = dPart(b) + "T00:00:00";   // iCal DTEND for all-day is exclusive
      sMs = Date.parse(sIso);
      eMs = Date.parse(eIso);
    } else {
      sMs = new Date(v.start).getTime();
      eMs = new Date(v.end || v.start).getTime();
      if (isNaN(sMs)) continue;
      sIso = new Date(sMs).toISOString();
      eIso = new Date(eMs).toISOString();
    }
    if (isNaN(sMs) || isNaN(eMs)) continue;

    const key = (v.uid || "") + "|" + sIso; // dedupe master + expanded occurrences
    if (seen.has(key)) continue;
    seen.add(key);

    if (eMs < now - 30 * 864e5 || sMs > horizon) continue; // keep recent past for "earlier today"

    events.push({
      t: v.summary || "(untitled)",
      s: sIso,
      e: eIso,
      allDay: isAllDay,
      cal: calName,
    });
  }

  events.sort((a, b) => a.s.localeCompare(b.s));
  fs.writeFileSync("events.json", JSON.stringify({ synced: new Date().toISOString(), source: "iCloud published feed", events }, null, 2));
  console.log(`Wrote events.json: ${events.length} events, synced ${new Date().toISOString()}`);
} catch (err) {
  console.error("Calendar fetch failed:", err.message);
  console.error("Keeping the last good events.json (site will show it as possibly out of date).");
  process.exit(0);
}

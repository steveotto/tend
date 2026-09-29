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

    const s = new Date(v.start).getTime();
    const e = new Date(v.end || v.start).getTime();
    if (isNaN(s)) continue;

    const key = (v.uid || "") + "|" + s; // dedupe master + expanded occurrences
    if (seen.has(key)) continue;
    seen.add(key);

    if (e < now - 30 * 864e5 || s > horizon) continue; // keep recent past for "earlier today"

    events.push({
      t: v.summary || "(untitled)",
      s: new Date(s).toISOString(),
      e: new Date(e).toISOString(),
      allDay: v.datetype === "date",
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

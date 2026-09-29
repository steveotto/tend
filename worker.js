// Tend calendar relay - Cloudflare Worker
// Free plan handles 100,000 requests/day; this will use ~1/day.
//
// Deploy (5 min):
// 1. Go to https://dash.cloudflare.com and sign up (free, no card needed)
// 2. Workers & Pages -> Create Worker -> name it "tend-relay" -> Deploy
// 3. Click "Edit code", paste this whole file over the sample, Deploy
// 4. Copy your worker URL (https://tend-relay.<your-subdomain>.workers.dev)
//    and tell Littlebird - it gets wired into Tend's calendar fetcher
//    as the first-choice relay, with the public proxies as fallback.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const target = new URL(request.url).searchParams.get("url");
    if (!target || !/^https:\/\/([a-z0-9-]+\.)+icloud\.com\//i.test(target)) {
      return new Response("bad or missing url (icloud.com only)", { status: 400, headers: CORS });
    }

    const upstream = await fetch(target, { cf: { cacheTtl: 300, cacheEverything: true } });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": upstream.headers.get("content-type") || "text/calendar" },
    });
  },
};

/* ============================================================
   technopriest-projects — Cloudflare Worker
   Fetches public repos from GitHub once per hour, caches in KV,
   merges real non-repo work (oknovdom), returns clean JSON the
   site renders. The browser never hits GitHub directly, so the
   60-req/hour per-IP limit can't bite visitors.
   ============================================================ */

const GH_USER       = "Moody-code365";
const CACHE_KEY     = "projects:v1";
const LASTGOOD_KEY  = "projects:lastgood";
const TTL           = 3600; // 1 hour

// repos to hide. The profile-readme repo (name === username) is auto-hidden.
const HIDE = new Set([GH_USER.toLowerCase()]);

// featured order — these float to the top in this order; the rest
// follow, sorted by most recently pushed.
const FEATURED = ["ScrapperAD", "technopriest-site"];

// real projects that don't live in a GitHub repo (client work, etc.)
const MANUAL = [
  {
    name: "oknovdom.kz",
    description: "Commercial conversion landing for a windows company in Almaty. Real client work.",
    url: "https://oknovdom.kz",
    language: "Web",
    topics: ["client-work", "almaty"],
    stars: 0,
    badge: "live",
    badge_label: "live",
    link_label: "visit \u2197"
  }
];

// optional per-repo overrides (nicer copy / badge than the bare GitHub fields)
const OVERRIDES = {
  // "ScrapperAD": { description: "...", badge: "oss", badge_label: "open source" }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=300"
  };
}

function shapeRepo(repo) {
  const o = OVERRIDES[repo.name] || {};
  return {
    name: repo.name,
    description: o.description || repo.description || "",
    url: repo.html_url,
    language: repo.language || "",
    topics: (repo.topics || []).slice(0, 3),
    stars: repo.stargazers_count || 0,
    badge: o.badge || (repo.archived ? "archived" : "oss"),
    badge_label: o.badge_label || (repo.archived ? "archived" : "open source"),
    link_label: "github \u2197",
    _pushed: repo.pushed_at || ""
  };
}

async function buildPayload() {
  const res = await fetch(
    `https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=pushed`,
    {
      headers: {
        "User-Agent": "technopriest-projects-worker",
        "Accept": "application/vnd.github+json"
      }
    }
  );
  if (!res.ok) throw new Error("github " + res.status);
  const repos = await res.json();

  const cleaned = repos
    .filter(r => !r.fork && !r.private && !HIDE.has(r.name.toLowerCase()))
    .map(shapeRepo)
    .sort((a, b) => {
      const fa = FEATURED.indexOf(a.name);
      const fb = FEATURED.indexOf(b.name);
      if (fa !== -1 || fb !== -1) {
        if (fa === -1) return 1;
        if (fb === -1) return -1;
        return fa - fb;
      }
      return (b._pushed || "").localeCompare(a._pushed || "");
    })
    .map(({ _pushed, ...rest }) => rest);

  return {
    generated_at: new Date().toISOString(),
    projects: [...MANUAL, ...cleaned]
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...cors() }
      });

    // serve fresh cache if it exists (KV auto-expires after TTL)
    const cached = await env.PROJECTS_KV.get(CACHE_KEY);
    if (cached) return json(JSON.parse(cached));

    try {
      const payload = await buildPayload();
      const body = JSON.stringify(payload);
      await env.PROJECTS_KV.put(CACHE_KEY, body, { expirationTtl: TTL });
      await env.PROJECTS_KV.put(LASTGOOD_KEY, body); // no TTL — resilience
      return json(payload);
    } catch (err) {
      // GitHub unreachable → serve last good snapshot if we have one
      const lastGood = await env.PROJECTS_KV.get(LASTGOOD_KEY);
      if (lastGood) return json(JSON.parse(lastGood));
      // nothing cached yet → honest: only the real manual entries + an error flag
      return json({
        generated_at: new Date().toISOString(),
        projects: MANUAL,
        error: "github_unavailable"
      });
    }
  }
};

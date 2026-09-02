import fs from "node:fs";
import { NODE_RULES, NULL_RULES, DSA_TOPIC, DSA_LANG_NODES } from "./map-rules.mjs";

const SITE = "/Users/mac/Projects/personal/ai-solutions-engineer-roadmap/roadmap-data.js";
const raw = JSON.parse(fs.readFileSync("all-links.raw.json", "utf8"));

/* ---------------- normalization ---------------- */
const TRACKING = /^(utm_.*|ref|ref_src|source|src|fbclid|gclid|mc_cid|mc_eid|campaign|referrer|_gl)$/i;
function normalize(rawUrl) {
  let s = String(rawUrl).trim();
  if (/^ttps?:\/\//i.test(s)) s = "h" + s;            // repair upstream typo "ttps://"
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u;
  try { u = new URL(s); } catch { return null; }
  let host = u.host.toLowerCase().replace(/^www\./, "").replace(/^m\.youtube\.com$/, "youtube.com");
  // youtu.be/<id> == youtube.com/watch?v=<id>
  let path = u.pathname, params = new URLSearchParams(u.search);
  if (host === "youtu.be") { const id = path.replace(/^\//, ""); host = "youtube.com"; path = "/watch"; params = new URLSearchParams(); if (id) params.set("v", id); }
  for (const k of [...params.keys()]) if (TRACKING.test(k)) params.delete(k);
  if (host === "youtube.com" && path === "/watch") { const v = params.get("v"); params = new URLSearchParams(); if (v) params.set("v", v); }
  params.sort();
  path = path.replace(/\/+$/, "");
  const qs = params.toString();
  return { key: host + path + (qs ? "?" + qs : ""), host, path, firstSeg: path.split("/").filter(Boolean)[0] || "" };
}

/* ---------------- site side ---------------- */
const scope = { window: {} };
new Function("window", fs.readFileSync(SITE, "utf8"))(scope.window);
const R = scope.window.ROADMAP;
const siteRes = [];
const topicIndex = new Map();
for (const st of R.stages) for (const t of st.topics || []) {
  topicIndex.set(t.id, { topicId: t.id, topicTitle: t.title, topicEn: t.en, stageId: st.id, stageTitle: st.title });
  for (const r of t.resources || []) siteRes.push({ ...r, topicId: t.id, topicTitle: t.title, stageTitle: st.title });
}
const siteByKey = new Map();
const siteByNear = new Map();
const siteByHost = new Map();
const YT = new Set(["youtube.com"]);
for (const r of siteRes) {
  const n = normalize(r.url);
  if (!n) { console.error("site URL unparseable:", r.url); continue; }
  r._n = n;
  if (!siteByKey.has(n.key)) siteByKey.set(n.key, r);
  if (!YT.has(n.host)) {
    const nk = n.host + "|" + n.firstSeg;
    (siteByNear.get(nk) || siteByNear.set(nk, []).get(nk)).push(r);
    (siteByHost.get(n.host) || siteByHost.set(n.host, []).get(n.host)).push(r);
  }
}
// hosts too big for "same host" to mean anything
const MEGA = new Set(["youtube.com","github.com","medium.com","towardsdatascience.com","dev.to","ibm.com","aws.amazon.com","docs.aws.amazon.com","cloud.google.com","learn.microsoft.com","microsoft.com","huggingface.co","en.wikipedia.org","app.daily.dev","google.com","developers.google.com","docs.microsoft.com"]);

/* ---------------- filters ---------------- */
const SOCIAL = new Set(["twitter.com","x.com","linkedin.com","facebook.com","instagram.com","discord.com","discord.gg","t.me","threads.net","bsky.app"]);
const PAID_HOSTS = new Set(["udemy.com","educative.io","datacamp.com","pluralsight.com","oreilly.com","learning.oreilly.com","manning.com","packtpub.com","subscription.packtpub.com","algoexpert.io","interviewing.io","designgurus.io","udacity.com","maven.com","coursera.org","edx.org","simplilearn.com","skillshare.com","dataquest.io","zerotomastery.io","frontendmasters.com","educba.com","intellipaat.com","greatlearning.in","mygreatlearning.com","scaler.com"]);
const MARKETING_URLS = new Set([
  "forbes.com/councils/forbesbusinesscouncil/2025/01/28/executive-guide-to-ai-agent-pricing-winning-strategies-and-models-to-drive-growth",
  "internetsearchinc.com/ai-pricing-how-much-does-artificial-intelligence-cost",
]);
function filterOf(n, link) {
  if (!n) return { reason: "malformed-url", detail: "URL does not parse" };
  if (n.host === "roadmap.sh") return { reason: "own-roadmap", detail: "points back at roadmap.sh itself" };
  if (SOCIAL.has(n.host)) return { reason: "social", detail: "social network / chat invite, not a lesson" };
  if (/^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(n.host)) return { reason: "unstable-host", detail: "bare IP host, no domain — unstable/likely mirrored copy" };
  if (MARKETING_URLS.has(n.key)) return { reason: "marketing", detail: "vendor/SEO lead-gen page, no teaching content" };
  if (PAID_HOSTS.has(n.host)) return { reason: "paid-platform", detail: `${n.host} — paywalled course platform (free content is limited to a preview/audit)` };
  return null;
}

/* ---------------- topic mapping (resolved ONCE per node, so a node never splits) ---------------- */
const nodeTopicCache = new Map();
const linksByNode = new Map();
for (const l of raw) {
  const k = l.roadmap + "\u0000" + l.nodeFile;
  (linksByNode.get(k) || linksByNode.set(k, []).get(k)).push(l);
}
function resolveNodeTopic(roadmap, nodeFile, node) {
  const k = roadmap + "\u0000" + nodeFile;
  if (nodeTopicCache.has(k)) return nodeTopicCache.get(k);
  let topic = null;
  if (roadmap === "datastructures-and-algorithms") {
    topic = (DSA_LANG_NODES.test(node) && !/^python$/i.test(node)) ? null : DSA_TOPIC;
  } else if (NULL_RULES.some(re => re.test(node))) {
    topic = null;
  } else {
    for (const [re, id] of NODE_RULES) if (re.test(node)) { topic = id; break; }
    if (!topic) {                      // fall back to the node's link titles, but one verdict for the whole node
      outer: for (const [re, id] of NODE_RULES)
        for (const l of linksByNode.get(k) || []) if (re.test(l.title)) { topic = id; break outer; }
    }
  }
  nodeTopicCache.set(k, topic);
  return topic;
}
const mapTopic = (l) => resolveNodeTopic(l.roadmap, l.nodeFile, l.node);

/* ---------------- run ---------------- */
const all = [];
const candidates = new Map();   // normalized key -> candidate
const nearPairs = [];
const seenNear = new Set();

for (const l of raw) {
  const n = normalize(l.url);
  const rec = { ...l, normalizedUrl: n ? n.key : null, host: n ? n.host : null, status: null, reason: null, suggestedTopic: null };
  const f = filterOf(n, l);
  if (f) { rec.status = "filtered"; rec.reason = f.reason; rec.reasonDetail = f.detail; all.push(rec); continue; }
  const dup = siteByKey.get(n.key);
  if (dup) {
    rec.status = "duplicate";
    rec.reason = "already-on-site";
    rec.reasonDetail = `already in topic "${dup.topicTitle}" as "${dup.title}"`;
    all.push(rec); continue;
  }
  rec.status = "candidate";
  rec.suggestedTopic = mapTopic(l);
  all.push(rec);

  // near-duplicate detection vs site
  if (!YT.has(n.host)) {
    const nk = n.host + "|" + n.firstSeg;
    const pool = MEGA.has(n.host) ? (siteByNear.get(nk) || []) : (siteByHost.get(n.host) || []);
    for (const s of pool) {
      const pk = n.key + "::" + s._n.key;
      if (seenNear.has(pk)) continue;
      seenNear.add(pk);
      nearPairs.push({
        tier: s._n.firstSeg === n.firstSeg ? "same-host-same-section" : "same-host-other-section",
        host: n.host, candidateSection: n.firstSeg || "(root)", existingSection: s._n.firstSeg || "(root)",
        candidate: { title: l.title, url: l.url, type: l.type, roadmap: l.roadmap, node: l.node },
        existing: { title: s.title, url: s.url, topicId: s.topicId, topicTitle: s.topicTitle, stage: s.stageTitle },
      });
    }
  }

  // collapse internal duplicates
  const c = candidates.get(n.key);
  if (c) {
    c.occurrences.push({ roadmap: l.roadmap, node: l.node, nodeFile: l.nodeFile, title: l.title });
    if (!c.suggestedTopic && rec.suggestedTopic) c.suggestedTopic = rec.suggestedTopic;
  } else {
    candidates.set(n.key, {
      type: l.type, title: l.title, url: l.url, normalizedUrl: n.key, host: n.host,
      landingPage: n.path === "" || /^\/(index\.html?|en|en-us)$/i.test(n.path),
      roadmap: l.roadmap, node: l.node, nodeFile: l.nodeFile,
      suggestedTopic: rec.suggestedTopic,
      occurrences: [{ roadmap: l.roadmap, node: l.node, nodeFile: l.nodeFile, title: l.title }],
    });
  }
}

/* ---------------- group new-links by topic ---------------- */
const groups = new Map();
for (const c of candidates.values()) {
  const key = c.suggestedTopic || "__unmapped__";
  if (!groups.has(key)) {
    const t = topicIndex.get(c.suggestedTopic);
    groups.set(key, {
      suggestedTopic: c.suggestedTopic || null,
      topicTitle: t?.topicTitle || null, topicEn: t?.topicEn || null,
      stageId: t?.stageId || null, stageTitle: t?.stageTitle || null,
      count: 0, links: [],
    });
  }
  const g = groups.get(key);
  g.count++;
  g.links.push({ type: c.type, title: c.title, url: c.url, landingPage: !!c.landingPage, roadmap: c.roadmap, node: c.node, nodeFile: c.nodeFile, timesSeen: c.occurrences.length, alsoIn: c.occurrences.slice(1).map(o => `${o.roadmap}/${o.node}`) });
}
const stageOrder = R.stages.map(s => s.id);
const grouped = [...groups.values()].sort((a, b) => {
  if (!a.stageId) return 1; if (!b.stageId) return -1;
  const d = stageOrder.indexOf(a.stageId) - stageOrder.indexOf(b.stageId);
  return d || b.count - a.count;
});

/* ---------------- write ---------------- */
fs.writeFileSync("all-links.json", JSON.stringify(all, null, 2));
fs.writeFileSync("new-links.json", JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  source: "github.com/nilbuild/developer-roadmap @ 64d2a72 (2026-09-01)",
  totalCandidates: candidates.size,
  mapped: [...candidates.values()].filter(c => c.suggestedTopic).length,
  unmapped: [...candidates.values()].filter(c => !c.suggestedTopic).length,
  groups: grouped,
}, null, 2));
nearPairs.sort((a, b) => (a.tier === b.tier ? a.host.localeCompare(b.host) : a.tier < b.tier ? -1 : 1));
fs.writeFileSync("near-duplicates.json", JSON.stringify({ count: nearPairs.length, byTier: nearPairs.reduce((a,p)=>{a[p.tier]=(a[p.tier]||0)+1;return a;},{}), note: "same-host pairs only; youtube.com is excluded (video ids give no section signal) and mega-hosts are matched on host+first path segment only", pairs: nearPairs }, null, 2));

/* ---------------- stats to stdout ---------------- */
const st = { total: raw.length, filtered: 0, duplicate: 0, candidate: 0 };
const byReason = {}, byRoadmap = {};
for (const r of all) {
  st[r.status]++;
  (byRoadmap[r.roadmap] ||= { total: 0, filtered: 0, duplicate: 0, candidate: 0 });
  byRoadmap[r.roadmap].total++; byRoadmap[r.roadmap][r.status]++;
  if (r.status === "filtered") byReason[r.reason] = (byReason[r.reason] || 0) + 1;
}
console.log(JSON.stringify({ st, byReason, byRoadmap, siteResources: siteRes.length, uniqueCandidates: candidates.size, nearPairs: nearPairs.length, nearTier: nearPairs.reduce((a,p)=>{a[p.tier]=(a[p.tier]||0)+1;return a;},{}), landingPages: [...candidates.values()].filter(c=>c.landingPage).length,
  groupCounts: grouped.map(g => `${g.suggestedTopic || "UNMAPPED"}: ${g.count}`) }, null, 2));

import fs from "node:fs";
import path from "node:path";

const REPO = "/private/tmp/claude-501/-Users-mac/57d8268b-d9c1-434c-ba83-0c7913336315/scratchpad/developer-roadmap";
const ROADMAPS = ["ai-engineer","ai-agents","mlops","prompt-engineering","data-engineer","datastructures-and-algorithms"];

// - [@type@Title](url)   — title may contain [] brackets rarely; url may contain parens
const LINK_RE = /^\s*[-*]\s*\[@([a-z-]+)@([\s\S]*?)\]\((\S+?)\)\s*$/;
const H1_RE = /^#\s+(.+?)\s*$/;

const all = [];
const stats = {};
let filesWithNoLinks = 0;

for (const rm of ROADMAPS) {
  const dir = path.join(REPO, "roadmaps", rm, "content");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort();
  let count = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    const text = fs.readFileSync(full, "utf8");
    const lines = text.split(/\r?\n/);
    let node = null;
    let n = 0;
    for (const line of lines) {
      if (node === null) {
        const h = line.match(H1_RE);
        if (h) { node = h[1].trim(); if (node === "undefined") node = f.replace(/@.*$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()); continue; }
      }
      const m = line.match(LINK_RE);
      if (m) {
        all.push({
          roadmap: rm,
          node: node ?? f.replace(/@.*$/, ""),
          nodeFile: `roadmaps/${rm}/content/${f}`,
          type: m[1],
          title: m[2].trim(),
          url: m[3].trim(),
        });
        n++; count++;
      }
    }
    if (n === 0) filesWithNoLinks++;
  }
  stats[rm] = { files: files.length, links: count };
}

// sanity: catch link-shaped lines the regex missed
let missed = 0;
for (const rm of ROADMAPS) {
  const dir = path.join(REPO, "roadmaps", rm, "content");
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".md"))) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (/\[@[a-z-]+@/.test(line) && !LINK_RE.test(line)) { missed++; console.error("MISSED:", f, "|", line.slice(0,200)); }
    }
  }
}
console.log(JSON.stringify(stats, null, 2));
console.log("total links:", all.length, "| files w/o links:", filesWithNoLinks, "| regex misses:", missed);
const byType = {};
for (const l of all) byType[l.type] = (byType[l.type]||0)+1;
console.log("types:", byType);
fs.writeFileSync("all-links.raw.json", JSON.stringify(all, null, 2));

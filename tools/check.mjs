// Checks that the decision tree always ends on a code, and that the built
// site has no dead link or jargon. Run after build: node tools/check.mjs
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { loadTree, optionLabel, LANGS } from "./tree.mjs";

const fail = [];
const check = (ok, msg) => ok || fail.push(msg);
const { nodes, questions, results, labels, isLeaf } = loadTree();

// 1. Every one of the 516 codes is reachable, by exactly one path.
const unitGroups = [...nodes.values()].filter((n) => n.code.length === 5);
check(unitGroups.length === 516, `expected 516 unit groups, got ${unitGroups.length}`);
const reached = new Map();
for (const q of questions.values())
  for (const o of q.options) if (isLeaf(o.target)) reached.set(o.target.code, (reached.get(o.target.code) ?? 0) + 1);
for (const n of unitGroups) check(reached.get(n.code) === 1, `${n.code} reached ${reached.get(n.code) ?? 0} times`);
check(results.size === 516, `expected 516 result pages, got ${results.size}`);

// 2. Real choices only, and short paths.
for (const [code, q] of questions) {
  check(q.options.length >= 2, `question ${code || "(root)"} has ${q.options.length} option(s)`);
  check(q.total <= 5, `question ${code} is on a path of ${q.total} questions`);
}

// 3. Both languages complete, and every group option has a plain label.
for (const n of nodes.values())
  for (const lang of LANGS) check(n.title[lang], `${n.code} has no ${lang} title`);
for (const q of questions.values())
  for (const o of q.options) {
    if (isLeaf(o.target)) continue;
    for (const lang of LANGS) {
      const label = optionLabel(o.child, labels, lang);
      check(label, `${o.child.code} has no plain ${lang} label in data/labels.json`);
      if (label && o.child.code.length > 2) check(label.split(/\s+/).length <= 12, `${o.child.code} ${lang} label too long: ${label}`);
    }
  }
for (const q of questions.values())
  for (const o of q.options)
    if (o.child.code.length === 2) for (const lang of LANGS) check(labels.majors[o.child.code]?.[lang], `${o.child.code} has no ${lang} job examples in labels.json majors`);
const used = new Set([...questions.values()].flatMap((q) => q.options.map((o) => o.child.code)));
for (const code of Object.keys(labels.groups)) check(used.has(code), `labels.json: ${code} is never shown`);

// 4. Spot paths: these codes exist and have a result page in both languages.
for (const code of ["63200", "31302", "21232", "73300", "65310"]) {
  for (const lang of LANGS) check(existsSync(`site/${lang}/${code}/index.html`), `no page for ${lang}/${code}`);
}

// 5. The built site: every internal link resolves, no jargon on question pages.
const JARGON = { fr: /\b(sous-grand groupe|grand groupe|groupe de base|FEER|personnel assimilé)\b/i, en: /\b(sub-major group|major group|unit group|TEER)\b/i };
const pages = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = `${dir}/${f}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "index.html") pages.push(p);
  }
};
if (!existsSync("site")) fail.push("site/ is missing: run node tools/build.mjs first");
else {
  walk("site");
  check(pages.length === 1 + 2 * (questions.size + results.size), `unexpected page count ${pages.length}`);
  for (const p of pages) {
    const html = readFileSync(p, "utf8");
    for (const [, href] of html.matchAll(/href="(\/[^"?#]*)/g)) {
      const target = href.endsWith("/") ? `site${href}index.html` : `site${href}`;
      check(existsSync(target), `${p}: dead link ${href}`);
    }
    const m = p.match(/^site\/(fr|en)\/(\d*)\/?index\.html$/);
    if (m && !(m[2].length === 5)) {
      const main = html.slice(html.indexOf("<main>"), html.indexOf("</main>")).replace(/<small>.*?<\/small>/gs, "");
      const hit = main.match(JARGON[m[1]]);
      check(!hit, `${p}: jargon « ${hit?.[0]} »`);
    }
  }
}

if (fail.length) {
  console.error(`✗ ${fail.length} problem(s):\n  ` + fail.slice(0, 50).join("\n  "));
  process.exit(1);
}
console.log(`✓ 516 codes reachable, ${questions.size} questions (≤ 5 per path), ${pages.length} pages, no dead link`);

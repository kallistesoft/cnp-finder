// Loads StatCan's NOC 2021 V1.0 files (FR + EN) and builds the decision tree.
// Shared by build.mjs and check.mjs.
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8").replace(/^﻿/, "");

export const LANGS = ["fr", "en"];
const FILES = {
  fr: { structure: "data/cnp-2021-v1.0-structure-classification.csv", elements: "data/cnp-2021-v1.0-elements.csv" },
  en: { structure: "data/noc-2021-v1.0-classification-structure.csv", elements: "data/noc-2021-v1.0-elements.csv" },
};
// Element types, by the label each language's file uses.
const KIND = {
  "Exemple(s) illustratif(s)": "examples", "Illustrative example(s)": "examples",
  "Tous les exemples": "all", "All examples": "all",
  "Fonctions principales": "duties", "Main duties": "duties",
  "Conditions d'accès à la profession": "requirements", "Employment requirements": "requirements",
  "Exclusion(s)": "exclusions",
};

/** RFC 4180 CSV: quoted fields may hold commas, quotes and newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => s.replace(/\s+/g, " ").trim();

export function loadTree() {
  const labels = JSON.parse(read("data/labels.json"));
  const nodes = new Map(); // code → { code, title: {fr,en}, definition: {fr,en}, children: [] }
  for (const lang of LANGS) {
    for (const [level, , code, title, definition] of parseCsv(read(FILES[lang].structure)).slice(1)) {
      if (!code) continue;
      const n = nodes.get(code) ?? { code, level: +level, title: {}, definition: {}, children: [], elements: {} };
      n.title[lang] = clean(title);
      n.definition[lang] = clean(definition ?? "");
      nodes.set(code, n);
    }
    for (const [, code, , type, text] of parseCsv(read(FILES[lang].elements)).slice(1)) {
      const kind = KIND[clean(type ?? "")];
      const n = nodes.get(code);
      if (!kind || !n) continue;
      const el = (n.elements[lang] ??= { examples: [], all: [], duties: [], requirements: [], exclusions: [] });
      el[kind].push(clean(text));
    }
  }
  for (const n of nodes.values()) {
    const parent = nodes.get(n.code.slice(0, -1));
    if (parent) parent.children.push(n);
  }
  const top = [...nodes.values()].filter((n) => n.code.length === 1);
  const rootNode = { code: "", level: 0, title: {}, definition: {}, children: top, elements: {} };
  for (const n of nodes.values()) n.children.sort((a, b) => a.code.localeCompare(b.code));
  top.sort((a, b) => a.code.localeCompare(b.code));

  const isLeaf = (n) => n.children.length === 0;
  /** Skips groups that hold a single subgroup: nothing to ask there. */
  const settle = (n) => { while (n.children.length === 1) n = n.children[0]; return n; };

  // Walk the questions from the root; every page knows how it was reached.
  const questions = new Map(); // code → { node, parent, via, step, options }
  const results = new Map(); // code → { node, parent, via, step }
  const walk = (node, parent, via, step) => {
    const options = node.children.map((child) => ({ child, target: settle(child) }));
    questions.set(node.code, { node, parent, via, step, options });
    for (const { child, target } of options) {
      if (isLeaf(target)) results.set(target.code, { node: target, parent: node.code, via: child, step: step + 1 });
      else walk(target, node.code, child, step + 1);
    }
  };
  walk(settle(rootNode), null, null, 1);
  // Longest path below each question, so a page can say « étape 2 sur 4 ».
  const depth = (code) => {
    const q = questions.get(code);
    return 1 + Math.max(0, ...q.options.filter((o) => !isLeaf(o.target)).map((o) => depth(o.target.code)));
  };
  for (const [code, q] of questions) q.total = q.step - 1 + depth(code);

  return { nodes, questions, results, labels, isLeaf };
}

/** The plain label of an option: domain, then education level, then group. */
export function optionLabel(child, labels, lang) {
  const { code } = child;
  if (code.length === 1) return labels.domains[code]?.[lang];
  if (code.length === 2) return labels.teer[code[1]]?.[lang];
  const g = labels.groups[code];
  return g ? g[lang === "fr" ? 0 : 1] : undefined;
}

const words = (s) => new Set(s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z]{4,}/g) ?? []);

/** The most typical example job titles: those closest to the group's own
 *  title (« cuisinier » for Cooks, not « astrologue »), shortest first. */
export function shortExamples(node, lang, n) {
  const el = node.elements[lang];
  const list = el?.examples.length ? el.examples : el?.all ?? [];
  const title = words(node.title[lang] ?? "");
  const score = (ex) => [...words(ex)].filter((w) => [...title].some((t) => t.startsWith(w.slice(0, 5)) || w.startsWith(t.slice(0, 5)))).length;
  return [...new Set(list)]
    .map((ex) => ({ ex, s: score(ex) }))
    .sort((a, b) => b.s - a.s || a.ex.length - b.ex.length)
    .slice(0, n)
    .map((x) => x.ex);
}

/** « Chefs  (Voir 62200 Chefs) » → { text: "Chefs", code: "62200" } */
export function parseExclusion(text) {
  const m = text.match(/^(.*?)\s*\((?:Voir|See)\s+(\d{1,5})\b/);
  return m ? { text: clean(m[1]), code: m[2] } : { text, code: null };
}

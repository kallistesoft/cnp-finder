// Writes the decision tree and every result, in both languages, as one JSON
// file for the Android app (kallistesoft/cnp-android):
//   node tools/export-app.mjs <path/to/noc.json>
// The app reads it offline; its tests check the same guarantees as check.mjs.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildContent } from "./content.mjs";

const out = process.argv[2];
if (!out) {
  console.error("usage: node tools/export-app.mjs <output.json>");
  process.exit(1);
}
const content = buildContent();
// One shape for every option: the website's job cards list examples in `hint`,
// the app gets them in `examples` and a plain `hint` string everywhere.
const questions = content.questions.map((q) => ({
  ...q,
  options: q.options.map(({ hint, ...o }) => {
    const isList = Array.isArray(hint.fr);
    return {
      ...o,
      icon: o.icon ?? null,
      hint: isList ? { fr: "", en: "" } : hint,
      examples: isList ? hint : { fr: [], en: [] },
    };
  }),
}));
const { results } = content;
const body = JSON.stringify({ questions, results });
// Changes only when the content does, so the app can tell versions apart.
const version = createHash("sha1").update(body).digest("hex").slice(0, 12);
writeFileSync(out, JSON.stringify({ version, source: "Statistics Canada, NOC 2021 Version 1.0", questions, results }));
console.log(`${out}: ${questions.length} questions, ${results.length} results, version ${version}`);

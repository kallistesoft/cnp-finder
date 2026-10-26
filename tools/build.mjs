// Generates the static site in site/ from StatCan's files and data/labels.json:
//   /                     language choice
//   /fr/, /en/            first question
//   /fr/<code>/           a question (a group with several subgroups) or a result (a 5-digit code)
// Run: node tools/build.mjs
import { writeFileSync, mkdirSync, rmSync, cpSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { LANGS } from "./tree.mjs";
import { buildContent } from "./content.mjs";

// Kept out of search engines until the user decides to publish it.
const NOINDEX = true;

const root = new URL("../", import.meta.url);
const out = new URL("site/", root);
const T = {
  fr: {
    name: "Trouver mon code CNP",
    tagline: "Trouvez votre code CNP en quelques clics, sans rien écrire.",
    intro: "Le code CNP (Classification nationale des professions) décrit votre emploi pour Immigration Canada. Répondez à quelques questions simples : choisissez à chaque fois la réponse qui ressemble le plus à votre emploi principal.",
    start: "Commencer",
    other: "English",
    step: (n, total) => `Étape ${n} sur ${total}`,
    qDomain: "Dans quel domaine travaillez-vous ?",
    qLevel: "Qu'est-ce qui décrit le mieux votre poste ?",
    qLevelHelp: "Pensez à ce que l'employeur demande pour ce poste, pas forcément à vos propres diplômes.",
    qGroup: "Précisez votre domaine de travail",
    qJob: "Lequel ressemble le plus à votre emploi ?",
    unsure: "Je ne suis pas sûr(e)",
    unsureText: "Choisissez selon votre emploi principal : celui où vous passez le plus d'heures, ou celui que vous voulez faire valoir. Si deux réponses vous semblent proches, ouvrez « Voir d'autres exemples » sous chacune. Vous pourrez toujours revenir en arrière.",
    more: "Voir d'autres exemples",
    forExample: "Par exemple :",
    back: "← Retour",
    restart: "Recommencer",
    yourPath: "Vos réponses",
    yourCode: "Votre code CNP est",
    copy: "Copier le code",
    copied: "Code copié",
    what: "C'est ce code que demande Immigration Canada pour décrire votre emploi. Vérifiez que la description ci-dessous correspond bien à ce que vous faites.",
    level: "Niveau FEER",
    duties: "Ce que font ces personnes",
    examples: "Exemples d'emplois",
    requirements: "Conditions d'accès à la profession",
    notThis: "Pas tout à fait ça ?",
    notThisText: "Si votre emploi ressemble plutôt à l'un de ceux-ci, choisissez-le :",
    seeCode: "voir le code",
    seeGroup: "voir ce groupe",
    source: "Source : Statistique Canada, Classification nationale des professions (CNP) 2021 version 1.0. Reproduit et diffusé « tel quel » avec la permission de Statistique Canada, sous la Licence du gouvernement ouvert – Canada. Cet outil n'est pas un service officiel du gouvernement du Canada.",
    teer: {
      0: "postes de gestion",
      1: "diplôme universitaire habituellement exigé",
      2: "programme collégial de 2 ans ou plus, apprentissage de 2 ans ou plus, ou supervision",
      3: "programme collégial de moins de 2 ans, apprentissage court ou plus de 6 mois de formation en cours d'emploi",
      4: "diplôme d'études secondaires ou quelques semaines de formation en cours d'emploi",
      5: "courte démonstration du travail, aucun diplôme exigé",
    },
  },
  en: {
    name: "Find my NOC code",
    tagline: "Find your NOC code in a few clicks, without typing anything.",
    intro: "The NOC code (National Occupational Classification) describes your job for Immigration Canada. Answer a few simple questions: each time, pick the answer closest to your main job.",
    start: "Start",
    other: "Français",
    step: (n, total) => `Step ${n} of ${total}`,
    qDomain: "What field do you work in?",
    qLevel: "What best describes your job?",
    qLevelHelp: "Think of what the employer requires for this job, not necessarily your own diplomas.",
    qGroup: "Narrow down your line of work",
    qJob: "Which one is closest to your job?",
    unsure: "I'm not sure",
    unsureText: "Choose based on your main job: the one where you spend the most hours, or the one you want to put forward. If two answers seem close, open « See more examples » under each. You can always go back.",
    more: "See more examples",
    forExample: "For example:",
    back: "← Back",
    restart: "Start over",
    yourPath: "Your answers",
    yourCode: "Your NOC code is",
    copy: "Copy the code",
    copied: "Code copied",
    what: "This is the code Immigration Canada asks for to describe your job. Check that the description below matches what you actually do.",
    level: "TEER level",
    duties: "What these people do",
    examples: "Job examples",
    requirements: "Employment requirements",
    notThis: "Not quite it?",
    notThisText: "If your job is closer to one of these, pick it:",
    seeCode: "see code",
    seeGroup: "see this group",
    source: "Source: Statistics Canada, National Occupational Classification (NOC) 2021 Version 1.0. Reproduced and distributed on an \"as is\" basis with the permission of Statistics Canada, under the Open Government Licence – Canada. This tool is not an official Government of Canada service.",
    teer: {
      0: "management occupations",
      1: "university degree usually required",
      2: "college program of 2 years or more, apprenticeship of 2 years or more, or supervisory duties",
      3: "college program under 2 years, short apprenticeship or over 6 months of on-the-job training",
      4: "high school diploma or several weeks of on-the-job training",
      5: "short work demonstration, no formal education required",
    },
  },
};

// French typography: a non-breaking space before « ? » and « : » keeps them off a line of their own.
const esc = (s) => String(s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
  .replace(/ ([?:!»])/g, "&nbsp;$1").replace(/« /g, "«&nbsp;");
const hash = (f) => createHash("sha1").update(readFileSync(new URL(f, root))).digest("hex").slice(0, 8);
const ASSET_V = { css: hash("css/style.css"), js: hash("js/copy.js") };

const { questions, results } = buildContent();
const href = (lang, code) => `/${lang}/${code ? code + "/" : ""}`;

function questionText(q, lang) {
  const t = T[lang];
  return { domain: { title: t.qDomain }, job: { title: t.qJob }, level: { title: t.qLevel, help: t.qLevelHelp }, group: { title: t.qGroup } }[q.kind];
}

function layout({ lang, path, title, body, bodyClass = "" }) {
  const other = lang === "fr" ? "en" : "fr";
  const t = T[lang];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${NOINDEX ? '<meta name="robots" content="noindex">\n' : ""}<title>${esc(title)}</title>
<meta name="description" content="${esc(t.tagline)}">
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V.css}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🧭%3C/text%3E%3C/svg%3E">
</head>
<body class="${bodyClass}">
<header class="top">
  <a class="brand" href="/${lang}/">🧭 ${esc(t.name)}</a>
  <a class="lang" href="/${other}/${path}" hreflang="${other}" lang="${other}">${esc(t.other)}</a>
</header>
<main>
${body}
</main>
<footer><p>${esc(t.source)}</p></footer>
<script src="/js/copy.js?v=${ASSET_V.js}" defer></script>
</body>
</html>
`;
}

function progress(step, total, lang) {
  const pct = Math.round((step / total) * 100);
  return `<div class="progress"><span>${esc(T[lang].step(step, total))}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

function crumbs(steps, lang) {
  if (!steps.length) return "";
  return `<nav class="trail" aria-label="${esc(T[lang].yourPath)}"><span>${esc(T[lang].yourPath + (lang === "fr" ? " :" : ":"))}</span><ol>${steps
    .map((s) => `<li><a href="${href(lang, s.question)}">${esc(s.label[lang])}</a></li>`)
    .join("")}</ol></nav>`;
}

function optionCard(o, lang) {
  const t = T[lang];
  const link = href(lang, o.target);
  const more = o.more[lang].length ? `<details><summary>${esc(t.more)}</summary><p>${esc(o.more[lang].join(" · "))}</p></details>` : "";
  switch (o.style) {
    case "level":
      return `<li class="option">
  <a href="${link}"><strong>${esc(o.label[lang])}</strong><small>${esc(o.hint[lang])}</small></a>
  ${more}
</li>`;
    case "job":
      return `<li class="option job">
  <a href="${link}"><strong>${esc(o.label[lang])}</strong>${o.hint[lang].length ? `<small>${esc(t.forExample)} ${esc(o.hint[lang].join(", "))}</small>` : ""}</a>
  ${more}
</li>`;
    case "domain":
      return `<li class="option domain">
  <a href="${link}"><span class="icon" aria-hidden="true">${o.icon}</span><strong>${esc(o.label[lang])}</strong><small>${esc(o.hint[lang])}</small></a>
</li>`;
    default:
      return `<li class="option">
  <a href="${link}"><strong>${esc(o.label[lang])}</strong></a>
  ${more}
</li>`;
  }
}

function questionPage(q, lang) {
  const t = T[lang];
  const { code } = q;
  const { title, help } = questionText(q, lang);
  const back = q.parent === null ? "/" : href(lang, q.parent);
  const body = `${progress(q.step, q.total, lang)}
${crumbs(q.trail, lang)}
<h1>${esc(title)}</h1>
${help ? `<p class="help">${esc(help)}</p>` : ""}
<ul class="options${code === "" ? " grid" : ""}">
${q.options.map((o) => optionCard(o, lang)).join("\n")}
</ul>
<details class="unsure"><summary>${esc(t.unsure)}</summary><p>${esc(t.unsureText)}</p></details>
<p class="nav"><a class="button ghost" href="${back}">${esc(t.back)}</a>${code === "" ? "" : ` <a class="button ghost" href="${href(lang, "")}">${esc(t.restart)}</a>`}</p>`;
  return layout({ lang, path: code ? code + "/" : "", title: `${title} · ${t.name}`, body });
}

function resultPage(r, lang) {
  const t = T[lang];
  const { code } = r;
  const duties = r.duties[lang];
  const exclusions = r.exclusions[lang];
  const body = `${crumbs(r.trail, lang)}
<section class="result">
  <p class="eyebrow">${esc(t.yourCode)}</p>
  <p class="code"><span id="code">${esc(code)}</span> <button type="button" class="copy" data-copy="${esc(code)}" data-done="${esc(t.copied)}">${esc(t.copy)}</button></p>
  <h1>${esc(r.title[lang])}</h1>
  <p class="what">${esc(t.what)}</p>
  <p class="teer"><strong>${esc(t.level)} ${esc(r.teer)}</strong>${lang === "fr" ? "&nbsp;:" : ":"} ${esc(t.teer[r.teer])}</p>
</section>
${r.definition[lang] ? `<p class="definition">${esc(r.definition[lang])}</p>` : ""}
${duties.length ? `<h2>${esc(t.duties)}</h2><ul class="list">${duties.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
${r.examples[lang].length ? `<h2>${esc(t.examples)}</h2><p class="examples">${esc(r.examples[lang].join(" · "))}</p>` : ""}
${exclusions.length ? `<section class="notthis"><h2>${esc(t.notThis)}</h2><p>${esc(t.notThisText)}</p><ul>${exclusions
    .map((x) => `<li><a href="${href(lang, x.page)}">${esc(x.text)}</a> <small>${x.isResult ? `${esc(t.seeCode)} ${esc(x.page)}` : esc(t.seeGroup)}</small></li>`)
    .join("")}</ul></section>` : ""}
${r.requirements[lang].length ? `<details class="req"><summary>${esc(t.requirements)}</summary><ul class="list">${r.requirements[lang].map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>` : ""}
<p class="nav"><a class="button ghost" href="${href(lang, r.parent)}">${esc(t.back)}</a> <a class="button" href="${href(lang, "")}">${esc(t.restart)}</a></p>`;
  return layout({ lang, path: code + "/", title: `${code} ${r.title[lang]} · ${t.name}`, body, bodyClass: "is-result" });
}

function home() {
  const blocks = LANGS.map((lang) => {
    const t = T[lang];
    return `<section class="welcome" lang="${lang}"><h2>${esc(t.name)}</h2><p>${esc(t.intro)}</p><p><a class="button big" href="/${lang}/">${esc(t.start)} →</a></p></section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${NOINDEX ? '<meta name="robots" content="noindex">\n' : ""}<title>Trouver mon code CNP · Find my NOC code</title>
<meta name="description" content="${esc(T.fr.tagline)} ${esc(T.en.tagline)}">
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V.css}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🧭%3C/text%3E%3C/svg%3E">
</head>
<body class="home">
<main>
<h1 class="hero">🧭 Trouver mon code CNP<br><span>Find my NOC code</span></h1>
<div class="welcome-grid">
${blocks}
</div>
</main>
<footer><p>${esc(T.fr.source)}</p><p lang="en">${esc(T.en.source)}</p></footer>
</body>
</html>
`;
}

function write(path, html) {
  const url = new URL(path, out);
  mkdirSync(new URL("./", url), { recursive: true });
  writeFileSync(url, html);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL("css/", root), new URL("css/", out), { recursive: true });
cpSync(new URL("js/", root), new URL("js/", out), { recursive: true });
write("robots.txt", NOINDEX ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n");
write("index.html", home());
const counts = {};
for (const lang of LANGS) {
  counts[lang] = 0;
  for (const q of questions) { write(`${lang}/${q.code ? q.code + "/" : ""}index.html`, questionPage(q, lang)); counts[lang]++; }
  for (const r of results) { write(`${lang}/${r.code}/index.html`, resultPage(r, lang)); counts[lang]++; }
}
console.log(`site/: ${questions.length} questions + ${results.length} results per language`, counts);

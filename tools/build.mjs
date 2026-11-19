// Generates the static site in site/ from StatCan's files and data/labels.json,
// with the same screens as the Android app (kallistesoft/cnp-android):
//   /                       sends the visitor to their language (chooser without JavaScript)
//   /fr/, /en/              home: start, look up a code, my codes, settings
//   /fr/questions/          the first question
//   /fr/<code>/             a question (a group with several subgroups) or a result (a 5-digit code)
//   /fr/search/             look up a code by its digits (?compare=<code> picks the second code of a comparison)
//   /fr/compare/?a=…&b=…    two codes side by side
//   /fr/saved/, /fr/settings/
//   /data/codes.json        every code's title and neighbours (search, my codes); /data/<code>.json for comparisons
// Run: node tools/build.mjs
import { writeFileSync, mkdirSync, rmSync, cpSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { LANGS } from "./tree.mjs";
import { buildContent } from "./content.mjs";

// Kept out of search engines until the user decides to publish it.
const NOINDEX = true;
// Anonymous visit statistics (js/track.js): the KallisteSoft endpoint, and a Google Analytics ID (off while empty).
const STATS_URL = "https://kallistesoft.ca/hit.php";
const GA_ID = "";

const root = new URL("../", import.meta.url);
const out = new URL("site/", root);

// The app's strings (core/ui/src/main/res/values*/strings.xml), with web words where the app's don't fit
// (site instead of app, click instead of tap, the browser's language instead of the phone's).
const T = {
  fr: {
    name: "Trouver mon code CNP",
    tagline: "Trouvez votre code CNP en quelques clics, sans rien écrire.",
    homeTitle: "Trouvez votre code CNP",
    homeIntro: "Le code CNP (Classification nationale des professions) décrit votre emploi pour Immigration Canada. Répondez à quelques questions simples : rien à écrire, 5 clics au plus.",
    homeStart: "Commencer",
    homeSearch: "Chercher un code",
    homeSaved: "Mes codes",
    homeSettings: "Paramètres",
    homeDisclaimer: "Site non officiel du gouvernement du Canada. Données : Statistique Canada, CNP 2021 version 1.0.",
    step: (n, total) => `Étape ${n} sur ${total}`,
    qDomain: "Dans quel domaine travaillez-vous ?",
    qLevel: "Qu'est-ce qui décrit le mieux votre poste ?",
    qLevelHelp: "Pensez à ce que l'employeur demande pour ce poste, pas forcément à vos propres diplômes.",
    qGroup: "Précisez votre domaine de travail",
    qJob: "Lequel ressemble le plus à votre emploi ?",
    unsure: "Je ne suis pas sûr(e)",
    unsureText: "Choisissez selon votre emploi principal : celui où vous passez le plus d'heures, ou celui que vous voulez faire valoir. Si deux réponses vous semblent proches, ouvrez « Voir d'autres exemples » sous chacune. Vous pourrez toujours revenir en arrière.",
    more: "Voir d'autres exemples",
    less: "Masquer les exemples",
    forExample: "Par exemple :",
    changeAnswer: "Modifier cette réponse",
    yourAnswers: "Vos réponses",
    back: "Retour",
    restart: "Recommencer",
    loading: "Chargement…",
    yourCode: "Votre code CNP est",
    what: "C'est ce code que demande Immigration Canada pour décrire votre emploi. Vérifiez que la description ci-dessous correspond bien à ce que vous faites.",
    teerLine: (n, text) => `Niveau FEER ${n} : ${text}`,
    copy: "Copier",
    copied: "Code copié",
    share: "Partager",
    shareText: (code, title) => `Mon code CNP : ${code} – ${title}`,
    save: "Enregistrer",
    saved: "Enregistré",
    duties: "Ce que font ces personnes",
    examples: "Exemples d'emplois",
    requirements: "Conditions d'accès à la profession",
    notThis: "Pas tout à fait ça ?",
    notThisText: "Si votre emploi ressemble plutôt à l'un de ceux-ci, choisissez-le :",
    seeCode: (code) => `voir le code ${code}`,
    seeGroup: "voir ce groupe",
    teer: {
      0: "postes de gestion",
      1: "diplôme universitaire habituellement exigé",
      2: "programme collégial de 2 ans ou plus, apprentissage de 2 ans ou plus, ou supervision",
      3: "programme collégial de moins de 2 ans, apprentissage court ou plus de 6 mois de formation en cours d'emploi",
      4: "diplôme d'études secondaires ou quelques semaines de formation en cours d'emploi",
      5: "courte démonstration du travail, aucun diplôme exigé",
    },
    savedTitle: "Mes codes",
    savedEmpty: "Aucun code enregistré pour l'instant. Sur un résultat, cliquez sur « Enregistrer » pour le garder ici (par exemple le vôtre et celui de votre conjoint).",
    savedRemove: (title) => `Retirer ${title}`,
    settingsTitle: "Paramètres",
    settingsLanguage: "Langue",
    languages: { system: "Langue du navigateur", en: "English", fr: "Français" },
    settingsAbout: "À propos",
    settingsDisclaimer: "Ce site n'est pas un service officiel du gouvernement du Canada et ne donne pas de conseils en immigration. Vérifiez votre code selon vos tâches réelles, ou auprès d'un avocat ou d'un consultant autorisé.",
    settingsSource: "Source : Statistique Canada, Classification nationale des professions (CNP) 2021 version 1.0. Reproduit et diffusé « tel quel » avec la permission de Statistique Canada, sous la Licence du gouvernement ouvert – Canada.",
    settingsPrivacy: "Vos codes enregistrés et votre langue restent dans ce navigateur. Le site compte les visites de façon anonyme, sans cookie.",
    privacy: "Confidentialité",
    privacyUrl: "https://kallistesoft.ca/confidentialite/",
    searchTitle: "Chercher un code",
    searchCompareTitle: "Comparer avec…",
    searchField: "Code CNP",
    searchHint: "Tapez les chiffres du code : les codes correspondants s'affichent au fur et à mesure.",
    searchNone: "Aucun code CNP 2021 ne correspond.",
    searchNeighbours: "Métiers voisins",
    searchSaved: "Mes codes",
    compare: "Comparer avec un autre code",
    compareTitle: "Comparer",
    compareSameTeer: "Même niveau FEER",
    compareDifferentTeer: "Niveaux FEER différents",
    compareDefinition: "Description",
    compareSwap: "Inverser",
    compareChange: "Changer le second code",
  },
  en: {
    name: "Find my NOC code",
    tagline: "Find your NOC code in a few clicks, without typing anything.",
    homeTitle: "Find your NOC code",
    homeIntro: "The NOC code (National Occupational Classification) describes your job for Immigration Canada. Answer a few simple questions: no typing, at most 5 clicks.",
    homeStart: "Start",
    homeSearch: "Look up a code",
    homeSaved: "My codes",
    homeSettings: "Settings",
    homeDisclaimer: "Not a Government of Canada site. Data: Statistics Canada, NOC 2021 Version 1.0.",
    step: (n, total) => `Step ${n} of ${total}`,
    qDomain: "What field do you work in?",
    qLevel: "What best describes your job?",
    qLevelHelp: "Think of what the employer requires for this job, not necessarily your own diplomas.",
    qGroup: "Narrow down your line of work",
    qJob: "Which one is closest to your job?",
    unsure: "I'm not sure",
    unsureText: "Choose based on your main job: the one where you spend the most hours, or the one you want to put forward. If two answers seem close, open “See more examples” under each. You can always go back.",
    more: "See more examples",
    less: "Hide examples",
    forExample: "For example:",
    changeAnswer: "Change this answer",
    yourAnswers: "Your answers",
    back: "Back",
    restart: "Start over",
    loading: "Loading…",
    yourCode: "Your NOC code is",
    what: "This is the code Immigration Canada asks for to describe your job. Check that the description below matches what you actually do.",
    teerLine: (n, text) => `TEER level ${n}: ${text}`,
    copy: "Copy",
    copied: "Code copied",
    share: "Share",
    shareText: (code, title) => `My NOC code: ${code} – ${title}`,
    save: "Save",
    saved: "Saved",
    duties: "What these people do",
    examples: "Job examples",
    requirements: "Employment requirements",
    notThis: "Not quite it?",
    notThisText: "If your job is closer to one of these, pick it:",
    seeCode: (code) => `see code ${code}`,
    seeGroup: "see this group",
    teer: {
      0: "management occupations",
      1: "university degree usually required",
      2: "college program of 2 years or more, apprenticeship of 2 years or more, or supervisory duties",
      3: "college program under 2 years, short apprenticeship or over 6 months of on-the-job training",
      4: "high school diploma or several weeks of on-the-job training",
      5: "short work demonstration, no formal education required",
    },
    savedTitle: "My codes",
    savedEmpty: "No saved code yet. On a result, click “Save” to keep it here (for example yours and your spouse's).",
    savedRemove: (title) => `Remove ${title}`,
    settingsTitle: "Settings",
    settingsLanguage: "Language",
    languages: { system: "Browser's language", en: "English", fr: "Français" },
    settingsAbout: "About",
    settingsDisclaimer: "This site is not an official Government of Canada service and doesn't give immigration advice. Check your code against your actual duties, or with a lawyer or licensed consultant.",
    settingsSource: "Source: Statistics Canada, National Occupational Classification (NOC) 2021 Version 1.0. Reproduced and distributed on an “as is” basis with the permission of Statistics Canada, under the Open Government Licence – Canada.",
    settingsPrivacy: "Your saved codes and your language stay in this browser. The site counts visits anonymously, without cookies.",
    privacy: "Privacy",
    privacyUrl: "https://kallistesoft.ca/en/privacy/",
    searchTitle: "Look up a code",
    searchCompareTitle: "Compare with…",
    searchField: "NOC code",
    searchHint: "Type the code's digits: the matching codes show as you type.",
    searchNone: "No NOC 2021 code matches.",
    searchNeighbours: "Neighbouring jobs",
    searchSaved: "My codes",
    compare: "Compare with another code",
    compareTitle: "Compare",
    compareSameTeer: "Same TEER level",
    compareDifferentTeer: "Different TEER levels",
    compareDefinition: "Description",
    compareSwap: "Swap",
    compareChange: "Change the second code",
  },
};

// Material Symbols Rounded paths (Apache 2.0), the icons the app uses.
const ICON = {
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  restart: "M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm-6 8c0-1.65.67-3.15 1.76-4.24L6.34 7.34A7.95 7.95 0 0 0 4 13c0 4.08 3.05 7.44 7 7.93v-2.02c-2.83-.48-5-2.94-5-5.91z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  expand: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  swap: "M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
};
const icon = (name, cls = "") => `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;

// French typography: a non-breaking space before « ? », « : », « ! » and « » » keeps them off a line of their own.
const nbsp = (s) => String(s).replace(/ ([?:!»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
const esc = (s) => nbsp(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 8);
const hash = (f) => sha(readFileSync(new URL(f, root)));
const ASSET_V = { css: hash("css/style.css"), js: hash("js/app.js"), track: hash("js/track.js") };

const { questions, results } = buildContent();
const href = (lang, code) => (code === "" ? `/${lang}/questions/` : `/${lang}/${code}/`);

// What the browser needs for the pages it draws itself (search, comparison, my codes).
const neighbours = (r) => [...new Set([...r.exclusions.fr, ...r.exclusions.en].filter((x) => x.isResult).map((x) => x.page))];
const index = JSON.stringify(results.map((r) => ({ c: r.code, t: r.title, n: neighbours(r) })));
const DATA_V = sha(index);

/** The strings the page's script shows, French spaces included. */
function clientStrings(lang) {
  const t = T[lang];
  const keys = ["copied", "save", "saved", "searchTitle", "searchCompareTitle", "searchNone", "searchNeighbours", "searchSaved", "compareSameTeer",
    "compareDifferentTeer", "compareDefinition", "duties", "examples", "requirements", "back", "compareChange", "loading", "name"];
  const s = Object.fromEntries(keys.map((k) => [k, nbsp(t[k])]));
  s.teer = Object.fromEntries(Object.entries(t.teer).map(([k, v]) => [k, nbsp(t.teerLine(k, v))]));
  s.shareText = nbsp(t.shareText("{code}", "{title}"));
  s.savedRemove = nbsp(t.savedRemove("{title}"));
  return s;
}

function head(lang, title, description) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${NOINDEX ? '<meta name="robots" content="noindex">\n' : ""}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F6F8FC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#060D24" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V.css}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🧭%3C/text%3E%3C/svg%3E">`;
}

/**
 * A screen of the app: a top bar with a back arrow (when [back] is a link), the [title] and [actions], then the
 * content in a column no wider than the app's (640 px).
 */
function layout({ lang, path, page, title, docTitle, back = null, actions = "", body, track = {} }) {
  const t = T[lang];
  const cnp = { lang, page, index: `/data/codes.json?v=${DATA_V}`, data: "/data/", stats: STATS_URL, ga: GA_ID, track, t: clientStrings(lang) };
  return `<!doctype html>
<html lang="${lang}">
<head>
${head(lang, docTitle ?? `${title} · ${t.name}`, t.tagline)}
<link rel="alternate" hreflang="${lang === "fr" ? "en" : "fr"}" href="/${lang === "fr" ? "en" : "fr"}/${path}">
</head>
<body data-page="${page}">
<header class="bar"><div class="bar-in">
${back ? `<a class="icon-btn" href="${back}" data-back aria-label="${esc(t.back)}">${icon("back")}</a>` : ""}<span class="bar-title${back ? "" : " solo"}">${esc(title)}</span>${actions}
</div></header>
<main class="screen">
${body}
</main>
<div class="snackbar" role="status" aria-live="polite"></div>
<script>window.CNP=${JSON.stringify(cnp).replace(/</g, "\\u003c")}</script>
<script src="/js/track.js?v=${ASSET_V.track}" defer></script>
<script src="/js/app.js?v=${ASSET_V.js}" defer></script>
</body>
</html>
`;
}

const restartAction = (lang) => `<a class="icon-btn" href="${href(lang, "")}" aria-label="${esc(T[lang].restart)}">${icon("restart")}</a>`;
const button = (kind, text, link, extra = "") => `<a class="btn ${kind}" href="${link}"${extra}>${esc(text)}</a>`;
const sectionTitle = (text) => `<h2 class="section">${esc(text)}</h2>`;
const bullets = (items, cls = "") => (items.length ? `<ul class="bullets${cls ? " " + cls : ""}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");

/**
 * "Your answers", at the top of the screen: one line per answer already given, numbered (the field of work with its
 * emoji), each one leading back to the question it answered.
 */
function trail(steps, lang) {
  if (!steps.length) return "";
  const t = T[lang];
  return `<nav class="card trail" aria-label="${esc(t.yourAnswers)}"><p class="trail-head">${esc(t.yourAnswers)}</p><ol>${steps
    .map((s, i) => `<li><a href="${href(lang, s.question)}"><span class="num">${i + 1}</span><span class="crumb">${esc([s.icon, s.label[lang]].filter(Boolean).join(" "))}</span><span class="edit" title="${esc(t.changeAnswer)}">${icon("edit")}</span></a></li>`)
    .join("")}</ol></nav>`;
}

/** The jobs under an answer, one per line: a job's examples, or the familiar jobs of a field or level. */
const jobsOf = (o, lang) => (o.style === "job" ? o.hint[lang] : o.hint[lang].replace(/…$/, "").split(", ").map((s) => s.trim()).filter(Boolean)).map(cap);

/** One answer: a big card with plain words, and the longer list of jobs on demand. */
function optionCard(o, lang, n) {
  const t = T[lang];
  const jobs = jobsOf(o, lang);
  const more = o.more[lang].map(cap);
  return `<li class="card option">
<a class="option-link" href="${href(lang, o.target)}" data-answer="${n}">${o.icon ? `<span class="opt-icon" aria-hidden="true">${o.icon}</span>` : ""}<span class="opt-body"><strong>${esc(o.label[lang])}</strong>${o.style === "job" && jobs.length ? `<span class="for-example">${esc(t.forExample)}</span>` : ""}${jobs.length ? `<span class="jobs">${jobs.map((j) => `<span>${esc(j)}</span>`).join("")}</span>` : ""}</span></a>${more.length ? `
<div class="more${o.icon ? " indent" : ""}"><button type="button" class="more-btn" aria-expanded="false" data-more="${esc(t.more)}" data-less="${esc(t.less)}"><span>${esc(t.more)}</span>${icon("expand")}</button><span class="jobs small" hidden>${more.map((j) => `<span>${esc(j)}</span>`).join("")}</span></div>` : ""}
</li>`;
}

function questionPage(q, lang) {
  const t = T[lang];
  const title = { domain: t.qDomain, level: t.qLevel, group: t.qGroup, job: t.qJob }[q.kind];
  const back = q.parent === null ? `/${lang}/` : href(lang, q.parent);
  const pct = Math.round((q.step / q.total) * 100);
  const body = `${trail(q.trail, lang)}
<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${q.total}" aria-valuenow="${q.step}"><i style="width:${pct}%"></i></div>
<h1 class="headline">${esc(title)}</h1>
${q.kind === "level" ? `<p class="help">${esc(t.qLevelHelp)}</p>` : ""}
<ul class="options">
${q.options.map((o, i) => optionCard(o, lang, i + 1)).join("\n")}
</ul>
<details class="card fold"><summary>${esc(t.unsure)}</summary><p>${esc(t.unsureText)}</p></details>
<div class="row">${button("tertiary", t.back, back, " data-back")}${q.parent === null ? "" : button("tertiary", t.restart, href(lang, ""))}</div>`;
  return layout({
    lang,
    path: q.code ? q.code + "/" : "questions/",
    page: "question",
    title: t.step(q.step, q.total),
    docTitle: `${title} · ${t.name}`,
    back,
    actions: q.parent === null ? "" : restartAction(lang),
    body,
    track: { step: q.step, question: q.code || "start" },
  });
}

function resultPage(r, lang) {
  const t = T[lang];
  const { code } = r;
  const exclusions = r.exclusions[lang];
  const body = `${trail(r.trail, lang)}
<section class="card codecard">
<p class="eyebrow">${esc(t.yourCode)}</p>
<p class="code">${esc(code)}</p>
<h1 class="title-l">${esc(r.title[lang])}</h1>
<p class="what">${esc(t.what)}</p>
<p class="teer">${esc(t.teerLine(r.teer, t.teer[r.teer]))}</p>
<div class="small-btns"><button type="button" class="btn small" data-copy="${code}">${esc(t.copy)}</button><button type="button" class="btn small" data-share="${esc(t.shareText(code, r.title[lang]))}">${esc(t.share)}</button><button type="button" class="btn small" data-save="${code}">${esc(t.save)}</button></div>
</section>
${button("secondary wide", t.compare, `/${lang}/search/?compare=${code}`, ' data-cta="compare"')}
${r.definition[lang] ? `<p class="definition">${esc(r.definition[lang])}</p>` : ""}
${r.duties[lang].length ? sectionTitle(t.duties) + bullets(r.duties[lang]) : ""}
${r.examples[lang].length ? `${sectionTitle(t.examples)}<p class="examples">${esc(r.examples[lang].join(" · "))}</p>` : ""}
${exclusions.length ? `${sectionTitle(t.notThis)}<p class="body-m">${esc(t.notThisText)}</p><ul class="notthis">${exclusions
    .map((x) => `<li><a href="${href(lang, x.page)}"><span>${esc(x.text)}</span><small>${esc(x.isResult ? t.seeCode(x.page) : t.seeGroup)}</small></a></li>`)
    .join("")}</ul>` : ""}
${r.requirements[lang].length ? `<details class="card fold"><summary>${esc(t.requirements)}</summary>${bullets(r.requirements[lang])}</details>` : ""}
<div class="row">${button("tertiary", t.back, href(lang, r.parent), " data-back")}${button("secondary", t.restart, href(lang, ""))}</div>`;
  return layout({
    lang,
    path: code + "/",
    page: "result",
    title: t.name,
    docTitle: `${code} ${r.title[lang]} · ${t.name}`,
    back: href(lang, r.parent),
    actions: restartAction(lang),
    body,
    track: { result: code, teer: Number(r.teer) },
  });
}

/** The first screen: what the code is, and the way in. */
function homePage(lang) {
  const t = T[lang];
  const body = `<section class="home">
<p class="hero-icon" aria-hidden="true">🧭</p>
<h1 class="headline-m">${esc(t.homeTitle)}</h1>
<p class="body-l">${esc(t.homeIntro)}</p>
${button("hero", t.homeStart, href(lang, ""))}
${button("secondary wide", t.homeSearch, `/${lang}/search/`)}
${button("secondary wide", t.homeSaved, `/${lang}/saved/`)}
<p class="disclaimer">${esc(t.homeDisclaimer)} <a href="${t.privacyUrl}">${esc(t.privacy)}</a></p>
</section>`;
  return layout({
    lang,
    path: "",
    page: "home",
    title: t.name,
    docTitle: t.name,
    actions: `<a class="icon-btn" href="/${lang}/settings/" aria-label="${esc(t.homeSettings)}">${icon("settings")}</a>`,
    body,
  });
}

/** Looks up a code by its digits; with ?compare=<code>, picks the second code of a comparison. */
function searchPage(lang) {
  const t = T[lang];
  const body = `<p class="title-m compare-with" hidden></p>
<label class="field"><span>${esc(t.searchField)}</span><input id="query" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="off" autofocus></label>
<p class="hint">${esc(t.searchHint)}</p>
<div id="codes"></div>`;
  return layout({ lang, path: "search/", page: "search", title: t.searchTitle, back: `/${lang}/`, body });
}

/** Two codes side by side, drawn by the script from /data/<code>.json. */
function comparePage(lang) {
  const t = T[lang];
  const body = `<div id="compare"><p class="body-m">${esc(t.loading)}</p></div>`;
  return layout({
    lang,
    path: "compare/",
    page: "compare",
    title: t.compareTitle,
    back: `/${lang}/`,
    actions: `<button type="button" class="icon-btn" id="swap" aria-label="${esc(t.compareSwap)}" hidden>${icon("swap")}</button>`,
    body,
  });
}

function savedPage(lang) {
  const t = T[lang];
  const body = `<p class="body-l empty" hidden>${esc(t.savedEmpty)}</p>
<div id="saved" class="codes"></div>
<template id="remove-icon">${icon("delete")}</template>`;
  return layout({ lang, path: "saved/", page: "saved", title: t.savedTitle, back: `/${lang}/`, body });
}

function settingsPage(lang) {
  const t = T[lang];
  const radios = ["system", "en", "fr"]
    .map((v) => `<label class="radio"><input type="radio" name="lang" value="${v}"><span>${esc(t.languages[v])}</span></label>`)
    .join("");
  const body = `${sectionTitle(t.settingsLanguage)}
<div class="card group">${radios}</div>
${sectionTitle(t.settingsAbout)}
<div class="card group about"><p class="body-m">${esc(t.settingsDisclaimer)}</p><p class="small muted">${esc(t.settingsSource)}</p><p class="small muted">${esc(t.settingsPrivacy)} <a href="${t.privacyUrl}">${esc(t.privacy)}</a></p></div>`;
  return layout({ lang, path: "settings/", page: "settings", title: t.settingsTitle, back: `/${lang}/`, body });
}

/** The root: the visitor's language (saved in Settings, or the browser's), a chooser without JavaScript. */
function rootPage() {
  const blocks = LANGS.map((lang) => {
    const t = T[lang];
    return `<section class="card welcome" lang="${lang}"><h2 class="title-l">${esc(t.homeTitle)}</h2><p class="body-m">${esc(t.homeIntro)}</p>${button("primary", t.homeStart, `/${lang}/`)}</section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<script>(function(){var p;try{p=JSON.parse(localStorage.getItem("cnp.lang"))}catch(e){}var b=(navigator.languages||[navigator.language||""]).map(function(l){return String(l).slice(0,2).toLowerCase()}).filter(function(l){return l==="fr"||l==="en"})[0];location.replace("/"+(p||b||"fr")+"/")})()</script>
${head("fr", "Trouver mon code CNP · Find my NOC code", `${T.fr.tagline} ${T.en.tagline}`)}
</head>
<body data-page="root">
<main class="screen root">
<p class="hero-icon" aria-hidden="true">🧭</p>
${blocks}
</main>
</body>
</html>
`;
}

function write(path, text) {
  const url = new URL(path, out);
  mkdirSync(new URL("./", url), { recursive: true });
  writeFileSync(url, text);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL("css/", root), new URL("css/", out), { recursive: true });
cpSync(new URL("js/", root), new URL("js/", out), { recursive: true });
write("robots.txt", NOINDEX ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n");
write("index.html", rootPage());
write("data/codes.json", index);
for (const r of results) {
  const { code, teer, title, definition, duties, examples, requirements } = r;
  write(`data/${code}.json`, JSON.stringify({ code, teer, title, definition, duties, examples, requirements }));
}
const counts = {};
for (const lang of LANGS) {
  const pages = { "": homePage, "search/": searchPage, "compare/": comparePage, "saved/": savedPage, "settings/": settingsPage };
  for (const [path, page] of Object.entries(pages)) write(`${lang}/${path}index.html`, page(lang));
  counts[lang] = Object.keys(pages).length;
  for (const q of questions) { write(`${lang}/${q.code ? q.code : "questions"}/index.html`, questionPage(q, lang)); counts[lang]++; }
  for (const r of results) { write(`${lang}/${r.code}/index.html`, resultPage(r, lang)); counts[lang]++; }
}
console.log(`site/: ${questions.length} questions + ${results.length} results + 5 screens per language`, counts);

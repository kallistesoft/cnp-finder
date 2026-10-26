// What every question and result shows, in both languages, independent of
// how it's displayed. The website (build.mjs) renders it as HTML and the
// Android app gets it as JSON (export-app.mjs), so both always agree.
import { loadTree, optionLabel, shortExamples, parseExclusion, LANGS } from "./tree.mjs";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const both = (f) => Object.fromEntries(LANGS.map((lang) => [lang, f(lang)]));

export function buildContent() {
  const tree = loadTree();
  const { questions, results, labels, isLeaf, nodes } = tree;

  const plainLabel = (child, lang) => optionLabel(child, labels, lang) ?? child.title[lang];
  /** Breadcrumbs use the short form of the education level. */
  const shortLabel = (child, lang) =>
    child.code.length === 2 ? labels.teer[child.code[1]][`short_${lang}`] : plainLabel(child, lang);

  /** The official names of the jobs a group holds. */
  const leafTitles = (node, lang) => {
    const titles = [];
    const collect = (x) => (x.children.length ? x.children.forEach(collect) : titles.push(x.title[lang]));
    collect(node);
    return titles;
  };

  /** The page a code leads to: its result, or the question it settles on. */
  const pageOf = (code) => {
    if (results.has(code)) return code;
    let n = nodes.get(code);
    if (!n) return null;
    while (n.children.length === 1) n = n.children[0];
    return questions.has(n.code) || results.has(n.code) ? n.code : null;
  };

  /** domain (first question), level (education level), job (last question) or group. */
  const kindOf = (q) => {
    if (q.node.code === "") return "domain";
    if (q.options.every((o) => isLeaf(o.target))) return "job";
    if (q.options.every((o) => o.child.code.length === 2)) return "level";
    return "group";
  };

  /** The answers that led to a question, each pointing back to the question it answered. */
  const trail = (code) => {
    const steps = [];
    for (let c = code; c !== null; c = questions.get(c).parent) {
      const q = questions.get(c);
      if (q.via) {
        // The field of work keeps its emoji, so the first answer is recognized at a glance.
        const icon = q.via.code.length === 1 ? labels.domains[q.via.code]?.icon ?? null : null;
        steps.unshift({ question: q.parent, label: both((lang) => shortLabel(q.via, lang)), icon });
      }
    }
    return steps;
  };

  const option = (o) => {
    const target = o.target;
    const base = { target: target.code, isResult: isLeaf(target) };
    // Education level: the same kind of sentence for every option of the
    // question, even when it leads straight to a code.
    if (o.child.code.length === 2) {
      return {
        ...base,
        style: "level",
        label: both((lang) => plainLabel(o.child, lang)),
        hint: both((lang) => cap(labels.majors[o.child.code][lang]) + "…"),
        more: both((lang) => { const m = leafTitles(target, lang); return m.length > 1 ? m : []; }),
      };
    }
    if (isLeaf(target)) {
      return {
        ...base,
        style: "job",
        label: both((lang) => target.title[lang]),
        hint: both((lang) => {
          // Examples that only repeat the title (« cuisinier » under Cooks) add nothing.
          const title = target.title[lang].toLowerCase();
          return shortExamples(target, lang, 40).filter((e) => !title.startsWith(e.toLowerCase().split(/[/ ]/)[0])).slice(0, 3);
        }),
        more: both((lang) => {
          const all = shortExamples(target, lang, 40);
          const title = target.title[lang].toLowerCase();
          const shown = all.filter((e) => !title.startsWith(e.toLowerCase().split(/[/ ]/)[0])).slice(0, 3);
          return all.length > shown.length ? all : [];
        }),
      };
    }
    const domain = o.child.code.length === 1 ? labels.domains[o.child.code] : null;
    if (domain) {
      return {
        ...base,
        style: "domain",
        icon: domain.icon,
        label: both((lang) => plainLabel(o.child, lang)),
        hint: both((lang) => cap(domain[`hint_${lang}`]) + "…"),
        more: both(() => []),
      };
    }
    // A group: its plain label already names familiar jobs.
    return {
      ...base,
      style: "group",
      label: both((lang) => plainLabel(o.child, lang)),
      hint: both(() => ""),
      more: both((lang) => leafTitles(target, lang)),
    };
  };

  const questionViews = [...questions].map(([code, q]) => ({
    code,
    parent: q.parent,
    step: q.step,
    total: q.total,
    kind: kindOf(q),
    trail: trail(code),
    options: q.options.map(option),
  }));

  const resultViews = [...results].map(([code, r]) => {
    const n = r.node;
    const el = (lang) => n.elements[lang] ?? { examples: [], duties: [], requirements: [], exclusions: [] };
    const exclusions = (lang) => {
      const seen = new Set();
      return el(lang).exclusions
        .map(parseExclusion)
        .map((x) => ({ text: x.text, page: x.code ? pageOf(x.code) : null }))
        .filter((x) => x.page && x.page !== code)
        .filter((x) => (seen.has(x.text) ? false : seen.add(x.text)))
        .map((x) => ({ ...x, isResult: results.has(x.page) }));
    };
    return {
      code,
      parent: r.parent,
      teer: code[1],
      title: both((lang) => n.title[lang]),
      definition: both((lang) => n.definition[lang] ?? ""),
      // The first duty line only announces the list (« Ce groupe exerce… »).
      duties: both((lang) => el(lang).duties.filter((d) => !/:\s*$/.test(d)).slice(0, 5).map((d) => cap(d.replace(/[;.]\s*$/, "")))),
      examples: both((lang) => el(lang).examples),
      requirements: both((lang) => el(lang).requirements),
      exclusions: both(exclusions),
      trail: [
        ...trail(r.parent),
        { question: r.parent, label: both((lang) => (shortExamples(n, lang, 1)[0] ? cap(shortExamples(n, lang, 1)[0]) : n.title[lang])), icon: null },
      ],
    };
  });

  return { tree, questions: questionViews, results: resultViews };
}

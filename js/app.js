// What the app does on its screens that static pages can't: back like the app's back stack, the examples toggle,
// copy / share / save a code, and the screens drawn from /data (look up a code, compare, my codes, settings).
// Questions and results work without it.
(() => {
  const { lang, page, t } = window.CNP;
  const $ = (sel, el = document) => el.querySelector(sel);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const codeHref = (code) => `/${lang}/${code}/`;

  // Browser storage can be off (private windows, blocked site data): the pages still work, nothing is kept.
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {}
    },
  };
  /** "My codes", newest first: [{ code, savedAt }]. */
  const saved = {
    list: () => store.get("cnp.saved", []).filter((s) => s && /^\d{5}$/.test(s.code)),
    has: (code) => saved.list().some((s) => s.code === code),
    add: (code) => store.set("cnp.saved", [{ code, savedAt: Date.now() }, ...saved.list().filter((s) => s.code !== code)]),
    remove: (code) => store.set("cnp.saved", saved.list().filter((s) => s.code !== code)),
  };

  let snackTimer;
  function snack(text) {
    const bar = $(".snackbar");
    bar.textContent = text;
    bar.classList.add("on");
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => bar.classList.remove("on"), 2500);
  }

  const copy = (text) => (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => snack(t.copied), () => {});

  // Back goes where the visitor came from on this site, like the app's back stack; otherwise to the parent screen.
  const cameFromHere = () => {
    try { return document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1; } catch { return false; }
  };

  document.addEventListener("click", (e) => {
    const back = e.target.closest("[data-back]");
    if (back && cameFromHere()) {
      e.preventDefault();
      history.back();
      return;
    }
    const more = e.target.closest("[data-more]");
    if (more) {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", String(open));
      more.firstElementChild.textContent = open ? more.dataset.less : more.dataset.more;
      more.nextElementSibling.hidden = !open;
      return;
    }
    const c = e.target.closest("[data-copy]");
    if (c) return void copy(c.dataset.copy);
    const s = e.target.closest("[data-share]");
    if (s) {
      if (navigator.share) navigator.share({ text: s.dataset.share }).catch(() => {});
      else copy(s.dataset.share);
      return;
    }
    const v = e.target.closest("[data-save]");
    if (v) {
      const code = v.dataset.save;
      saved.has(code) ? saved.remove(code) : saved.add(code);
      showSaved(v);
      return;
    }
    // The code picker gives way to the comparison, as in the app: Back from the comparison skips it.
    const r = e.target.closest("[data-replace]");
    if (r) {
      e.preventDefault();
      location.replace(r.href);
    }
  });

  const showSaved = (btn) => { btn.textContent = saved.has(btn.dataset.save) ? t.saved : t.save; };
  const params = new URLSearchParams(location.search);
  let indexPromise;
  /** Every code's title and neighbours, by code. */
  const index = () => (indexPromise ??= fetch(window.CNP.index).then((r) => r.json()).then((list) => new Map(list.map((x) => [x.c, x]))));

  /** A card for a code: the code in mono, its title; [replace] when it stands for the current screen. */
  function pick(entry, link, replace = false) {
    const a = el("a", "card pick");
    a.href = link;
    if (replace) a.dataset.replace = "";
    a.append(el("span", "mono", entry.c), el("span", "title-m", entry.t[lang]));
    return a;
  }

  async function searchScreen() {
    const compareWith = /^\d{5}$/.test(params.get("compare") ?? "") ? params.get("compare") : null;
    const codes = await index();
    const base = compareWith && codes.get(compareWith);
    const input = $("#query");
    const list = $("#codes");
    if (base) {
      $(".bar-title").textContent = t.searchCompareTitle;
      document.title = `${t.searchCompareTitle} · ${t.name}`;
      const head = $(".compare-with");
      head.textContent = base.t[lang];
      head.hidden = false;
    }
    const linkFor = (code) => (base ? `/${lang}/compare/?a=${compareWith}&b=${code}` : codeHref(code));
    const others = (list) => list.filter((c) => c && c.c !== compareWith);
    const section = (title, entries) => {
      if (!entries.length) return;
      list.append(el("h2", "section", title));
      const box = el("div", "codes");
      for (const c of entries) box.append(pick(c, linkFor(c.c), !!base));
      list.append(box);
    };
    const draw = () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 5);
      if (input.value !== digits) input.value = digits;
      list.replaceChildren();
      if (digits) {
        const matches = others([...codes.values()].filter((c) => c.c.startsWith(digits)));
        if (!matches.length) list.append(el("p", "body-m", t.searchNone));
        const box = el("div", "codes");
        for (const c of matches) box.append(pick(c, linkFor(c.c), !!base));
        list.append(box);
      } else if (base) {
        section(t.searchNeighbours, others(base.n.map((c) => codes.get(c))));
        section(t.searchSaved, others(saved.list().map((s) => codes.get(s.code))));
      }
    };
    input.addEventListener("input", draw);
    draw();
  }

  async function savedScreen() {
    const codes = await index();
    const box = $("#saved");
    const draw = () => {
      const entries = saved.list().map((s) => codes.get(s.code)).filter(Boolean);
      $(".empty").hidden = entries.length > 0;
      box.replaceChildren(...entries.map((c) => {
        const row = el("div", "card saved-item");
        const a = el("a");
        a.href = codeHref(c.c);
        a.append(el("span", "mono", c.c), el("span", "title-m", c.t[lang]));
        const remove = el("button", "icon-btn");
        remove.type = "button";
        remove.setAttribute("aria-label", t.savedRemove.replace("{title}", c.t[lang]));
        remove.append($("#remove-icon").content.cloneNode(true));
        remove.addEventListener("click", () => { saved.remove(c.c); draw(); });
        row.append(a, remove);
        return row;
      }));
    };
    draw();
  }

  async function compareScreen() {
    const [a, b] = [params.get("a"), params.get("b")];
    const root = $("#compare");
    const load = (code) => (/^\d{5}$/.test(code ?? "") ? fetch(`${window.CNP.data}${code}.json`).then((r) => (r.ok ? r.json() : null), () => null) : null);
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (!x || !y) {
      const back = el("a", "btn secondary wide", t.back);
      back.href = `/${lang}/`;
      back.dataset.back = "";
      root.replaceChildren(back);
      return;
    }
    const swap = $("#swap");
    swap.hidden = false;
    swap.addEventListener("click", () => location.replace(`/${lang}/compare/?a=${b}&b=${a}`));
    const sameTeer = x.teer === y.teer;
    const cols = (draw) => {
      const row = el("div", "cols");
      for (const code of [x, y]) { const col = el("div"); col.append(draw(code)); row.append(col); }
      return row;
    };
    const parts = [];
    parts.push(cols((c) => {
      const card = el("a", "card side");
      card.href = codeHref(c.code);
      // Narrow columns: "Cuisiniers/cuisinières" may wrap after its slash.
      card.append(el("span", "title-l", c.code), el("strong", null, c.title[lang].replace(/\//g, "/\u200b")));
      return card;
    }));
    parts.push(el("span", "chip", sameTeer ? t.compareSameTeer : t.compareDifferentTeer));
    parts.push(cols((c) => el("p", `small${sameTeer ? "" : " diff"}`, t.teer[c.teer])));
    const section = (title, items) => {
      if (!items(x).length && !items(y).length) return;
      parts.push(el("h2", "section", title));
      parts.push(cols((c) => {
        if (!items(c).length) return el("span", "mono dash", "—");
        const ul = el("ul", "bullets");
        for (const item of items(c)) ul.append(el("li", null, item));
        return ul;
      }));
    };
    section(t.compareDefinition, (c) => [c.definition[lang]].filter((s) => s.trim()));
    section(t.duties, (c) => c.duties[lang]);
    section(t.examples, (c) => c.examples[lang].slice(0, 8));
    section(t.requirements, (c) => c.requirements[lang]);
    const nav = el("div", "row");
    const back = el("a", "btn tertiary", t.back);
    back.href = codeHref(a);
    back.dataset.back = "";
    const change = el("a", "btn secondary", t.compareChange);
    change.href = `/${lang}/search/?compare=${a}`;
    change.dataset.replace = "";
    nav.append(back, change);
    parts.push(nav);
    root.replaceChildren(...parts);
  }

  /** The language: the browser's ("system"), English or French; choosing one opens Settings in it. */
  function settingsScreen() {
    const browser = (navigator.languages || [navigator.language || ""]).map((l) => String(l).slice(0, 2).toLowerCase()).find((l) => l === "fr" || l === "en") ?? "fr";
    const chosen = store.get("cnp.lang", null);
    for (const radio of document.querySelectorAll('input[name="lang"]')) {
      radio.checked = radio.value === (chosen ?? "system");
      radio.addEventListener("change", () => {
        const value = radio.value === "system" ? null : radio.value;
        store.set("cnp.lang", value);
        const target = value ?? browser;
        if (target !== lang) location.replace(`/${target}/settings/`);
      });
    }
  }

  if (page === "result") document.querySelectorAll("[data-save]").forEach(showSaved);
  if (page === "search") searchScreen();
  if (page === "saved") savedScreen();
  if (page === "compare") compareScreen();
  if (page === "settings") settingsScreen();
})();

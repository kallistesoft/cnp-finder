# Trouver mon code CNP · Find my NOC code

A public page (FR + EN) where a client finds their CNP / NOC 2021 code by
clicking predefined answers: no typing, at most 5 questions, and every path
ends on one of the 516 official codes.

Live: https://cnp.kallistesoft.ca (noindex for now: `NOINDEX` in `tools/build.mjs`).

## How it works

- `data/`: StatCan's NOC 2021 V1.0 files, as downloaded (see `data/SOURCE.md`),
  and `labels.json`, the plain-language wording clients see instead of the
  official group names.
- `tools/tree.mjs` builds the decision tree from the official hierarchy (a code's
  parent is the code minus its last digit). Groups with a single subgroup are
  skipped, so every question offers a real choice.
- The questions are: field of work → what the job requires (education level, the
  FEER/TEER) → one or two narrower groups → the job itself.
- `tools/build.mjs` writes the same screens as the Android app
  ([kallistesoft/cnp-android](https://github.com/kallistesoft/cnp-android)), in its
  "Nocturne" look, into `site/`: home `/fr/`, the first question `/fr/questions/`,
  one static page per question and per code `/fr/<code>/`, and the screens the
  browser draws from `site/data/` (look up a code `/fr/search/`, compare two codes
  `/fr/compare/?a=…&b=…`, my codes `/fr/saved/`, settings `/fr/settings/`). Same
  paths in English under `/en/`; `/` sends visitors to their language.
- `js/app.js` adds what static pages can't: back like the app, the examples
  toggle, copy / share / save a code, and those four screens. Saved codes and the
  chosen language stay in the browser (`localStorage`). Unlike the app, every code
  is free on the website.
- `js/track.js` sends anonymous events (`STATS_URL` in `tools/build.mjs`, by
  `navigator.sendBeacon`): `step_view`, `step_answer`, `step_back`, `result_view`
  (with `via`: questions, notthis, search, saved, compare or direct), `cta_click`,
  `search_lookup` (found or not, never the digits), `compare_view`, `lang_switch`.
  No cookie, no ID, nothing stored. Google Analytics stays off while `GA_ID` is
  empty; when set, it starts with every consent denied.
- `tools/check.mjs` fails if a code is unreachable or reachable twice, a question
  has fewer than 2 choices, a path has more than 5 questions, a plain label is
  missing, a link is dead or StatCan jargon shows up on a question page.

## Run locally

```sh
node tools/build.mjs && node tools/check.mjs
python3 -m http.server 8790 -d site   # http://localhost:8790
```

No dependencies. Node 18+.

## Deploy

Every push to `main` builds, checks and uploads `site/` to GoDaddy
(`public_html/cnp.kallistesoft.ca`) through the shared FTPS workflow in
`kallistesoft/kallistesoft-site`. `site/` is not committed.

## Updating the data

When StatCan publishes a new NOC version, replace the four CSVs, then run the
check: it lists every group that needs a plain label in `data/labels.json`.

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
- `tools/build.mjs` writes one static page per question and per code into `site/`:
  `/fr/<code>/` and `/en/<code>/`, same codes in both languages.
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

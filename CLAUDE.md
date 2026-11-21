# CNP finder (`kallistesoft/cnp-finder`)

Public FR/EN page where a client finds their CNP / NOC 2021 code by clicking predefined answers (no typing, at most
5 questions, every path ends on one of the 516 codes). Live at https://cnp.kallistesoft.ca (noindex flag in
`tools/build.mjs`). The site mirrors the Android app `kallistesoft/cnp-android` (Nocturne look).

## Stack, build, check, deploy
- Plain Node 18+, no dependencies. `tools/build.mjs` writes `site/` (generated, not committed); `js/app.js` draws
  search, compare, saved and settings from `site/data/`. `tools/content.mjs` is shared with the app export.
- Check: `tools/check.sh` (= `node tools/build.mjs && node tools/check.mjs`). The global pre-push hook runs it,
  and CI runs the same build + check on every PR.
- Preview: `python3 -m http.server 8790 -d site`.
- Deploy: every push to `main` uploads `site/` to GoDaddy through the shared FTPS workflow. PRs only build and check.

## Rules (owner)
- Must be easy to understand: StatCan jargon never shown while choosing; plain labels live in `data/labels.json`.
- Result page = official details + « Pas ça ? » exclusion links. Codes stay FREE on the website (no paywall).
- When the app's UI changes, port it here too (`node tools/export-app.mjs` exports the content for the app).
- Ads are allowed (AdSense plan `~/.claude/plans/i-want-to-add-valiant-crab.md`): a rewarded gate only on codes
  reached through the questions. Never click our own ads. Analytics events are anonymous (`js/track.js`).

## Branches and PRs
- Feature branch → push → PR against `main` (never stacked). The owner merges; never `gh pr merge`, never `--admin`.

## Autonomy, to-dos, decisions
- Fixes and ports from the app on a branch freely; ask before new features or ad placements.
- To-dos: the AdSense plan file above. Non-blocking choices: `DECISIONS.md`, with the default taken.

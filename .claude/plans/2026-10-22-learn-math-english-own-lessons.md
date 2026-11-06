> Status: ⏳ Pending — NOT started (checked 2026-11-06: no `learn/` folder, last commit 145fc5f 2026-09-14). Needed: Akara's answers to the 3 questions below, then his "go"; then the steps as written. Filed from the global draft `can-you-please-help-polished-journal.md`.
> Was (until 2026-11-06): ⏳ Pending — draft. Waiting for Akara's answers to the 3 questions, then his "go".

# Learn math and English with our own lessons and self-checks (`learn/` in the roadmap repo)

## Context

**Akara asked (2026-10-22):** "from that roadmap for me really hard to [know] from what i should begin … the smart time
calculations was mistake i cannot understand math and english where to learn how that and when i learn how to check
myself maybe we need to create own math explanations and homeworks?"

**The roadmap:** <https://songhee24.github.io/ai-solutions-engineer-roadmap/> (planner: `/planner/`), code in
`~/Projects/personal/ai-solutions-engineer-roadmap`. 15 sections, 107 topics, 1,612 h. `main` = `145fc5f` (14.09).
No commits after 14.09.

**What the records say:**
- 04.09: day 1, Khan "Fractions" in English, 4 hours, stuck halfway through the unit (plan `2026-09-05-honest-pace.md`).
- 05.09: the day was cut to 2 h. At that pace math gets about 18 minutes a day, and the finish date today is
  16.11.2028 (15.11 before the 14.09 round added one day).
- 14.09: a Russian course (spacemath.xyz) was added, because Russian Khan "Fractions" has 0 of 14 exercises in Russian.
- 11.09: decision — lessons of the `teach` skill live in `learn/` in this repo, all public. The folder was never created.

**Honest read.** Six rounds in early September (12, 13, 14, 18, 19, 20) went into the planner: days, hours, finish
date. The "How to study" page explains the method, but nothing checks an answer. The real block is two hard things at
once: math from zero, and explanations in English. A finish date does not fix that.

**The idea.** Our own short lessons and homework, made for Akara's level, with answers checked by code. Progress is
"I can solve it alone", not hours.

## Finish line (done means)

1. `learn/` exists with the placement test live on the site and working offline (double-click the file).
2. Akara took the test; the result is in `learn/learning-records/0001-placement-result.md`.
3. The first two lessons at his start point are live, each with instant check and an exit check.
4. `node --test "test/**/*.test.mjs"` and `npm --prefix planner-src test` are green; the live check list below passed.
5. If question 2 = yes: the first weekly English page exists on the Mac (not published).
6. Docs, memory and `claude-sync` done ("Pushed and verified").

## The approach

**Where to begin — a placement test (about 20 min, paper first, no calculator).** 8 blocks of 4 problems, in the
roadmap's order. The test stops at the first block with 2 or fewer right; that block is the start.

| Block | Example | Roadmap topic if this block is weak |
|---|---|---|
| 1 Whole numbers | 7 × 8, 23 × 14, 156 ÷ 12, 2 + 3 × 4 | before A1.1 (Arithmetic units 1–3, 5–8, 14, per the A1.1 `courseNote`) |
| 2 What a fraction is | 3/4 or 2/3 — which is bigger? 2/3 = ?/12 | A1.1 (Unit 4) |
| 3 Fraction operations | 1/2 + 1/3, 2/3 × 3/5, 1/2 ÷ 1/4 | A1.1 (Units 9, 13, 10, 15) |
| 4 Decimals | 0,3 + 0,45 | A1.2 |
| 5 Negative numbers | −3 + 5, (−2) × (−3) | A1.3 |
| 6 Percents, ratios | 18% of 450, 2 : 3 = 8 : ? | A1.4 |
| 7 Powers, roots | 2³, √49 | A1.5 |
| 8 Equations | 3x + 7 = 22, 2(x − 1) = 8 | A2.1 |

"Не знаю" is a button: an honest "I don't know" finds the start better than a guess. At the end the page shows one
summary line; Akara pastes it to Claude.

**Lessons — one small lesson at a time (20–30 min).** Each lesson teaches one skill:
1. Warm-up: 3 problems from older lessons, picked from his recorded mistakes (none in lesson 1).
2. The idea: one picture and a few short sentences; every new term with its English word.
3. A solved example, step by step. Then a half-solved one he finishes.
4. Practice on paper first, then type the answer: checked at once. A typical mistake gets its own hint
   ("you added the denominators"). "Ещё 5 задач" gives fresh numbers.
5. Exit check: 5 new problems, no hints. **4 of 5 = passed.** Not passed = practice again tomorrow, no shame.
6. Explain it in 2–3 sentences to Claude (Russian or English; in English Claude also marks the five typical errors).
7. One verified source for more (spacemath step, Khan unit).

**How he checks himself — four checks, none of them is hours:**
every answer at once · exit check per lesson · warm-up from old lessons (did it stay?) · once a month the placement
test again (did the start point move?).

**English.** Track B on the map stays as it is (20 minutes a day). New, if question 2 = yes: once a week Claude takes
10 of his own sentences from last week's prompts and makes a "fix it" page with answers. This is task B3 from the map
("10 of your old messages … the only exercise that really sticks"), made easy.

**The session loop.** He finishes a lesson → pastes the summary line → Claude writes a learning record, marks ✓ in
`learn/index.html`, builds the next 1–2 lessons. Later he can start this himself: open Claude **inside `learn/`** and
type `/mattpocock-skills:teach next lesson` (inside `learn/`, because the repo root is the live map).

## What gets built

The workspace follows the `teach` skill format
(`~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/productivity/teach/`), so later
`/teach` sessions continue from it.

```
learn/
  index.html                 start page: "start here", lessons with ✓ (Claude updates it; no localStorage)
  README.md                  what learn/ is; open Claude inside learn/; english/ is local only
  MISSION.md                 draft below — Akara confirms
  NOTES.md                   Russian + EN terms (per Q1), paper first, no calculator, no dates
  RESOURCES.md               only sources opened in a real browser, with the date; gaps listed
  GLOSSARY.md                a term enters after its exit check is passed (teach rule)
  assets/learn.css           lesson layout on top of ../../styles.css tokens (dark mode comes from styles.css)
  assets/grading.js          pure: read an answer, compare exactly, score a block / exit check, find the start
  assets/practice.js         page widget: input + "Проверить" + hint + "Не знаю" + exit mode + summary line
  lessons/0001-placement-test.html + .js   (the .js holds the problems as data)
  lessons/0002-…, 0003-…     after the test
  learning-records/0001-placement-result.md
  english/                   git-ignored, local only (Q2)
test/learn-grading.test.mjs  node --test, no dependencies
```

**Reuse.** Pages link the map's `styles.css` like `docs/plan.html` does. Scripts are classic scripts in the `app.js`
style, so pages open by double-click (ES modules fail on `file://`). Tests load them with the house loader from
`test/roadmap-data.test.mjs` (`new Function("window", source)`). CI already runs `test/**/*.test.mjs` before deploy,
and Pages publishes the repo root, so `learn/` goes live with no workflow change.

**Details that matter:**
- Answers: `5`, `-5`, `−5` (Unicode minus), `3/4`, `0.75`, `0,75` (Russian comma) are read; compared as exact
  fractions (so 0,1 + 0,2 = 0,3 is right). "Simplify" tasks also need the simplest form: `6/8` → "верно, но можно
  сократить".
- Inputs: `inputmode="text"` (the phone keypad needs "/" and "−"), no autocorrect, 16px font, Enter = check;
  every input has a label; feedback in an `aria-live` region.
- Placement answers are typed in the data file and pinned twice: the test restates each problem's arithmetic
  independently (double entry), and the reviewer checks every answer by hand.
- Lesson practice: a small generator per skill (random numbers, answer computed by `grading.js`). Its test: 1,000
  seeded runs, each answer re-checked by an independent formula, no zero denominators, numbers in the promised range.

**MISSION.md draft (from Akara's words and the roadmap):**
- Why: become a real engineer, not only a vibecoder — understand what code and models do, and check it myself.
- Success: solve the roadmap's own check on paper, alone (3x + 7 = 22, 18% of 450, slope of a line); explain each
  topic in my own words; long term, track A's "ready" list (derivative, gradient, vector, matrix, standard deviation,
  p-value; gradient descent in pure Python). English: fewer of my five typical errors each month.
- Constraints: loadex comes first, study time changes daily → no dates, no hour targets. Math from zero; English B1
  (British Council, 03.09.2026). Paper first, no calculator for arithmetic and algebra.
- Out of scope now: Python and other stages, the 127-hour Russian-source gap (A2.2 and later), the planner's time math.

## Steps (skills loaded at each step before its first tool call)

1. **Workspace docs** — `learn/` files above, `.gitignore` line for `learn/english/`.
   Skills: `mattpocock-skills:writing-for-agents` (NOTES/README are read by agents).
2. **`grading.js`, tests first** — RED, then GREEN. Skills: the core six (`js-mechanics`, `coding-standards`,
   `mattpocock-skills:codebase-design`, `mattpocock-skills:tdd`, `ai-regression-testing`, `verification-loop`) +
   `caveman:lean-build`.
3. **Placement test, `practice.js`, `learn.css`, `index.html`.** Skills: `modern-web-guidance`, `accessibility`,
   `design-system`.
4. **Sources** — open each one in the debug Chrome (:9222) and date it. Candidates: spacemath.xyz and the Khan units
   already on the map; РЭШ (resh.edu.ru) and Фоксфорд Учебник — **NOT CONFIRMED, not opened yet**. Khan only through a
   real browser (memory `khan-academy-link-verification`).
5. **Review + live check.** One separate reviewer agent reads the code, the Russian text and every answer (author ≠
   reviewer; Fable is out until Fri 23.10 22:00 and its first job then is the 5.0.31 review, so an Opus agent).
   Then the live check list below in the debug Chrome.
6. **Commit and push to `main`** — this publishes the site. Approval of this plan covers this push.
7. ⏸ **Akara takes the placement test** and pastes the summary line.
8. **Learning record 0001 + the first two lessons** at his start point (generators + their tests), `index.html` ✓.
   Same review, live check and push as steps 5–6.
9. **English page** (if Q2 = yes) — read the last 7 days of his prompts on this Mac (`~/.claude/projects/**/*.jsonl`),
   10 sentences with the five error types, `learn/english/<week>.html` (git-ignored), open it locally.
10. **Close** — project `CLAUDE.md`: one line for `learn/` (owed since 11.09); overview plan
    `ai-solutions-engineer-roadmap.md`: row 23; this plan copied to
    `.claude/plans/2026-10-22-learn-own-lessons.md` with its status; memory `roadmap-site-ai-solutions-engineer`
    updated; `claude-sync` → "Pushed and verified".

## Not in this plan

- No change to the planner or the map (`index.html`, `app.js`, `roadmap-data.js`, `styles.css`), unless Q3 asks for it.
- No npm in the root, no build for `learn/`, no accounts, no server, no localStorage.
- No pre-built course: lessons come 1–2 at a time, from his results.
- No Python or other stages; no closing the 127-hour Russian-source gap now.

## Verification

- `node --test "test/**/*.test.mjs"` green (the existing tests + `learn-grading`); `npm --prefix planner-src test`
  green and unchanged; `scripts/check-site.mjs` clean (the map is untouched).
- Live, debug Chrome only: a right answer; a wrong answer with its hint; "Не знаю"; `0,75` and `−5` accepted; `6/8`
  on a simplify task; the stop rule ends the test at the right block; the summary line is complete; dark theme;
  375 px width with no sideways scroll; the page opened from disk (`file://`) works.
- Every reviewer finding is checked against the code before it reaches Akara.

## Open questions (for Akara)

1. Lesson language: Russian + English terms (recommended) / simple English / both side by side?
2. Weekly English page from his own prompts: local only (recommended) / neutral rewrites, public / not now?
3. The planner's time math: keep it and ignore it (recommended) / hide dates in the planner / remove the planner
   from the menus?

## Sources read for this plan

Memory: `roadmap-site-hub`, `roadmap-site-ai-solutions-engineer`, `roadmap-site-planner`,
`roadmap-site-session-record-0902`, `roadmap-site-khan-ru-and-english-level`, `khan-academy-link-verification`,
`user-akara-english-level`, `feedback-wait-for-go`, `feedback-fable-out-use-codex-2026-10`. Repo: `CLAUDE.md`,
`.claude/plans/ai-solutions-engineer-roadmap.md`, `2026-09-05-honest-pace.md`, `2026-09-14-spacemath-russian-math.md`,
`roadmap-data.js` (track A, track B, diagnostics, study method), `test/roadmap-data.test.mjs`, `docs/plan.html`,
`.github/workflows/deploy-pages.yml`. History: `~/claude-backup/history/2026-09-11-to-28/repos/ai-solutions-engineer-roadmap/README.md`.
Brain `personal-ai-solutions-engineer-roadmap`: not asked live (plan mode is read-only and `brain-ask.sh` writes a
log); its saved answer of 29.09 was read instead — it matches the repo.

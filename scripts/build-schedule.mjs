/* ============================================================================
 * scripts/build-schedule.mjs — генерирует docs/first-weeks.md: разбор первых
 * недель по дням, чтобы можно было сесть заниматься, пока планнер строится.
 *
 *   node scripts/build-schedule.mjs [--days 28] [--hours 5] [--start 2026-09-01]
 *                                   [--profile novice|dev] [--out docs/first-weeks.md]
 * ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildUnits, dailyBudget, planDays, formatHours, STREAMS } from "../shared/schedule.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** roadmap-data.js — браузерный файл, он присваивает window.ROADMAP. */
function loadRoadmap() {
  const src = fs.readFileSync(path.join(ROOT, "roadmap-data.js"), "utf8");
  const scope = { window: {} };
  new Function("window", src)(scope.window);
  return scope.window.ROADMAP;
}

const DAYS = Number(arg("days", 28));
const HOURS = Number(arg("hours", 5));
const PROFILE = arg("profile", "novice");
const START = arg("start", "2026-09-01");
const OUT = path.join(ROOT, arg("out", "docs/first-weeks.md"));

const DATA = loadRoadmap();
const units = buildUnits(DATA, PROFILE);
const budget = dailyBudget(units, HOURS);
const [y, m, d] = START.split("-").map(Number);
const days = planDays(units, { hoursPerDay: HOURS, days: DAYS, startDate: new Date(y, m - 1, d) });

const WEEKDAY = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTH = ["января", "февраля", "марта", "апреля", "мая", "июня",
               "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const ruDate = (dt) => `${dt.getDate()} ${MONTH[dt.getMonth()]}`;

/** Десятичная запятая — на сайте везде «10,6», а не «10.6». */
const ruNum = (n, digits = 1) => n.toFixed(digits).replace(".", ",");

/** Русское склонение: 1 день, 2 дня, 5 дней. Дробное всегда как «дня». */
function plural(n, one, few, many) {
  if (!Number.isInteger(n)) return few;
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
const days_ = (n) => `${n} ${plural(n, "день", "дня", "дней")}`;
const months_ = (n) => `${ruNum(n)} ${plural(n, "месяц", "месяца", "месяцев")}`;

const out = [];
out.push(`# Первые ${DAYS} дней — по дням`);
out.push("");
out.push(`> Сгенерировано из \`roadmap-data.js\`: \`node scripts/build-schedule.mjs\`.`);
out.push(`> Профиль «${PROFILE === "dev" ? "Разработчик" : "Новичок"}», ${HOURS} ч в день, старт ${ruDate(new Date(y, m - 1, d))}.`);
out.push("");
out.push("## Как читается день");
out.push("");
out.push(`Три потока идут параллельно — так написано в самой карте: математика «параллельно с`);
out.push(`программированием», английский «20–30 минут в день, параллельно всему». Часы разложены так,`);
out.push(`чтобы все три закончились одновременно, а не чтобы математика тянулась ещё два месяца после`);
out.push(`последнего этапа.`);
out.push("");
out.push("| Поток | Всего часов | В день | В неделю |");
out.push("|---|---|---|---|");
for (const s of ["math", "english", "seq"]) {
  const total = units.filter((u) => u.stream === s).reduce((n, u) => n + u.hours, 0);
  out.push(`| ${STREAMS[s].title} | ${Math.round(total)} | **${formatHours(budget.perDay[s])}** | ${ruNum(budget.perDay[s] * 7)} ч |`);
}
out.push(`| **Итого** | **${Math.round(budget.totalHours)}** | **${HOURS} ч** | ${HOURS * 7} ч |`);
out.push("");
out.push(`Весь основной путь при этом темпе — **${days_(budget.days)} ≈ ${months_(budget.days / 30.44)}**`);
out.push(`(если заниматься каждый день).`);
out.push("");
out.push("Единица плана — конкретный ресурс, а не тема: тема в среднем 16 часов, для одного дня это");
out.push("слишком крупно. Длинный курс разбит на части — «часть 3» значит, что вы продолжаете с того");
out.push("места, где остановились. Блок **Задача** — это практика по теме: часы темы складываются из");
out.push("материалов и собственного кода, и без практики срок соврал бы почти вдвое.");
out.push("");
out.push("---");
out.push("");

let week = 0;
days.forEach((day, i) => {
  if (i % 7 === 0) {
    week += 1;
    out.push(`## Неделя ${week}`);
    out.push("");
  }

  out.push(`### День ${i + 1} — ${ruDate(day.date)}, ${WEEKDAY[day.weekday]}`);
  out.push("");

  for (const block of day.blocks) {
    if (!block.items.length) continue;
    out.push(`**${block.title} · ${formatHours(block.budget)}**`);
    out.push("");
    for (const it of block.items) {
      const u = it.unit;
      const link = u.url ? `[${u.title}](${u.url})` : u.title;
      const part = it.part > 1 || it.continues ? ` · часть ${it.part}` : "";
      out.push(`- ${link} — ${formatHours(it.hours)}${part}`);
      out.push(`  <br><small>${u.stageNum}. ${u.stageTitle} → ${u.topicTitle}</small>`);
      if (it.isStart && u.scope) out.push(`  <br><small>Объём: ${u.scope}</small>`);
      if (it.isStart && u.detail) out.push(`  <br><small>${u.detail}</small>`);
    }
    out.push("");
  }
  out.push("");
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join("\n"));

const planned = days.reduce((n, day) => n + day.blocks.reduce((m, b) => m + b.items.reduce((k, i) => k + i.hours, 0), 0), 0);
console.log(`Записано: ${path.relative(ROOT, OUT)}`);
console.log(`  дней: ${days.length}, часов запланировано: ${planned.toFixed(1)} (ожидалось ${(DAYS * HOURS).toFixed(1)})`);
console.log(`  весь путь: ${days_(budget.days)}, ${Math.round(budget.totalHours)} ч`);

/* ---------------------------------------------------------------------------
 * HTML-версия того же расписания. Нужна потому, что GitHub Pages отдаёт .md
 * как простой текст: с телефона это нечитаемо. Страница подключает styles.css
 * сайта, поэтому выглядит его частью и живёт в его же теме.
 * ------------------------------------------------------------------------- */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const html = [];
html.push('<!doctype html>');
html.push('<html lang="ru">');
html.push('<head>');
html.push('<meta charset="utf-8">');
html.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
html.push(`<title>План по дням — первые ${DAYS} дней</title>`);
html.push('<link rel="stylesheet" href="../styles.css">');
// Иконка та же, что у сайта: иначе браузер каждый раз ловит 404 на /favicon.ico.
html.push('<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\\\\\'http://www.w3.org/2000/svg\\\\\' viewBox=\\\\\'0 0 100 100\\\\\'%3E%3Crect width=\\\\\'100\\\\\' height=\\\\\'100\\\\\' rx=\\\\\'22\\\\\' fill=\\\\\'%234338ca\\\\\'/%3E%3Ctext x=\\\\\'50\\\\\' y=\\\\\'68\\\\\' font-size=\\\\\'54\\\\\' font-family=\\\\\'sans-serif\\\\\' font-weight=\\\\\'bold\\\\\' fill=\\\\\'white\\\\\' text-anchor=\\\\\'middle\\\\\'%3ET%3C/text%3E%3C/svg%3E">');
html.push('<style>');
html.push('  .plan { max-width: 780px; margin: 0 auto; padding: 24px 18px 60px; }');
html.push('  .plan h1 { margin: 0 0 6px; }');
html.push('  .plan .lede { color: var(--text-muted); margin: 0 0 22px; }');
html.push('  .plan table { width: 100%; border-collapse: collapse; margin: 0 0 22px; font-size: 14px; }');
html.push('  .plan th, .plan td { border-bottom: 1px solid var(--border); padding: 8px 10px; text-align: left; }');
html.push('  .plan th { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }');
html.push('  .plan td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }');
html.push('  .day { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);');
html.push('         box-shadow: var(--shadow-sm); padding: 14px 16px; margin: 0 0 12px; }');
html.push('  .day > h3 { margin: 0 0 10px; font-size: 15px; }');
html.push('  .blk { margin: 0 0 12px; }');
html.push('  .blk:last-child { margin-bottom: 0; }');
html.push('  .blk > b { display: block; font-size: 13px; margin-bottom: 6px; }');
html.push('  .blk.math > b    { color: #7c3aed; }');
html.push('  .blk.english > b { color: var(--accent); }');
html.push('  .blk.seq > b     { color: var(--primary); }');
html.push('  .u { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-top: 1px solid var(--border); }');
html.push('  .u:first-of-type { border-top: 0; }');
html.push('  .u .t { flex: 1; min-width: 0; font-size: 14px; }');
html.push('  .u .h { font-size: 13px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }');
html.push('  .u small { display: block; color: var(--text-faint); }');
html.push('  .wk { margin: 28px 0 12px; padding-top: 18px; border-top: 2px solid var(--border-strong); }');
html.push('  .back { display: inline-block; margin-bottom: 18px; font-size: 14px; }');
html.push('</style>');
html.push('</head>');
html.push('<body>');
html.push('<div class="plan">');
html.push('<a class="back" href="../index.html">← К дорожной карте</a>');
html.push(`<h1>План по дням — первые ${DAYS} дней</h1>`);
html.push(`<p class="lede">Профиль «${PROFILE === "dev" ? "Разработчик" : "Новичок"}», ${HOURS} ч в день, старт ${ruDate(new Date(y, m - 1, d))}. Собрано из карты, а не написано руками.</p>`);

html.push('<table><thead><tr><th>Поток</th><th class="n">Всего</th><th class="n">В день</th><th class="n">В неделю</th></tr></thead><tbody>');
for (const s of ["math", "english", "seq"]) {
  const total = units.filter((u) => u.stream === s).reduce((n, u) => n + u.hours, 0);
  html.push(`<tr><td>${STREAMS[s].title}</td><td class="n">${Math.round(total)} ч</td><td class="n"><b>${formatHours(budget.perDay[s])}</b></td><td class="n">${ruNum(budget.perDay[s] * 7)} ч</td></tr>`);
}
html.push(`<tr><td><b>Итого</b></td><td class="n"><b>${Math.round(budget.totalHours)} ч</b></td><td class="n"><b>${HOURS} ч</b></td><td class="n"><b>${HOURS * 7} ч</b></td></tr>`);
html.push('</tbody></table>');

html.push(`<p>Три потока идут параллельно — так написано в самой карте: математика «параллельно с программированием», английский «20–30 минут в день». Часы разложены так, чтобы все три закончились одновременно. Весь основной путь при этом темпе — <b>${days_(budget.days)} ≈ ${months_(budget.days / 30.44)}</b>.</p>`);
html.push('<p>Единица плана — конкретный ресурс, а не тема: тема в среднем 16 часов, для дня это слишком крупно. «Часть 3» значит, что вы продолжаете начатое. Блок <b>Задача</b> — практика по теме: часы темы складываются из материалов и собственного кода.</p>');

let hweek = 0;
days.forEach((day, i) => {
  if (i % 7 === 0) { hweek += 1; html.push(`<h2 class="wk">Неделя ${hweek}</h2>`); }
  html.push('<article class="day">');
  html.push(`<h3>День ${i + 1} — ${ruDate(day.date)}, ${WEEKDAY[day.weekday]}</h3>`);
  for (const block of day.blocks) {
    if (!block.items.length) continue;
    html.push(`<div class="blk ${block.stream}"><b>${block.title} · ${formatHours(block.budget)}</b>`);
    for (const it of block.items) {
      const u = it.unit;
      const name = u.url ? `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.title)}</a>` : esc(u.title);
      const part = it.part > 1 || it.continues ? ` · часть ${it.part}` : "";
      html.push('<div class="u"><div class="t">' + name + part);
      html.push(`<small>${esc(u.stageNum)}. ${esc(u.stageTitle)} → ${esc(u.topicTitle)}</small>`);
      if (it.isStart && u.scope) html.push(`<small>Объём: ${esc(u.scope)}</small>`);
      if (it.isStart && u.detail) html.push(`<small>${esc(u.detail)}</small>`);
      html.push(`</div><span class="h">${formatHours(it.hours)}</span></div>`);
    }
    html.push('</div>');
  }
  html.push('</article>');
});

html.push('</div></body></html>');

const OUT_HTML = OUT.replace(/\.md$/, ".html");
fs.writeFileSync(OUT_HTML, html.join("\n"));
console.log(`  и HTML: ${path.relative(ROOT, OUT_HTML)}`);

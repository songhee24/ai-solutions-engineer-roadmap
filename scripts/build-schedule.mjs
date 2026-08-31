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
 * 2026-08-31: генерация HTML отсюда УБРАНА. Страница плана стала динамической
 * (docs/plan.html): она сама считает дни от даты, которую выбрал читатель, —
 * привязка к одному числу была неверной, начать можно в любой день. Здесь
 * остаётся только markdown для чтения в редакторе и в git.
 * Прежний HTML-рендер: git show 2421f8e -- scripts/build-schedule.mjs
 * ------------------------------------------------------------------------- */

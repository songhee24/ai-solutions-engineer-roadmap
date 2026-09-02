/* ============================================================================
 * scripts/check-site.mjs — дымовая проверка всех страниц настоящим браузером.
 *
 * Закрывает то, чего не видят ни `test/roadmap-data.test.mjs` (данные), ни
 * jsdom-тесты (разметка и роутер): реальные стили, переполнение по ширине,
 * тёмная тема, ошибки в консоли — и то, что планнер вообще собирается.
 *
 * Запуск:
 *   npm --prefix planner-src run build
 *   python3 -m http.server 8799 --bind 127.0.0.1 &
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --remote-debugging-port=9337 --user-data-dir=/tmp/roadmap-check \
 *     --no-first-run --disable-gpu about:blank &
 *   node scripts/check-site.mjs
 *
 * Адрес и порт переопределяются: --base=... --port=...
 * ========================================================================== */

import { connect, evalJs, goto, errorsSince } from "./cdp.mjs";

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8799/").replace(/\/?$/, "/");
const PORT = Number(arg("port", "9337"));

const cdp = await connect(PORT);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");
// Без этого проверка показывает прошлый прогон: Chrome отдаёт страницу из
// кеша, и только что исправленное переполнение «остаётся» на месте.
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

const offset = cdp.events.length;
const problems = [];
const say = (...a) => console.log(...a);

/* ------------------------------------------------------- 1. карта --- */

await goto(cdp, `${BASE}index.html`);
const map = await evalJs(cdp, `({
  extra: Array.from(document.querySelectorAll(".section-nav a.nav-extra"))
    .map(a => a.textContent.trim() + " → " + a.getAttribute("href")),
  designInNav: Array.from(document.querySelectorAll(".section-nav a"))
    .some(a => (a.getAttribute("href") || "").includes("design/")),
  footerHasDrafts: Array.from(document.querySelectorAll("footer a"))
    .some(a => (a.getAttribute("href") || "").includes("design/"))
})`);
say("── карта");
map.extra.forEach((n) => say("   отдельная страница: " + n));
if (map.designInNav) problems.push("черновые макеты вернулись в верхнюю навигацию");
if (!map.footerHasDrafts) problems.push("из подвала пропала ссылка на макеты");

for (const hash of ["#/roadmap", "#/stage/track-math", "#/method", "#/reviews"]) {
  await evalJs(cdp, `location.hash = ${JSON.stringify(hash)}`);
  await new Promise((r) => setTimeout(r, 250));
  const shown = await evalJs(cdp, `Array.from(document.querySelectorAll("main > section")).filter(s => !s.hidden).length`);
  if (!shown) problems.push(`маршрут ${hash} ничего не показывает`);
}
say("   маршруты роутера: работают");

/* ------------------------------------- 2. страницы и переполнение --- */

const pages = [
  ["planner/", "планнер"],
  ["docs/plan.html", "прикидка"],
  ["design/index.html", "каталог макетов"],
  ["design/planner.html", "выбранный макет"],
  ["design/planner-sheet.html", "макет 1"],
  ["design/planner-dashboard.html", "макет 2"],
  ["design/planner-tree.html", "макет 3"]
];

say("── страницы");
for (const [path, label] of pages) {
  await goto(cdp, BASE + path, { settleMs: 600 });
  const info = await evalJs(cdp, `({
    title: document.title,
    back: !!document.querySelector('a[href*="index.html"], a.mock-back, a.home, a.back'),
    icon: !!document.querySelector('link[rel="icon"]'),
    draft: !!document.querySelector(".draft-bar"),
    draftLink: document.querySelector(".draft-bar a")?.getAttribute("href") || null
  })`);

  const widths = [];
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
    await new Promise((r) => setTimeout(r, 200));
    const over = await evalJs(cdp, `document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    widths.push(`${w}px: ${over}`);
    if (over > 1) problems.push(`${path} на ${w}px: переполнение ${over}px`);
  }
  await cdp.send("Emulation.clearDeviceMetricsOverride");

  say(`   ${label} (${path}) — «${info.title}»`);
  say(`     назад: ${info.back ? "есть" : "НЕТ"} | иконка: ${info.icon ? "есть" : "НЕТ"} | переполнение ${widths.join(", ")}`);
  if (!info.back) problems.push(`${path}: нет ссылки назад`);
  if (!info.icon) problems.push(`${path}: нет favicon`);

  // Черновики обязаны предупреждать о себе и выпускать на рабочий планнер.
  if (path.startsWith("design/")) {
    if (!info.draft) problems.push(`${path}: нет полосы «черновик»`);
    if (info.draftLink !== "../planner/") problems.push(`${path}: полоса не ведёт в планнер`);
  }
}

/* ----------------------------------------------------- 3. тёмная тема --- */

await goto(cdp, `${BASE}planner/`, { settleMs: 800 });
await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await new Promise((r) => setTimeout(r, 250));
const dark = await evalJs(cdp, `getComputedStyle(document.body).backgroundColor`);
await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await new Promise((r) => setTimeout(r, 250));
const light = await evalJs(cdp, `getComputedStyle(document.body).backgroundColor`);
say(`── тема: тёмная ${dark}, светлая ${light}`);
if (dark === light) problems.push("тёмная и светлая тема дают один фон");

/* ------------------------------------------------------------ итог --- */

const errors = errorsSince(cdp, offset).filter((e) => !/favicon/.test(e));
say();
say(errors.length ? "ОШИБКИ В КОНСОЛИ:\n  " + errors.join("\n  ") : "Ошибок в консоли нет.");
say(problems.length ? "ПРОБЛЕМЫ:\n  " + problems.join("\n  ") : "Проблем нет.");
cdp.close();
process.exit(problems.length || errors.length ? 1 : 0);

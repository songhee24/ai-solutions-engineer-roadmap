// @vitest-environment jsdom
/* ============================================================================
 * Календарь: развёрнутый день, список «уехало» и разметка клеток.
 *
 * До этих тестов всё перечисленное держалось только на разовых скриптах,
 * которые жили в папке для временных файлов и до следующего раунда не доживали.
 * ========================================================================== */

import { test } from "vitest";
import assert from "node:assert/strict";
import { mount, unmount, tick } from "svelte";

localStorage.setItem("asr:planner:v1", JSON.stringify({
  v: 1, startDate: "2026-09-03", hoursPerDay: 3, weekdays: [0, 1, 2, 3, 4, 5, 6],
  profile: "novice",
  // 3-го закрыт только английский; математика и основной этап уехали дальше.
  log: { "2026-09-03": [{ unitId: "e1", hours: 1 }] },
  dayHours: {}, skipped: {}, custom: [], templates: [], weekdayTemplate: {}, screen: "calendar"
}));

const { default: Calendar } = await import("../src/screens/Calendar.svelte");

const UNITS = [
  { id: "m1", stream: "math", hours: 1, title: "Дроби" },
  { id: "e1", stream: "english", hours: 1, title: "Тест уровня" },
  { id: "s1", stream: "seq", hours: 1, title: "Введение в ML" }
];

const SUMMARY = {
  totalHours: 3, doneHours: 1, remainingHours: 2, percent: 33, daysElapsed: 2,
  closedDays: 1, missed: 0, missedDays: [], streak: 1, behindHours: 2, aheadHours: 0,
  usedToday: 0, starved: [], finishIso: "2026-09-06"
};

function календарь() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Calendar, { target, props: { units: UNITS, summary: SUMMARY, today: "2026-09-04" } });
  return { target, close: () => { unmount(app); target.remove(); } };
}

const строка = (target, текст) =>
  [...target.querySelectorAll(".row .peek")].find((b) => b.textContent.includes(текст));

test("строка дня раскрывается и показывает состав из журнала", async () => {
  const { target, close } = календарь();
  assert.equal(target.querySelectorAll(".detail").length, 0, "день развёрнут до клика");

  строка(target, "3 сентября").click();
  await tick();

  const detail = target.querySelector(".detail");
  assert.ok(detail, "день не развернулся");
  const строки = [...detail.querySelectorAll("ul:not(.moved) li")].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.equal(строки.length, 1);
  assert.match(строки[0], /Тест уровня/);
  assert.match(detail.querySelector(".sum").textContent, /Всего за день — 1 ч/);
  close();
});

test("у прошедшего дня есть «уехало», у сегодняшнего — нет", async () => {
  const { target, close } = календарь();

  строка(target, "3 сентября").click();
  await tick();
  assert.ok(target.querySelector(".detail .moved-head"), "у прошедшего дня нет блока «уехало»");
  assert.match(target.querySelector(".detail .moved-head").textContent, /Уехало на/);

  строка(target, "3 сентября").click();   // свернуть
  await tick();
  строка(target, "4 сентября").click();
  await tick();
  // Сегодня ещё не кончилось: объявлять его хвост уехавшим значило бы ругать авансом.
  assert.equal(target.querySelector(".detail .moved-head"), null,
    "у сегодняшнего дня показан блок «уехало»");
  assert.ok(target.querySelector(".detail .empty"), "пустой день не объяснён словами");
  close();
});

test("кнопки внутри кнопок нет — иначе разметка невалидна", async () => {
  const { target, close } = календарь();
  строка(target, "3 сентября").click();
  await tick();
  assert.equal(target.querySelectorAll("button button").length, 0);
  close();
});

test("клетки теплокарты — кнопки, но вне обхода по Tab", () => {
  // 400+ клеток в Tab сделали бы клавиатурную навигацию непроходимой; путь для
  // клавиатуры — список «Последних дней», который покрывает те же дни.
  const { target, close } = календарь();
  const клетки = [...target.querySelectorAll(".heat .cell")];
  assert.ok(клетки.length > 0, "клеток нет вовсе");
  for (const c of клетки) {
    assert.equal(c.tagName, "BUTTON");
    assert.equal(c.tabIndex, -1, "клетка попала в обход по Tab");
  }
  assert.ok(клетки.every((c) => c.getAttribute("aria-label") !== null || c.disabled),
    "у активной клетки нет подписи для скринридера");
  close();
});

test("клик по клетке раскрывает тот же день под теплокартой", async () => {
  const { target, close } = календарь();
  const клетка = [...target.querySelectorAll(".heat .cell:not(:disabled)")]
    .find((c) => (c.getAttribute("aria-label") || "").includes("3 сентября"));
  assert.ok(клетка, "клетки 3 сентября нет");

  клетка.click();
  await tick();
  const panel = target.querySelector(".picked");
  assert.ok(panel, "панель под теплокартой не открылась");
  assert.match(panel.querySelector(".picked-head").textContent, /3 сентября/);
  assert.ok(panel.querySelector(".detail"), "в панели нет состава дня");
  close();
});

test("«Показать ещё» не предлагается, когда список дошёл до старта", () => {
  const { target, close } = календарь();
  assert.equal(target.querySelectorAll(".more button").length, 0);
  assert.equal(target.querySelectorAll(".row").length, 2, "дней в списке должно быть два");
  close();
});

test("«Показать ещё» открывает следующие дни и исчезает на дате старта", async () => {
  // Стартовая дата живёт в реактивном хранилище, поэтому её можно отодвинуть
  // прямо здесь — перезагружать модуль ради одного поля незачем.
  const { planner } = await import("../src/lib/store.svelte.js");
  const было = planner.startDate;
  planner.startDate = "2026-08-01";          // 34 дня до «сегодня»

  const { target, close } = календарь();
  assert.equal(target.querySelectorAll(".row").length, 14, "первым показом должно быть 14 дней");

  const ещё = target.querySelector(".more button");
  assert.ok(ещё, "кнопки «Показать ещё» нет, хотя до старта далеко");
  ещё.click();
  await tick();
  assert.equal(target.querySelectorAll(".row").length, 28);

  target.querySelector(".more button").click();
  await tick();
  assert.equal(target.querySelectorAll(".row").length, 35, "список должен упереться в дату старта");
  assert.equal(target.querySelectorAll(".more button").length, 0, "кнопка не исчезла на старте");

  close();
  planner.startDate = было;
});

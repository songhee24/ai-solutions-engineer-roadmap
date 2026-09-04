// @vitest-environment jsdom
/* ============================================================================
 * Карточка «Темп» на экране «Сегодня».
 *
 * Раньше отставание показывалось только когда были дни с нулём часов, и на
 * настоящих данных получалось «ни одного» при четырёх часах долга. Эти тесты
 * держат три состояния разведёнными.
 *
 * ⚠ store.svelte.js читает localStorage на уровне модуля, поэтому засев идёт
 * ДО первого импорта — отсюда динамический import ниже.
 * ========================================================================== */

import { test } from "vitest";
import assert from "node:assert/strict";
import { mount, unmount } from "svelte";

localStorage.setItem("asr:planner:v1", JSON.stringify({
  v: 1, startDate: "2026-09-03", hoursPerDay: 5, weekdays: [0, 1, 2, 3, 4, 5, 6],
  profile: "novice", log: {}, dayHours: {}, skipped: {}, custom: [],
  templates: [], weekdayTemplate: {}, screen: "today"
}));

const { default: Today } = await import("../src/screens/Today.svelte");

const UNITS = [
  { id: "m1", stream: "math", hours: 6, title: "Дроби", kind: "resource", stageNum: "A", topicTitle: "A1" },
  { id: "e1", stream: "english", hours: 1, title: "Тест уровня", kind: "resource", stageNum: "B", topicTitle: "B0" }
];

const БАЗА = {
  totalHours: 100, doneHours: 2, remainingHours: 98, percent: 2, daysElapsed: 2,
  closedDays: 1, missed: 0, missedDays: [], streak: 1, behindHours: 0, aheadHours: 0,
  usedToday: 0, starved: [], finishIso: "2027-07-22"
};

/** Монтирует экран и отдаёт текст карточки «Темп». */
function темп(summary) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Today, {
    target,
    props: {
      units: UNITS, doneByUnit: {}, firstDay: {}, carried: {},
      summary: { ...БАЗА, ...summary }, today: "2026-09-04"
    }
  });
  const карточка = [...target.querySelectorAll(".card.side")]
    .find((c) => c.querySelector("h3")?.textContent.trim() === "Темп");
  const out = карточка && {
    число: карточка.querySelector("p.mono").textContent.trim(),
    подпись: карточка.textContent.replace(/\s+/g, " ")
  };
  unmount(app);
  target.remove();
  return out;
}

test("отставание видно, даже когда пропущенных дней ноль", () => {
  // Ровно случай, из-за которого всё затевалось: занимался, но меньше плана.
  const c = темп({ behindHours: 3, missed: 0 });
  assert.ok(c, "карточки «Темп» нет");
  assert.equal(c.число, "−3,0 ч");
  assert.match(c.подпись, /Отставание от объявленного расписания/);
  assert.equal(/без единой галочки/.test(c.подпись), false,
    "про дни без галочки сказано, хотя их ноль");
});

test("пропущенные дни названы отдельной оговоркой внутри отставания", () => {
  const c = темп({ behindHours: 10, missed: 2 });
  assert.equal(c.число, "−10,0 ч");
  assert.match(c.подпись, /2 дня без единой галочки/);
});

test("опережение показывается плюсом, а не прячется", () => {
  // aheadHours считался всегда и не рисовался нигде.
  const c = темп({ aheadHours: 4 });
  assert.equal(c.число, "+4,0 ч");
  assert.match(c.подпись, /опережением/);
});

test("ровный темп говорит «ровно по плану», а не «ни одного»", () => {
  const c = темп({ behindHours: 0, aheadHours: 0 });
  assert.equal(c.число, "ровно по плану");
  assert.match(c.подпись, /Финиш при нынешнем темпе/);
});

test("отставание сильнее опережения: одновременно они невозможны", () => {
  // Защита от ветки, которая показала бы обе цифры разом.
  const c = темп({ behindHours: 3, aheadHours: 4 });
  assert.equal(c.число, "−3,0 ч");
});

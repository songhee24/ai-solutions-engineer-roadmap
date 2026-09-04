// @vitest-environment jsdom
/* ============================================================================
 * Подписи «тянется с 3 сентября» и «перенесено с 3 сентября».
 *
 * Две подписи отвечают на разные вопросы и обязаны исключать друг друга:
 * первая — про тему, которую начали и не добили (она есть в журнале), вторая —
 * про тему, которая стояла в плане и которую не трогали (в журнале её нет).
 * ========================================================================== */

import { test } from "vitest";
import assert from "node:assert/strict";
import { mount, unmount } from "svelte";

localStorage.setItem("asr:planner:v1", JSON.stringify({
  v: 1, startDate: "2026-09-03", hoursPerDay: 5, weekdays: [0, 1, 2, 3, 4, 5, 6],
  profile: "novice",
  // Дроби начаты 3-го и не добиты; тест уровня не трогали вовсе.
  log: { "2026-09-03": [{ unitId: "m1", hours: 1 }] },
  dayHours: {}, skipped: {}, custom: [], templates: [], weekdayTemplate: {}, screen: "today"
}));

const { default: Today } = await import("../src/screens/Today.svelte");

const UNITS = [
  { id: "m1", stream: "math", hours: 6, title: "Дроби", kind: "resource", stageNum: "A", topicTitle: "A1" },
  { id: "e1", stream: "english", hours: 1, title: "Тест уровня", kind: "resource", stageNum: "B", topicTitle: "B0" }
];

const SUMMARY = {
  totalHours: 7, doneHours: 1, remainingHours: 6, percent: 14, daysElapsed: 2,
  closedDays: 1, missed: 0, missedDays: [], streak: 1, behindHours: 4, aheadHours: 0,
  usedToday: 0, starved: [], finishIso: "2027-07-22"
};

function экран(props) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Today, {
    target,
    props: {
      units: UNITS, doneByUnit: { m1: 1 }, summary: SUMMARY, today: "2026-09-04",
      firstDay: {}, carried: {}, ...props
    }
  });
  const карточки = [...target.querySelectorAll(".item")].map((it) => ({
    title: it.querySelector(".title").textContent.trim(),
    meta: [...it.querySelectorAll(".meta")].map((m) => m.textContent.replace(/\s+/g, " ")).join(" | ")
  }));
  unmount(app);
  target.remove();
  return карточки;
}

test("начатая раньше тема подписана днём, а не словом «продолжаете»", () => {
  const дроби = экран({ firstDay: { m1: "2026-09-03" } }).find((c) => /Дроби/.test(c.title));
  assert.ok(дроби, "карточки с дробями нет");
  assert.match(дроби.meta, /тянется с 3 сентября/);
  assert.match(дроби.meta, /закрыто 1,0 из 6,0 ч/);
  assert.equal(/продолжаете/.test(дроби.meta), false);
});

test("начатая сегодня тема остаётся с «продолжаете»", () => {
  // Дата совпала с сегодняшней — называть её незачем, это не перенос.
  const дроби = экран({ firstDay: { m1: "2026-09-04" } }).find((c) => /Дроби/.test(c.title));
  assert.match(дроби.meta, /продолжаете: закрыто/);
  assert.equal(/тянется с/.test(дроби.meta), false);
});

test("нетронутая тема из прошлого плана подписана «перенесено с»", () => {
  const тест = экран({ carried: { e1: "2026-09-03" } }).find((c) => /Тест уровня/.test(c.title));
  assert.ok(тест, "карточки с тестом уровня нет");
  assert.match(тест.meta, /перенесено с 3 сентября/);
});

test("обе подписи на одной карточке невозможны", () => {
  // Журнал сильнее: если тему трогали, про неё говорит «тянется с».
  const карточки = экран({ firstDay: { m1: "2026-09-03" }, carried: { m1: "2026-09-03", e1: "2026-09-03" } });
  for (const c of карточки) {
    assert.equal(/тянется с/.test(c.meta) && /перенесено с/.test(c.meta), false,
      `на карточке «${c.title}» обе подписи сразу`);
  }
  const дроби = карточки.find((c) => /Дроби/.test(c.title));
  assert.match(дроби.meta, /тянется с/);
  assert.equal(/перенесено с/.test(дроби.meta), false);
});

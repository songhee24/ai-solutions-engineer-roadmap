/* ============================================================================
 * Тесты ядра прогресса. Главное, что здесь проверяется, — обещание, данное
 * пользователю: план выводится из непройденного, поэтому пропущенный день
 * ничего не теряет, а лишь сдвигает финиш.
 * ========================================================================== */

import test from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  diffDays,
  budgetForDay,
  doneHoursByUnit,
  totalDoneHours,
  hoursOnDay,
  remainingUnits,
  scheduledDays,
  missedDays,
  currentStreak,
  finishDate,
  stats
} from "../src/lib/progress.js";

/** Планнер по умолчанию: старт 1 сентября, 5 часов, все семь дней. */
function planner(over = {}) {
  return {
    v: 1,
    startDate: "2026-09-01",
    hoursPerDay: 5,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    profile: "novice",
    log: {},
    dayHours: {},
    skipped: {},
    ...over
  };
}

const units = [
  { id: "a::r0", stream: "seq", hours: 10 },
  { id: "a::r1", stream: "seq", hours: 4 },
  { id: "b::r0", stream: "math", hours: 6 }
];

/* ---------------------------------------------------------------- даты --- */

test("addDays и diffDays переживают переход через месяц", () => {
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2026-09-01", -1), "2026-08-31");
  assert.equal(diffDays("2026-09-01", "2026-09-10"), 9);
  assert.equal(diffDays("2026-09-10", "2026-09-01"), -9);
});

test("addDays переживает переход на зимнее время", () => {
  // В США часы переводят 1 ноября 2026; сутки в этот день длятся 25 часов.
  assert.equal(addDays("2026-10-31", 3), "2026-11-03");
  assert.equal(diffDays("2026-10-30", "2026-11-05"), 6);
});

/* -------------------------------------------------------------- бюджет --- */

test("бюджет дня: обычный день, выходной по расписанию, ручное переопределение", () => {
  const p = planner({ weekdays: [1, 2, 3, 4, 5], dayHours: { "2026-09-02": 2 } });
  assert.equal(budgetForDay(p, "2026-09-01"), 5, "вторник — рабочий");
  assert.equal(budgetForDay(p, "2026-09-02"), 2, "среда переопределена вручную");
  assert.equal(budgetForDay(p, "2026-09-05"), 0, "суббота выпала из расписания");
});

test("ручной ноль делает выходной даже в рабочий день недели", () => {
  const p = planner({ dayHours: { "2026-09-03": 0 } });
  assert.equal(budgetForDay(p, "2026-09-03"), 0);
});

/* ----------------------------------------------------------- журнал --- */

test("часы единицы складываются по всем дням", () => {
  const log = {
    "2026-09-01": [{ unitId: "a::r0", hours: 3 }],
    "2026-09-02": [{ unitId: "a::r0", hours: 2 }, { unitId: "b::r0", hours: 1 }]
  };
  assert.deepEqual(doneHoursByUnit(log), { "a::r0": 5, "b::r0": 1 });
  assert.equal(totalDoneHours(log), 6);
  assert.equal(hoursOnDay(log, "2026-09-02"), 3);
  assert.equal(hoursOnDay(log, "2026-09-09"), 0, "день без записей — ноль, а не undefined");
});

/* --------------------------------------------------- остаток программы --- */

test("остаток: закрытое уходит, частичное урезается, полные часы сохраняются", () => {
  const done = { "a::r0": 4, "a::r1": 4 };
  const left = remainingUnits(units, done);

  assert.deepEqual(left.map((u) => u.id), ["a::r0", "b::r0"], "полностью закрытое выпало");
  assert.equal(left[0].hours, 6, "осталось 6 из 10");
  assert.equal(left[0].fullHours, 10, "исходный объём сохранён для подписи «из 10 ч»");
  assert.equal(left[0].doneOfUnit, 4);
  assert.equal(left[1].hours, 6, "нетронутая единица не изменилась");
});

test("переработка сверх объёма единицы не даёт отрицательного остатка", () => {
  const left = remainingUnits(units, { "a::r1": 99 });
  assert.deepEqual(left.map((u) => u.id), ["a::r0", "b::r0"]);
});

/* ------------------------------------------------------------ пропуски --- */

test("рабочие дни считаются с учётом расписания и ручных выходных", () => {
  const p = planner({ weekdays: [1, 2, 3, 4, 5], dayHours: { "2026-09-03": 0 } });
  // 1 сентября 2026 — вторник.
  assert.deepEqual(scheduledDays(p, "2026-09-01", "2026-09-07"), [
    "2026-09-01", "2026-09-02", "2026-09-04", "2026-09-07"
  ]);
});

test("пропуск — только рабочий день до сегодня без единой записи", () => {
  const p = planner({
    log: {
      "2026-09-01": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-04": [{ unitId: "a::r0", hours: 5 }]
    },
    dayHours: { "2026-09-03": 0 }
  });
  assert.deepEqual(
    missedDays(p, "2026-09-05"),
    ["2026-09-02"],
    "3-е — объявленный выходной, 5-е — сегодня и ещё не кончилось"
  );
});

test("серия: выходной её не рвёт, пропущенный рабочий день — рвёт", () => {
  const p = planner({
    log: {
      "2026-09-01": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-02": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-04": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-05": [{ unitId: "a::r0", hours: 5 }]
    },
    dayHours: { "2026-09-03": 0 }
  });
  assert.equal(currentStreak(p, "2026-09-05"), 4, "выходной 3-го пропущен насквозь");

  const broken = planner({
    log: {
      "2026-09-01": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-04": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-05": [{ unitId: "a::r0", hours: 5 }]
    }
  });
  assert.equal(currentStreak(broken, "2026-09-05"), 2, "2-е и 3-е прогуляны — серия началась заново");
});

test("незакрытое сегодня не обнуляет серию: день ещё не кончился", () => {
  const p = planner({
    log: {
      "2026-09-01": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-02": [{ unitId: "a::r0", hours: 5 }]
    }
  });
  assert.equal(currentStreak(p, "2026-09-03"), 2);
});

/* -------------------------------------------------------------- финиш --- */

/* Остаток и отработанное передаются ПООТОЧНО: с появлением шаблонов дня
   скалярный прогноз стал врать (см. templates.test.mjs). Смысл этих двух
   проверок прежний. */

test("финиш считается по рабочим дням, а не по календарным", () => {
  const p = planner({ weekdays: [1, 2, 3, 4, 5] });
  // 10 часов = два рабочих дня. Старт в пятницу 4 сентября → 4-е и 7-е (пн).
  assert.equal(finishDate(p, { seq: 10 }, "2026-09-04"), "2026-09-07");
});

test("уже отработанные сегодня часы уменьшают остаток первого дня", () => {
  const p = planner();
  assert.equal(finishDate(p, { seq: 5 }, "2026-09-01"), "2026-09-01");
  assert.equal(
    finishDate(p, { seq: 5 }, "2026-09-01", { seq: 3 }),
    "2026-09-02",
    "сегодня осталось 2 часа из 5"
  );
});

/* --------------------------------------------- главное обещание системы --- */

test("пропущенный день ничего не теряет — он сдвигает финиш ровно на день", () => {
  const prompt = planner({
    log: {
      "2026-09-01": [{ unitId: "a::r0", hours: 5 }],
      "2026-09-02": [{ unitId: "a::r0", hours: 5 }]
    }
  });
  const lazy = planner({
    log: { "2026-09-01": [{ unitId: "a::r0", hours: 5 }] }
  });

  const a = stats({ units, planner: prompt, todayIso: "2026-09-03" });
  const b = stats({ units, planner: lazy, todayIso: "2026-09-03" });

  assert.equal(a.remainingHours, 10);
  assert.equal(b.remainingHours, 15, "непройденные часы никуда не делись");
  assert.equal(diffDays(a.finishIso, b.finishIso), 1, "финиш отъехал ровно на день");
  assert.equal(b.missed, 1);
  assert.equal(b.behindHours, 5, "отставание равно пропущенному дню");
  assert.equal(a.behindHours, 0);
});

test("прогресс и доля пути считаются от полного объёма программы", () => {
  const p = planner({ log: { "2026-09-01": [{ unitId: "a::r0", hours: 5 }] } });
  const s = stats({ units, planner: p, todayIso: "2026-09-01" });
  assert.equal(s.totalHours, 20);
  assert.equal(s.doneHours, 5);
  assert.equal(s.percent, 25);
  assert.equal(s.closedDays, 1);
  assert.equal(s.missed, 0, "первый же день не может быть пропущенным");
});

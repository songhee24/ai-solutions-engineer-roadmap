/* ============================================================================
 * Шаблоны дня — именованные раскладки часов по потокам, привязанные к дням
 * недели. Они ломают допущение, на котором стоял скалярный прогноз: без них
 * dailyBudget по построению доводит три потока до финиша одновременно,
 * а шаблон «только проект» морозит математику насмерть.
 * ========================================================================== */

import { test } from "vitest";
import assert from "node:assert/strict";

import { planDays, dailyBudget } from "../../shared/schedule.mjs";
import {
  budgetForDay, templateForDay, streamRemaining, unplannedStreams,
  finishDate, addDays, diffDays, stats, weeklyStreamHours, finishAtWeeklyPace
} from "../src/lib/progress.js";

const TPL_USUAL = { id: "tpl-1", title: "Обычный день", hours: { math: 0.86, english: 0.33, seq: 3.81 } };
const TPL_LIGHT = { id: "tpl-2", title: "Лёгкая суббота", hours: { math: 0, english: 0.33, seq: 0 } };
const TPL_PROJECT = { id: "tpl-3", title: "Только проект", hours: { math: 0, english: 0, seq: 5 } };

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
    custom: [],
    templates: [],
    weekdayTemplate: {},
    ...over
  };
}

const units = [
  { id: "a", stream: "seq", hours: 100 },
  { id: "b", stream: "math", hours: 40 },
  { id: "c", stream: "english", hours: 10 }
];

/* ------------------------------------------------------------- бюджет --- */

test("шаблон дня недели задаёт бюджет дня суммой своих часов", () => {
  // 2026-09-05 — суббота.
  const p = planner({ templates: [TPL_LIGHT], weekdayTemplate: { 6: "tpl-2" } });
  assert.equal(budgetForDay(p, "2026-09-05"), 0.33);
  assert.equal(budgetForDay(p, "2026-09-04"), 5, "четверг без шаблона живёт по hoursPerDay");
});

test("приоритеты бюджета: ручной час сильнее шаблона, невыбранный день сильнее обоих", () => {
  const p = planner({
    weekdays: [1, 2, 3, 4, 5],
    templates: [TPL_LIGHT, TPL_PROJECT],
    weekdayTemplate: { 6: "tpl-2", 3: "tpl-3" },
    dayHours: { "2026-09-02": 2 }
  });
  assert.equal(budgetForDay(p, "2026-09-02"), 2, "ручной час сильнее шаблона среды");
  assert.equal(budgetForDay(p, "2026-09-09"), 5, "среда без ручного часа — по шаблону «Только проект»");
  assert.equal(budgetForDay(p, "2026-09-05"), 0, "суббота вне weekdays — ноль, даже имея шаблон");
});

test("висячий идентификатор шаблона откатывается к обычному дню", () => {
  const p = planner({ templates: [], weekdayTemplate: { 6: "tpl-стёртый" } });
  assert.equal(templateForDay(p, "2026-09-05"), null);
  assert.equal(budgetForDay(p, "2026-09-05"), 5);
});

/* ------------------------------------------------ английский как доза --- */

/* Карта пишет про трек B: «20–30 минут в день, параллельно всему остальному».
   Пропорция это правило держала случайно — при пяти часах доля и так давала
   двадцать минут. На двухчасовом дне оставалось восемь. */

test("на коротком дне английскому достаётся 20 минут, а не его доля", () => {
  const b = dailyBudget(units, 2);
  assert.equal(Math.round(b.perDay.english * 60), 20, "доля дала бы 8 минут");

  const rest = b.perDay.seq + b.perDay.math;
  assert.equal(Math.round(rest * 60), 100, "остаток дня целиком уходит seq и math");
  assert.ok(
    Math.abs(b.perDay.seq / rest - 100 / 140) < 1e-9,
    "пропорция между seq и math прежняя — 100 к 40"
  );
});

test("НЕПРОРЕГРЕССИЯ: при пяти часах порог не срабатывает", () => {
  // У этой фикстуры доля английского при пяти часах — ровно двадцать минут,
  // поэтому раскладка обязана остаться прежней до последнего знака.
  const b = dailyBudget(units, 5);
  assert.ok(Math.abs(b.perDay.seq - 100 / 30) < 1e-9);
  assert.ok(Math.abs(b.perDay.math - 40 / 30) < 1e-9);
  assert.ok(Math.abs(b.perDay.english - 10 / 30) < 1e-9);
});

test("получасовой день не становится английским: порог не выше трети дня", () => {
  const b = dailyBudget(units, 0.5);
  assert.equal(Math.round(b.perDay.english * 60), 10, "треть от получаса");
  assert.ok(b.perDay.seq > 0 && b.perDay.math > 0, "остальным потокам осталось");
  assert.ok(Math.abs(b.perDay.seq + b.perDay.math + b.perDay.english - 0.5) < 1e-9);
});

test("порог не выдумывает часы там, где английский уже закрыт", () => {
  const noEnglish = units.filter((u) => u.stream !== "english");
  const b = dailyBudget(noEnglish, 2);
  assert.equal(b.perDay.english, 0);
  assert.ok(Math.abs(b.perDay.seq + b.perDay.math - 2) < 1e-9, "день делят двое");
});

test("порог не тормозит английский, когда он остался один", () => {
  // Иначе хвост трека B полз бы по трети дня, хотя занять его больше нечем.
  const onlyEnglish = units.filter((u) => u.stream === "english");
  const b = dailyBudget(onlyEnglish, 2);
  assert.equal(b.perDay.english, 2);
});

test("порог меняет очередь потоков, а не срок", () => {
  // Час, отданный английскому сверх доли, не пропадает: как только трек B
  // закрыт, его минуты возвращаются остальным. Поэтому инвариант «три потока
  // финишируют одновременно» слабеет до «ничего не простаивает», а общая дата
  // остаётся прежней. Это и проверяем — иначе порог был бы платой в сроке.
  const p = planner({ hoursPerDay: 2 });
  const left = streamRemaining(units, {});
  const scalar = addDays("2026-09-01", Math.ceil(150 / 2) - 1);
  assert.equal(finishDate(p, left, "2026-09-01"), scalar);
});

/* ------------------------------------------------- раскладка внутри дня --- */

test("planDays с perDay следует шаблону, а не пропорции", () => {
  const [day] = planDays(units, {
    hoursPerDay: 5, days: 1, startDate: new Date(2026, 8, 5),
    perDay: TPL_LIGHT.hours
  });
  const byStream = Object.fromEntries(day.blocks.map((b) => [b.stream, b]));
  assert.equal(byStream.english.planned, 0.33);
  assert.equal(byStream.math, undefined, "поток с нулём в шаблоне блока не даёт");
  assert.equal(byStream.seq, undefined);
});

test("часы потока с пустым остатком не переливаются в соседний", () => {
  // Перелив был бы машинерией: расхождение честно показывает подпись блока.
  const only = [{ id: "c", stream: "english", hours: 0.2 }];
  const [day] = planDays(only, {
    hoursPerDay: 5, days: 1, startDate: new Date(2026, 8, 5),
    perDay: { math: 1, english: 1, seq: 3 }
  });
  const planned = day.blocks.reduce((n, b) => n + b.planned, 0);
  assert.equal(planned, 0.2, "план раздулся за счёт чужих часов");
});

test("НЕПРОРЕГРЕССИЯ: без perDay planDays считает ровно как раньше", () => {
  // У shared/schedule.mjs есть ещё два потребителя — scripts/build-schedule.mjs
  // и docs/plan.html. Они perDay не передают, и их вывод меняться не должен.
  const opts = { hoursPerDay: 5, days: 3, startDate: new Date(2026, 8, 1) };
  const withUndefined = planDays(units, { ...opts, perDay: undefined });
  const without = planDays(units, opts);
  const shape = (days) => days.map((d) => ({
    iso: d.iso,
    blocks: d.blocks.map((b) => [b.stream, b.budget, b.planned, b.items.map((i) => [i.unit.id, i.hours])])
  }));
  assert.deepEqual(shape(withUndefined), shape(without));

  const budget = dailyBudget(units, 5);
  assert.equal(without[0].blocks.find((b) => b.stream === "seq").budget, Math.round(budget.perDay.seq * 100) / 100);
});

/* -------------------------------------------------------------- финиш --- */

test("СВЕДЕНИЕ: без шаблонов пооточный финиш совпадает со скалярным", () => {
  // Пропорциональная раскладка сохраняет доли потоков, поэтому обобщение
  // обязано давать тот же ответ. Иначе это не обобщение, а другая функция.
  const p = planner();
  const left = streamRemaining(units, {});
  const total = left.seq + left.math + left.english;

  // Скалярная прикидка вручную: 150 часов по 5 в день = 30 дней, старт включительно.
  const scalar = addDays("2026-09-01", Math.ceil(total / 5) - 1);
  assert.equal(finishDate(p, left, "2026-09-01"), scalar);
});

test("СВЕДЕНИЕ работает и при неполной неделе, и с уже отработанными часами", () => {
  const p = planner({ weekdays: [1, 2, 3, 4, 5] });
  const left = streamRemaining(units, {});
  const iso = finishDate(p, left, "2026-09-01");
  // 150 ч по 5 = 30 рабочих дней; 1 сентября 2026 — вторник.
  let cursor = "2026-09-01";
  for (let n = 1; n < 30; n++) {
    do { cursor = addDays(cursor, 1); } while (budgetForDay(p, cursor) === 0);
  }
  assert.equal(iso, cursor);

  const used = { seq: 5, math: 0, english: 0 };
  const later = finishDate(p, left, "2026-09-01", used);
  assert.equal(diffDays(iso, later), 1, "съеденный первый день двигает финиш ровно на день");
});

test("шаблон, морозящий поток, отодвигает финиш дальше скалярной прикидки", () => {
  const p = planner({ templates: [TPL_PROJECT], weekdayTemplate: { 0: "tpl-3", 1: "tpl-3", 2: "tpl-3", 3: "tpl-3", 4: "tpl-3", 5: "tpl-3", 6: "tpl-3" } });
  const left = streamRemaining(units, {});
  const naive = addDays("2026-09-01", Math.ceil((left.seq + left.math + left.english) / 5) - 1);
  const honest = finishDate(p, left, "2026-09-01");
  // «Только проект» каждый день двигает seq и не трогает математику с английским:
  // они не закончатся никогда, поэтому честный ответ упирается в сторож.
  assert.ok(diffDays(naive, honest) > 0, "прогноз соврал: финиш не сдвинулся");
});

test("«лёгкая суббота» отодвигает финиш примерно на потерянные субботние часы", () => {
  const plain = planner();
  const light = planner({ templates: [TPL_LIGHT], weekdayTemplate: { 6: "tpl-2" } });
  const left = streamRemaining(units, {});

  const a = finishDate(plain, left, "2026-09-01");
  const b = finishDate(light, left, "2026-09-01");
  const shift = diffDays(a, b);
  // За 30 дней ~4 субботы, каждая теряет ~4,67 ч из пяти → около 19 ч → ~4 дня.
  assert.ok(shift >= 3 && shift <= 6, `сдвиг ${shift} дней, ожидали 3–6`);
});

/* --------------------------------------------------- обделённые потоки --- */

test("unplannedStreams называет поток, которому не дали часов ни в один день", () => {
  const p = planner({
    templates: [TPL_PROJECT],
    weekdayTemplate: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, "tpl-3"]))
  });
  assert.deepEqual(unplannedStreams(p).sort(), ["english", "math"]);
});

test("хотя бы один день без шаблона кормит все потоки — голодных нет", () => {
  const p = planner({
    templates: [TPL_PROJECT],
    weekdayTemplate: { 1: "tpl-3", 2: "tpl-3", 3: "tpl-3", 4: "tpl-3", 5: "tpl-3", 6: "tpl-3" }
  });
  assert.deepEqual(unplannedStreams(p), [], "воскресенье без шаблона раскладывается пропорционально");
});

/* ------------------------------------------------- фактический темп --- */

test("недельная выдача потока считается по факту, а не долей на число дней", () => {
  // На днях с шаблоном раскладка задана прямо. Умножать пропорциональную долю
  // на число дней значит соврать ровно там, где шаблон и стоит.
  const plain = planner();
  assert.equal(weeklyStreamHours(plain, "math", 0.86), 6.02, "семь обычных дней по 0,86");

  const light = planner({ templates: [TPL_LIGHT], weekdayTemplate: { 6: "tpl-2" } });
  assert.equal(weeklyStreamHours(light, "math", 0.86), 5.16, "суббота даёт математике ноль");

  const all = planner({
    templates: [TPL_USUAL],
    weekdayTemplate: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, "tpl-1"]))
  });
  assert.equal(weeklyStreamHours(all, "math", 99), 6.02, "шаблон сильнее пропорции");

  const short = planner({ weekdays: [1, 2, 3, 4, 5] });
  assert.equal(weeklyStreamHours(short, "math", 0.86), 4.3, "пять дней вместо семи");
});

test("финиш при заданном недельном темпе считается по календарю", () => {
  // «Часов в неделю» — уже недельная величина: делить её ещё раз на расписание
  // значит учесть выходные дважды.
  assert.equal(finishAtWeeklyPace(7, 7, "2026-09-01"), "2026-09-07", "неделя работы = семь дней");
  assert.equal(finishAtWeeklyPace(0, 5, "2026-09-01"), null, "нечего проходить — нет и даты");
  assert.equal(finishAtWeeklyPace(10, 0, "2026-09-01"), null, "нулевой темп не даёт даты");

  // 277 часов математики: при 6 ч/нед — около 323 дней, при 5 — около 388.
  const fast = finishAtWeeklyPace(277, 6, "2026-09-02");
  const slow = finishAtWeeklyPace(277, 5, "2026-09-02");
  assert.ok(diffDays(fast, slow) > 55, `разрыв ${diffDays(fast, slow)} дней, ожидали больше 55`);
});

/* -------------------------------------------------------------- свод --- */

test("stats при шаблонах считает отставание по объявленному расписанию", () => {
  const p = planner({
    templates: [TPL_LIGHT],
    weekdayTemplate: { 6: "tpl-2" },
    log: { "2026-09-01": [{ unitId: "a", hours: 5 }] }
  });
  // 1 сентября вторник, 5 сентября суббота (0,33 ч по шаблону).
  const s = stats({ units, planner: p, todayIso: "2026-09-07" });
  assert.equal(s.doneHours, 5);
  // Ожидалось: вт+ср+чт+пт по 5 и суббота 0,33 и воскресенье 5 = 25,33.
  assert.equal(s.behindHours, 20.33);
});

/* ============================================================================
 * Целостность содержания карты. Ноль зависимостей — голый `node --test`:
 * корень репозитория обязан оставаться без npm, и эти тесты этого правила
 * не нарушают.
 *
 * Проверяется то, что реально ломается от правок контента: разъехавшиеся id,
 * часы темы, не сходящиеся с ресурсами, ссылка без даты проверки, дубликат
 * URL, уехавшая сумма срока. Роутер и вёрстка — отдельно, в jsdom.
 *
 * Запуск: node --test "test/**\/*.test.mjs"
 * ========================================================================== */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { buildUnits, streamTotals } from "../shared/schedule.mjs";

/** roadmap-data.js — классический скрипт: исполняем и забираем глобал. */
function loadRoadmap() {
  const path = fileURLToPath(new URL("../roadmap-data.js", import.meta.url));
  const scope = { window: {} };
  new Function("window", fs.readFileSync(path, "utf8"))(scope.window);
  return scope.window.ROADMAP;
}

const DATA = loadRoadmap();
const stages = DATA.stages;
const topics = stages.flatMap((s) => s.topics.map((t) => ({ ...t, stage: s })));
const resources = topics.flatMap((t) => (t.resources || []).map((r) => ({ ...r, topic: t })));

const COSTS = new Set(["free", "paid"]);
const LANGS = new Set(["en", "ru"]);
const LEVELS = new Set(["База", "Средний", "Продвинутый"]);
const KINDS = new Set(["theory", "practice", "project"]);

/* ------------------------------------------------------- идентификаторы --- */

test("идентификаторы этапов и тем уникальны", () => {
  const stageIds = stages.map((s) => s.id);
  assert.equal(new Set(stageIds).size, stageIds.length, "повторяется id этапа");

  const topicIds = topics.map((t) => t.id);
  const seen = new Set();
  const dupes = topicIds.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  assert.deepEqual(dupes, [], "повторяются id тем");

  const nums = stages.filter((s) => s.kind === "stage").map((s) => s.num);
  assert.deepEqual(nums, [...nums].sort((a, b) => Number(a) - Number(b)), "этапы идут не по порядку");
});

/* -------------------------------------------------------------- схема --- */

test("у каждого этапа есть поля, на которые опирается интерфейс", () => {
  for (const s of stages) {
    for (const field of ["id", "num", "kind", "title", "topics"]) {
      assert.ok(s[field] !== undefined, `${s.id}: нет поля ${field}`);
    }
    assert.ok(["stage", "track"].includes(s.kind), `${s.id}: kind = ${s.kind}`);
    assert.ok(Array.isArray(s.topics) && s.topics.length, `${s.id}: нет тем`);
    // Необязательность объявляется явно только у треков C, D, E.
    if (s.optional) assert.equal(s.kind, "track", `${s.id}: optional у этапа, а не у трека`);
  }
});

test("у каждой темы заполнены часы обоих профилей и допустимый вид", () => {
  const trackNames = new Set(Object.keys(DATA.meta.tracks));
  for (const t of topics) {
    assert.ok(t.title, `${t.id}: нет названия`);
    assert.ok(KINDS.has(t.kind), `${t.id}: kind = ${t.kind}`);
    assert.ok(trackNames.has(t.track), `${t.id}: неизвестный трек ${t.track}`);
    assert.ok(t.hours && Number.isFinite(t.hours.novice) && Number.isFinite(t.hours.dev),
      `${t.id}: часы не заданы для обоих профилей`);
    assert.ok(t.hours.novice > 0, `${t.id}: ноль часов новичку`);
    assert.ok(t.hours.dev <= t.hours.novice, `${t.id}: разработчику дольше, чем новичку`);
    assert.ok(t.task, `${t.id}: нет практического задания`);
  }
});

test("у каждого ресурса заполнены поля карточки", () => {
  for (const r of resources) {
    const where = `${r.topic.id} → «${r.title}»`;
    assert.ok(r.title, `${r.topic.id}: ресурс без названия`);
    assert.ok(COSTS.has(r.cost), `${where}: cost = ${r.cost}`);
    assert.ok(LANGS.has(r.lang), `${where}: lang = ${r.lang}`);
    assert.ok(LEVELS.has(r.level), `${where}: level = ${r.level}`);
    assert.ok(Number.isFinite(r.hours) && r.hours > 0, `${where}: часы = ${r.hours}`);
    assert.equal(typeof r.required, "boolean", `${where}: required не булев`);
  }
});

/* -------------------------------------------------------------- ссылки --- */

test("каждая ссылка — http(s) и несёт дату проверки", () => {
  // Карта доверия живёт полем checked: ссылка без даты не проверялась.
  //
  // Дата берётся ЛОКАЛЬНАЯ, а не через toISOString: тот отдаёт UTC, и в
  // часовом поясе восточнее Гринвича ссылка, проверенная сегодня ночью,
  // выглядела «из будущего». Ровно на этом тест и упал 03.09 в 01:04 UTC+6.
  const today = new Date().toLocaleDateString("sv");
  for (const r of resources) {
    const where = `${r.topic.id} → «${r.title}»`;
    assert.match(r.url, /^https?:\/\//, `${where}: подозрительный URL ${r.url}`);
    assert.match(r.checked || "", /^\d{4}-\d{2}-\d{2}$/, `${where}: нет даты checked`);
    assert.ok(r.checked <= today, `${where}: дата проверки из будущего (${r.checked})`);
  }
});

test("внутри одной темы ссылка не повторяется", () => {
  // Между темами повтор законен и намеренен: CS50P, scikit-learn MOOC и
  // StatQuest стоят в нескольких темах, потому что в каждой берётся своя
  // часть курса — поле scope говорит, какая именно. Ошибка — это повтор
  // ВНУТРИ темы: два одинаковых пункта в одной карточке.
  const norm = (url) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
  const dupes = [];
  for (const t of topics) {
    const seen = new Set();
    for (const r of t.resources || []) {
      const key = norm(r.url);
      if (seen.has(key)) dupes.push(`${t.id}: ${r.url} дважды`);
      seen.add(key);
    }
  }
  assert.deepEqual(dupes, [], "дубликаты ссылок внутри темы");
});

test("повтор ссылки между темами всегда объяснён полем scope", () => {
  // Раз повтор законен, он обязан объяснять себя: без scope читатель видит
  // одну и ту же ссылку дважды и не понимает, что от него хотят второй раз.
  const norm = (url) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
  const byUrl = new Map();
  for (const r of resources) {
    const key = norm(r.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(r);
  }
  const mute = [];
  for (const [, list] of byUrl) {
    if (list.length < 2) continue;
    for (const r of list) {
      if (!r.scope) mute.push(`${r.topic.id} → ${r.url}: повтор без scope`);
    }
  }
  assert.deepEqual(mute, [], "повторяющиеся ссылки без объяснения объёма");
});

/* ---------------------------------------------------------------- часы --- */

test("обязательные ресурсы темы не длиннее самой темы", () => {
  // Ровно одно исключение известно и учтено обрезкой в buildUnits. Второе
  // должно упасть здесь, а не тихо съесть часы плана.
  const over = [];
  for (const t of topics) {
    const required = (t.resources || []).filter((r) => r.required)
      .reduce((n, r) => n + r.hours, 0);
    if (required > t.hours.novice + 0.01) {
      over.push(`${t.id}: ресурсов на ${required} ч при теме в ${t.hours.novice} ч`);
    }
  }
  assert.ok(over.length <= 1, `тем с перебором ${over.length}:\n  ${over.join("\n  ")}`);
});

test("сроки основного пути не уехали", () => {
  // Пин: 41 углублённая ссылка, добавленная 02.09, помечена required: false
  // и обязательный путь удлинить не должна была.
  for (const [profile, expected] of [["novice", 1609], ["dev", 1246]]) {
    const total = Object.values(streamTotals(buildUnits(DATA, profile)))
      .reduce((a, b) => a + b, 0);
    assert.equal(Math.round(total), expected, `${profile}: ${Math.round(total)} ч вместо ${expected}`);
  }
});

test("параллельные треки дают ожидаемые объёмы", () => {
  const totals = streamTotals(buildUnits(DATA, "novice"));
  assert.equal(Math.round(totals.math), 277);
  assert.equal(Math.round(totals.english), 105);
  assert.equal(Math.round(totals.seq), 1227);
});

test("дополнительные треки в основной путь не входят", () => {
  const optional = stages.filter((s) => s.optional);
  assert.equal(optional.length, 3, "необязательных треков не три");

  const ids = new Set(buildUnits(DATA, "novice").map((u) => u.stageId));
  for (const s of optional) {
    assert.equal(ids.has(s.id), false, `${s.id} попал в основной путь`);
  }
});

/* ------------------------------------------------------------- мелочи --- */

test("метаданные на месте и согласованы", () => {
  assert.ok(DATA.meta.title && DATA.meta.subtitle && DATA.meta.lede);
  assert.match(DATA.meta.updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(DATA.meta.paces[DATA.meta.defaultPace ? "main" : "main"] !== undefined);
  assert.ok(["novice", "dev"].includes(DATA.meta.defaultProfile));

  const split = DATA.meta.split;
  assert.equal(split.theory + split.practice + split.projects, 100, "доли теории/практики/проектов не дают ста");
});

test("блок «Чем писать» заполнен и каждый инструмент объяснён", () => {
  const t = DATA.studyMethod.tools;
  assert.ok(t, "нет блока tools");
  assert.ok(t.title && t.intro, "нет заголовка или вступления");
  assert.equal(t.items.length, 3, "инструментов не три");
  for (const item of t.items) {
    assert.ok(item.what, "инструмент без названия");
    // Причина — смысл блока: список без объяснений превращается в чек-лист
    // покупок, а вопрос был «какая именно линейка и почему».
    assert.ok(item.why && item.why.length > 80, `${item.what}: причина слишком коротка`);
  }
  assert.match(t.items[1].what, /линейк/i, "второй пункт должен быть про линейку");
  assert.match(t.items[1].why, /прозрачн/i, "не сказано главное — прозрачность");
});

test("разделы, на которые ссылается интерфейс, существуют", () => {
  for (const key of ["about", "studyMethod", "throughline", "reviews", "destinations"]) {
    assert.ok(DATA[key], `нет раздела ${key}`);
  }
});

/* ------------------------------------------- русские ссылки Khan Academy --- */

/* Проверено вживую 03.09.2026: у русского Khan те же слаги, но переведены не
   все курсы. Эти четыре юнита русской версии не имеют вообще — русской ссылки
   у них быть не должно, и «починить» их нельзя. */
const KHAN_БЕЗ_РУССКОГО = new Set([
  "https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:logs",
  "https://www.khanacademy.org/math/linear-algebra/vectors-and-spaces",
  "https://www.khanacademy.org/math/linear-algebra/matrix-transformations",
  "https://www.khanacademy.org/math/multivariable-calculus/multivariable-derivatives"
]);

test("у каждого ресурса Khan есть русская ссылка, кроме непереведённых курсов", () => {
  const khan = resources.filter((r) => r.url.includes("khanacademy.org"));
  assert.equal(khan.length, 45, "число ресурсов Khan изменилось — пересними замер русских версий");

  for (const r of khan) {
    const ожидаем = !KHAN_БЕЗ_РУССКОГО.has(r.url);
    assert.equal(Boolean(r.ru), ожидаем,
      ожидаем ? `${r.title}: нет русской ссылки` : `${r.title}: русской версии нет, ссылку надо убрать`);
  }
  assert.equal(khan.filter((r) => r.ru).length, 41);
});

test("русская ссылка ведёт на ru.khanacademy.org и объясняет расхождение", () => {
  for (const r of resources.filter((x) => x.ru)) {
    assert.match(r.ru.url, /^https:\/\/ru\.khanacademy\.org\//, `${r.title}: чужой хост в русской ссылке`);
    if (r.ru.note !== undefined) {
      // Пометка есть только там, где русский модуль ШИРЕ английского юнита.
      // Без неё ссылка выглядит ошибочной: жмёшь «дроби целиком» вместо
      // «умножение дробей» и думаешь, что промахнулись адресом.
      assert.ok(r.ru.note.length > 30, `${r.title}: пометка слишком коротка, чтобы что-то объяснить`);
    }
  }
  const сПометкой = resources.filter((r) => r.ru && r.ru.note);
  assert.equal(сПометкой.length, 12, "число крупнее нарезанных русских модулей изменилось");
});

/* ------------------------------------------------- уровень английского --- */

test("уровни английского объявлены и значение по умолчанию среди них", () => {
  const levels = DATA.meta.englishLevels;
  assert.deepEqual(levels, ["a1", "a2", "b1", "b2", "c1"]);
  assert.ok(levels.includes(DATA.meta.defaultEnglishLevel));
});

test("ресурсы с byLevel закрывают все уровни и ведут на British Council", () => {
  const byLevel = resources.filter((r) => r.byLevel);
  assert.equal(byLevel.length, 3, "разбивку по уровням имеют ровно грамматика, лексика и слушание");

  for (const r of byLevel) {
    for (const level of DATA.meta.englishLevels) {
      const url = r.byLevel[level];
      assert.ok(url, `${r.title}: нет адреса для уровня ${level}`);
      assert.match(url, /^https:\/\/learnenglish\.britishcouncil\.org\//, `${r.title}: чужой хост на ${level}`);
    }
    // url по умолчанию обязан совпадать с уровнем по умолчанию, иначе карта и
    // планнер разойдутся: планнер берёт byLevel, а старые ссылки — url.
    assert.equal(r.url, r.byLevel[DATA.meta.defaultEnglishLevel],
      `${r.title}: url не совпадает с уровнем по умолчанию`);
  }
});

test("buildUnits подставляет адрес по уровню английского", () => {
  const b1 = buildUnits(DATA, "novice", "b1");
  const a1 = buildUnits(DATA, "novice", "a1");
  const listening = (list) => list.find((u) => u.title.includes("Listening"));

  assert.match(listening(b1).url, /\/listening\/b1$/);
  assert.match(listening(a1).url, /\/listening\/a1$/);
  // Без третьего аргумента — уровень по умолчанию из карты, а не пусто.
  assert.equal(listening(buildUnits(DATA, "novice")).url, listening(b1).url);
});

test("buildUnits проносит русскую ссылку в единицу плана", () => {
  const units = buildUnits(DATA, "novice");
  const сРусской = units.filter((u) => u.ru);
  assert.ok(сРусской.length > 0, "ни одна единица не получила русскую ссылку");
  for (const u of сРусской) {
    assert.match(u.ru.url, /^https:\/\/ru\.khanacademy\.org\//);
  }
});

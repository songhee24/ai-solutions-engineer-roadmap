/* ============================================================================
 * Свои темы — то, чего в карте нет. Главное, что здесь проверяется: они
 * переживают обновление карты. Ради этого они и хранятся отдельно.
 * ========================================================================== */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { buildUnits, planDays } from "../../shared/schedule.mjs";
import {
  doneHoursByUnit, groupProgress, remainingUnits, totalDoneHours, dropUnitFromLog
} from "../src/lib/progress.js";
import { buildMapLayout } from "../src/lib/map-layout.js";
import { customUnits, safeUrl, nextCustomId } from "../src/lib/custom.js";

function loadRoadmap() {
  const path = fileURLToPath(new URL("../../roadmap-data.js", import.meta.url));
  const scope = { window: {} };
  new Function("window", fs.readFileSync(path, "utf8"))(scope.window);
  return scope.window.ROADMAP;
}

const data = loadRoadmap();
const native = buildUnits(data, "novice");

const MINE = [
  { id: "custom::1", title: "Docker для локальной разработки", url: "https://docs.docker.com", stream: "seq", hours: 8 },
  { id: "custom::2", title: "Собеседование на английском", url: null, stream: "english", hours: 6 }
];

/* ------------------------------------------------------------- единицы --- */

test("своя тема превращается в единицу той же формы, что и родная", () => {
  const [u] = customUnits([MINE[0]]);
  for (const field of ["id", "stream", "hours", "title", "topicId", "topicTitle", "stageId", "stageNum", "kind"]) {
    assert.ok(field in u, `нет поля ${field}`);
  }
  assert.equal(u.id, "custom::1");
  assert.equal(u.stream, "seq");
  assert.equal(u.hours, 8);
  assert.equal(u.kind, "custom");
  assert.equal(u.track, null, "трека нет — на полосы «по направлениям» своя тема не влияет");
});

test("одна своя тема — ровно одна единица", () => {
  // Родная тема делится на ресурсы и «Задачу» потому, что смешивает материалы
  // и практику. Введённые руками 8 часов такого деления не требуют.
  assert.equal(customUnits(MINE).length, 2);
});

test("идентификаторы своих тем не могут столкнуться с родными", () => {
  const nativeIds = new Set(native.map((u) => u.id));
  for (const u of customUnits(MINE)) assert.equal(nativeIds.has(u.id), false);

  // Родные id имеют вид `<topicId>::r0` и `<topicId>::task`. Ни один topicId
  // в карте не содержит двоеточия и не начинается с "custom" — проверяем, что
  // это по-прежнему так, иначе пространство имён перестанет быть безопасным.
  for (const stage of data.stages) {
    for (const topic of stage.topics) {
      assert.doesNotMatch(topic.id, /:/, `id темы содержит двоеточие: ${topic.id}`);
      assert.doesNotMatch(topic.id, /^custom/, `id темы начинается с custom: ${topic.id}`);
    }
  }
});

test("следующий идентификатор не переиспользует уже занятый", () => {
  assert.equal(nextCustomId([]), "custom::1");
  assert.equal(nextCustomId(MINE), "custom::3");
  // Даже если тему из середины удалили, номер не должен повториться:
  // на старый id могут остаться записи в журнале.
  assert.equal(nextCustomId([{ id: "custom::7" }]), "custom::8");
  assert.equal(nextCustomId([{ id: "мусор" }]), "custom::1");
});

/* ---------------------------------------------------------- ссылки --- */

test("в план попадают только http и https", () => {
  assert.equal(safeUrl("https://docs.docker.com"), "https://docs.docker.com");
  assert.equal(safeUrl("http://example.org/x"), "http://example.org/x");
  assert.equal(safeUrl("  https://example.org  "), "https://example.org");
  // Ссылка рендерится в href на экране «Сегодня»: javascript: выполнился бы по клику.
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("JaVaScRiPt:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,<script>"), null);
  assert.equal(safeUrl(""), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl("не ссылка"), null);
});

/* ------------------------------------------------- наравне с родными --- */

test("своя тема встаёт ближайшей в своём потоке", () => {
  // Порядок задаётся склейкой в App.svelte: свои единицы идут ПЕРЕД родными.
  // В хвосте очереди своя тема всплыла бы через двести с лишним дней — то есть
  // никогда, и фича была бы бесполезной.
  const pool = [...customUnits(MINE), ...native];
  const [day] = planDays(pool, { hoursPerDay: 5, days: 1, startDate: new Date(2026, 8, 2) });

  const seq = day.blocks.find((b) => b.stream === "seq");
  const eng = day.blocks.find((b) => b.stream === "english");
  assert.equal(seq.items[0].unit.id, "custom::1", "своя тема не первая в основном потоке");
  assert.equal(eng.items[0].unit.id, "custom::2", "своя тема не первая в английском");
  assert.equal(pool.length, native.length + 2);

  // Родные при этом не выброшены — просто стоят следом.
  const seqNative = seq.items.some((i) => !i.unit.id.startsWith("custom::"));
  assert.ok(seqNative || seq.items[0].continues, "родные единицы пропали из плана");
});

test("остаток и срезы прогресса обходятся со своей темой как с любой другой", () => {
  const units = [...native, ...customUnits(MINE)];
  const log = { "2026-09-02": [{ unitId: "custom::1", hours: 3 }] };
  const done = doneHoursByUnit(log);

  const left = remainingUnits(units, done).find((u) => u.id === "custom::1");
  assert.equal(left.hours, 5, "осталось 5 из 8");
  assert.equal(left.fullHours, 8);

  const full = remainingUnits(units, { "custom::1": 8, "custom::2": 6 });
  assert.equal(full.some((u) => u.id.startsWith("custom")), false, "закрытые исчезли");

  const progress = groupProgress(units, done);
  assert.equal(progress.byTopic["custom::1"].doneH, 3);
  assert.equal(progress.byStage.custom.topics, 2, "свои темы собраны в свой псевдоэтап");
  assert.equal("custom" in progress.byTrack, false, "в направления своя тема не лезет");
});

/* --------------------------------------- главное обещание этой фичи --- */

test("своя тема и её журнал переживают обновление карты", () => {
  const log = { "2026-09-02": [{ unitId: "custom::1", hours: 3 }] };

  // Карта изменилась: этап выкинули, темы переименовали.
  const changed = { ...data, stages: data.stages.filter((s) => s.id !== "stage-4") };
  const after = [...buildUnits(changed, "novice"), ...customUnits(MINE)];

  const mine = after.find((u) => u.id === "custom::1");
  assert.ok(mine, "своя тема исчезла вместе с чужим этапом");
  assert.equal(mine.hours, 8);
  assert.equal(doneHoursByUnit(log)["custom::1"], 3, "запись в журнале потерялась");
  assert.ok(after.length < native.length + 2, "проверка бессмысленна: карта не изменилась");
});

test("карта знаний своих тем не замечает", () => {
  const units = [...native, ...customUnits(MINE)];
  const before = buildMapLayout(data, groupProgress(native, {}));
  const after = buildMapLayout(data, groupProgress(units, {}));

  assert.equal(after.nodes.length, before.nodes.length);
  assert.equal(after.rails.length, before.rails.length);
  assert.equal(after.optional.length, before.optional.length);
  assert.deepEqual(after.tracks.map((t) => t.id), before.tracks.map((t) => t.id));
});

/* ------------------------------------------------------- удаление --- */

test("удаление своей темы уносит её записи из журнала", () => {
  const log = {
    "2026-09-01": [{ unitId: "custom::1", hours: 3 }, { unitId: "s0-landscape::r0", hours: 2 }],
    "2026-09-02": [{ unitId: "custom::1", hours: 5 }]
  };
  const clean = dropUnitFromLog(log, "custom::1");

  assert.equal(totalDoneHours(clean), 2, "остались только чужие часы");
  assert.deepEqual(Object.keys(clean), ["2026-09-01"], "день без записей выброшен целиком");
  assert.equal(totalDoneHours(log), 10, "исходный журнал не тронут");
});

test("после удаления пройденное не превышает общий объём", () => {
  // Иначе осиротевшие часы дают процент пути больше ста.
  const units = [...native, ...customUnits(MINE)];
  const log = { "2026-09-02": [{ unitId: "custom::1", hours: 8 }] };

  const totalWith = units.reduce((n, u) => n + u.hours, 0);
  assert.ok(totalDoneHours(log) <= totalWith);

  const withoutUnit = native.reduce((n, u) => n + u.hours, 0);
  assert.ok(totalDoneHours(log) > 0);
  assert.ok(
    totalDoneHours(dropUnitFromLog(log, "custom::1")) <= withoutUnit,
    "часы удалённой темы остались висеть в журнале"
  );
});

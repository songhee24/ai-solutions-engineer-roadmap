/* ============================================================================
 * Тесты раскладки карты знаний. Проверяют то, что тест вообще может проверить:
 * состав, порядок и то, что ничто не вылезло за холст. Читаемость — вопрос
 * живой проверки в браузере, её тестом не закрыть.
 * ========================================================================== */

import { test } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { buildUnits } from "../../shared/schedule.mjs";
import { doneHoursByUnit, groupProgress } from "../src/lib/progress.js";
import { buildMapLayout, MAP_W, MAP_H } from "../src/lib/map-layout.js";

/** roadmap-data.js — классический скрипт: исполняем его и забираем глобал. */
function loadRoadmap() {
  const path = fileURLToPath(new URL("../../roadmap-data.js", import.meta.url));
  const scope = { window: {} };
  new Function("window", fs.readFileSync(path, "utf8"))(scope.window);
  return scope.window.ROADMAP;
}

const data = loadRoadmap();
const units = buildUnits(data, "novice");

function layoutWith(log = {}) {
  const done = doneHoursByUnit(log);
  return buildMapLayout(data, groupProgress(units, done));
}

test("на хребте все обязательные этапы, рельсов два, дополнительных треков три", () => {
  const map = layoutWith();
  assert.equal(map.nodes.length, data.stages.filter((s) => s.kind === "stage").length);
  assert.equal(map.nodes.length, 10);
  assert.equal(map.rails.length, 2);
  assert.equal(map.optional.length, 3);
  assert.equal(map.links.length, map.nodes.length - 1, "связей на одну меньше, чем узлов");
});

test("точки на рельсах — по одной на тему трека", () => {
  const map = layoutWith();
  const math = map.rails.find((r) => r.id === "track-math");
  const eng = map.rails.find((r) => r.id === "track-english");
  assert.equal(math.dots.length, 19);
  assert.equal(eng.dots.length, 6);
});

test("узлы идут слева направо и не вылезают за холст", () => {
  const map = layoutWith();
  for (let i = 1; i < map.nodes.length; i++) {
    assert.ok(map.nodes[i].cx > map.nodes[i - 1].cx, "порядок этапов сохранён");
  }
  for (const n of map.nodes) {
    assert.ok(n.cx - n.r >= 0 && n.cx + n.r <= MAP_W, `узел ${n.num} внутри холста по X`);
    assert.ok(n.cy - n.r >= 0 && n.cy + n.r <= MAP_H, `узел ${n.num} внутри холста по Y`);
  }
  for (const rail of map.rails) {
    assert.ok(rail.x >= 0 && rail.x + rail.w <= MAP_W);
    for (const d of rail.dots) assert.ok(d.cx > rail.x && d.cx < rail.x + rail.w);
  }
  for (const chip of map.optional) {
    assert.ok(chip.x + chip.w <= MAP_W, "чип дополнительного трека помещается");
    assert.ok(chip.y + chip.h <= MAP_H, "чип не срезан снизу");
  }
});

test("дополнительные треки показывают свой объём, хотя в план не входят", () => {
  // Их единицы buildUnits намеренно пропускает, поэтому в progress их нет —
  // часы должны браться прямо из карты, иначе на чипах стояло «0,0 ч».
  const map = layoutWith();
  for (const chip of map.optional) {
    assert.match(chip.label, /· \d+([.,]\d)? ч$/, chip.label);
    assert.doesNotMatch(chip.label, /· 0(,0)? ч$/, `${chip.label}: объём потерялся`);
  }
});

test("нетронутая карта: ничего не закрашено и текущий этап — самый первый", () => {
  const map = layoutWith();
  assert.equal(map.nodes.filter((n) => n.state === "done").length, 0);
  assert.equal(map.rails.every((r) => r.doneW === 0), true);
  assert.equal(map.here.num, "0", "метка «вы здесь» стоит на нулевом этапе");
  assert.equal(map.rails[0].labelStrong, "0 из 19 тем");
});

test("закрытая тема закрашивает свою точку, свой рельс и свою полосу", () => {
  const mathTopic = data.stages.find((s) => s.id === "track-math").topics[0];
  const log = {
    "2026-09-01": units
      .filter((u) => u.topicId === mathTopic.id)
      .map((u) => ({ unitId: u.id, hours: u.hours }))
  };
  const map = layoutWith(log);
  const math = map.rails.find((r) => r.id === "track-math");

  assert.equal(math.dots[0].done, true);
  assert.equal(math.dots[1].done, false);
  assert.ok(math.doneW > 0 && math.doneW < math.w, "рельс залит частично");
  assert.equal(math.labelStrong, "1 из 19 тем");

  const bar = map.tracks.find((t) => t.id === "math");
  assert.ok(bar.doneH > 0 && bar.doneH < bar.totalH);
});

test("метка «вы здесь» переезжает на первый незакрытый этап", () => {
  const stage0 = data.stages.find((s) => s.id === "stage-0");
  const log = {
    "2026-09-01": units
      .filter((u) => u.stageId === stage0.id)
      .map((u) => ({ unitId: u.id, hours: u.hours }))
  };
  const map = layoutWith(log);
  assert.equal(map.nodes[0].state, "done");
  assert.equal(map.here.num, "1");
  assert.equal(map.nodes[1].state, "current");
});

test("подпись этапа переносится не больше чем на две строки", () => {
  const map = layoutWith();
  for (const n of map.nodes) {
    assert.ok(n.lines.length >= 1 && n.lines.length <= 2, `${n.title}: ${n.lines.length} строк`);
  }
});

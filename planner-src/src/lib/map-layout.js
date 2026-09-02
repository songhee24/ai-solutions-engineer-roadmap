/* ============================================================================
 * map-layout.js — геометрия «Карты знаний». Чистая функция: на вход карта и
 * срез прогресса, на выход готовые координаты. В компоненте остаётся только
 * разметка, поэтому раскладку можно проверить тестом, а не глазами.
 *
 * Числа взяты из утверждённого макета design/planner.html один в один, чтобы
 * живая карта выглядела так же, как то, что было выбрано.
 * ========================================================================== */

import { hoursNum, plural } from "./format.js";

export const MAP_W = 1240;
export const MAP_H = 586;

const RAIL = { x: 36, w: 1168, h: 46, rx: 23, pad: 38 };
const MATH_Y = 64;
const ENG_Y = 421;

const SPINE_Y = 268;
const NODE_R = 26;
const NODE_X0 = 64;
const NODE_X1 = 1176;
const NODE_CIRC = 2 * Math.PI * NODE_R;

const OPT = { x: 48, y: 528, w: 258, h: 38, gap: 20 };

/** «Трек A. Математика с полного нуля» → «Математика с полного нуля». */
function stripTrackPrefix(title) {
  return title.replace(/^Трек\s+[A-ZА-Я]\.\s*/, "");
}

/**
 * Подпись этапа в две строки. Третьей строки нет: под узлами ровно два
 * интервала, и текст, который в них не влез, обрывается многоточием.
 */
export function wrapTwoLines(text, max = 16) {
  const words = String(text).split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const line = lines.length - 1;
    const candidate = lines[line] ? `${lines[line]} ${word}` : word;
    if (candidate.length <= max) {
      lines[line] = candidate;
    } else if (line === 0) {
      lines.push(word);
    } else {
      lines[1] = `${lines[1]}…`;
      return lines;
    }
  }
  return lines.filter(Boolean);
}

/** Равномерно N точек между краями отрезка. Одна точка садится в центр. */
function spread(x0, x1, n) {
  if (n <= 1) return [(x0 + x1) / 2];
  const step = (x1 - x0) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(x0 + i * step));
}

function railFor(stage, y, progress, kind) {
  const topics = stage.topics;
  const xs = spread(RAIL.x + RAIL.pad, RAIL.x + RAIL.w - RAIL.pad, topics.length);
  const stat = progress.byStage[stage.id] || { doneH: 0, totalH: 0, topics: topics.length, topicsDone: 0 };
  const frac = stat.totalH > 0 ? stat.doneH / stat.totalH : 0;

  return {
    id: stage.id,
    kind,
    x: RAIL.x,
    y,
    w: RAIL.w,
    h: RAIL.h,
    rx: RAIL.rx,
    // Залито ровно на долю пройденных часов — иначе россыпь одинаковых точек
    // читалась как «всё сделано».
    doneW: Math.round(frac * RAIL.w),
    clipId: `clip-${stage.id}`,
    labelX: RAIL.x + 12,
    labelY: kind === "math" ? y - 12 : y + RAIL.h + 20,
    label: `Трек ${stage.num} · ${stripTrackPrefix(stage.title)}`,
    labelStrong: `${stat.topicsDone} из ${stat.topics} ${plural(stat.topics, "темы", "тем", "тем")}`,
    labelTail: `${hoursNum(stat.doneH)} из ${hoursNum(stat.totalH)} ч`,
    dots: topics.map((topic, i) => {
      const t = progress.byTopic[topic.id];
      const done = Boolean(t && t.done);
      return {
        id: topic.id,
        cx: xs[i],
        cy: y + RAIL.h / 2,
        // Пройденное крупнее и ярче непройденного — намеренная асимметрия.
        r: done ? 7 : 5,
        done,
        title: `${topic.title} — ${t ? hoursNum(t.totalH) : 0} ч`
      };
    })
  };
}

/**
 * @param {object} data      window.ROADMAP
 * @param {object} progress  результат groupProgress
 * @param {string} profile   нужен только для дополнительных треков: они не
 *                           входят в план, поэтому в progress их часов нет
 */
export function buildMapLayout(data, progress, profile = "novice") {
  const stages = data.stages.filter((s) => s.kind === "stage");
  const xs = spread(NODE_X0, NODE_X1, stages.length);

  const nodes = stages.map((stage, i) => {
    const stat = progress.byStage[stage.id] || { doneH: 0, totalH: 0, topics: stage.topics.length, topicsDone: 0 };
    const frac = stat.totalH > 0 ? stat.doneH / stat.totalH : 0;
    const done = stat.topics > 0 && stat.topicsDone === stat.topics;
    // Подписи чередуются сверху и снизу: в один ряд они налезали друг на друга.
    const below = i % 2 === 1;
    const base = SPINE_Y + (below ? 94 : 46);

    return {
      id: stage.id,
      num: stage.num,
      title: stage.title,
      cx: xs[i],
      cy: SPINE_Y,
      r: NODE_R,
      frac,
      dash: `${(frac * NODE_CIRC).toFixed(1)} ${NODE_CIRC.toFixed(1)}`,
      done,
      state: done ? "done" : "todo",
      lines: wrapTwoLines(stage.title),
      lineY: [base, base + 14],
      subY: base + 30,
      // Нетронутый этап показывает объём, начатый — сколько уже закрыто.
      sub: stat.doneH > 0 || done
        ? `${stat.topicsDone} из ${stat.topics} ${plural(stat.topics, "темы", "тем", "тем")}`
        : `${stat.topics} ${plural(stat.topics, "тема", "темы", "тем")} · ${hoursNum(stat.totalH)} ч`,
      hint: `${stage.title} — ${stat.topicsDone} из ${stat.topics}, ${hoursNum(stat.totalH)} ч`
    };
  });

  // Текущий — первый незакрытый. Если закрыто всё, метки «вы здесь» нет.
  const current = nodes.find((n) => !n.done) || null;
  if (current) current.state = "current";

  const links = nodes.slice(1).map((n, i) => ({
    x1: nodes[i].cx + NODE_R + 4,
    y1: SPINE_Y,
    x2: n.cx - NODE_R - 4,
    y2: SPINE_Y,
    done: nodes[i].done
  }));

  const mathStage = data.stages.find((s) => s.id === "track-math");
  const engStage = data.stages.find((s) => s.id === "track-english");
  const rails = [
    railFor(mathStage, MATH_Y, progress, "math"),
    railFor(engStage, ENG_Y, progress, "eng")
  ];

  const optional = data.stages.filter((s) => s.optional).map((stage, i) => {
    const hours = stage.topics.reduce((sum, t) => sum + ((t.hours && t.hours[profile]) || 0), 0);
    return {
      id: stage.id,
      x: OPT.x + i * (OPT.w + OPT.gap),
      y: OPT.y,
      w: OPT.w,
      h: OPT.h,
      label: `${stripTrackPrefix(stage.title)} · ${hoursNum(hours)} ч`
    };
  });

  const tracks = Object.values(progress.byTrack)
    .map((t) => ({
      id: t.id,
      title: data.meta.tracks[t.id] || t.id,
      doneH: t.doneH,
      totalH: t.totalH,
      percent: t.totalH > 0 ? Math.round((t.doneH / t.totalH) * 100) : 0
    }))
    .sort((a, b) => b.percent - a.percent || b.totalH - a.totalH);

  return {
    width: MAP_W,
    height: MAP_H,
    nodes,
    links,
    rails,
    optional,
    tracks,
    optionalLabel: { x: OPT.x, y: OPT.y - 18, text: "Дополнительные треки — вне общего срока, берутся по выбору" },
    here: current ? { num: current.num, x: current.cx, y: SPINE_Y - 42 } : null
  };
}

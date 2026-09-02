/* ============================================================================
 * store.svelte.js — состояние планнера и его сохранение.
 *
 * Ключ свой, отдельный от карты (`asr:v1`): очистка прогресса на карте не
 * должна стирать журнал занятий, и наоборот.
 *
 * Хранится ЖУРНАЛ, а не календарь: что и когда закрыто. План на день из этого
 * выводится каждый раз заново — см. lib/progress.js.
 * ========================================================================== */

import { round2, dropUnitFromLog } from "./progress.js";
import { nextCustomId, safeUrl } from "./custom.js";

const KEY = "asr:planner:v1";

const DEFAULTS = {
  v: 1,
  /** null, пока человек не отметил, когда начал. Хардкодить дату нельзя:
   *  каждый начинает в свой день. */
  startDate: null,
  hoursPerDay: 5,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  profile: "novice",
  /** iso -> [{ unitId, hours }] — единственный источник правды о прогрессе. */
  log: {},
  /** iso -> часы на этот день. Ноль означает выходной, поэтому отдельного
   *  списка выходных нет: одно понятие вместо двух. */
  dayHours: {},
  /** iso -> [unitId] — отложенное на сегодня. Завтра всплывёт снова. */
  skipped: {},
  /** Именованные раскладки дня: [{ id, title, hours: { seq, math, english } }].
   *  Часы АБСОЛЮТНЫЕ, а не доли: «суббота — только английский, 20 минут»
   *  долями не выразить, пришлось бы заводить рядом ещё и норму дня. */
  templates: [],
  /** День недели (0..6) -> id шаблона. Это настройка недели, а не календарь:
   *  назначения на конкретные даты нет и не будет — она бы вернула ту самую
   *  календарную сущность, которой в этой архитектуре быть не должно. */
  weekdayTemplate: {},
  /** Свои темы: [{ id: "custom::1", title, url|null, stream, hours }].
   *  Живут здесь, а не в roadmap-data.js, поэтому обновление карты их не
   *  задевает — ради этого фича и существует. */
  custom: [],
  screen: "today"
};

const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Разбор с терпимостью к чужому и битому: испорченный ключ не должен
 *  оставлять человека с белым экраном вместо плана. */
function sanitizeLog(raw) {
  const out = {};
  for (const iso of Object.keys(raw)) {
    if (!isIso(iso) || !Array.isArray(raw[iso])) continue;
    const day = raw[iso]
      .filter((e) => e && typeof e.unitId === "string" && Number.isFinite(e.hours))
      .map((e) => ({ unitId: e.unitId, hours: round2(Math.max(0, e.hours)) }));
    if (day.length) out[iso] = day;
  }
  return out;
}

function sanitizeDayHours(raw) {
  const out = {};
  for (const iso of Object.keys(raw)) {
    if (isIso(iso) && Number.isFinite(raw[iso])) out[iso] = clamp(raw[iso], 0, 16);
  }
  return out;
}

/** Ссылка проверяется схемой на входе И на выходе: сохранённый `javascript:`
 *  выполнился бы по клику из href на экране «Сегодня». */
function sanitizeCustom(raw) {
  const out = [];
  for (const item of raw) {
    if (!item || typeof item.id !== "string" || !/^custom::\d+$/.test(item.id)) continue;
    if (typeof item.title !== "string" || !item.title.trim()) continue;
    if (!Number.isFinite(item.hours) || item.hours <= 0) continue;
    if (out.some((x) => x.id === item.id)) continue;
    out.push({
      id: item.id,
      title: item.title.trim().slice(0, 200),
      url: safeUrl(item.url),
      stream: item.stream === "math" || item.stream === "english" ? item.stream : "seq",
      hours: clamp(round2(item.hours), 0.25, 500)
    });
  }
  return out;
}

function sanitizeTemplates(raw) {
  const out = [];
  for (const item of raw) {
    if (!item || typeof item.id !== "string" || !/^tpl-\d+$/.test(item.id)) continue;
    if (typeof item.title !== "string" || !item.title.trim()) continue;
    if (!item.hours || typeof item.hours !== "object") continue;
    if (out.some((x) => x.id === item.id)) continue;

    const hours = {};
    for (const stream of ["seq", "math", "english"]) {
      const value = Number(item.hours[stream]);
      hours[stream] = Number.isFinite(value) ? clamp(round2(value), 0, 16) : 0;
    }
    // Шаблон из одних нулей — это выходной, а он выражается снятой галочкой
    // дня недели. Двух способов сказать одно и то же быть не должно.
    if (hours.seq + hours.math + hours.english <= 0) continue;
    out.push({ id: item.id, title: item.title.trim().slice(0, 60), hours });
  }
  return out;
}

/** Назначения на несуществующие шаблоны отбрасываются при загрузке. */
function sanitizeWeekdayTemplate(raw, templates) {
  const known = new Set(templates.map((t) => t.id));
  const out = {};
  for (const key of Object.keys(raw)) {
    if (!/^[0-6]$/.test(key)) continue;
    if (known.has(raw[key])) out[key] = raw[key];
  }
  return out;
}

function sanitizeSkipped(raw) {
  const out = {};
  for (const iso of Object.keys(raw)) {
    if (!isIso(iso) || !Array.isArray(raw[iso])) continue;
    const ids = raw[iso].filter((id) => typeof id === "string");
    if (ids.length) out[iso] = ids;
  }
  return out;
}

function load() {
  const base = structuredClone(DEFAULTS);
  let saved;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    saved = JSON.parse(raw);
  } catch (err) {
    console.warn("Планнер: не удалось прочитать сохранённое состояние, начинаем с чистого", err);
    return base;
  }
  if (!saved || typeof saved !== "object") return base;

  if (isIso(saved.startDate)) base.startDate = saved.startDate;
  if (Number.isFinite(saved.hoursPerDay)) base.hoursPerDay = clamp(saved.hoursPerDay, 0.5, 16);
  if (saved.profile === "dev" || saved.profile === "novice") base.profile = saved.profile;
  if (typeof saved.screen === "string") base.screen = saved.screen;

  if (Array.isArray(saved.weekdays)) {
    const wd = [...new Set(saved.weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
    if (wd.length) base.weekdays = wd.sort();
  }
  if (saved.log && typeof saved.log === "object") base.log = sanitizeLog(saved.log);
  if (saved.dayHours && typeof saved.dayHours === "object") base.dayHours = sanitizeDayHours(saved.dayHours);
  if (saved.skipped && typeof saved.skipped === "object") base.skipped = sanitizeSkipped(saved.skipped);
  if (Array.isArray(saved.custom)) base.custom = sanitizeCustom(saved.custom);
  if (Array.isArray(saved.templates)) base.templates = sanitizeTemplates(saved.templates);
  if (saved.weekdayTemplate && typeof saved.weekdayTemplate === "object") {
    base.weekdayTemplate = sanitizeWeekdayTemplate(saved.weekdayTemplate, base.templates);
  }

  return base;
}

export const planner = $state(load());

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(planner));
  } catch (err) {
    // Приватный режим и переполненное хранилище — не повод ронять экран.
    console.warn("Планнер: не удалось сохранить состояние", err);
  }
}

/* --------------------------------------------------------------- настройки --- */

export function setStart(iso) {
  planner.startDate = iso;
  persist();
}

export function setHoursPerDay(hours) {
  planner.hoursPerDay = clamp(Number(hours) || 5, 0.5, 16);
  persist();
}

export function setWeekdays(list) {
  planner.weekdays = [...list].sort();
  persist();
}

export function setProfile(profile) {
  planner.profile = profile === "dev" ? "dev" : "novice";
  persist();
}

export function setScreen(screen) {
  planner.screen = screen;
  persist();
}

/* ----------------------------------------------------------------- журнал --- */

export function isLogged(iso, unitId) {
  return (planner.log[iso] || []).some((e) => e.unitId === unitId);
}

/* Записи дня заменяются новым массивом, а не правятся на месте.
   `const day = planner.log[iso] ||= []` выглядит короче, но кладёт в day СЫРОЙ
   массив, а не его реактивную обёртку: push в него уходил в пустоту — галочка
   загоралась, а журнал оставался пустым. Заодно это ровно то, чего требует
   правило неизменяемости. */
export function logUnit(iso, unitId, hours) {
  const day = planner.log[iso] ?? [];
  const entry = { unitId, hours: round2(Math.max(0, hours)) };
  const at = day.findIndex((e) => e.unitId === unitId);
  planner.log[iso] = at >= 0
    ? day.map((e, i) => (i === at ? entry : e))
    : [...day, entry];
  persist();
}

export function unlogUnit(iso, unitId) {
  const day = planner.log[iso];
  if (!day) return;
  const rest = day.filter((e) => e.unitId !== unitId);
  if (rest.length) planner.log[iso] = rest;
  else delete planner.log[iso];
  persist();
}

/* ----------------------------------------------------------------- дни --- */

/** hours === null снимает ручное переопределение и возвращает день расписанию. */
export function setDayHours(iso, hours) {
  if (hours === null) delete planner.dayHours[iso];
  else planner.dayHours[iso] = clamp(Number(hours) || 0, 0, 16);
  persist();
}

export function skipUnit(iso, unitId) {
  const day = planner.skipped[iso] ?? [];
  if (day.includes(unitId)) return;
  planner.skipped[iso] = [...day, unitId];
  persist();
}

export function unskipAll(iso) {
  delete planner.skipped[iso];
  persist();
}

/* ------------------------------------------------------------ шаблоны дня --- */

function nextTemplateId(list) {
  let max = 0;
  for (const t of list) {
    const match = /^tpl-(\d+)$/.exec(t.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `tpl-${max + 1}`;
}

export function addTemplate({ title, hours }) {
  const clean = String(title || "").trim();
  if (!clean) return null;

  const split = {};
  for (const stream of ["seq", "math", "english"]) {
    const value = Number((hours || {})[stream]);
    split[stream] = Number.isFinite(value) ? clamp(round2(value), 0, 16) : 0;
  }
  if (split.seq + split.math + split.english <= 0) return null;

  const tpl = { id: nextTemplateId(planner.templates), title: clean.slice(0, 60), hours: split };
  planner.templates = [...planner.templates, tpl];
  persist();
  return tpl;
}

export function updateTemplate(id, patch) {
  planner.templates = planner.templates.map((t) => {
    if (t.id !== id) return t;
    const hours = { ...t.hours };
    for (const stream of ["seq", "math", "english"]) {
      if (patch.hours && patch.hours[stream] !== undefined) {
        const value = Number(patch.hours[stream]);
        hours[stream] = Number.isFinite(value) ? clamp(round2(value), 0, 16) : hours[stream];
      }
    }
    // Совсем обнулить шаблон нельзя: пустой день — это снятая галочка дня недели.
    if (hours.seq + hours.math + hours.english <= 0) return t;
    return {
      ...t,
      title: patch.title !== undefined ? String(patch.title).trim().slice(0, 60) || t.title : t.title,
      hours
    };
  });
  persist();
}

/** Вместе с шаблоном снимаются и его назначения: висячий id иначе молча
 *  откатывал бы день к обычному бюджету, и человек не понял бы почему. */
export function removeTemplate(id) {
  planner.templates = planner.templates.filter((t) => t.id !== id);
  const left = {};
  for (const key of Object.keys(planner.weekdayTemplate)) {
    if (planner.weekdayTemplate[key] !== id) left[key] = planner.weekdayTemplate[key];
  }
  planner.weekdayTemplate = left;
  persist();
}

/** id === null снимает шаблон с дня недели и возвращает его обычному бюджету. */
export function assignTemplate(weekday, id) {
  const key = String(weekday);
  const next = { ...planner.weekdayTemplate };
  if (id) next[key] = id;
  else delete next[key];
  planner.weekdayTemplate = next;
  persist();
}

/* -------------------------------------------------------------- свои темы --- */

export function addCustomTopic({ title, url, stream, hours }) {
  const clean = String(title || "").trim();
  const value = Number(hours);
  if (!clean || !Number.isFinite(value) || value <= 0) return null;

  const topic = {
    id: nextCustomId(planner.custom),
    title: clean.slice(0, 200),
    url: safeUrl(url),
    stream: stream === "math" || stream === "english" ? stream : "seq",
    hours: clamp(round2(value), 0.25, 500)
  };
  planner.custom = [...planner.custom, topic];
  persist();
  return topic;
}

/** id сохраняется: на него ссылаются записи журнала. */
export function updateCustomTopic(id, patch) {
  planner.custom = planner.custom.map((t) => {
    if (t.id !== id) return t;
    const hours = Number(patch.hours);
    return {
      ...t,
      title: patch.title !== undefined ? String(patch.title).trim().slice(0, 200) || t.title : t.title,
      url: patch.url !== undefined ? safeUrl(patch.url) : t.url,
      stream: patch.stream !== undefined
        ? (patch.stream === "math" || patch.stream === "english" ? patch.stream : "seq")
        : t.stream,
      hours: Number.isFinite(hours) && hours > 0 ? clamp(round2(hours), 0.25, 500) : t.hours
    };
  });
  persist();
}

/** Записи журнала уносятся вместе с темой: осиротевшие часы иначе продолжают
 *  считаться пройденными, и доля пути уезжает выше ста процентов. */
export function removeCustomTopic(id) {
  planner.custom = planner.custom.filter((t) => t.id !== id);
  planner.log = dropUnitFromLog(planner.log, id);
  for (const iso of Object.keys(planner.skipped)) {
    const rest = planner.skipped[iso].filter((unitId) => unitId !== id);
    if (rest.length) planner.skipped[iso] = rest;
    else delete planner.skipped[iso];
  }
  persist();
}

/* ------------------------------------------------------------ обслуживание --- */

export function exportState() {
  return JSON.stringify(planner, null, 2);
}

export function importState(json) {
  const parsed = JSON.parse(json);
  localStorage.setItem(KEY, JSON.stringify(parsed));
  // Перечитываем через тот же разбор с терпимостью, что и при запуске.
  Object.assign(planner, load());
  persist();
}

export function resetAll() {
  Object.assign(planner, structuredClone(DEFAULTS));
  persist();
}

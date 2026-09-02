/* ============================================================================
 * store.svelte.js — состояние планнера и его сохранение.
 *
 * Ключ свой, отдельный от карты (`asr:v1`): очистка прогресса на карте не
 * должна стирать журнал занятий, и наоборот.
 *
 * Хранится ЖУРНАЛ, а не календарь: что и когда закрыто. План на день из этого
 * выводится каждый раз заново — см. lib/progress.js.
 * ========================================================================== */

import { round2 } from "./progress.js";

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

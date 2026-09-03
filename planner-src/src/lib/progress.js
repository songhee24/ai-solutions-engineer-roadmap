/* ============================================================================
 * progress.js — ядро прогресса. Чистые функции без DOM и без localStorage:
 * состояние передаётся аргументом, чтобы всё это можно было прогнать в Node.
 *
 * Главное архитектурное решение, из которого следует всё остальное:
 * КАЛЕНДАРЬ НЕ ХРАНИТСЯ. Хранится только журнал — что и когда было закрыто.
 * План на сегодня каждый раз выводится заново из того, что ещё не пройдено.
 *
 * Отсюда бесплатно получается поведение, которое просил пользователь:
 * пропущенный день ничего не теряет — непройденные часы просто остаются в
 * остатке и всплывают завтра, а дата финиша сдвигается ровно на день.
 * Ничего «сгорать» не может, потому что гореть нечему.
 * ========================================================================== */

import { planDays } from "../../../shared/schedule.mjs";

export const round2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ даты --- */

/** Локальная дата в YYYY-MM-DD. Через UTC делать нельзя — уедет граница суток. */
export function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD в локальную полночь. */
export function fromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Сдвиг на n дней. Через Date.setDate, а не через сложение миллисекунд:
 *  в сутки перевода часов миллисекунд не 86 400 000. */
export function addDays(iso, n) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** Разница в днях, b − a. Считается в UTC — там перевода часов не бывает. */
export function diffDays(a, b) {
  const ms = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / 86400000);
}

export function todayIso() {
  return toIso(new Date());
}

/* --------------------------------------------------------------- бюджет --- */

export const STREAM_IDS = ["seq", "math", "english"];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

/** Шаблон, назначенный на день недели, либо null. Висячий идентификатор
 *  (шаблон удалили, назначение осталось) молча откатывается к обычному дню. */
export function templateForWeekday(planner, weekday) {
  const id = (planner.weekdayTemplate || {})[String(weekday)];
  if (!id) return null;
  return (planner.templates || []).find((t) => t.id === id) || null;
}

export function templateForDay(planner, iso) {
  return templateForWeekday(planner, fromIso(iso).getDay());
}

export function templateHours(tpl) {
  const h = tpl.hours || {};
  return round2((h.seq || 0) + (h.math || 0) + (h.english || 0));
}

/**
 * Сколько часов запланировано на конкретный день.
 * Ручное переопределение сильнее расписания недели, а ноль — это выходной,
 * поэтому отдельного списка выходных нет: одно понятие вместо двух.
 *
 * Порядок сверху вниз: ручной час на дату → день вне расписания недели →
 * шаблон дня недели → обычный бюджет. Сигнатура намеренно не изменилась:
 * на ней стоят пропуски, серия, отставание и теплокарта, и шаблоны достаются
 * им бесплатно.
 */
export function budgetForDay(planner, iso) {
  if (hasOwn(planner.dayHours, iso)) return planner.dayHours[iso];

  const weekdays = planner.weekdays || [0, 1, 2, 3, 4, 5, 6];
  if (!weekdays.includes(fromIso(iso).getDay())) return 0;

  const tpl = templateForDay(planner, iso);
  return tpl ? templateHours(tpl) : planner.hoursPerDay;
}

/**
 * Раскладка дня по потокам. Шаблон задаёт её прямо; без шаблона часы делятся
 * пропорционально ещё не пройденному — ровно то, что делает dailyBudget,
 * чтобы все три потока закончились одновременно.
 */
function budgetByStream(planner, iso, left) {
  const zero = { seq: 0, math: 0, english: 0 };
  const budget = budgetForDay(planner, iso);
  if (budget <= 0) return zero;

  // Ручной час на конкретный день сбрасывает шаблон: одно простое правило
  // вместо масштабирования чужой раскладки под другую сумму.
  const tpl = hasOwn(planner.dayHours, iso) ? null : templateForDay(planner, iso);
  if (tpl) {
    return { seq: tpl.hours.seq || 0, math: tpl.hours.math || 0, english: tpl.hours.english || 0 };
  }

  const total = left.seq + left.math + left.english;
  if (total <= 0) return zero;
  return {
    seq: budget * (left.seq / total),
    math: budget * (left.math / total),
    english: budget * (left.english / total)
  };
}

/** Потоки, которым при нынешних шаблонах не достаётся часов ни в один день
 *  недели. Их остаток не убывает никогда, и прогноз без предупреждения
 *  упёрся бы в сторож. Хотя бы один день без шаблона кормит все потоки. */
export function unplannedStreams(planner) {
  const totals = { seq: 0, math: 0, english: 0 };
  for (const weekday of planner.weekdays || []) {
    const tpl = templateForWeekday(planner, weekday);
    if (!tpl) return [];
    for (const id of STREAM_IDS) totals[id] += tpl.hours[id] || 0;
  }
  return STREAM_IDS.filter((id) => totals[id] <= 0);
}

/** Рабочие дни от from до to включительно — те, на которые есть часы. */
export function scheduledDays(planner, fromIsoDate, toIsoDate) {
  const out = [];
  for (let iso = fromIsoDate; diffDays(iso, toIsoDate) >= 0; iso = addDays(iso, 1)) {
    if (budgetForDay(planner, iso) > 0) out.push(iso);
  }
  return out;
}

/* --------------------------------------------------------------- журнал --- */

/** Сколько часов закрыто по каждой единице — сумма по всем дням журнала. */
export function doneHoursByUnit(log) {
  const acc = {};
  for (const iso of Object.keys(log || {})) {
    for (const entry of log[iso]) {
      acc[entry.unitId] = round2((acc[entry.unitId] || 0) + entry.hours);
    }
  }
  return acc;
}

/** Журнал, обрезанный по дате: только дни СТРОГО раньше iso. */
export function logBefore(log, iso) {
  const out = {};
  for (const key of Object.keys(log || {})) {
    if (diffDays(key, iso) > 0) out[key] = log[key];
  }
  return out;
}

/**
 * Что стояло в плане на КОНКРЕТНЫЙ день — включая уже прошедший.
 *
 * План нигде не хранится: планнер держит журнал, а день выводит из остатка.
 * Значит прошлый день можно только пересчитать заново — обрезать журнал по дате
 * и прогнать ту же машинку. Отсюда и оговорка в интерфейсе: поменяются часы в
 * день, выходные или профиль — пересчитается и прошлое.
 *
 * Это НЕ то же самое, что план на экране «Сегодня». Тот дополнительно держит
 * сегодняшний журнал за скобками (чтобы отмеченная строка не исчезала под
 * курсором) и учитывает отложенное кнопкой «Не сегодня». Здесь вопрос другой:
 * что стояло в расписании на эту дату.
 */
export function plannedOnDay(units, planner, iso) {
  const budget = budgetForDay(planner, iso);
  if (budget <= 0) return [];

  const pool = remainingUnits(units, doneHoursByUnit(logBefore(planner.log, iso)));
  if (!pool.length) return [];

  const tpl = Object.prototype.hasOwnProperty.call(planner.dayHours || {}, iso)
    ? null
    : templateForDay(planner, iso);

  const day = planDays(pool, {
    hoursPerDay: budget,
    days: 1,
    startDate: fromIso(iso),
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    perDay: tpl ? tpl.hours : undefined
  })[0];

  return day ? day.blocks.flatMap((b) => b.items) : [];
}

/** Ближайший рабочий день после iso. Предел — чтобы не искать вечно. */
export function nextScheduledDay(planner, iso, limit = 60) {
  for (let i = 1; i <= limit; i++) {
    const next = addDays(iso, i);
    if (budgetForDay(planner, next) > 0) return next;
  }
  return null;
}

/**
 * Что стояло в плане на этот день, но закрыто не было, — то есть уехало дальше.
 * Частично закрытая тема попадает сюда с остатком, а не целиком.
 */
export function movedFromDay(units, planner, iso) {
  const closed = {};
  for (const entry of (planner.log || {})[iso] || []) {
    closed[entry.unitId] = round2((closed[entry.unitId] || 0) + entry.hours);
  }

  const out = [];
  for (const item of plannedOnDay(units, planner, iso)) {
    const done = closed[item.unit.id] || 0;
    const moved = round2(item.hours - done);
    if (moved > 0.01) out.push({ unit: item.unit, planned: item.hours, done, moved });
  }
  return out;
}

/**
 * Единицы, стоявшие в плане РАНЬШЕ и до сих пор не закрытые:
 * { unitId: самый ранний такой день }. Для подписи «перенесено с 3 сентября».
 *
 * Заглядываем не дальше CARRY_LOOKBACK рабочих дней: за этой границей разговор
 * уже не про вчерашний хвост, а про отставание, и для него есть своя карточка.
 */
const CARRY_LOOKBACK = 7;

export function carriedFrom(units, planner, today) {
  const out = {};
  if (!planner.startDate || diffDays(planner.startDate, today) <= 0) return out;

  const days = scheduledDays(planner, planner.startDate, addDays(today, -1)).slice(-CARRY_LOOKBACK);
  for (const iso of days) {
    for (const item of plannedOnDay(units, planner, iso)) {
      if (out[item.unit.id] === undefined) out[item.unit.id] = iso;
    }
  }
  return out;
}

/**
 * Состав одного дня: что именно закрыто и на сколько часов, в порядке журнала.
 *
 * Единицы в журнале живут вечно, а карта меняется — своя тема удалена,
 * обновление карты убрало юнит. Такую запись НЕЛЬЗЯ выбросить молча: её часы
 * продолжают считаться в итогах, и день перестал бы сходиться сам с собой.
 * Поэтому она возвращается с `unit: null`, а называет её интерфейс.
 *
 * @returns {Array<{ unit: object|null, unitId: string, hours: number }>}
 */
export function dayLog(units, log, iso) {
  const day = (log || {})[iso];
  if (!day) return [];
  const byId = new Map((units || []).map((u) => [u.id, u]));
  return day.map((entry) => ({
    unit: byId.get(entry.unitId) || null,
    unitId: entry.unitId,
    hours: entry.hours
  }));
}

/**
 * Самый первый день, в который единицу трогали: { unitId: iso }.
 * Нужен подписи «тянется с 3 сентября» — doneHoursByUnit даты схлопывает.
 *
 * Ключи сортируются, а не берутся как есть: порядок ключей объекта после
 * JSON.parse не гарантирован, и без сортировки «первой» оказалась бы
 * случайная дата.
 */
export function firstDayByUnit(log) {
  const acc = {};
  for (const iso of Object.keys(log || {}).sort()) {
    for (const entry of log[iso]) {
      if (acc[entry.unitId] === undefined) acc[entry.unitId] = iso;
    }
  }
  return acc;
}

export function totalDoneHours(log) {
  let sum = 0;
  for (const iso of Object.keys(log || {})) {
    for (const entry of log[iso]) sum += entry.hours;
  }
  return round2(sum);
}

export function hoursOnDay(log, iso) {
  const day = (log || {})[iso];
  if (!day) return 0;
  return round2(day.reduce((s, e) => s + e.hours, 0));
}

/**
 * Журнал без записей об этой единице — новый объект, исходный не трогается.
 * Нужен при удалении своей темы: осиротевшие часы иначе продолжают считаться
 * пройденными, и доля пути уезжает выше ста процентов.
 */
export function dropUnitFromLog(log, unitId) {
  const out = {};
  for (const iso of Object.keys(log || {})) {
    const rest = log[iso].filter((e) => e.unitId !== unitId);
    if (rest.length) out[iso] = rest;
  }
  return out;
}

/* ----------------------------------------------------- остаток программы --- */

/**
 * Единицы, которые ещё не закрыты, с урезанным остатком часов.
 * Результат идёт прямо в planDays из shared/schedule.mjs — тот читает hours,
 * и потому не знает и не должен знать ничего про журнал.
 */
export function remainingUnits(units, doneByUnit) {
  const out = [];
  for (const u of units) {
    const done = doneByUnit[u.id] || 0;
    const left = round2(u.hours - done);
    if (left <= 0.01) continue;
    out.push({ ...u, hours: left, fullHours: u.hours, doneOfUnit: done });
  }
  return out;
}

/**
 * Один проход по единицам — три среза прогресса: по темам, по этапам и по
 * направлениям. Тема считается закрытой, только когда закрыты все её единицы:
 * иначе карта покрасилась бы зелёным на первом же открытом видео.
 */
export function groupProgress(units, doneByUnit) {
  const byTopic = {};
  for (const u of units) {
    const t = byTopic[u.topicId] || (byTopic[u.topicId] = {
      id: u.topicId,
      title: u.topicTitle,
      stageId: u.stageId,
      track: u.track || null,
      totalH: 0,
      doneH: 0,
      units: 0,
      unitsDone: 0
    });
    const done = Math.min(u.hours, doneByUnit[u.id] || 0);
    t.totalH = round2(t.totalH + u.hours);
    t.doneH = round2(t.doneH + done);
    t.units += 1;
    if (done >= u.hours - 0.01) t.unitsDone += 1;
  }

  const byStage = {};
  const byTrack = {};
  for (const t of Object.values(byTopic)) {
    t.done = t.units > 0 && t.unitsDone === t.units;

    const s = byStage[t.stageId] || (byStage[t.stageId] = {
      id: t.stageId, totalH: 0, doneH: 0, topics: 0, topicsDone: 0
    });
    s.totalH = round2(s.totalH + t.totalH);
    s.doneH = round2(s.doneH + t.doneH);
    s.topics += 1;
    if (t.done) s.topicsDone += 1;

    if (!t.track) continue;
    const k = byTrack[t.track] || (byTrack[t.track] = { id: t.track, totalH: 0, doneH: 0 });
    k.totalH = round2(k.totalH + t.totalH);
    k.doneH = round2(k.doneH + t.doneH);
  }

  return { byTopic, byStage, byTrack };
}

/** Остаток по каждому потоку. Часы обрезаются по объёму единицы: журнал мог
 *  пережить изменение карты, и переработка не должна давать минус. */
export function streamRemaining(units, doneByUnit) {
  const left = { seq: 0, math: 0, english: 0 };
  for (const u of units) {
    const done = Math.min(u.hours, doneByUnit[u.id] || 0);
    left[u.stream] = round2(left[u.stream] + (u.hours - done));
  }
  return left;
}

/** Часы, закрытые за день, разложенные по потокам. */
function usedByStream(units, log, iso) {
  const streamOf = new Map(units.map((u) => [u.id, u.stream]));
  const out = { seq: 0, math: 0, english: 0 };
  for (const entry of (log || {})[iso] || []) {
    const stream = streamOf.get(entry.unitId);
    if (stream) out[stream] = round2(out[stream] + entry.hours);
  }
  return out;
}

/* ------------------------------------------------------------- пропуски --- */

/**
 * Пропущенные дни: рабочие дни СТРОГО до сегодня, в которые не закрыто ничего.
 * Сегодня не считается — день ещё не кончился, и объявлять его пропущенным
 * значило бы ругать человека авансом.
 */
export function missedDays(planner, today) {
  if (!planner.startDate || diffDays(planner.startDate, today) <= 0) return [];
  return scheduledDays(planner, planner.startDate, addDays(today, -1))
    .filter((iso) => hoursOnDay(planner.log, iso) === 0);
}

/**
 * Серия: сколько дней подряд подряд закрыто, считая назад от сегодня.
 * Выходной серию не рвёт (в него и не планировалось заниматься), пустой
 * рабочий день — рвёт. Сегодня без записей серию не обнуляет.
 */
export function currentStreak(planner, today) {
  if (!planner.startDate) return 0;
  let n = hoursOnDay(planner.log, today) > 0 ? 1 : 0;
  for (let iso = addDays(today, -1); diffDays(planner.startDate, iso) >= 0; iso = addDays(iso, -1)) {
    if (budgetForDay(planner, iso) === 0) continue;
    if (hoursOnDay(planner.log, iso) === 0) break;
    n += 1;
  }
  return n;
}

/* ---------------------------------------------------------------- финиш --- */

/**
 * Дата, на которую при нынешнем темпе закончится остаток.
 *
 * Считается ПООТОЧНО, а не одним числом. Скаляр был верен только потому, что
 * без шаблонов dailyBudget по построению доводит три потока до финиша
 * одновременно. Шаблон это ломает: «только проект» каждый день двигает seq и
 * морозит математику, а «остаток / часов в день» бодро рапортует финиш,
 * которого не будет.
 *
 * Без шаблонов ответ прежний: пропорциональная раскладка сохраняет доли
 * потоков, поэтому сумма убывает ровно на дневной бюджет, как и раньше.
 * Это закреплено тестом «СВЕДЕНИЕ».
 *
 * @param {object} remaining остаток по потокам (streamRemaining)
 * @param {object} used      часы, уже закрытые в первый день расчёта
 */
export function finishDate(planner, remaining, from, used = {}) {
  const left = { seq: 0, math: 0, english: 0, ...remaining };
  // Внутри цикла НЕ округляем: round2 на каждом из трёх потоков каждый день
  // накапливал по копейке (145,01 вместо 145,00 после первого же дня), и за
  // месяц набегал лишний день. Двоичная погрешность за триста итераций —
  // порядка 1e-12, она безобидна, а порог сравнения стоит на сумме.
  const total = () => left.seq + left.math + left.english;
  if (total() <= 0.01) return from;

  let iso = from;
  let first = true;
  // Предохранитель: шаблон, морозящий поток во все семь дней, иначе зациклится.
  // О таких потоках предупреждает unplannedStreams — до того, как прогноз
  // упрётся сюда и выдаст дату через полвека.
  for (let guard = 0; guard < 20000; guard++) {
    const caps = budgetByStream(planner, iso, left);
    for (const id of STREAM_IDS) {
      const capacity = first ? Math.max(0, caps[id] - (used[id] || 0)) : caps[id];
      left[id] = Math.max(0, left[id] - Math.min(capacity, left[id]));
    }
    first = false;
    if (total() <= 0.01) return iso;
    iso = addDays(iso, 1);
  }
  return iso;
}

/**
 * Сколько часов в неделю фактически достаётся потоку.
 *
 * Считать «доля × число дней» нельзя: на днях с шаблоном раскладка задана
 * прямо, а не выведена из остатков. Поэтому идём по дням недели и на каждом
 * берём то, что этому дню действительно назначено.
 *
 * @param {number} proportionalPerDay доля потока в обычный день (dailyBudget)
 */
export function weeklyStreamHours(planner, stream, proportionalPerDay) {
  let sum = 0;
  for (const weekday of planner.weekdays || [0, 1, 2, 3, 4, 5, 6]) {
    const tpl = templateForWeekday(planner, weekday);
    sum += tpl ? (tpl.hours[stream] || 0) : proportionalPerDay;
  }
  return round2(sum);
}

/**
 * Когда закончится поток, если держать его на заданном недельном темпе.
 * Считается по календарю, а не по рабочим дням: «часов в неделю» — это уже
 * недельная величина, и делить её ещё раз на расписание значит считать дважды.
 */
export function finishAtWeeklyPace(remainingHours, hoursPerWeek, from) {
  if (hoursPerWeek <= 0 || remainingHours <= 0) return null;
  return addDays(from, Math.ceil(remainingHours / (hoursPerWeek / 7)) - 1);
}

/* ----------------------------------------------------------------- свод --- */

/**
 * Всё, что показывает боковая колонка «Сегодня», одним расчётом.
 * @param {object} arg { units, planner, todayIso }
 */
export function stats({ units, planner, todayIso: today }) {
  const totalHours = round2(units.reduce((s, u) => s + u.hours, 0));
  const doneHours = totalDoneHours(planner.log);
  const remainingHours = round2(Math.max(0, totalHours - doneHours));
  const usedToday = hoursOnDay(planner.log, today);
  const byUnit = doneHoursByUnit(planner.log);

  const closedDays = Object.keys(planner.log || {}).filter(
    (iso) => hoursOnDay(planner.log, iso) > 0
  ).length;
  const missed = missedDays(planner, today);

  // Отставание считается от объявленного расписания, а не от календарных
  // суток: объявленный выходной долгом не становится. Сегодня в план ещё не
  // записывается — день не кончился.
  const expected = planner.startDate && diffDays(planner.startDate, today) > 0
    ? round2(
        scheduledDays(planner, planner.startDate, addDays(today, -1))
          .reduce((s, iso) => s + budgetForDay(planner, iso), 0)
      )
    : 0;

  return {
    totalHours,
    doneHours,
    remainingHours,
    percent: totalHours > 0 ? round2((doneHours / totalHours) * 100) : 0,
    daysElapsed: planner.startDate ? diffDays(planner.startDate, today) + 1 : 0,
    closedDays,
    missed: missed.length,
    missedDays: missed,
    streak: currentStreak(planner, today),
    behindHours: round2(Math.max(0, expected - doneHours)),
    aheadHours: round2(Math.max(0, doneHours - expected)),
    usedToday,
    starved: unplannedStreams(planner),
    finishIso: finishDate(
      planner,
      streamRemaining(units, byUnit),
      today,
      usedByStream(units, planner.log, today)
    )
  };
}

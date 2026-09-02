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

/**
 * Сколько часов запланировано на конкретный день.
 * Ручное переопределение сильнее расписания недели, а ноль — это выходной,
 * поэтому отдельного списка выходных нет: одно понятие вместо двух.
 */
export function budgetForDay(planner, iso) {
  if (Object.prototype.hasOwnProperty.call(planner.dayHours || {}, iso)) {
    return planner.dayHours[iso];
  }
  const weekdays = planner.weekdays || [0, 1, 2, 3, 4, 5, 6];
  return weekdays.includes(fromIso(iso).getDay()) ? planner.hoursPerDay : 0;
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
 * usedOnFirstDay — часы, уже закрытые в первый день расчёта: иначе прогноз
 * выдавал бы сегодняшний бюджет за нетронутый.
 */
export function finishDate(planner, remainingHours, from, usedOnFirstDay = 0) {
  let left = round2(remainingHours);
  if (left <= 0.01) return from;

  let iso = from;
  let used = usedOnFirstDay;
  // Предохранитель: при нулевом расписании цикл иначе не кончится никогда.
  for (let guard = 0; guard < 20000; guard++) {
    const capacity = Math.max(0, round2(budgetForDay(planner, iso) - used));
    used = 0;
    if (capacity > 0) {
      left = round2(left - capacity);
      if (left <= 0.01) return iso;
    }
    iso = addDays(iso, 1);
  }
  return iso;
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
    finishIso: finishDate(planner, remainingHours, today, usedToday)
  };
}

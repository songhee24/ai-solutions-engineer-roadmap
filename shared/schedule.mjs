/* ============================================================================
 * shared/schedule.mjs — ядро дневного планирования. Чистые функции, без DOM и
 * без глобалов: данные карты передаются аргументом.
 *
 * Два потребителя: scripts/build-schedule.mjs (генерирует docs/first-weeks.md)
 * и планнер на Svelte (planner-src). Поэтому файл лежит отдельно, а не внутри
 * одного из них.
 *
 * Почему единица плана — ресурс, а не тема: тема в среднем 16 часов, на день
 * это слишком крупно. Ресурсов 199, у всех проставлены часы, медиана 6.
 *
 * Почему у темы появляется ещё и блок «Задача»: часы темы (1609 по основному
 * пути) складываются из обязательных ресурсов (848) и практики (761). Если
 * планировать только ресурсы, из плана выпадет почти половина программы, и
 * срок соврёт. Практика попадает в план отдельным блоком с текстом задачи.
 * ========================================================================== */

/** Идентификаторы потоков. Математика и английский идут параллельно основной
 *  последовательности — так написано в самой карте, а не придумано здесь. */
export const STREAMS = {
  seq: { id: "seq", title: "Основной этап", stageIds: null },
  math: { id: "math", title: "Математика", stageIds: ["track-math"] },
  english: { id: "english", title: "Английский", stageIds: ["track-english"] }
};

const STREAM_OF_STAGE = { "track-math": "math", "track-english": "english" };

/** Насколько можно перебрать дневной бюджет, чтобы доделать короткую единицу
 *  сегодня, а не растягивать её на завтра. Доля от дневного бюджета потока. */
const OVERFLOW_SLACK = 0.6;

/** Единица короче этого делается за один присест целиком, каким бы маленьким
 *  ни был дневной бюджет потока: тест на час, разрезанный на три дня по 20
 *  минут, — это не план, а издевательство. Длинные курсы делить нормально. */
const ATOMIC_HOURS = 1;

/** Сколько всего минут в день позволено перебрать поверх бюджета, чтобы
 *  доделать начатое. Долг вычитается из завтрашнего бюджета того же потока. */
const DAY_SLACK_HOURS = 0.75;

const round2 = (n) => Math.round(n * 100) / 100;

function streamOfStage(stageId) {
  return STREAM_OF_STAGE[stageId] || "seq";
}

/**
 * Разворачивает карту в плоский список единиц плана, сохраняя порядок этапов
 * и тем. Необязательные этапы (треки C, D, E) в основной путь не входят.
 *
 * @param {object} data     window.ROADMAP
 * @param {string} profile  "novice" | "dev"
 * @returns {Array<Unit>}   unit = { id, stream, stageId, stageNum, topicId,
 *                                   topicTitle, kind, title, url, hours, ... }
 */
export function buildUnits(data, profile) {
  const units = [];

  for (const stage of data.stages) {
    if (stage.optional) continue;
    const stream = streamOfStage(stage.id);

    for (const topic of stage.topics) {
      const topicHours = (topic.hours && topic.hours[profile]) || 0;
      if (topicHours <= 0) continue;

      const resources = (topic.resources || []).filter((r) => r.required);
      let spent = 0;

      resources.forEach((r, i) => {
        // Ресурс может быть длиннее темы (одна такая тема в карте) — обрезаем,
        // иначе сумма потока разойдётся с заявленным сроком.
        const hours = Math.min(r.hours || 0, Math.max(0, topicHours - spent));
        if (hours <= 0) return;
        spent += hours;
        units.push({
          id: `${topic.id}::r${i}`,
          stream,
          stageId: stage.id,
          stageNum: stage.num,
          stageTitle: stage.title,
          topicId: topic.id,
          topicTitle: topic.title,
          kind: "resource",
          title: r.title,
          url: r.url,
          hours,
          scope: r.scope || null,
          study: r.study || null,
          lang: r.lang || null
        });
      });

      const practice = Math.round((topicHours - spent) * 100) / 100;
      if (practice > 0) {
        units.push({
          id: `${topic.id}::task`,
          stream,
          stageId: stage.id,
          stageNum: stage.num,
          stageTitle: stage.title,
          topicId: topic.id,
          topicTitle: topic.title,
          kind: "task",
          title: `Задача: ${topic.title}`,
          detail: topic.task || "Практика по теме своими руками.",
          url: null,
          hours: practice,
          scope: null,
          study: null,
          lang: null
        });
      }
    }
  }

  return units;
}

/** Сумма часов по каждому потоку. */
export function streamTotals(units) {
  const totals = { seq: 0, math: 0, english: 0 };
  for (const u of units) totals[u.stream] += u.hours;
  return totals;
}

/**
 * Сколько часов в день отдавать каждому потоку, чтобы все три закончились
 * одновременно. Иначе математика (277 ч) тянулась бы ещё два месяца после
 * последнего этапа.
 */
export function dailyBudget(units, hoursPerDay) {
  const totals = streamTotals(units);
  const all = totals.seq + totals.math + totals.english;
  const days = Math.max(1, Math.ceil(all / hoursPerDay));
  return {
    days,
    totalHours: all,
    perDay: {
      seq: totals.seq / days,
      math: totals.math / days,
      english: totals.english / days
    }
  };
}

/**
 * Раскладывает единицы по дням. Единица длиннее дневного бюджета переходит на
 * следующие дни и показывается как продолжение — «часть 2 из 5», а не заново.
 *
 * @param {Array<Unit>} units
 * @param {object} opts { hoursPerDay, days, startDate: Date, weekdays?: number[] }
 * @returns {Array<Day>} day = { date, iso, weekday, blocks: [{ stream, budget, items }] }
 */
export function planDays(units, opts) {
  const hoursPerDay = opts.hoursPerDay || 5;
  const budget = dailyBudget(units, hoursPerDay);
  const dayCount = opts.days || budget.days;
  const weekdays = opts.weekdays || [0, 1, 2, 3, 4, 5, 6];

  // Очередь на каждый поток: сколько часов единицы ещё не распланировано.
  const queues = { seq: [], math: [], english: [] };
  for (const u of units) queues[u.stream].push({ unit: u, left: u.hours, part: 0, parts: 0 });

  const days = [];
  const cursor = new Date(opts.startDate);
  // Долг потока: если вчера доделали короткую единицу с перебором, сегодня
  // бюджет на столько же меньше. Иначе тест на 25 минут при бюджете 20 минут
  // в день растянулся бы на три дня, что бессмысленно.
  const carry = { seq: 0, math: 0, english: 0 };

  for (let d = 0; d < dayCount; d++) {
    while (!weekdays.includes(cursor.getDay())) cursor.setDate(cursor.getDate() + 1);

    // Перебор считается на весь день, а не на поток: иначе три потока по
    // очереди перебирают свой бюджет и день из пяти часов вырастает в восемь.
    let slack = DAY_SLACK_HOURS;

    const blocks = [];
    for (const streamId of ["math", "english", "seq"]) {
      const perDay = budget.perDay[streamId];
      if (perDay <= 0) continue;

      const items = [];
      let left = Math.max(0, round2(perDay - carry[streamId]));
      carry[streamId] = 0;
      const queue = queues[streamId];

      while (left > 0.01 && queue.length) {
        const head = queue[0];
        // Единицу, которая почти помещается или просто короткая, доводим до
        // конца сегодня — но только пока дневной запас перебора не исчерпан.
        const over = round2(head.left - left);
        const finishToday =
          over <= slack && (over <= perDay * OVERFLOW_SLACK || head.left <= ATOMIC_HOURS);
        const take = finishToday ? head.left : Math.min(head.left, left);
        if (finishToday && over > 0) slack = round2(slack - over);
        head.part += 1;
        items.push({
          unit: head.unit,
          hours: round2(take),
          part: head.part,
          continues: round2(head.left - take) > 0.01,
          isStart: head.part === 1
        });
        head.left = round2(head.left - take);
        left = round2(left - take);
        if (head.left <= 0.01) queue.shift();
      }

      if (left < 0) { carry[streamId] = -left; left = 0; }

      blocks.push({
        stream: streamId,
        title: STREAMS[streamId].title,
        budget: round2(perDay),
        planned: round2(items.reduce((n, i) => n + i.hours, 0)),
        items
      });
    }

    days.push({
      iso: toIso(cursor),
      date: new Date(cursor),
      weekday: cursor.getDay(),
      blocks
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/** Локальная дата в YYYY-MM-DD — без UTC-сдвига, который ломает границу суток. */
export function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** «5 ч», «52 мин», «1 ч 20 мин» — часы в человеческом виде. */
export function formatHours(h) {
  const total = Math.round(h * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours} ч ${mins} мин`;
  if (hours) return `${hours} ч`;
  return `${mins} мин`;
}

/* ============================================================================
 * custom.js — свои темы: то, чего в карте нет.
 *
 * Хранятся в состоянии планнера, а не в roadmap-data.js, поэтому обновление
 * содержания карты их не задевает — ради этого фича и существует.
 *
 * Обычный .js, а не .svelte.js: чистые функции без рун, чтобы их можно было
 * гонять в `node --test` без компилятора Svelte.
 * ========================================================================== */

/** Пространство имён своих единиц. Родные имеют вид `<topicId>::r0` и
 *  `<topicId>::task`, а ни один id темы в карте не содержит двоеточия и не
 *  начинается с "custom" — столкнуться нельзя по построению (пинится тестом). */
const PREFIX = "custom::";

/**
 * Ссылка, которую безопасно положить в href.
 * Проверка обязательна: ссылку вводит человек, а `Today.svelte` рендерит её
 * в атрибут — сохранённый `javascript:` выполнился бы по клику.
 */
export function safeUrl(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** Следующий свободный номер. Номера не переиспользуются: на старый id могут
 *  остаться записи в журнале, и новая тема унаследовала бы чужие часы. */
export function nextCustomId(list) {
  let max = 0;
  for (const item of list || []) {
    const match = /^custom::(\d+)$/.exec(item && item.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${PREFIX}${max + 1}`;
}

/**
 * Свои темы в виде единиц плана — той же формы, что отдаёт buildUnits.
 * Дальше remainingUnits, planDays, stats и groupProgress работают с ними, не
 * зная, что они не из карты.
 *
 * Одна тема — одна единица: деление на ресурсы и «Задачу» существует потому,
 * что родная тема смешивает материалы и собственную практику. Введённые
 * руками восемь часов такого деления не требуют.
 */
export function customUnits(list) {
  const units = [];
  for (const item of list || []) {
    const hours = Number(item.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    units.push({
      id: item.id,
      stream: item.stream === "math" || item.stream === "english" ? item.stream : "seq",
      // Псевдоэтап: buildMapLayout ходит по data.stages и "custom" там не
      // встретит, поэтому карта знаний своими темами не засоряется.
      stageId: "custom",
      stageNum: "своё",
      stageTitle: "Свои темы",
      topicId: item.id,
      topicTitle: item.title,
      // track: null — на полосы «по направлениям» своя тема не влияет:
      // направления описывают программу карты, а не личные добавки.
      track: null,
      kind: "custom",
      title: item.title,
      url: safeUrl(item.url),
      hours,
      scope: null,
      study: null,
      lang: null
    });
  }
  return units;
}

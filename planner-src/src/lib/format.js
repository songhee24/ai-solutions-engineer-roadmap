/* ============================================================================
 * format.js — русская типографика чисел и дат. Отдельно от логики, потому что
 * «6.0 ч» и «322 дней» — это ошибки представления, а не расчёта.
 * ========================================================================== */

import { fromIso } from "./progress.js";

export { formatHours } from "../../../shared/schedule.mjs";

/** Дробная часть — через запятую: «6,0», «14,5». */
export function ruNum(n, digits = 1) {
  return Number(n).toFixed(digits).replace(".", ",");
}

/** 1 день, 2 дня, 5 дней. */
export function plural(n, one, few, many) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Часы для подписей: мелкие значения с десятой, крупные — целыми. Иначе
 *  0,87 ч превращалось в «1 ч» и читалось как «час уже пройден». */
export function hoursNum(h) {
  return ruNum(h, Math.abs(h) < 10 ? 1 : 0);
}

export function days(n) {
  return `${n} ${plural(n, "день", "дня", "дней")}`;
}

const long = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const short = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const monthOnly = new Intl.DateTimeFormat("ru-RU", { month: "short" });

/** «суббота, 17 октября» — с заглавной, как начало заголовка. */
export function dateLong(iso) {
  const s = long.format(fromIso(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «17 октября, сб» */
export function dateShort(iso) {
  return short.format(fromIso(iso));
}

/** «17 октября», а для другого года — «20 июля 2027 г.».
 *  Без года дата финиша врала грубо: путь длиной десять месяцев заканчивается
 *  в следующем году, и «12 сентября» читалось как «через десять дней». */
export function dateDayMonth(iso) {
  const date = fromIso(iso);
  if (date.getFullYear() === new Date().getFullYear()) return dayMonth.format(date);
  // Intl отдаёт «20 июля 2027 г.», а подпись заканчивается точкой предложения —
  // получалось «20 июля 2027 г..». Сокращение убираем, год остаётся.
  return dayMonthYear.format(date).replace(/\s*г\.\s*$/, "");
}

export function monthShort(iso) {
  return monthOnly.format(fromIso(iso)).replace(".", "");
}

export const WEEKDAY_NAMES = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

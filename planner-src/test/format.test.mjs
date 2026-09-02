/* Русская типографика чисел и дат: то, что читатель видит буквально. */

import test from "node:test";
import assert from "node:assert/strict";

import { ruNum, hoursNum, plural, dateDayMonth, dateLong } from "../src/lib/format.js";

test("дробная часть пишется через запятую", () => {
  assert.equal(ruNum(6), "6,0");
  assert.equal(ruNum(14.53), "14,5");
  assert.equal(ruNum(322, 0), "322");
});

test("мелкие часы не округляются до целого", () => {
  // 0,87 ч, показанное как «1 ч», читается как «час уже пройден».
  assert.equal(hoursNum(0.87), "0,9");
  assert.equal(hoursNum(1609), "1609");
  assert.equal(hoursNum(0), "0,0");
});

test("склонения", () => {
  assert.equal(plural(1, "день", "дня", "дней"), "день");
  assert.equal(plural(2, "день", "дня", "дней"), "дня");
  assert.equal(plural(5, "день", "дня", "дней"), "дней");
  assert.equal(plural(11, "день", "дня", "дней"), "дней");
  assert.equal(plural(21, "день", "дня", "дней"), "день");
});

test("дата другого года несёт год, но не «г.» перед точкой предложения", () => {
  const year = new Date().getFullYear();
  const far = dateDayMonth(`${year + 1}-07-20`);
  assert.match(far, new RegExp(String(year + 1)), `год потерян: ${far}`);
  assert.doesNotMatch(far, /г\.\s*$/, `осталось «г.», даст двойную точку: ${far}`);

  const near = dateDayMonth(`${year}-07-20`);
  assert.doesNotMatch(near, /\d{4}/, `в нынешнем году год лишний: ${near}`);
});

test("длинная дата начинается с заглавной — это начало заголовка", () => {
  assert.match(dateLong("2026-09-02"), /^[А-Я]/);
});

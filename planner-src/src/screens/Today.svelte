<script>
  /* Экран «Сегодня»: пять часов, разложенные по трём потокам, с галочками.
     Ничего не закрывается само — отмечает человек. */
  import { planDays } from "../../../shared/schedule.mjs";
  import {
    planner, isLogged, logUnit, unlogUnit, setDayHours, skipUnit, unskipAll
  } from "../lib/store.svelte.js";
  import {
    budgetForDay, doneHoursByUnit, remainingUnits, fromIso, round2, templateForDay
  } from "../lib/progress.js";
  import { formatHours, ruNum, hoursNum, dateLong, dateDayMonth, plural } from "../lib/format.js";

  let { units, doneByUnit, summary, today } = $props();

  /* Внутри одного дня расписание недели уже неважно — день выбран.
     Выходной обрабатывается отдельной веткой ниже, через нулевой бюджет. */
  const ONE_DAY = [0, 1, 2, 3, 4, 5, 6];
  const STREAM_TITLES = { seq: "основному этапу", math: "математике", english: "английскому" };
  const RING = 2 * Math.PI * 50;

  let budget = $derived(budgetForDay(planner, today));
  /* Шаблон дня недели задаёт раскладку напрямую. Ручной час на конкретный день
     его сбрасывает — так же, как в budgetForDay: одно правило, а не два. */
  let template = $derived(
    Object.prototype.hasOwnProperty.call(planner.dayHours, today)
      ? null
      : templateForDay(planner, today)
  );
  let skippedToday = $derived(planner.skipped[today] || []);

  /* План на сегодня строится от того, что закрыто ДО сегодня. Если считать
     вместе с сегодняшним журналом, отмеченная строка исчезала бы из списка
     прямо под курсором, а на её место молча въезжала следующая. */
  let doneBefore = $derived.by(() => {
    const past = {};
    for (const iso of Object.keys(planner.log)) {
      if (iso !== today) past[iso] = planner.log[iso];
    }
    return doneHoursByUnit(past);
  });

  let pool = $derived(
    remainingUnits(units, doneBefore).filter((u) => !skippedToday.includes(u.id))
  );

  let day = $derived(
    budget > 0 && pool.length
      ? planDays(pool, {
          hoursPerDay: budget,
          days: 1,
          startDate: fromIso(today),
          weekdays: ONE_DAY,
          perDay: template ? template.hours : undefined
        })[0]
      : null
  );

  let plannedToday = $derived(
    day ? round2(day.blocks.reduce((s, b) => s + b.planned, 0)) : 0
  );
  let ringFrac = $derived(budget > 0 ? Math.min(1, summary.usedToday / budget) : 0);

  let dayHoursChoice = $derived(
    Object.prototype.hasOwnProperty.call(planner.dayHours, today)
      ? String(planner.dayHours[today])
      : "auto"
  );

  function toggle(item) {
    if (isLogged(today, item.unit.id)) unlogUnit(today, item.unit.id);
    else logUnit(today, item.unit.id, item.hours);
  }

  function onDayHours(event) {
    const value = event.currentTarget.value;
    setDayHours(today, value === "auto" ? null : Number(value));
  }

  /* Когда короткую единицу выгоднее доделать за присест, поток вылезает за
     свою норму. Показываем обе цифры, а не прячем расхождение. */
  function budgetLabel(block) {
    const planned = formatHours(block.planned);
    return Math.abs(block.planned - block.budget) > 0.05
      ? `${planned} · норма ${formatHours(block.budget)}`
      : planned;
  }

  /** «Этап 1» или «Трек A» — в карте у треков буквенный номер.
   *  У своей темы этапа нет вовсе, и «Трек своё» читалось нелепо. */
  function where(unit) {
    if (unit.kind === "custom") return "Своя тема";
    const kind = /^\d+$/.test(String(unit.stageNum)) ? "Этап" : "Трек";
    return `${kind} ${unit.stageNum} · ${unit.topicTitle}`;
  }

  /** Честная подпись про объём: что уже закрыто и что останется после сегодня. */
  function volume(item) {
    const parts = [];
    if (item.unit.doneOfUnit > 0) {
      parts.push(
        `продолжаете: закрыто ${ruNum(item.unit.doneOfUnit)} из ${ruNum(item.unit.fullHours)} ч`
      );
    }
    if (item.continues) {
      const left = round2(item.unit.hours - item.hours);
      parts.push(`после сегодня останется ${formatHours(left)}`);
    }
    return parts.join(" · ");
  }
</script>

<h1>{dateLong(today)}</h1>
<p class="lede">
  {#if planner.startDate}
    День {summary.daysElapsed} с начала.
  {/if}
  {#if budget > 0}
    Сегодня в плане {formatHours(plannedToday)}.
  {/if}
</p>

<div class="grid2">
  <div>
    <div class="daybar card">
      <label for="dayhours">Сколько часов сегодня</label>
      <select id="dayhours" class="field" value={dayHoursChoice} onchange={onDayHours}>
        <option value="auto">По расписанию — {formatHours(planner.hoursPerDay)}</option>
        <option value="0">Выходной</option>
        {#each [1, 2, 3, 4, 5, 6, 7, 8] as h (h)}
          <option value={String(h)}>{h} ч</option>
        {/each}
      </select>
      {#if template}
        <!-- Без этой подписи двадцать минут в субботу выглядят поломкой. -->
        <span class="chip">Сегодня «{template.title}»</span>
      {/if}
      {#if skippedToday.length}
        <button class="btn ghost small" onclick={() => unskipAll(today)}>
          Вернуть отложенное ({skippedToday.length})
        </button>
      {/if}
    </div>

    {#if budget === 0}
      <div class="card empty">
        <h3>Сегодня выходной</h3>
        <p>Он объявлен вами — в отставание и в пропуски этот день не попадёт.</p>
        <button class="btn" onclick={() => setDayHours(today, planner.hoursPerDay)}>
          Всё-таки позанимаюсь
        </button>
      </div>

    {:else if !pool.length}
      <div class="card empty">
        <h3>Программа пройдена</h3>
        <p>Все {hoursNum(summary.totalHours)} часов основного пути закрыты. Дальше — дополнительные
          треки на карте: они вне общего срока и берутся по выбору.</p>
      </div>

    {:else if day}
      {#each day.blocks as block (block.stream)}
        {#if block.items.length}
          <div class="card block {block.stream}">
            <header>
              <h3>{block.title}</h3>
              <span class="chip {block.stream}">
                {block.stream === "english" ? "каждый день" : block.stream === "math" ? "параллельно" : "по порядку"}
              </span>
              <span class="budget mono">{budgetLabel(block)}</span>
            </header>

            {#each block.items as item (item.unit.id)}
              <div class="item" class:closed={isLogged(today, item.unit.id)}>
                <input class="tick" type="checkbox"
                       checked={isLogged(today, item.unit.id)}
                       onchange={() => toggle(item)}
                       aria-label={`Закрыть: ${item.unit.title}`}>
                <div class="body">
                  <div class="title">
                    {#if item.unit.url}
                      <a href={item.unit.url} target="_blank" rel="noopener noreferrer">{item.unit.title}</a>
                    {:else}
                      {item.unit.title}
                    {/if}
                    <!-- Русская версия Khan второй ссылкой. Основной остаётся
                         английская: нумерация юнитов совпадает только с ней. -->
                    {#if item.unit.ru}
                      <a class="ru" href={item.unit.ru.url} target="_blank" rel="noopener noreferrer"
                         title={item.unit.ru.note ?? "Та же тема на ru.khanacademy.org"}
                         aria-label={`Открыть на русском: ${item.unit.title}`}>RU</a>
                    {/if}
                  </div>
                  {#if item.unit.ru?.note}
                    <div class="meta detail">Про ссылку RU: {item.unit.ru.note}</div>
                  {/if}
                  <div class="meta">{where(item.unit)}</div>
                  {#if item.unit.kind === "task" && item.unit.detail}
                    <div class="meta detail">{item.unit.detail}</div>
                  {/if}
                  {#if item.unit.study}
                    <div class="meta detail">Что изучать: {item.unit.study}</div>
                  {/if}
                  {#if volume(item)}
                    <div class="meta">{volume(item)}</div>
                  {/if}
                </div>
                <div class="end">
                  <span class="hrs mono">{formatHours(item.hours)}</span>
                  <button class="btn ghost small" onclick={() => skipUnit(today, item.unit.id)}>
                    Не сегодня
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <aside>
    <div class="card ring-card">
      <svg class="ring" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="track" cx="60" cy="60" r="50"></circle>
        <circle class="fill" cx="60" cy="60" r="50"
                stroke-dasharray={RING}
                stroke-dashoffset={RING * (1 - ringFrac)}></circle>
      </svg>
      <!-- В кольце сегодняшние часы, а не серия: у серии нет знаменателя,
           и в макете кольцо вокруг неё было чистым украшением. -->
      <div class="ring-num mono">{formatHours(summary.usedToday)}</div>
      <div><small>из {formatHours(budget)} за сегодня</small></div>
    </div>

    <div class="stats">
      <div class="card"><b class="mono">{summary.streak}</b><span>{plural(summary.streak, "день", "дня", "дней")} подряд</span></div>
      <div class="card"><b class="mono">{summary.closedDays}</b><span>{plural(summary.closedDays, "день закрыт", "дня закрыто", "дней закрыто")}</span></div>
      <div class="card"><b class="mono">{hoursNum(summary.doneHours)} ч</b><span>из {hoursNum(summary.totalHours)} пройдено</span></div>
      <div class="card"><b class="mono">{ruNum(summary.percent)}%</b><span>всего пути</span></div>
    </div>

    {#if summary.starved.length}
      <div class="card side warn">
        <h3>Поток стоит на месте</h3>
        <p><small>Шаблоны не дают часов
          {summary.starved.map((s) => STREAM_TITLES[s]).join(" и ")}
          ни в один день недели, поэтому
          {summary.starved.length > 1 ? "эти потоки не закончатся" : "этот поток не закончится"}
          никогда, и дата финиша ниже — не настоящая. Дайте им часы в настройках
          или снимите шаблон хотя бы с одного дня.</small></p>
      </div>
    {/if}

    <div class="card side">
      <h3>Пропуски</h3>
      {#if summary.missed === 0}
        <p class="good mono">ни одного</p>
        <p><small>Финиш при нынешнем темпе — {dateDayMonth(summary.finishIso)}.</small></p>
      {:else}
        <p class="bad mono">−{ruNum(summary.behindHours)} ч</p>
        <p><small>
          {summary.missed}
          {plural(summary.missed, "пропущенный день сдвинул", "пропущенных дня сдвинули", "пропущенных дней сдвинули")}
          финиш на {dateDayMonth(summary.finishIso)}.
          Ничего не потеряно: план строится от того, что ещё не пройдено, поэтому непройденное
          просто всплывает завтра.
        </small></p>
      {/if}
    </div>
  </aside>
</div>

<style>
  .grid2 { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }

  .daybar { padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .daybar label { font-size: 13px; font-weight: 600; }

  .block { padding: 16px 18px; margin-bottom: 14px; }
  .block header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .block h3 { margin: 0; font-size: 15px; }
  .block .budget { margin-left: auto; color: var(--text-muted); font-size: 13px; }
  .block.math    { border-left: 4px solid var(--s-math); }
  .block.english { border-left: 4px solid var(--s-english); }
  .block.seq     { border-left: 4px solid var(--s-seq); }

  .item { display: flex; gap: 12px; align-items: flex-start; padding: 11px 0; border-top: 1px solid var(--border); }
  .item:first-of-type { border-top: 0; }
  .item.closed .body { opacity: .55; }
  .item .body { min-width: 0; flex: 1; }
  .item .title { font-weight: 600; overflow-wrap: anywhere; }
  /* Мельче основной ссылки — намеренно: английская остаётся главной. */
  .item .title a.ru {
    margin-left: 7px; font-size: .68rem; font-weight: 700; letter-spacing: .06em;
    padding: 1px 6px; border-radius: 999px; text-decoration: none;
    color: var(--text-muted); border: 1px solid var(--border); background: var(--surface);
    vertical-align: 1px; white-space: nowrap;
  }
  .item .title a.ru:hover, .item .title a.ru:focus-visible {
    color: var(--primary); border-color: var(--primary); background: var(--primary-soft);
  }
  .item .meta { color: var(--text-faint); font-size: 12.5px; margin-top: 2px; }
  .item .meta.detail { color: var(--text-muted); }
  .item .end { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .item .hrs { font-size: 13px; color: var(--text-muted); white-space: nowrap; }

  .empty { padding: 20px; }
  .empty h3 { margin: 0 0 6px; }
  .empty p { margin: 0 0 12px; color: var(--text-muted); }

  .ring-card { padding: 18px; text-align: center; }
  .ring { display: block; margin: 0 auto 8px; }
  .ring .track { fill: none; stroke: var(--bg-soft); stroke-width: 12; }
  .ring .fill  { fill: none; stroke: var(--ok); stroke-width: 12; stroke-linecap: round;
                 transform: rotate(-90deg); transform-origin: 60px 60px; transition: stroke-dashoffset .2s ease; }
  .ring-num { font-size: 24px; font-weight: 700; }

  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .stats .card { padding: 12px 14px; }
  .stats b { display: block; font-size: 20px; }
  .stats span { color: var(--text-muted); font-size: 12px; }

  .side { padding: 14px 16px; margin-top: 14px; }
  .side h3 { margin: 0 0 6px; font-size: 14px; }
  .side p { margin: 0 0 6px; }
  .side.warn { border-color: color-mix(in srgb, var(--warn) 40%, var(--border));
               background: var(--warn-soft); }
  .side.warn h3 { color: var(--warn); }
  .side .good { font-size: 18px; color: var(--ok); }
  .side .bad  { font-size: 20px; color: var(--warn); }
</style>

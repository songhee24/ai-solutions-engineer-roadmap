<script>
  /* Экран «Календарь»: сколько закрыто в каждый день и какие дни пропущены.
     Плюс возможность объявить день выходным задним числом — тогда он перестаёт
     считаться прогулом, но и часы за него не начисляются. */
  import { planner, setDayHours } from "../lib/store.svelte.js";
  import { addDays, diffDays, budgetForDay, hoursOnDay, fromIso } from "../lib/progress.js";
  import { dateShort, formatHours, hoursNum, plural, monthShort } from "../lib/format.js";
  import DayDetail from "../ui/DayDetail.svelte";

  let { units, summary, today } = $props();

  /* Какой день развёрнут. Локально, а не в хранилище: это взгляд, а не
     настройка — незачем переживать перезагрузку. */
  let open = $state(null);

  /* Сколько дней списка показано. Растёт кнопкой «Показать ещё» — иначе дальше
     двух недель заглянуть было нельзя, а путь длиной в 322 дня. */
  let shown = $state(14);
  const RECENT_STEP = 14;
  /** Предел на ширину полосы: 60 недель заведомо перекрывают любой темп. */
  const MAX_WEEKS = 60;

  function cellFor(iso) {
    const budget = budgetForDay(planner, iso);
    const hours = hoursOnDay(planner.log, iso);
    const future = diffDays(iso, today) < 0;

    let cls = "";
    let what = "впереди";
    if (hours > 0) {
      const frac = budget > 0 ? hours / budget : 1;
      cls = frac >= 0.95 ? "d3" : frac >= 0.5 ? "d2" : "d1";
      what = `${formatHours(hours)} из ${formatHours(budget)}`;
    } else if (budget === 0) {
      cls = "off";
      what = "выходной";
    } else if (!future && iso !== today) {
      cls = "miss";
      what = "пропущен";
    } else if (iso === today) {
      cls = "now";
      what = "сегодня, пока пусто";
    }
    return { iso, cls, title: `${dateShort(iso)} — ${what}` };
  }

  let weeks = $derived.by(() => {
    const start = planner.startDate;
    if (!start) return [];
    // Полоса начинается с воскресенья, чтобы строки были днями недели.
    const first = addDays(start, -fromIso(start).getDay());
    const lastPlanned = diffDays(summary.finishIso, today) > 0 ? today : summary.finishIso;
    const span = Math.max(7, diffDays(first, lastPlanned) + 1);
    const total = Math.min(Math.ceil(span / 7), MAX_WEEKS);

    const out = [];
    for (let w = 0; w < total; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const iso = addDays(first, w * 7 + d);
        // Дни до старта — пустые места, а не пропуски.
        days.push(diffDays(start, iso) < 0 ? { iso, cls: "void", title: "" } : cellFor(iso));
      }
      const prevMonth = w > 0 ? fromIso(out[w - 1].days[0].iso).getMonth() : -1;
      const month = fromIso(days[0].iso).getMonth();
      out.push({ days, label: month !== prevMonth ? monthShort(days[0].iso) : "" });
    }
    return out;
  });

  let recent = $derived.by(() => {
    const start = planner.startDate;
    if (!start) return [];
    const out = [];
    for (let i = 0; i < shown; i++) {
      const iso = addDays(today, -i);
      if (diffDays(start, iso) < 0) break;
      const budget = budgetForDay(planner, iso);
      const hours = hoursOnDay(planner.log, iso);
      out.push({
        iso,
        budget,
        hours,
        isToday: iso === today,
        off: budget === 0,
        missed: budget > 0 && hours === 0 && iso !== today
      });
    }
    return out;
  });

  /* Кнопка «Показать ещё» исчезает, когда список упёрся в дату старта. */
  let allShown = $derived(
    !planner.startDate || diffDays(planner.startDate, addDays(today, -(shown - 1))) <= 0
  );
</script>

<h1>Календарь</h1>
<p class="lede">Насыщенность клетки — сколько часов закрыто в этот день, красная рамка — пропуск.
  Галочки ставятся руками на экране «Сегодня»: система ничего не закрывает за вас.</p>

<div class="card pad">
  <div class="scroll">
    <div class="strip">
      <div class="months">
        {#each weeks as week, i (i)}<span>{week.label}</span>{/each}
      </div>
      <div class="heat">
        {#each weeks as week, i (i)}
          <div class="week">
            {#each week.days as day (day.iso)}
              <!-- tabindex="-1" НЕ ошибка: клеток больше четырёхсот, и пускать
                   их в обход по Tab нельзя, а растянуть до 44 px значит убить
                   теплокарту. Клетка — мышиный способ; для клавиатуры и
                   скринридера есть полный список «Последних дней» ниже. -->
              <button class="cell {day.cls}" title={day.title} aria-label={day.title}
                      tabindex="-1" disabled={day.cls === "void"}
                      onclick={() => (open = open === day.iso ? null : day.iso)}
              ></button>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if open}
    <div class="picked">
      <p class="picked-head">
        <span>{dateShort(open)}</span>
        <button class="btn ghost small" onclick={() => (open = null)}>Закрыть</button>
      </p>
      <DayDetail {units} iso={open} isToday={open === today} />
    </div>
  {/if}

  <div class="legend">
    <span>меньше</span>
    <i class="lv"></i><i class="lv d1"></i><i class="lv d2"></i><i class="lv d3"></i>
    <span>больше</span>
    <span class="gap"><i class="lv miss"></i> пропуск</span>
    <span><i class="lv off"></i> выходной</span>
  </div>
</div>

<div class="totals">
  <div class="card"><b class="mono">{summary.closedDays}</b><span>{plural(summary.closedDays, "день закрыт", "дня закрыто", "дней закрыто")}</span></div>
  <div class="card"><b class="mono">{summary.missed}</b><span>{plural(summary.missed, "пропуск", "пропуска", "пропусков")}</span></div>
  <div class="card"><b class="mono">{summary.streak}</b><span>{plural(summary.streak, "день", "дня", "дней")} подряд</span></div>
  <div class="card"><b class="mono">{hoursNum(summary.doneHours)} ч</b><span>из {hoursNum(summary.totalHours)}</span></div>
</div>

<h2>Последние дни</h2>
<div class="card">
  {#each recent as day (day.iso)}
    <div class="row">
      <!-- Переключателем стала только область названия. Кнопки действий —
           её СОСЕДИ: кнопка внутри кнопки это невалидная разметка. -->
      <button class="peek" aria-expanded={open === day.iso} aria-controls="day-{day.iso}"
              onclick={() => (open = open === day.iso ? null : day.iso)}>
        <span class="chev" aria-hidden="true">{open === day.iso ? "−" : "+"}</span>
        <span class="name">{dateShort(day.iso)}</span>
        <span class="meta" class:miss={day.missed}>
          {#if day.isToday}
            сегодня · {formatHours(day.hours)} из {formatHours(day.budget)}
          {:else if day.off}
            выходной
          {:else if day.missed}
            пропущен — финиш сдвинулся на день
          {:else}
            {formatHours(day.hours)} из {formatHours(day.budget)}
          {/if}
        </span>
      </button>
      <span class="end">
        <!-- Ярлыка «закрыт» здесь нет намеренно: 52 минуты из пяти часов —
             ещё не закрытый день, а соседняя колонка и так называет цифры. -->
        {#if day.hours > 0}
          <span></span>
        {:else if day.off}
          <button class="btn ghost small" onclick={() => setDayHours(day.iso, null)}>Вернуть в план</button>
        {:else}
          <button class="btn ghost small" onclick={() => setDayHours(day.iso, 0)}>Это был выходной</button>
        {/if}
      </span>
    </div>
    {#if open === day.iso}
      <DayDetail {units} iso={day.iso} isToday={day.isToday} id="day-{day.iso}" />
    {/if}
  {/each}
  {#if !allShown}
    <div class="more">
      <button class="btn ghost small" onclick={() => (shown += RECENT_STEP)}>
        Показать ещё {RECENT_STEP} дней
      </button>
    </div>
  {/if}
</div>

<p><small>Объявленный выходной не считается пропуском и не идёт в отставание — но и часы за него
  не начисляются, поэтому финиш всё равно отодвигается. Прятать это было бы нечестно.</small></p>

<p><small>План прошлого дня нигде не хранится — он пересчитывается заново из журнала по нынешним
  настройкам. Поменяете часы в день, выходные или профиль — состав «уехало» за прошлые дни станет
  другим. Закрытые часы при этом не меняются никогда: они и есть факт.</small></p>

<style>
  .pad { padding: 18px; }
  .scroll { overflow-x: auto; }
  .strip { display: inline-block; min-width: min-content; }

  .months { display: flex; gap: 3px; margin-bottom: 4px; }
  .months span { width: 13px; font-size: 10px; color: var(--text-faint); white-space: nowrap; }

  .heat { display: flex; gap: 3px; }
  .week { display: grid; grid-template-rows: repeat(7, 13px); gap: 3px; }
  /* Клетка теперь <button>, а легенда осталась <i class="lv"> — поэтому пары
     селекторов расщеплены. Дефолты кнопки гасятся явно: без border: 0 и
     box-sizing рамка съела бы те самые 13 px. */
  .cell, .lv { width: 13px; height: 13px; border-radius: 3px; background: var(--bg-soft); display: block; }
  .cell {
    padding: 0; border: 0; box-sizing: border-box; font: inherit; cursor: pointer;
  }
  .cell:disabled { cursor: default; }
  .cell.void { background: transparent; }
  .cell.off, .lv.off { background: transparent; box-shadow: inset 0 0 0 1px var(--border); }
  .cell.now, .lv.now { background: var(--surface); box-shadow: inset 0 0 0 2px var(--primary); }
  .cell.d1, .lv.d1 { background: color-mix(in srgb, var(--ok) 35%, var(--bg-soft)); }
  .cell.d2, .lv.d2 { background: color-mix(in srgb, var(--ok) 65%, var(--bg-soft)); }
  .cell.d3, .lv.d3 { background: var(--ok); }
  .cell.miss, .lv.miss { background: var(--miss-soft); box-shadow: inset 0 0 0 1px var(--miss); }
  .cell:hover:not(:disabled) { outline: 2px solid var(--primary); outline-offset: 1px; }

  .picked { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; }
  .picked-head {
    display: flex; align-items: center; gap: 12px; margin: 0 0 4px; padding-left: 44px;
    font-weight: 600; font-size: 13px;
  }
  .picked-head button { margin-left: auto; }
  .more { padding: 11px 16px; border-top: 1px solid var(--border); }

  .legend { display: flex; align-items: center; gap: 6px; font-size: 12px;
            color: var(--text-muted); margin-top: 12px; flex-wrap: wrap; }
  .legend .lv { display: inline-block; vertical-align: -2px; }
  .legend .gap { margin-left: 10px; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }

  .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px; margin-top: 16px; }
  .totals .card { padding: 12px 14px; }
  .totals b { display: block; font-size: 20px; }
  .totals span { color: var(--text-muted); font-size: 12px; }

  .row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-top: 1px solid var(--border); flex-wrap: wrap; }
  .row:first-child { border-top: 0; }
  .row .name { font-weight: 600; min-width: 130px; }
  .row .meta { color: var(--text-muted); font-size: 13px; }
  .row .meta.miss { color: var(--miss); }
  .row .end { margin-left: auto; }

  /* Кнопка-переключатель прикидывается частью строки: у неё нет ни рамки, ни
     фона, чтобы «Последние дни» выглядели так же, как раньше. */
  .peek {
    display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
    font: inherit; color: inherit; text-align: left; cursor: pointer;
    background: none; border: 0; padding: 0;
  }
  .peek:hover .name, .peek:focus-visible .name { color: var(--primary); }
  .peek .chev {
    width: 16px; flex: none; text-align: center; color: var(--text-faint);
    font-weight: 700;
  }

</style>

<script>
  /* Экран «Календарь»: сколько закрыто в каждый день и какие дни пропущены.
     Плюс возможность объявить день выходным задним числом — тогда он перестаёт
     считаться прогулом, но и часы за него не начисляются. */
  import { planner, setDayHours } from "../lib/store.svelte.js";
  import { addDays, diffDays, budgetForDay, hoursOnDay, fromIso } from "../lib/progress.js";
  import { dateShort, formatHours, hoursNum, plural, monthShort } from "../lib/format.js";

  let { summary, today } = $props();

  const RECENT = 14;
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
    for (let i = 0; i < RECENT; i++) {
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
              <i class={day.cls} title={day.title}></i>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>

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
  {/each}
</div>

<p><small>Объявленный выходной не считается пропуском и не идёт в отставание — но и часы за него
  не начисляются, поэтому финиш всё равно отодвигается. Прятать это было бы нечестно.</small></p>

<style>
  .pad { padding: 18px; }
  .scroll { overflow-x: auto; }
  .strip { display: inline-block; min-width: min-content; }

  .months { display: flex; gap: 3px; margin-bottom: 4px; }
  .months span { width: 13px; font-size: 10px; color: var(--text-faint); white-space: nowrap; }

  .heat { display: flex; gap: 3px; }
  .week { display: grid; grid-template-rows: repeat(7, 13px); gap: 3px; }
  .heat i, .lv { width: 13px; height: 13px; border-radius: 3px; background: var(--bg-soft); display: block; }
  .heat i.void { background: transparent; }
  .heat i.off, .lv.off { background: transparent; box-shadow: inset 0 0 0 1px var(--border); }
  .heat i.now, .lv.now { background: var(--surface); box-shadow: inset 0 0 0 2px var(--primary); }
  .heat i.d1, .lv.d1 { background: color-mix(in srgb, var(--ok) 35%, var(--bg-soft)); }
  .heat i.d2, .lv.d2 { background: color-mix(in srgb, var(--ok) 65%, var(--bg-soft)); }
  .heat i.d3, .lv.d3 { background: var(--ok); }
  .heat i.miss, .lv.miss { background: var(--miss-soft); box-shadow: inset 0 0 0 1px var(--miss); }

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
</style>

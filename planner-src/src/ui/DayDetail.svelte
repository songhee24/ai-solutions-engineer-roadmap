<script>
  /* Состав одного дня: что закрыто, сколько всего и что уехало дальше.
     Вынесено из «Календаря», потому что рисуется в двух местах — под
     теплокартой по клику на клетку и внутри строки «Последних дней». */
  import { planner } from "../lib/store.svelte.js";
  import { dayLog, movedFromDay, nextScheduledDay, hoursOnDay } from "../lib/progress.js";
  import { dateShort, formatHours } from "../lib/format.js";

  let { units, iso, isToday = false, id = undefined } = $props();

  let closed = $derived(dayLog(units, planner.log, iso));
  let total = $derived(hoursOnDay(planner.log, iso));
  /* «Уехало» считаем только для прошедших дней: сегодня ещё не кончилось, и
     объявлять его хвост уехавшим значило бы ругать авансом. */
  let moved = $derived(isToday ? [] : movedFromDay(units, planner, iso));
  let next = $derived(moved.length ? nextScheduledDay(planner, iso) : null);
</script>

<div class="detail" {id}>
  {#if closed.length === 0}
    <p class="empty">В этот день ничего не закрыто. Недоделанное не пропало — оно стоит первым
      в очереди следующего рабочего дня.</p>
  {:else}
    <ul>
      {#each closed as item, i (item.unitId + i)}
        <li>
          <span class="what">{item.unit ? item.unit.title : "Тема больше не в карте"}</span>
          <span class="hrs">{formatHours(item.hours)}</span>
        </li>
      {/each}
    </ul>
    <p class="sum">Всего за день — {formatHours(total)}</p>
  {/if}

  {#if moved.length}
    <p class="moved-head">Уехало на {next ? dateShort(next) : "следующий рабочий день"}</p>
    <ul class="moved">
      {#each moved as m (m.unit.id)}
        <li>
          <span class="what">{m.unit.title}</span>
          <span class="hrs">
            {formatHours(m.moved)}{#if m.done > 0} из {formatHours(m.planned)}{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .detail { padding: 0 16px 12px 44px; }
  .detail ul { list-style: none; margin: 0; padding: 0; }
  .detail li {
    display: flex; gap: 12px; align-items: baseline;
    padding: 5px 0; font-size: 13px;
  }
  .detail .what { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .detail .hrs { color: var(--text-muted); white-space: nowrap; }
  .detail .sum { margin: 6px 0 0; color: var(--text-muted); font-size: 12.5px; }
  .detail .empty { margin: 0; color: var(--text-muted); font-size: 13px; max-width: 62ch; }
  .detail .moved-head {
    margin: 10px 0 2px; color: var(--miss); font-size: 12.5px; font-weight: 600;
  }
  .detail ul.moved li { color: var(--text-muted); }
</style>

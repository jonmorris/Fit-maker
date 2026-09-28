<script lang="ts">
  import { outfitKey, piecesOf, recentWearMap, suggestOutfits, daysBetween, type Slot } from '../../engine/outfits';
  import { FORMALITIES, type Item } from '../../engine/types';
  import { needsFor } from '../../engine/weather';
  import { allItems } from '../../db/items';
  import { setSetting, settingsStore } from '../../db/settings';
  import { deleteWear, favoriteOutfits, logWear, recentWear, toggleFavorite } from '../../db/wear';
  import { loadTodayWeather, localDate, type TodayWeather } from '../../services/weather';
  import Icon from '../components/Icon.svelte';
  import OutfitCard from '../components/OutfitCard.svelte';
  import Thumb from '../components/Thumb.svelte';
  import WeatherCard from '../components/WeatherCard.svelte';
  import { CATEGORY_LABEL, FORMALITY_LABEL } from '../labels';
  import { today } from '../todayState.svelte';

  const date = localDate();

  let weather = $state<TodayWeather | null>(null);
  let loadingWeather = $state(true);

  async function refreshWeather(force = false) {
    loadingWeather = true;
    weather = await loadTodayWeather(force);
    loadingWeather = false;
  }
  refreshWeather();

  let items = $derived($allItems ?? []);
  let byId = $derived(new Map(items.map((i) => [i.id, i])));
  let wear = $derived($recentWear ?? []);
  let favs = $derived($favoriteOutfits ?? []);
  let dressCode = $derived($settingsStore?.dressCode ?? 'business-casual');
  let units = $derived($settingsStore?.units ?? 'F');
  let needs = $derived(needsFor(weather?.weather ?? null));

  let favoriteKeys = $derived(new Set(favs.map((f) => outfitKey(f.itemIds))));
  let wornTodayKeys = $derived(new Set(wear.filter((w) => w.date === date).map((w) => outfitKey(w.itemIds))));

  let result = $derived.by(() => {
    if (!$allItems || loadingWeather) return null;
    const recent = wear.filter((w) => daysBetween(w.date, date) < 14);
    return suggestOutfits({
      items,
      dressCode,
      needs,
      locked: today.locked,
      seed: today.seed,
      recentWear: recentWearMap(recent, date),
      recentOutfits: new Set(recent.map((w) => outfitKey(w.itemIds))),
      favorites: favoriteKeys,
    });
  });

  let hasLocks = $derived(Object.keys(today.locked).length > 0);

  function toggleLock(slot: Slot, item: Item) {
    if (today.locked[slot] === item.id) delete today.locked[slot];
    else today.locked[slot] = item.id;
  }

  const ids = (pieces: Partial<Record<Slot, Item>>) => piecesOf(pieces).map((i) => i.id);

  function dayLabel(d: string) {
    const diff = daysBetween(d, date);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: 'long' });
    return new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const resolve = (itemIds: string[]) => itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i);
</script>

<header class="page-header">
  <h1>Today</h1>
  <span class="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
</header>

<div class="stack">
  <WeatherCard data={weather} {needs} {units} loading={loadingWeather} onrefresh={() => refreshWeather(true)} />

  <div class="seg" role="group" aria-label="Dress code">
    {#each FORMALITIES as f (f)}
      <button aria-pressed={dressCode === f} onclick={() => setSetting('dressCode', f)}>{FORMALITY_LABEL[f]}</button>
    {/each}
  </div>

  {#if result}
    {#if result.missing.length}
      <section class="card empty">
        <h2>Almost there</h2>
        <p class="muted">
          Outfits need at least one active
          {result.missing.map((s) => CATEGORY_LABEL[s].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')} item.
        </p>
        <a class="btn btn-primary" href="#/item/new"><Icon name="plus" size={20} /> Add item</a>
      </section>
    {:else}
      <div class="toolbar">
        <h2>Suggestions</h2>
        {#if hasLocks}
          <button class="btn small" onclick={() => (today.locked = {})}><Icon name="lock" size={16} /> Clear locks</button>
        {/if}
        <button class="btn small" onclick={() => today.seed++}><Icon name="shuffle" size={18} /> Shuffle</button>
      </div>
      <p class="muted hint">Tap a piece to lock it and build around it.</p>

      {#each result.notices as n (n)}<p class="notice">{n}</p>{/each}

      {#each result.suggestions as s (s.key)}
        <OutfitCard
          suggestion={s}
          locked={today.locked}
          favorite={favoriteKeys.has(s.key)}
          wornToday={wornTodayKeys.has(s.key)}
          ontogglelock={toggleLock}
          onfavorite={() => toggleFavorite(ids(s.pieces))}
          onwear={() => logWear(ids(s.pieces), date)}
        />
      {/each}
    {/if}
  {/if}

  {#if favs.length}
    <section>
      <h2 class="section-title">Favorites</h2>
      <ul class="list">
        {#each favs as f (f.id)}
          {@const pieces = resolve(f.itemIds)}
          {#if pieces.length}
            <li class="row card">
              <div class="mini">
                {#each pieces as it (it.id)}<Thumb photoId={it.photoId} color={it.primaryColor.hex} alt={it.name} />{/each}
              </div>
              <button class="btn small" disabled={wornTodayKeys.has(outfitKey(f.itemIds))} onclick={() => logWear(f.itemIds, date)}>
                {wornTodayKeys.has(outfitKey(f.itemIds)) ? 'Logged' : 'Wear'}
              </button>
              <button class="icon" aria-label="Remove favorite" onclick={() => toggleFavorite(f.itemIds)}>
                <Icon name="star" size={20} filled />
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  {#if wear.length}
    <section>
      <h2 class="section-title">Recently worn</h2>
      <ul class="list">
        {#each wear.slice(0, 10) as w (w.id)}
          <li class="row card">
            <span class="day">{dayLabel(w.date)}</span>
            <div class="mini">
              {#each resolve(w.itemIds) as it (it.id)}<Thumb photoId={it.photoId} color={it.primaryColor.hex} alt={it.name} />{/each}
            </div>
            <button class="icon muted" aria-label="Remove from history" onclick={() => deleteWear(w.id)}>
              <Icon name="trash" size={18} />
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .page-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: var(--space-5) var(--space-4) var(--space-3);
  }
  h1 {
    font-size: var(--text-xl);
  }
  h2 {
    font-size: var(--text-md);
  }
  .stack {
    display: grid;
    gap: var(--space-3);
    padding: 0 var(--space-4);
  }
  .seg {
    display: flex;
    padding: 2px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .seg button {
    flex: 1;
    min-height: 36px;
    border: 0;
    border-radius: 6px;
    background: none;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .toolbar h2 {
    margin-right: auto;
  }
  .btn.small {
    min-height: 36px;
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .hint {
    margin: calc(-1 * var(--space-2)) 0 0;
    font-size: var(--text-xs);
  }
  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    font-size: var(--text-sm);
  }
  .empty {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }
  .empty p {
    margin: 0;
  }
  .section-title {
    margin: var(--space-3) 0 var(--space-2);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
  }
  .day {
    width: 76px;
    flex: none;
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .mini {
    flex: 1;
    display: flex;
    gap: 4px;
    min-width: 0;
  }
  .mini :global(.thumb) {
    width: 36px;
    flex: none;
  }
  .icon {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
  }
  .icon.muted {
    color: var(--text-muted);
  }
</style>

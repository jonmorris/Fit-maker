<script lang="ts">
  import { FAMILY_SWATCH } from '../../engine/color';
  import { CATEGORIES, COLOR_FAMILIES, FORMALITIES, STATUSES, type ColorFamily } from '../../engine/types';
  import { allItems } from '../../db/items';
  import { itemTypes, planCategories } from '../../db/plan';
  import Icon from '../components/Icon.svelte';
  import Thumb from '../components/Thumb.svelte';
  import { closet } from '../closetState.svelte';
  import { DEFAULT_FILTERS, countBy, filterItems } from '../filters';
  import { CATEGORY_LABEL, FORMALITY_LABEL, STATUS_LABEL, familyLabel } from '../labels';

  const f = closet.filters;

  let items = $derived($allItems ?? []);
  let cats = $derived($planCategories ?? []);
  let typeCategory = $derived(new Map(($itemTypes ?? []).map((t) => [t.id, t.categoryId])));
  let visible = $derived(filterItems(items, f, typeCategory));
  // Chip counts reflect the status and plan-category filters only, so chips don't vanish as you narrow down.
  let base = $derived(
    filterItems(items, { ...DEFAULT_FILTERS, status: f.status, planCategory: f.planCategory }, typeCategory),
  );
  let categoryCounts = $derived(countBy(base, (i) => i.category));
  let familyCounts = $derived(countBy(base, (i) => i.primaryColor.family));
  let presentFamilies = $derived(COLOR_FAMILIES.filter((c) => familyCounts.has(c) || f.families.includes(c)));
  let filtered = $derived(
    f.planCategory !== 'all' ||
      f.category !== 'all' || f.families.length > 0 || f.formality !== 'all' || f.query.trim() !== '',
  );

  function toggleFamily(c: ColorFamily) {
    f.families = f.families.includes(c) ? f.families.filter((x) => x !== c) : [...f.families, c];
  }

  function clear() {
    Object.assign(f, { ...DEFAULT_FILTERS, status: f.status, families: [] });
  }
</script>

<header class="head">
  <div class="title-row">
    <h1>Closet</h1>
    <span class="muted count">{visible.length}{visible.length !== base.length ? ` of ${base.length}` : ''} items</span>
  </div>
  <label class="search">
    <Icon name="search" size={18} />
    <span class="visually-hidden">Search</span>
    <input type="search" placeholder="Search name, type, fabric" bind:value={f.query} />
  </label>
</header>

<div class="filters">
  <div class="chips" role="group" aria-label="Category">
    <button class="chip" aria-pressed={f.category === 'all'} onclick={() => (f.category = 'all')}>
      All <span class="n">{base.length}</span>
    </button>
    {#each CATEGORIES as c (c)}
      <button class="chip" aria-pressed={f.category === c} onclick={() => (f.category = f.category === c ? 'all' : c)}>
        {CATEGORY_LABEL[c]} <span class="n">{categoryCounts.get(c) ?? 0}</span>
      </button>
    {/each}
  </div>

  {#if presentFamilies.length}
    <div class="chips" role="group" aria-label="Color">
      {#each presentFamilies as c (c)}
        <button
          class="swatch-chip"
          aria-pressed={f.families.includes(c)}
          aria-label="{familyLabel(c)} ({familyCounts.get(c) ?? 0})"
          title={familyLabel(c)}
          onclick={() => toggleFamily(c)}
        >
          <span class="dot" style:background={FAMILY_SWATCH[c]}></span>
          <span class="n">{familyCounts.get(c) ?? 0}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="row">
    {#if cats.length}
      <select class="input compact" bind:value={f.planCategory} aria-label="Plan category">
        <option value="all">All categories</option>
        {#each cats as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
        <option value="none">No type</option>
      </select>
    {/if}
    <select class="input compact" bind:value={f.formality} aria-label="Formality">
      <option value="all">Any formality</option>
      {#each FORMALITIES as v (v)}<option value={v}>{FORMALITY_LABEL[v]}</option>{/each}
    </select>
    <select class="input compact" bind:value={f.status} aria-label="Status">
      {#each STATUSES as v (v)}<option value={v}>{STATUS_LABEL[v]}</option>{/each}
      <option value="all">All statuses</option>
    </select>
    {#if filtered}
      <button class="link" onclick={clear}>Clear</button>
    {/if}
  </div>
</div>

{#if $allItems === undefined}
  <!-- loading -->
{:else if items.length === 0}
  <section class="empty card">
    <h2>Start your closet</h2>
    <p class="muted">Snap a photo of a garment, tap its color, pick a category. About 20 seconds per item.</p>
    <a class="btn btn-primary" href="#/item/new"><Icon name="camera" size={20} /> Add first item</a>
  </section>
{:else if visible.length === 0}
  <p class="muted none">Nothing matches these filters.</p>
{:else}
  <ul class="grid">
    {#each visible as item (item.id)}
      <li>
        <a href="#/item/{item.id}" class="tile">
          <Thumb photoId={item.photoId} color={item.primaryColor.hex} alt={item.name} />
          <span class="name">
            <span class="dot small" style:background={item.primaryColor.hex}></span>
            {item.name}
          </span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<a class="fab" href="#/item/new" aria-label="Add item"><Icon name="plus" size={28} /></a>

<style>
  .head {
    padding: var(--space-5) var(--space-4) var(--space-3);
    display: grid;
    gap: var(--space-3);
  }
  .title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  h1 {
    font-size: var(--text-xl);
  }
  .count {
    font-size: var(--text-sm);
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    min-height: 40px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text-muted);
  }
  .search input {
    flex: 1;
    border: 0;
    background: none;
    outline: none;
    color: var(--text);
    min-width: 0;
  }

  .filters {
    display: grid;
    gap: var(--space-2);
    padding-bottom: var(--space-3);
  }
  .chips {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding: 2px var(--space-4);
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chip,
  .swatch-chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .swatch-chip {
    padding: 0 10px 0 6px;
  }
  .chip[aria-pressed='true'],
  .swatch-chip[aria-pressed='true'] {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .n {
    font-weight: 500;
    opacity: 0.6;
    font-size: var(--text-xs);
  }
  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.35);
  }
  .dot.small {
    flex: none;
    width: 10px;
    height: 10px;
  }
  .row {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    align-items: center;
  }
  .compact {
    min-height: 36px;
    width: auto;
    flex: 1;
    font-size: var(--text-sm);
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font-weight: 600;
    min-height: 36px;
    cursor: pointer;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0 var(--space-4);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: var(--space-3);
  }
  .tile {
    display: grid;
    gap: 6px;
    color: inherit;
    text-decoration: none;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-xs);
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .empty {
    margin: var(--space-4);
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }
  .empty p {
    margin: 0;
  }
  .none {
    padding: var(--space-5) var(--space-4);
    text-align: center;
  }

  .fab {
    position: fixed;
    right: var(--space-4);
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--space-4));
    z-index: 5;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast);
    box-shadow: var(--shadow);
  }
</style>

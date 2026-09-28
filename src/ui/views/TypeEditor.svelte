<script lang="ts">
  import { liveQuery } from 'dexie';
  import { progressFor, type ItemType } from '../../engine/plan';
  import { SIZE_KINDS, SIZE_KIND_LABEL, sizeKindFor, type SizeKind } from '../../engine/sizes';
  import { CATEGORIES, type Category } from '../../engine/types';
  import { db } from '../../db/db';
  import { allItems } from '../../db/items';
  import { deleteType, planCategories, updateType } from '../../db/plan';
  import Icon from '../components/Icon.svelte';
  import Thumb from '../components/Thumb.svelte';
  import { CATEGORY_LABEL } from '../labels';
  import { navigate } from '../router.svelte';

  let { id }: { id: string } = $props();

  // svelte-ignore state_referenced_locally
  // null = no such type; undefined = still loading.
  const type$ = liveQuery(async () => (await db.itemTypes.get(id)) ?? null);

  let t = $derived($type$);
  let items = $derived(($allItems ?? []).filter((i) => i.typeId === id));
  let progress = $derived(t ? progressFor(t, $allItems ?? []) : null);
  let autoKind = $derived(t ? sizeKindFor(t.slot, t.name) : 'letter');
  let hasRange = $derived(!!t && (t.min !== undefined || t.max !== undefined));

  const patch = (p: Partial<ItemType>) => updateType(id, p);
  const clamp = (n: number) => Math.max(0, Math.min(99, n));

  function setTarget(n: number) {
    if (!t) return;
    const target = clamp(n);
    // Keep an explicit range around the new target.
    const p: Partial<ItemType> = { target };
    if (t.min !== undefined && t.min > target) p.min = target;
    if (t.max !== undefined && t.max < target) p.max = target;
    patch(p);
  }

  function toggleRange(on: boolean) {
    if (!t) return;
    patch(on ? { min: t.target, max: t.target } : { min: undefined, max: undefined });
  }

  async function remove() {
    if (!t) return;
    const msg = items.length
      ? `Delete “${t.name}”? Its ${items.length} items stay in your closet, just without a type.`
      : `Delete “${t.name}”?`;
    if (!confirm(msg)) return;
    await deleteType(id);
    navigate('/plan');
  }
</script>

{#snippet stepper(label: string, value: number, set: (n: number) => void)}
  <div class="stepper" role="group" aria-label={label}>
    <button type="button" aria-label="Decrease {label}" onclick={() => set(value - 1)} disabled={value <= 0}>−</button>
    <span class="value" aria-live="polite">{value}</span>
    <button type="button" aria-label="Increase {label}" onclick={() => set(value + 1)}>+</button>
  </div>
{/snippet}

<header class="bar">
  <a class="icon-btn" href="#/plan" aria-label="Back to plan"><Icon name="back" /></a>
  <h1>{t?.name ?? 'Item type'}</h1>
  <span></span>
</header>

{#if t === null}
  <p class="pad muted">This type no longer exists. <a href="#/plan">Back to plan</a></p>
{:else if t && progress}
  <div class="form">
    <section class="card status {progress.status}">
      <span class="big">{progress.owned}<span class="of"> / {progress.min === progress.max ? progress.max : `${progress.min}–${progress.max}`}</span></span>
      <span>
        {#if progress.status === 'under'}Need {progress.need} more
        {:else if progress.status === 'over'}{progress.extra} more than planned
        {:else}On target{/if}
      </span>
    </section>

    <label class="field">
      <span class="label">Name</span>
      <input class="input" value={t.name} onchange={(e) => e.currentTarget.value.trim() && patch({ name: e.currentTarget.value.trim() })} />
    </label>

    <label class="field">
      <span class="label">Category</span>
      <select class="input" value={t.categoryId} onchange={(e) => patch({ categoryId: e.currentTarget.value })}>
        {#each $planCategories ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
      </select>
    </label>

    <div class="row-field">
      <span class="label">{hasRange ? 'Ideal number' : 'How many you want'}</span>
      {@render stepper('target', t.target, setTarget)}
    </div>

    <label class="toggle">
      <span>
        <span class="t-title">Allow a range</span>
        <span class="muted t-sub">e.g. 5–8 T-shirts is fine</span>
      </span>
      <input type="checkbox" role="switch" checked={hasRange} onchange={(e) => toggleRange(e.currentTarget.checked)} />
    </label>
    {#if hasRange}
      <div class="range">
        <div class="row-field">
          <span class="label">Minimum</span>
          {@render stepper('minimum', t.min ?? t.target, (n) => patch({ min: Math.min(clamp(n), t!.max ?? t!.target) }))}
        </div>
        <div class="row-field">
          <span class="label">Maximum</span>
          {@render stepper('maximum', t.max ?? t.target, (n) => patch({ max: Math.max(clamp(n), t!.min ?? t!.target) }))}
        </div>
      </div>
    {/if}

    <label class="toggle">
      <span>
        <span class="t-title">Just count them</span>
        <span class="muted t-sub">For socks, underwear and such: enter a number instead of adding each item</span>
      </span>
      <input type="checkbox" role="switch" checked={t.countOnly} onchange={(e) => patch({ countOnly: e.currentTarget.checked })} />
    </label>
    {#if t.countOnly}
      <div class="row-field">
        <span class="label">How many you own</span>
        {@render stepper('owned', t.ownedCount, (n) => patch({ ownedCount: clamp(n) }))}
      </div>
    {/if}

    <label class="field">
      <span class="label">Notes</span>
      <textarea class="input" placeholder="1 brown, 1 black" value={t.notes} onchange={(e) => patch({ notes: e.currentTarget.value.trim() })}></textarea>
    </label>

    <label class="field">
      <span class="label">Need new</span>
      <input class="input" placeholder="What to buy or replace, e.g. “brown belt”" value={t.shopping} onchange={(e) => patch({ shopping: e.currentTarget.value.trim() })} />
    </label>

    <details class="advanced">
      <summary>Outfit slot & size format</summary>
      <label class="field">
        <span class="label">Outfit slot</span>
        <select class="input" value={t.slot} onchange={(e) => patch({ slot: e.currentTarget.value as Category })}>
          {#each CATEGORIES as c (c)}<option value={c}>{c === 'other' ? 'Other (never in outfits)' : CATEGORY_LABEL[c]}</option>{/each}
        </select>
      </label>
      <label class="field">
        <span class="label">Size format</span>
        <select class="input" value={t.sizeKind ?? ''} onchange={(e) => patch({ sizeKind: (e.currentTarget.value || undefined) as SizeKind | undefined })}>
          <option value="">Automatic ({SIZE_KIND_LABEL[autoKind]})</option>
          {#each SIZE_KINDS as k (k)}<option value={k}>{SIZE_KIND_LABEL[k]}</option>{/each}
        </select>
      </label>
    </details>

    {#if !t.countOnly}
      <section class="field">
        <span class="label">In your closet ({items.length})</span>
        {#if items.length}
          <ul class="thumbs">
            {#each items as it (it.id)}
              <li>
                <a href="#/item/{it.id}" class:faded={it.status === 'donate'}>
                  <Thumb photoId={it.photoId} color={it.primaryColor.hex} alt={it.name} />
                  <span class="name">{it.name}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
        <a class="btn btn-block" href="#/item/new?type={id}"><Icon name="plus" size={18} /> Add {t.name.toLowerCase()}</a>
      </section>
    {/if}

    <button class="btn btn-danger btn-block" onclick={remove}>Delete type</button>
  </div>
{/if}

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: var(--tap) 1fr var(--tap);
    align-items: center;
    gap: var(--space-2);
    padding: calc(var(--safe-top) + var(--space-2)) var(--space-4) var(--space-2);
    margin-top: calc(-1 * var(--safe-top));
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }
  h1 {
    font-size: var(--text-md);
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    color: var(--text);
  }
  .pad {
    padding: var(--space-4);
  }
  .form {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-4);
    max-width: 640px;
    margin: 0 auto var(--space-6);
  }

  .status {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    border-color: color-mix(in srgb, var(--status) 40%, var(--border));
    background: color-mix(in srgb, var(--status) 8%, var(--surface));
    color: var(--status);
    font-weight: 600;
  }
  .status.under {
    --status: var(--danger);
  }
  .status.ok {
    --status: #3b7d4a;
  }
  .status.over {
    --status: #c77d1a;
  }
  .big {
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .of {
    font-size: var(--text-md);
    font-weight: 500;
    opacity: 0.75;
  }

  .row-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .row-field .label,
  .field .label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-muted);
  }
  .range {
    display: grid;
    gap: var(--space-3);
    margin-top: calc(-1 * var(--space-3));
  }
  .stepper {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .stepper button {
    width: var(--tap);
    height: var(--tap);
    border: 0;
    background: none;
    font-size: 22px;
    cursor: pointer;
  }
  .stepper button:disabled {
    opacity: 0.35;
  }
  .value {
    min-width: 36px;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    cursor: pointer;
  }
  .toggle > span {
    display: grid;
  }
  .t-title {
    font-weight: 600;
  }
  .t-sub {
    font-size: var(--text-sm);
  }

  .advanced {
    display: grid;
    gap: var(--space-4);
  }
  .advanced summary {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
  }
  .advanced[open] summary {
    margin-bottom: var(--space-3);
  }
  .advanced .field + .field {
    margin-top: var(--space-3);
  }

  .thumbs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--space-2);
  }
  .thumbs a {
    display: grid;
    gap: 4px;
    color: inherit;
    text-decoration: none;
  }
  .thumbs a.faded {
    opacity: 0.45;
  }
  .name {
    font-size: var(--text-xs);
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>

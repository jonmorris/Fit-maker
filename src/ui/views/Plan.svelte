<script lang="ts">
  import { parsePlanTable, planProgress, planSummary, type PlanStatus, type TypeProgress } from '../../engine/plan';
  import { allItems } from '../../db/items';
  import { addCategory, addType, deleteCategory, importPlan, itemTypes, planCategories, updateCategory, updateType } from '../../db/plan';
  import Icon from '../components/Icon.svelte';
  import { navigate } from '../router.svelte';

  type Filter = 'all' | PlanStatus;
  let filter = $state<Filter>('all');
  let editing = $state<string | null>(null);
  let newCategory = $state('');
  let newTypeName = $state<Record<string, string>>({});
  let importText = $state('');
  let importOpen = $state(false);
  let importMessage = $state('');

  let cats = $derived($planCategories ?? []);
  let types = $derived($itemTypes ?? []);
  let progress = $derived(planProgress(types, $allItems ?? []));
  let summary = $derived(planSummary(progress));
  let byCategory = $derived.by(() => {
    const m = new Map<string, TypeProgress[]>();
    for (const p of progress) {
      if (filter !== 'all' && p.status !== filter) continue;
      m.set(p.type.categoryId, [...(m.get(p.type.categoryId) ?? []), p]);
    }
    return m;
  });
  let preview = $derived(importText.trim() ? parsePlanTable(importText) : null);
  let loaded = $derived($planCategories !== undefined && $itemTypes !== undefined);

  async function createCategory(e: SubmitEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    await addCategory(newCategory);
    newCategory = '';
  }

  async function createType(e: SubmitEvent, categoryId: string) {
    e.preventDefault();
    const name = newTypeName[categoryId]?.trim();
    if (!name) return;
    await addType(categoryId, name);
    newTypeName[categoryId] = '';
  }

  async function removeCategory(id: string, name: string) {
    const count = types.filter((t) => t.categoryId === id).length;
    const msg = count
      ? `Delete “${name}” and its ${count} item types? Your items stay in the closet, just without a type.`
      : `Delete “${name}”?`;
    if (confirm(msg)) {
      await deleteCategory(id);
      editing = null;
    }
  }

  async function runImport() {
    if (!preview?.types.length) return;
    const { added, updated } = await importPlan(preview);
    importMessage = `Added ${added} types${updated ? `, updated ${updated}` : ''}.`;
    importText = '';
    importOpen = false;
  }

  const rangeLabel = (p: TypeProgress) => (p.min === p.max ? `${p.max}` : `${p.min}–${p.max}`);
</script>

<header class="page-header">
  <h1>Plan</h1>
  {#if types.length}
    <span class="muted">{types.length} types</span>
  {/if}
</header>

<div class="stack">
  {#if types.length}
    <div class="seg" role="group" aria-label="Show">
      <button aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
      <button aria-pressed={filter === 'under'} onclick={() => (filter = 'under')}>
        <span class="dot under"></span> Need {summary.under}
      </button>
      <button aria-pressed={filter === 'ok'} onclick={() => (filter = 'ok')}>
        <span class="dot ok"></span> On target {summary.ok}
      </button>
      <button aria-pressed={filter === 'over'} onclick={() => (filter = 'over')}>
        <span class="dot over"></span> Over {summary.over}
      </button>
    </div>
  {:else if loaded}
    <section class="card intro">
      <h2>Plan your wardrobe</h2>
      <p class="muted">
        Make your own categories (Basics, Casual, Golf…) and item types with a target count. The plan compares
        them with what's in your closet, so you can see what to buy and what you have too much of.
      </p>
      <p class="muted">Start with a category below, or paste a table from a spreadsheet.</p>
    </section>
  {/if}

  {#if importMessage}<p class="notice" role="status">{importMessage}</p>{/if}

  {#each cats as cat (cat.id)}
    {@const rows = byCategory.get(cat.id) ?? []}
    {#if filter === 'all' || rows.length}
      <section class="category">
        <div class="cat-head">
          <h2>{cat.name}</h2>
          {#if !cat.inOutfits}<span class="badge">Not in outfits</span>{/if}
          <button class="icon-btn" aria-label="Edit {cat.name}" aria-pressed={editing === cat.id} onclick={() => (editing = editing === cat.id ? null : cat.id)}>
            <Icon name="settings" size={18} />
          </button>
        </div>

        {#if editing === cat.id}
          <div class="card cat-edit">
            <label class="field">
              <span class="label">Name</span>
              <input class="input" value={cat.name} onchange={(e) => e.currentTarget.value.trim() && updateCategory(cat.id, { name: e.currentTarget.value.trim() })} />
            </label>
            <label class="toggle">
              <span>
                <span class="t-title">Use in outfit suggestions</span>
                <span class="muted t-sub">Turn off for golf, workout or other special-purpose clothes</span>
              </span>
              <input type="checkbox" role="switch" checked={cat.inOutfits} onchange={(e) => updateCategory(cat.id, { inOutfits: e.currentTarget.checked })} />
            </label>
            <button class="btn btn-danger" onclick={() => removeCategory(cat.id, cat.name)}>Delete category</button>
          </div>
        {/if}

        {#if rows.length}
          <ul class="types card">
            {#each rows as p (p.type.id)}
              <li>
                <button class="type-row" onclick={() => navigate(`/type/${p.type.id}`)}>
                  <span class="type-main">
                    <span class="type-name">{p.type.name}</span>
                    {#if p.status === 'under' && p.type.shopping}
                      <span class="sub buy">Need new: {p.type.shopping}</span>
                    {:else if p.type.notes}
                      <span class="sub muted">{p.type.notes}</span>
                    {/if}
                  </span>
                  {#if !p.type.countOnly}
                    <span class="count {p.status}" title={p.status === 'under' ? `Need ${p.need} more` : p.status === 'over' ? `${p.extra} over` : 'On target'}>
                      {p.owned}<span class="of">/{rangeLabel(p)}</span>
                    </span>
                  {/if}
                </button>
                {#if p.type.countOnly}
                  <!-- Count-only types (socks, underwear…): adjust the number right here. -->
                  <span class="quick">
                    <button aria-label="One fewer {p.type.name}" disabled={p.owned <= 0} onclick={() => updateType(p.type.id, { ownedCount: p.owned - 1 })}>−</button>
                    <span class="count {p.status}">{p.owned}<span class="of">/{rangeLabel(p)}</span></span>
                    <button aria-label="One more {p.type.name}" onclick={() => updateType(p.type.id, { ownedCount: p.owned + 1 })}>+</button>
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}

        {#if filter === 'all'}
          <form class="add-row" onsubmit={(e) => createType(e, cat.id)}>
            <input class="input" placeholder="Add a type to {cat.name}…" bind:value={newTypeName[cat.id]} />
            <button class="btn" disabled={!newTypeName[cat.id]?.trim()}>Add</button>
          </form>
        {/if}
      </section>
    {/if}
  {/each}

  {#if filter === 'all'}
    <form class="add-row" onsubmit={createCategory}>
      <input class="input" placeholder="New category (e.g. Golf)" bind:value={newCategory} />
      <button class="btn btn-primary" disabled={!newCategory.trim()}><Icon name="plus" size={18} /> Category</button>
    </form>

    <section class="card">
      <button class="import-toggle" aria-expanded={importOpen || !types.length} onclick={() => (importOpen = !importOpen)}>
        <span>Import from a spreadsheet</span>
        <span class="muted">{importOpen || !types.length ? '–' : '+'}</span>
      </button>
      {#if importOpen || !types.length}
        <p class="muted small">
          Copy rows from Google Sheets, Numbers or Excel and paste them here. Columns are matched by header:
          <strong>Category</strong>, <strong>Item</strong>, <strong>#</strong> (target), <strong>Description</strong>,
          <strong>Need New</strong>. Other columns are ignored, and re-importing updates existing types.
        </p>
        <textarea class="input paste" placeholder={'Cat\tItem\t#\tItem Description\tNeed New\nCa\tJeans\t4\t2 blue, 1 tan\tYes'} bind:value={importText}></textarea>
        {#if preview}
          <p class="small">
            {#if preview.types.length}
              {preview.categories.length} categories · {preview.types.length} types:
              <span class="muted">{preview.categories.join(', ')}</span>
            {:else}
              <span class="muted">No rows found. Make sure there's an Item column.</span>
            {/if}
          </p>
        {/if}
        <button class="btn btn-primary btn-block" disabled={!preview?.types.length} onclick={runImport}>Import</button>
      {/if}
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
    gap: var(--space-4);
    padding: 0 var(--space-4);
  }
  .intro p {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
  }
  .seg {
    display: flex;
    padding: 2px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    overflow-x: auto;
  }
  .seg button {
    flex: 1 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: 6px;
    background: none;
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot.under,
  .count.under {
    --status: var(--danger);
  }
  .dot.ok,
  .count.ok {
    --status: #3b7d4a;
  }
  .dot.over,
  .count.over {
    --status: #c77d1a;
  }
  .dot {
    background: var(--status);
  }
  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    font-size: var(--text-sm);
  }

  .category {
    display: grid;
    gap: var(--space-2);
  }
  .cat-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .cat-head h2 {
    margin-right: auto;
  }
  .badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .icon-btn[aria-pressed='true'] {
    background: var(--surface-2);
    color: var(--text);
  }
  .cat-edit {
    display: grid;
    gap: var(--space-3);
  }

  .types {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .types li {
    display: flex;
    align-items: center;
  }
  .types li + li {
    border-top: 1px solid var(--border);
  }
  .quick {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: var(--space-2);
  }
  .quick button {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: var(--surface-2);
    font-size: 20px;
    cursor: pointer;
  }
  .quick button:disabled {
    opacity: 0.35;
  }
  .type-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 52px;
    padding: var(--space-2) var(--space-3);
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .type-main {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .type-name {
    font-weight: 600;
  }
  .sub {
    font-size: var(--text-xs);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sub.buy {
    color: var(--danger);
    font-weight: 600;
  }
  .count {
    flex: none;
    min-width: 56px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--status) 14%, transparent);
    color: var(--status);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .of {
    font-weight: 500;
    opacity: 0.75;
  }

  .add-row {
    display: flex;
    gap: var(--space-2);
  }
  .add-row .input {
    flex: 1;
    min-width: 0;
  }

  .import-toggle {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    font-weight: 600;
    cursor: pointer;
  }
  .small {
    margin: var(--space-3) 0;
    font-size: var(--text-sm);
  }
  .paste {
    min-height: 140px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 16px;
    white-space: pre;
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
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
</style>

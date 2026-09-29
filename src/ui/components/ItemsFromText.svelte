<script lang="ts">
  // Paste an item list (e.g. written by Claude from your screenshots or order
  // emails) and add those items to the closet, matched to your plan types.
  import { parseItemsText, resolveEntries } from '../../engine/itemImport';
  import { formatSize } from '../../engine/sizes';
  import { db, newId } from '../../db/db';
  import { allItems } from '../../db/items';
  import { itemTypes, planCategories } from '../../db/plan';
  import { CATEGORY_DEFAULTS, CATEGORY_LABEL } from '../labels';

  let text = $state('');
  let message = $state('');
  let includeDuplicates = $state(false);

  let parsed = $derived(parseItemsText(text));
  // Ids are only for the preview; fresh ones are made on import.
  let resolved = $derived(
    resolveEntries(parsed.entries, {
      categories: $planCategories ?? [],
      types: $itemTypes ?? [],
      existing: $allItems ?? [],
      newId: () => '',
      defaults: (slot) => CATEGORY_DEFAULTS[slot],
    }),
  );
  let toAdd = $derived(resolved.filter((r) => includeDuplicates || !r.duplicate));
  let catName = $derived(new Map(($planCategories ?? []).map((c) => [c.id, c.name])));

  const metaLine = (r: (typeof resolved)[number]) =>
    [r.type ? `${catName.get(r.type.categoryId)} · ${r.type.name}` : CATEGORY_LABEL[r.item.category], formatSize(r.item.size)]
      .filter(Boolean)
      .join(' · ');

  async function add() {
    const items = toAdd.map((r) => ({ ...$state.snapshot(r.item), id: newId() }));
    await db.items.bulkAdd(items);
    message = `Added ${items.length} item${items.length === 1 ? '' : 's'} to your closet.`;
    text = '';
    includeDuplicates = false;
  }
</script>

<section class="card">
  <h2>Add items from text</h2>
  <p class="muted small">
    Paste an item list, e.g. one Claude wrote from your screenshots, order emails or descriptions. Items are matched to
    your plan types by name; you can add photos later.
  </p>
  <textarea class="input paste" placeholder={'{ "items": [ { "name": "Navy chinos", "type": "Jeans", "color": "#1f2a44", "size": "32x30" } ] }'} bind:value={text}></textarea>

  {#if parsed.error}
    <p class="error small">{parsed.error}</p>
  {:else if resolved.length}
    <ul class="preview">
      {#each resolved as r, i (i)}
        <li class:dup={r.duplicate && !includeDuplicates}>
          <span class="dot" style:background={r.item.primaryColor.hex}></span>
          <span class="main">
            <span class="name">{r.item.name}</span>
            <span class="meta muted">{metaLine(r)}</span>
            {#if r.unmatchedType}<span class="warn">No “{r.unmatchedType}” type in your plan; added without a type</span>{/if}
            {#if r.duplicate}<span class="warn">Already in your closet</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
    {#if resolved.some((r) => r.duplicate)}
      <label class="dup-toggle small">
        <input type="checkbox" bind:checked={includeDuplicates} /> Add duplicates anyway
      </label>
    {/if}
  {/if}

  <button class="btn btn-primary btn-block" disabled={!toAdd.length} onclick={add}>
    {toAdd.length ? `Add ${toAdd.length} item${toAdd.length === 1 ? '' : 's'}` : 'Add items'}
  </button>
  {#if message}<p class="small" role="status">{message} <a href="#/closet">View closet</a></p>{/if}
</section>

<style>
  h2 {
    font-size: var(--text-md);
    margin-bottom: var(--space-3);
  }
  .small {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .paste {
    min-height: 120px;
    margin-bottom: var(--space-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 16px;
  }
  .error {
    color: var(--danger);
  }
  .preview {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: grid;
    gap: var(--space-2);
    max-height: 320px;
    overflow-y: auto;
  }
  .preview li {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
  }
  .preview li.dup {
    opacity: 0.5;
  }
  .dot {
    flex: none;
    width: 20px;
    height: 20px;
    margin-top: 2px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.35);
  }
  .main {
    display: grid;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    font-size: var(--text-sm);
  }
  .meta,
  .warn {
    font-size: var(--text-xs);
  }
  .warn {
    color: #c77d1a;
    font-weight: 600;
  }
  .dup-toggle {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  a {
    color: var(--accent);
  }
</style>

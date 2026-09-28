<script lang="ts">
  import { SLOTS, type Slot, type Suggestion } from '../../engine/outfits';
  import type { Item } from '../../engine/types';
  import Icon from './Icon.svelte';
  import Thumb from './Thumb.svelte';

  let {
    suggestion,
    locked,
    favorite,
    wornToday,
    ontogglelock,
    onfavorite,
    onwear,
  }: {
    suggestion: Suggestion;
    locked: Partial<Record<Slot, string>>;
    favorite: boolean;
    wornToday: boolean;
    ontogglelock: (slot: Slot, item: Item) => void;
    onfavorite: () => void;
    onwear: () => void;
  } = $props();

  const SLOT_LABEL: Record<Slot, string> = { top: 'Top', bottom: 'Bottom', shoes: 'Shoes', layer: 'Layer', outerwear: 'Coat' };

  let slots = $derived(SLOTS.filter((s) => suggestion.pieces[s]));
</script>

<article class="card outfit">
  <ul class="pieces">
    {#each slots as slot (slot)}
      {@const it = suggestion.pieces[slot]!}
      {@const isLocked = locked[slot] === it.id}
      <li>
        <button
          class="piece"
          class:locked={isLocked}
          aria-pressed={isLocked}
          aria-label="{isLocked ? 'Unlock' : 'Lock'} {it.name}"
          onclick={() => ontogglelock(slot, it)}
        >
          <Thumb photoId={it.photoId} color={it.primaryColor.hex} alt="" />
          {#if isLocked}<span class="lock"><Icon name="lock" size={14} /></span>{/if}
        </button>
        <span class="label">{SLOT_LABEL[slot]}</span>
        <span class="name">{it.name}</span>
      </li>
    {/each}
  </ul>

  {#if suggestion.reasons.length || suggestion.warnings.length}
    <ul class="tags">
      {#each suggestion.warnings as w (w)}<li class="warn">⚠ {w}</li>{/each}
      {#each suggestion.reasons as r (r)}<li>{r}</li>{/each}
    </ul>
  {/if}

  <div class="actions">
    <span class="muted score" title="Match score">{suggestion.score}</span>
    <button class="btn fav" aria-pressed={favorite} aria-label={favorite ? 'Unfavorite' : 'Favorite'} onclick={onfavorite}>
      <Icon name="star" size={20} filled={favorite} />
    </button>
    <button class="btn wear" class:done={wornToday} onclick={onwear} disabled={wornToday}>
      {#if wornToday}<Icon name="check" size={18} /> Logged{:else}Wore this{/if}
    </button>
  </div>
</article>

<style>
  .outfit {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
  }
  .pieces {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .pieces li {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
    min-width: 0;
  }
  .piece {
    position: relative;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }
  .piece.locked {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .lock {
    position: absolute;
    right: 4px;
    bottom: 4px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .name {
    font-size: var(--text-xs);
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .tags {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tags li {
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: var(--text-xs);
  }
  .tags li.warn {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
    font-weight: 600;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .score {
    margin-right: auto;
    font-size: var(--text-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .fav {
    width: var(--tap);
    padding: 0;
  }
  .fav[aria-pressed='true'] {
    color: var(--accent);
  }
  .wear {
    min-width: 120px;
  }
  .wear.done {
    opacity: 1;
    color: var(--text-muted);
  }
</style>

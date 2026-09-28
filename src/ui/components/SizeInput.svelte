<script lang="ts">
  // Size picker that adapts to the size format: chips for letter sizes,
  // native selects (iOS wheel pickers) for numeric ones.
  import {
    BELT_SIZES, CHEST_SIZES, INSEAM_SIZES, JACKET_LENGTHS, LETTER_SIZES, NECK_SIZES, SHOE_SIZES, SHOE_SYSTEMS,
    SHOE_SYSTEM_LABEL, SLEEVE_SIZES, WAIST_SIZES, makeSize, sizeParts, type ItemSize, type ShoeSystem, type SizeKind,
  } from '../../engine/sizes';

  let {
    kind,
    value = $bindable(),
    label = 'Size',
    defaultSystem = 'US-M',
  }: {
    kind: SizeKind;
    value: ItemSize | undefined;
    label?: string;
    defaultSystem?: ShoeSystem;
  } = $props();

  // Only read value when it matches the current format; a leftover size of another kind shows as empty.
  let parts = $derived(value?.kind === kind ? sizeParts(value) : (['', ''] as [string, string]));
  // svelte-ignore state_referenced_locally
  let system = $state<ShoeSystem>(value?.system ?? defaultSystem);
  $effect(() => {
    if (value?.system) system = value.system;
  });

  function set(a: string, b: string) {
    value = makeSize(kind, a, b, system);
  }

  function setSystem(s: ShoeSystem) {
    system = s;
    // A size number doesn't carry over between systems.
    value = undefined;
  }
</script>

{#if kind === 'letter'}
  <div class="chips" role="group" aria-label={label}>
    {#each LETTER_SIZES as s (s)}
      <button type="button" aria-pressed={parts[0] === s} onclick={() => set(parts[0] === s ? '' : s, '')}>{s}</button>
    {/each}
  </div>
{:else if kind === 'one-size'}
  <p class="muted one">One size</p>
{:else}
  <div class="row">
    {#if kind === 'shoe'}
      <select class="input" aria-label="{label} system" value={system} onchange={(e) => setSystem(e.currentTarget.value as ShoeSystem)}>
        {#each SHOE_SYSTEMS as s (s)}<option value={s}>{SHOE_SYSTEM_LABEL[s]}</option>{/each}
      </select>
      <select class="input" aria-label={label} value={parts[0]} onchange={(e) => set(e.currentTarget.value, '')}>
        <option value="">Size</option>
        {#each SHOE_SIZES[system] as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    {:else if kind === 'dress-shirt'}
      <select class="input" aria-label="{label} neck" value={parts[0]} onchange={(e) => set(e.currentTarget.value, parts[1])}>
        <option value="">Neck</option>
        {#each NECK_SIZES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
      <select class="input" aria-label="{label} sleeve" value={parts[1]} disabled={!parts[0]} onchange={(e) => set(parts[0], e.currentTarget.value)}>
        <option value="">Sleeve</option>
        {#each SLEEVE_SIZES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    {:else if kind === 'jacket'}
      <select class="input" aria-label="{label} chest" value={parts[0]} onchange={(e) => set(e.currentTarget.value, parts[1] || 'R')}>
        <option value="">Chest</option>
        {#each CHEST_SIZES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
      <select class="input" aria-label="{label} length" value={parts[1]} disabled={!parts[0]} onchange={(e) => set(parts[0], e.currentTarget.value)}>
        {#if !parts[0]}<option value="">Length</option>{/if}
        {#each JACKET_LENGTHS as s (s)}<option value={s}>{s === 'S' ? 'Short' : s === 'R' ? 'Regular' : s === 'L' ? 'Long' : 'Extra long'}</option>{/each}
      </select>
    {:else if kind === 'waist-inseam'}
      <select class="input" aria-label="{label} waist" value={parts[0]} onchange={(e) => set(e.currentTarget.value, parts[1])}>
        <option value="">Waist</option>
        {#each WAIST_SIZES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
      <select class="input" aria-label="{label} inseam" value={parts[1]} disabled={!parts[0]} onchange={(e) => set(parts[0], e.currentTarget.value)}>
        <option value="">Inseam</option>
        {#each INSEAM_SIZES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    {:else}
      <select class="input" aria-label={label} value={parts[0]} onchange={(e) => set(e.currentTarget.value, '')}>
        <option value="">{kind === 'belt' ? 'Belt size' : 'Waist'}</option>
        {#each kind === 'belt' ? BELT_SIZES : WAIST_SIZES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    {/if}
  </div>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chips button {
    min-width: 48px;
    min-height: 40px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .chips button[aria-pressed='true'] {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .row {
    display: flex;
    gap: var(--space-2);
  }
  .row select {
    flex: 1;
    min-width: 0;
  }
  .one {
    margin: 0;
  }
</style>

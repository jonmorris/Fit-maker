<script lang="ts">
  import { colorFamily, isHex, normalizeHex } from '../../engine/color';
  import { COLOR_FAMILIES, type ColorTag } from '../../engine/types';
  import { familyLabel } from '../labels';

  let {
    label,
    value = $bindable(),
    active = false,
    onactivate,
    onremove,
  }: {
    label: string;
    value: ColorTag | undefined;
    /** Highlighted when the eyedropper will write into this field. */
    active?: boolean;
    onactivate?: () => void;
    onremove?: () => void;
  } = $props();

  let hexText = $state(value?.hex ?? '');
  $effect(() => {
    hexText = value?.hex ?? '';
  });

  // Only commit complete 6-digit hex while typing, so "#abc" isn't expanded mid-entry.
  const FULL_HEX = /^#?[0-9a-f]{6}$/i;

  function setHex(raw: string) {
    if (!isHex(raw)) return;
    const hex = normalizeHex(raw);
    value = { hex, family: colorFamily(hex) };
  }
</script>

<div class="color-field" class:active>
  <button type="button" class="head" onclick={onactivate} aria-pressed={active}>
    <span class="label">{label}</span>
    {#if onactivate}<span class="target">{active ? 'Picking' : 'Pick from photo'}</span>{/if}
  </button>
  <div class="row">
    <label class="swatch" style:background={value?.hex ?? 'transparent'} class:empty={!value}>
      <span class="visually-hidden">{label} picker</span>
      <input type="color" value={value?.hex ?? '#808080'} oninput={(e) => setHex(e.currentTarget.value)} />
    </label>
    <input
      class="input hex"
      aria-label="{label} hex"
      placeholder="#rrggbb"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      bind:value={hexText}
      oninput={() => FULL_HEX.test(hexText.trim()) && setHex(hexText)}
      onblur={() => {
        setHex(hexText);
        hexText = value?.hex ?? '';
      }}
    />
    <select
      class="input family"
      aria-label="{label} family"
      disabled={!value}
      value={value?.family}
      onchange={(e) => value && (value = { ...value, family: e.currentTarget.value as ColorTag['family'] })}
    >
      {#each COLOR_FAMILIES as f (f)}<option value={f}>{familyLabel(f)}</option>{/each}
    </select>
    {#if onremove}
      <button type="button" class="remove" aria-label="Remove {label}" onclick={onremove}>×</button>
    {/if}
  </div>
</div>

<style>
  .color-field {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .color-field.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 0;
    padding: 0;
    background: none;
    cursor: pointer;
    text-align: left;
  }
  .label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-muted);
  }
  .target {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--accent);
  }
  .row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .swatch {
    position: relative;
    flex: none;
    width: var(--tap);
    height: var(--tap);
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.35);
    overflow: hidden;
    cursor: pointer;
  }
  .swatch.empty {
    background: repeating-conic-gradient(var(--surface-2) 0 25%, var(--surface) 0 50%) 0 0 / 12px 12px !important;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .hex {
    flex: 1;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }
  .family {
    flex: 1;
    min-width: 0;
  }
  .remove {
    flex: none;
    width: var(--tap);
    height: var(--tap);
    border: 0;
    background: none;
    font-size: 24px;
    color: var(--text-muted);
    cursor: pointer;
  }
</style>

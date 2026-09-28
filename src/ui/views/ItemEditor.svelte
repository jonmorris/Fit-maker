<script lang="ts">
  import { colorFamily } from '../../engine/color';
  import { SIZE_KINDS, SIZE_KIND_LABEL, defaultSizeForKind, sizeKindFor, type ItemSize, type SizeKind } from '../../engine/sizes';
  import { progressFor } from '../../engine/plan';
  import {
    CATEGORIES, FORMALITIES, PATTERNS, STATUSES,
    type Category, type ColorTag, type Formality, type Item, type ItemAttributes, type Status,
  } from '../../engine/types';
  import { db, newId } from '../../db/db';
  import { allItems, deleteItem, deletePhoto, savePhoto, saveItem } from '../../db/items';
  import { itemTypes, planCategories } from '../../db/plan';
  import { settingsStore } from '../../db/settings';
  import { compressPhoto } from '../../services/photo';
  import ColorField from '../components/ColorField.svelte';
  import Eyedropper from '../components/Eyedropper.svelte';
  import Icon from '../components/Icon.svelte';
  import SizeInput from '../components/SizeInput.svelte';
  import {
    CATEGORY_DEFAULTS, CATEGORY_LABEL, FABRICS, FORMALITY_LABEL, PATTERN_LABEL, STATUS_LABEL, SUBCATEGORIES,
    WARMTH_LABEL, familyLabel,
  } from '../labels';
  import { navigate } from '../router.svelte';

  let { id, typeId: initialTypeId }: { id: string | 'new'; typeId?: string } = $props();

  // The parent remounts this component per id ({#key}), so reading it once is intended.
  // svelte-ignore state_referenced_locally
  const isNew = id === 'new';

  function blankDraft(): ItemAttributes & { status: Status } {
    return {
      name: '',
      category: 'top',
      subcategory: '',
      primaryColor: { hex: '#808080', family: 'gray' },
      secondaryColor: undefined,
      pattern: 'solid',
      fabric: '',
      formality: [...CATEGORY_DEFAULTS.top.formality],
      warmth: CATEGORY_DEFAULTS.top.warmth,
      rainOk: false,
      size: undefined,
      typeId: undefined,
      fitNotes: '',
      status: 'active',
    };
  }

  let draft = $state(blankDraft());
  let original = $state<Item | null>(null);
  let loaded = $state(isNew);
  let notFound = $state(false);

  // Photo
  let photoId = $state<string | undefined>();
  let photoBlob = $state<Blob | undefined>();
  let processing = $state(false);
  let photoError = $state('');
  let suggestions = $state<string[]>([]);
  let pickTarget = $state<'primary' | 'secondary'>('primary');
  let colorTouched = $state(false);

  // Photos stored during this edit session; any not kept are cleaned up on exit.
  const createdPhotoIds = new Set<string>();
  let saved = false;
  let saving = $state(false);

  // Size: new items get your profile size for the item's format until you pick one yourself.
  let sizeTouched = $state(false);
  let kindOverride = $state<SizeKind | null>(null);
  let profile = $derived($settingsStore?.sizeProfile);
  // Wardrobe plan types (count-only ones like socks aren't catalogued item by item).
  let cats = $derived($planCategories ?? []);
  let types = $derived(($itemTypes ?? []).filter((t) => !t.countOnly || t.id === draft.typeId));
  let planType = $derived(types.find((t) => t.id === draft.typeId));
  let planProgressNow = $derived(planType ? progressFor(planType, $allItems ?? []) : null);

  let autoKind = $derived(planType?.sizeKind ?? sizeKindFor(draft.category, draft.subcategory));
  let sizeKind = $derived(kindOverride ?? (sizeTouched && draft.size ? draft.size.kind : autoKind));

  $effect(() => {
    if (isNew && !sizeTouched) draft.size = defaultSizeForKind(autoKind, profile);
  });

  function setSize(v: ItemSize | undefined) {
    draft.size = v;
    sizeTouched = true;
  }

  function setSizeKind(k: SizeKind) {
    kindOverride = k === autoKind ? null : k;
    setSize(k === 'one-size' ? { kind: k, value: 'One size' } : profile?.[k] ? { ...profile[k]! } : undefined);
  }

  let cameraInput = $state<HTMLInputElement>();
  let libraryInput = $state<HTMLInputElement>();

  $effect(() => {
    if (isNew) return;
    (async () => {
      const item = await db.items.get(id);
      if (!item) {
        notFound = true;
        return;
      }
      original = item;
      const { id: _i, photoId: pid, createdAt: _c, updatedAt: _u, attrSource: _a, ...attrs } = item;
      draft = { ...blankDraft(), ...attrs };
      photoId = pid;
      colorTouched = true;
      sizeTouched = !!item.size;
      if (item.size && item.size.kind !== sizeKindFor(item.category, item.subcategory)) kindOverride = item.size.kind;
      if (pid) photoBlob = (await db.photos.get(pid))?.blob;
      loaded = true;
    })();
  });

  // Clean up orphaned photos however we leave (save, cancel, browser back).
  $effect(() => () => {
    for (const pid of createdPhotoIds) {
      if (!(saved && pid === photoId)) deletePhoto(pid);
    }
  });

  let autoName = $derived(
    `${familyLabel(draft.primaryColor.family)} ${(draft.subcategory || CATEGORY_LABEL[draft.category]).toLowerCase()}`,
  );

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    processing = true;
    photoError = '';
    try {
      const photo = await compressPhoto(file);
      const pid = await savePhoto(photo);
      createdPhotoIds.add(pid);
      photoId = pid;
      photoBlob = photo.full;
      suggestions = [];
    } catch (err) {
      console.error(err);
      photoError = "Couldn't read that image. Try a JPEG or PNG.";
    } finally {
      processing = false;
    }
  }

  function tag(hex: string): ColorTag {
    return { hex, family: colorFamily(hex) };
  }

  function pick(hex: string) {
    if (pickTarget === 'secondary') draft.secondaryColor = tag(hex);
    else {
      draft.primaryColor = tag(hex);
      colorTouched = true;
    }
  }

  function onSuggest(hexes: string[]) {
    suggestions = hexes;
    // Quick add: pre-fill the primary color with the most dominant one.
    if (!colorTouched && hexes[0]) draft.primaryColor = tag(hexes[0]);
  }

  function setCategory(c: Category) {
    if (c === draft.category) return;
    draft.category = c;
    draft.subcategory = planType ? planType.name : '';
    if (isNew) {
      draft.warmth = CATEGORY_DEFAULTS[c].warmth;
      draft.formality = [...CATEGORY_DEFAULTS[c].formality];
    }
  }

  function selectType(tid: string) {
    const t = types.find((x) => x.id === tid);
    draft.typeId = t?.id;
    if (!t) return;
    setCategory(t.slot);
    draft.subcategory = t.name;
  }

  // Adding an item from a plan type (#/item/new?type=…): preselect it once types load.
  let typePreselected = false;
  $effect(() => {
    if (!isNew || typePreselected || !initialTypeId || !$itemTypes) return;
    typePreselected = true;
    selectType(initialTypeId);
  });

  function toggleFormality(f: Formality) {
    const has = draft.formality.includes(f);
    if (has && draft.formality.length === 1) return; // keep at least one
    draft.formality = has ? draft.formality.filter((x) => x !== f) : FORMALITIES.filter((x) => x === f || draft.formality.includes(x));
  }

  async function save(addAnother = false) {
    saving = true;
    const now = Date.now();
    const { status, ...attrs } = $state.snapshot(draft);
    const item: Item = {
      ...attrs,
      name: attrs.name.trim() || autoName,
      subcategory: attrs.subcategory.trim(),
      fabric: attrs.fabric.trim(),
      fitNotes: attrs.fitNotes.trim(),
      status,
      id: original?.id ?? newId(),
      photoId,
      attrSource: original?.attrSource,
      createdAt: original?.createdAt ?? now,
      updatedAt: now,
    };
    if (!item.secondaryColor) delete item.secondaryColor;
    if (!item.size && sizeKind === 'one-size') item.size = { kind: 'one-size', value: 'One size' };
    if (!item.size) delete item.size;
    if (!item.typeId) delete item.typeId;
    await saveItem(item, original?.photoId);
    saved = true;
    saving = false;

    if (addAnother) {
      // Keep category/formality for fast batch entry of similar things.
      const keep = {
        category: draft.category,
        subcategory: planType ? draft.subcategory : '',
        typeId: draft.typeId,
        formality: draft.formality,
        warmth: draft.warmth,
      };
      createdPhotoIds.clear();
      saved = false;
      draft = { ...blankDraft(), ...keep };
      photoId = undefined;
      photoBlob = undefined;
      suggestions = [];
      colorTouched = false;
      sizeTouched = false;
      kindOverride = null;
      pickTarget = 'primary';
      window.scrollTo(0, 0);
    } else {
      navigate('/closet');
    }
  }

  async function remove() {
    if (!original || !confirm(`Delete “${original.name}”? This can’t be undone.`)) return;
    await deleteItem(original);
    saved = true;
    navigate('/closet');
  }

  function removePhoto() {
    photoId = undefined;
    photoBlob = undefined;
    suggestions = [];
  }
</script>

<header class="bar">
  <a class="icon-btn" href="#/closet" aria-label="Cancel"><Icon name="back" /></a>
  <h1>{isNew ? 'New item' : 'Edit item'}</h1>
  <button class="btn btn-primary save" disabled={!loaded || saving} onclick={() => save()}>Save</button>
</header>

{#if notFound}
  <p class="pad muted">This item no longer exists. <a href="#/closet">Back to closet</a></p>
{:else if loaded}
  <form class="form" onsubmit={(e) => { e.preventDefault(); save(); }}>
    <!-- Photo -->
    <section class="photo">
      {#if photoBlob}
        <Eyedropper blob={photoBlob} onpick={pick} onsuggest={onSuggest} />
        {#if suggestions.length}
          <div class="suggest" role="group" aria-label="Suggested colors">
            <span class="muted">Suggested</span>
            {#each suggestions as hex (hex)}
              <button type="button" class="sugg" style:background={hex} aria-label="Use {hex}" onclick={() => pick(hex)}></button>
            {/each}
          </div>
        {/if}
        <div class="photo-actions">
          <button type="button" class="btn" onclick={() => cameraInput?.click()}><Icon name="camera" size={20} /> Retake</button>
          <button type="button" class="btn btn-danger" onclick={removePhoto}>Remove photo</button>
        </div>
      {:else}
        <div class="photo-empty">
          {#if processing}
            <p class="muted">Compressing…</p>
          {:else}
            <button type="button" class="btn btn-primary" onclick={() => cameraInput?.click()}>
              <Icon name="camera" size={20} /> Take photo
            </button>
            <button type="button" class="btn" onclick={() => libraryInput?.click()}>
              <Icon name="image" size={20} /> Choose photo
            </button>
            <p class="muted tip">Tip: lay it flat on a plain background in daylight.</p>
          {/if}
        </div>
      {/if}
      {#if photoError}<p class="error">{photoError}</p>{/if}
      <input bind:this={cameraInput} type="file" accept="image/*" capture="environment" hidden onchange={onFile} />
      <input bind:this={libraryInput} type="file" accept="image/*" hidden onchange={onFile} />
    </section>

    <!-- Colors -->
    <section class="stack">
      <ColorField
        label="Primary color"
        bind:value={draft.primaryColor}
        active={!!photoBlob && pickTarget === 'primary'}
        onactivate={photoBlob ? () => (pickTarget = 'primary') : undefined}
      />
      {#if draft.secondaryColor || pickTarget === 'secondary'}
        <ColorField
          label="Secondary color"
          bind:value={draft.secondaryColor}
          active={!!photoBlob && pickTarget === 'secondary'}
          onactivate={photoBlob ? () => (pickTarget = 'secondary') : undefined}
          onremove={() => {
            draft.secondaryColor = undefined;
            pickTarget = 'primary';
          }}
        />
      {:else}
        <button
          type="button"
          class="link"
          onclick={() => {
            pickTarget = 'secondary';
            if (!photoBlob) draft.secondaryColor = tag('#ffffff');
          }}>+ Add secondary color</button
        >
      {/if}
    </section>

    <!-- Category -->
    {#if types.length}
      <label class="field">
        <span class="label">Type</span>
        <select class="input" value={draft.typeId ?? ''} onchange={(e) => selectType(e.currentTarget.value)}>
          <option value="">No type</option>
          {#each cats as c (c.id)}
            {@const ofCat = types.filter((t) => t.categoryId === c.id)}
            {#if ofCat.length}
              <optgroup label={c.name}>
                {#each ofCat as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
              </optgroup>
            {/if}
          {/each}
        </select>
        {#if planType && planProgressNow}
          <span class="muted tip-small">
            {cats.find((c) => c.id === planType.categoryId)?.name} · you have {planProgressNow.owned} of
            {planProgressNow.min === planProgressNow.max ? planProgressNow.max : `${planProgressNow.min}–${planProgressNow.max}`}
            {#if planType.shopping}· Need new: {planType.shopping}{/if}
          </span>
        {:else}
          <span class="muted tip-small">Pick where this counts in your <a href="#/plan">plan</a>.</span>
        {/if}
      </label>
    {/if}

    <fieldset class="field">
      <legend class="label">{types.length ? 'Outfit slot' : 'Category'}</legend>
      <div class="seg wrap">
        {#each CATEGORIES as c (c)}
          <button type="button" aria-pressed={draft.category === c} onclick={() => setCategory(c)}>{CATEGORY_LABEL[c]}</button>
        {/each}
      </div>
    </fieldset>

    {#if !planType}
      <label class="field">
        <span class="label">{types.length ? 'Kind' : 'Type'}</span>
        <input class="input" list="subcats" placeholder={SUBCATEGORIES[draft.category][0]} bind:value={draft.subcategory} />
        <datalist id="subcats">
          {#each SUBCATEGORIES[draft.category] as s (s)}<option value={s}></option>{/each}
        </datalist>
      </label>
    {/if}

    <div class="field">
      <div class="label-row">
        <span class="label">Size</span>
        <select class="kind" aria-label="Size format" value={sizeKind} onchange={(e) => setSizeKind(e.currentTarget.value as SizeKind)}>
          {#each SIZE_KINDS as k (k)}<option value={k}>{SIZE_KIND_LABEL[k]}</option>{/each}
        </select>
      </div>
      {#key sizeKind}
        <SizeInput kind={sizeKind} bind:value={() => draft.size, setSize} defaultSystem={profile?.shoe?.system} />
      {/key}
      {#if isNew && !sizeTouched && !draft.size && sizeKind !== 'one-size'}
        <p class="muted tip-small">Set your usual sizes in <a href="#/settings">Settings → My sizes</a> to pre-fill this.</p>
      {/if}
    </div>

    <label class="field">
      <span class="label">Name</span>
      <input class="input" placeholder={autoName} bind:value={draft.name} />
    </label>

    <fieldset class="field">
      <legend class="label">Formality</legend>
      <div class="seg">
        {#each FORMALITIES as f (f)}
          <button type="button" aria-pressed={draft.formality.includes(f)} onclick={() => toggleFormality(f)}>{FORMALITY_LABEL[f]}</button>
        {/each}
      </div>
    </fieldset>

    <fieldset class="field">
      <legend class="label">Pattern</legend>
      <div class="seg wrap">
        {#each PATTERNS as p (p)}
          <button type="button" aria-pressed={draft.pattern === p} onclick={() => (draft.pattern = p)}>{PATTERN_LABEL[p]}</button>
        {/each}
      </div>
    </fieldset>

    <label class="field">
      <span class="label">Fabric</span>
      <input class="input" list="fabrics" placeholder="Cotton" bind:value={draft.fabric} />
      <datalist id="fabrics">
        {#each FABRICS as f (f)}<option value={f}></option>{/each}
      </datalist>
    </label>

    <label class="field">
      <span class="label">Warmth · {WARMTH_LABEL[draft.warmth]}</span>
      <input class="range" type="range" min="1" max="5" step="1" bind:value={draft.warmth} />
    </label>

    <label class="toggle">
      <span>
        <span class="t-title">Rain-appropriate</span>
        <span class="muted t-sub">Waterproof or fine to get wet</span>
      </span>
      <input type="checkbox" role="switch" bind:checked={draft.rainOk} />
    </label>

    <label class="field">
      <span class="label">Fit notes</span>
      <textarea class="input" placeholder="Runs slim, hem at ankle…" bind:value={draft.fitNotes}></textarea>
    </label>

    <fieldset class="field">
      <legend class="label">Status</legend>
      <div class="seg">
        {#each STATUSES as s (s)}
          <button type="button" aria-pressed={draft.status === s} onclick={() => (draft.status = s)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>
    </fieldset>

    <div class="actions">
      <button type="submit" class="btn btn-primary btn-block" disabled={saving}>Save</button>
      {#if isNew}
        <button type="button" class="btn btn-block" disabled={saving} onclick={() => save(true)}>Save & add another</button>
      {:else}
        <button type="button" class="btn btn-danger btn-block" onclick={remove}>Delete item</button>
      {/if}
    </div>
  </form>
{/if}

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: var(--tap) 1fr auto;
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
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    color: var(--text);
  }
  .save {
    min-height: 36px;
  }
  .pad {
    padding: var(--space-4);
  }

  .form {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-4);
    max-width: 640px;
    margin: 0 auto;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: var(--space-2);
  }

  .photo {
    display: grid;
    gap: var(--space-3);
  }
  .photo-empty {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-4);
    border: 2px dashed var(--border);
    border-radius: var(--radius-lg);
    text-align: center;
  }
  .tip {
    margin: 0;
    font-size: var(--text-sm);
  }
  .photo-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .suggest {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .sugg {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 0;
    box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.35);
    cursor: pointer;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: var(--text-sm);
  }

  .stack {
    display: grid;
    gap: var(--space-2);
  }
  .link {
    justify-self: start;
    border: 0;
    background: none;
    padding: var(--space-2) 0;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }

  .seg {
    display: flex;
    gap: var(--space-2);
  }
  .seg.wrap {
    flex-wrap: wrap;
  }
  .seg:not(.wrap) > button {
    flex: 1;
  }
  .seg button {
    min-height: 40px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .kind {
    max-width: 60%;
    border: 0;
    background: none;
    color: var(--accent);
    font-size: 16px; /* under 16px, iOS zooms in when the select is tapped */
    font-weight: 600;
    text-align: right;
    cursor: pointer;
  }
  .tip-small {
    margin: 0;
    font-size: var(--text-xs);
  }
  .tip-small a {
    color: var(--accent);
  }

  .range {
    width: 100%;
    accent-color: var(--accent);
    min-height: var(--tap);
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
  .actions {
    display: grid;
    gap: var(--space-2);
    padding-bottom: var(--space-5);
  }
</style>

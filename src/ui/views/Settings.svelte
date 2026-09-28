<script lang="ts">
  import { parseBackup, readAll, serializeBackup, writeAll } from '../../db/backup';
  import { allItems } from '../../db/items';
  import { setSetting, settingsStore } from '../../db/settings';
  import { isIos, isStandalone, saveFile } from '../../services/files';

  let busy = $state('');
  let message = $state('');
  let persisted = $state<boolean | null>(null);
  let usage = $state('');
  let importInput = $state<HTMLInputElement>();

  const standalone = isStandalone();
  const ios = isIos();

  $effect(() => {
    navigator.storage?.persisted?.().then((p) => (persisted = p));
    navigator.storage?.estimate?.().then(({ usage: u = 0 }) => (usage = formatBytes(u)));
  });

  function formatBytes(n: number) {
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDate(ts: number | null | undefined) {
    return ts ? new Date(ts).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'never';
  }

  async function exportBackup() {
    busy = 'export';
    message = '';
    try {
      const file = await serializeBackup(await readAll());
      const date = file.exportedAt.slice(0, 10);
      const blob = new File([JSON.stringify(file)], `fit-maker-backup-${date}.json`, { type: 'application/json' });
      const result = await saveFile(blob);
      if (result !== 'cancelled') {
        await setSetting('lastBackupAt', Date.now());
        message = `Backup ready (${formatBytes(blob.size)}).`;
      }
    } catch (err) {
      console.error(err);
      message = 'Export failed.';
    } finally {
      busy = '';
    }
  }

  async function onImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = 'import';
    message = '';
    try {
      const data = parseBackup(await file.text());
      const replace = confirm(
        `Backup has ${data.items.length} items.\n\nOK = replace everything on this device.\nCancel = merge into what's here.`,
      );
      await writeAll(data, replace ? 'replace' : 'merge');
      message = `Imported ${data.items.length} items (${replace ? 'replaced' : 'merged'}).`;
    } catch (err) {
      message = err instanceof Error ? err.message : 'Import failed.';
    } finally {
      busy = '';
    }
  }
</script>

<header class="page-header"><h1>Settings</h1></header>

<div class="sections">
  {#if ios && !standalone}
    <section class="card notice">
      <h2>Install on your iPhone</h2>
      <p>
        Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>. Do this before cataloguing: iOS keeps
        the home-screen app's data separate from Safari's.
      </p>
    </section>
  {/if}

  <section class="card">
    <h2>Preferences</h2>
    <div class="field-row">
      <span>Temperature</span>
      <div class="seg">
        {#each ['F', 'C'] as const as u (u)}
          <button aria-pressed={$settingsStore?.units === u} onclick={() => setSetting('units', u)}>°{u}</button>
        {/each}
      </div>
    </div>
    <div class="field-row">
      <span>Theme</span>
      <div class="seg">
        {#each ['system', 'light', 'dark'] as const as t (t)}
          <button aria-pressed={$settingsStore?.theme === t} onclick={() => setSetting('theme', t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Backup</h2>
    <p class="muted">
      Everything lives on this device only. Export regularly; photos are included.
      <br />Last backup: {formatDate($settingsStore?.lastBackupAt)}
    </p>
    <div class="buttons">
      <button class="btn btn-primary" disabled={!!busy} onclick={exportBackup}>
        {busy === 'export' ? 'Preparing…' : 'Export backup'}
      </button>
      <button class="btn" disabled={!!busy} onclick={() => importInput?.click()}>
        {busy === 'import' ? 'Importing…' : 'Import backup'}
      </button>
      <input bind:this={importInput} type="file" accept="application/json,.json" hidden onchange={onImport} />
    </div>
    {#if message}<p class="message" role="status">{message}</p>{/if}
  </section>

  <section class="card">
    <h2>Storage</h2>
    <dl>
      <dt>Items</dt>
      <dd>{$allItems?.length ?? '–'}</dd>
      <dt>Space used</dt>
      <dd>{usage || '–'}</dd>
      <dt>Protected from eviction</dt>
      <dd>{persisted === null ? '–' : persisted ? 'Yes' : 'No'}</dd>
    </dl>
  </section>

  <p class="muted version">Fit Maker v{__APP_VERSION__}</p>
</div>

<style>
  .page-header {
    padding: var(--space-5) var(--space-4) var(--space-3);
  }
  h1 {
    font-size: var(--text-xl);
  }
  h2 {
    font-size: var(--text-md);
    margin-bottom: var(--space-3);
  }
  .sections {
    display: grid;
    gap: var(--space-4);
    padding: 0 var(--space-4);
  }
  .notice {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  p {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--tap);
  }
  .seg {
    display: flex;
    padding: 2px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .seg button {
    min-height: 34px;
    padding: 0 var(--space-3);
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
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .message {
    margin: var(--space-3) 0 0;
  }
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-sm);
  }
  dd {
    margin: 0;
    font-weight: 600;
  }
  .version {
    text-align: center;
    font-size: var(--text-xs);
  }
</style>

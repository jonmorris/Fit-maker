<script lang="ts">
  import { settingsStore } from '../db/settings';
  import TabBar from './components/TabBar.svelte';
  import { router } from './router.svelte';
  import Closet from './views/Closet.svelte';
  import ItemEditor from './views/ItemEditor.svelte';
  import Placeholder from './views/Placeholder.svelte';
  import Settings from './views/Settings.svelte';
  import Today from './views/Today.svelte';

  $effect(() => {
    const theme = $settingsStore?.theme ?? 'system';
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  });
</script>

<main>
  {#if router.route.name === 'closet'}
    <Closet />
  {:else if router.route.name === 'item'}
    {#key router.route.id}
      <ItemEditor id={router.route.id} />
    {/key}
  {:else if router.route.name === 'today'}
    <Today />
  {:else if router.route.name === 'insights'}
    <Placeholder title="Insights" phase={3}>
      Redundant clusters, clash-prone pieces, gaps ranked by outfits unlocked, capsule slots, and the
      before-you-buy check.
    </Placeholder>
  {:else if router.route.name === 'settings'}
    <Settings />
  {/if}
</main>

{#if router.route.name !== 'item'}
  <TabBar />
{/if}

<style>
  main {
    min-height: 100dvh;
    padding-top: var(--safe-top);
    padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--space-4));
  }
</style>

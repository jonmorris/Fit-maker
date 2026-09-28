<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  import { router } from '../router.svelte';

  const tabs: { route: string; label: string; icon: IconName }[] = [
    { route: 'closet', label: 'Closet', icon: 'closet' },
    { route: 'today', label: 'Today', icon: 'today' },
    { route: 'insights', label: 'Insights', icon: 'insights' },
    { route: 'settings', label: 'Settings', icon: 'settings' },
  ];
</script>

<nav aria-label="Main">
  {#each tabs as tab (tab.route)}
    <a href="#/{tab.route}" aria-current={router.route.name === tab.route ? 'page' : undefined}>
      <Icon name={tab.icon} />
      <span>{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    height: calc(var(--tabbar-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(16px);
    -webkit-backdrop-filter: saturate(1.4) blur(16px);
    border-top: 1px solid var(--border);
  }
  a {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 11px;
    font-weight: 600;
  }
  a[aria-current='page'] {
    color: var(--accent);
  }
</style>

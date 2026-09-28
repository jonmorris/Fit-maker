<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, phase, children }: { title: string; phase: number; children: Snippet } = $props();
</script>

<header class="page-header"><h1>{title}</h1></header>
<section class="card">
  <p class="muted">Coming in phase {phase}.</p>
  <p>{@render children()}</p>
</section>

<style>
  .page-header {
    padding: var(--space-5) var(--space-4) var(--space-3);
  }
  h1 {
    font-size: var(--text-xl);
  }
  .card {
    margin: 0 var(--space-4);
  }
  p {
    margin: 0 0 var(--space-2);
  }
</style>

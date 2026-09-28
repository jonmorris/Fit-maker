<script lang="ts">
  import { thumbUrl } from '../../db/items';

  let { photoId, color, alt }: { photoId?: string; color: string; alt: string } = $props();
  let url = $state<string | null>(null);

  $effect(() => {
    url = null;
    if (!photoId) return;
    let live = true;
    thumbUrl(photoId).then((u) => live && (url = u));
    return () => (live = false);
  });
</script>

<div class="thumb" style:--swatch={color}>
  {#if url}
    <img src={url} {alt} loading="lazy" decoding="async" />
  {/if}
</div>

<style>
  .thumb {
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--swatch);
    /* Keeps black/white color-only swatches visible against the card in either theme. */
    box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.3);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>

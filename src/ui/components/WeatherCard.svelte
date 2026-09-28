<script lang="ts">
  import { cToF, type WeatherNeeds } from '../../engine/weather';
  import type { TodayWeather } from '../../services/weather';
  import Icon from './Icon.svelte';

  let {
    data,
    needs,
    units,
    loading,
    onrefresh,
  }: {
    data: TodayWeather | null;
    needs: WeatherNeeds;
    units: 'F' | 'C';
    loading: boolean;
    onrefresh: () => void;
  } = $props();

  const t = (c: number) => `${Math.round(units === 'F' ? cToF(c) : c)}°`;
  const ago = (ts?: number) => {
    if (!ts) return '';
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 2) return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    return h < 24 ? `${h} h ago` : new Date(ts).toLocaleDateString();
  };
</script>

<section class="card weather" aria-live="polite">
  {#if data?.weather}
    {@const w = data.weather}
    <div class="top">
      <div>
        <div class="temps">{t(w.tempMin)}–{t(w.tempMax)}</div>
        <div class="muted small">
          Feels {t(w.feelsMin)}–{t(w.feelsMax)} · {w.rainChance}% rain · 8am–7pm
        </div>
      </div>
      <button class="icon-btn" onclick={onrefresh} disabled={loading} aria-label="Refresh weather">
        <span class:spin={loading}><Icon name="refresh" size={20} /></span>
      </button>
    </div>
    <ul class="notes">
      {#each needs.notes as note (note)}<li>{note}</li>{/each}
    </ul>
    <p class="muted tiny">
      {data.source === 'cached' ? 'Saved forecast' : 'Updated'}
      {ago(data.fetchedAt)}{data.error ? ` · ${data.error}` : ''}
    </p>
  {:else if loading}
    <p class="muted">Getting today's forecast…</p>
  {:else}
    <div class="top">
      <div>
        <strong>No forecast</strong>
        <p class="muted small">{data?.error ?? 'Weather unavailable.'} Suggestions assume a mild, dry day.</p>
      </div>
      <button class="btn" onclick={onrefresh}>Try again</button>
    </div>
  {/if}
</section>

<style>
  .weather {
    display: grid;
    gap: var(--space-2);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }
  .temps {
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .small {
    font-size: var(--text-sm);
    margin: 0;
  }
  .tiny {
    font-size: var(--text-xs);
    margin: 0;
  }
  .notes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .notes li {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    border: 0;
    border-radius: 50%;
    background: var(--surface-2);
    cursor: pointer;
  }
  .spin {
    display: grid;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }
</style>

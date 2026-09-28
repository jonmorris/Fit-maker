<script lang="ts" module>
  // Inline 24×24 stroke icons — no icon font or library needed.
  const PATHS = {
    closet: 'M9.5 6.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V11M12 11 3.6 16.2c-.8.5-.5 1.8.5 1.8h15.8c1 0 1.3-1.3.5-1.8Z',
    today: 'M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    insights: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    plus: 'M12 5v14M5 12h14',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    image: 'M4 5h16v14H4ZM4 16l5-5 4 4 3-3 4 4M15.5 9.5h0',
    back: 'M15 5l-7 7 7 7',
    close: 'M6 6l12 12M18 6 6 18',
    search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM20 20l-4-4',
    drop: 'M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 24 }: { name: IconName; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>

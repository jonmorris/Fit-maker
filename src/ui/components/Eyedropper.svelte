<script lang="ts">
  // Tap-and-drag color picker over a photo. iOS has no native EyeDropper API,
  // so we sample the decoded pixels ourselves and show a magnifier loupe
  // above the finger (which would otherwise hide what you're picking).
  import { photoPixels } from '../../services/photo';
  import { dominantColors, samplePatch } from '../../services/sampling';

  let {
    blob,
    onpick,
    onsuggest,
  }: {
    blob: Blob;
    onpick: (hex: string) => void;
    onsuggest?: (hexes: string[]) => void;
  } = $props();

  const LOUPE = 96; // css px
  const ZOOM_SRC = 12; // source pixels across the loupe

  let url = $state<string>();
  let img = $state<HTMLImageElement>();
  let loupe = $state<HTMLCanvasElement>();
  let pixels: ImageData | null = null;
  let source: HTMLCanvasElement | null = null;
  let probe = $state<{ x: number; y: number; hex: string } | null>(null);

  $effect(() => {
    const u = URL.createObjectURL(blob);
    url = u;
    let live = true;
    photoPixels(blob).then((data) => {
      if (!live) return;
      pixels = data;
      source = document.createElement('canvas');
      source.width = data.width;
      source.height = data.height;
      source.getContext('2d')!.putImageData(data, 0, 0);
      onsuggest?.(dominantColors(data, 4));
    });
    return () => {
      live = false;
      URL.revokeObjectURL(u);
    };
  });

  function sampleAt(e: PointerEvent) {
    if (!img || !pixels) return;
    const rect = img.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width - 1);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height - 1);
    const sx = (x / rect.width) * pixels.width;
    const sy = (y / rect.height) * pixels.height;
    probe = { x, y, hex: samplePatch(pixels, sx, sy, 4) };
    drawLoupe(sx, sy);
  }

  function drawLoupe(sx: number, sy: number) {
    if (!loupe || !source) return;
    const dpr = window.devicePixelRatio || 1;
    loupe.width = LOUPE * dpr;
    loupe.height = LOUPE * dpr;
    const ctx = loupe.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, sx - ZOOM_SRC / 2, sy - ZOOM_SRC / 2, ZOOM_SRC, ZOOM_SRC, 0, 0, loupe.width, loupe.height);
  }

  function down(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    sampleAt(e);
  }

  function move(e: PointerEvent) {
    if (probe) sampleAt(e);
  }

  function up() {
    if (probe) onpick(probe.hex);
    probe = null;
  }
</script>

<div class="wrap">
  <div
    class="stage"
    role="application"
    aria-label="Photo. Touch and drag to pick a color."
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => (probe = null)}
  >
    {#if url}
      <img bind:this={img} src={url} alt="" draggable="false" />
    {/if}
    <!-- Always mounted so the loupe canvas exists before the first draw. -->
    <div
      class="loupe"
      hidden={!probe}
      style:left="{probe?.x ?? 0}px"
      style:top="{probe?.y ?? 0}px"
      style:--c={probe?.hex}
    >
      <canvas bind:this={loupe} style:width="{LOUPE}px" style:height="{LOUPE}px"></canvas>
      <span class="hex">{probe?.hex}</span>
    </div>
    {#if probe}
      <div class="cross" style:left="{probe.x}px" style:top="{probe.y}px"></div>
    {/if}
  </div>
  <p class="hint muted">Touch and drag on the garment, then lift to pick.</p>
</div>

<style>
  .wrap {
    display: grid;
    gap: var(--space-2);
  }
  .stage {
    position: relative;
    justify-self: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: crosshair;
  }
  img {
    max-width: 100%;
    max-height: 50vh;
    border-radius: var(--radius);
    pointer-events: none;
  }
  .loupe {
    position: absolute;
    translate: -50% calc(-100% - 36px);
    display: grid;
    justify-items: center;
    gap: 4px;
    pointer-events: none;
  }
  .loupe[hidden] {
    display: none;
  }
  .loupe canvas {
    border-radius: 50%;
    border: 4px solid var(--c);
    box-shadow:
      0 0 0 2px #fff,
      var(--shadow);
    image-rendering: pixelated;
  }
  .hex {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.7);
    color: #fff;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .cross {
    position: absolute;
    width: 20px;
    height: 20px;
    translate: -50% -50%;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
    pointer-events: none;
  }
  .hint {
    margin: 0;
    text-align: center;
    font-size: var(--text-xs);
  }
</style>

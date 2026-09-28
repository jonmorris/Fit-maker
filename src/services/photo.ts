// Photo compression. Browser-only (canvas).
// JPEG rather than WebP: Safari's canvas can't reliably encode WebP.

const FULL_EDGE = 1280;
const THUMB_EDGE = 320;

export interface CompressedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function scaled(w: number, h: number, maxEdge: number) {
  const k = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
}

function draw(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/** Downscales and re-encodes a camera photo. EXIF rotation is applied by createImageBitmap. */
export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const full = scaled(bitmap.width, bitmap.height, FULL_EDGE);
    const fullCanvas = draw(bitmap, full.w, full.h);
    const thumb = scaled(full.w, full.h, THUMB_EDGE);
    const thumbCanvas = draw(fullCanvas, thumb.w, thumb.h);
    return {
      full: await toJpeg(fullCanvas, 0.8),
      thumb: await toJpeg(thumbCanvas, 0.75),
      width: full.w,
      height: full.h,
    };
  } finally {
    bitmap.close();
  }
}

/** Decodes a stored photo into pixels for the eyedropper. */
export async function photoPixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = draw(bitmap, bitmap.width, bitmap.height);
    return canvas.getContext('2d')!.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

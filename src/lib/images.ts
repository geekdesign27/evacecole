// Image helpers shared by photo upload and report exports.

export interface RasterImage {
  dataUrl: string;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image illisible : ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/** Downscale to maxSide px (longest side) and re-encode as JPEG. */
export async function resizeToJpeg(src: string | Blob, maxSide = 1280, quality = 0.7): Promise<RasterImage & { blob: Blob }> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible.");
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encodage JPEG impossible."))), "image/jpeg", quality),
    );
    return { dataUrl, width, height, blob };
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

/** Rasterize an SVG/PNG (e.g. the logo) to a PNG data URL at a given height. */
export async function rasterizePng(src: string, height: number): Promise<RasterImage> {
  const img = await loadImage(src);
  const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const width = Math.round(height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const logoUrl = () => `${import.meta.env.BASE_URL}logo.svg`;

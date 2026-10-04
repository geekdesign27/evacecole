// Loads the images an export needs (logo + photos), resized once and shared by PDF and Word.
import type { ReportModel } from "../domain/buildReport";
import { logoUrl, rasterizePng, resizeToJpeg, type RasterImage } from "../lib/images";

export interface ExportAssets {
  logo: RasterImage | null;
  /** Keyed by photo URL; missing entries failed to load and are skipped. */
  photos: Map<string, RasterImage>;
}

export async function loadAssets(model: ReportModel): Promise<ExportAssets> {
  const logo = await rasterizePng(logoUrl(), 240).catch(() => null);
  const photos = new Map<string, RasterImage>();
  const urls = model.schools.flatMap((s) => s.photos.map((p) => p.url));
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const img = await resizeToJpeg(await res.blob(), 1280, 0.7);
        photos.set(url, img);
      } catch {
        /* a broken photo must not block the report */
      }
    }),
  );
  return { logo, photos };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const FOOTER_TEXT = "Compagnie des sapeurs-pompiers Moncor, www.cpmoncor.ch";

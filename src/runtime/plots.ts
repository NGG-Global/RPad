/** Conversion of captured R graphics into persistent PNG blobs. */

export async function imageBitmapToPng(img: ImageBitmap): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(img, 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export const IMAGE_EXTENSIONS = /\.(png|jpe?g|svg|bmp|webp)$/i;

export function mimeForFile(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    case 'webp': return 'image/webp';
    case 'pdf': return 'application/pdf';
    case 'csv': return 'text/csv';
    case 'txt': case 'r': return 'text/plain';
    case 'rdata': case 'rda': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

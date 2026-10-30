export async function fileToCanvas(file: Blob, maxEdge: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

export function canvasThumb(source: HTMLCanvasElement): string {
  const scale = Math.min(1, 360 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  let quality = 0.66;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > 400_000 && quality > 0.35) {
    quality = Math.round((quality - 0.12) * 100) / 100;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url.length > 400_000 ? '' : url;
}

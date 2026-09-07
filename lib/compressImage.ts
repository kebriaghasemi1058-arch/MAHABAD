// Resizes + re-encodes an image in the browser before upload, so a raw
// 12MB phone photo doesn't get pushed straight to Storage as-is.
export async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/jpeg",
      quality
    );
  });
}

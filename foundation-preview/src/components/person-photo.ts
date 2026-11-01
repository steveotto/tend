import { isValidPersonPhotoDataUrl, PERSON_PHOTO_MAX_DATA_URL_LENGTH } from '../domain/person-details.ts';

const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 320_000;
const acceptedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressPersonPhoto(file: File): Promise<string> {
  if (!acceptedPhotoTypes.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size === 0 || file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error('Choose an image smaller than 10 MB.');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot prepare a photo for the preview.');
  }

  const image = await createImageBitmap(file);
  try {
    if (image.width < 1 || image.height < 1) throw new Error('The selected image could not be decoded.');
    for (const maxDimension of [512, 384, 256]) {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      for (const quality of [0.8, 0.65, 0.5]) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This browser could not prepare the selected photo.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const blob = await canvasBlob(canvas, quality);
        if (blob.size > MAX_COMPRESSED_BYTES) continue;
        const dataUrl = await readAsDataUrl(blob);
        if (dataUrl.length <= PERSON_PHOTO_MAX_DATA_URL_LENGTH && isValidPersonPhotoDataUrl(dataUrl)) {
          return dataUrl;
        }
      }
    }
  } finally {
    image.close();
  }
  throw new Error('This image could not be compressed enough to save. Choose a smaller image.');
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('This browser could not encode the selected photo.')),
      'image/jpeg',
      quality
    );
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The compressed photo could not be read.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

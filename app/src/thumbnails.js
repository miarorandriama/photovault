import sharp from 'sharp';

const THUMBNAIL_WIDTH = 400;

// Formats acceptés mais sans miniature : sharp ne sait pas lire le HEIC des iPhone
const NO_THUMBNAIL_TYPES = new Set(['image/heic', 'image/heif']);

// Renvoie la miniature (Buffer WebP), ou null si le format n'en a pas.
// Lève une erreur si le fichier se dit image mais n'est pas lisible.
export async function createThumbnail(filePath, contentType) {
  if (contentType.startsWith('video/') || NO_THUMBNAIL_TYPES.has(contentType)) {
    return null;
  }

  return sharp(filePath)
    .rotate() // applique l'orientation EXIF (photos prises en portrait)
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
}


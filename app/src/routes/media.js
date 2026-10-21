import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import multer from 'multer';
import { createThumbnail } from '../thumbnails.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const upload = multer({
  dest: tmpdir(),                       // fichier écrit sur disque, pas en mémoire (vidéos)
  limits: { fileSize: 2 * 1024 ** 3 },  // 2 Go max
  defParamCharset: 'utf8',              // garde les accents des noms de fichiers
});

// Ce que l'API montre : jamais les chemins internes de stockage
function toPublic(media) {
  return {
    id: media.id,
    originalName: media.originalName,
    contentType: media.contentType,
    sizeBytes: media.sizeBytes,
    uploadedAt: media.uploadedAt,
    thumbnailUrl: media.thumbnailKey ? `/api/media/${media.id}/thumbnail` : null,
  };
}

export function mediaRouter({ storage, db }) {
  const router = Router();

  router.post('/', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier reçu (champ "file")' });
    }

    try {
      if (!/^(image|video)\//.test(file.mimetype)) {
        return res.status(415).json({ error: 'Seules les photos et vidéos sont acceptées' });
      }

      let thumbnail;
      try {
        thumbnail = await createThumbnail(file.path, file.mimetype);
      } catch {
        return res.status(415).json({ error: 'Image illisible ou corrompue' });
      }

      const id = randomUUID();
      const storageKey = `originals/${id}${extname(file.originalname).toLowerCase()}`;
      const thumbnailKey = thumbnail ? `thumbnails/${id}.webp` : null;

      await storage.upload(storageKey, createReadStream(file.path), file.mimetype);
      if (thumbnail) {
        await storage.upload(thumbnailKey, thumbnail, 'image/webp');
      }

      const media = await db.insertMedia({
        id,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        thumbnailKey,
      });

      res.status(201).json(toPublic(media));
    } finally {
      await unlink(file.path).catch(() => {}); // supprime le fichier temporaire, quoi qu'il arrive
    }
  });

  router.get('/', async (req, res) => {
    const medias = await db.listMedia();
    res.json(medias.map(toPublic));
  });

  router.get('/:id/thumbnail', async (req, res) => {
    const media = UUID_PATTERN.test(req.params.id) ? await db.getMedia(req.params.id) : null;
    if (!media?.thumbnailKey) {
      return res.status(404).json({ error: 'Miniature introuvable' });
    }

    const { body, contentType } = await storage.download(media.thumbnailKey);
    res.type(contentType);
    res.set('Cache-Control', 'private, max-age=86400'); // le navigateur la garde 24 h
    await pipeline(body, res);
  });

  return router;
}


import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  dest: tmpdir(),                       // fichier écrit sur disque, pas en mémoire (vidéos)
  limits: { fileSize: 2 * 1024 ** 3 },  // 2 Go max
  defParamCharset: 'utf8',              // garde les accents des noms de fichiers
});

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

      const id = randomUUID();
      const storageKey = `originals/${id}${extname(file.originalname).toLowerCase()}`;

      await storage.upload(storageKey, file.path, file.mimetype);
      const media = await db.insertMedia({
        id,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      });

      res.status(201).json(media);
    } finally {
      await unlink(file.path).catch(() => {}); // supprime le fichier temporaire, quoi qu'il arrive
    }
  });

  return router;
}


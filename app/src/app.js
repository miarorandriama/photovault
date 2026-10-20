import express from 'express';
import multer from 'multer';
import { mediaRouter } from './routes/media.js';

// storage et db sont « injectés » : en test, on passe des faux ; en vrai, les vrais
export function createApp({ storage, db } = {}) {
  const app = express();
  app.use(express.json());

  // Sonde de santé : Kubernetes l'appellera pour savoir si l'appli est vivante
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/media', mediaRouter({ storage, db }));

  // Gestion centralisée des erreurs
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichier trop volumineux (2 Go max)' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  });

  return app;
}

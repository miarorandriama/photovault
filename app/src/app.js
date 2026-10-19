import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json());

  // Sonde de santé : Kubernetes l'appellera pour savoir si l'appli est vivante
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

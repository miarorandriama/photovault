import { createApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db.js';
import { createStorage } from './storage.js';

const db = createDb(config.databaseUrl);
await db.migrate();
const storage = createStorage(config.s3);

createApp({ storage, db }).listen(config.port, () => {
  console.log(`PhotoVault démarré sur http://localhost:${config.port}`);
});

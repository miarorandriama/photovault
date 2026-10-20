import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

function fakeDeps() {
  const uploads = [];
  const rows = [];
  return {
    uploads,
    rows,
    storage: { async upload(key, filePath, contentType) { uploads.push({ key, contentType }); } },
    db: { async insertMedia(media) { rows.push(media); return media; } },
  };
}

describe('POST /api/media', () => {
  it('stocke une photo et enregistre sa fiche', async () => {
    const deps = fakeDeps();

    const res = await request(createApp(deps))
      .post('/api/media')
      .attach('file', Buffer.from('fausse image'), 'chat.jpg');

    expect(res.status).toBe(201);
    expect(deps.uploads).toHaveLength(1);
    expect(deps.uploads[0].key).toMatch(/^originals\/.+\.jpg$/);
    expect(deps.rows[0]).toMatchObject({ originalName: 'chat.jpg', contentType: 'image/jpeg' });
  });

  it('refuse une requête sans fichier', async () => {
    const res = await request(createApp(fakeDeps())).post('/api/media');

    expect(res.status).toBe(400);
  });

  it('refuse un fichier qui n\'est ni une photo ni une vidéo', async () => {
    const deps = fakeDeps();

    const res = await request(createApp(deps))
      .post('/api/media')
      .attach('file', Buffer.from('bonjour'), 'notes.txt');

    expect(res.status).toBe(415);
    expect(deps.uploads).toHaveLength(0);
  });
});


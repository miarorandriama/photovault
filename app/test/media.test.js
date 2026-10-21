import { Readable } from 'node:stream';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

// Une vraie image JPEG rouge de 10×10 pixels
const realJpeg = await sharp({
  create: { width: 10, height: 10, channels: 3, background: 'red' },
}).jpeg().toBuffer();

// Faux Garage et faux Postgres, en mémoire
function fakeDeps() {
  const objects = new Map();
  const rows = [];
  return {
    objects,
    rows,
    storage: {
      async upload(key, body, contentType) {
        // Consomme le flux pour libérer le fichier temporaire immédiatement
        let content = body;
        if (body && typeof body.pipe === 'function') {
          const chunks = [];
          for await (const chunk of body) {
            chunks.push(chunk);
          }
          content = Buffer.concat(chunks);
        }
        objects.set(key, { body: content, contentType }); 
      },
      async download(key) {
        const { body, contentType } = objects.get(key);
        return { body: Readable.from([body]), contentType };
      },
    },
    db: {
      async insertMedia(media) { rows.push(media); return media; },
      async listMedia() { return [...rows].reverse(); },
      async getMedia(id) { return rows.find((m) => m.id === id) ?? null; },
    },
  };
}

function uploadFile(app, content, filename) {
  return request(app).post('/api/media').attach('file', content, filename);
}

describe('POST /api/media', () => {
  it('stocke la photo et sa miniature', async () => {
    const deps = fakeDeps();

    const res = await uploadFile(createApp(deps), realJpeg, 'chat.jpg');

    expect(res.status).toBe(201);
    expect(res.body.thumbnailUrl).toBe(`/api/media/${res.body.id}/thumbnail`);
    expect(deps.objects.has(`thumbnails/${res.body.id}.webp`)).toBe(true);
    expect([...deps.objects.keys()].some((k) => /^originals\/.+\.jpg$/.test(k))).toBe(true);
  });

  it('accepte une vidéo, sans miniature', async () => {
    const deps = fakeDeps();

    const res = await uploadFile(createApp(deps), Buffer.from('fausse vidéo'), 'vacances.mp4');

    expect(res.status).toBe(201);
    expect(res.body.thumbnailUrl).toBeNull();
    expect(deps.objects.size).toBe(1);
  });

  it('refuse une requête sans fichier', async () => {
    const res = await request(createApp(fakeDeps())).post('/api/media');

    expect(res.status).toBe(400);
  });

  it('refuse un fichier qui n\'est ni une photo ni une vidéo', async () => {
    const res = await uploadFile(createApp(fakeDeps()), Buffer.from('bonjour'), 'notes.txt');

    expect(res.status).toBe(415);
  });

  it('refuse un faux .jpg qui n\'est pas une vraie image', async () => {
    const deps = fakeDeps();

    const res = await uploadFile(createApp(deps), Buffer.from('pas une image'), 'piege.jpg');

    expect(res.status).toBe(415);
    expect(deps.objects.size).toBe(0);
  });
});

describe('GET /api/media', () => {
  it('liste les médias, du plus récent au plus ancien', async () => {
    const app = createApp(fakeDeps());
    await uploadFile(app, realJpeg, 'premiere.jpg');
    await uploadFile(app, realJpeg, 'seconde.jpg');

    const res = await request(app).get('/api/media');

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.originalName)).toEqual(['seconde.jpg', 'premiere.jpg']);
  });
});

describe('GET /api/media/:id/thumbnail', () => {
  it('renvoie la miniature au format WebP', async () => {
    const app = createApp(fakeDeps());
    const { body: media } = await uploadFile(app, realJpeg, 'chat.jpg');

    const res = await request(app).get(media.thumbnailUrl);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    const { format } = await sharp(res.body).metadata();
    expect(format).toBe('webp');
  });

  it('répond 404 pour un média inconnu', async () => {
    const res = await request(createApp(fakeDeps())).get('/api/media/inconnu/thumbnail');

    expect(res.status).toBe(404);
  });
});


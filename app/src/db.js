import pg from 'pg';

// Convertit une ligne SQL (snake_case) en objet JS (camelCase)
function toMedia(row) {
  return {
    id: row.id,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    storageKey: row.storage_key,
    thumbnailKey: row.thumbnail_key,
    uploadedAt: row.uploaded_at,
  };
}

export function createDb(connectionString) {
  const pool = new pg.Pool({ connectionString });

  return {
    // Crée ou met à jour la table au démarrage
    async migrate() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media (
          id            UUID PRIMARY KEY,
          original_name TEXT NOT NULL,
          content_type  TEXT NOT NULL,
          size_bytes    BIGINT NOT NULL,
          storage_key   TEXT NOT NULL UNIQUE,
          uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_key TEXT');
    },

    async insertMedia({ id, originalName, contentType, sizeBytes, storageKey, thumbnailKey }) {
      const { rows } = await pool.query(
        `INSERT INTO media (id, original_name, content_type, size_bytes, storage_key, thumbnail_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, originalName, contentType, sizeBytes, storageKey, thumbnailKey],
      );
      return toMedia(rows[0]);
    },

    async listMedia() {
      const { rows } = await pool.query('SELECT * FROM media ORDER BY uploaded_at DESC LIMIT 200');
      return rows.map(toMedia);
    },

    async getMedia(id) {
      const { rows } = await pool.query('SELECT * FROM media WHERE id = $1', [id]);
      return rows[0] ? toMedia(rows[0]) : null;
    },
  };
}


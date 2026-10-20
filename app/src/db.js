import pg from 'pg';

export function createDb(connectionString) {
  const pool = new pg.Pool({ connectionString });

  return {
    // Crée la table au démarrage si elle n'existe pas encore
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
    },

    async insertMedia({ id, originalName, contentType, sizeBytes, storageKey }) {
      const { rows } = await pool.query(
        `INSERT INTO media (id, original_name, content_type, size_bytes, storage_key)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING uploaded_at`,
        [id, originalName, contentType, sizeBytes, storageKey],
      );
      return { id, originalName, contentType, sizeBytes, uploadedAt: rows[0].uploaded_at };
    },
  };
}


import { createReadStream } from 'node:fs';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export function createStorage({ endpoint, region, bucket, accessKeyId, secretAccessKey }) {
  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Garage : le bucket est dans le chemin de l'URL
    requestChecksumCalculation: 'WHEN_REQUIRED', // compatibilité avec les stockages non-AWS
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return {
    async upload(key, filePath, contentType) {
      // Upload découpe les gros fichiers (vidéos) en morceaux automatiquement
      await new Upload({
        client,
        params: { Bucket: bucket, Key: key, Body: createReadStream(filePath), ContentType: contentType },
      }).done();
    },
  };
}


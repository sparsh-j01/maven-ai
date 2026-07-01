import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 via the S3 API (§8, docs/CLAUDE.md stack). Object storage for
// résumé files (and later interview audio). Buckets are private; reads happen
// through signed, expiring URLs (add when a download/report UI needs them — no
// consumer yet). Everything is config-gated: with the R2_* env unset this module
// imports fine and isR2Configured() is false, so the app runs with no bucket.
//
// R2 is S3-compatible, so this same code points at real R2 in prod or a local
// S3 (MinIO/localstack) in dev — only the endpoint + credentials change.

function cfg() {
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    // Optional override for a local S3-compatible endpoint (MinIO/localstack).
    endpoint: process.env.R2_ENDPOINT,
  };
}

export function isR2Configured(): boolean {
  const c = cfg();
  return Boolean(c.accessKeyId && c.secretAccessKey && c.bucket && (c.accountId || c.endpoint));
}

let _client: S3Client | undefined;
function client(): { s3: S3Client; bucket: string } {
  const c = cfg();
  if (!isR2Configured()) throw new Error("R2 is not configured");
  _client ??= new S3Client({
    region: "auto",
    endpoint: c.endpoint ?? `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId!, secretAccessKey: c.secretAccessKey! },
  });
  return { s3: _client, bucket: c.bucket! };
}

// Store bytes under `key`; returns the key (persisted as resumes.file_url).
export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { s3, bucket } = client();
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }),
  );
  return key;
}

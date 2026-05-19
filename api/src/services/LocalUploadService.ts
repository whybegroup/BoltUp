import path from 'path';
import fs from 'fs/promises';
import type { Application, Request, Response } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type {
  PresignGetBatchResponse,
  PresignGetEntry,
  PresignUploadResponse,
} from '../models/Upload';

const PRESIGN_TTL_SECONDS = 300;
const PRESIGN_GET_MAX_URLS = 50;
const STORAGE_KEY_PREFIX = 'storage';

function dataRoot(): string {
  return path.resolve(__dirname, '../../data');
}

function publicBaseUrl(): string {
  const raw = process.env.API_PUBLIC_URL?.trim().replace(/\/$/, '');
  return raw || `http://localhost:${process.env.PORT || 3000}`;
}

function uploadPutSecret(): string {
  return process.env.UPLOAD_PUT_SECRET?.trim() || 'moijia-local-upload-dev-secret';
}

function extensionFromFilenameOrType(filename: string | undefined, contentType: string): string {
  if (filename?.includes('.')) {
    const ext = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    if (ext && ext.length <= 8) return ext;
  }
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('zip')) return 'zip';
  if (contentType.includes('text/plain')) return 'txt';
  if (contentType.includes('msword')) return 'doc';
  if (contentType.includes('officedocument.wordprocessingml.document')) return 'docx';
  if (contentType.includes('spreadsheetml')) return 'xlsx';
  if (contentType.includes('presentationml')) return 'pptx';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'bin';
}

/** Stored URLs look like `{publicBase}/storage/files/storage/{userId}/{file}`. */
function tryExtractUploadObjectKey(sourceUrl: string): string | null {
  if (!sourceUrl?.trim()) return null;
  let u: URL;
  try {
    u = new URL(sourceUrl.trim());
  } catch {
    return null;
  }
  const prefix = '/storage/files/';
  if (!u.pathname.startsWith(prefix)) return null;
  const rest = u.pathname.slice(prefix.length);
  const key = rest
    .split('/')
    .map((s) => decodeURIComponent(s))
    .join('/');
  if (!key.startsWith(`${STORAGE_KEY_PREFIX}/`)) return null;
  if (key.includes('..') || key.includes('\\')) return null;
  return key;
}

function publicFileUrl(key: string): string {
  const base = publicBaseUrl();
  const encodedPath = key.split('/').map((s) => encodeURIComponent(s)).join('/');
  return `${base}/storage/files/${encodedPath}`;
}

/**
 * Register before `express.json()`: PUT /storage/put?t=… (raw body) and GET static /storage/files/*
 */
export function registerLocalUploadRoutes(app: Application): void {
  const filesDir = dataRoot();

  app.put(
    '/storage/put',
    express.raw({ type: '*/*', limit: '50mb' }),
    async (req: Request, res: Response) => {
      const token = typeof req.query.t === 'string' ? req.query.t : '';
      if (!token) {
        res.status(400).send('Missing token');
        return;
      }
      try {
        const payload = jwt.verify(token, uploadPutSecret()) as {
          typ?: string;
          key?: string;
          ct?: string;
        };
        if (payload.typ !== 'upload-put' || !payload.key?.startsWith(`${STORAGE_KEY_PREFIX}/`)) {
          res.status(403).send('Invalid token');
          return;
        }
        const buf = req.body as Buffer;
        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          res.status(400).send('Empty body');
          return;
        }
        const fullPath = path.join(filesDir, payload.key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buf);
        res.status(204).end();
      } catch (e) {
        if (e instanceof jwt.JsonWebTokenError || e instanceof jwt.TokenExpiredError) {
          res.status(403).send('Invalid or expired upload token');
          return;
        }
        console.error(e);
        res.status(500).send('Upload failed');
      }
    },
  );

  app.get('/storage/download/*', async (req: Request, res: Response) => {
    try {
      const wildcard = String(req.params[0] || '');
      const decodedKey = wildcard
        .split('/')
        .map((s) => decodeURIComponent(s))
        .join('/');
      if (!decodedKey.startsWith(`${STORAGE_KEY_PREFIX}/`) || decodedKey.includes('..') || decodedKey.includes('\\')) {
        res.status(400).send('Invalid file path');
        return;
      }
      const fullPath = path.resolve(path.join(filesDir, decodedKey));
      const root = path.resolve(filesDir);
      if (!fullPath.startsWith(root)) {
        res.status(403).send('Invalid file path');
        return;
      }
      const fileName = path.basename(fullPath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
      res.download(fullPath, fileName, (err) => {
        if (!err) return;
        const enoent = (err as NodeJS.ErrnoException).code === 'ENOENT';
        if (!res.headersSent) {
          res.status(enoent ? 404 : 500).send(enoent ? 'File not found' : 'Download failed');
        }
      });
    } catch {
      if (!res.headersSent) res.status(500).send('Download failed');
    }
  });

  app.use('/storage/files', express.static(filesDir));
}

export class LocalUploadService {
  public isConfigured(): boolean {
    return true;
  }

  public async presignUpload(input: {
    userId: string;
    contentType: string;
    filename?: string;
  }): Promise<PresignUploadResponse> {
    if (!input.contentType?.trim()) {
      throw Object.assign(new Error('contentType is required'), { status: 400 });
    }

    const ext = extensionFromFilenameOrType(input.filename, input.contentType);
    const key = `${STORAGE_KEY_PREFIX}/${input.userId}/${randomUUID()}.${ext}`;

    const token = jwt.sign(
      { typ: 'upload-put', key, ct: input.contentType },
      uploadPutSecret(),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );

    const base = publicBaseUrl();
    const uploadUrl = `${base}/storage/put?t=${encodeURIComponent(token)}`;
    const publicUrl = publicFileUrl(key);

    return {
      uploadUrl,
      publicUrl,
      objectKey: key,
      expiresIn: PRESIGN_TTL_SECONDS,
    };
  }

  public async deleteUploadedObject(userId: string, sourceUrl: string): Promise<void> {
    const key = tryExtractUploadObjectKey(sourceUrl);
    if (!key) {
      throw Object.assign(new Error('URL is not an app-managed upload'), { status: 400 });
    }
    const prefix = `${STORAGE_KEY_PREFIX}/${userId}/`;
    if (!key.startsWith(prefix)) {
      throw Object.assign(new Error('You can only delete your own uploads'), { status: 403 });
    }
    const fullPath = path.join(dataRoot(), key);
    try {
      await fs.unlink(fullPath);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') throw e;
    }
  }

  public async deleteManagedUploadBestEffort(sourceUrl: string): Promise<void> {
    try {
      const key = tryExtractUploadObjectKey(sourceUrl);
      if (!key) return;
      const fullPath = path.join(dataRoot(), key);
      await fs.unlink(fullPath);
    } catch {
      /* best-effort */
    }
  }

  /** Local files are served directly; external URLs pass through unchanged. */
  public async presignGetBatch(sourceUrls: string[]): Promise<PresignGetBatchResponse> {
    const trimmed = sourceUrls.map((s) => s?.trim()).filter((s): s is string => !!s);
    const unique = [...new Set(trimmed)];
    if (unique.length > PRESIGN_GET_MAX_URLS) {
      throw Object.assign(new Error(`At most ${PRESIGN_GET_MAX_URLS} URLs per request`), {
        status: 400,
      });
    }

    const results: PresignGetEntry[] = unique.map((sourceUrl) => {
      const key = tryExtractUploadObjectKey(sourceUrl);
      if (!key) {
        return { sourceUrl, viewUrl: sourceUrl, expiresIn: 0 };
      }
      return { sourceUrl, viewUrl: sourceUrl, expiresIn: 0 };
    });

    return { results };
  }
}

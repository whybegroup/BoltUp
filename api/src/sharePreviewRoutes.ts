import type { Application, Request, Response } from 'express';
import { resolveSharePreview } from './services/SharePreviewService';
import { renderSharePreviewHtml } from './utils/sharePreviewHtml';

function firstQueryValue(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

function queryRecord(req: Request): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req.query)) {
    const first = firstQueryValue(value);
    if (first != null) out[key] = first;
  }
  return out;
}

export function registerSharePreviewRoutes(app: Application): void {
  const handler = async (req: Request, res: Response) => {
    try {
      const card = await resolveSharePreview(req.path, queryRecord(req));
      res
        .status(200)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'public, max-age=120')
        .send(renderSharePreviewHtml(card));
    } catch (err) {
      console.error(err);
      res.status(500).type('text').send('Share preview failed');
    }
  };

  app.get(['/event/:id', '/poll/:id', '/join/:code', '/groups/:groupId/forum'], handler);
}
